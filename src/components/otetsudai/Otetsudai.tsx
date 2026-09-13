import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'otetsudai-data';
const WEEKDAYS = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'] as const;

const STAMPS = [
  '💮', '🌸', '🌈', '❤️', '⭐', '🌻', '🎀', '🦋', '🍀', '🌷',
  '🌟', '🎵', '🐱', '🐶', '🍓', '🍎', '🌙', '☀️', '🐣', '🐰',
] as const;

function randomStamp(): string {
  return STAMPS[Math.floor(Math.random() * STAMPS.length)];
}

interface Person {
  id: string;
  name: string;
  goal?: number;
  goalReason?: string;
}

interface OtetsudaiRecord {
  id: string;
  personId: string;
  date: string;
  content: string;
  stamp: string;
  createdAt: string;
}

interface OtetsudaiData {
  people: Person[];
  records: OtetsudaiRecord[];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadData(): OtetsudaiData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { people: [], records: [] };
    const parsed = JSON.parse(raw);
    return {
      people: Array.isArray(parsed.people) ? parsed.people : [],
      records: Array.isArray(parsed.records)
        ? parsed.records.map((r: OtetsudaiRecord) => ({ ...r, stamp: r.stamp || '💮' }))
        : [],
    };
  } catch {
    return { people: [], records: [] };
  }
}

function saveData(data: OtetsudaiData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekday = WEEKDAYS[d.getDay()];
  return `${d.getMonth() + 1}がつ ${d.getDate()}にち（${weekday}）`;
}

interface StampPickerProps {
  selected: string;
  onSelect: (stamp: string) => void;
}

