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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AUCTION_CLIENT, CATALOG_CLIENT } from '../../core/api/clients';
import { describeError } from '../../core/api/errors';
import { formatCop, formatNumber, localIsoDate, parsePesos, roundPesos } from '../../core/format';
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  UNIT_OPTIONS,
  describeFactor,
  formatQuantity,
} from '../../core/labels';
import type { PriceSuggestion, Product } from '../../gen/subastacampo/v1/catalog_pb';
import { ProductCategory, QuantityUnit } from '../../gen/subastacampo/v1/common_pb';

type Step = 'product' | 'price';

export const DURATION_OPTIONS = [
  { seconds: 5 * 60, label: '5 minutos' },
  { seconds: 15 * 60, label: '15 minutos' },
  { seconds: 30 * 60, label: '30 minutos' },
  { seconds: 60 * 60, label: '1 hora' },
  { seconds: 3 * 60 * 60, label: '3 horas' },
  { seconds: 24 * 60 * 60, label: '24 horas' },
];

@Component({
  selector: 'app-publish-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './publish-page.html',
  styleUrl: './publish-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublishPage {
  private readonly catalog = inject(CATALOG_CLIENT);
  private readonly auctions = inject(AUCTION_CLIENT);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Query parameter "producto": auction an already published product. */
  readonly producto = input<string>();

  protected readonly today = localIsoDate();
  protected readonly step = signal<Step>('product');
  protected readonly product = signal<Product | null>(null);
  protected readonly suggestion = signal<PriceSuggestion | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly suggestionError = signal<string | null>(null);

  protected readonly productForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    description: ['', Validators.maxLength(2000)],
    category: [ProductCategory.TUBERS, Validators.required],
    unit: [QuantityUnit.SACK, Validators.required],
    quantity: [10, [Validators.required, Validators.min(0.01), Validators.max(1_000_000)]],
    harvestDate: [this.today, Validators.required],
    shelfLifeDays: [30, [Validators.required, Validators.min(1), Validators.max(365)]],
  });

  protected readonly auctionForm = this.fb.group({
    startingPrice: ['', Validators.required],
    minIncrement: ['', Validators.required],
    durationSeconds: [15 * 60, Validators.required],
  });

  /** Where the suggested price sits inside the model's 10–90 % range, in percent. */
  protected readonly markerPosition = computed(() => {
    const suggestion = this.suggestion();
    if (!suggestion) return 50;
    const low = Number(suggestion.rangeMin?.units ?? 0n);
    const high = Number(suggestion.rangeMax?.units ?? 0n);
    const value = Number(suggestion.suggestedPrice?.units ?? 0n);
    return high > low ? Math.min(100, Math.max(0, ((value - low) / (high - low)) * 100)) : 50;
  });

  protected readonly CATEGORY_OPTIONS = CATEGORY_OPTIONS;
  protected readonly UNIT_OPTIONS = UNIT_OPTIONS;
  protected readonly DURATION_OPTIONS = DURATION_OPTIONS;
  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly formatCop = formatCop;
  protected readonly formatNumber = formatNumber;
  protected readonly formatQuantity = formatQuantity;
  protected readonly describeFactor = describeFactor;

  constructor() {
    effect(() => {
      const productId = this.producto();
      if (productId) untracked(() => void this.openExisting(productId));
    });
  }

  protected invalid(name: keyof typeof this.productForm.controls): boolean {
    const control = this.productForm.controls[name];
    return control.touched && control.invalid;
  }

  protected async publishProduct(): Promise<void> {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }
    if (this.productForm.controls.harvestDate.value > this.today) {
      this.error.set('La fecha de cosecha no puede ser posterior a hoy.');
      return;
    }
    await this.run(async () => {
      const value = this.productForm.getRawValue();
      const { product } = await this.catalog.createProduct({
        ...value,
        name: value.name.trim(),
        description: value.description.trim(),
        quantity: Number(value.quantity),
        shelfLifeDays: Number(value.shelfLifeDays),
      });
      if (!product) throw new Error('Product missing in response');
      await this.showSuggestion(product);
    });
  }

  protected async startAuction(): Promise<void> {
    const product = this.product();
    const startingPrice = parsePesos(this.auctionForm.controls.startingPrice.value);
    const minIncrement = parsePesos(this.auctionForm.controls.minIncrement.value);
    if (!product) return;
    if (startingPrice === null || startingPrice <= 0n) {
      this.error.set('Escribe un precio inicial válido, en pesos.');
      return;
    }
    if (minIncrement === null || minIncrement <= 0n) {
      this.error.set('Escribe un incremento mínimo válido, en pesos.');
      return;
    }
    await this.run(async () => {
      const { auction } = await this.auctions.createAuction({
        productId: product.id,
        startingPrice: { currencyCode: 'COP', units: startingPrice },
        minIncrement: { currencyCode: 'COP', units: minIncrement },
        duration: { seconds: BigInt(this.auctionForm.controls.durationSeconds.value), nanos: 0 },
      });
      await this.router.navigate(['/subastas', auction?.id]);
    });
  }

  protected useSuggested(): void {
    const suggested = this.suggestion()?.suggestedPrice?.units;
    if (suggested) this.auctionForm.controls.startingPrice.setValue(suggested.toString());
  }

  private async openExisting(productId: string): Promise<void> {
    await this.run(async () => {
      const { product } = await this.catalog.getProduct({ productId });
      if (product) await this.showSuggestion(product);
    });
  }

  private async showSuggestion(product: Product): Promise<void> {
    this.product.set(product);
    this.step.set('price');
    this.suggestion.set(null);
    this.suggestionError.set(null);
    try {
      const { suggestion } = await this.catalog.suggestPrice({ productId: product.id });
      this.suggestion.set(suggestion ?? null);
      if (suggestion?.rangeMin && suggestion.suggestedPrice) {
        // Auctions usually open low to attract bids: start at the cautious end of the range.
        this.auctionForm.patchValue({
          startingPrice: suggestion.rangeMin.units.toString(),
          minIncrement: roundPesos(suggestion.suggestedPrice.units / 100n, 100n).toString(),
        });
      }
    } catch (caught) {
      // The product is already published: the producer can still price it by hand.
      this.suggestionError.set(describeError(caught).message);
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (caught) {
      this.error.set(describeError(caught).message);
    } finally {
      this.busy.set(false);
    }
  }
}
