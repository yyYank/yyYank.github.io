import { useEffect, useRef, useState } from 'react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from '../../lib/ffmpeg';
import DownloadButton from './DownloadButton';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  data: Float32Array,
  startRatio: number,
  endRatio: number,
  playheadRatio: number | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const amp = height / 2;
  const step = Math.max(1, Math.floor(data.length / width));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  const sx = startRatio * width;
  const ex = endRatio * width;
  ctx.fillStyle = 'rgba(0,188,212,0.08)';
  ctx.fillRect(sx, 0, ex - sx, height);

  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;

    for (let j = 0; j < step; j++) {
      const v = data[i * step + j] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const ratio = i / width;
    ctx.fillStyle = ratio >= startRatio && ratio <= endRatio ? '#00bcd4' : '#334155';
    const y = (1 + min) * amp;
    const h = Math.max(1, (max - min) * amp);
    ctx.fillRect(i, y, 1, h);
  }

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  [sx, ex].forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  });

  if (playheadRatio !== null) {
    const px = playheadRatio * width;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();
  }

  const handleSize = 12;
  ctx.fillStyle = '#ffffff';

  ctx.beginPath();
  ctx.moveTo(sx, 0);
  ctx.lineTo(sx + handleSize, 0);
  ctx.lineTo(sx, handleSize);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(ex, 0);
  ctx.lineTo(ex - handleSize, 0);
  ctx.lineTo(ex, handleSize);
  ctx.fill();
}

