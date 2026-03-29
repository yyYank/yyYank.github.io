import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import FuzzySearchBar from '../FuzzySearchBar';

interface FeedItem {
  title: string;
  link: string;
  date: string;
  description: string;
  source: 'hatena' | 'hackernews' | 'nikkei' | 'reuters' | 'toyokeizai' | 'reddit' | 'bbc';
}

interface CityWeather {
  city: string;
  dates: {
    date: string;
    weatherCode: number;
    tempMax: number;
    tempMin: number;
    precipProb: number;
  }[];
}

type WeatherData = CityWeather[];

interface ExchangeRate {
  pair: string;
  rate: number;
  date: string;
}

interface CacheData {
  data: {
    hatena: FeedItem[];
    hackernews: FeedItem[];
    nikkei: FeedItem[];
    reuters: FeedItem[];
    toyokeizai: FeedItem[];
    reddit: FeedItem[];
    bbc: FeedItem[];
    weather: WeatherData;
    holidays: Record<string, string>;
    exchangeRates: ExchangeRate[];
    loaded?: Partial<Record<LoadKey, boolean>>;
    loadedAt?: Partial<Record<LoadKey, number>>;
  };
  expiresAt: number;
  staleUntil?: number;
}

interface FeedSnapshotEntry {
  items: FeedItem[];
  fetchedAt: string | null;
  error: string | null;
}

interface FeedSnapshotData {
  generatedAt: string;
  feeds: Record<FeedKey, FeedSnapshotEntry>;
}

type TabType = 'all' | 'hatena' | 'hackernews' | 'nikkei' | 'reuters' | 'toyokeizai' | 'reddit' | 'bbc' | 'favorites';
type FeedKey = FeedItem['source'];
type LoadKey = FeedKey | 'weather' | 'holidays' | 'exchangeRates';

const FEED_KEYS: FeedKey[] = ['hatena', 'hackernews', 'nikkei', 'reuters', 'toyokeizai', 'reddit', 'bbc'];
const LOAD_KEYS: LoadKey[] = [...FEED_KEYS, 'weather', 'holidays', 'exchangeRates'];
const FEED_LABELS: Record<FeedKey, string> = {
  hatena: 'はてブ IT',
  hackernews: 'Hacker News',
  nikkei: '日経',
  reuters: 'Reuters',
  toyokeizai: '東洋経済',
  reddit: 'Reddit',
  bbc: 'BBC',
};

function createLoadState(value: boolean): Record<LoadKey, boolean> {
  return {
    hatena: value,
    hackernews: value,
    nikkei: value,
    reuters: value,
    toyokeizai: value,
    reddit: value,
    bbc: value,
    weather: value,
    holidays: value,
    exchangeRates: value,
  };
}

function createErrorState(): Record<LoadKey, string | null> {
  return {
    hatena: null,
    hackernews: null,
    nikkei: null,
    reuters: null,
    toyokeizai: null,
    reddit: null,
    bbc: null,
    weather: null,
    holidays: null,
    exchangeRates: null,
  };
}

function createLoadedAtState(value: number | null): Record<LoadKey, number | null> {
  return {
    hatena: value,
    hackernews: value,
    nikkei: value,
    reuters: value,
    toyokeizai: value,
    reddit: value,
    bbc: value,
    weather: value,
    holidays: value,
    exchangeRates: value,
  };
}

const CACHE_KEY = 'feeds-cache';
const FAVORITES_KEY = 'feeds-favorites';
const CACHE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const WEATHER_CACHE_TTL_MS = 60 * 60 * 1000;
const EXCHANGE_RATE_CACHE_TTL_MS = 60 * 60 * 1000;
const FEED_FETCH_TIMEOUT_MS = 8000;
const FEED_SNAPSHOT_PATH = '/feeds-data.json';

const FEEDS = {
  hatena: 'https://b.hatena.ne.jp/hotentry/it.rss',
  hackernews: 'https://hnrss.org/frontpage',
  nikkei: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf',
  reuters: 'https://assets.wor.jp/rss/rdf/reuters/top.rdf',
  toyokeizai: 'https://toyokeizai.net/list/feed/rss',
  redditProgramming: 'https://www.reddit.com/r/programming/.rss',
  redditTechnology: 'https://www.reddit.com/r/technology/.rss',
  bbc: 'https://feeds.bbci.co.uk/news/rss.xml',
} as const;

