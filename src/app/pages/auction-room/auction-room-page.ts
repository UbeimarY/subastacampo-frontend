import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AUCTION_CLIENT } from '../../core/api/clients';
import { describeError, isTransient } from '../../core/api/errors';
import { SessionStore } from '../../core/auth/session.store';
import { formatCop, formatDay, formatTime, parsePesos } from '../../core/format';
import { openAuctionRoom, type AuctionRoom } from '../../core/live/auction-room';
import type { ConnectionState } from '../../core/live/room-state';
import {
  CATEGORY_LABELS,
  KG_PER_UNIT,
  RISK_LEVEL_LABELS,
  RISK_SIGNAL_LABELS,
  formatQuantity,
} from '../../core/labels';
import { AuctionStatus, RiskLevel, type Bid } from '../../gen/subastacampo/v1/auction_pb';
import { ContactCard } from '../../shared/contact-card';
import { Countdown } from '../../shared/countdown';
import { FieldArt } from '../../shared/field-art';
import { Freshness } from '../../shared/freshness';
import { PriceChart } from '../../shared/price-chart';
import { TimeBar } from '../../shared/time-bar';
import { AutoBidPanel } from '../../shared/auto-bid-panel';

const MAX_RETRIES = 2;
const NOTIFY_KEY = 'subastacampo.notify-outbid';

function readNotifyPreference(): boolean {
  try {
    return (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      localStorage.getItem(NOTIFY_KEY) === '1'
    );
  } catch {
    return false;
  }
}

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: 'Conectando…',
  live: 'En vivo',
  reconnecting: 'Reconectando…',
  finished: 'Subasta terminada',
  failed: 'Sin conexión',
};