export default function AudioTrimmer() {
  const [file, setFile] = useState<File | null>(null);
  const [waveData, setWaveData] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSelection, setLoopSelection] = useState(true);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const draggingRef = useRef<'start' | 'end' | null>(null);

  const syncCurrentTime = (nextTime: number) => {
    setCurrentTime(nextTime);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = nextTime;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setOutputBlob(null);
    setStatus('波形を解析中...');
    setCurrentTime(0);
    setIsPlaying(false);

    try {
      const arrayBuffer = await f.arrayBuffer();
      const audioCtx = new AudioContext();
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);
      const nextAudioUrl = URL.createObjectURL(f);

      setWaveData(buffer.getChannelData(0));
      setDuration(buffer.duration);
      setStartTime(0);
      setEndTime(buffer.duration);
      setAudioUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return nextAudioUrl;
      });
      setStatus('');
      await audioCtx.close();
    } catch {
      setStatus('音声ファイルの読み込みに失敗しました');
    }
  };

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveData || duration === 0) return;

    drawWaveform(
      canvas,
      waveData,
      startTime / duration,
      endTime / duration,
      Math.min(1, currentTime / duration)
    );
  }, [waveData, startTime, endTime, duration, currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const nextTime = audio.currentTime;
      setCurrentTime(nextTime);

      if (nextTime < endTime) {
        return;
      }

      if (loopSelection) {
        audio.currentTime = startTime;
        void audio.play();
      } else {
        audio.pause();
        audio.currentTime = endTime;
        setCurrentTime(endTime);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [startTime, endTime, loopSelection]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.currentTime < startTime || audio.currentTime > endTime) {
      audio.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [startTime, endTime]);

  const getRatioFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;

    const rect = canvas.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const getHandleAt = (ratio: number): 'start' | 'end' | null => {
    const threshold = 0.015;
    const startRatio = startTime / duration;
    const endRatio = endTime / duration;

    if (Math.abs(ratio - startRatio) < threshold) return 'start';
    if (Math.abs(ratio - endRatio) < threshold) return 'end';
    return null;
  };

  const applyDrag = (ratio: number) => {
    const t = ratio * duration;

    if (draggingRef.current === 'start') {
      const nextStart = Math.min(t, endTime - 0.1);
      setStartTime(nextStart);
      if (currentTime < nextStart) {
        syncCurrentTime(nextStart);
      }
      return;
    }

    if (draggingRef.current === 'end') {
      const nextEnd = Math.max(t, startTime + 0.1);
      setEndTime(nextEnd);
      if (currentTime > nextEnd) {
        syncCurrentTime(nextEnd);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!waveData || duration === 0) return;

    const ratio = getRatioFromEvent(e);
    const handle = getHandleAt(ratio);

    if (handle) {
      draggingRef.current = handle;
      return;
    }

    syncCurrentTime(ratio * duration);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || !waveData) return;
    applyDrag(getRatioFromEvent(e));
  };

  const handleMouseUp = () => {
    draggingRef.current = null;
  };

  const togglePreviewPlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    if (audio.currentTime < startTime || audio.currentTime >= endTime) {
      audio.currentTime = startTime;
      setCurrentTime(startTime);
    }

    await audio.play();
  };

  const playSelection = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = startTime;
    setCurrentTime(startTime);
    await audio.play();
  };

  const handleTrim = async () => {
    if (!file) return;

    setLoading(true);
    setOutputBlob(null);

    try {
      setStatus('ffmpegを読み込み中...');
      const ffmpeg = await getFFmpeg();
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp3';
      const inputName = `trim_input.${ext}`;

      setStatus('トリミング中...');
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      await ffmpeg.exec([
        '-i',
        inputName,
        '-ss',
        startTime.toFixed(3),
        '-to',
        endTime.toFixed(3),
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '192k',
        'trimmed.mp3',
      ]);

      const data = await ffmpeg.readFile('trimmed.mp3');
      setOutputBlob(new Blob([data], { type: 'audio/mpeg' }));
      setStatus('完了');
    } catch (e) {
      setStatus(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const trimmedFilename = file ? `${file.name.replace(/\.[^.]+$/, '')}_trimmed.mp3` : 'trimmed.mp3';

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <span className="w-6 h-0.5 bg-accent-cyan" />
        Trim
      </h2>
      <p className="text-gray-400 text-sm">音声をプレビュー再生しながらトリム範囲を調整</p>

      <div>
        <label className="block text-sm text-gray-400 mb-2">File Upload</label>
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-dark-700 file:text-gray-200 hover:file:bg-dark-600 cursor-pointer"
        />
      </div>

      {waveData && (
        <>
          {audioUrl && (
            <div className="rounded-xl border border-dark-600 bg-dark-900/50 p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void togglePreviewPlayback()}
                  className="px-4 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg text-sm font-medium hover:bg-accent-cyan/30 transition-colors"
                >
                  {isPlaying ? 'Pause Preview' : 'Play Preview'}
                </button>

                <button
                  onClick={() => void playSelection()}
                  className="px-4 py-2 bg-dark-700 text-gray-100 border border-dark-500 rounded-lg text-sm font-medium hover:bg-dark-600 transition-colors"
                >
                  選択範囲を再生
                </button>

                <button
                  onClick={() => syncCurrentTime(startTime)}
                  className="px-4 py-2 bg-dark-700 text-gray-100 border border-dark-500 rounded-lg text-sm font-medium hover:bg-dark-600 transition-colors"
                >
                  開始位置へ
                </button>

                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loopSelection}
                    onChange={(e) => setLoopSelection(e.target.checked)}
                    className="accent-accent-cyan w-4 h-4"
                  />
                  選択範囲をループ
                </label>
              </div>

              <audio ref={audioRef} src={audioUrl} preload="metadata" controls className="w-full" />

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-gray-400">
                  再生位置: <span className="text-white font-medium">{formatTime(currentTime)}</span>
                </p>
                <p className="text-gray-500">黄線が再生位置、白線がトリム範囲です</p>
              </div>
            </div>
          )}

          <div>
            <canvas
              ref={canvasRef}
              width={800}
              height={80}
              className="w-full rounded-lg cursor-col-resize"
              style={{ imageRendering: 'pixelated' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <p className="text-xs text-gray-500 mt-1">
              白線をドラッグしてトリム範囲を調整。波形をクリックするとその位置へ移動します。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">開始 (秒)</label>
              <input
                type="number"
                min={0}
                max={endTime - 0.1}
                step={0.1}
                value={startTime.toFixed(1)}
                onChange={(e) => setStartTime(Math.max(0, Math.min(Number(e.target.value), endTime - 0.1)))}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white"
              />
              <p className="text-xs text-gray-500 mt-0.5">{formatTime(startTime)}</p>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">終了 (秒)</label>
              <input
                type="number"
                min={startTime + 0.1}
                max={duration}
                step={0.1}
                value={endTime.toFixed(1)}
                onChange={(e) => setEndTime(Math.max(startTime + 0.1, Math.min(Number(e.target.value), duration)))}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white"
              />
              <p className="text-xs text-gray-500 mt-0.5">{formatTime(endTime)}</p>
            </div>
          </div>

          <p className="text-sm text-gray-400">
            選択範囲: <span className="text-white font-medium">{(endTime - startTime).toFixed(1)}秒</span>
            <span className="text-gray-600 ml-2">/ 全体 {duration.toFixed(1)}秒</span>
          </p>

          <button
            onClick={handleTrim}
            disabled={loading}
            className="w-full py-2 px-4 bg-accent-purple text-white font-semibold rounded-lg hover:bg-accent-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '処理中...' : 'Trim'}
          </button>
        </>
      )}

      {status && <p className="text-sm text-gray-400">{status}</p>}
      {outputBlob && <DownloadButton blob={outputBlob} filename={trimmedFilename} />}
    </div>
  );
}
