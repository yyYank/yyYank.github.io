import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CelebrationConfetti from './CelebrationConfetti';
import {
  createId,
  createNoteFromTemplate,
  normalizeStoredNotes,
  synchronizeNotesWithTemplates,
  type StoredNotes,
  type Template,
  type TransientNote,
} from './transientNoteState';
import {
  addNoteItem,
  addPersistentTodo,
  changeNoteMemo,
  createCopyText,
  deleteNote,
  deleteNoteItem,
  deletePersistentTodo,
  toggleNoteItem,
  togglePersistentTodo,
  type PersistentTodo,
} from './transientNoteActions';
import {
  getNextTemplateOrder,
  moveTemplate,
  normalizeTemplates,
  reindexTemplates,
  sortTemplates,
} from './transientTemplateState';

const TEMPLATE_STORAGE_KEY = 'transient-note-templates';
const NOTE_STORAGE_KEY = 'transient-notes';
const TOMORROW_TODO_STORAGE_KEY = 'transient-tomorrow-todos';

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'morning-routine',
    name: '朝のルーティン',
    summary: '外出前の短期確認用',
    items: ['鍵を持った', '財布を持った', 'スマホを持った', 'ゴミ出しを確認した'],
    order: 1,
  },
  {
    id: 'midday-routine',
    name: '昼のルーティン',
    summary: '昼休みや移動前の確認用',
    items: ['午後の予定を確認した', '必要な持ち物を揃えた', '連絡が必要な相手を確認した'],
    order: 2,
  },
  {
    id: 'night-routine',
    name: '夜のルーティン',
    summary: '就寝前の短期確認用',
    items: ['鍵を閉めた', '火元を確認した', 'アラームを設定した', '明日の持ち物を置いた'],
    order: 3,
  },
];

const fadeTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
};

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
      return sortTemplates(DEFAULT_TEMPLATES);
    }

    const parsed = JSON.parse(raw) as Partial<Template>[];
    return parsed.length > 0 ? normalizeTemplates(parsed) : sortTemplates(DEFAULT_TEMPLATES);
  } catch {
    return sortTemplates(DEFAULT_TEMPLATES);
  }
}

function saveTemplates(templates: Template[]): void {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(sortTemplates(templates)));
}

function loadNotes(): StoredNotes {
  const today = getTodayKey();

  try {
    const raw = localStorage.getItem(NOTE_STORAGE_KEY);
    if (!raw) {
      return { date: today, notes: [], deletedTemplateIds: [] };
    }

    const parsed = JSON.parse(raw);
    return normalizeStoredNotes(parsed, today);
  } catch {
    return { date: today, notes: [], deletedTemplateIds: [] };
  }
}

function saveNotes(notes: TransientNote[], deletedTemplateIds: string[]): void {
  const payload: StoredNotes = { date: getTodayKey(), notes, deletedTemplateIds };
  localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(payload));
}