function StampPicker({ selected, onSelect }: StampPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-6xl hover:scale-110 transition-transform"
        title="しーるをえらぶ"
      >
        {selected}
      </button>
      <p className="text-gray-400 text-xs">タップして えらべるよ</p>
      {open && (
        <div className="grid grid-cols-5 gap-2 bg-dark-700 rounded-xl p-3 border border-dark-600">
          {STAMPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
              className={`text-3xl p-1 rounded-lg hover:bg-dark-500 transition-colors ${
                selected === s ? 'bg-dark-500 ring-2 ring-accent-cyan' : ''
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ModalProps {
  date: string;
  records: OtetsudaiRecord[];
  onAdd: (content: string, stamp: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function Modal({ date, records, onAdd, onDelete, onClose }: ModalProps) {
  const [content, setContent] = useState('');
  const [stamp, setStamp] = useState(() => randomStamp());
  const [showForm, setShowForm] = useState(records.length === 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onAdd(trimmed, stamp);
    setContent('');
    setStamp(randomStamp());
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
            <h2 className="text-xl font-bold text-white">{formatDate(date)}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          {records.length > 0 && (
            <div className="mb-5 space-y-3">
              <p className="text-center text-lg font-bold text-yellow-300">よくできました！</p>
              {records.map((r) => (
                <div
                  key={r.id}
                  className="bg-dark-700 rounded-xl p-4 border border-dark-600 flex items-start gap-3"
                >
                  <span className="text-3xl shrink-0">{r.stamp}</span>
                  <span className="text-gray-200 text-base flex-1">{r.content}</span>
                  <button
                    onClick={() => onDelete(r.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-sm shrink-0"
                    title="けす"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <StampPicker selected={stamp} onSelect={setStamp} />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="なにをおてつだいしたかな？"
                className="w-full bg-dark-700 border border-dark-500 rounded-xl p-4 text-gray-100 placeholder-gray-500 text-base resize-none focus:outline-none focus:border-accent-cyan transition-colors"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!content.trim()}
                  className="flex-1 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-xl px-4 py-3 text-base font-bold hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  きろくする
                </button>
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-3 text-base text-gray-400 hover:text-white transition-colors"
                  >
                    やめる
                  </button>
                )}
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-base text-gray-300 hover:text-accent-cyan hover:border-accent-cyan/30 transition-colors"
            >
              ＋ おてつだいをついか
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface AddPersonModalProps {
  onAdd: (name: string) => void;
  onClose: () => void;
}

function AddPersonModal({ onAdd, onClose }: AddPersonModalProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-dark-800 border border-dark-500 rounded-2xl w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">なまえをとうろく</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="なまえ"
              className="w-full bg-dark-700 border border-dark-500 rounded-xl p-4 text-gray-100 placeholder-gray-500 text-lg focus:outline-none focus:border-accent-cyan transition-colors"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-xl px-4 py-3 text-base font-bold hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                とうろく
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-base text-gray-400 hover:text-white transition-colors"
              >
                やめる
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface GoalModalProps {
  person: Person;
  onSave: (goal: number | undefined, goalReason: string) => void;
  onClose: () => void;
}

function GoalModal({ person, onSave, onClose }: GoalModalProps) {
  const [goalStr, setGoalStr] = useState(person.goal?.toString() ?? '');
  const [reason, setReason] = useState(person.goalReason ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const goalNum = goalStr.trim() ? parseInt(goalStr, 10) : undefined;
    if (goalNum !== undefined && (isNaN(goalNum) || goalNum < 1)) return;
    onSave(goalNum, reason.trim());
  };

  const handleClear = () => {
    onSave(undefined, '');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-dark-800 border border-dark-500 rounded-2xl w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            {person.name}の もくひょう
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">なんかい？</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={goalStr}
                  onChange={(e) => setGoalStr(e.target.value)}
                  placeholder="10"
                  className="w-24 bg-dark-700 border border-dark-500 rounded-xl p-4 text-gray-100 placeholder-gray-500 text-2xl text-center focus:outline-none focus:border-accent-cyan transition-colors"
                  autoFocus
                />
                <span className="text-xl text-gray-300 font-bold">かい</span>
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">
                もくひょうの りゆう（めも）
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="たとえば：10かい がんばったら おもちゃを かってもらう"
                className="w-full bg-dark-700 border border-dark-500 rounded-xl p-4 text-gray-100 placeholder-gray-500 text-base resize-none focus:outline-none focus:border-accent-cyan transition-colors"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-xl px-4 py-3 text-base font-bold hover:bg-accent-cyan/30 transition-colors"
              >
                きめる
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-base text-gray-400 hover:text-white transition-colors"
              >
                やめる
              </button>
            </div>
            {person.goal && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-sm text-gray-500 hover:text-red-400 transition-colors"
              >
                もくひょうをけす
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Otetsudai() {
  const [data, setData] = useState<OtetsudaiData>({ people: [], records: [] });
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  useEffect(() => {
    const loaded = loadData();
    setData(loaded);
    if (loaded.people.length > 0) {
      setSelectedPersonId(loaded.people[0].id);
    }
  }, []);

  const selectedPerson = data.people.find((p) => p.id === selectedPersonId) ?? null;

  const personRecords = useCallback(
    (personId: string) => data.records.filter((r) => r.personId === personId),
    [data.records],
  );

  const recordsByDate = useCallback(
    (personId: string, date: string) =>
      data.records.filter((r) => r.personId === personId && r.date === date),
    [data.records],
  );

  const updateData = (newData: OtetsudaiData) => {
    setData(newData);
    saveData(newData);
  };

  const handleAddPerson = (name: string) => {
    const newPerson: Person = { id: generateId(), name };
    const newData = { ...data, people: [...data.people, newPerson] };
    updateData(newData);
    setSelectedPersonId(newPerson.id);
    setShowAddPerson(false);
  };

  const handleDeletePerson = (personId: string) => {
    const newPeople = data.people.filter((p) => p.id !== personId);
    const newRecords = data.records.filter((r) => r.personId !== personId);
    const newData = { people: newPeople, records: newRecords };
    updateData(newData);
    if (selectedPersonId === personId) {
      setSelectedPersonId(newPeople.length > 0 ? newPeople[0].id : null);
    }
  };

  const handleSaveGoal = (goal: number | undefined, goalReason: string) => {
    if (!selectedPersonId) return;
    const newPeople = data.people.map((p) =>
      p.id === selectedPersonId ? { ...p, goal, goalReason: goalReason || undefined } : p,
    );
    updateData({ ...data, people: newPeople });
    setShowGoalModal(false);
  };

  const handleAddRecord = (content: string, stamp: string) => {
    if (!selectedDate || !selectedPersonId) return;
    const newRecord: OtetsudaiRecord = {
      id: generateId(),
      personId: selectedPersonId,
      date: selectedDate,
      content,
      stamp,
      createdAt: new Date().toISOString(),
    };
    updateData({ ...data, records: [...data.records, newRecord] });
  };

  const handleDeleteRecord = (id: string) => {
    updateData({ ...data, records: data.records.filter((r) => r.id !== id) });
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

  if (data.people.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">おてつだいきろく</h1>
        <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 text-center">
          <p className="text-6xl mb-4">👋</p>
          <p className="text-xl text-gray-300 mb-6">まずは なまえを とうろくしよう！</p>
          <button
            onClick={() => setShowAddPerson(true)}
            className="bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30 rounded-xl px-6 py-3 text-lg font-bold hover:bg-accent-cyan/30 transition-colors"
          >
            なまえをとうろく
          </button>
        </div>
        {showAddPerson && (
          <AddPersonModal
            onAdd={handleAddPerson}
            onClose={() => setShowAddPerson(false)}
          />
        )}
      </div>
    );
  }

  const currentPersonRecordCount = selectedPersonId
    ? personRecords(selectedPersonId).length
    : 0;

  const goalAchieved =
    selectedPerson?.goal != null && currentPersonRecordCount >= selectedPerson.goal;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-white mb-4 text-center">おてつだいきろく</h1>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {data.people.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPersonId(p.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-lg font-bold transition-colors border ${
              selectedPersonId === p.id
                ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/30'
                : 'bg-dark-800 text-gray-400 border-dark-600 hover:text-gray-200'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setShowAddPerson(true)}
          className="shrink-0 rounded-xl px-3 py-2 text-lg text-gray-500 hover:text-accent-cyan border border-dark-600 hover:border-accent-cyan/30 transition-colors"
        >
          ＋
        </button>
        {selectedPerson && (
          <button
            onClick={() => {
              if (confirm(`${selectedPerson.name} をけしますか？きろくもぜんぶきえます`)) {
                handleDeletePerson(selectedPerson.id);
              }
            }}
            className="shrink-0 ml-auto text-sm text-gray-600 hover:text-red-400 transition-colors"
          >
            このひとをけす
          </button>
        )}
      </div>

      {selectedPerson && (
        <>
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5 mb-6">
            <div className="text-center">
              <p className="text-gray-400 text-base mb-1">
                {selectedPerson.name}の おてつだい ごうけい
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl">⭐</span>
                <span className="text-5xl font-bold text-yellow-300">
                  {currentPersonRecordCount}
                </span>
                <span className="text-xl text-gray-300 font-bold self-end mb-1">かい</span>
              </div>
            </div>

            {selectedPerson.goal != null && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-400">
                    もくひょう {selectedPerson.goal} かい
                  </span>
                  <span className="text-gray-400">
                    あと{' '}
                    <span className="text-white font-bold">
                      {Math.max(0, selectedPerson.goal - currentPersonRecordCount)}
                    </span>{' '}
                    かい
                  </span>
                </div>
                <div className="w-full bg-dark-600 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      goalAchieved
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-300'
                        : 'bg-gradient-to-r from-accent-cyan to-accent-green'
                    }`}
                    style={{
                      width: `${Math.min(100, (currentPersonRecordCount / selectedPerson.goal) * 100)}%`,
                    }}
                  />
                </div>
                {goalAchieved && (
                  <p className="text-center text-yellow-300 font-bold text-lg mt-2">
                    🎉 もくひょう たっせい！ 🎉
                  </p>
                )}
                {selectedPerson.goalReason && (
                  <p className="text-gray-400 text-sm mt-2 bg-dark-700 rounded-lg p-3 border border-dark-600">
                    📝 {selectedPerson.goalReason}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => setShowGoalModal(true)}
              className="mt-3 w-full text-sm text-gray-500 hover:text-accent-cyan transition-colors"
            >
              {selectedPerson.goal != null ? 'もくひょうをへんこう' : 'もくひょうをきめる'}
            </button>

          </div>

          <div className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600">
              <button
                onClick={prevMonth}
                className="text-gray-400 hover:text-accent-cyan transition-colors px-3 py-2 text-2xl"
              >
                ◀
              </button>
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-xl">
                  {currentMonth + 1}がつ
                </span>
                <button
                  onClick={goToday}
                  className="text-sm text-gray-400 hover:text-accent-cyan border border-dark-500 hover:border-accent-cyan/30 rounded-lg px-3 py-1 transition-colors"
                >
                  きょう
                </button>
              </div>
              <button
                onClick={nextMonth}
                className="text-gray-400 hover:text-accent-cyan transition-colors px-3 py-2 text-2xl"
              >
                ▶
              </button>
            </div>

            <div className="grid grid-cols-7">
              {WEEKDAYS.map((day, i) => (
                <div
                  key={day}
                  className={`text-center text-sm font-bold py-2 border-b border-dark-600 ${
                    i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
                  }`}
                >
                  {day}
                </div>
              ))}

              {cells.map((day, i) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="border-b border-r border-dark-700/50 min-h-[88px]"
                    />
                  );
                }

                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayRecords = recordsByDate(selectedPersonId!, dateStr);
                const hasRecords = dayRecords.length > 0;
                const isToday = dateStr === todayStr;
                const dow = (startDow + day - 1) % 7;
                const firstStamp = hasRecords ? dayRecords[0].stamp : null;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`border-b border-r border-dark-700/50 min-h-[88px] p-1.5 hover:bg-dark-600/50 transition-colors flex flex-col items-center gap-1 ${
                      hasRecords ? 'bg-dark-700/30' : ''
                    }`}
                  >
                    <span
                      className={`text-sm font-bold leading-none ${
                        isToday
                          ? 'bg-accent-cyan text-dark-900 rounded-full w-7 h-7 flex items-center justify-center'
                          : dow === 0
                            ? 'text-red-400'
                            : dow === 6
                              ? 'text-blue-400'
                              : 'text-gray-300'
                      }`}
                    >
                      {day}
                    </span>
                    {firstStamp && <span className="text-2xl leading-none">{firstStamp}</span>}
                    {dayRecords.length > 1 && (
                      <span className="text-xs text-gray-400">+{dayRecords.length - 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {selectedDate && selectedPersonId && (
        <Modal
          date={selectedDate}
          records={recordsByDate(selectedPersonId, selectedDate)}
          onAdd={handleAddRecord}
          onDelete={handleDeleteRecord}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {showAddPerson && (
        <AddPersonModal
          onAdd={handleAddPerson}
          onClose={() => setShowAddPerson(false)}
        />
      )}

      {selectedPerson && (
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              let msg = `${selectedPerson.name}は おてつだいを ${currentPersonRecordCount}かい しました！`;
              if (selectedPerson.goal != null) {
                if (goalAchieved) {
                  msg += ` 🎉 もくひょう ${selectedPerson.goal}かい たっせい！`;
                } else {
                  msg += ` もくひょうまで あと ${selectedPerson.goal - currentPersonRecordCount}かい！`;
                }
              }
              window.open(`line://msg/text/${encodeURIComponent(msg)}`, '_self');
            }}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#06C755] transition-colors"
          >
            LINE で シェア
          </button>
        </div>
      )}

      {showGoalModal && selectedPerson && (
        <GoalModal
          person={selectedPerson}
          onSave={handleSaveGoal}
          onClose={() => setShowGoalModal(false)}
        />
      )}
    </div>
  );
}
