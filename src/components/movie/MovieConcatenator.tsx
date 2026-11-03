import { useEffect, useState } from 'react';
import { getFFmpeg } from '../../lib/ffmpeg';
import DownloadButton from '../sounds/DownloadButton';
import {
  buildConcatArgs,
  buildConcatList,
  buildClipArgs,
  canStreamCopy,
  chooseReference,
  fileProgress,
  isPassthrough,
  moveItem,
  OUTPUT_SIZES,
  parseProbeLog,
  parseProgressTime,
  type VideoInfo,
} from './movieConcatUtils';
import { readFileBytes, readOutputBlob, writeInputFile } from './movieExport';

type ConcatItem = { file: File; data: Uint8Array };
type FFmpegInstance = Awaited<ReturnType<typeof getFFmpeg>>;

async function probeVideo(ffmpeg: FFmpegInstance, inputName: string): Promise<VideoInfo> {
  const lines: string[] = [];
  const onLog = ({ message }: { message: string }) => lines.push(message);
  ffmpeg.on('log', onLog);
  try {
    // 出力先を指定しないので終了コードは0以外になるが、ログに動画の情報が出る
    await ffmpeg.exec(['-hide_banner', '-i', inputName]);
  } finally {
    ffmpeg.off('log', onLog);
  }
  return parseProbeLog(lines.join('\n'));
}

