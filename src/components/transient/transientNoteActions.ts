import { createId, type NoteItem, type TransientNote } from './transientNoteState';

export interface PersistentTodo {
  id: string;
  text: string;
  checked: boolean;
}

export function toggleNoteItem(
  notes: TransientNote[],
  noteId: string,
  itemId: string
): TransientNote[] {
  return notes.map((note) =>
    note.id !== noteId
      ? note
      : {
          ...note,
          items: note.items.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          ),
        }
  );
}

export function changeNoteMemo(
  notes: TransientNote[],
  noteId: string,
  memo: string
): TransientNote[] {
  return notes.map((note) => (note.id === noteId ? { ...note, memo } : note));
}

export function deleteNote(
  notes: TransientNote[],
  deletedTemplateIds: string[],
  noteId: string
): { notes: TransientNote[]; deletedTemplateIds: string[] } {
  const targetNote = notes.find((note) => note.id === noteId);
  const nextDeletedTemplateIds =
    targetNote && !deletedTemplateIds.includes(targetNote.templateId)
      ? [...deletedTemplateIds, targetNote.templateId]
      : deletedTemplateIds;

  return {
    notes: notes.filter((note) => note.id !== noteId),
    deletedTemplateIds: nextDeletedTemplateIds,
  };
}

export function deleteNoteItem(
  notes: TransientNote[],
  noteId: string,
  itemId: string
): TransientNote[] {
  return notes.map((note) =>
    note.id !== noteId
      ? note
      : (() => {
          const targetItem = note.items.find((item) => item.id === itemId);
          if (!targetItem) {
            return note;
          }

          return {
            ...note,
            items: note.items.filter((item) => item.id !== itemId),
            hiddenItems:
              targetItem.source === 'template'
                ? Array.from(new Set([...note.hiddenItems, targetItem.text]))
                : note.hiddenItems,
          };
        })()
  );
}

export function addNoteItem(
  notes: TransientNote[],
  noteId: string,
  text: string
): TransientNote[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return notes;
  }

  const item: NoteItem = {
    id: createId('item'),
    text: trimmed,
    checked: false,
    source: 'extra',
  };

  return notes.map((note) =>
    note.id !== noteId
      ? note
      : {
          ...note,
          items: [...note.items, item],
        }
  );
}

export function createCopyText(notes: TransientNote[]): string {
  const lines = notes.flatMap((note) => [
    `# ${note.title}`,
    ...note.items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`),
    note.memo ? `memo: ${note.memo}` : '',
    '',
  ]);

  return lines.join('\n').trim() || 'No transient notes';
}

export function addPersistentTodo(todos: PersistentTodo[], text: string): PersistentTodo[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return todos;
  }

  return [
    ...todos,
    {
      id: createId('tomorrow-todo'),
      text: trimmed,
      checked: false,
    },
  ];
}

export function togglePersistentTodo(todos: PersistentTodo[], todoId: string): PersistentTodo[] {
  return todos.map((todo) => (todo.id === todoId ? { ...todo, checked: !todo.checked } : todo));
}

export function deletePersistentTodo(todos: PersistentTodo[], todoId: string): PersistentTodo[] {
  return todos.filter((todo) => todo.id !== todoId);
}
