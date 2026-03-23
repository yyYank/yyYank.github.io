import { describe, expect, it } from 'vitest';
import {
  normalizeStoredNotes,
  synchronizeNotesWithTemplates,
  type StoredNotes,
  type Template,
  type TransientNote,
} from '../transientNoteState';

describe('transientNoteState', () => {
  const today = '2026-03-23';
  const templates: Template[] = [
    {
      id: 'morning-routine',
      name: '朝のルーティン',
      summary: '外出前の確認',
      items: ['鍵を持った', '財布を持った'],
      order: 1,
    },
  ];

  it('migrates stored items without source to template items', () => {
    const parsed = {
      date: today,
      notes: [
        {
          id: 'note-1',
          templateId: 'morning-routine',
          title: '朝のルーティン',
          createdAt: '2026-03-23T08:00:00.000Z',
          items: [
            { id: 'item-1', text: '鍵を持った', checked: true },
            { id: 'item-2', text: '財布を持った', checked: false },
          ],
          memo: '',
          hiddenItems: [],
        },
      ],
      deletedTemplateIds: [],
    };

    const normalized = normalizeStoredNotes(parsed, today);

    expect(normalized.notes[0].items).toEqual([
      { id: 'item-1', text: '鍵を持った', checked: true, source: 'template' },
      { id: 'item-2', text: '財布を持った', checked: false, source: 'template' },
    ]);
  });

  it('preserves checked template items after synchronization', () => {
    const currentNotes: TransientNote[] = [
      {
        id: 'note-1',
        templateId: 'morning-routine',
        title: '朝のルーティン',
        createdAt: '2026-03-23T08:00:00.000Z',
        items: [
          { id: 'item-1', text: '鍵を持った', checked: true, source: 'template' },
          { id: 'item-2', text: '財布を持った', checked: false, source: 'template' },
        ],
        memo: 'memo',
        hiddenItems: [],
      },
    ];

    const synced = synchronizeNotesWithTemplates(currentNotes, templates, []);

    expect(synced[0].items).toEqual(currentNotes[0].items);
    expect(synced[0].memo).toBe('memo');
  });

  it('keeps extra one-day items when template sync runs', () => {
    const currentNotes: TransientNote[] = [
      {
        id: 'note-1',
        templateId: 'morning-routine',
        title: '朝のルーティン',
        createdAt: '2026-03-23T08:00:00.000Z',
        items: [
          { id: 'item-1', text: '鍵を持った', checked: true, source: 'template' },
          { id: 'item-2', text: '今日だけお迎えする', checked: false, source: 'extra' },
        ],
        memo: '',
        hiddenItems: [],
      },
    ];

    const synced = synchronizeNotesWithTemplates(currentNotes, templates, []);

    expect(synced[0].items.map((item) => item.text)).toEqual([
      '鍵を持った',
      '財布を持った',
      '今日だけお迎えする',
    ]);
    expect(synced[0].items[2].source).toBe('extra');
  });

  it('resets notes when stored date is not today', () => {
    const parsed: StoredNotes = {
      date: '2026-03-22',
      notes: [
        {
          id: 'note-1',
          templateId: 'morning-routine',
          title: '朝のルーティン',
          createdAt: '2026-03-22T08:00:00.000Z',
          items: [{ id: 'item-1', text: '鍵を持った', checked: true, source: 'template' }],
          memo: '',
          hiddenItems: [],
        },
      ],
      deletedTemplateIds: ['morning-routine'],
    };

    expect(normalizeStoredNotes(parsed, today)).toEqual({
      date: today,
      notes: [],
      deletedTemplateIds: [],
    });
  });
});
