import { useEffect, useState } from 'react';
import { getFFmpeg } from '../../lib/ffmpeg';
import DownloadButton from '../sounds/DownloadButton';
import { buildConcatArgs, buildConcatList, moveItem } from './movieConcatUtils';
import { readFileBytes, readOutputBlob, writeInputFile } from './movieExport';

export default function MovieConcatenator() {
  const [files, setFiles] = useState<File[]>([]);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputFilename, setOutputFilename] = useState('output.mp4');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    void getFFmpeg();
  }, []);

  useEffect(() => {
    if (!outputBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(outputBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [outputBlob]);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [loading]);

  const updateFiles = (next: File[]) => {
    setFiles(next);
    setOutputBlob(null);
    setStatus('');
    setErrorMessage('');
  };

  const handleConcat = async () => {
    if (files.length < 2) return;

    setLoading(true);
    setErrorMessage('');
    setOutputBlob(null);

    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inputNames = files.map((_, i) => `concat-input-${token}-${i}.mp4`);
    const listName = `concat-list-${token}.txt`;
    const outputName = `concat-${token}.mp4`;
    let ffmpeg: Awaited<ReturnType<typeof getFFmpeg>> | null = null;

    try {
      setStatus('ffmpegを読み込み中...');
      ffmpeg = await getFFmpeg();
      const baseName = files[0].name.replace(/\.[^.]+$/, '');

      setStatus(`${files.length} 本の MP4 を連結中...`);
      for (let i = 0; i < files.length; i++) {
        await writeInputFile(ffmpeg, inputNames[i], await readFileBytes(files[i]));
      }
      await ffmpeg.writeFile(listName, buildConcatList(inputNames));

      const exitCode = await ffmpeg.exec(buildConcatArgs(listName, outputName));
      if (exitCode !== 0) {
        throw new Error(`ffmpeg が失敗しました（終了コード ${exitCode}）`);
      }

      const blob = await readOutputBlob(ffmpeg, outputName, 'video/mp4');
      if (blob.size === 0) {
        throw new Error('連結結果が空でした');
      }

      setOutputBlob(blob);
      setOutputFilename(`${baseName}_concat.mp4`);
      setStatus('連結完了');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus('');
      setErrorMessage(`エラー: ${message}`);
    } finally {
      if (ffmpeg) {
        for (const name of [...inputNames, listName, outputName]) {
          await ffmpeg.deleteFile(name).catch(() => undefined);
        }
      }
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-text flex items-center gap-2">
        <span className="w-6 h-0.5 bg-accent-cyan" />
        MP4 Concat
      </h2>
      <p className="text-muted text-sm">複数の mp4 → 1本の mp4（上から順に連結）</p>

      <div>
        <label htmlFor="concat-upload" className="block text-sm text-muted mb-2">
          MP4 Files
        </label>
        <input
          id="concat-upload"
          type="file"
          accept=".mp4,video/mp4"
          multiple
          onChange={(event) => {
            updateFiles([...files, ...Array.from(event.target.files ?? [])]);
            event.target.value = '';
          }}
          className="block w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-surface-2 file:text-text hover:file:bg-surface-2 cursor-pointer"
        />
      </div>

      {files.length > 0 && (
        <ol className="space-y-1">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-sm text-muted">
              <span className="w-6 text-faint">{i + 1}.</span>
              <span className="flex-1 truncate">{file.name}</span>
              <button
                onClick={() => updateFiles(moveItem(files, i, -1))}
                disabled={i === 0 || loading}
                aria-label={`${file.name} を上へ`}
                className="px-2 py-0.5 rounded bg-surface-2 text-text disabled:opacity-40"
              >
                ↑
              </button>
              <button
                onClick={() => updateFiles(moveItem(files, i, 1))}
                disabled={i === files.length - 1 || loading}
                aria-label={`${file.name} を下へ`}
                className="px-2 py-0.5 rounded bg-surface-2 text-text disabled:opacity-40"
              >
                ↓
              </button>
              <button
                onClick={() => updateFiles(files.filter((_, j) => j !== i))}
                disabled={loading}
                aria-label={`${file.name} を削除`}
                className="px-2 py-0.5 rounded bg-surface-2 text-text disabled:opacity-40"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={() => void handleConcat()}
        disabled={files.length < 2 || loading}
        className="w-full py-2 px-4 bg-accent-purple text-text font-semibold rounded-lg hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '処理中...' : 'Concat'}
      </button>
      <p className="text-xs text-faint">
        再エンコードせず、元の動画のままつなげます。1本目に音声がない場合、連結後の動画は音声なしになります。
      </p>

      {status && (
        <p className="text-sm text-muted">
          {status}
          {loading && <span className="ml-2 text-faint">（経過 {elapsedSeconds}秒）</span>}
        </p>
      )}
      {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

      {previewUrl && (
        <video
          src={previewUrl}
          controls
          aria-label="連結結果のプレビュー"
          className="w-full rounded-lg bg-black"
        />
      )}
      {outputBlob && <DownloadButton blob={outputBlob} filename={outputFilename} />}
    </div>
  );
}
