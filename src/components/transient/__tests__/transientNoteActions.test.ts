import { describe, expect, it } from 'vitest';
import {
  addNoteItem,
  addPersistentTodo,
  createCopyText,
  deleteNote,
  deleteNoteItem,
  deletePersistentTodo,
  toggleNoteItem,
  togglePersistentTodo,
} from '../transientNoteActions';
import type { TransientNote } from '../transientNoteState';

describe('transientNoteActions', () => {
  const notes: TransientNote[] = [
    {
      id: 'note-1',
      templateId: 'morning',
      title: '朝',
      createdAt: '2026-03-23T08:00:00.000Z',
      memo: 'memo',
      hiddenItems: [],
      items: [
        { id: 'item-1', text: '鍵', checked: false, source: 'template' },
        { id: 'item-2', text: '迎え', checked: false, source: 'extra' },
      ],
    },
  ];

  it('toggles a note item', () => {
    expect(toggleNoteItem(notes, 'note-1', 'item-1')[0].items[0].checked).toBe(true);
  });

  it('deletes template item and stores it in hiddenItems', () => {
    const updated = deleteNoteItem(notes, 'note-1', 'item-1');
    expect(updated[0].items.map((item) => item.id)).toEqual(['item-2']);
    expect(updated[0].hiddenItems).toEqual(['鍵']);
  });

  it('deletes extra item without changing hiddenItems', () => {
    const updated = deleteNoteItem(notes, 'note-1', 'item-2');
    expect(updated[0].items.map((item) => item.id)).toEqual(['item-1']);
    expect(updated[0].hiddenItems).toEqual([]);
  });

  it('adds a one-day extra item', () => {
    const updated = addNoteItem(notes, 'note-1', '今日だけ手伝う');
    expect(updated[0].items.at(-1)).toMatchObject({
      text: '今日だけ手伝う',
      checked: false,
      source: 'extra',
    });
  });

  it('deletes a note and returns deleted template ids', () => {
    expect(deleteNote(notes, [], 'note-1')).toEqual({
      notes: [],
      deletedTemplateIds: ['morning'],
    });
  });

  it('creates copy text for notes', () => {
    expect(createCopyText(notes)).toContain('# 朝');
    expect(createCopyText(notes)).toContain('- [ ] 鍵');
    expect(createCopyText(notes)).toContain('memo: memo');
  });

  it('adds, toggles, and deletes persistent todos', () => {
    const added = addPersistentTodo([], '持ち越し');
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ text: '持ち越し', checked: false });

    const toggled = togglePersistentTodo(added, added[0].id);
    expect(toggled[0].checked).toBe(true);

    expect(deletePersistentTodo(toggled, added[0].id)).toEqual([]);
  });
});