@Component({
  selector: 'app-auction-room-page',
  imports: [
    RouterLink,
    AutoBidPanel,
    Countdown,
    ContactCard,
    FieldArt,
    Freshness,
    PriceChart,
    TimeBar,
  ],
  templateUrl: './auction-room-page.html',
  styleUrl: './auction-room-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionRoomPage {
  private readonly auctions = inject(AUCTION_CLIENT);
  protected readonly session = inject(SessionStore);

  /** Route parameter :auctionId. */
  readonly auctionId = input.required<string>();

  private readonly room = signal<AuctionRoom | null>(null);

  protected readonly state = computed(() => this.room()?.state() ?? null);
  protected readonly streamError = computed(() => this.room()?.error() ?? null);
  protected readonly auction = computed(() => this.state()?.auction ?? null);
  protected readonly bids = computed(() => this.state()?.bids ?? []);
  protected readonly connection = computed(() => this.state()?.connection ?? 'connecting');
  protected readonly connectionLabel = computed(() => CONNECTION_LABELS[this.connection()]);

  protected readonly isActive = computed(() => this.auction()?.status === AuctionStatus.ACTIVE);
  protected readonly isOwner = computed(() => {
    const me = this.session.user()?.id;
    return !!me && me === this.auction()?.product?.producerId;
  });
  protected readonly canBid = computed(() => this.isActive() && this.session.isBuyer());

  protected readonly minimum = computed(() => this.auction()?.nextMinBid?.units ?? 0n);
  protected readonly increment = computed(() => this.auction()?.minIncrement?.units ?? 0n);
  protected readonly quickBids = computed(() => {
    const minimum = this.minimum();
    const step = this.increment();
    return minimum > 0n ? [minimum, minimum + step, minimum + step * 3n] : [];
  });

  protected readonly result = computed(() => {
    const auction = this.auction();
    if (!auction || auction.status !== AuctionStatus.CLOSED) return null;
    if (!auction.winnerId) return { kind: 'empty' as const };
    if (auction.winnerId === this.session.user()?.id) return { kind: 'won' as const };
    const winner = this.bids().find((bid) => bid.bidderId === auction.winnerId);
    return { kind: 'other' as const, bidderNumber: winner?.bidderNumber };
  });

  /** For a buyer who already bid: are they on top right now? */
  protected readonly standing = computed(() => {
    if (!this.isActive() || !this.session.isBuyer()) return null;
    const bids = this.bids();
    if (!bids.some((bid) => this.isMine(bid))) return null;
    return this.isMine(bids[0]) ? ('leading' as const) : ('outbid' as const);
  });

  /** Only the producer and the winner can see each other's contact (the server checks it too). */
  protected readonly showContact = computed(() => {
    const auction = this.auction();
    const me = this.session.user()?.id;
    return (
      auction?.status === AuctionStatus.CLOSED &&
      !!auction.winnerId &&
      !!me &&
      (me === auction.winnerId || this.isOwner())
    );
  });

  protected readonly pricePerKg = computed(() => {
    const auction = this.auction();
    const product = auction?.product;
    if (!auction?.currentPrice || !product) return null;
    const kilos = product.quantity * KG_PER_UNIT[product.unit];
    return kilos > 0 ? BigInt(Math.round(Number(auction.currentPrice.units) / kilos)) : null;
  });

  protected readonly startingPrice = computed(() => this.auction()?.startingPrice?.units ?? 0n);

  protected readonly amount = signal('');
  protected readonly amountLabel = computed(() => {
    const value = parsePesos(this.amount());
    return value === null ? '' : formatCop(value);
  });
  protected readonly placing = signal(false);
  protected readonly bidError = signal<string | null>(null);
  protected readonly bidSuccess = signal<string | null>(null);
  /** Briefly true when a new top bid arrives: the board "beats". */
  protected readonly pulse = signal(false);
  /** Set when the buyer goes from leading to outbid; cleared by bidding or dismissing. */
  protected readonly outbidAlert = signal(false);
  protected readonly canNotify = signal(typeof Notification !== 'undefined');
  protected readonly notify = signal(readNotifyPreference());

  protected readonly formatCop = formatCop;
  protected readonly formatTime = formatTime;
  protected readonly formatDay = formatDay;
  protected readonly formatQuantity = formatQuantity;
  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly RISK_LEVEL_LABELS = RISK_LEVEL_LABELS;
  protected readonly RISK_SIGNAL_LABELS = RISK_SIGNAL_LABELS;
  protected readonly RiskLevel = RiskLevel;

  constructor() {
    // (Re)open the live stream whenever the route parameter changes.
    // Effects are cleaned up on destroy too, so leaving the page closes the stream.
    effect((onCleanup) => {
      const room = openAuctionRoom(this.auctions, this.auctionId());
      untracked(() => this.room.set(room));
      onCleanup(() => room.close());
    });

    // Keep the amount field at the current minimum unless the user typed more.
    let lastMinimum = 0n;
    effect(() => {
      const minimum = this.minimum();
      if (minimum === lastMinimum) return;
      const typed = untracked(() => parsePesos(this.amount()));
      if (typed === null || typed < minimum) this.amount.set(minimum.toString());
      lastMinimum = minimum;
    });

    // Leading -> outbid: say it loudly, once per time it happens.
    let lastStanding: 'leading' | 'outbid' | null = null;
    effect(() => {
      const standing = this.standing();
      if (lastStanding === 'leading' && standing === 'outbid')
        untracked(() => this.announceOutbid());
      if (standing === 'leading') untracked(() => this.outbidAlert.set(false));
      lastStanding = standing;
    });

    // Pulse the board when a new bid tops the list (not on the first snapshot).
    let topBidId: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const top = this.bids()[0]?.id;
      if (topBidId !== undefined && top !== topBidId) {
        untracked(() => this.pulse.set(true));
        clearTimeout(timer);
        timer = setTimeout(() => this.pulse.set(false), 1200);
      }
      topBidId = top ?? '';
    });
  }

  protected bidMinimum(): void {
    this.amount.set(this.minimum().toString());
    void this.placeBid();
  }

  /** Browser notifications, only after the buyer asks for them. */
  protected async toggleNotify(): Promise<void> {
    if (this.notify()) {
      this.notify.set(false);
    } else {
      const permission =
        Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
      this.notify.set(permission === 'granted');
    }
    try {
      localStorage.setItem(NOTIFY_KEY, this.notify() ? '1' : '0');
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
  }

  private announceOutbid(): void {
    this.outbidAlert.set(true);
    navigator.vibrate?.([120, 60, 120]);
    if (!this.notify() || !document.hidden || Notification.permission !== 'granted') return;
    const auction = this.auction();
    new Notification('Te superaron en SubastaCampo', {
      body: `${auction?.product?.name ?? 'Tu lote'}: la puja más alta es ${formatCop(auction?.currentPrice)}.`,
      tag: `outbid-${auction?.id}`,
    });
  }

  protected chooseAmount(value: bigint): void {
    this.amount.set(value.toString());
  }

  protected onAmountInput(event: Event): void {
    this.amount.set((event.target as HTMLInputElement).value);
  }

  protected async placeBid(): Promise<void> {
    const auction = this.auction();
    const amount = parsePesos(this.amount());
    this.bidSuccess.set(null);
    if (!auction) return;
    if (amount === null || amount < this.minimum()) {
      this.bidError.set(`Tu puja debe ser de al menos ${formatCop(this.minimum())}.`);
      return;
    }

    this.placing.set(true);
    this.bidError.set(null);
    // One id per bid: if the network drops and we retry, the server recognizes
    // the same request and never records the bid twice (idempotency).
    const requestId = crypto.randomUUID();
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await this.auctions.placeBid({
            auctionId: auction.id,
            amount: { currencyCode: 'COP', units: amount },
            requestId,
          });
          const price = response.auction?.currentPrice?.units ?? amount;
          if (price > amount) {
            // Another buyer's automatic bid answered in the same instant.
            this.bidSuccess.set(
              `Tu puja de ${formatCop(amount)} quedó registrada, pero una puja automática la superó al instante.`,
            );
            this.outbidAlert.set(true);
          } else {
            this.bidSuccess.set(`Tu puja de ${formatCop(amount)} quedó registrada.`);
          }
          return;
        } catch (caught) {
          if (attempt < MAX_RETRIES && isTransient(caught)) continue;
          throw caught;
        }
      }
    } catch (caught) {
      const error = describeError(caught);
      this.bidError.set(
        error.minimumBid
          ? `${error.message} El mínimo ahora es ${formatCop(error.minimumBid)}.`
          : error.message,
      );
      if (error.minimumBid) this.amount.set(error.minimumBid.toString());
    } finally {
      this.placing.set(false);
    }
  }

  protected isMine(bid: Bid): boolean {
    return bid.bidderId === this.session.user()?.id;
  }

  protected riskClass(level: RiskLevel | undefined): string {
    switch (level) {
      case RiskLevel.HIGH:
        return 'risk risk--high';
      case RiskLevel.MEDIUM:
        return 'risk risk--medium';
      default:
        return 'risk';
    }
  }
}
