import {
  AuctionStatus,
  type Auction,
  type Bid,
  type WatchAuctionResponse,
} from '../../gen/subastacampo/v1/auction_pb';

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'finished' | 'failed';

export interface RoomState {
  auction: Auction | null;
  /** Newest first, without duplicates. */
  bids: Bid[];
  connection: ConnectionState;
}

export const INITIAL_ROOM: RoomState = { auction: null, bids: [], connection: 'connecting' };

/**
 * Applies one live event to the room. Pure: easy to test and to reason about.
 *
 * The server subscribes us BEFORE reading the snapshot, so the first events
 * after a (re)connection may repeat bids already in the snapshot. Two rules
 * make that harmless:
 *  1. Bids are deduplicated by id.
 *  2. The auction only moves forward: an event carrying an older state
 *     (fewer bids) never overwrites a newer one, and a closed auction stays closed.
 */
export function applyEvent(state: RoomState, response: WatchAuctionResponse): RoomState {
  const event = response.event;
  switch (event.case) {
    case 'snapshot':
      return {
        auction: event.value.auction ?? state.auction,
        bids: event.value.bids,
        connection: isOpen(event.value.auction) ? 'live' : 'finished',
      };
    case 'bidPlaced': {
      const bid = event.value.bid;
      const bids =
        !bid || state.bids.some((known) => known.id === bid.id) ? state.bids : [bid, ...state.bids];
      return { ...state, auction: newest(state.auction, event.value.auction), bids };
    }
    case 'auctionClosed':
      return { ...state, auction: event.value.auction ?? state.auction, connection: 'finished' };
    default:
      return state;
  }
}

function isOpen(auction: Auction | undefined): boolean {
  return auction?.status === AuctionStatus.ACTIVE;
}

function newest(current: Auction | null, incoming: Auction | undefined): Auction | null {
  if (!incoming) return current;
  if (!current) return incoming;
  if (current.status !== AuctionStatus.ACTIVE) return current;
  return incoming.bidCount >= current.bidCount ? incoming : current;
}

/**
 * Exponential backoff with jitter: 1 s, 2 s, 4 s ... up to 30 s.
 * The jitter spreads reconnections so a server restart is not hit by
 * every client in the same instant.
 */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** attempt);
  return Math.round(base * (0.5 + random() / 2));
}
