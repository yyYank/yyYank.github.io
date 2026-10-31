import { beforeEach, describe, expect, it } from 'vitest';
import {
  GANBARI_STORAGE_KEY,
  achieveGoal,
  countPoints,
  lastAchievedAt,
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

  it('最後にたっせいした日時より後の記録だけを、ポイントとして数える', () => {
    const records = [
      { id: '1', personId: 'p1', date: '2026-10-01', content: 'そうじ', stamp: '⭐', createdAt: '2026-10-01T00:00:00.000Z', kind: 'otetsudai' as const },
      { id: '2', personId: 'p1', date: '2026-10-11', content: 'そうじ', stamp: '⭐', createdAt: '2026-10-11T00:00:00.000Z', kind: 'otetsudai' as const },
    ];

    expect(countPoints(records, 'p1', 'otetsudai')).toBe(2);
    expect(countPoints(records, 'p1', 'otetsudai', '2026-10-10T00:00:00.000Z')).toBe(1);
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

  it('たっせいのきろくを保存して読み込み直しても、記録と一緒に残る', () => {
    const data = {
      people: [{
        id: 'person-1',
        name: 'ゆう',
        achievedGoals: [{
          kind: 'otetsudai' as const,
          target: 10,
          reason: 'おもちゃ',
          points: 10,
          achievedAt: '2026-10-10T00:00:00.000Z',
        }],
      }],
      records: [
        {
          id: 'record-1',
          personId: 'person-1',
          date: '2026-10-01',
          content: 'そうじ',
          stamp: '⭐',
          createdAt: '2026-10-01T00:00:00.000Z',
          kind: 'otetsudai' as const,
        },
      ],
    };

    saveGanbariData(storage, data);

    expect(loadGanbariData(storage)).toEqual(data);
  });

  it('しゅるいごとに、最後にたっせいした日時を返す', () => {
    const person = {
      id: 'p1',
      name: 'ゆう',
      achievedGoals: [
        { kind: 'otetsudai' as const, target: 5, points: 5, achievedAt: '2026-10-01T00:00:00.000Z' },
        { kind: 'otetsudai' as const, target: 10, points: 10, achievedAt: '2026-10-20T00:00:00.000Z' },
        { kind: 'naraigoto' as const, target: 3, points: 3, achievedAt: '2026-10-05T00:00:00.000Z' },
      ],
    };

    expect(lastAchievedAt(person, 'otetsudai')).toBe('2026-10-20T00:00:00.000Z');
    expect(lastAchievedAt(person, 'naraigoto')).toBe('2026-10-05T00:00:00.000Z');
    expect(lastAchievedAt({ id: 'p2', name: 'あお' }, 'otetsudai')).toBeUndefined();
  });

  it('もくひょうたっせいを記録すると、たっせいのきろくに足して、いまのもくひょうを空にする', () => {
    const person = {
      id: 'p1',
      name: 'ゆう',
      goals: {
        otetsudai: { target: 10, reason: 'おもちゃ' },
        naraigoto: { target: 3 },
      },
    };

    const achieved = achieveGoal(person, 'otetsudai', 12, '2026-10-31T00:00:00.000Z');

    expect(achieved.achievedGoals).toEqual([{
      kind: 'otetsudai',
      target: 10,
      reason: 'おもちゃ',
      points: 12,
      achievedAt: '2026-10-31T00:00:00.000Z',
    }]);
    expect(achieved.goals).toEqual({ naraigoto: { target: 3 } });
  });
});
