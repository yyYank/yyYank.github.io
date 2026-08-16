/**
 * localStorage全体のバックアップ(export/import)を扱う純関数群。
 * DOMのStorageインターフェースに依存するが、副作用は引数で渡されたstorageに限定する。
 */

/**
 * storage内の全キー・値をプレーンオブジェクトとして取り出す。
 */
export function exportStorage(storage: Storage): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null) continue;
    const value = storage.getItem(key);
    if (value === null) continue;
    result[key] = value;
  }
  return result;
}

/**
 * dataの内容をstorageへ上書きマージする。既存の他キーは変更しない。
 * dataが非オブジェクト(null/配列/プリミティブ)、または値が文字列でないキーを含む場合は例外を投げる。
 * 戻り値はインポートしたキーの件数。
 */
export function importStorage(storage: Storage, data: Record<string, string>): number {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid import data: expected a plain object of string key-value pairs');
  }

  const entries = Object.entries(data);
  for (const [key, value] of entries) {
    if (typeof value !== 'string') {
      throw new Error(`Invalid import data: value for key "${key}" is not a string`);
    }
  }

  for (const [key, value] of entries) {
    storage.setItem(key, value);
  }

  return entries.length;
}
