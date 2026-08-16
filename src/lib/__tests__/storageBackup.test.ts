import { describe, expect, it, beforeEach } from 'vitest';
import { exportStorage, importStorage } from '../storageBackup';

beforeEach(() => {
  window.localStorage.clear();
});

describe('exportStorage', () => {
  it('localStorageの全キー・値をオブジェクトとして取得できる', () => {
    window.localStorage.setItem('a', '1');
    window.localStorage.setItem('b', '2');

    expect(exportStorage(window.localStorage)).toEqual({ a: '1', b: '2' });
  });

  it('storageが空の場合は空オブジェクトを返す', () => {
    expect(exportStorage(window.localStorage)).toEqual({});
  });
});

describe('importStorage', () => {
  it('指定したキー・値をstorageに書き込み、件数を返す', () => {
    const count = importStorage(window.localStorage, { x: '10', y: '20' });

    expect(count).toBe(2);
    expect(window.localStorage.getItem('x')).toBe('10');
    expect(window.localStorage.getItem('y')).toBe('20');
  });

  it('既存の同名キーは上書きされ、それ以外の既存キーは残る(マージ)', () => {
    window.localStorage.setItem('keep', 'stay');
    window.localStorage.setItem('overwrite', 'old');

    const count = importStorage(window.localStorage, { overwrite: 'new' });

    expect(count).toBe(1);
    expect(window.localStorage.getItem('keep')).toBe('stay');
    expect(window.localStorage.getItem('overwrite')).toBe('new');
  });

  it('不正な入力(非オブジェクト)は例外を投げる', () => {
    expect(() => importStorage(window.localStorage, null as unknown as Record<string, string>)).toThrow();
    expect(() => importStorage(window.localStorage, [] as unknown as Record<string, string>)).toThrow();
    expect(() => importStorage(window.localStorage, 'string' as unknown as Record<string, string>)).toThrow();
    expect(() => importStorage(window.localStorage, 123 as unknown as Record<string, string>)).toThrow();
  });

  it('値が文字列でないキーを含む場合は例外を投げる', () => {
    expect(() =>
      importStorage(window.localStorage, { bad: 1 } as unknown as Record<string, string>)
    ).toThrow();
  });

  it('export結果をimportすると元のstorage内容が復元される(往復の整合性)', () => {
    window.localStorage.setItem('foo', 'bar');
    window.localStorage.setItem('baz', 'qux');

    const exported = exportStorage(window.localStorage);
    window.localStorage.clear();

    const count = importStorage(window.localStorage, exported);

    expect(count).toBe(2);
    expect(exportStorage(window.localStorage)).toEqual(exported);
  });
});
