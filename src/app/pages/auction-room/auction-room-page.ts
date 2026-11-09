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

const MAX_RETRIES = 2;

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: 'Conectando…',
  live: 'En vivo',
  reconnecting: 'Reconectando…',
  finished: 'Subasta terminada',
  failed: 'Sin conexión',
};

@Component({
  selector: 'app-auction-room-page',
  imports: [RouterLink, Countdown, ContactCard, FieldArt, Freshness, PriceChart, TimeBar],
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
          await this.auctions.placeBid({
            auctionId: auction.id,
            amount: { currencyCode: 'COP', units: amount },
            requestId,
          });
          this.bidSuccess.set(`Tu puja de ${formatCop(amount)} quedó registrada.`);
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
