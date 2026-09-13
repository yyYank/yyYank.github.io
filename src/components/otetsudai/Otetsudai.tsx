import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'otetsudai-records';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

interface OtetsudaiRecord {
  id: string;
  date: string;
  content: string;
  createdAt: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadRecords(): OtetsudaiRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records: OtetsudaiRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // storage full or unavailable
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekday = WEEKDAYS[d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekday}）`;
}

function YokuDekimashitaStamp() {
  return (
    <svg viewBox="0 0 80 80" width="40" height="40" className="inline-block">
      <circle cx="40" cy="40" r="36" fill="none" stroke="#e74c3c" strokeWidth="4" />
      <circle cx="40" cy="40" r="30" fill="none" stroke="#e74c3c" strokeWidth="1.5" />
      <text
        x="40"
        y="34"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e74c3c"
        fontSize="11"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        よくできました
      </text>
      <text
        x="40"
        y="52"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e74c3c"
        fontSize="20"
      >
        💮
      </text>
    </svg>
  );
}

function YokuDekimashitaStampLarge() {
  return (
    <svg viewBox="0 0 120 120" width="120" height="120" className="mx-auto">
      <circle cx="60" cy="60" r="54" fill="none" stroke="#e74c3c" strokeWidth="5" opacity="0.9" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="#e74c3c" strokeWidth="2" opacity="0.7" />
      <text
        x="60"
        y="48"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e74c3c"
        fontSize="14"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        よくできました
      </text>
      <text
        x="60"
        y="76"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e74c3c"
        fontSize="32"
      >
        💮
      </text>
    </svg>
  );
}

interface ModalProps {
  date: string;
  records: OtetsudaiRecord[];
  onAdd: (content: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function Modal({ date, records, onAdd, onDelete, onClose }: ModalProps) {
  const [content, setContent] = useState('');
  const [showForm, setShowForm] = useState(records.length === 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setContent('');
    setShowForm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-dark-800 border border-dark-500 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">{formatDate(date)}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {records.length > 0 && (
            <div className="mb-4 space-y-3">
              <YokuDekimashitaStampLarge />
              {records.map((r) => (
                <div
                  key={r.id}
                  className="bg-dark-700 rounded-lg p-3 border border-dark-600 flex items-start justify-between gap-2"
                >
                  <span className="text-gray-200 text-sm">{r.content}</span>
                  <button
                    onClick={() => onDelete(r.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-xs shrink-0"
                    title="削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="おてつだいの内容を書いてね"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg p-3 text-gray-100 placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-accent-cyan transition-colors"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!content.trim()}
                  className="flex-1 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  きろくする
                </button>
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    やめる
                  </button>
                )}
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-sm text-gray-300 hover:text-accent-cyan hover:border-accent-cyan/30 transition-colors"
            >
              + おてつだいを追加
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Otetsudai() {
  const [records, setRecords] = useState<OtetsudaiRecord[]>([]);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setRecords(loadRecords());
  }, []);

  const recordsByDate = useCallback(
    (date: string) => records.filter((r) => r.date === date),
    [records],
  );

  const handleAdd = (content: string) => {
    if (!selectedDate) return;
    const newRecord: OtetsudaiRecord = {
      id: generateId(),
      date: selectedDate,
      content,
      createdAt: new Date().toISOString(),
    };
    const updated = [...records, newRecord];
    setRecords(updated);
    saveRecords(updated);
  };

  const handleDelete = (id: string) => {
    const updated = records.filter((r) => r.id !== id);
    setRecords(updated);
    saveRecords(updated);
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const firstDay = new Date(currentYear, currentMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6 text-center">おてつだいきろく</h1>

      <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600">
          <button
            onClick={prevMonth}
            className="text-gray-400 hover:text-accent-cyan transition-colors px-2 py-1 text-lg"
          >
            ◀
          </button>
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-lg">
              {currentYear}年{currentMonth + 1}月
            </span>
            <button
              onClick={goToday}
              className="text-xs text-gray-400 hover:text-accent-cyan border border-dark-500 hover:border-accent-cyan/30 rounded px-2 py-0.5 transition-colors"
            >
              今日
            </button>
          </div>
          <button
            onClick={nextMonth}
            className="text-gray-400 hover:text-accent-cyan transition-colors px-2 py-1 text-lg"
          >
            ▶
          </button>
        </div>

        <div className="grid grid-cols-7">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-2 border-b border-dark-600 ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {day}
            </div>
          ))}

          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="border-b border-r border-dark-700/50 min-h-[72px]" />;
            }

            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayRecords = recordsByDate(dateStr);
            const hasRecords = dayRecords.length > 0;
            const isToday = dateStr === todayStr;
            const dow = (startDow + day - 1) % 7;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`border-b border-r border-dark-700/50 min-h-[72px] p-1 text-left hover:bg-dark-600/50 transition-colors flex flex-col items-center gap-0.5 ${
                  hasRecords ? 'bg-dark-700/30' : ''
                }`}
              >
                <span
                  className={`text-xs leading-none ${
                    isToday
                      ? 'bg-accent-cyan text-dark-900 rounded-full w-5 h-5 flex items-center justify-center font-bold'
                      : dow === 0
                        ? 'text-red-400'
                        : dow === 6
                          ? 'text-blue-400'
                          : 'text-gray-300'
                  }`}
                >
                  {day}
                </span>
                {hasRecords && <YokuDekimashitaStamp />}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <Modal
          date={selectedDate}
          records={recordsByDate(selectedDate)}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
