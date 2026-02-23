import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import FuzzySearchBar from '../FuzzySearchBar';

interface FeedItem {
  title: string;
  link: string;
  date: string;
  description: string;
  source: 'hatena' | 'hackernews' | 'nikkei';
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

interface CacheData {
  data: {
    hatena: FeedItem[];
    hackernews: FeedItem[];
    nikkei: FeedItem[];
    weather: WeatherData;
  };
  expiresAt: number;
}

type TabType = 'all' | 'hatena' | 'hackernews' | 'nikkei';

const CACHE_KEY = 'feeds-cache';

const FEEDS = {
  hatena: 'https://b.hatena.ne.jp/hotentry/it.rss',
  hackernews: 'https://hnrss.org/frontpage',
  nikkei: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf',
} as const;

const CITIES = [
  { name: '東京', latitude: 35.6762, longitude: 139.6503 },
  { name: '大阪', latitude: 34.6937, longitude: 135.5023 },
  { name: '福岡', latitude: 33.5904, longitude: 130.4017 },
] as const;

const TRANSLATION_CACHE_KEY = 'hn-translations';

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

function useTranslation(items: FeedItem[]) {
  const [translations, setTranslations] = useState<Map<string, string>>(() => {
    const cached = loadTranslationCache();
    return new Map(Object.entries(cached));
  });
  const translatorRef = useRef<any>(null);
  const availableRef = useRef<boolean | null>(null);
  const queueRef = useRef<string[]>([]);
  const processingRef = useRef(false);

  // Check availability and create translator once
  useEffect(() => {
    (async () => {
      try {
        const translation = (window as any).translation;
        if (!translation) {
          availableRef.current = false;
          return;
        }
        const result = await translation.canTranslate({
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        });
        if (result === 'no') {
          availableRef.current = false;
          return;
        }
        availableRef.current = true;
        translatorRef.current = await translation.createTranslator({
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        });
      } catch {
        availableRef.current = false;
      }
    })();
  }, []);

  // Process queue sequentially
  useEffect(() => {
    if (processingRef.current) return;
    if (queueRef.current.length === 0) return;
    if (!translatorRef.current) return;

    processingRef.current = true;

    (async () => {
      const translator = translatorRef.current;
      while (queueRef.current.length > 0) {
        const title = queueRef.current.shift()!;
        try {
          const result = await translator.translate(title);
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
  });

  // Enqueue HN titles for translation
  useEffect(() => {
    if (availableRef.current !== true) return;

    const hnTitles = items
      .filter((item) => item.source === 'hackernews')
      .map((item) => item.title)
      .filter((title) => !translations.has(title) && !queueRef.current.includes(title));

    if (hnTitles.length > 0) {
      queueRef.current.push(...hnTitles);
    }
  }, [items, translations]);

  return translations;
}

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

function parseRSS(xml: string, source: 'hatena' | 'hackernews' | 'nikkei'): FeedItem[] {
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
      const res = await fetch(url);
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
    <div className="mb-8">
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

const SPINNER_CHARS = ['|', '/', '-', '\\'];

export default function FeedReader() {
  const [hatena, setHatena] = useState<FeedItem[]>([]);
  const [hackernews, setHackernews] = useState<FeedItem[]>([]);
  const [nikkei, setNikkei] = useState<FeedItem[]>([]);
  const [weather, setWeather] = useState<WeatherData>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const translations = useTranslation(hackernews);

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
      setNikkei(cached.data.nikkei ?? []);
      setWeather(cached.data.weather ?? []);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [hatenaRes, hnRes, nikkeiRes, weatherRes] = await Promise.allSettled([
        fetch(proxyUrl(FEEDS.hatena)).then((r) => {
          if (!r.ok) throw new Error(`Hatena: ${r.status}`);
          return r.text();
        }),
        fetch(proxyUrl(FEEDS.hackernews)).then((r) => {
          if (!r.ok) throw new Error(`HN: ${r.status}`);
          return r.text();
        }),
        fetch(proxyUrl(FEEDS.nikkei)).then((r) => {
          if (!r.ok) throw new Error(`Nikkei: ${r.status}`);
          return r.text();
        }),
        fetchWeather(),
      ]);

      const hatenaItems =
        hatenaRes.status === 'fulfilled' ? parseRSS(hatenaRes.value, 'hatena') : [];
      const hnItems =
        hnRes.status === 'fulfilled' ? parseRSS(hnRes.value, 'hackernews') : [];
      const nikkeiItems =
        nikkeiRes.status === 'fulfilled' ? parseRSS(nikkeiRes.value, 'nikkei') : [];
      const weatherData =
        weatherRes.status === 'fulfilled' ? weatherRes.value : [];

      if (hatenaRes.status === 'rejected' && hnRes.status === 'rejected' && nikkeiRes.status === 'rejected') {
        setError('フィードの取得に失敗しました。しばらくしてからリロードしてください。');
      }

      setHatena(hatenaItems);
      setHackernews(hnItems);
      setNikkei(nikkeiItems);
      setWeather(weatherData);
      saveCache({ hatena: hatenaItems, hackernews: hnItems, nikkei: nikkeiItems, weather: weatherData });
    } catch (e) {
      setError('フィードの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const allItems = useMemo(() => {
    switch (tab) {
      case 'hatena':
        return hatena;
      case 'hackernews':
        return hackernews;
      case 'nikkei':
        return nikkei.slice(0, 5);
      case 'all':
        return [...hatena, ...hackernews, ...nikkei].sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }
  }, [tab, hatena, hackernews, nikkei]);

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

  const totalItemCount = hatena.length + hackernews.length + nikkei.length;

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: hatena.length + hackernews.length + nikkei.length },
    { key: 'hatena', label: 'はてブ IT', count: hatena.length },
    { key: 'hackernews', label: 'Hacker News', count: hackernews.length },
    { key: 'nikkei', label: '日経', count: nikkei.length },
  ];

  const sourceBadge = (source: FeedItem['source']) => {
    switch (source) {
      case 'hatena':
        return { className: 'bg-accent-purple/20 text-accent-purple', label: 'はてブ' };
      case 'hackernews':
        return { className: 'bg-accent-green/20 text-accent-green', label: 'HN' };
      case 'nikkei':
        return { className: 'bg-accent-pink/20 text-accent-pink', label: '日経' };
    }
  };

  return (
    <div>
      {/* Weather */}
      {!loading && <WeatherSection weather={weather} />}

      {/* Search */}
      {!loading && (
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
      )}

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
              <span className="ml-2 text-xs opacity-70">
                {tab === t.key && searchQuery.trim() ? displayItems.length : t.count}
              </span>
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
        {displayItems.map((item, i) => {
          const badge = sourceBadge(item.source);
          return (
            <a
              key={`${item.source}-${i}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-dark-700 border border-dark-600 rounded-lg p-4 hover:border-accent-cyan/40 hover:bg-dark-600 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`shrink-0 mt-1 text-xs px-2 py-0.5 rounded font-medium ${badge.className}`}
                >
                  {badge.label}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-gray-100 font-medium group-hover:text-accent-cyan transition-colors leading-snug">
                    {item.title}
                  </h3>
                  {item.source === 'hackernews' && translations.get(item.title) && (
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
              </div>
            </a>
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
