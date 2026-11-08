import { signal, type Signal } from '@angular/core';
import { Code, ConnectError, type Client } from '@connectrpc/connect';

import { AuctionService } from '../../gen/subastacampo/v1/auction_pb';
import { describeError } from '../api/errors';
import { INITIAL_ROOM, applyEvent, reconnectDelay, type RoomState } from './room-state';

export interface AuctionRoom {
  readonly state: Signal<RoomState>;
  readonly error: Signal<string | null>;
  /** Aborts the stream: the server releases the subscription right away. */
  close(): void;
}

/**
 * Follows one auction live over the WatchAuction server stream, reconnecting
 * with exponential backoff when the network drops. The first message after
 * every (re)connection is a full snapshot, so the room never misses state.
 */
export function openAuctionRoom(
  client: Client<typeof AuctionService>,
  auctionId: string,
): AuctionRoom {
  const aborter = new AbortController();
  const state = signal<RoomState>(INITIAL_ROOM);
  const error = signal<string | null>(null);

  async function run(): Promise<void> {
    let attempt = 0;
    while (!aborter.signal.aborted) {
      try {
        for await (const response of client.watchAuction(
          { auctionId },
          { signal: aborter.signal },
        )) {
          attempt = 0;
          error.set(null);
          state.update((current) => applyEvent(current, response));
        }
        // The server ends the stream once the auction is over.
        if (state().connection === 'finished') return;
      } catch (caught) {
        if (aborter.signal.aborted) return;
        const code = ConnectError.from(caught).code;
        if (code === Code.NotFound || code === Code.InvalidArgument) {
          error.set(describeError(caught).message);
          state.update((current) => ({ ...current, connection: 'failed' }));
          return;
        }
        // Network drop, server restart, or ABORTED because we fell behind: reconnect.
      }
      state.update((current) => ({ ...current, connection: 'reconnecting' }));
      await sleep(reconnectDelay(attempt++), aborter.signal);
    }
  }

  void run();
  return { state: state.asReadonly(), error: error.asReadonly(), close: () => aborter.abort() };
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
