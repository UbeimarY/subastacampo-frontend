import { signal, type Signal } from '@angular/core';
import type { Client } from '@connectrpc/connect';
import { timestampDate } from '@bufbuild/protobuf/wkt';

import type { CatalogService, CategoryMarket } from '../../gen/subastacampo/v1/catalog_pb';
import { describeError } from '../api/errors';
import { reconnectDelay } from './room-state';

/** How often prices are fetched while the live stream is down. */
export const POLL_INTERVAL_MS = 60_000;

export type FeedMode = 'connecting' | 'live' | 'polling';

export interface MarketFeed {
  readonly categories: Signal<CategoryMarket[] | null>;
  readonly mode: Signal<FeedMode>;
  readonly updatedAt: Signal<Date | null>;
  readonly error: Signal<string | null>;
  close(): void;
}

/**
 * Market prices that stay current two ways at once:
 *  - a server stream that pushes new prices the moment an auction closes;
 *  - while that stream is down (a proxy that buffers, a flaky network), a plain
 *    request every minute, until the stream reconnects.
 */
export function openMarketFeed(
  client: Client<typeof CatalogService>,
  days: number,
  pollIntervalMs = POLL_INTERVAL_MS,
): MarketFeed {
  const aborter = new AbortController();
  const categories = signal<CategoryMarket[] | null>(null);
  const mode = signal<FeedMode>('connecting');
  const updatedAt = signal<Date | null>(null);
  const error = signal<string | null>(null);
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  async function poll(): Promise<void> {
    try {
      const response = await client.getMarketPrices({ days }, { signal: aborter.signal });
      categories.set(response.categories);
      updatedAt.set(new Date());
      error.set(null);
    } catch (caught) {
      if (!aborter.signal.aborted && categories() === null)
        error.set(describeError(caught).message);
    }
  }

  function startPolling(): void {
    if (pollTimer !== undefined) return;
    mode.set('polling');
    void poll();
    pollTimer = setInterval(() => void poll(), pollIntervalMs);
  }

  function stopPolling(): void {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }

  async function stream(): Promise<void> {
    let attempt = 0;
    while (!aborter.signal.aborted) {
      try {
        for await (const message of client.watchMarketPrices(
          { days },
          { signal: aborter.signal },
        )) {
          attempt = 0;
          stopPolling();
          mode.set('live');
          error.set(null);
          categories.set(message.categories);
          updatedAt.set(message.updatedAt ? timestampDate(message.updatedAt) : new Date());
        }
      } catch {
        if (aborter.signal.aborted) return;
      }
      // Stream ended or failed: keep prices fresh by polling while it comes back.
      startPolling();
      await sleep(reconnectDelay(attempt++), aborter.signal);
    }
  }

  void stream();
  return {
    categories: categories.asReadonly(),
    mode: mode.asReadonly(),
    updatedAt: updatedAt.asReadonly(),
    error: error.asReadonly(),
    close: () => {
      aborter.abort();
      stopPolling();
    },
  };
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
