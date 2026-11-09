import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Days of shelf life left, as a short meter: produce loses value as it ages. */
@Component({
  selector: 'app-freshness',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.short]': 'short()' },
  template: `
    <span class="meter" aria-hidden="true"><span [style.width.%]="share()"></span></span>
    <span class="text">{{ text() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: var(--ink-soft);
    }
    .meter {
      width: 44px;
      height: 6px;
      border-radius: 999px;
      background: rgb(23 36 30 / 0.1);
      overflow: hidden;
    }
    .meter span {
      display: block;
      height: 100%;
      background: var(--field-vegetables);
    }
    :host(.short) .meter span {
      background: var(--maize);
    }
    :host(.short) .text {
      color: #7a5a00;
      font-weight: 650;
    }
  `,
})
export class Freshness {
  readonly remaining = input.required<number>();
  readonly total = input.required<number>();

  protected readonly short = computed(() => this.remaining() <= 3);
  protected readonly share = computed(() =>
    this.total() > 0 ? Math.max(4, (this.remaining() / this.total()) * 100) : 0,
  );
  protected readonly text = computed(() => {
    const days = this.remaining();
    if (days <= 0) return 'Vida útil terminada';
    return days === 1 ? 'Fresco por 1 día más' : `Fresco por ${days} días más`;
  });
}
