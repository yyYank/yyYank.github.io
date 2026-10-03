import { beforeEach, describe, expect, it } from 'vitest';
import {
  GANBARI_STORAGE_KEY,
  countPoints,
  loadGanbariData,
  saveGanbariData,
} from '../ganbariData';

describe('ganbariData', () => {
  let storage: Storage;

  beforeEach(() => {
    const values = new Map<string, string>();
    storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => { values.delete(key); },
      setItem: (key, value) => { values.set(key, value); },
    };
  });

  it('旧おてつだいデータを、おてつだいポイントとして移行する', () => {
    const raw = JSON.stringify({
        people: [{ id: 'person-1', name: 'ゆう', goal: 10, goalReason: 'ごほうび' }],
        records: [
          {
            id: 'record-1',
            personId: 'person-1',
            date: '2026-10-01',
            content: 'さらあらい',
            stamp: '⭐',
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
      });
    storage.setItem(GANBARI_STORAGE_KEY, raw);

    const data = loadGanbariData(storage);

    expect(data.records[0]).toMatchObject({ kind: 'otetsudai', content: 'さらあらい' });
    expect(data.people[0].goals?.otetsudai).toEqual({ target: 10, reason: 'ごほうび' });
    expect(data.people[0].goals?.naraigoto).toBeUndefined();
    expect(storage.getItem(GANBARI_STORAGE_KEY)).toBe(raw);
  });

  it('おてつだいと習い事のポイントを別々に集計する', () => {
    const records = [
      { id: '1', personId: 'p1', date: '2026-10-01', content: 'そうじ', stamp: '⭐', createdAt: '', kind: 'otetsudai' as const },
      { id: '2', personId: 'p1', date: '2026-10-01', content: 'ピアノ', stamp: '🎵', createdAt: '', kind: 'naraigoto' as const },
      { id: '3', personId: 'p1', date: '2026-10-02', content: 'すいえい', stamp: '🌊', createdAt: '', kind: 'naraigoto' as const },
      { id: '4', personId: 'p2', date: '2026-10-02', content: 'そうじ', stamp: '💮', createdAt: '', kind: 'otetsudai' as const },
    ];

    expect(countPoints(records, 'p1', 'otetsudai')).toBe(1);
    expect(countPoints(records, 'p1', 'naraigoto')).toBe(2);
  });

  it('既存と同じ保存キーで往復できる', () => {
    const data = {
      people: [{ id: 'person-1', name: 'ゆう' }],
      records: [
        {
          id: 'record-1',
          personId: 'person-1',
          date: '2026-10-01',
          content: 'ピアノ',
          stamp: '🎵',
          createdAt: '2026-10-01T00:00:00.000Z',
          kind: 'naraigoto' as const,
        },
      ],
    };

    saveGanbariData(storage, data);

    expect(storage.getItem(GANBARI_STORAGE_KEY)).not.toBeNull();
    expect(loadGanbariData(storage)).toEqual(data);
  });
});
