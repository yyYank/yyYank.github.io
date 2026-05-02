import { useState } from 'react';
import { getFFmpeg } from '../../lib/ffmpeg';
import DownloadButton from '../sounds/DownloadButton';
import { encodeToMp4, readFileBytes, readOutputBlob, writeInputFile } from './movieExport';

export default function MovToMp4Converter() {
  const [file, setFile] = useState<File | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputFilename, setOutputFilename] = useState('output.mp4');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setOutputBlob(null);

    try {
      setStatus('ffmpegを読み込み中...');
      const ffmpeg = await getFFmpeg();
      const inputName = 'input.mov';
      const outputName = 'output.mp4';
      const baseName = file.name.replace(/\.[^.]+$/, '');

      setStatus('MOV を MP4 に変換中... 0%');
      await writeInputFile(ffmpeg, inputName, await readFileBytes(file));
      await encodeToMp4(ffmpeg, inputName, outputName, null, undefined, (ratio) => {
        const clamped = Math.max(0, Math.min(1, ratio));
        setStatus(`MOV を MP4 に変換中... ${Math.round(clamped * 100)}%`);
      });

      setOutputBlob(await readOutputBlob(ffmpeg, outputName, 'video/mp4'));
      setOutputFilename(`${baseName}.mp4`);
      setStatus('変換完了');
    } catch (error) {
      setStatus(`エラー: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <span className="w-6 h-0.5 bg-accent-cyan" />
        MOV to MP4
      </h2>
      <p className="text-gray-400 text-sm">mov → mp4</p>

      <div>
        <label htmlFor="mov-upload" className="block text-sm text-gray-400 mb-2">
          File Upload
        </label>
        <input
          id="mov-upload"
          type="file"
          accept=".mov,video/quicktime"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setOutputBlob(null);
            setStatus('');
          }}
          className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-dark-700 file:text-gray-200 hover:file:bg-dark-600 cursor-pointer"
        />
        {file && <p className="mt-1 text-xs text-gray-500">{file.name}</p>}
      </div>

      <button
        onClick={() => void handleConvert()}
        disabled={!file || loading}
        className="w-full py-2 px-4 bg-accent-purple text-white font-semibold rounded-lg hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '処理中...' : 'Convert to MP4'}
      </button>

      {status && <p className="text-sm text-gray-400">{status}</p>}

      {outputBlob && <DownloadButton blob={outputBlob} filename={outputFilename} />}
    </div>
  );
}
