import { useCallback, useRef, useState } from 'react';
import { exportStorage, importStorage } from '../../lib/storageBackup';

function formatDateForFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type ImportState =
  | { step: 'idle' }
  | { step: 'error'; message: string }
  | { step: 'confirm'; data: Record<string, string>; keyCount: number }
  | { step: 'done'; keyCount: number };

export default function StorageBackup() {
  const [importState, setImportState] = useState<ImportState>({ step: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const data = exportStorage(window.localStorage);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `yyyank-backup-${formatDateForFilename(new Date())}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const parsed = JSON.parse(text);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setImportState({ step: 'error', message: '不正な形式です。オブジェクト形式のJSONファイルを選択してください。' });
          return;
        }
        const keyCount = Object.keys(parsed).length;
        setImportState({ step: 'confirm', data: parsed as Record<string, string>, keyCount });
      } catch {
        setImportState({ step: 'error', message: 'JSONの読み込みに失敗しました。ファイルの内容を確認してください。' });
      }
    };
    reader.onerror = () => {
      setImportState({ step: 'error', message: 'ファイルの読み込みに失敗しました。' });
    };
    reader.readAsText(file);
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (importState.step !== 'confirm') return;
    try {
      const count = importStorage(window.localStorage, importState.data);
      setImportState({ step: 'done', keyCount: count });
    } catch (err) {
      setImportState({
        step: 'error',
        message: err instanceof Error ? err.message : 'インポートに失敗しました。',
      });
    }
  }, [importState]);

  const handleReset = useCallback(() => {
    setImportState({ step: 'idle' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="space-y-6">
      {/* Export */}
      <div className="bg-dark-700 border border-dark-600 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Export</h2>
        <p className="text-sm text-gray-400 mb-4">
          現在のlocalStorageの内容をすべてJSONファイルとしてダウンロードします。
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="px-6 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg text-sm font-medium hover:bg-accent-cyan/30 transition-colors"
        >
          ダウンロード
        </button>
      </div>

      {/* Import */}
      <div className="bg-dark-700 border border-dark-600 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Import</h2>
        <p className="text-sm text-gray-400 mb-4">
          JSONファイルを選択してlocalStorageに反映します。既存の同名キーは上書きされ、それ以外のキーは残ります。
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-dark-500 file:bg-dark-800 file:text-gray-200 file:text-sm file:font-medium hover:file:border-accent-cyan/50 file:cursor-pointer cursor-pointer"
        />

        {importState.step === 'error' && (
          <div className="mt-4 bg-red-950/40 border border-red-800/60 rounded-lg p-4 text-sm text-red-300">
            {importState.message}
          </div>
        )}

        {importState.step === 'confirm' && (
          <div className="mt-4 bg-dark-800 border border-dark-500 rounded-lg p-4">
            <p className="text-sm text-gray-300 mb-4">
              <span className="font-mono text-accent-cyan">{importState.keyCount}</span> 件のキーが見つかりました。インポートを実行しますか？
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-6 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg text-sm font-medium hover:bg-accent-cyan/30 transition-colors"
              >
                実行する
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2 bg-dark-700 text-gray-400 border border-dark-600 rounded-lg text-sm font-medium hover:text-gray-200 hover:border-dark-500 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {importState.step === 'done' && (
          <div className="mt-4 bg-green-950/30 border border-green-800/50 rounded-lg p-4 text-sm text-green-300">
            <span className="font-mono">{importState.keyCount}</span> 件のキーをインポートしました。
          </div>
        )}
      </div>
    </div>
  );
}
