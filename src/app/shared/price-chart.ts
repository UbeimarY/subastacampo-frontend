import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatCop } from '../core/format';
import type { Bid } from '../gen/subastacampo/v1/auction_pb';

const WIDTH = 320;
const HEIGHT = 96;
const PAD = 6;

/** How the price climbed, bid after bid, from the starting price. */
@Component({
  selector: 'app-price-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points(); as chart) {
      <svg
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        preserveAspectRatio="none"
        role="img"
        [attr.aria-label]="label()"
      >
        <path [attr.d]="chart.area" class="area" />
        <path [attr.d]="chart.line" class="line" vector-effect="non-scaling-stroke" />
      </svg>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: 96px;
    }
    .area {
      fill: rgb(233 177 10 / 0.16);
    }
    .line {
      fill: none;
      stroke: var(--maize);
      stroke-width: 2.5;
      stroke-linejoin: round;
    }
  `,
})
export class PriceChart {
  /** Newest first, as the contract sends them. */
  readonly bids = input.required<Bid[]>();
  readonly startingPrice = input.required<bigint>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  protected readonly label = computed(() => {
    const top = this.bids()[0];
    return top
      ? `El precio subió de ${formatCop(this.startingPrice())} a ${formatCop(top.amount)} en ${this.bids().length} pujas`
      : '';
  });

  protected readonly points = computed(() => {
    const bids = [...this.bids()].reverse();
    if (bids.length === 0) return null;
    // One step per bid: bids can arrive seconds or hours apart, the climb is what matters.
    const series = [
      { t: 0, v: Number(this.startingPrice()) },
      ...bids.map((bid, i) => ({ t: i + 1, v: Number(bid.amount?.units ?? 0n) })),
    ];
    const t0 = 0;
    const t1 = series.length;
    const v0 = Math.min(...series.map((p) => p.v));
    const v1 = Math.max(...series.map((p) => p.v), v0 + 1);
    const x = (t: number) => PAD + ((t - t0) / (t1 - t0)) * (WIDTH - PAD * 2);
    const y = (v: number) => HEIGHT - PAD - ((v - v0) / (v1 - v0)) * (HEIGHT - PAD * 2);
    // A price holds until the next bid: draw steps, not slopes.
    let line = `M${x(series[0].t)} ${y(series[0].v)}`;
    for (const point of series.slice(1)) line += ` H${x(point.t)} V${y(point.v)}`;
    line += ` H${WIDTH - PAD}`;
    const area = `${line} V${HEIGHT} H${PAD} Z`;
    return { line, area };
  });
}
