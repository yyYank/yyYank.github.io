import { useState, useEffect } from 'react';

interface DiaryEntry {
  id: string;
  datetime: string;
  weather: string;
  temperature: string;
}

const STORAGE_KEY = 'headache-diary';

function formatDatetime(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = date.getMinutes();
  return `${m}月${d}日${h}時${min.toString().padStart(2, '0')}分`;
}

function weatherCodeToJa(code: number): string {
  if (code === 0) return '晴れ';
  if (code <= 3) return '曇り';
  if (code <= 48) return '霧';
  if (code <= 67) return '雨';
  if (code <= 77) return '雪';
  if (code <= 82) return 'にわか雨';
  return '雷雨';
}

async function fetchWeather(): Promise<{ weather: string; temperature: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ weather: '取得不可', temperature: '取得不可' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`;
          const res = await fetch(url);
          const data = await res.json();
          const temp = data.current.temperature_2m;
          const code = data.current.weather_code;
          resolve({
            weather: weatherCodeToJa(code),
            temperature: `${temp}℃`,
          });
        } catch {
          resolve({ weather: '取得失敗', temperature: '取得失敗' });
        }
      },
      () => {
        resolve({ weather: '位置情報拒否', temperature: '取得不可' });
      },
      { timeout: 5000 }
    );
  });
}

function loadEntries(): DiaryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: DiaryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function toMarkdown(entries: DiaryEntry[]): string {
  if (entries.length === 0) return '記録なし';
  const lines = entries.map(
    (e) => `- 頭痛あり ${e.datetime}、${e.weather} ${e.temperature}`
  );
  return lines.join('\n');
}

export default function HeadacheDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const handleRecord = async () => {
    setLoading(true);
    const now = new Date();
    const { weather, temperature } = await fetchWeather();
    const entry: DiaryEntry = {
      id: now.getTime().toString(),
      datetime: formatDatetime(now),
      weather,
      temperature,
    };
    const updated = [entry, ...entries];
    setEntries(updated);
    saveEntries(updated);
    setLoading(false);
  };

  const handleCopy = async () => {
    const md = toMarkdown(entries);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveEntries(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 flex-wrap">
        <button
          onClick={handleRecord}
          disabled={loading}
          className="px-8 py-4 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold text-xl rounded-xl transition-colors shadow-lg"
        >
          {loading ? '記録中...' : '頭痛い'}
        </button>

        <button
          onClick={handleCopy}
          disabled={entries.length === 0}
          className="px-6 py-4 bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 font-medium rounded-xl transition-colors border border-dark-500"
        >
          {copied ? 'コピーしました！' : 'マークダウンにコピー'}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">記録がありません。「頭痛い」ボタンで記録できます。</p>
      ) : (
        <div className="space-y-2">
          <p className="text-gray-400 text-sm">{entries.length} 件の記録</p>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 group"
              >
                <span className="text-gray-200 text-sm">
                  頭痛あり {entry.datetime}、{entry.weather} {entry.temperature}
                </span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-4 text-xs"
                  title="削除"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
