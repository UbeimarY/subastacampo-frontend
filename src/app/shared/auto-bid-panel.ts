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

import { AUCTION_CLIENT } from '../core/api/clients';
import { describeError } from '../core/api/errors';
import { formatCop, parsePesos } from '../core/format';
import type { Auction, AutoBid } from '../gen/subastacampo/v1/auction_pb';

/**
 * "Puja automática": the buyer sets the most they will pay and the server bids
 * for them, only what it takes to lead. Nobody else ever sees the maximum.
 */
@Component({
  selector: 'app-auto-bid-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel auto" aria-labelledby="auto-title">
      <div class="auto__head">
        <h2 id="auto-title">Puja automática</h2>
        @if (current(); as mine) {
          <span class="state" [class.state--spent]="mine.exhausted">
            {{ mine.exhausted ? 'Superada' : 'Activa' }}
          </span>
        }
      </div>

      @if (current(); as mine) {
        @if (mine.exhausted) {
          <p>
            Otros postores pasaron tu máximo de <strong>{{ formatCop(mine.maxAmount) }}</strong
            >. Súbelo si quieres seguir.
          </p>
        } @else {
          <p>
            Pujamos por ti hasta <strong>{{ formatCop(mine.maxAmount) }}</strong
            >, solo lo necesario para ir ganando.
          </p>
        }
      } @else {
        <p>
          Dinos lo máximo que pagarías. Pujamos por ti solo lo necesario para ir ganando, aunque no
          estés mirando. Nadie más ve tu máximo.
        </p>
      }

      @if (editing() || !current()) {
        <form class="auto__form" (submit)="$event.preventDefault(); save()">
          <div class="quick" role="group" aria-label="Máximos sugeridos">
            @for (value of suggestions(); track value) {
              <button
                type="button"
                class="quick__option"
                [attr.aria-pressed]="maximum() === value.toString()"
                (click)="maximum.set(value.toString())"
              >
                {{ formatCop(value) }}
              </button>
            }
          </div>
          <div class="field">
            <label for="auto-max">Mi máximo (pesos)</label>
            <input
              id="auto-max"
              inputmode="numeric"
              autocomplete="off"
              [value]="maximum()"
              (input)="maximum.set($any($event.target).value)"
            />
          </div>
          @if (error()) {
            <p class="alert" role="alert">{{ error() }}</p>
          }
          <div class="auto__actions">
            @if (current()) {
              <button type="button" class="button button--quiet" (click)="editing.set(false)">
                Cancelar
              </button>
            }
            <button class="button" type="submit" [disabled]="busy()">
              {{
                busy() ? 'Guardando…' : current() ? 'Cambiar máximo' : 'Activar hasta ' + label()
              }}
            </button>
          </div>
        </form>
      } @else {
        <div class="auto__actions">
          <button type="button" class="button button--quiet" (click)="stop()" [disabled]="busy()">
            Desactivar
          </button>
          <button type="button" class="button" (click)="startEditing()">Cambiar máximo</button>
        </div>
        @if (error()) {
          <p class="alert" role="alert">{{ error() }}</p>
        }
      }
    </section>
  `,
  styles: `
    .auto {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .auto p {
      margin: 0;
    }
    .auto__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .auto__head h2 {
      margin: 0;
    }
    .state {
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      background: var(--paramo-wash);
      color: var(--paramo-deep);
      font-weight: 700;
      font-size: 0.85rem;
    }
    .state--spent {
      background: var(--barniz-wash);
      color: var(--danger);
    }
    .auto__form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .quick {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .quick__option {
      font: inherit;
      font-family: var(--font-display);
      font-weight: 650;
      font-variant-numeric: tabular-nums;
      min-height: 44px;
      border-radius: var(--radius-s);
      border: 1.5px solid var(--line);
      background: var(--surface);
      cursor: pointer;
    }
    .quick__option:hover {
      border-color: var(--paramo);
    }
    .quick__option[aria-pressed='true'] {
      border-color: var(--paramo);
      background: var(--paramo-wash);
      box-shadow: inset 0 0 0 1px var(--paramo);
    }
    .auto__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class AutoBidPanel {
  private readonly auctions = inject(AUCTION_CLIENT);

  readonly auction = input.required<Auction>();

  protected readonly current = signal<AutoBid | null>(null);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly maximum = signal('');
  protected readonly formatCop = formatCop;

  protected readonly suggestions = computed(() => {
    const auction = this.auction();
    const minimum = auction.nextMinBid?.units ?? 0n;
    const step = auction.minIncrement?.units ?? 0n;
    return minimum > 0n ? [minimum + step * 3n, minimum + step * 6n, minimum + step * 10n] : [];
  });
  protected readonly label = computed(() => {
    const value = parsePesos(this.maximum());
    return value === null ? '' : formatCop(value);
  });

  constructor() {
    // Refresh the state whenever the auction moves: a rival may have passed the maximum.
    effect(() => {
      const auction = this.auction();
      void auction.bidCount;
      untracked(() => void this.load(auction.id));
    });
    // Start from a sensible maximum the first time.
    effect(() => {
      const [first] = this.suggestions();
      if (first && untracked(() => this.maximum()) === '') this.maximum.set(first.toString());
    });
  }

  protected startEditing(): void {
    const mine = this.current();
    const [first] = this.suggestions();
    const base = mine && !mine.exhausted ? mine.maxAmount?.units : first;
    this.maximum.set((base ?? 0n).toString());
    this.error.set(null);
    this.editing.set(true);
  }

  protected async save(): Promise<void> {
    const value = parsePesos(this.maximum());
    if (value === null || value <= 0n) {
      this.error.set('Escribe un monto en pesos.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await this.auctions.setAutoBid({
        auctionId: this.auction().id,
        maxAmount: { currencyCode: 'COP', units: value },
      });
      this.current.set(response.autoBid ?? null);
      this.editing.set(false);
    } catch (caught) {
      const problem = describeError(caught);
      this.error.set(
        problem.minimumBid
          ? `Tu máximo debe ser de al menos ${formatCop(problem.minimumBid)}.`
          : problem.message,
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async stop(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auctions.cancelAutoBid({ auctionId: this.auction().id });
      this.current.set(null);
    } catch (caught) {
      this.error.set(describeError(caught).message);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(auctionId: string): Promise<void> {
    try {
      const response = await this.auctions.getAutoBid({ auctionId });
      this.current.set(response.autoBid ?? null);
    } catch {
      // Not critical: the panel keeps its last known state.
    }
  }
}
