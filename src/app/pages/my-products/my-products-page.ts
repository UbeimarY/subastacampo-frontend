import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AUCTION_CLIENT, CATALOG_CLIENT } from '../../core/api/clients';
import { describeError } from '../../core/api/errors';
import { formatCop } from '../../core/format';
import { CATEGORY_LABELS, formatQuantity } from '../../core/labels';
import { AuctionScope, AuctionStatus, type Auction } from '../../gen/subastacampo/v1/auction_pb';
import type { Product } from '../../gen/subastacampo/v1/catalog_pb';
import { ContactCard } from '../../shared/contact-card';
import { Countdown } from '../../shared/countdown';
import { FieldArt } from '../../shared/field-art';
import { Freshness } from '../../shared/freshness';

interface Row {
  product: Product;
  /** The product's most recent auction, if it ever had one. */
  auction: Auction | null;
}

/** The producer's desk: every lot, how its auction is going, and who to call when it sold. */
@Component({
  selector: 'app-my-products-page',
  imports: [RouterLink, ContactCard, Countdown, FieldArt, Freshness],
  templateUrl: './my-products-page.html',
  styleUrl: './my-products-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProductsPage {
  private readonly catalog = inject(CATALOG_CLIENT);
  private readonly auctionsClient = inject(AUCTION_CLIENT);

  protected readonly products = signal<Product[]>([]);
  private readonly auctions = signal<Auction[]>([]);
  protected readonly nextPageToken = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** The sold lot whose buyer contact is open. */
  protected readonly openContact = signal<string | null>(null);

  protected readonly rows = computed<Row[]>(() => {
    const latest = new Map<string, Auction>();
    // Auctions come newest first: the first one seen per product is the latest.
    for (const auction of this.auctions()) {
      const id = auction.product?.id;
      if (id && !latest.has(id)) latest.set(id, auction);
    }
    return this.products().map((product) => ({
      product,
      auction: latest.get(product.id) ?? null,
    }));
  });

  protected readonly summary = computed(() => {
    const auctions = this.auctions();
    const sold = auctions.filter((a) => a.status === AuctionStatus.CLOSED && a.winnerId);
    return {
      lots: this.products().length,
      live: auctions.filter((a) => a.status === AuctionStatus.ACTIVE).length,
      sold: sold.length,
      earned: sold.reduce((sum, a) => sum + (a.currentPrice?.units ?? 0n), 0n),
    };
  });

  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly AuctionStatus = AuctionStatus;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatCop = formatCop;

  constructor() {
    void this.load();
  }

  protected async load(pageToken = ''): Promise<void> {
    this.loading.set(true);
    try {
      const [products, auctions] = await Promise.all([
        this.catalog.listProducts({ onlyMine: true, pageSize: 20, pageToken }),
        pageToken
          ? Promise.resolve(null)
          : this.auctionsClient.listAuctions({ scope: AuctionScope.MY_PRODUCTS, pageSize: 100 }),
      ]);
      this.products.update((current) =>
        pageToken ? [...current, ...products.products] : products.products,
      );
      if (auctions) this.auctions.set(auctions.auctions);
      this.nextPageToken.set(products.nextPageToken);
      this.error.set(null);
    } catch (caught) {
      this.error.set(describeError(caught).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleContact(auctionId: string): void {
    this.openContact.update((current) => (current === auctionId ? null : auctionId));
  }

  protected canAuction(row: Row): boolean {
    return row.product.remainingShelfLifeDays > 0 && row.auction?.status !== AuctionStatus.ACTIVE;
  }
}