const CITIES = [
  { name: '東京', latitude: 35.6762, longitude: 139.6503 },
  { name: '大阪', latitude: 34.6937, longitude: 135.5023 },
] as const;

const TRANSLATION_CACHE_KEY = 'feed-translations';

function loadTranslationCache(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(TRANSLATION_CACHE_KEY);
    if (!raw) return {};
    const cache = JSON.parse(raw);
    if (Date.now() > cache.expiresAt) {
      localStorage.removeItem(TRANSLATION_CACHE_KEY);
      return {};
    }
    return cache.data ?? {};
  } catch {
    localStorage.removeItem(TRANSLATION_CACHE_KEY);
    return {};
  }
}

function saveTranslationCache(data: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      TRANSLATION_CACHE_KEY,
      JSON.stringify({ data, expiresAt: getJSTEndOfDay() })
    );
  } catch {
    // storage full - ignore
  }
}

async function translateViaLingva(text: string): Promise<string> {
  const res = await fetch(`https://lingva.ml/api/v1/en/ja/${encodeURIComponent(text)}`);
  if (!res.ok) throw new Error(`Lingva: ${res.status}`);
  const json = await res.json();
  return json.translation ?? '';
}

function useTranslation(items: FeedItem[]) {
  const [translations, setTranslations] = useState<Map<string, string>>(() => {
    const cached = loadTranslationCache();
    return new Map(Object.entries(cached));
  });
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);
  const [tick, setTick] = useState(0);

  // Enqueue English titles for translation
  useEffect(() => {
    const enTitles = items
      .filter((item) => item.source === 'hackernews' || item.source === 'reddit' || item.source === 'bbc')
      .map((item) => item.title)
      .filter((title) => !translations.has(title) && !queueRef.current.includes(title));

    if (enTitles.length > 0) {
      queueRef.current.push(...enTitles);
      setTick((t) => t + 1);
    }
  }, [items, translations]);

  // Process queue sequentially
  useEffect(() => {
    if (processingRef.current) return;
    if (queueRef.current.length === 0) return;

    processingRef.current = true;

    (async () => {
      while (queueRef.current.length > 0) {
        const title = queueRef.current.shift()!;
        try {
          const result = await translateViaLingva(title);
          setTranslations((prev) => {
            const next = new Map(prev);
            next.set(title, result);
            return next;
          });
        } catch {
          // skip failed translation
        }
      }
      processingRef.current = false;

      // Persist to localStorage
      setTranslations((current) => {
        saveTranslationCache(Object.fromEntries(current));
        return current;
      });
    })();
  }, [tick]);

  return translations;
}

function allOriginsProxyUrl(url: string): string {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

function corsProxyUrl(url: string): string {
  return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
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

function loadCache(): { cache: CacheData | null; isFresh: boolean } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { cache: null, isFresh: false };
    const cache: CacheData = JSON.parse(raw);
    const staleUntil = cache.staleUntil ?? (cache.expiresAt + CACHE_STALE_MS);
    if (Date.now() > staleUntil) {
      localStorage.removeItem(CACHE_KEY);
      return { cache: null, isFresh: false };
    }
    return { cache: { ...cache, staleUntil }, isFresh: Date.now() <= cache.expiresAt };
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return { cache: null, isFresh: false };
  }
}

function saveCache(data: CacheData['data']): void {
  const expiresAt = getJSTEndOfDay();
  const cache: CacheData = { data, expiresAt, staleUntil: expiresAt + CACHE_STALE_MS };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full - ignore
  }
}

