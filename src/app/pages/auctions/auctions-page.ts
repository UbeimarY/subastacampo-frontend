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
import { formatCop } from '../../core/format';
import { CATEGORY_LABELS, STATUS_LABELS, formatQuantity } from '../../core/labels';
import { AuctionScope, AuctionStatus, type Auction } from '../../gen/subastacampo/v1/auction_pb';
import { Countdown } from '../../shared/countdown';

type Tab = 'live' | 'closed' | 'mine';

const REFRESH_MS = 15_000;

@Component({
  selector: 'app-auctions-page',
  imports: [RouterLink, Countdown],
  templateUrl: './auctions-page.html',
  styleUrl: './auctions-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsPage {
  private readonly auctions = inject(AUCTION_CLIENT);
  protected readonly session = inject(SessionStore);

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
