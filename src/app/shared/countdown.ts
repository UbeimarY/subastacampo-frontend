import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Timestamp } from '@bufbuild/protobuf/wkt';

import { formatRemaining, toMillis } from '../core/format';
import { ClockService } from '../core/time/clock.service';

/** Bids in the last 2 minutes extend the close (the server's anti-sniping rule). */
const EXTENSION_WINDOW_MS = 2 * 60 * 1000;

@Component({
  selector: 'app-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'countdown',
    '[class.countdown--urgent]': 'urgent()',
    '[class.countdown--over]': 'remaining() === 0',
    role: 'timer',
    '[attr.aria-label]': 'label()',
  },
  template: `{{ text() }}`,
})
export class Countdown {
  private readonly clock = inject(ClockService);

  readonly endsAt = input.required<Timestamp | undefined>();

  readonly remaining = computed(() => Math.max(0, toMillis(this.endsAt()) - this.clock.now()));
  readonly urgent = computed(() => this.remaining() > 0 && this.remaining() <= EXTENSION_WINDOW_MS);
  readonly text = computed(() =>
    this.remaining() === 0 ? 'Cerrando' : formatRemaining(this.remaining()),
  );
  readonly label = computed(() =>
    this.remaining() === 0 ? 'La subasta está cerrando' : `Faltan ${this.text()} para el cierre`,
  );
}
