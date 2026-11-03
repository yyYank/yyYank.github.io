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
  profile: string | null;
  pixFmt: string;
  timescale: number;
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
  const profile = log.match(/Video: \w+ \(([^)]+)\)/);
  const pixFmt = log.match(/Video: \w+[^,]*, (\w+)/);
  const timescale = log.match(/Video: .*?, (\d+(?:\.\d+)?)(k?) tbn/);

  return {
    videoCodec: video[1],
    profile: profile ? profile[1] : null,
    pixFmt: pixFmt ? pixFmt[1] : '',
    timescale: timescale ? Math.round(Number(timescale[1]) * (timescale[2] ? 1000 : 1)) : 0,
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

// ffmpeg -i のログに出るプロファイル名を、エンコーダに渡す名前にする
const PROFILES: Record<string, string> = {
  'Constrained Baseline': 'baseline',
  Baseline: 'baseline',
  Main: 'main',
  High: 'high',
  'High 10': 'high10',
  'Main 10': 'main10',
};

export type Reference = {
  videoCodec: string;
  profile: string | null;
  pixFmt: string;
  timescale: number;
  audio: AudioInfo | null;
};

function fitsSize(info: VideoInfo, size: OutputSize): boolean {
  return info.rotation === 0 && info.width === size.width && info.height === size.height;
}

function sameAudio(a: AudioInfo | null, b: AudioInfo | null): boolean {
  return a?.codec === b?.codec && a?.sampleRate === b?.sampleRate && a?.channelLayout === b?.channelLayout;
}

function sameVideo(info: VideoInfo, reference: Reference): boolean {
  return (
    info.videoCodec === reference.videoCodec &&
    info.profile === reference.profile &&
    info.pixFmt === reference.pixFmt &&
    info.timescale === reference.timescale
  );
}

// 作り直す動画は、そのまま使う動画と同じ作りにしないと、エンコードせずにつなげない
export function chooseReference(infos: VideoInfo[], size: OutputSize): Reference {
  const base = infos.find((info) => fitsSize(info, size)) ?? infos[0];
  return {
    videoCodec: base.videoCodec,
    profile: base.profile,
    pixFmt: base.pixFmt,
    timescale: base.timescale,
    audio: base.audio ?? infos.find((info) => info.audio)?.audio ?? null,
  };
}

export function isPassthrough(info: VideoInfo, size: OutputSize, reference: Reference): boolean {
  return fitsSize(info, size) && sameVideo(info, reference) && sameAudio(info.audio, reference.audio);
}

export function buildClipArgs(
  inputName: string,
  info: VideoInfo,
  { width, height }: OutputSize,
  reference: Reference,
  outputName: string
): string[] {
  const copyVideo = fitsSize(info, { label: '', width, height }) && sameVideo(info, reference);
  const videoEncoder = VIDEO_ENCODERS[reference.videoCodec];
  if (!copyVideo && !videoEncoder) {
    throw new Error(`${reference.videoCodec} の動画は再エンコードに対応していません`);
  }
  const audio = reference.audio;
  const audioEncoder = audio ? AUDIO_ENCODERS[audio.codec] : undefined;
  const copyAudio = !audio || sameAudio(info.audio, audio);
  if (!copyAudio && !audioEncoder) {
    throw new Error(`${audio?.codec} の音声は再エンコードに対応していません`);
  }

  const filters: string[] = [];
  if (!copyVideo) {
    // 縦横比を保ったまま画面に収める。小さい動画は拡大せず、余白は黒で埋める
    filters.push(
      `[0:v]scale='min(${width},iw)':'min(${height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v]`
    );
  }
  if (audio && !info.audio) {
    filters.push(`anullsrc=r=${audio.sampleRate}:cl=${audio.channelLayout},atrim=duration=${info.duration}[a]`);
  }

  const profile = reference.profile ? PROFILES[reference.profile] : undefined;
  const videoArgs = copyVideo
    ? ['-map', '0:v:0', '-c:v', 'copy']
    : [
        '-map',
        '[v]',
        '-c:v',
        videoEncoder,
        ...(profile ? ['-profile:v', profile] : []),
        '-pix_fmt',
        reference.pixFmt,
        '-fps_mode',
        'passthrough',
      ];
  let audioArgs: string[];
  if (!audio) {
    audioArgs = ['-an'];
  } else if (!info.audio) {
    audioArgs = ['-map', '[a]', '-c:a', audioEncoder!];
  } else if (copyAudio) {
    audioArgs = ['-map', '0:a:0', '-c:a', 'copy'];
  } else {
    audioArgs = [
      '-map',
      '0:a:0',
      '-af',
      `aformat=sample_rates=${audio.sampleRate}:channel_layouts=${audio.channelLayout}`,
      '-c:a',
      audioEncoder!,
    ];
  }

  return [
    '-i',
    inputName,
    ...(filters.length > 0 ? ['-filter_complex', filters.join(';')] : []),
    ...videoArgs,
    ...(reference.videoCodec === 'hevc' ? ['-tag:v', 'hvc1'] : []),
    ...audioArgs,
    '-video_track_timescale',
    String(reference.timescale),
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
