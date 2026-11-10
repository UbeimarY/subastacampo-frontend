import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatCop } from '../core/format';
import { formatQuantity } from '../core/labels';
import type { Auction } from '../gen/subastacampo/v1/auction_pb';

/**
 * The market crier ("el pregón") of a plaza de mercado: the live lots passing by,
 * with where they come from and what they are going for. It repeats what the
 * cards below say, so screen readers skip it; reduced motion turns it into a row
 * you can scroll.
 */
@Component({
  selector: 'app-pregon',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pregon" aria-hidden="true">
      <span class="pregon__label">En la plaza</span>
      <div class="pregon__window">
        <div class="pregon__track" [style.animation-duration.s]="duration()">
          @for (copy of [0, 1]; track copy) {
            @for (auction of auctions(); track auction.id) {
              <a class="lot" [routerLink]="['/subastas', auction.id]" tabindex="-1">
                <strong>{{ auction.product?.name }}</strong>
                <span>{{ quantity(auction) }}</span>
                @if (auction.product?.origin) {
                  <span>de {{ auction.product?.origin }}</span>
                }
                <span class="lot__price">{{ formatCop(auction.currentPrice) }}</span>
              </a>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .pregon {
      display: flex;
      align-items: stretch;
      background: #2a1a10;
      color: #f3e6c8;
      font-size: 0.95rem;
    }
    .pregon__label {
      flex: none;
      display: flex;
      align-items: center;
      padding: 0 14px;
      background: var(--barniz);
      color: #fff;
      font-family: var(--font-display);
      font-weight: 700;
    }
    .pregon__window {
      flex: 1;
      overflow: hidden;
      mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
    }
    .pregon__track {
      display: flex;
      width: max-content;
      animation: pregon linear infinite;
    }
    .pregon:hover .pregon__track {
      animation-play-state: paused;
    }
    .lot {
      display: inline-flex;
      align-items: baseline;
      gap: 8px;
      padding: 10px 22px;
      color: inherit;
      text-decoration: none;
      white-space: nowrap;
      border-right: 1px solid rgb(243 230 200 / 0.18);
    }
    .lot strong {
      color: #fff;
    }
    .lot__price {
      color: var(--maize);
      font-family: var(--font-display);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    @keyframes pregon {
      to {
        transform: translateX(-50%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pregon__window {
        overflow-x: auto;
        mask-image: none;
      }
      .pregon__track {
        animation: none;
      }
    }
  `,
})
export class Pregon {
  readonly auctions = input.required<Auction[]>();
  /** About four seconds per lot: slow enough to read. */
  protected readonly duration = computed(() => Math.max(20, this.auctions().length * 4));
  protected readonly formatCop = formatCop;

  protected quantity(auction: Auction): string {
    return formatQuantity(auction.product?.quantity ?? 0, auction.product?.unit ?? 0);
  }
}
