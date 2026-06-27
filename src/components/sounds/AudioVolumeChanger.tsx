import { useState, useRef } from 'react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from '../../lib/ffmpeg';
import DownloadButton from './DownloadButton';

export default function AudioVolumeChanger() {
  const [file, setFile] = useState<File | null>(null);
  const [volume, setVolume] = useState(1.0);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async () => {
    if (!file) return;
    setLoading(true);
    setOutputBlob(null);
    try {
      setStatus('ffmpegを読み込み中...');
      const ffmpeg = await getFFmpeg();

      setStatus('音量を変更中...');
      await ffmpeg.writeFile('input.mp3', await fetchFile(file));
      await ffmpeg.exec([
        '-i', 'input.mp3',
        '-filter:a', `volume=${volume}`,
        '-codec:a', 'libmp3lame', '-b:a', '192k',
        'output.mp3',
      ]);
      const data = await ffmpeg.readFile('output.mp3');
      setOutputBlob(new Blob([data], { type: 'audio/mpeg' }));
      setStatus('変換完了');
    } catch (e) {
      setStatus(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <span className="w-6 h-0.5 bg-accent-cyan" />
        Volume
      </h2>
      <p className="text-gray-400 text-sm">mp3 の音量調整</p>

      <div>
        <label className="block text-sm text-gray-400 mb-2">File Upload</label>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setOutputBlob(null);
            setStatus('');
          }}
          className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-dark-700 file:text-gray-200 hover:file:bg-dark-600 cursor-pointer"
        />
        {file && <p className="mt-1 text-xs text-gray-500">{file.name}</p>}
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">
          音量: {volume.toFixed(1)}x
        </label>
        <input
          type="range"
          min="0.1"
          max="3.0"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-full accent-accent-purple"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0.1x</span>
          <span>1.0x</span>
          <span>3.0x</span>
        </div>
      </div>

      <button
        onClick={handleChange}
        disabled={!file || loading}
        className="w-full py-2 px-4 bg-accent-purple text-white font-semibold rounded-lg hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '処理中...' : 'Change Volume'}
      </button>

      {status && (
        <p className="text-sm text-gray-400">{status}</p>
      )}

      {outputBlob && (
        <DownloadButton blob={outputBlob} filename="output.mp3" />
      )}
    </div>
  );
}
