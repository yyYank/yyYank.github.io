import { useEffect, useState } from 'react';
import { getFFmpeg } from '../../lib/ffmpeg';
import DownloadButton from '../sounds/DownloadButton';
import { encodeToMp4, readFileBytes, readOutputBlob, writeInputFile } from './movieExport';

export default function MovToMp4Converter() {
  const [file, setFile] = useState<File | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputFilename, setOutputFilename] = useState('output.mp4');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    void getFFmpeg();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [loading]);

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setErrorMessage('');
    setOutputBlob(null);

    try {
      setStatus('ffmpegを読み込み中...');
      const ffmpeg = await getFFmpeg();
      const inputName = 'input.mov';
      const outputName = 'output.mp4';
      const baseName = file.name.replace(/\.[^.]+$/, '');

      setStatus('MOV を MP4 に変換中...');
      await writeInputFile(ffmpeg, inputName, await readFileBytes(file));
      await encodeToMp4(ffmpeg, inputName, outputName);

      setOutputBlob(await readOutputBlob(ffmpeg, outputName, 'video/mp4'));
      setOutputFilename(`${baseName}.mp4`);
      setStatus('変換完了');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus('');
      setErrorMessage(`エラー: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-text flex items-center gap-2">
        <span className="w-6 h-0.5 bg-accent-cyan" />
        MOV to MP4
      </h2>
      <p className="text-muted text-sm">mov → mp4</p>

      <div>
        <label htmlFor="mov-upload" className="block text-sm text-muted mb-2">
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
            setErrorMessage('');
          }}
          className="block w-full text-sm text-muted file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-surface-2 file:text-text hover:file:bg-surface-2 cursor-pointer"
        />
        {file && <p className="mt-1 text-xs text-faint">{file.name}</p>}
      </div>

      <button
        onClick={() => void handleConvert()}
        disabled={!file || loading}
        className="w-full py-2 px-4 bg-accent-purple text-text font-semibold rounded-lg hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '処理中...' : 'Convert to MP4'}
      </button>
      <p className="text-xs text-faint">
        エンコードは数分〜十分程度時間がかかることがあります。
      </p>

      {status && (
        <p className="text-sm text-muted">
          {status}
          {loading && <span className="ml-2 text-faint">（経過 {elapsedSeconds}秒）</span>}
        </p>
      )}
      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

      {outputBlob && <DownloadButton blob={outputBlob} filename={outputFilename} />}
    </div>
  );
}
