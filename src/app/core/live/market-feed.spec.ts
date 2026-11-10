import type { Client } from '@connectrpc/connect';

import type { CatalogService } from '../../gen/subastacampo/v1/catalog_pb';
import { openMarketFeed } from './market-feed';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('openMarketFeed', () => {
  it('shows each streamed update and reports it is live', async () => {
    let push!: (value: unknown) => void;
    const client = {
      async *watchMarketPrices() {
        yield { categories: [{ sales: 1 }], days: 60 };
        yield await new Promise((resolve) => (push = resolve));
      },
      getMarketPrices: vi.fn(),
    } as unknown as Client<typeof CatalogService>;

    const feed = openMarketFeed(client, 60);
    await flush();
    expect(feed.mode()).toBe('live');
    expect(feed.categories()?.[0].sales).toBe(1);

    push({ categories: [{ sales: 2 }], days: 60 });
    await flush();
    expect(feed.categories()?.[0].sales).toBe(2);
    feed.close();
  });

  it('falls back to asking every interval while the stream is down', async () => {
    vi.useFakeTimers();
    const getMarketPrices = vi.fn().mockResolvedValue({ categories: [{ sales: 3 }], days: 60 });
    const client = {
      // eslint-disable-next-line require-yield
      async *watchMarketPrices() {
        throw new Error('stream blocked');
      },
      getMarketPrices,
    } as unknown as Client<typeof CatalogService>;

    const feed = openMarketFeed(client, 60, 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.mode()).toBe('polling');
    expect(feed.categories()?.[0].sales).toBe(3);

    await vi.advanceTimersByTimeAsync(1000);
    expect(getMarketPrices.mock.calls.length).toBeGreaterThanOrEqual(2);
    feed.close();
    vi.useRealTimers();
  });
});
