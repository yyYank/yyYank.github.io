export function buildConcatList(inputNames: string[]): string {
  return inputNames.map((name) => `file '${name}'\n`).join('');
}

export function buildConcatArgs(listName: string, outputName: string): string[] {
  return ['-f', 'concat', '-safe', '0', '-i', listName, '-c', 'copy', outputName];
}

export type OutputSize = { label: string; width: number; height: number };

export const OUTPUT_SIZES: OutputSize[] = [
  { label: 'スマホ縦', width: 1080, height: 1920 },
  { label: 'スマホ横', width: 1920, height: 1080 },
  { label: 'PC横', width: 2560, height: 1440 },
  { label: 'PC縦', width: 1440, height: 2560 },
];

export type AudioInfo = { codec: string; sampleRate: number; channelLayout: string };

export type VideoInfo = {
  videoCodec: string;
  width: number;
  height: number;
  rotation: number;
  fps: number;
  audio: AudioInfo | null;
  duration: number;
};

export function parseProbeLog(log: string): VideoInfo {
  const video = log.match(/Stream #\d+:\d+.*?: Video: (\w+).*?, (\d+)x(\d+)/);
  if (!video) {
    throw new Error('映像の情報を読み取れませんでした');
  }
  const duration = log.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const rotation = log.match(/displaymatrix: rotation of (-?\d+(?:\.\d+)?) degrees/);
  const fps = log.match(/Video: .*?, (\d+(?:\.\d+)?) fps/);
  const audio = log.match(/Stream #\d+:\d+.*?: Audio: (\w+).*?, (\d+) Hz, ([^,]+)/);

  return {
    videoCodec: video[1],
    width: Number(video[2]),
    height: Number(video[3]),
    rotation: rotation ? Number(rotation[1]) : 0,
    fps: fps ? Number(fps[1]) : 0,
    audio: audio ? { codec: audio[1], sampleRate: Number(audio[2]), channelLayout: audio[3] } : null,
    duration: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : 0,
  };
}

export function parseProgressTime(message: string): number | null {
  const time = message.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return time ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : null;
}

export function fileProgress(elapsed: number, durations: number[]): number[] {
  let start = 0;
  return durations.map((duration) => {
    const done = elapsed - start;
    start += duration;
    if (duration <= 0) return done >= 0 ? 1 : 0;
    return Math.min(Math.max(done / duration, 0), 1);
  });
}

export function canStreamCopy(infos: VideoInfo[]): boolean {
  const [first] = infos;
  return infos.every(
    (info) =>
      info.videoCodec === first.videoCodec &&
      info.width === first.width &&
      info.height === first.height &&
      info.rotation === first.rotation &&
      info.fps === first.fps &&
      info.audio?.codec === first.audio?.codec &&
      info.audio?.sampleRate === first.audio?.sampleRate &&
      info.audio?.channelLayout === first.audio?.channelLayout
  );
}

const VIDEO_ENCODERS: Record<string, string> = { h264: 'libx264', hevc: 'libx265' };
const AUDIO_ENCODERS: Record<string, string> = { aac: 'aac', mp3: 'libmp3lame', opus: 'libopus' };

export function buildReencodeArgs(
  inputNames: string[],
  infos: VideoInfo[],
  { width, height }: OutputSize,
  outputName: string
): string[] {
  const videoEncoder = VIDEO_ENCODERS[infos[0].videoCodec];
  if (!videoEncoder) {
    throw new Error(`${infos[0].videoCodec} の動画は再エンコードに対応していません`);
  }
  const audio = infos.find((info) => info.audio)?.audio ?? null;
  const audioEncoder = audio ? AUDIO_ENCODERS[audio.codec] : undefined;
  if (audio && !audioEncoder) {
    throw new Error(`${audio.codec} の音声は再エンコードに対応していません`);
  }

  // 縦横比を保ったまま画面に収める。小さい動画は拡大せず、余白は黒で埋める
  const fit = `scale='min(${width},iw)':'min(${height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
  const parts: string[] = [];
  const pairs: string[] = [];
  infos.forEach((info, i) => {
    parts.push(`[${i}:v]${fit}[v${i}]`);
    if (audio) {
      parts.push(
        info.audio
          ? `[${i}:a]aformat=sample_rates=${audio.sampleRate}:channel_layouts=${audio.channelLayout}[a${i}]`
          : `anullsrc=r=${audio.sampleRate}:cl=${audio.channelLayout},atrim=duration=${info.duration}[a${i}]`
      );
    }
    pairs.push(audio ? `[v${i}][a${i}]` : `[v${i}]`);
  });
  parts.push(
    audio
      ? `${pairs.join('')}concat=n=${infos.length}:v=1:a=1[outv][outa]`
      : `${pairs.join('')}concat=n=${infos.length}:v=1:a=0[outv]`
  );

  return [
    ...inputNames.flatMap((name) => ['-i', name]),
    '-filter_complex',
    parts.join(';'),
    '-map',
    '[outv]',
    ...(audio ? ['-map', '[outa]'] : []),
    '-fps_mode',
    'passthrough',
    '-c:v',
    videoEncoder,
    ...(videoEncoder === 'libx265' ? ['-tag:v', 'hvc1'] : []),
    ...(audioEncoder ? ['-c:a', audioEncoder] : []),
    outputName,
  ];
}

export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
