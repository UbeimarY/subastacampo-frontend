import { Injectable, inject, signal } from '@angular/core';
import { timestampDate } from '@bufbuild/protobuf/wkt';

import { SYSTEM_CLIENT } from '../api/clients';

/**
 * A single ticking clock for every countdown on screen, aligned with the server.
 *
 * Auctions close by the server's clock. If the phone's clock is a minute off,
 * a naive countdown would lie, so we measure the offset once against
 * SystemService.GetStatus (compensating half the round trip) and apply it.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  private readonly system = inject(SYSTEM_CLIENT);
  private offset = 0;
  private readonly tick = signal(Date.now());

  /** Current server time in milliseconds. Re-reads every second. */
  readonly now = () => this.tick() + this.offset;

  constructor() {
    setInterval(() => this.tick.set(Date.now()), 1000);
    void this.synchronize();
  }

  private async synchronize(): Promise<void> {
    try {
      const sentAt = Date.now();
      const status = await this.system.getStatus({});
      const receivedAt = Date.now();
      if (status.serverTime) {
        const serverNow = timestampDate(status.serverTime).getTime();
        this.offset = serverNow - (sentAt + receivedAt) / 2;
        this.tick.set(Date.now());
      }
    } catch {
      // Offline or server down: fall back to the device clock.
    }
  }
}
