import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CATALOG_CLIENT } from '../../core/api/clients';
import { describeError } from '../../core/api/errors';
import { CATEGORY_LABELS, formatQuantity } from '../../core/labels';
import type { Product } from '../../gen/subastacampo/v1/catalog_pb';

@Component({
  selector: 'app-my-products-page',
  imports: [RouterLink],
  templateUrl: './my-products-page.html',
  styleUrl: './my-products-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyProductsPage {
  private readonly catalog = inject(CATALOG_CLIENT);

  protected readonly products = signal<Product[]>([]);
  protected readonly nextPageToken = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly formatQuantity = formatQuantity;

  constructor() {
    void this.load();
  }

  protected async load(pageToken = ''): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.catalog.listProducts({ onlyMine: true, pageSize: 20, pageToken });
      this.products.update((current) =>
        pageToken ? [...current, ...response.products] : response.products,
      );
      this.nextPageToken.set(response.nextPageToken);
      this.error.set(null);
    } catch (caught) {
      this.error.set(describeError(caught).message);
    } finally {
      this.loading.set(false);
    }
  }
}
