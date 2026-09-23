import { useState } from 'react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from '../../lib/ffmpeg';
import DownloadButton from './DownloadButton';

export default function AudioMerger() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleMerge = async () => {
    if (!fileA || !fileB) return;
    setLoading(true);
    setOutputBlob(null);
    try {
      setStatus('ffmpegを読み込み中...');
      const ffmpeg = await getFFmpeg();

      setStatus('ファイルを連結中...');
      await ffmpeg.writeFile('a.mp3', await fetchFile(fileA));
      await ffmpeg.writeFile('b.mp3', await fetchFile(fileB));
      await ffmpeg.exec([
        '-i', 'a.mp3',
        '-i', 'b.mp3',
        '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[out]',
        '-map', '[out]',
        '-codec:a', 'libmp3lame',
        '-b:a', '192k',
        'merged.mp3',
      ]);
      const data = await ffmpeg.readFile('merged.mp3');
      setOutputBlob(new Blob([data], { type: 'audio/mpeg' }));
      setStatus('連結完了');
    } catch (e) {
      setStatus(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-text flex items-center gap-2">
        <span className="w-6 h-0.5 bg-accent-purple" />
        Merge
      </h2>
      <p className="text-muted text-sm">mp3 + mp3 → mp3</p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-2">File A</label>
          <input
            type="file"
            accept=".mp3,audio/mpeg"
            onChange={(e) => {
              setFileA(e.target.files?.[0] ?? null);
              setOutputBlob(null);
              setStatus('');
            }}
            className="block w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-surface-2 file:text-text hover:file:bg-surface-2 cursor-pointer"
          />
          {fileA && <p className="mt-1 text-xs text-faint">{fileA.name}</p>}
        </div>

        <div>
          <label className="block text-sm text-muted mb-2">File B</label>
          <input
            type="file"
            accept=".mp3,audio/mpeg"
            onChange={(e) => {
              setFileB(e.target.files?.[0] ?? null);
              setOutputBlob(null);
              setStatus('');
            }}
            className="block w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-surface-2 file:text-text hover:file:bg-surface-2 cursor-pointer"
          />
          {fileB && <p className="mt-1 text-xs text-faint">{fileB.name}</p>}
        </div>
      </div>

      <button
        onClick={handleMerge}
        disabled={!fileA || !fileB || loading}
        className="w-full py-2 px-4 bg-accent-purple text-text font-semibold rounded-lg hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '処理中...' : 'Merge MP3'}
      </button>

      {status && (
        <p className="text-sm text-muted">{status}</p>
      )}

      {outputBlob && (
        <DownloadButton blob={outputBlob} filename="merged.mp3" />
      )}
    </div>
  );
}
