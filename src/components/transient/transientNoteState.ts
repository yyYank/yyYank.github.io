export interface Template {
  id: string;
  name: string;
  summary: string;
  items: string[];
  order: number;
}

export interface NoteItem {
  id: string;
  text: string;
  checked: boolean;
  source: 'template' | 'extra';
}

export interface TransientNote {
  id: string;
  templateId: string;
  title: string;
  createdAt: string;
  items: NoteItem[];
  memo: string;
  hiddenItems: string[];
}

export interface StoredNotes {
  date: string;
  notes: TransientNote[];
  deletedTemplateIds: string[];
}

type StoredNoteItem = Partial<NoteItem> & Pick<NoteItem, 'id' | 'text'>;
type StoredTransientNote = Omit<TransientNote, 'items'> & { items?: StoredNoteItem[] };
type StoredNotesPayload = {
  date?: string;
  notes?: StoredTransientNote[];
  deletedTemplateIds?: string[];
};

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeStoredNotes(parsed: StoredNotesPayload, today: string): StoredNotes {
  if (parsed.date !== today) {
    return { date: today, notes: [], deletedTemplateIds: [] };
  }

  return {
    date: parsed.date,
    notes: (parsed.notes ?? []).map((note) => ({
      ...note,
      items: (note.items ?? []).map((item) => ({
        id: item.id,
        text: item.text,
        checked: Boolean(item.checked),
        source: item.source === 'extra' ? 'extra' : 'template',
      })),
      hiddenItems: note.hiddenItems ?? [],
    })),
    deletedTemplateIds: parsed.deletedTemplateIds ?? [],
  };
}

export function createNoteFromTemplate(template: Template): TransientNote {
  return {
    id: createId('note'),
    templateId: template.id,
    title: template.name,
    createdAt: new Date().toISOString(),
    items: template.items.map((item) => ({
      id: createId('item'),
      text: item,
      checked: false,
      source: 'template',
    })),
    memo: '',
    hiddenItems: [],
  };
}

export function synchronizeNotesWithTemplates(
  currentNotes: TransientNote[],
  templates: Template[],
  deletedTemplateIds: string[]
): TransientNote[] {
  return templates
    .filter((template) => !deletedTemplateIds.includes(template.id))
    .map((template) => {
      const existingNote = currentNotes.find((note) => note.templateId === template.id);

      if (!existingNote) {
        return createNoteFromTemplate(template);
      }

      const hiddenItems = existingNote.hiddenItems ?? [];
      const templateItems = template.items
        .filter((itemText) => !hiddenItems.includes(itemText))
        .map((itemText) => {
          const existingItem = existingNote.items.find(
            (item) => item.text === itemText && item.source === 'template'
          );

          return existingItem
            ? { ...existingItem, text: itemText, source: 'template' as const }
            : { id: createId('item'), text: itemText, checked: false, source: 'template' as const };
        });
      const extraItems = existingNote.items.filter((item) => item.source === 'extra');

      return {
        ...existingNote,
        title: template.name,
        hiddenItems,
        items: [...templateItems, ...extraItems],
      };
    });
}