export default function MovieConcatenator() {
  const [items, setItems] = useState<ConcatItem[]>([]);
  const [outputSizeLabel, setOutputSizeLabel] = useState(OUTPUT_SIZES[0].label);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputFilename, setOutputFilename] = useState('output.mp4');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number[] | null>(null);

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

  const updateItems = (next: ConcatItem[]) => {
    setItems(next);
    setProgress(null);
    setOutputBlob(null);
    setStatus('');
    setErrorMessage('');
  };

  const addFiles = async (selected: File[]) => {
    try {
      const added = await Promise.all(selected.map(async (file) => ({ file, data: await readFileBytes(file) })));
      updateItems([...items, ...added]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(`エラー: ${message}`);
    }
  };

  const handleConcat = async () => {
    if (items.length < 2) return;

    setLoading(true);
    setErrorMessage('');
    setOutputBlob(null);
    setProgress(null);

    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inputNames = items.map((_, i) => `concat-input-${token}-${i}.mp4`);
    const clipNames = items.map((_, i) => `concat-clip-${token}-${i}.mp4`);
    const listName = `concat-list-${token}.txt`;
    const outputName = `concat-${token}.mp4`;
    let ffmpeg: FFmpegInstance | null = null;

    try {
      setStatus('ffmpegを読み込み中...');
      ffmpeg = await getFFmpeg();
      const baseName = items[0].file.name.replace(/\.[^.]+$/, '');

      setStatus(`${items.length} 本の MP4 を連結中...`);
      for (let i = 0; i < items.length; i++) {
        await writeInputFile(ffmpeg, inputNames[i], items[i].data.slice());
      }
      const infos: VideoInfo[] = [];
      for (const name of inputNames) {
        infos.push(await probeVideo(ffmpeg, name));
      }

      const durations = infos.map((info) => info.duration);
      const runWithProgress = async (args: string[], onElapsed: (elapsed: number) => void) => {
        const onProgressLog = ({ message }: { message: string }) => {
          const elapsed = parseProgressTime(message);
          if (elapsed !== null) onElapsed(elapsed);
        };
        ffmpeg!.on('log', onProgressLog);
        try {
          return await ffmpeg!.exec(args);
        } finally {
          ffmpeg!.off('log', onProgressLog);
        }
      };
      const assertSucceeded = (exitCode: number) => {
        if (exitCode !== 0) {
          throw new Error(`ffmpeg が失敗しました（終了コード ${exitCode}）`);
        }
      };
      const setFileProgress = (index: number, ratio: number) =>
        setProgress((prev) => prev && prev.map((value, i) => (i === index ? ratio : value)));

      setProgress(fileProgress(0, durations));
      if (canStreamCopy(infos)) {
        await ffmpeg.writeFile(listName, buildConcatList(inputNames));
        assertSucceeded(
          await runWithProgress(buildConcatArgs(listName, outputName), (elapsed) =>
            setProgress(fileProgress(elapsed, durations))
          )
        );
      } else {
        // 出力サイズに合っている動画はそのまま使い、合わない動画だけ作り直してから、エンコードせずにつなぐ
        const outputSize = OUTPUT_SIZES.find((size) => size.label === outputSizeLabel) ?? OUTPUT_SIZES[0];
        const reference = chooseReference(infos, outputSize);
        const segments: string[] = [];
        for (let i = 0; i < items.length; i++) {
          if (isPassthrough(infos[i], outputSize, reference)) {
            segments.push(inputNames[i]);
            setFileProgress(i, 1);
            continue;
          }
          setStatus(`${i + 1}/${items.length} 本目を ${outputSize.label} に合わせて作り直し中...`);
          assertSucceeded(
            await runWithProgress(buildClipArgs(inputNames[i], infos[i], outputSize, reference, clipNames[i]), (elapsed) =>
              setFileProgress(i, durations[i] > 0 ? Math.min(elapsed / durations[i], 1) : 1)
            )
          );
          segments.push(clipNames[i]);
          setFileProgress(i, 1);
        }
        setStatus(`${items.length} 本の MP4 をつないでいます...`);
        await ffmpeg.writeFile(listName, buildConcatList(segments));
        const joinArgs = buildConcatArgs(listName, outputName);
        if (reference.videoCodec === 'hevc') joinArgs.splice(-1, 0, '-tag:v', 'hvc1');
        assertSucceeded(await ffmpeg.exec(joinArgs));
      }

      const blob = await readOutputBlob(ffmpeg, outputName, 'video/mp4');
      if (blob.size === 0) {
        throw new Error('連結結果が空でした');
      }

      setProgress(durations.map(() => 1));
      setOutputBlob(blob);
      setOutputFilename(`${baseName}_concat.mp4`);
      setStatus('連結完了');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus('');
      setErrorMessage(`エラー: ${message}`);
    } finally {
      if (ffmpeg) {
        for (const name of [...inputNames, ...clipNames, listName, outputName]) {
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
            void addFiles(Array.from(event.target.files ?? []));
          }}
          className="block w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-surface-2 file:text-text hover:file:bg-surface-2 cursor-pointer"
        />
      </div>

      {items.length > 0 && (
        <ol className="space-y-1">
          {items.map(({ file }, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-sm text-muted">
              <span className="w-6 text-faint">{i + 1}.</span>
              <span className="flex-1 truncate">{file.name}</span>
              {progress && progress[i] !== undefined && (
                <span className="text-xs text-faint">
                  {progress[i] >= 1 ? '完了' : progress[i] > 0 ? `処理中 ${Math.floor(progress[i] * 100)}%` : '待機中'}
                </span>
              )}
              <button
                onClick={() => updateItems(moveItem(items, i, -1))}
                disabled={i === 0 || loading}
                aria-label={`${file.name} を上へ`}
                className="px-2 py-0.5 rounded bg-surface-2 text-text disabled:opacity-40"
              >
                ↑
              </button>
              <button
                onClick={() => updateItems(moveItem(items, i, 1))}
                disabled={i === items.length - 1 || loading}
                aria-label={`${file.name} を下へ`}
                className="px-2 py-0.5 rounded bg-surface-2 text-text disabled:opacity-40"
              >
                ↓
              </button>
              <button
                onClick={() => updateItems(items.filter((_, j) => j !== i))}
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

      <div>
        <label htmlFor="concat-output-size" className="block text-sm text-muted mb-2">
          出力サイズ
        </label>
        <select
          id="concat-output-size"
          value={outputSizeLabel}
          onChange={(event) => {
            setOutputSizeLabel(event.target.value);
            setOutputBlob(null);
          }}
          disabled={loading}
          className="w-full rounded-lg bg-surface-2 text-text text-sm px-3 py-2"
        >
          {OUTPUT_SIZES.map((size) => (
            <option key={size.label} value={size.label}>
              {`${size.label} (${size.width}×${size.height})`}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => void handleConcat()}
        disabled={items.length < 2 || loading}
        className="w-full py-2 px-4 bg-accent-purple text-text font-semibold rounded-lg hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '処理中...' : 'Concat'}
      </button>
      <p className="text-xs text-faint">
        すべての動画が同じ形式なら、再エンコードせず元の動画のままつなげます。縦と横が混ざるなど形式が違うときは、出力サイズに合わない動画だけを、縦横そのまま収めて作り直します（余白は黒、コーデックと fps は元のまま、音声はそのまま）。
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
