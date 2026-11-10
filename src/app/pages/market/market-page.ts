import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { CATALOG_CLIENT } from '../../core/api/clients';
import { formatCop, formatDay } from '../../core/format';
import { openMarketFeed, type MarketFeed } from '../../core/live/market-feed';
import { CATEGORY_LABELS } from '../../core/labels';
import type { CategoryMarket } from '../../gen/subastacampo/v1/catalog_pb';
import { ProductCategory } from '../../gen/subastacampo/v1/common_pb';
import { FieldArt } from '../../shared/field-art';

const CLOCK = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
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
  private readonly feed = signal<MarketFeed | null>(null);
  protected readonly markets = computed(() => this.feed()?.categories() ?? null);
  protected readonly error = computed(() => this.feed()?.error() ?? null);
  protected readonly mode = computed(() => this.feed()?.mode() ?? 'connecting');
  protected readonly updatedAt = computed(() => this.feed()?.updatedAt() ?? null);
  /** Categories whose typical price just changed: their card flashes once. */
  protected readonly changed = signal<ReadonlySet<number>>(new Set());
  protected readonly totalSales = computed(() =>
    (this.markets() ?? []).reduce((sum, market) => sum + market.sales, 0),
  );

  protected readonly formatCop = formatCop;
  protected readonly formatDay = formatDay;
  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  constructor() {
    // One feed per period; leaving the page or changing the period closes it.
    effect((onCleanup) => {
      const feed = openMarketFeed(this.catalog, this.days());
      untracked(() => this.feed.set(feed));
      onCleanup(() => feed.close());
    });

    let previous = new Map<number, bigint>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const markets = this.markets() ?? [];
      const current = new Map(markets.map((m) => [m.category, m.medianPricePerKg?.units ?? 0n]));
      const moved = markets
        .filter(
          (m) => previous.has(m.category) && previous.get(m.category) !== current.get(m.category),
        )
        .map((m) => m.category);
      previous = current;
      if (moved.length === 0) return;
      untracked(() => this.changed.set(new Set(moved)));
      clearTimeout(timer);
      timer = setTimeout(() => this.changed.set(new Set()), 2400);
    });
  }

  protected choose(days: number): void {
    this.days.set(days);
  }

  protected formatClock(date: Date): string {
    return CLOCK.format(date);
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
}
