import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Timestamp } from '@bufbuild/protobuf/wkt';

import { toMillis } from '../core/format';
import { ClockService } from '../core/time/clock.service';

const URGENT_MS = 2 * 60 * 1000;

/** How much of the auction's time is left, as a bar that empties and turns red at the end. */
@Component({
  selector: 'app-time-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.urgent]': 'urgent()' },
  template: `<span [style.width.%]="left()"></span>`,
  styles: `
    :host {
      display: block;
      height: 6px;
      border-radius: 999px;
      background: rgb(23 36 30 / 0.1);
      overflow: hidden;
    }
    span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--paramo);
      transition: width 1s linear;
    }
    :host(.urgent) span {
      background: var(--barniz);
    }
  `,
})
export class TimeBar {
  private readonly clock = inject(ClockService);
  readonly startsAt = input<Timestamp | undefined>();
  readonly endsAt = input<Timestamp | undefined>();

  private readonly remaining = computed(() =>
    Math.max(0, toMillis(this.endsAt()) - this.clock.now()),
  );
  protected readonly urgent = computed(() => this.remaining() > 0 && this.remaining() <= URGENT_MS);
  protected readonly left = computed(() => {
    const total = toMillis(this.endsAt()) - toMillis(this.startsAt());
    return total > 0 ? Math.min(100, (this.remaining() / total) * 100) : 0;
  });
}
