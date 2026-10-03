import { useState, useEffect, useCallback } from 'react';
import {
  countPoints,
  loadGanbariData,
  saveGanbariData,
  type GanbariData,
  type GanbariKind,
  type GanbariRecord,
  type Person,
} from './ganbariData';

const WEEKDAYS = ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'] as const;

const KIND_DETAILS: Record<
  GanbariKind,
  { label: string; icon: string; placeholder: string; addLabel: string }
> = {
  otetsudai: {
    label: 'おてつだい',
    icon: '🧹',
    placeholder: 'なにをおてつだいしたかな？',
    addLabel: 'おてつだいをついか',
  },
  naraigoto: {
    label: 'ならいごと',
    icon: '🎒',
    placeholder: 'なにをがんばったかな？',
    addLabel: 'ならいごとをついか',
  },
};

const STAMPS = [
  '💮', '🌸', '🌈', '❤️', '⭐', '🌻', '🎀', '🦋', '🍀', '🌷',
  '🌟', '🎵', '🐱', '🐶', '🍓', '🍎', '🌙', '☀️', '🐣', '🐰',
] as const;

function randomStamp(): string {
  return STAMPS[Math.floor(Math.random() * STAMPS.length)];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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
        className="text-6xl hover:scale-105 transition-transform"
        title="しーるをえらぶ"
      >
        {selected}
      </button>
      <p className="text-muted text-xs">タップして えらべるよ</p>
      {open && (
        <div className="grid grid-cols-5 gap-2 bg-surface-2 rounded-xl p-3 border border-border">
          {STAMPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
              className={`text-3xl p-1 rounded-lg hover:bg-surface-2 transition-colors ${
                selected === s ? 'bg-surface-2 ring-2 ring-accent' : ''
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
  kind: GanbariKind;
  records: GanbariRecord[];
  onAdd: (content: string, stamp: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function Modal({ date, kind, records, onAdd, onDelete, onClose }: ModalProps) {
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
        className="relative bg-surface border border-border-strong rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text">{formatDate(date)}</h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-text transition-colors text-2xl leading-none"
            >
              ✕
            </button>
          </div>

          {records.length > 0 && (
            <div className="mb-5 space-y-3">
              <p className="text-center text-lg font-bold text-warning">よくできました！</p>
              {records.map((r) => (
                <div
                  key={r.id}
                  className="bg-surface-2 rounded-xl p-4 border border-border flex items-start gap-3"
                >
                  <span className="text-3xl shrink-0">{r.stamp}</span>
                  <span className="text-text text-base flex-1">{r.content}</span>
                  <button
                    onClick={() => onDelete(r.id)}
                    className="text-faint hover:text-danger transition-colors text-sm shrink-0"
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
                placeholder={KIND_DETAILS[kind].placeholder}
                className="w-full bg-surface-2 border border-border-strong rounded-xl p-4 text-text placeholder-faint text-base resize-none focus:outline-none focus:border-accent transition-colors"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!content.trim()}
                  className="flex-1 bg-accent-cyan/20 text-accent border border-accent/30 rounded-xl px-4 py-3 text-base font-bold hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  きろくする
                </button>
                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-3 text-base text-muted hover:text-text transition-colors"
                  >
                    やめる
                  </button>
                )}
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-base text-muted hover:text-accent hover:border-accent/30 transition-colors"
            >
              ＋ {KIND_DETAILS[kind].addLabel}
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
        className="relative bg-surface border border-border-strong rounded-2xl w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-text mb-4">なまえをとうろく</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="なまえ"
              className="w-full bg-surface-2 border border-border-strong rounded-xl p-4 text-text placeholder-faint text-lg focus:outline-none focus:border-accent transition-colors"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 bg-accent-cyan/20 text-accent border border-accent/30 rounded-xl px-4 py-3 text-base font-bold hover:bg-accent-cyan/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                とうろく
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-base text-muted hover:text-text transition-colors"
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
  kind: GanbariKind;
  onSave: (goal: number | undefined, goalReason: string) => void;
  onClose: () => void;
}

function GoalModal({ person, kind, onSave, onClose }: GoalModalProps) {
  const currentGoal = person.goals?.[kind];
  const [goalStr, setGoalStr] = useState(currentGoal?.target.toString() ?? '');
  const [reason, setReason] = useState(currentGoal?.reason ?? '');

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
        className="relative bg-surface border border-border-strong rounded-2xl w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-text mb-4">
            {person.name}の {KIND_DETAILS[kind].label} もくひょう
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-muted text-sm mb-1">なんポイント？</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={goalStr}
                  onChange={(e) => setGoalStr(e.target.value)}
                  placeholder="10"
                  className="w-24 bg-surface-2 border border-border-strong rounded-xl p-4 text-text placeholder-faint text-2xl text-center focus:outline-none focus:border-accent transition-colors"
                  autoFocus
                />
                <span className="text-xl text-muted font-bold">ポイント</span>
              </div>
            </div>
            <div>
              <label className="block text-muted text-sm mb-1">
                もくひょうの りゆう（めも）
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="たとえば：10ポイントで おもちゃを かってもらう"
                className="w-full bg-surface-2 border border-border-strong rounded-xl p-4 text-text placeholder-faint text-base resize-none focus:outline-none focus:border-accent transition-colors"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-accent-cyan/20 text-accent border border-accent/30 rounded-xl px-4 py-3 text-base font-bold hover:bg-accent-cyan/30 transition-colors"
              >
                きめる
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-base text-muted hover:text-text transition-colors"
              >
                やめる
              </button>
            </div>
            {currentGoal && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full text-sm text-faint hover:text-danger transition-colors"
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

export default function Ganbari() {
  const [data, setData] = useState<GanbariData>({ people: [], records: [] });
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<GanbariKind>('otetsudai');
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  useEffect(() => {
    const loaded = loadGanbariData(localStorage);
    setData(loaded);
    if (loaded.people.length > 0) {
      setSelectedPersonId(loaded.people[0].id);
    }
  }, []);

  const selectedPerson = data.people.find((p) => p.id === selectedPersonId) ?? null;

  const recordsByDate = useCallback(
    (personId: string, date: string, kind: GanbariKind) =>
      data.records.filter(
        (r) => r.personId === personId && r.date === date && r.kind === kind,
      ),
    [data.records],
  );

  const updateData = (newData: GanbariData) => {
    setData(newData);
    saveGanbariData(localStorage, newData);
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
    const newPeople = data.people.map((person) => {
      if (person.id !== selectedPersonId) return person;
      const goals = { ...person.goals };
      if (goal === undefined) {
        delete goals[selectedKind];
      } else {
        goals[selectedKind] = { target: goal, ...(goalReason ? { reason: goalReason } : {}) };
      }
      return {
        ...person,
        ...(Object.keys(goals).length > 0 ? { goals } : { goals: undefined }),
      };
    });
    updateData({ ...data, people: newPeople });
    setShowGoalModal(false);
  };

  const handleAddRecord = (content: string, stamp: string) => {
    if (!selectedDate || !selectedPersonId) return;
    const newRecord: GanbariRecord = {
      id: generateId(),
      personId: selectedPersonId,
      kind: selectedKind,
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
        <h1 className="text-3xl font-bold text-text mb-6 text-center">がんばりポイント</h1>
        <div className="bg-surface border border-border rounded-2xl p-8 text-center">
          <p className="text-6xl mb-4">👋</p>
          <p className="text-xl text-muted mb-6">まずは なまえを とうろくしよう！</p>
          <button
            onClick={() => setShowAddPerson(true)}
            className="bg-accent-cyan/20 text-accent border border-accent/30 rounded-xl px-6 py-3 text-lg font-bold hover:bg-accent-cyan/30 transition-colors"
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

  const pointTotals: Record<GanbariKind, number> = {
    otetsudai: selectedPersonId ? countPoints(data.records, selectedPersonId, 'otetsudai') : 0,
    naraigoto: selectedPersonId ? countPoints(data.records, selectedPersonId, 'naraigoto') : 0,
  };
  const currentPoints = pointTotals[selectedKind];
  const currentGoal = selectedPerson?.goals?.[selectedKind];
  const kindDetails = KIND_DETAILS[selectedKind];

  const goalAchieved =
    currentGoal != null && currentPoints >= currentGoal.target;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-text mb-4 text-center">がんばりポイント</h1>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {data.people.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPersonId(p.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-lg font-bold transition-colors border ${
              selectedPersonId === p.id
                ? 'bg-accent-cyan/20 text-accent border-accent/30'
                : 'bg-surface text-muted border-border hover:text-text'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={() => setShowAddPerson(true)}
          className="shrink-0 rounded-xl px-3 py-2 text-lg text-faint hover:text-accent border border-border hover:border-accent/30 transition-colors"
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
            className="shrink-0 ml-auto text-sm text-faint hover:text-danger transition-colors"
          >
            このひとをけす
          </button>
        )}
      </div>

      {selectedPerson && (
        <>
          <div
            role="tablist"
            aria-label="ポイントのしゅるい"
            className="grid grid-cols-2 gap-2 mb-4 rounded-2xl bg-surface-2 p-1.5"
          >
            {(['otetsudai', 'naraigoto'] as const).map((kind) => {
              const details = KIND_DETAILS[kind];
              const selected = selectedKind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setSelectedKind(kind);
                    setSelectedDate(null);
                    setShowGoalModal(false);
                  }}
                  className={`rounded-xl px-3 py-3 text-center transition-colors ${
                    selected
                      ? 'bg-surface text-text shadow-sm'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  <span className="block text-lg font-bold">
                    {details.icon} {details.label}
                  </span>
                  <span className="block text-sm mt-0.5">
                    {pointTotals[kind]} ポイント
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
            <div className="text-center">
              <p className="text-muted text-base mb-1">
                {selectedPerson.name}の {kindDetails.label} ごうけい
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl">{kindDetails.icon}</span>
                <span className="text-5xl font-bold text-warning">
                  {currentPoints}
                </span>
                <span className="text-xl text-muted font-bold self-end mb-1">ポイント</span>
              </div>
            </div>

            {currentGoal != null && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted">
                    もくひょう {currentGoal.target} ポイント
                  </span>
                  <span className="text-muted">
                    あと{' '}
                    <span className="text-text font-bold">
                      {Math.max(0, currentGoal.target - currentPoints)}
                    </span>{' '}
                    ポイント
                  </span>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[background-color,width] duration-slow ${
                      goalAchieved
                        ? 'bg-warning'
                        : 'bg-gradient-to-r from-accent-cyan to-accent-green'
                    }`}
                    style={{
                      width: `${Math.min(100, (currentPoints / currentGoal.target) * 100)}%`,
                    }}
                  />
                </div>
                {goalAchieved && (
                  <p className="text-center text-warning font-bold text-lg mt-2">
                    🎉 もくひょう たっせい！ 🎉
                  </p>
                )}
                {currentGoal.reason && (
                  <p className="text-muted text-sm mt-2 bg-surface-2 rounded-lg p-3 border border-border">
                    📝 {currentGoal.reason}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => setShowGoalModal(true)}
              className="mt-3 w-full text-sm text-faint hover:text-accent transition-colors"
            >
              {currentGoal != null ? 'もくひょうをへんこう' : 'もくひょうをきめる'}
            </button>

          </div>

          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button
                onClick={prevMonth}
                className="text-muted hover:text-accent transition-colors px-3 py-2 text-2xl"
              >
                ◀
              </button>
              <div className="flex items-center gap-3">
                <span className="text-text font-bold text-xl">
                  {currentMonth + 1}がつ
                </span>
                <button
                  onClick={goToday}
                  className="text-sm text-muted hover:text-accent border border-border-strong hover:border-accent/30 rounded-lg px-3 py-1 transition-colors"
                >
                  きょう
                </button>
              </div>
              <button
                onClick={nextMonth}
                className="text-muted hover:text-accent transition-colors px-3 py-2 text-2xl"
              >
                ▶
              </button>
            </div>

            <div className="grid grid-cols-7">
              {WEEKDAYS.map((day, i) => (
                <div
                  key={day}
                  className={`text-center text-sm font-bold py-2 border-b border-border ${
                    i === 0 ? 'text-danger' : i === 6 ? 'text-accent' : 'text-muted'
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
                      className="border-b border-r border-border/50 min-h-[88px]"
                    />
                  );
                }

                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayRecords = recordsByDate(selectedPersonId!, dateStr, selectedKind);
                const hasRecords = dayRecords.length > 0;
                const isToday = dateStr === todayStr;
                const dow = (startDow + day - 1) % 7;
                const firstStamp = hasRecords ? dayRecords[0].stamp : null;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`border-b border-r border-border/50 min-h-[88px] p-1.5 hover:bg-surface-2/50 transition-colors flex flex-col items-center gap-1 ${
                      hasRecords ? 'bg-surface-2/30' : ''
                    }`}
                  >
                    <span
                      className={`text-sm font-bold leading-none ${
                        isToday
                          ? 'bg-accent-cyan text-dark-900 rounded-full w-7 h-7 flex items-center justify-center'
                          : dow === 0
                            ? 'text-danger'
                            : dow === 6
                              ? 'text-accent'
                              : 'text-muted'
                      }`}
                    >
                      {day}
                    </span>
                    {firstStamp && <span className="text-2xl leading-none">{firstStamp}</span>}
                    {dayRecords.length > 1 && (
                      <span className="text-xs text-muted">+{dayRecords.length - 1}</span>
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
          kind={selectedKind}
          records={recordsByDate(selectedPersonId, selectedDate, selectedKind)}
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
              let msg = `${selectedPerson.name}は ${kindDetails.label}を ${currentPoints}ポイント がんばりました！`;
              if (currentGoal != null) {
                if (goalAchieved) {
                  msg += ` 🎉 もくひょう ${currentGoal.target}ポイント たっせい！`;
                } else {
                  msg += ` もくひょうまで あと ${currentGoal.target - currentPoints}ポイント！`;
                }
              }
              window.open(`line://msg/text/${encodeURIComponent(msg)}`, '_self');
            }}
            className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-success transition-colors"
          >
            LINE で シェア
          </button>
        </div>
      )}

      {showGoalModal && selectedPerson && (
        <GoalModal
          person={selectedPerson}
          kind={selectedKind}
          onSave={handleSaveGoal}
          onClose={() => setShowGoalModal(false)}
        />
      )}
    </div>
  );
}
