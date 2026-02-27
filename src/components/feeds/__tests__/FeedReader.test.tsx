import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeedReader from '../FeedReader';

// Mock fetch to prevent actual network requests
vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no fetch in test'))));

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
});
