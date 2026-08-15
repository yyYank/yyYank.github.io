export type Cycle = 'daily' | 'weekly' | 'monthly';

export interface Template {
  id: string;
  name: string;
  summary: string;
  items: string[];
  order: number;
  cycle?: Cycle;
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
  periodKey?: string;
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

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPeriodKey(cycle: Cycle | undefined, now: Date): string {
  if (cycle === 'weekly') {
    const monday = new Date(now);
    const offset = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - offset);
    return formatDateKey(monday);
  }
  if (cycle === 'monthly') {
    return formatDateKey(now).slice(0, 7);
  }
  return formatDateKey(now);
}

export function getPeriodRemainingDays(cycle: Cycle | undefined, now: Date): number {
  if (cycle === 'weekly') {
    return 6 - ((now.getDay() + 6) % 7);
  }
  if (cycle === 'monthly') {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate();
  }
  return 0;
}

export function normalizeStoredNotes(parsed: StoredNotesPayload, today: string): StoredNotes {
  const isSameDay = parsed.date === today;

  return {
    date: today,
    notes: (parsed.notes ?? []).map((note) => ({
      ...note,
      items: (note.items ?? []).map((item) => ({
        id: item.id,
        text: item.text,
        checked: Boolean(item.checked),
        source: item.source === 'extra' ? 'extra' : 'template',
      })),
      hiddenItems: note.hiddenItems ?? [],
      periodKey: note.periodKey ?? parsed.date,
    })),
    deletedTemplateIds: isSameDay ? parsed.deletedTemplateIds ?? [] : [],
  };
}

export function createNoteFromTemplate(template: Template, now: Date = new Date()): TransientNote {
  return {
    id: createId('note'),
    templateId: template.id,
    title: template.name,
    createdAt: now.toISOString(),
    periodKey: getPeriodKey(template.cycle, now),
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
  deletedTemplateIds: string[],
  now: Date = new Date()
): TransientNote[] {
  return templates
    .filter((template) => !deletedTemplateIds.includes(template.id))
    .map((template) => {
      const existingNote = currentNotes.find((note) => note.templateId === template.id);
      const currentPeriodKey = getPeriodKey(template.cycle, now);

      if (
        !existingNote ||
        (existingNote.periodKey !== undefined && existingNote.periodKey !== currentPeriodKey)
      ) {
        return createNoteFromTemplate(template, now);
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
        periodKey: existingNote.periodKey ?? currentPeriodKey,
        items: [...templateItems, ...extraItems],
      };
    });
}