function loadTomorrowTodos(): PersistentTodo[] {
  try {
    const raw = localStorage.getItem(TOMORROW_TODO_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PersistentTodo[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTomorrowTodos(todos: PersistentTodo[]): void {
  localStorage.setItem(TOMORROW_TODO_STORAGE_KEY, JSON.stringify(todos));
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
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showDoneSummary, setShowDoneSummary] = useState(false);
  const [tomorrowTodos, setTomorrowTodos] = useState<PersistentTodo[]>([]);
  const [tomorrowTodoDraft, setTomorrowTodoDraft] = useState('');
  const [deletedTemplateIds, setDeletedTemplateIds] = useState<string[]>([]);
  const [noteItemDrafts, setNoteItemDrafts] = useState<Record<string, string>>({});
  const templateNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedTemplates = loadTemplates();
    const loadedNotes = loadNotes();
    const storedNotes = loadedNotes.notes;
    const storedDeletedTemplateIds = loadedNotes.deletedTemplateIds;
    const storedTomorrowTodos = loadTomorrowTodos();
    const syncedNotes = synchronizeNotesWithTemplates(
      storedNotes,
      storedTemplates,
      storedDeletedTemplateIds
    );

    setTemplates(storedTemplates);
    setNotes(syncedNotes);
    setDeletedTemplateIds(storedDeletedTemplateIds);
    setTomorrowTodos(storedTomorrowTodos);
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
      return synchronizeNotesWithTemplates(currentNotes, templates, deletedTemplateIds);
    });
  }, [deletedTemplateIds, isHydrated, templates]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveNotes(notes, deletedTemplateIds);
  }, [deletedTemplateIds, isHydrated, notes]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveTomorrowTodos(tomorrowTodos);
  }, [isHydrated, tomorrowTodos]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timer = window.setInterval(() => {
      const currentDay = getTodayKey();
      if (currentDay !== todayKey) {
        setTodayKey(currentDay);
        const nextNotes = synchronizeNotesWithTemplates([], templates, []);
        setDeletedTemplateIds([]);
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
  const incompleteGroups = useMemo(
    () =>
      notes
        .map((note) => ({
          noteId: note.id,
          title: note.title,
          items: note.items.filter((item) => !item.checked),
        }))
        .filter((group) => group.items.length > 0),
    [notes]
  );
  const completedGroups = useMemo(
    () =>
      notes
        .map((note) => ({
          noteId: note.id,
          title: note.title,
          items: note.items.filter((item) => item.checked),
        }))
        .filter((group) => group.items.length > 0),
    [notes]
  );
  const completedCount = useMemo(
    () => completedGroups.reduce((sum, group) => sum + group.items.length, 0),
    [completedGroups]
  );

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
      order:
        editingTemplateId
          ? templates.find((template) => template.id === editingTemplateId)?.order ??
            getNextTemplateOrder(templates)
          : getNextTemplateOrder(templates),
    };

    const updatedTemplates = sortTemplates(
      editingTemplateId
      ? templates.map((template) => (template.id === editingTemplateId ? nextTemplate : template))
      : [...templates, nextTemplate]
    );

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
    const updatedTemplates = reindexTemplates(
      sortTemplates(templates.filter((template) => template.id !== templateId))
    );
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);

    const updatedNotes = notes.filter((note) => note.templateId !== templateId);
    setNotes(updatedNotes);

    if (editingTemplateId === templateId) {
      resetTemplateForm();
    }
  };

  const handleMoveTemplate = (templateId: string, direction: 'up' | 'down') => {
    const updatedTemplates = moveTemplate(templates, templateId, direction);
    setTemplates(updatedTemplates);
    saveTemplates(updatedTemplates);
  };

  const handleCreateNote = () => {
    if (!activeTemplate) {
      return;
    }

    const nextNote = createNoteFromTemplate(activeTemplate);
    const updatedNotes = notes.some((note) => note.templateId === activeTemplate.id)
      ? notes.map((note) => (note.templateId === activeTemplate.id ? nextNote : note))
      : [nextNote, ...notes];

    setDeletedTemplateIds((current) =>
      current.filter((templateId) => templateId !== activeTemplate.id)
    );
    setNotes(updatedNotes);
  };

  const handleToggleItem = (noteId: string, itemId: string) => {
    setNotes(toggleNoteItem(notes, noteId, itemId));
  };

  const handleChangeMemo = (noteId: string, memo: string) => {
    setNotes(changeNoteMemo(notes, noteId, memo));
  };

  const handleDeleteNote = (noteId: string) => {
    const nextState = deleteNote(notes, deletedTemplateIds, noteId);
    setDeletedTemplateIds(nextState.deletedTemplateIds);
    setNotes(nextState.notes);
  };

  const handleDeleteNoteItem = (noteId: string, itemId: string) => {
    setNotes(deleteNoteItem(notes, noteId, itemId));
  };

  const handleAddNoteItem = (noteId: string) => {
    const text = noteItemDrafts[noteId]?.trim();
    if (!text) {
      return;
    }

    setNotes((currentNotes) => addNoteItem(currentNotes, noteId, text));
    setNoteItemDrafts((current) => ({ ...current, [noteId]: '' }));
  };

  const handleCopyToday = async () => {
    await navigator.clipboard.writeText(createCopyText(notes));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleAddTomorrowTodo = () => {
    const updatedTodos = addPersistentTodo(tomorrowTodos, tomorrowTodoDraft);
    if (updatedTodos === tomorrowTodos) {
      return;
    }

    setTomorrowTodos(updatedTodos);
    setTomorrowTodoDraft('');
  };

  const handleToggleTomorrowTodo = (todoId: string) => {
    setTomorrowTodos((current) => togglePersistentTodo(current, todoId));
  };

  const handleDeleteTomorrowTodo = (todoId: string) => {
    setTomorrowTodos((current) => deletePersistentTodo(current, todoId));
  };

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
      >
        <motion.div layout className="rounded-3xl border border-dark-600 bg-dark-800/70 p-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/70">Today</p>
              <p className="mt-2 text-sm text-gray-400">{noteCountLabel}</p>
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
                  <div className="sticky top-[65px] z-10 -mx-5 -mt-5 mb-4 flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-dark-700 bg-dark-900/72 px-5 py-4 backdrop-blur-xl">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-dark-900 via-dark-900/85 to-transparent blur-xl opacity-95" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-dark-900 via-dark-900/85 to-transparent blur-xl opacity-95" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/4 via-transparent to-transparent opacity-70" />
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
                        <div className="flex items-center gap-3 rounded-xl border border-dark-700 bg-dark-800/70 px-4 py-3 transition-colors hover:border-emerald-400/20">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
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
                            {item.source === 'extra' && (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-200/80">
                                today only
                              </span>
                            )}
                          </label>
                          <button
                            onClick={() => handleDeleteNoteItem(note.id, item.id)}
                            type="button"
                            className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs text-red-200 transition-colors hover:bg-red-500/20"
                          >
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="grid min-w-[220px] flex-1 gap-2 text-sm text-gray-300">
                      <span>今日だけ追加するTODO</span>
                      <input
                        type="text"
                        value={noteItemDrafts[note.id] ?? ''}
                        onChange={(event) =>
                          setNoteItemDrafts((current) => ({
                            ...current,
                            [note.id]: event.target.value,
                          }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddNoteItem(note.id);
                          }
                        }}
                        placeholder="今日だけ必要なことを追加"
                        className="rounded-xl border border-dark-500 bg-dark-800 px-4 py-3 text-white outline-none transition-colors focus:border-emerald-400/50"
                      />
                    </label>
                    <button
                      onClick={() => handleAddNoteItem(note.id)}
                      type="button"
                      className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
                    >
                      追加
                    </button>
                  </div>

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
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300/70">
                  Next / 明日用TODO
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  日付が変わっても残る、持ち越し用のメモです。
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                {tomorrowTodos.length} persistent
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="grid min-w-[220px] flex-1 gap-2 text-sm text-gray-300">
                <span>追加するTODO</span>
                <input
                  type="text"
                  value={tomorrowTodoDraft}
                  onChange={(event) => setTomorrowTodoDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddTomorrowTodo();
                    }
                  }}
                  placeholder="明日へ残しておきたいこと"
                  className="rounded-xl border border-dark-500 bg-dark-800 px-4 py-3 text-white outline-none transition-colors focus:border-sky-400/50"
                />
              </label>
              <button
                onClick={handleAddTomorrowTodo}
                type="button"
                className="rounded-full bg-sky-400/15 px-4 py-2 text-sm font-medium text-sky-200 transition-colors hover:bg-sky-400/25"
              >
                追加
              </button>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {tomorrowTodos.length === 0 ? (
                <motion.div
                  key="tomorrow-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  className="mt-4 rounded-2xl border border-dashed border-dark-500 bg-dark-900/30 px-6 py-10 text-center"
                >
                  <p className="text-lg font-medium text-white">明日へ残すTODOはありません</p>
                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    持ち越したいことだけをここに置いておけます。
                  </p>
                </motion.div>
              ) : (
                <motion.ul
                  key="tomorrow-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  className="mt-4 space-y-3"
                >
                  <AnimatePresence initial={false}>
                    {tomorrowTodos.map((todo) => (
                      <motion.li
                        key={todo.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={fadeTransition}
                        className="flex items-center justify-between gap-3 rounded-xl border border-dark-700 bg-dark-800/70 px-4 py-3"
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={todo.checked}
                            onChange={() => handleToggleTomorrowTodo(todo.id)}
                            className="h-4 w-4 accent-sky-400"
                          />
                          <span
                            className={`truncate text-sm ${
                              todo.checked ? 'text-gray-500 line-through' : 'text-gray-200'
                            }`}
                          >
                            {todo.text}
                          </span>
                        </label>
                        <button
                          onClick={() => handleDeleteTomorrowTodo(todo.id)}
                          type="button"
                          className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs text-red-200 transition-colors hover:bg-red-500/20"
                        >
                          削除
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.div>

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

          <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.85, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 rounded-3xl border border-dark-600 bg-dark-800/60 p-6"
          >
            <div className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/70">
                Triage / 未完了TODO一覧
              </h3>
              <p className="mt-2 text-sm text-gray-400">やり忘れをルーティンごとにまとめて確認できます。</p>
            </div>

            <AnimatePresence mode="wait">
              {incompleteGroups.length === 0 ? (
                <motion.div
                  key="triage-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  className="rounded-2xl border border-dashed border-dark-500 bg-dark-900/30 px-6 py-12 text-center"
                >
                  <p className="text-lg font-medium text-white">未完了のTODOはありません</p>
                  <p className="mt-2 text-sm leading-6 text-gray-400">この日の取りこぼしは解消されています。</p>
                </motion.div>
              ) : (
                <motion.div
                  key="triage-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  className="space-y-4"
                >
                  <AnimatePresence initial={false}>
                    {incompleteGroups.map((group) => (
                      <motion.div
                        key={group.noteId}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={fadeTransition}
                        className="rounded-2xl border border-dark-600 bg-dark-900/45 p-5"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-lg font-semibold text-white">{group.title}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                            {group.items.length} incomplete
                          </p>
                        </div>

                        <ul className="space-y-3">
                          {group.items.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-dark-700 bg-dark-800/70 px-4 py-3"
                            >
                              <span className="text-sm text-gray-200">{item.text}</span>
                              <button
                                onClick={() => handleDeleteNoteItem(group.noteId, item.id)}
                                type="button"
                                className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-200 transition-colors hover:bg-amber-500/20"
                              >
                                削除
                              </button>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

      </motion.section>

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
                            onClick={() => handleMoveTemplate(template.id, 'up')}
                            disabled={template.order === 1}
                            type="button"
                            aria-label="上に移動"
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-dark-500 text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 16 16"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3.5 9.5 8 5l4.5 4.5" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveTemplate(template.id, 'down')}
                            disabled={template.order === templates.length}
                            type="button"
                            aria-label="下に移動"
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-dark-500 text-gray-300 transition-colors hover:border-cyan-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 16 16"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3.5 6.5 8 11l4.5-4.5" />
                            </svg>
                          </button>
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

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-center pt-2"
      >
        <button
          onClick={() => setShowDoneSummary(true)}
          type="button"
          className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-6 py-3 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-400/18"
        >
          今日やったこと
        </button>
      </motion.section>

      <AnimatePresence>
        {showDoneSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-dark-900/70 px-4 backdrop-blur-sm"
            onClick={() => setShowDoneSummary(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={fadeTransition}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-400/20 bg-dark-800/95 p-5 shadow-2xl shadow-emerald-950/20"
              onClick={(event) => event.stopPropagation()}
            >
              <CelebrationConfetti />

              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/70">Today</p>
                  <h3 className="mt-2 text-lg font-semibold leading-snug text-white">
                    今日達成したTODOは… {completedCount}件でした！おつかれさまでした 🎉
                  </h3>
                </div>
                <button
                  onClick={() => setShowDoneSummary(false)}
                  type="button"
                  className="shrink-0 whitespace-nowrap rounded-full border border-dark-500 px-3 py-1 text-sm text-gray-300 transition-colors hover:border-dark-400 hover:text-white"
                >
                  閉じる
                </button>
              </div>

              {completedGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-dark-500 bg-dark-900/35 px-5 py-8 text-center">
                  <p className="text-base font-medium text-white">まだ完了したTODOはありません</p>
                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    今日の達成は、これからここに積み上がっていきます。
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-sm text-gray-200">
                  {completedGroups.map((group) => (
                    <div key={group.noteId}>
                      <p className="font-medium text-white">{group.title}</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {group.items.map((item) => (
                          <li key={item.id}>{item.text}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
