import { describe, expect, it } from 'vitest';
import {
  getPeriodKey,
  getPeriodRemainingDays,
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

  // 日付が変わっても週次・月次を残せるよう、ノートは保持しdeletedTemplateIdsのみリセットされることを検証する
  it('keeps notes but resets deletions when stored date is not today', () => {
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

    const result = normalizeStoredNotes(parsed, today);
    expect(result.date).toBe(today);
    expect(result.deletedTemplateIds).toEqual([]);
    expect(result.notes).toHaveLength(1);
    // 旧データにはperiodKeyがないため保存日で補完される
    expect(result.notes[0].periodKey).toBe('2026-03-22');
  });

  // 周期ごとのキー生成を検証する(週は月曜起点、月はYYYY-MM)
  it('generates period keys per cycle', () => {
    const friday = new Date('2026-08-14T12:00:00');
    const sunday = new Date('2026-08-16T12:00:00');
    expect(getPeriodKey('daily', friday)).toBe('2026-08-14');
    expect(getPeriodKey(undefined, friday)).toBe('2026-08-14');
    expect(getPeriodKey('weekly', friday)).toBe('2026-08-10');
    expect(getPeriodKey('weekly', sunday)).toBe('2026-08-10');
    expect(getPeriodKey('monthly', friday)).toBe('2026-08');
  });

  // 残日数計算を検証する(週は日曜まで、月は月末まで、最終日は0)
  it('calculates remaining days until period end', () => {
    const friday = new Date('2026-08-14T12:00:00');
    const sunday = new Date('2026-08-16T12:00:00');
    const monthEnd = new Date('2026-08-31T12:00:00');
    expect(getPeriodRemainingDays('weekly', friday)).toBe(2);
    expect(getPeriodRemainingDays('weekly', sunday)).toBe(0);
    expect(getPeriodRemainingDays('monthly', friday)).toBe(17);
    expect(getPeriodRemainingDays('monthly', monthEnd)).toBe(0);
  });

  // 週次ノートは同一週なら日付が変わってもチェック状態を保持し、翌週に再生成されることを検証する
  it('keeps weekly note within the same week and recreates it next week', () => {
    const weeklyTemplates: Template[] = [
      {
        id: 'weekly-routine',
        name: '毎週のルーティン',
        summary: '今週の確認',
        items: ['今週の振り返りをした'],
        order: 1,
        cycle: 'weekly',
      },
    ];
    const note: TransientNote = {
      id: 'note-w',
      templateId: 'weekly-routine',
      title: '毎週のルーティン',
      createdAt: '2026-08-10T08:00:00.000Z',
      items: [{ id: 'item-w', text: '今週の振り返りをした', checked: true, source: 'template' }],
      memo: '',
      hiddenItems: [],
      periodKey: '2026-08-10',
    };

    const sameWeek = synchronizeNotesWithTemplates([note], weeklyTemplates, [], new Date('2026-08-14T12:00:00'));
    expect(sameWeek[0].id).toBe('note-w');
    expect(sameWeek[0].items[0].checked).toBe(true);

    const nextWeek = synchronizeNotesWithTemplates([note], weeklyTemplates, [], new Date('2026-08-17T12:00:00'));
    expect(nextWeek[0].id).not.toBe('note-w');
    expect(nextWeek[0].items[0].checked).toBe(false);
    expect(nextWeek[0].periodKey).toBe('2026-08-17');
  });
});
