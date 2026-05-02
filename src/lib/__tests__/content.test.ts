import { describe, expect, it } from 'vitest';
import { filterTopLevelIndexEntries, findTopLevelIndexEntry, isTopLevelIndexId } from '../content';

describe('isTopLevelIndexId', () => {
  it('returns true for top-level index ids', () => {
    expect(isTopLevelIndexId('index')).toBe(true);
    expect(isTopLevelIndexId('nested/index')).toBe(true);
  });

  it('returns false for normal ids and missing values', () => {
    expect(isTopLevelIndexId('kotlin-install')).toBe(false);
    expect(isTopLevelIndexId(undefined)).toBe(false);
    expect(isTopLevelIndexId(null)).toBe(false);
  });

  it('filters top-level index entries from collections', () => {
    const entries = [
      { id: 'index', title: 'Top' },
      { id: 'kotlin-install', title: 'Install' },
      { id: 'nested/index', title: 'Nested Top' },
      { id: 'when', title: 'When' },
    ];

    expect(filterTopLevelIndexEntries(entries)).toEqual([
      { id: 'kotlin-install', title: 'Install' },
      { id: 'when', title: 'When' },
    ]);
  });

  it('finds the top-level index entry when present', () => {
    const entries = [
      { id: 'kotlin-install' },
      { id: 'index' },
      { id: 'when' },
    ];

    expect(findTopLevelIndexEntry(entries)).toEqual({ id: 'index' });
    expect(findTopLevelIndexEntry([{ id: 'when' }])).toBeUndefined();
  });
});
