import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeedReader from '../FeedReader';

// Mock fetch to prevent actual network requests
const fetchMock = vi.fn(() => Promise.reject(new Error('no fetch in test')));
vi.stubGlobal('fetch', fetchMock);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('FeedReader', () => {
  beforeEach(() => {
    localStorageMock.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.reject(new Error('no fetch in test')));
  });

  it('shows loading spinner on initial render', () => {
    render(<FeedReader />);
    expect(screen.getByText('フィードを取得中...')).toBeInTheDocument();
  });

  it('renders tab buttons', () => {
    render(<FeedReader />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('はてブ IT')).toBeInTheDocument();
    expect(screen.getByText('Hacker News')).toBeInTheDocument();
    expect(screen.getByText('日経')).toBeInTheDocument();
  });

  it('renders security feed tabs', () => {
    render(<FeedReader />);
    expect(screen.getByText('CISA')).toBeInTheDocument();
    expect(screen.getByText('Dark Reading')).toBeInTheDocument();
    expect(screen.getByText('BleepingComputer')).toBeInTheDocument();
  });

  // キャッシュに為替データがある場合、USD/JPYとEUR/JPYレートが表示されることを検証する
  it('shows USD/JPY and EUR/JPY exchange rates when cache contains exchange rate data', async () => {
    const cache = {
      data: {
        hatena: [],
        hackernews: [],
        nikkei: [],
        reuters: [],
        toyokeizai: [],
        reddit: [],
        bbc: [],
        weather: [],
        holidays: {},
        exchangeRates: [
          { pair: 'USD/JPY', rate: 149.5, date: '2024-01-15' },
          { pair: 'EUR/JPY', rate: 162.3, date: '2024-01-15' },
        ],
      },
      expiresAt: Date.now() + 1000 * 60 * 60,
    };
    localStorageMock.setItem('feeds-cache', JSON.stringify(cache));

    render(<FeedReader />);

    await waitFor(() => {
      expect(screen.getByText(/USD\/JPY/)).toBeInTheDocument();
      expect(screen.getByText(/149\.50/)).toBeInTheDocument();
      expect(screen.getByText(/EUR\/JPY/)).toBeInTheDocument();
      expect(screen.getByText(/162\.30/)).toBeInTheDocument();
    });
  });

  it('loads snapshot feed data before live fetch succeeds', async () => {
    fetchMock.mockImplementation((input: string | URL | Request) => {
      if (String(input) === '/feeds-data.json') {
        return Promise.resolve(new Response(JSON.stringify({
          generatedAt: '2026-03-18T00:00:00.000Z',
          feeds: {
            hatena: {
              items: [
                {
                  title: 'snapshot item',
                  link: 'https://example.com/snapshot',
                  date: '2026-03-18T00:00:00.000Z',
                  description: 'from snapshot',
                  source: 'hatena',
                },
              ],
              fetchedAt: '2026-03-18T00:00:00.000Z',
              error: null,
            },
            hackernews: { items: [], fetchedAt: null, error: null },
            nikkei: { items: [], fetchedAt: null, error: null },
            reuters: { items: [], fetchedAt: null, error: null },
            toyokeizai: { items: [], fetchedAt: null, error: null },
            reddit: { items: [], fetchedAt: null, error: null },
            bbc: { items: [], fetchedAt: null, error: null },
          },
        }), { status: 200 }));
      }
      return Promise.reject(new Error('live fetch unavailable'));
    });

    render(<FeedReader />);

    await waitFor(() => {
      expect(screen.getByText('snapshot item')).toBeInTheDocument();
    });
  });

  it('keeps showing stale cache while reloading in background', async () => {
    const cache = {
      data: {
        hatena: [
          {
            title: 'cached entry',
            link: 'https://example.com/cached',
            date: '2024-01-15T10:00:00Z',
            description: 'cached description',
            source: 'hatena',
          },
        ],
        hackernews: [],
        nikkei: [],
        reuters: [],
        toyokeizai: [],
        reddit: [],
        bbc: [],
        weather: [],
        holidays: {},
        exchangeRates: [],
      },
      expiresAt: Date.now() - 60_000,
      staleUntil: Date.now() + 60_000,
    };
    localStorageMock.setItem('feeds-cache', JSON.stringify(cache));

    render(<FeedReader />);

    expect(screen.getByText('cached entry')).toBeInTheDocument();
    expect(screen.getByText('直近のキャッシュを表示しています。バックグラウンドで再取得中です。')).toBeInTheDocument();
  });

  it('refreshes weather when cached weather is older than its TTL', async () => {
    const now = Date.now();
    const cache = {
      data: {
        hatena: [],
        hackernews: [],
        nikkei: [],
        reuters: [],
        toyokeizai: [],
        reddit: [],
        bbc: [],
        weather: [
          {
            city: '東京',
            dates: [
              { date: '2026-03-29', weatherCode: 63, tempMax: 10, tempMin: 4, precipProb: 90 },
              { date: '2026-03-30', weatherCode: 63, tempMax: 11, tempMin: 5, precipProb: 90 },
            ],
          },
        ],
        holidays: {},
        exchangeRates: [],
        loaded: {
          hatena: true,
          hackernews: true,
          nikkei: true,
          reuters: true,
          toyokeizai: true,
          reddit: true,
          bbc: true,
          weather: true,
          holidays: true,
          exchangeRates: true,
        },
        loadedAt: {
          weather: now - (2 * 60 * 60 * 1000),
        },
      },
      expiresAt: now + 1000 * 60 * 60,
    };
    localStorageMock.setItem('feeds-cache', JSON.stringify(cache));

    fetchMock.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      if (String(input).startsWith('https://api.open-meteo.com/v1/forecast')) {
        expect(init).toEqual(expect.objectContaining({ cache: 'no-store' }));
        return Promise.resolve(new Response(JSON.stringify({
          daily: {
            time: ['2026-03-29', '2026-03-30'],
            weather_code: [1, 2],
            temperature_2m_max: [20, 21],
            temperature_2m_min: [12, 13],
            precipitation_probability_mean: [10, 20],
          },
        }), { status: 200 }));
      }
      if (String(input) === '/feeds-data.json') {
        return Promise.resolve(new Response(JSON.stringify({
          generatedAt: '2026-03-29T00:00:00.000Z',
          feeds: {
            hatena: { items: [], fetchedAt: null, error: null },
            hackernews: { items: [], fetchedAt: null, error: null },
            nikkei: { items: [], fetchedAt: null, error: null },
            reuters: { items: [], fetchedAt: null, error: null },
            toyokeizai: { items: [], fetchedAt: null, error: null },
            reddit: { items: [], fetchedAt: null, error: null },
            bbc: { items: [], fetchedAt: null, error: null },
          },
        }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    render(<FeedReader />);

    expect(screen.getAllByText('☔ 90%')).toHaveLength(2);

    await waitFor(() => {
      expect(screen.getAllByText('☔ 10%')).toHaveLength(2);
      expect(screen.getAllByText('☔ 20%')).toHaveLength(2);
    });
  });

  it('falls back to the secondary proxy when the first proxy fails', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('primary proxy down'))
      .mockResolvedValueOnce(
        new Response(
          '<?xml version="1.0"?><rss><channel><item><title>fallback item</title><link>https://example.com/fallback</link></item></channel></rss>',
          { status: 200 }
        )
      )
      .mockResolvedValue(new Response('{}', { status: 200 }));

    render(<FeedReader />);

    await waitFor(() => {
      expect(screen.getByText('fallback item')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://corsproxy.io/'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.allorigins.win/raw'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('shows which feed failed without hiding successful items', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('hatena down'))
      .mockResolvedValueOnce(
        new Response(
          '<?xml version="1.0"?><rss><channel><item><title>hn item</title><link>https://example.com/hn</link></item></channel></rss>',
          { status: 200 }
        )
      )
      .mockResolvedValue(new Response('{}', { status: 200 }));

    render(<FeedReader />);

    await waitFor(() => {
      expect(screen.getByText(/取得に失敗したフィード:/)).toBeInTheDocument();
      expect(screen.getByText(/取得に失敗したフィード: .*はてブ IT/)).toBeInTheDocument();
      expect(screen.getByText('hn item')).toBeInTheDocument();
    });
  });
});
