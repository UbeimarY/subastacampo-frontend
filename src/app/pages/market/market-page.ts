import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CATALOG_CLIENT } from '../../core/api/clients';
import { describeError } from '../../core/api/errors';
import { formatCop, formatDay } from '../../core/format';
import { CATEGORY_LABELS } from '../../core/labels';
import type { CategoryMarket } from '../../gen/subastacampo/v1/catalog_pb';
import { ProductCategory } from '../../gen/subastacampo/v1/common_pb';
import { FieldArt } from '../../shared/field-art';

const WIDTH = 280;
const HEIGHT = 72;

/** The category's field colour, as on its cards. */
const FIELD_COLORS: Partial<Record<ProductCategory, string>> = {
  [ProductCategory.FRUITS]: 'var(--field-fruits)',
  [ProductCategory.VEGETABLES]: 'var(--field-vegetables)',
  [ProductCategory.TUBERS]: 'var(--field-tubers)',
  [ProductCategory.GRAINS]: 'var(--field-grains)',
  [ProductCategory.DAIRY]: 'var(--field-dairy)',
  [ProductCategory.OTHER]: 'var(--field-other)',
};

interface Point {
  x: number;
  y: number;
  label: string;
}

/**
 * What the platform's own sales paid per kilo, by category. Producers check it
 * before pricing a lot; buyers before setting a maximum.
 */
@Component({
  selector: 'app-market-page',
  imports: [FieldArt, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './market-page.html',
  styleUrl: './market-page.scss',
})
export class MarketPage {
  private readonly catalog = inject(CATALOG_CLIENT);

  protected readonly periods = [30, 60, 90] as const;
  protected readonly days = signal<number>(60);
  protected readonly markets = signal<CategoryMarket[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly totalSales = computed(() =>
    (this.markets() ?? []).reduce((sum, market) => sum + market.sales, 0),
  );

  protected readonly formatCop = formatCop;
  protected readonly formatDay = formatDay;
  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  constructor() {
    void this.load();
  }

  protected choose(days: number): void {
    this.days.set(days);
    void this.load();
  }

  /** Weekly medians as a line in the card's own scale. */
  protected points(market: CategoryMarket): Point[] {
    const values = market.weeks.map((week) => Number(week.medianPricePerKg?.units ?? 0n));
    if (values.length === 0) return [];
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = high - low || 1;
    const step = values.length > 1 ? (WIDTH - 12) / (values.length - 1) : 0;
    return market.weeks.map((week, i) => ({
      x: 6 + i * step,
      y: 8 + (1 - (values[i] - low) / span) * (HEIGHT - 16),
      label: `Semana del ${formatDay(week.weekStart)}: ${formatCop(week.medianPricePerKg)} por kilo, ${week.sales} ${week.sales === 1 ? 'venta' : 'ventas'}`,
    }));
  }

  protected path(points: Point[]): string {
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }

  protected lineColor(market: CategoryMarket): string {
    return FIELD_COLORS[market.category] ?? 'var(--paramo)';
  }

  private async load(): Promise<void> {
    this.error.set(null);
    try {
      const response = await this.catalog.getMarketPrices({ days: this.days() });
      this.markets.set(response.categories);
    } catch (caught) {
      this.error.set(describeError(caught).message);
    }
  }
}
