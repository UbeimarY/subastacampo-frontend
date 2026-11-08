import { create } from '@bufbuild/protobuf';

import {
  AuctionSchema,
  AuctionStatus,
  BidSchema,
  WatchAuctionResponseSchema,
  type Auction,
  type Bid,
} from '../../gen/subastacampo/v1/auction_pb';
import { INITIAL_ROOM, applyEvent, reconnectDelay } from './room-state';

const auction = (bidCount: number, status = AuctionStatus.ACTIVE): Auction =>
  create(AuctionSchema, { id: 'a1', bidCount, status });
const bid = (id: string): Bid => create(BidSchema, { id, auctionId: 'a1' });

const snapshot = (value: Auction, bids: Bid[] = []) =>
  create(WatchAuctionResponseSchema, {
    event: { case: 'snapshot', value: { auction: value, bids } },
  });
const bidPlaced = (placed: Bid, value: Auction) =>
  create(WatchAuctionResponseSchema, {
    event: { case: 'bidPlaced', value: { bid: placed, auction: value } },
  });
const closed = (value: Auction) =>
  create(WatchAuctionResponseSchema, {
    event: { case: 'auctionClosed', value: { auction: value } },
  });

describe('applyEvent', () => {
  it('goes live with the snapshot of an active auction', () => {
    const state = applyEvent(INITIAL_ROOM, snapshot(auction(1), [bid('b1')]));

    expect(state.connection).toBe('live');
    expect(state.bids.map((b) => b.id)).toEqual(['b1']);
  });

  it('marks a finished auction as finished from its snapshot', () => {
    const state = applyEvent(INITIAL_ROOM, snapshot(auction(0, AuctionStatus.CLOSED)));

    expect(state.connection).toBe('finished');
  });

  it('adds new bids on top, newest first', () => {
    let state = applyEvent(INITIAL_ROOM, snapshot(auction(1), [bid('b1')]));
    state = applyEvent(state, bidPlaced(bid('b2'), auction(2)));

    expect(state.bids.map((b) => b.id)).toEqual(['b2', 'b1']);
    expect(state.auction?.bidCount).toBe(2);
  });

  it('ignores a bid it already has (duplicate after reconnecting)', () => {
    let state = applyEvent(INITIAL_ROOM, snapshot(auction(1), [bid('b1')]));
    state = applyEvent(state, bidPlaced(bid('b1'), auction(1)));

    expect(state.bids).toHaveLength(1);
  });

  it('never moves the auction back to an older state', () => {
    let state = applyEvent(INITIAL_ROOM, snapshot(auction(3), [bid('b3')]));
    state = applyEvent(state, bidPlaced(bid('b2'), auction(2)));

    expect(state.auction?.bidCount).toBe(3);
  });

  it('keeps a closed auction closed', () => {
    let state = applyEvent(INITIAL_ROOM, snapshot(auction(1)));
    state = applyEvent(state, closed(auction(1, AuctionStatus.CLOSED)));
    state = applyEvent(state, bidPlaced(bid('late'), auction(2)));

    expect(state.connection).toBe('finished');
    expect(state.auction?.status).toBe(AuctionStatus.CLOSED);
  });
});

describe('reconnectDelay', () => {
  it('doubles with each attempt and stops at 30 seconds', () => {
    const noJitter = () => 1;

    expect(reconnectDelay(0, noJitter)).toBe(1000);
    expect(reconnectDelay(3, noJitter)).toBe(8000);
    expect(reconnectDelay(10, noJitter)).toBe(30_000);
  });

  it('spreads clients with jitter between half and the full delay', () => {
    expect(reconnectDelay(2, () => 0)).toBe(2000);
    expect(reconnectDelay(2, () => 1)).toBe(4000);
  });
});
