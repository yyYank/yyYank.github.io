import { useState, useEffect, useCallback } from 'react';

interface FeedItem {
  title: string;
  link: string;
  date: string;
  description: string;
  source: 'hatena' | 'hackernews';
}

interface CacheData {
  data: { hatena: FeedItem[]; hackernews: FeedItem[] };
  expiresAt: number;
}

type TabType = 'all' | 'hatena' | 'hackernews';

const CACHE_KEY = 'feeds-cache';

const FEEDS = {
  hatena: 'https://b.hatena.ne.jp/hotentry/it.rss',
  hackernews: 'https://hnrss.org/frontpage',
} as const;

function proxyUrl(url: string): string {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

function getJSTEndOfDay(): number {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstEndOfDay = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate(), 23, 59, 59, 999)
  );
  return jstEndOfDay.getTime() - jstOffset;
}

function loadCache(): CacheData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: CacheData = JSON.parse(raw);
    if (Date.now() > cache.expiresAt) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cache;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function saveCache(data: CacheData['data']): void {
  const cache: CacheData = { data, expiresAt: getJSTEndOfDay() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full - ignore
  }
}

function parseRSS(xml: string, source: 'hatena' | 'hackernews'): FeedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items: FeedItem[] = [];

  // RSS 2.0 format
  const rssItems = doc.querySelectorAll('item');
  // RDF format (hatena uses rdf:RDF > item)
  const rdfItems = doc.querySelectorAll('item');

  const allItems = rssItems.length > 0 ? rssItems : rdfItems;

  allItems.forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim() ?? '';
    const link = item.querySelector('link')?.textContent?.trim() ?? '';
    const pubDate =
      item.querySelector('pubDate')?.textContent?.trim() ??
      item.querySelector('date')?.textContent?.trim() ??
      // dc:date (RDF format)
      item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'date')[0]?.textContent?.trim() ??
      '';
    const description =
      item.querySelector('description')?.textContent?.trim() ?? '';

    if (title && link) {
      items.push({
        title,
        link,
        date: pubDate,
        description: stripHtml(description).slice(0, 200),
        source,
      });
    }
  });

  return items;
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? '';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const SPINNER_CHARS = ['|', '/', '-', '\\'];

export default function FeedReader() {
  const [hatena, setHatena] = useState<FeedItem[]>([]);
  const [hackernews, setHackernews] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>('all');
  const [spinnerIdx, setSpinnerIdx] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setSpinnerIdx((i) => (i + 1) % SPINNER_CHARS.length), 100);
    return () => clearInterval(id);
  }, [loading]);

  const fetchFeeds = useCallback(async () => {
    const cached = loadCache();
    if (cached) {
      setHatena(cached.data.hatena);
      setHackernews(cached.data.hackernews);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [hatenaRes, hnRes] = await Promise.allSettled([
        fetch(proxyUrl(FEEDS.hatena)).then((r) => {
          if (!r.ok) throw new Error(`Hatena: ${r.status}`);
          return r.text();
        }),
        fetch(proxyUrl(FEEDS.hackernews)).then((r) => {
          if (!r.ok) throw new Error(`HN: ${r.status}`);
          return r.text();
        }),
      ]);

      const hatenaItems =
        hatenaRes.status === 'fulfilled' ? parseRSS(hatenaRes.value, 'hatena') : [];
      const hnItems =
        hnRes.status === 'fulfilled' ? parseRSS(hnRes.value, 'hackernews') : [];

      if (hatenaRes.status === 'rejected' && hnRes.status === 'rejected') {
        setError('フィードの取得に失敗しました。しばらくしてからリロードしてください。');
      }

      setHatena(hatenaItems);
      setHackernews(hnItems);
      saveCache({ hatena: hatenaItems, hackernews: hnItems });
    } catch (e) {
      setError('フィードの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const displayItems = (() => {
    switch (tab) {
      case 'hatena':
        return hatena;
      case 'hackernews':
        return hackernews;
      case 'all':
        return [...hatena, ...hackernews].sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }
  })();

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: hatena.length + hackernews.length },
    { key: 'hatena', label: 'はてブ IT', count: hatena.length },
    { key: 'hackernews', label: 'Hacker News', count: hackernews.length },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40'
                : 'bg-dark-700 text-gray-400 border border-dark-600 hover:text-gray-200 hover:border-dark-500'
            }`}
          >
            {t.label}
            {!loading && (
              <span className="ml-2 text-xs opacity-70">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
          <span className="font-mono text-accent-cyan text-lg">
            {SPINNER_CHARS[spinnerIdx]}
          </span>
          <span>フィードを取得中...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      {/* Feed items */}
      {!loading && !error && displayItems.length === 0 && (
        <div className="text-gray-500 text-center py-12">
          記事が見つかりませんでした。
        </div>
      )}

      <div className="space-y-3">
        {displayItems.map((item, i) => (
          <a
            key={`${item.source}-${i}`}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-dark-700 border border-dark-600 rounded-lg p-4 hover:border-accent-cyan/40 hover:bg-dark-600 transition-all group"
          >
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 mt-1 text-xs px-2 py-0.5 rounded font-medium ${
                  item.source === 'hatena'
                    ? 'bg-accent-purple/20 text-accent-purple'
                    : 'bg-accent-green/20 text-accent-green'
                }`}
              >
                {item.source === 'hatena' ? 'はてブ' : 'HN'}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-gray-100 font-medium group-hover:text-accent-cyan transition-colors leading-snug">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
                {item.date && (
                  <time className="text-gray-600 text-xs mt-2 block">
                    {formatDate(item.date)}
                  </time>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
