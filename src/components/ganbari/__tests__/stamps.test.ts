import { describe, expect, it } from 'vitest';
import { STAMPS, countOwnedStamps } from '../stamps';

describe('ganbari stamps', () => {
  it('重複のないスタンプを100種類用意する', () => {
    expect(STAMPS).toHaveLength(100);
    expect(new Set(STAMPS)).toHaveLength(100);
  });

  it('種類をまたいだ所持数を人物ごとに集計する', () => {
    const records = [
      { id: '1', personId: 'p1', date: '', content: '', stamp: '⭐', createdAt: '', kind: 'otetsudai' as const },
      { id: '2', personId: 'p1', date: '', content: '', stamp: '⭐', createdAt: '', kind: 'naraigoto' as const },
      { id: '3', personId: 'p1', date: '', content: '', stamp: '🎵', createdAt: '', kind: 'naraigoto' as const },
      { id: '4', personId: 'p2', date: '', content: '', stamp: '⭐', createdAt: '', kind: 'otetsudai' as const },
    ];

    expect(countOwnedStamps(records, 'p1')).toEqual({ '⭐': 2, '🎵': 1 });
    expect(countOwnedStamps(records, 'p2')).toEqual({ '⭐': 1 });
  });
});