function loadFavorites(): FeedItem[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveFavorites(items: FeedItem[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // storage full - ignore
  }
}

function parseRSS(xml: string, source: FeedItem['source']): FeedItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items: FeedItem[] = [];

  // Atom format (Reddit etc.)
  const atomEntries = doc.querySelectorAll('entry');
  if (atomEntries.length > 0) {
    atomEntries.forEach((entry) => {
      const title = entry.querySelector('title')?.textContent?.trim() ?? '';
      const link = entry.querySelector('link[href]')?.getAttribute('href') ?? '';
      const updated = entry.querySelector('updated')?.textContent?.trim() ?? '';
      const content = entry.querySelector('content')?.textContent?.trim() ?? '';

      if (title && link) {
        items.push({
          title,
          link,
          date: updated,
          description: stripHtml(content).slice(0, 200),
          source,
        });
      }
    });
    return items;
  }

  // RSS 2.0 / RDF format
  const rssItems = doc.querySelectorAll('item');

  rssItems.forEach((item) => {
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

async function fetchFeedSnapshot(): Promise<FeedSnapshotData | null> {
  try {
    const res = await fetch(FEED_SNAPSHOT_PATH, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json as FeedSnapshotData;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? '';
}

function decodeHtmlEntities(text: string): string {
  const tmp = document.createElement('textarea');
  tmp.innerHTML = text;
  return tmp.value;
}

function normalizeSnapshotItems(items: FeedItem[]): FeedItem[] {
  return items.map((item) => ({
    ...item,
    title: decodeHtmlEntities(item.title),
    description: decodeHtmlEntities(item.description),
  }));
}

function looksLikeXmlFeed(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) return false;
  return (
    trimmed.includes('<rss') ||
    trimmed.includes('<feed') ||
    trimmed.includes('<rdf:RDF') ||
    trimmed.includes('<channel')
  );
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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

function weatherCodeToEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '🌤️';
  if (code <= 49) return '☁️';
  if (code <= 59) return '🌦️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '🌨️';
  if (code <= 84) return '🌧️';
  if (code <= 94) return '⛈️';
  return '🌪️';
}

function weatherCodeToText(code: number): string {
  if (code === 0) return '快晴';
  if (code <= 3) return '晴れ';
  if (code <= 49) return '曇り';
  if (code <= 59) return '霧雨';
  if (code <= 69) return '雨';
  if (code <= 79) return '雪';
  if (code <= 84) return '大雨';
  if (code <= 94) return '雷雨';
  return '暴風';
}

async function fetchWeather(): Promise<WeatherData> {
  const results: WeatherData = [];

  const responses = await Promise.allSettled(
    CITIES.map(async (city) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia/Tokyo&forecast_days=2`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Weather ${city.name}: ${res.status}`);
      const json = await res.json();
      return { city: city.name, json };
    })
  );

  for (const r of responses) {
    if (r.status === 'fulfilled') {
      const { city, json } = r.value;
      const daily = json.daily;
      const dates = daily.time.map((date: string, i: number) => ({
        date,
        weatherCode: daily.weather_code[i],
        tempMax: daily.temperature_2m_max[i],
        tempMin: daily.temperature_2m_min[i],
        precipProb: daily.precipitation_probability_max[i] ?? 0,
      }));
      results.push({ city, dates });
    }
  }

  return results;
}

function formatWeatherDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  const today = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstToday = new Date(today.getTime() + jstOffset);
  const todayStr = `${jstToday.getUTCFullYear()}-${String(jstToday.getUTCMonth() + 1).padStart(2, '0')}-${String(jstToday.getUTCDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) return '今日';
  return '明日';
}

function WeatherSection({ weather }: { weather: WeatherData }) {
  if (weather.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-medium text-gray-400 mb-3">天気予報</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {weather.map((city) => (
          <div
            key={city.city}
            className="bg-dark-700 border border-dark-600 rounded-lg p-4"
          >
            <h3 className="text-gray-100 font-medium mb-3">{city.city}</h3>
            <div className="space-y-2">
              {city.dates.map((day) => (
                <div key={day.date} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 w-8">{formatWeatherDate(day.date)}</span>
                  <span className="text-lg" title={weatherCodeToText(day.weatherCode)}>
                    {weatherCodeToEmoji(day.weatherCode)}
                  </span>
                  <span className="text-gray-300">
                    <span className="text-red-400">{day.tempMax}°</span>
                    <span className="text-gray-600 mx-1">/</span>
                    <span className="text-blue-400">{day.tempMin}°</span>
                  </span>
                  <span className="text-gray-500 text-xs">
                    ☔ {day.precipProb}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function fetchExchangeRate(from: string, to: string): Promise<ExchangeRate | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    if (!res.ok) return null;
    const json = await res.json();
    return { pair: `${from}/${to}`, rate: json.rates[to], date: json.date };
  } catch {
    return null;
  }
}

function ExchangeRateSection({ exchangeRates }: { exchangeRates: ExchangeRate[] }) {
  if (exchangeRates.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-gray-400 mb-3">為替レート</h2>
      <div className="flex gap-3 flex-wrap">
        {exchangeRates.map((er) => (
          <div key={er.pair} className="bg-dark-700 border border-dark-600 rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">{er.pair}</div>
            <div className="text-2xl font-mono text-gray-100">
              {er.rate.toFixed(2)}<span className="text-sm text-gray-400 ml-1">円</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">{er.date} 更新</div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function fetchHolidays(): Promise<Record<string, string>> {
  const year = new Date().getFullYear();
  try {
    const res = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function DateHeader({ holidays }: { holidays: Record<string, string> }) {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jst = new Date(now.getTime() + jstOffset);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jst.getUTCDate()).padStart(2, '0');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[jst.getUTCDay()];
  const dateKey = `${year}-${month}-${day}`;
  const holiday = holidays[dateKey];

  return (
    <div className="mb-6 font-mono text-sm text-gray-300">
      <span>{year}/{month}/{day}（{weekday}）</span>
      {holiday && <span className="ml-2 text-red-400">{holiday}</span>}
    </div>
  );
}

const SPINNER_CHARS = ['|', '/', '-', '\\'];

export default function FeedReader() {
  const [hatena, setHatena] = useState<FeedItem[]>([]);
  const [hackernews, setHackernews] = useState<FeedItem[]>([]);
  const [nikkei, setNikkei] = useState<FeedItem[]>([]);
  const [reuters, setReuters] = useState<FeedItem[]>([]);
  const [toyokeizai, setToyokeizai] = useState<FeedItem[]>([]);
  const [reddit, setReddit] = useState<FeedItem[]>([]);
  const [bbc, setBbc] = useState<FeedItem[]>([]);
  const [weather, setWeather] = useState<WeatherData>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [favorites, setFavorites] = useState<FeedItem[]>(() => loadFavorites());
  const [loadingMap, setLoadingMap] = useState<Record<LoadKey, boolean>>(() => createLoadState(false));
  const [loadedMap, setLoadedMap] = useState<Record<LoadKey, boolean>>(() => createLoadState(false));
  const [errorMap, setErrorMap] = useState<Record<LoadKey, string | null>>(() => createErrorState());
  const [showingStaleCache, setShowingStaleCache] = useState(false);
  const [tab, setTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const [copyMsg, setCopyMsg] = useState('');
  const loadingRef = useRef<Record<LoadKey, boolean>>(createLoadState(false));
  const loadedRef = useRef<Record<LoadKey, boolean>>(createLoadState(false));
  const loadedAtRef = useRef<Record<LoadKey, number | null>>(createLoadedAtState(null));
  const snapshotAppliedRef = useRef(false);
  const enItems = useMemo(() => [...hackernews, ...reddit, ...bbc], [hackernews, reddit, bbc]);
  const translations = useTranslation(enItems);

  const favoriteLinks = useMemo(() => new Set(favorites.map((f) => f.link)), [favorites]);

  const toggleFavorite = useCallback((item: FeedItem) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.link === item.link);
      const next = exists ? prev.filter((f) => f.link !== item.link) : [...prev, item];
      saveFavorites(next);
      return next;
    });
  }, []);

  const setLoadingKey = useCallback((key: LoadKey, value: boolean) => {
    loadingRef.current[key] = value;
    setLoadingMap((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setLoadedKey = useCallback((key: LoadKey, value: boolean) => {
    loadedRef.current[key] = value;
    setLoadedMap((prev) => ({ ...prev, [key]: value }));
  }, []);

  const markLoadedAt = useCallback((key: LoadKey, value: number) => {
    loadedAtRef.current[key] = value;
  }, []);

  const setErrorKey = useCallback((key: LoadKey, value: string | null) => {
    setErrorMap((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyFeedItems = useCallback((key: FeedKey, items: FeedItem[]) => {
    switch (key) {
      case 'hatena':
        setHatena(items);
        break;
      case 'hackernews':
        setHackernews(items);
        break;
      case 'nikkei':
        setNikkei(items);
        break;
      case 'reuters':
        setReuters(items);
        break;
      case 'toyokeizai':
        setToyokeizai(items);
        break;
      case 'reddit':
        setReddit(items);
        break;
      case 'bbc':
        setBbc(items);
        break;
    }
  }, []);

  const fetchRssText = useCallback(async (url: string, preferAllOrigins = false): Promise<string> => {
    const endpoints = preferAllOrigins
      ? [allOriginsProxyUrl(url), corsProxyUrl(url)]
      : [corsProxyUrl(url), allOriginsProxyUrl(url)];

    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const res = await fetchWithTimeout(endpoint, {}, FEED_FETCH_TIMEOUT_MS);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const text = await res.text();
        if (!looksLikeXmlFeed(text)) throw new Error('Feed response was not XML');
        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn('RSS fetch failed', { url, endpoint, message: lastError.message });
      }
    }

    throw lastError ?? new Error('RSS fetch failed');
  }, []);

  const ensureLoad = useCallback(async <T,>(
    key: LoadKey,
    loader: () => Promise<T>,
    onSuccess: (result: T) => void
  ) => {
    if (loadedRef.current[key] || loadingRef.current[key]) return;
    setLoadingKey(key, true);
    try {
      const result = await loader();
      onSuccess(result);
      setLoadedKey(key, true);
      markLoadedAt(key, Date.now());
      setShowingStaleCache(false);
      setErrorKey(key, null);
    } catch {
      setErrorKey(key, '取得に失敗しました');
    } finally {
      setLoadingKey(key, false);
    }
  }, [markLoadedAt, setErrorKey, setLoadedKey, setLoadingKey]);

  const ensureFeedLoad = useCallback((key: FeedKey) => {
    switch (key) {
      case 'hatena':
        void ensureLoad('hatena', async () => {
          const xml = await fetchRssText(FEEDS.hatena);
          return parseRSS(xml, 'hatena');
        }, (items) => applyFeedItems('hatena', items));
        break;
      case 'hackernews':
        void ensureLoad('hackernews', async () => {
          const xml = await fetchRssText(FEEDS.hackernews);
          return parseRSS(xml, 'hackernews');
        }, (items) => applyFeedItems('hackernews', items));
        break;
      case 'nikkei':
        void ensureLoad('nikkei', async () => {
          const xml = await fetchRssText(FEEDS.nikkei);
          return parseRSS(xml, 'nikkei');
        }, (items) => applyFeedItems('nikkei', items));
        break;
      case 'reuters':
        void ensureLoad('reuters', async () => {
          const xml = await fetchRssText(FEEDS.reuters);
          return parseRSS(xml, 'reuters');
        }, (items) => applyFeedItems('reuters', items));
        break;
      case 'toyokeizai':
        void ensureLoad('toyokeizai', async () => {
          const xml = await fetchRssText(FEEDS.toyokeizai);
          return parseRSS(xml, 'toyokeizai');
        }, (items) => applyFeedItems('toyokeizai', items));
        break;
      case 'reddit':
        void ensureLoad('reddit', async () => {
          const [prog, tech] = await Promise.allSettled([
            fetchRssText(FEEDS.redditProgramming, true),
            fetchRssText(FEEDS.redditTechnology, true),
          ]);
          const progItems = prog.status === 'fulfilled' ? parseRSS(prog.value, 'reddit') : [];
          const techItems = tech.status === 'fulfilled' ? parseRSS(tech.value, 'reddit') : [];
          return [...progItems, ...techItems];
        }, (items) => applyFeedItems('reddit', items));
        break;
      case 'bbc':
        void ensureLoad('bbc', async () => {
          const xml = await fetchRssText(FEEDS.bbc, true);
          return parseRSS(xml, 'bbc');
        }, (items) => applyFeedItems('bbc', items));
        break;
    }
  }, [applyFeedItems, ensureLoad, fetchRssText]);

  const ensureMetaLoad = useCallback(() => {
    void ensureLoad('weather', fetchWeather, setWeather);
    void ensureLoad('holidays', fetchHolidays, setHolidays);
    void ensureLoad('exchangeRates', async () => {
      const [usdJpy, eurJpy] = await Promise.all([
        fetchExchangeRate('USD', 'JPY'),
        fetchExchangeRate('EUR', 'JPY'),
      ]);
      return [usdJpy, eurJpy].filter((r): r is ExchangeRate => r !== null);
    }, setExchangeRates);
  }, [ensureLoad]);

  const ensureTabLoaded = useCallback((target: TabType) => {
    if (target === 'favorites') return;
    if (target === 'all') {
      FEED_KEYS.forEach((key) => ensureFeedLoad(key));
      ensureMetaLoad();
      return;
    }
    ensureFeedLoad(target);
  }, [ensureFeedLoad, ensureMetaLoad]);

  useEffect(() => {
    const { cache: cached, isFresh } = loadCache();
    if (!cached) {
      ensureTabLoaded('all');
      return;
    }

    setHatena(cached.data.hatena ?? []);
    setHackernews(cached.data.hackernews ?? []);
    setNikkei(cached.data.nikkei ?? []);
    setReuters(cached.data.reuters ?? []);
    setToyokeizai(cached.data.toyokeizai ?? []);
    setReddit(cached.data.reddit ?? []);
    setBbc(cached.data.bbc ?? []);
    setWeather(cached.data.weather ?? []);
    setHolidays(cached.data.holidays ?? {});
    setExchangeRates(cached.data.exchangeRates ?? []);

    const cachedLoaded = cached.data.loaded ?? createLoadState(true);
    const cachedLoadedAt = cached.data.loadedAt ?? {};
    const nextLoaded = createLoadState(false);
    const now = Date.now();
    LOAD_KEYS.forEach((key) => {
      const loadedAt = cachedLoadedAt[key] ?? null;
      const ttl =
        key === 'weather' ? WEATHER_CACHE_TTL_MS :
          key === 'exchangeRates' ? EXCHANGE_RATE_CACHE_TTL_MS :
            null;
      const withinKeyTtl = ttl === null || (loadedAt !== null && (now - loadedAt) <= ttl);
      nextLoaded[key] = isFresh ? ((cachedLoaded[key] ?? false) && withinKeyTtl) : false;
    });
    loadedRef.current = nextLoaded;
    loadingRef.current = createLoadState(false);
    loadedAtRef.current = {
      ...createLoadedAtState(null),
      ...cachedLoadedAt,
    };
    setLoadedMap(nextLoaded);
    setLoadingMap(createLoadState(false));
    setErrorMap(createErrorState());
    setShowingStaleCache(!isFresh);
    if (!isFresh) ensureTabLoaded('all');
  }, [ensureTabLoaded]);

  useEffect(() => {
    if (snapshotAppliedRef.current) return;

    void (async () => {
      const snapshot = await fetchFeedSnapshot();
      if (!snapshot) return;

      FEED_KEYS.forEach((key) => {
        const entry = snapshot.feeds[key];
        if (!entry) return;
        const currentItems = (() => {
          switch (key) {
            case 'hatena':
              return hatena;
            case 'hackernews':
              return hackernews;
            case 'nikkei':
              return nikkei;
            case 'reuters':
              return reuters;
            case 'toyokeizai':
              return toyokeizai;
            case 'reddit':
              return reddit;
            case 'bbc':
              return bbc;
          }
        })();

        if (entry.items.length > 0 && currentItems.length === 0) {
          applyFeedItems(key, normalizeSnapshotItems(entry.items));
        }
        if (entry.error && currentItems.length === 0) {
          setErrorKey(key, entry.error);
        }
      });

      snapshotAppliedRef.current = true;
    })();
  }, [applyFeedItems, bbc, hackernews, hatena, nikkei, reddit, reuters, setErrorKey, toyokeizai]);

  useEffect(() => {
    ensureTabLoaded(tab);
  }, [tab, ensureTabLoaded]);

  useEffect(() => {
    const hasLoaded = Object.values(loadedMap).some(Boolean);
    if (!hasLoaded) return;
    saveCache({
      hatena,
      hackernews,
      nikkei,
      reuters,
      toyokeizai,
      reddit,
      bbc,
      weather,
      holidays,
      exchangeRates,
      loaded: loadedMap,
      loadedAt: loadedAtRef.current,
    });
  }, [hatena, hackernews, nikkei, reuters, toyokeizai, reddit, bbc, weather, holidays, exchangeRates, loadedMap]);

  const allItems = useMemo(() => {
    switch (tab) {
      case 'hatena':
        return hatena;
      case 'hackernews':
        return hackernews;
      case 'nikkei':
        return nikkei;
      case 'reuters':
        return reuters;
      case 'toyokeizai':
        return toyokeizai;
      case 'reddit':
        return reddit;
      case 'bbc':
        return bbc;
      case 'favorites':
        return favorites;
      case 'all':
        return [...hatena, ...hackernews, ...nikkei, ...reuters, ...toyokeizai, ...reddit, ...bbc].sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }
  }, [tab, hatena, hackernews, nikkei, reuters, toyokeizai, reddit, bbc, favorites]);

  const feedFuse = useMemo(
    () =>
      new Fuse(allItems, {
        keys: [
          { name: 'title', weight: 0.5 },
          { name: 'description', weight: 0.3 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [allItems]
  );

  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    return feedFuse.search(searchQuery).map((r) => r.item);
  }, [searchQuery, allItems, feedFuse]);

  const totalItemCount = hatena.length + hackernews.length + nikkei.length + reuters.length + toyokeizai.length + reddit.length + bbc.length;

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totalItemCount },
    { key: 'hatena', label: 'はてブ IT', count: hatena.length },
    { key: 'hackernews', label: 'Hacker News', count: hackernews.length },
    { key: 'nikkei', label: '日経', count: nikkei.length },
    { key: 'reuters', label: 'Reuters', count: reuters.length },
    { key: 'toyokeizai', label: '東洋経済', count: toyokeizai.length },
    { key: 'reddit', label: 'Reddit', count: reddit.length },
    { key: 'bbc', label: 'BBC', count: bbc.length },
    { key: 'favorites', label: 'お気に入り', count: favorites.length },
  ];

  const isTabLoaded = useCallback((target: TabType): boolean => {
    if (target === 'favorites') return true;
    if (target === 'all') return FEED_KEYS.every((key) => loadedMap[key]);
    return loadedMap[target];
  }, [loadedMap]);

  const isTabLoading = useCallback((target: TabType): boolean => {
    if (target === 'favorites') return false;
    if (target === 'all') return FEED_KEYS.some((key) => loadingMap[key]);
    return loadingMap[target];
  }, [loadingMap]);

  const activeTabLoading = isTabLoading(tab);
  const activeTabLoaded = isTabLoaded(tab);
  const failedFeedKeys = useMemo(
    () => FEED_KEYS.filter((key) => errorMap[key]),
    [errorMap]
  );
  const activeErrors = useMemo(() => {
    if (tab === 'favorites') return [];
    if (tab === 'all') return failedFeedKeys;
    return errorMap[tab] ? [tab] : [];
  }, [errorMap, failedFeedKeys, tab]);

  useEffect(() => {
    if (!activeTabLoading) return;
    const id = setInterval(() => setSpinnerIdx((i) => (i + 1) % SPINNER_CHARS.length), 100);
    return () => clearInterval(id);
  }, [activeTabLoading]);

  const sourceBadge = (source: FeedItem['source']) => {
    switch (source) {
      case 'hatena':
        return { className: 'bg-accent-purple/20 text-accent-purple', label: 'はてブ' };
      case 'hackernews':
        return { className: 'bg-accent-green/20 text-accent-green', label: 'HN' };
      case 'nikkei':
        return { className: 'bg-accent-pink/20 text-accent-pink', label: '日経' };
      case 'reuters':
        return { className: 'bg-orange-500/20 text-orange-400', label: 'Reuters' };
      case 'toyokeizai':
        return { className: 'bg-blue-500/20 text-blue-400', label: '東洋経済' };
      case 'reddit':
        return { className: 'bg-red-500/20 text-red-400', label: 'Reddit' };
      case 'bbc':
        return { className: 'bg-white/20 text-white', label: 'BBC' };
    }
  };

  return (
    <div>
      {/* Date Header */}
      <DateHeader holidays={holidays} />

      {/* Weather & Exchange Rate */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="flex-1">
          <WeatherSection weather={weather} />
        </div>
        <div className="md:w-auto">
          <ExchangeRateSection exchangeRates={exchangeRates} />
        </div>
      </div>

      {/* Search */}
      <div className="font-mono text-sm">
        <FuzzySearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          resultCount={displayItems.length}
          totalCount={totalItemCount}
          placeholder="fuzzy search feeds..."
          autoFocus={false}
        />
      </div>

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
            <span className="ml-2 text-xs opacity-70">
              {tab === t.key && searchQuery.trim() ? displayItems.length : t.count}
            </span>
            {tab === t.key && isTabLoading(t.key) && !isTabLoaded(t.key) && (
              <span className="ml-2 font-mono text-accent-cyan">
                {SPINNER_CHARS[spinnerIdx]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {activeTabLoading && !activeTabLoaded && displayItems.length === 0 && (
        <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
          <span className="font-mono text-accent-cyan text-lg">
            {SPINNER_CHARS[spinnerIdx]}
          </span>
          <span>フィードを取得中...</span>
        </div>
      )}

      {/* Error */}
      {activeErrors.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 text-red-300">
          {tab === 'all'
            ? `取得に失敗したフィード: ${activeErrors.map((key) => FEED_LABELS[key]).join(', ')}`
            : `${FEED_LABELS[activeErrors[0]]} の取得に失敗しました。`}
        </div>
      )}

      {/* Stale cache notice */}
      {showingStaleCache && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6 text-yellow-200">
          直近のキャッシュを表示しています。バックグラウンドで再取得中です。
        </div>
      )}

      {/* Feed items */}
      {!activeTabLoading && displayItems.length === 0 && (
        <div className="text-gray-500 text-center py-12">
          記事が見つかりませんでした。
        </div>
      )}

      {/* Favorites copy button */}
      {tab === 'favorites' && favorites.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => {
              const md = favorites.map((f) => `- [${f.title}](${f.link})`).join('\n');
              navigator.clipboard.writeText(md).then(() => {
                setCopyMsg('コピーしました');
                setTimeout(() => setCopyMsg(''), 2000);
              });
            }}
            className="bg-dark-700 border border-dark-600 rounded px-3 py-1.5 text-xs text-gray-300 hover:text-gray-100 hover:border-dark-500 transition-colors"
          >
            Markdown一括コピー
          </button>
          {copyMsg && <span className="text-xs text-accent-cyan">{copyMsg}</span>}
        </div>
      )}

      <div className="space-y-3">
        {displayItems.map((item, i) => {
          const badge = sourceBadge(item.source);
          const isFav = favoriteLinks.has(item.link);
          return (
            <div
              key={`${item.source}-${i}`}
              className="bg-dark-700 border border-dark-600 rounded-lg p-4 hover:border-accent-cyan/40 hover:bg-dark-600 transition-all group flex items-start gap-3"
            >
              <button
                onClick={() => toggleFavorite(item)}
                className="shrink-0 mt-0.5 text-lg leading-none transition-colors hover:scale-110"
                title={isFav ? 'お気に入り解除' : 'お気に入りに追加'}
              >
                {isFav ? <span className="text-yellow-400">★</span> : <span className="text-gray-600">☆</span>}
              </button>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 flex items-start gap-3"
              >
                <span
                  className={`shrink-0 mt-1 text-xs px-2 py-0.5 rounded font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-gray-100 font-medium group-hover:text-accent-cyan transition-colors leading-snug">
                    {item.title}
                  </h3>
                  {(item.source === 'hackernews' || item.source === 'reddit' || item.source === 'bbc') && translations.get(item.title) && (
                    <p className="text-gray-400 text-sm mt-0.5">
                      {translations.get(item.title)}
                    </p>
                  )}
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
              </a>
            </div>
          );
        })}
      </div>

      {/* Cache reset */}
      <CacheReset />
    </div>
  );
}

function CacheReset() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');

  const handleReset = () => {
    if (pw !== 'io_hub_git_yank_yy') {
      setMsg('パスワードが違います');
      return;
    }
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(TRANSLATION_CACHE_KEY);
    setMsg('キャッシュをクリアしました。リロードしてください。');
    setPw('');
  };

  return (
    <div className="mt-12 text-center">
      <button
        onClick={() => setOpen(!open)}
        className="text-gray-700 text-xs hover:text-gray-500 transition-colors"
      >
        cache reset
      </button>
      {open && (
        <div className="mt-2 inline-flex items-center gap-2">
          <input
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setMsg(''); }}
            placeholder="password"
            className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-gray-300 w-40"
          />
          <button
            onClick={handleReset}
            className="bg-red-900/30 border border-red-500/30 rounded px-3 py-1 text-xs text-red-400 hover:bg-red-900/50 transition-colors"
          >
            reset
          </button>
        </div>
      )}
      {msg && <p className="text-xs mt-1 text-gray-400">{msg}</p>}
    </div>
  );
}
