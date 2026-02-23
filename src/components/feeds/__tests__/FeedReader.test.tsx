import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
});
