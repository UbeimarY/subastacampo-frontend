import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AUCTION_CLIENT } from '../../core/api/clients';
import { describeError } from '../../core/api/errors';
import { SessionStore } from '../../core/auth/session.store';
import { formatCop, formatNumber, toMillis } from '../../core/format';
import { CATEGORY_LABELS, STATUS_LABELS, formatQuantity } from '../../core/labels';
import { ClockService } from '../../core/time/clock.service';
import { AuctionScope, AuctionStatus, type Auction } from '../../gen/subastacampo/v1/auction_pb';
import { ProductCategory } from '../../gen/subastacampo/v1/common_pb';
import { Countdown } from '../../shared/countdown';
import { FieldArt } from '../../shared/field-art';
import { Freshness } from '../../shared/freshness';
import { Hillside } from '../../shared/hillside';
import { TimeBar } from '../../shared/time-bar';

type Tab = 'live' | 'closed' | 'mine';
type Sort = 'ending' | 'price' | 'bids' | 'newest';

const SOON_MS = 10 * 60 * 1000;

const REFRESH_MS = 15_000;

@Component({
  selector: 'app-auctions-page',
  imports: [RouterLink, Countdown, FieldArt, Freshness, Hillside, TimeBar],
  templateUrl: './auctions-page.html',
  styleUrl: './auctions-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsPage {
  private readonly auctions = inject(AUCTION_CLIENT);
  protected readonly session = inject(SessionStore);
  private readonly clock = inject(ClockService);

  /** "my-bids" when opened from the buyer's "Mis pujas" route (route data). */
  readonly scope = input<'my-bids'>();

  protected readonly tab = signal<Tab>('live');
  protected readonly items = signal<Auction[]>([]);
  protected readonly nextPageToken = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly myBids = computed(() => this.scope() === 'my-bids');
  protected readonly heading = computed(() =>
    this.myBids() ? 'Subastas donde pujaste' : 'Subastas de cosecha',
  );

  // Filters run in the browser over the loaded page: instant, no extra requests.
  protected readonly category = signal<ProductCategory | null>(null);
  protected readonly query = signal('');
  protected readonly sort = signal<Sort>('ending');

  protected readonly categories = computed(() => {
    const counts = new Map<ProductCategory, number>();
    for (const auction of this.items()) {
      const category = auction.product?.category ?? ProductCategory.OTHER;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts].map(([value, count]) => ({ value, count, label: CATEGORY_LABELS[value] }));
  });

  protected readonly visible = computed(() => {
    const category = this.category();
    const words = normalize(this.query()).split(/\s+/).filter(Boolean);
    const list = this.items().filter((auction) => {
      if (category !== null && auction.product?.category !== category) return false;
      const name = normalize(
        `${auction.product?.name ?? ''} ${auction.product?.description ?? ''}`,
      );
      return words.every((word) => name.includes(word));
    });
    const price = (a: Auction) => a.currentPrice?.units ?? 0n;
    switch (this.sort()) {
      case 'price':
        return list.sort((a, b) => (price(b) > price(a) ? 1 : price(b) < price(a) ? -1 : 0));
      case 'bids':
        return list.sort((a, b) => b.bidCount - a.bidCount);
      case 'newest':
        return list.sort((a, b) => toMillis(b.startsAt) - toMillis(a.startsAt));
      default:
        return list.sort((a, b) => toMillis(a.endsAt) - toMillis(b.endsAt));
    }
  });

  /** What is happening right now, for the board's header. */
  protected readonly stats = computed(() => {
    const live = this.tab() === 'live' ? this.items() : [];
    const now = this.clock.now();
    return {
      lots: live.length,
      bids: live.reduce((sum, a) => sum + a.bidCount, 0),
      atStake: live.reduce((sum, a) => sum + (a.currentPrice?.units ?? 0n), 0n),
      closingSoon: live.filter((a) => toMillis(a.endsAt) - now <= SOON_MS).length,
    };
  });

  protected readonly formatNumber = formatNumber;
  protected readonly formatCop = formatCop;
  protected readonly formatQuantity = formatQuantity;
  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly STATUS_LABELS = STATUS_LABELS;
  protected readonly AuctionStatus = AuctionStatus;

  constructor() {
    effect(() => {
      this.tab();
      this.scope();
      void this.load();
    });

    // Prices change while people bid: refresh the live board while it is visible.
    const timer = setInterval(() => {
      if (this.tab() === 'live' && document.visibilityState === 'visible') void this.load(true);
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected select(tab: Tab): void {
    this.tab.set(tab);
    this.category.set(null);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as Sort);
  }

  /** The buyer's outcome in "Mis pujas": won, lost or still running. */
  protected outcome(auction: Auction): 'won' | 'lost' | 'running' {
    if (auction.status === AuctionStatus.ACTIVE) return 'running';
    return auction.winnerId && auction.winnerId === this.session.user()?.id ? 'won' : 'lost';
  }

  protected closingSoon(auction: Auction): boolean {
    return (
      auction.status === AuctionStatus.ACTIVE &&
      toMillis(auction.endsAt) - this.clock.now() <= SOON_MS
    );
  }

  protected async load(silent = false, pageToken = ''): Promise<void> {
    if (!silent) this.loading.set(true);
    try {
      const response = await this.auctions.listAuctions({
        status: this.statusFilter(),
        scope: this.scopeFilter(),
        pageSize: 20,
        pageToken,
      });
      this.items.update((current) =>
        pageToken ? [...current, ...response.auctions] : response.auctions,
      );
      this.nextPageToken.set(response.nextPageToken);
      this.error.set(null);
    } catch (caught) {
      if (!silent) this.error.set(describeError(caught).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected loadMore(): void {
    void this.load(false, this.nextPageToken());
  }

  private statusFilter(): AuctionStatus {
    if (this.myBids()) return AuctionStatus.UNSPECIFIED;
    switch (this.tab()) {
      case 'live':
        return AuctionStatus.ACTIVE;
      case 'closed':
        return AuctionStatus.CLOSED;
      default:
        return AuctionStatus.UNSPECIFIED;
    }
  }

  private scopeFilter(): AuctionScope {
    if (this.myBids()) return AuctionScope.MY_BIDS;
    return this.tab() === 'mine' ? AuctionScope.MY_PRODUCTS : AuctionScope.UNSPECIFIED;
  }
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}
