import { useEffect, useMemo, useState } from 'react';

interface Template {
  id: string;
  name: string;
  summary: string;
  items: string[];
}

interface NoteItem {
  id: string;
  text: string;
  checked: boolean;
}

interface TransientNote {
  id: string;
  templateId: string;
  title: string;
  createdAt: string;
  items: NoteItem[];
  memo: string;
}

interface StoredNotes {
  date: string;
  notes: TransientNote[];
}

const TEMPLATE_STORAGE_KEY = 'transient-note-templates';
const NOTE_STORAGE_KEY = 'transient-notes';

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'morning-routine',
    name: '朝のルーティン',
    summary: '外出前の短期確認用',
    items: ['鍵を持った', '財布を持った', 'スマホを持った', 'ゴミ出しを確認した'],
  },
  {
    id: 'midday-routine',
    name: '昼のルーティン',
    summary: '昼休みや移動前の確認用',
    items: ['午後の予定を確認した', '必要な持ち物を揃えた', '連絡が必要な相手を確認した'],
  },
  {
    id: 'night-routine',
    name: '夜のルーティン',
    summary: '就寝前の短期確認用',
    items: ['鍵を閉めた', '火元を確認した', 'アラームを設定した', '明日の持ち物を置いた'],
  },
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_TEMPLATES;
    }

    const parsed = JSON.parse(raw) as Template[];
    return parsed.length > 0 ? parsed : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function saveTemplates(templates: Template[]): void {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function loadNotes(): StoredNotes {
  const today = getTodayKey();

  try {
    const raw = localStorage.getItem(NOTE_STORAGE_KEY);
    if (!raw) {
      return { date: today, notes: [] };
    }

    const parsed = JSON.parse(raw) as StoredNotes;
    if (parsed.date !== today) {
      return { date: today, notes: [] };
    }

    return parsed;
  } catch {
    return { date: today, notes: [] };
  }
}

function saveNotes(notes: TransientNote[]): void {
  const payload: StoredNotes = { date: getTodayKey(), notes };
  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(payload));
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function TransientNotes() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [notes, setNotes] = useState<TransientNote[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateSummary, setTemplateSummary] = useState('');
  const [templateItemsText, setTemplateItemsText] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [todayKey, setTodayKey] = useState('');

  useEffect(() => {
    const storedTemplates = loadTemplates();
    const storedNotes = loadNotes();

    setTemplates(storedTemplates);
    setNotes(storedNotes.notes);
    setSelectedTemplateId(storedTemplates[0]?.id ?? '');
    setTodayKey(storedNotes.date);
  }, []);

  useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId('');
      return;
    }

    if (!templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentDay = getTodayKey();
      if (currentDay !== todayKey) {
        setTodayKey(currentDay);
        setNotes([]);
        localStorage.removeItem(NOTE_STORAGE_KEY);
      }
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [todayKey]);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const templateCountLabel = `${templates.length} template${templates.length === 1 ? '' : 's'}`;
  const noteCountLabel = `${notes.length} transient note${notes.length === 1 ? '' : 's'} for today`;

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateSummary('');
    setTemplateItemsText('');
  };

  const handleSaveTemplate = () => {
    const items = templateItemsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!templateName.trim() || items.length === 0) {
      return;
    }

    const nextTemplate: Template = {
      id: editingTemplateId ?? createId('template'),
      name: templateName.trim(),
      summary: templateSummary.trim() || '思い出すためだけのテンプレート',
      items,
    };

    const updatedTemplates = editingTemplateId
      ? templates.map((template) => (template.id === editingTemplateId ? nextTemplate : template))
      : [...templates, nextTemplate];

    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);
    setSelectedTemplateId(nextTemplate.id);
    resetTemplateForm();
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateSummary(template.summary);
    setTemplateItemsText(template.items.join('\n'));
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter((template) => template.id !== templateId);
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);

    const updatedNotes = notes.filter((note) => note.templateId !== templateId);
    setNotes(updatedNotes);
    saveNotes(updatedNotes);

    if (editingTemplateId === templateId) {
      resetTemplateForm();
    }
  };

  const handleCreateNote = () => {
    if (!activeTemplate) {
      return;
    }

    const nextNote: TransientNote = {
      id: createId('note'),
      templateId: activeTemplate.id,
      title: activeTemplate.name,
      createdAt: new Date().toISOString(),
      items: activeTemplate.items.map((item) => ({
        id: createId('item'),
        text: item,
        checked: false,
      })),
      memo: '',
    };

    const updatedNotes = [nextNote, ...notes];
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  };

  const handleToggleItem = (noteId: string, itemId: string) => {
    const updatedNotes = notes.map((note) =>
      note.id !== noteId
        ? note
        : {
            ...note,
            items: note.items.map((item) =>
              item.id === itemId ? { ...item, checked: !item.checked } : item
            ),
          }
    );

    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  };

  const handleChangeMemo = (noteId: string, memo: string) => {
    const updatedNotes = notes.map((note) => (note.id === noteId ? { ...note, memo } : note));
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter((note) => note.id !== noteId);
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  };

  const handleCopyToday = async () => {
    const lines = notes.flatMap((note) => [
      `# ${note.title}`,
      ...note.items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`),
      note.memo ? `memo: ${note.memo}` : '',
      '',
    ]);

    await navigator.clipboard.writeText(lines.join('\n').trim() || 'No transient notes');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_35%),linear-gradient(135deg,rgba(8,47,73,0.85),rgba(15,23,42,0.95))] p-8 shadow-2xl shadow-cyan-950/30">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.12),_transparent_60%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/70">
              Transient Notes
            </p>
            <h2 className="mb-4 text-4xl font-bold text-white">記録しないためのメモ</h2>
            <p className="max-w-2xl text-sm leading-7 text-slate-200/85">
              思い出すためだけに使う、一日限定のノートです。テンプレートは残り、実行中のメモは当日が終わると自動で消えます。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Storage</p>
              <p className="mt-2 text-lg font-semibold text-white">No history</p>
              <p className="mt-1 text-sm text-slate-300">履歴保存なし / 検索対象外</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Daily Expiry</p>
              <p className="mt-2 text-lg font-semibold text-white">{todayKey || getTodayKey()}</p>
              <p className="mt-1 text-sm text-slate-300">日付が変わると当日ノートを破棄</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Purpose</p>
              <p className="mt-2 text-lg font-semibold text-white">不安の解消</p>
              <p className="mt-1 text-sm text-slate-300">記録ではなく、その瞬間の補助</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-dark-600 bg-dark-800/70 p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Templates</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">永続テンプレート</h3>
              <p className="mt-1 text-sm text-gray-400">{templateCountLabel}</p>
            </div>
            <button
              onClick={resetTemplateForm}
              className="rounded-full border border-dark-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-white"
            >
              新規作成
            </button>
          </div>

          <div className="mb-6 space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  selectedTemplateId === template.id
                    ? 'border-cyan-400/50 bg-cyan-400/10'
                    : 'border-dark-600 bg-dark-900/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    onClick={() => setSelectedTemplateId(template.id)}
                    className="text-left"
                  >
                    <p className="text-lg font-semibold text-white">{template.name}</p>
                    <p className="mt-1 text-sm text-gray-400">{template.summary}</p>
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="rounded-full border border-dark-500 px-3 py-1 text-xs text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-white"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="rounded-full border border-red-500/30 px-3 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10"
                    >
                      削除
                    </button>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {template.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                      <span className="h-2 w-2 rounded-full bg-cyan-300/70" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-dark-600 bg-dark-900/50 p-5">
            <h4 className="text-lg font-semibold text-white">
              {editingTemplateId ? 'テンプレートを編集' : 'テンプレートを追加'}
            </h4>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm text-gray-300">
                <span>テンプレート名</span>
                <input
                  type="text"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="例: 外出前チェック"
                  className="rounded-xl border border-dark-500 bg-dark-800 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-400/50"
                />
              </label>
              <label className="grid gap-2 text-sm text-gray-300">
                <span>概要</span>
                <input
                  type="text"
                  value={templateSummary}
                  onChange={(event) => setTemplateSummary(event.target.value)}
                  placeholder="例: その瞬間だけ確認したい内容"
                  className="rounded-xl border border-dark-500 bg-dark-800 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-400/50"
                />
              </label>
              <label className="grid gap-2 text-sm text-gray-300">
                <span>チェック項目</span>
                <textarea
                  value={templateItemsText}
                  onChange={(event) => setTemplateItemsText(event.target.value)}
                  rows={6}
                  placeholder={'1行に1項目\n鍵を持った\n財布を持った\nスマホを持った'}
                  className="rounded-xl border border-dark-500 bg-dark-800 px-4 py-3 text-white outline-none transition-colors focus:border-cyan-400/50"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSaveTemplate}
                  className="rounded-full bg-cyan-400/15 px-5 py-2.5 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-400/25"
                >
                  {editingTemplateId ? '更新する' : '追加する'}
                </button>
                {editingTemplateId && (
                  <button
                    onClick={resetTemplateForm}
                    className="rounded-full border border-dark-500 px-5 py-2.5 text-sm text-gray-300 transition-colors hover:border-dark-400 hover:text-white"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-dark-600 bg-dark-800/70 p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/70">Today</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">当日限定ノート</h3>
              <p className="mt-1 text-sm text-gray-400">{noteCountLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCreateNote}
                disabled={!activeTemplate}
                className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                テンプレートから生成
              </button>
              <button
                onClick={handleCopyToday}
                disabled={notes.length === 0}
                className="rounded-full border border-dark-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-emerald-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? 'コピー済み' : '当日内容をコピー'}
              </button>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-dark-600 bg-dark-900/50 p-5">
            <label className="grid gap-2 text-sm text-gray-300">
              <span>生成元テンプレート</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="rounded-xl border border-dark-500 bg-dark-800 px-4 py-3 text-white outline-none transition-colors focus:border-emerald-400/50"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            {activeTemplate && (
              <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                <p className="text-sm font-medium text-white">{activeTemplate.name}</p>
                <p className="mt-1 text-sm text-gray-400">{activeTemplate.summary}</p>
              </div>
            )}
          </div>

          {notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-dark-500 bg-dark-900/30 px-6 py-12 text-center">
              <p className="text-lg font-medium text-white">まだ当日ノートはありません</p>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                テンプレートを選んで生成すると、今日だけ使えるチェックメモを作れます。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-2xl border border-dark-600 bg-dark-900/45 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{note.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">
                        created {formatDateTime(note.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="rounded-full border border-red-500/30 px-3 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10"
                    >
                      破棄
                    </button>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {note.items.map((item) => (
                      <li key={item.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dark-700 bg-dark-800/70 px-4 py-3 transition-colors hover:border-emerald-400/20">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleItem(note.id, item.id)}
                            className="h-4 w-4 accent-emerald-400"
                          />
                          <span
                            className={`text-sm ${
                              item.checked ? 'text-gray-500 line-through' : 'text-gray-200'
                            }`}
                          >
                            {item.text}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <label className="mt-4 grid gap-2 text-sm text-gray-300">
                    <span>一時メモ</span>
                    <textarea
                      value={note.memo}
                      onChange={(event) => handleChangeMemo(note.id, event.target.value)}
                      rows={4}
                      placeholder="当日だけ残せばいい補助メモ"
                      className="rounded-xl border border-dark-500 bg-dark-800 px-4 py-3 text-white outline-none transition-colors focus:border-emerald-400/50"
                    />
                  </label>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: '作成',
            text: 'テンプレートを選び、その日の実行用ノートを生成する。',
          },
          {
            title: '使用',
            text: 'チェックと短い記入だけに絞り、長期管理には使わない。',
          },
          {
            title: '消去',
            text: '日付が変わると自動削除され、履歴として蓄積されない。',
          },
        ].map((step) => (
          <div key={step.title} className="rounded-2xl border border-dark-600 bg-dark-800/60 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/70">{step.title}</p>
            <p className="mt-3 text-sm leading-7 text-gray-300">{step.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
