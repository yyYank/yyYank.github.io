import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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

const fadeTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
};

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

function createNoteFromTemplate(template: Template): TransientNote {
  return {
    id: createId('note'),
    templateId: template.id,
    title: template.name,
    createdAt: new Date().toISOString(),
    items: template.items.map((item) => ({
      id: createId('item'),
      text: item,
      checked: false,
    })),
    memo: '',
  };
}

function synchronizeNotesWithTemplates(
  currentNotes: TransientNote[],
  templates: Template[]
): TransientNote[] {
  return templates.map((template) => {
    const existingNote = currentNotes.find((note) => note.templateId === template.id);

    if (!existingNote) {
      return createNoteFromTemplate(template);
    }

    return {
      ...existingNote,
      title: template.name,
      items: template.items.map((itemText) => {
        const existingItem = existingNote.items.find((item) => item.text === itemText);
        return existingItem
          ? { ...existingItem, text: itemText }
          : { id: createId('item'), text: itemText, checked: false };
      }),
    };
  });
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
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const templateNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedTemplates = loadTemplates();
    const loadedNotes = loadNotes();
    const storedNotes = loadedNotes.notes;
    const syncedNotes = synchronizeNotesWithTemplates(storedNotes, storedTemplates);

    setTemplates(storedTemplates);
    setNotes(syncedNotes);
    setSelectedTemplateId(storedTemplates[0]?.id ?? '');
    setTodayKey(loadedNotes.date);
    setIsHydrated(true);
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
    if (!isHydrated) {
      return;
    }

    if (templates.length === 0) {
      setNotes([]);
      return;
    }

    setNotes((currentNotes) => {
      return synchronizeNotesWithTemplates(currentNotes, templates);
    });
  }, [isHydrated, templates]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveNotes(notes);
  }, [isHydrated, notes]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timer = window.setInterval(() => {
      const currentDay = getTodayKey();
      if (currentDay !== todayKey) {
        setTodayKey(currentDay);
        const nextNotes = synchronizeNotesWithTemplates([], templates);
        setNotes(nextNotes);
      }
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [isHydrated, templates, todayKey]);

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
    setTemplatesOpen(true);
    setSelectedTemplateId(template.id);
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateSummary(template.summary);
    setTemplateItemsText(template.items.join('\n'));
    window.setTimeout(() => {
      templateNameInputRef.current?.focus();
    }, 0);
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter((template) => template.id !== templateId);
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);

    const updatedNotes = notes.filter((note) => note.templateId !== templateId);
    setNotes(updatedNotes);

    if (editingTemplateId === templateId) {
      resetTemplateForm();
    }
  };

  const handleCreateNote = () => {
    if (!activeTemplate) {
      return;
    }

    const nextNote = createNoteFromTemplate(activeTemplate);
    const updatedNotes = notes.some((note) => note.templateId === activeTemplate.id)
      ? notes.map((note) => (note.templateId === activeTemplate.id ? nextNote : note))
      : [nextNote, ...notes];

    setNotes(updatedNotes);
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
  };

  const handleChangeMemo = (noteId: string, memo: string) => {
    const updatedNotes = notes.map((note) => (note.id === noteId ? { ...note, memo } : note));
    setNotes(updatedNotes);
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter((note) => note.id !== noteId);
    setNotes(updatedNotes);
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
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"
      >
        <motion.div layout className="rounded-3xl border border-dark-600 bg-dark-800/70 p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/70">Today</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">当日限定ノート</h3>
              <p className="mt-1 text-sm text-gray-400">{noteCountLabel}</p>
            </div>
            <button
              onClick={handleCopyToday}
              disabled={notes.length === 0}
              type="button"
              className="rounded-full border border-dark-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-emerald-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? 'コピー済み' : '当日内容をコピー'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {notes.length === 0 ? (
              <motion.div
                key="notes-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                className="rounded-2xl border border-dashed border-dark-500 bg-dark-900/30 px-6 py-12 text-center"
              >
                <p className="text-lg font-medium text-white">まだ当日ノートはありません</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  テンプレートから自動で作られる当日ノートがここに並びます。
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="notes-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                className="space-y-4"
              >
                <AnimatePresence initial={false}>
                  {notes.map((note) => (
                    <motion.article
                      key={note.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={fadeTransition}
                      className="rounded-2xl border border-dark-600 bg-dark-900/45 p-5"
                    >
                  <div className="sticky top-[70px] z-10 -mx-5 -mt-5 mb-4 flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-dark-700 bg-dark-900/80 px-5 py-4 backdrop-blur-xl">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-dark-900/95 via-dark-900/60 to-transparent blur-lg opacity-80" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-dark-900/95 via-dark-900/60 to-transparent blur-lg opacity-80" />
                    <div className="relative z-10">
                      <p className="text-lg font-semibold text-white">{note.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">
                        created {formatDateTime(note.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      type="button"
                      className="relative z-10 rounded-full border border-red-500/25 bg-dark-900/45 px-3 py-1 text-xs text-red-300 transition-colors hover:bg-red-500/10"
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
                    </motion.article>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div layout className="mt-6 rounded-2xl border border-dark-600 bg-dark-900/50 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid flex-1 gap-2 text-sm text-gray-300 min-w-[220px]">
                <span>再生成するテンプレート</span>
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
              <button
                onClick={handleCreateNote}
                disabled={!activeTemplate}
                type="button"
                className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                再生成
              </button>
            </div>

            {activeTemplate && (
              <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                <p className="text-sm font-medium text-white">{activeTemplate.name}</p>
                <p className="mt-1 text-sm text-gray-400">{activeTemplate.summary}</p>
              </div>
            )}
          </motion.div>
        </motion.div>

        <motion.div layout className="rounded-3xl border border-dark-600 bg-dark-800/70 p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/70">Templates</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">テンプレート</h3>
              <p className="mt-1 text-sm text-gray-400">{templateCountLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTemplatesOpen((current) => !current)}
                type="button"
                className="rounded-full border border-dark-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-white"
              >
                {templatesOpen ? '閉じる' : '開く'}
              </button>
              <button
                onClick={() => {
                  setTemplatesOpen(true);
                  resetTemplateForm();
                }}
                type="button"
                className="rounded-full border border-dark-500 px-4 py-2 text-sm text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-white"
              >
                新規作成
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {templatesOpen ? (
              <motion.div
                key="templates-open"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
              >
                <div className="mb-6 space-y-3">
                  <AnimatePresence initial={false}>
                    {templates.map((template) => (
                      <motion.div
                        key={template.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={fadeTransition}
                        className={`rounded-2xl border p-4 transition-colors ${
                          selectedTemplateId === template.id
                            ? 'border-cyan-400/50 bg-cyan-400/10'
                            : 'border-dark-600 bg-dark-900/40'
                        }`}
                      >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setSelectedTemplateId(template.id)}
                          type="button"
                          className="text-left"
                        >
                          <p className="text-lg font-semibold text-white">{template.name}</p>
                          <p className="mt-1 text-sm text-gray-400">{template.summary}</p>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTemplate(template)}
                          type="button"
                          className="rounded-full border border-dark-500 px-3 py-1 text-xs text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-white"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          type="button"
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
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <motion.div layout className="rounded-2xl border border-dark-600 bg-dark-900/50 p-5">
                  <h4 className="text-lg font-semibold text-white">
                    {editingTemplateId ? 'テンプレートを編集' : 'テンプレートを追加'}
                  </h4>
                  <div className="mt-4 grid gap-4">
                    <label className="grid gap-2 text-sm text-gray-300">
                      <span>テンプレート名</span>
                      <input
                        ref={templateNameInputRef}
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
                        type="button"
                        className="rounded-full bg-cyan-400/15 px-5 py-2.5 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-400/25"
                      >
                        {editingTemplateId ? '更新する' : '追加する'}
                      </button>
                      {editingTemplateId && (
                        <button
                          onClick={resetTemplateForm}
                          type="button"
                          className="rounded-full border border-dark-500 px-5 py-2.5 text-sm text-gray-300 transition-colors hover:border-dark-400 hover:text-white"
                        >
                          キャンセル
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.p
                key="templates-closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                className="text-sm text-gray-500"
              >
                テンプレート一覧と編集フォームは閉じています。必要なときだけ開いてください。
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.75, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="border-t border-dark-700 pt-6"
      >
        <ul className="space-y-4 text-sm leading-7 text-gray-300">
          <li>
            <span className="font-semibold text-white">作成</span>
            <br />
            テンプレートから当日ノートを自動で揃え、必要なら個別に再生成する。
          </li>
          <li>
            <span className="font-semibold text-white">使用</span>
            <br />
            チェックと短い記入だけに絞り、長期管理には使わない。
          </li>
          <li>
            <span className="font-semibold text-white">消去</span>
            <br />
            日付が変わると自動削除され、履歴として蓄積されない。
          </li>
        </ul>
      </motion.section>
    </div>
  );
}
