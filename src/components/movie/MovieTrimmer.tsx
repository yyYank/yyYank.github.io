import { useEffect, useRef, useState } from 'react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from '../../lib/ffmpeg';
import DownloadButton from '../sounds/DownloadButton';
import {
  clampTrimEnd,
  clampTrimStart,
  formatVideoTime,
  getTrimmedFilename,
} from './movieTrimmerUtils';

export default function MovieTrimmer() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [startInput, setStartInput] = useState('0.0');
  const [endInput, setEndInput] = useState('0.0');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSelection, setLoopSelection] = useState(true);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const isReady = duration > 0;

  const syncCurrentTime = (nextTime: number) => {
    const clampedTime = Math.max(0, Math.min(nextTime, duration || 0));
    setCurrentTime(clampedTime);
    const video = videoRef.current;
    if (video) {
      video.currentTime = clampedTime;
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const nextUrl = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    setDuration(0);
    setStartTime(0);
    setEndTime(0);
    setStartInput('0.0');
    setEndInput('0.0');
    setCurrentTime(0);
    setIsPlaying(false);
    setOutputBlob(null);
    setStatus('動画メタデータを読み込み中...');
  };

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
      if (nextDuration <= 0) {
        setDuration(0);
        setStartTime(0);
        setEndTime(0);
        setCurrentTime(0);
        setStatus('動画の長さを取得できませんでした');
        return;
      }

      setDuration(nextDuration);
      setStartTime(0);
      setEndTime(nextDuration);
      setStartInput('0.0');
      setEndInput(nextDuration.toFixed(1));
      setCurrentTime(0);
      setStatus('');
    };

    const handleTimeUpdate = () => {
      if (!isReady) return;

      const nextTime = video.currentTime;
      setCurrentTime(nextTime);

      if (nextTime < endTime - 0.02) {
        return;
      }

      if (loopSelection) {
        video.currentTime = startTime;
        void video.play();
      } else {
        video.pause();
        video.currentTime = endTime;
        setCurrentTime(endTime);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => setStatus('動画の読み込みに失敗しました');

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [startTime, endTime, loopSelection, isReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime < startTime || video.currentTime > endTime) {
      video.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [startTime, endTime]);

  useEffect(() => {
    setStartInput(startTime.toFixed(1));
  }, [startTime]);

  useEffect(() => {
    setEndInput(endTime.toFixed(1));
  }, [endTime]);

  const commitStartInput = () => {
    if (!isReady) return;
    const parsed = Number(startInput);
    if (!Number.isFinite(parsed)) {
      setStartInput(startTime.toFixed(1));
      return;
    }
    setStartTime(clampTrimStart(parsed, endTime));
  };

  const commitEndInput = () => {
    if (!isReady) return;
    const parsed = Number(endInput);
    if (!Number.isFinite(parsed)) {
      setEndInput(endTime.toFixed(1));
      return;
    }
    setEndTime(clampTrimEnd(parsed, startTime, duration));
  };

  const handlePreviewPlayback = async () => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    if (isPlaying) {
      video.pause();
      return;
    }

    if (video.currentTime < startTime || video.currentTime >= endTime) {
      video.currentTime = startTime;
      setCurrentTime(startTime);
    }

    await video.play();
  };

  const handlePlaySelection = async () => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    video.currentTime = startTime;
    setCurrentTime(startTime);
    await video.play();
  };

  const handleTrim = async () => {
    if (!file || !isReady) return;

    setLoading(true);
    setOutputBlob(null);

    try {
      setStatus('ffmpegを読み込み中...');
      const ffmpeg = await getFFmpeg();
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp4';
      const inputName = `trim_input.${ext}`;
      const outputName = `trimmed.${ext}`;

      setStatus('トリミング中...');
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      await ffmpeg.exec([
        '-i',
        inputName,
        '-ss',
        startTime.toFixed(3),
        '-to',
        endTime.toFixed(3),
        '-c',
        'copy',
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      setOutputBlob(new Blob([data], { type: file.type || `video/${ext}` }));
      setStatus('完了');
    } catch (error) {
      setStatus(`エラー: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const trimmedFilename = file ? getTrimmedFilename(file.name) : 'trimmed.mp4';

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <span className="w-6 h-0.5 bg-accent-cyan" />
        Movie Trim
      </h2>
      <p className="text-gray-400 text-sm">動画をブラウザ内でトリミングしてそのままダウンロード</p>

      <div>
        <label className="block text-sm text-gray-400 mb-2">File Upload</label>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-dark-700 file:text-gray-200 hover:file:bg-dark-600 cursor-pointer"
        />
      </div>

      {videoUrl && (
        <>
          <div className="rounded-xl border border-dark-600 bg-dark-900/50 p-4 space-y-4">
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} src={videoUrl} preload="metadata" controls className="h-full w-full" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void handlePreviewPlayback()}
                disabled={!isReady}
                className="px-4 py-2 bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded-lg text-sm font-medium hover:bg-accent-cyan/30 transition-colors"
              >
                {isPlaying ? 'Pause Preview' : 'Play Preview'}
              </button>

              <button
                onClick={() => void handlePlaySelection()}
                disabled={!isReady}
                className="px-4 py-2 bg-dark-700 text-gray-100 border border-dark-500 rounded-lg text-sm font-medium hover:bg-dark-600 transition-colors"
              >
                選択範囲を再生
              </button>

              <button
                onClick={() => syncCurrentTime(startTime)}
                disabled={!isReady}
                className="px-4 py-2 bg-dark-700 text-gray-100 border border-dark-500 rounded-lg text-sm font-medium hover:bg-dark-600 transition-colors"
              >
                開始位置へ
              </button>

              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loopSelection}
                  onChange={(event) => setLoopSelection(event.target.checked)}
                  className="accent-accent-cyan w-4 h-4"
                />
                選択範囲をループ
              </label>
            </div>

            {!isReady ? (
              <p className="text-sm text-gray-500">動画の長さを読み込み中です。読み込み完了後にスライダーを操作できます。</p>
            ) : (
              <div className="grid gap-3">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <label className="block text-xs text-gray-400">再生位置</label>
                    <span className="text-xs text-gray-500">{formatVideoTime(currentTime)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.01}
                    value={Math.min(currentTime, duration)}
                    onChange={(event) => syncCurrentTime(Number(event.target.value))}
                    className="w-full accent-accent-cyan"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <label className="block text-xs text-gray-400">開始位置</label>
                    <span className="text-xs text-gray-500">{formatVideoTime(startTime)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.01}
                    value={startTime}
                    onChange={(event) => {
                      const nextStart = clampTrimStart(Number(event.target.value), endTime);
                      setStartTime(nextStart);
                    }}
                    className="w-full accent-accent-cyan"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <label className="block text-xs text-gray-400">終了位置</label>
                    <span className="text-xs text-gray-500">{formatVideoTime(endTime)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.01}
                    value={endTime}
                    onChange={(event) => {
                      const nextEnd = clampTrimEnd(Number(event.target.value), startTime, duration);
                      setEndTime(nextEnd);
                    }}
                    className="w-full accent-accent-pink"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">開始 (秒)</label>
              <input
                type="text"
                inputMode="decimal"
                value={startInput}
                disabled={!isReady}
                onChange={(event) => setStartInput(event.target.value)}
                onBlur={commitStartInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitStartInput();
                  }
                }}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white"
              />
              <p className="text-xs text-gray-500 mt-0.5">{formatVideoTime(startTime)}</p>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">終了 (秒)</label>
              <input
                type="text"
                inputMode="decimal"
                value={endInput}
                disabled={!isReady}
                onChange={(event) => setEndInput(event.target.value)}
                onBlur={commitEndInput}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitEndInput();
                  }
                }}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white"
              />
              <p className="text-xs text-gray-500 mt-0.5">{formatVideoTime(endTime)}</p>
            </div>
          </div>

          <p className="text-sm text-gray-400">
            選択範囲: <span className="text-white font-medium">{formatVideoTime(Math.max(0, endTime - startTime))}</span>
            <span className="text-gray-600 ml-2">/ 全体 {formatVideoTime(duration)}</span>
          </p>

          <button
            onClick={() => void handleTrim()}
            disabled={loading || duration === 0}
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
