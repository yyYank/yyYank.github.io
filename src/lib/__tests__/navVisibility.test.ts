import { describe, expect, it, beforeEach } from 'vitest';
import {
  NAV_VISIBILITY_KEY,
  loadHiddenNav,
  saveHiddenNav,
  toggleHiddenNav,
} from '../navVisibility';

describe('navVisibility', () => {
  beforeEach(() => localStorage.clear());

  // 未設定なら空配列を返すことを検証する
  it('returns empty list when nothing is stored', () => {
    expect(loadHiddenNav(localStorage)).toEqual([]);
  });

  // 保存→読込の往復で同じ内容になることを検証する
  it('round-trips hidden hrefs', () => {
    saveHiddenNav(localStorage, ['/feeds/', '/diary/']);
    expect(loadHiddenNav(localStorage)).toEqual(['/feeds/', '/diary/']);
  });

  // 壊れたJSONや配列以外は空配列として扱うことを検証する
  it('falls back to empty list on corrupted data', () => {
    localStorage.setItem(NAV_VISIBILITY_KEY, '{broken');
    expect(loadHiddenNav(localStorage)).toEqual([]);
    localStorage.setItem(NAV_VISIBILITY_KEY, '{"a":1}');
    expect(loadHiddenNav(localStorage)).toEqual([]);
  });

  // トグルで追加・削除が切り替わることを検証する
  it('toggles a href in and out', () => {
    const once = toggleHiddenNav([], '/feeds/');
    expect(once).toEqual(['/feeds/']);
    expect(toggleHiddenNav(once, '/feeds/')).toEqual([]);
  });
});
