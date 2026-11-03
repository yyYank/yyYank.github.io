import { describe, expect, it } from 'vitest';
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
} from '../movieConcatUtils';

const landscapeLog = [
  '  Duration: 00:00:05.50, start: 0.000000, bitrate: 5000 kb/s',
  '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1920x1080 [SAR 1:1 DAR 16:9], 4800 kb/s, 30 fps, 30 tbr, 30k tbn (default)',
  '  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)',
].join('\n');

// スマホで縦に撮った動画は、横長の映像に「-90度回転して表示」という情報が付いている
const rotatedPortraitLog = [
  '  Duration: 00:00:03.25, start: 0.000000, bitrate: 5000 kb/s',
  '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1920x1080, 4800 kb/s, 29.97 fps, 29.97 tbr, 600 tbn (default)',
  '    Side data:',
  '      displaymatrix: rotation of -90.00 degrees',
].join('\n');

const landscape: VideoInfo = {
  videoCodec: 'h264',
  profile: 'High',
  pixFmt: 'yuv420p',
  timescale: 30000,
  width: 1920,
  height: 1080,
  rotation: 0,
  fps: 30,
  audio: { codec: 'aac', sampleRate: 44100, channelLayout: 'stereo' },
  duration: 5.5,
};
const rotatedPortrait: VideoInfo = {
  ...landscape,
  timescale: 600,
  rotation: -90,
  fps: 29.97,
  audio: null,
  duration: 3.25,
};

const phoneLandscape = OUTPUT_SIZES[1];

describe('movieConcatUtils', () => {
  // 出力サイズはスマホ縦・スマホ横・PC横・PC縦の4つで固定されていること
  it('offers four fixed output sizes', () => {
    expect(OUTPUT_SIZES).toEqual([
      { label: 'スマホ縦', width: 1080, height: 1920 },
      { label: 'スマホ横', width: 1920, height: 1080 },
      { label: 'PC横', width: 2560, height: 1440 },
      { label: 'PC縦', width: 1440, height: 2560 },
    ]);
  });

  // ffmpeg -i のログから、コーデック・解像度・回転・fps・音声・長さを読み取れること
  it('parses codec, size, rotation, fps, audio and duration from an ffmpeg probe log', () => {
    expect(parseProbeLog(landscapeLog)).toEqual(landscape);
    expect(parseProbeLog(rotatedPortraitLog)).toEqual(rotatedPortrait);
  });

  // コーデック・解像度・回転・fps・音声がすべて同じなら、出力サイズに関係なく再エンコードせずにつなぐと判定すること
  it('allows stream copy whenever all inputs share the same format', () => {
    expect(canStreamCopy([landscape, { ...landscape, duration: 1 }])).toBe(true);
    expect(canStreamCopy([landscape, rotatedPortrait])).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, rotation: -90 }])).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, width: 1280, height: 720 }])).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, videoCodec: 'hevc' }])).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, fps: 60 }])).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, audio: null }])).toBe(false);
  });

  // 出力サイズと同じ大きさで回転情報のない最初の動画を、作り直す動画の手本にすること
  it('chooses the first input that already fits the output size as the reference', () => {
    expect(chooseReference([rotatedPortrait, landscape], phoneLandscape)).toEqual({
      videoCodec: 'h264',
      profile: 'High',
      pixFmt: 'yuv420p',
      timescale: 30000,
      audio: landscape.audio,
    });
  });

  // 出力サイズに合う動画がなければ、1本目の作りと、最初に見つかった音声の作りを手本にすること
  it('falls back to the first input and the first audio when nothing fits the output size', () => {
    expect(chooseReference([rotatedPortrait, landscape], OUTPUT_SIZES[0])).toEqual({
      videoCodec: 'h264',
      profile: 'High',
      pixFmt: 'yuv420p',
      timescale: 600,
      audio: landscape.audio,
    });
  });

  // 向き・サイズ・作り・音声が手本と同じ動画だけ、何もせずそのまま使うこと
  it('passes through only inputs that already match the output size and the reference', () => {
    const reference = chooseReference([landscape, rotatedPortrait], phoneLandscape);

    expect(isPassthrough(landscape, phoneLandscape, reference)).toBe(true);
    expect(isPassthrough(rotatedPortrait, phoneLandscape, reference)).toBe(false);
    expect(isPassthrough({ ...landscape, width: 1280, height: 720 }, phoneLandscape, reference)).toBe(false);
    expect(isPassthrough({ ...landscape, audio: null }, phoneLandscape, reference)).toBe(false);
  });

  // 向きの違う動画は、映像だけ手本と同じ作りで出力サイズに収めて作り直し、音声のない動画には無音を足すこと
  it('re-encodes only the video of a mismatched input to match the reference', () => {
    const reference = chooseReference([landscape, rotatedPortrait], phoneLandscape);

    expect(buildClipArgs('in1.mp4', rotatedPortrait, phoneLandscape, reference, 'seg1.mp4')).toEqual([
      '-i',
      'in1.mp4',
      '-filter_complex',
      [
        "[0:v]scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v]",
        'anullsrc=r=44100:cl=stereo,atrim=duration=3.25[a]',
      ].join(';'),
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-fps_mode',
      'passthrough',
      '-map',
      '[a]',
      '-c:a',
      'aac',
      '-video_track_timescale',
      '30000',
      'seg1.mp4',
    ]);
  });

  // 向きもサイズも合っていて音声だけないときは、映像はコピーして無音だけ足すこと
  it('copies the video and adds silence when only the audio is missing', () => {
    const reference = chooseReference([landscape, rotatedPortrait], phoneLandscape);
    const silent = { ...landscape, audio: null, duration: 2 };

    expect(buildClipArgs('in2.mp4', silent, phoneLandscape, reference, 'seg2.mp4')).toEqual([
      '-i',
      'in2.mp4',
      '-filter_complex',
      'anullsrc=r=44100:cl=stereo,atrim=duration=2[a]',
      '-map',
      '0:v:0',
      '-c:v',
      'copy',
      '-map',
      '[a]',
      '-c:a',
      'aac',
      '-video_track_timescale',
      '30000',
      'seg2.mp4',
    ]);
  });

  // 映像を作り直すときも、音声が手本と同じならエンコードせずにコピーすること
  it('copies the audio when it already matches the reference', () => {
    const reference = chooseReference([landscape], phoneLandscape);
    const rotatedWithAudio = { ...rotatedPortrait, audio: landscape.audio };
    const args = buildClipArgs('in1.mp4', rotatedWithAudio, phoneLandscape, reference, 'seg1.mp4');

    expect(args.slice(args.indexOf('-map', args.indexOf('[v]') + 1))).toEqual([
      '-map',
      '0:a:0',
      '-c:a',
      'copy',
      '-video_track_timescale',
      '30000',
      'seg1.mp4',
    ]);
  });

  // 手本が HEVC なら HEVC で作り直し、iPhone などで再生できるよう hvc1 タグを付けること
  it('re-encodes as HEVC with the hvc1 tag when the reference is HEVC', () => {
    const hevc = { ...landscape, videoCodec: 'hevc', profile: 'Main' };
    const reference = chooseReference([hevc], phoneLandscape);
    const args = buildClipArgs('in1.mp4', { ...hevc, rotation: -90 }, phoneLandscape, reference, 'seg1.mp4');

    expect(args[args.indexOf('-c:v') + 1]).toBe('libx265');
    expect(args[args.indexOf('-profile:v') + 1]).toBe('main');
    expect(args[args.indexOf('-tag:v') + 1]).toBe('hvc1');
  });

  // 対応していないコーデックのときは、勝手に別のコーデックにせずエラーにすること
  it('throws for an unsupported video codec instead of switching codecs', () => {
    const unknown = { ...landscape, videoCodec: 'prores' };
    const reference = chooseReference([unknown], phoneLandscape);
    expect(() => buildClipArgs('in1.mp4', rotatedPortrait, phoneLandscape, reference, 'seg1.mp4')).toThrow(/prores/);
  });

  // concat 用のリストに、渡した順番どおりにファイルが並ぶこと
  it('builds a concat list in the given order', () => {
    expect(buildConcatList(['in0.mp4', 'in1.mp4', 'in2.mp4'])).toBe(
      "file 'in0.mp4'\nfile 'in1.mp4'\nfile 'in2.mp4'\n"
    );
  });

  // 再エンコードせず、元の動画のままつなげる引数になること
  it('builds ffmpeg args that concatenate with stream copy only', () => {
    expect(buildConcatArgs('list.txt', 'output.mp4')).toEqual([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      'list.txt',
      '-c',
      'copy',
      'output.mp4',
    ]);
  });

  // 順番の入れ替えで、指定した要素だけが隣に移動し、範囲外の移動は無視されること
  it('moves an item up or down and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  // ffmpeg の進み具合のログから、処理済みの時間(秒)を読み取れること。時間のない行は null
  it('parses processed time from an ffmpeg progress log line', () => {
    expect(parseProgressTime('frame=  90 fps= 30 q=-1.0 size=    512kB time=00:01:02.50 bitrate= 67.1kbits/s speed=1x')).toBe(62.5);
    expect(parseProgressTime('size=       0kB time=N/A bitrate=N/A speed=N/A')).toBeNull();
    expect(parseProgressTime('Stream mapping:')).toBeNull();
  });

  // 処理済みの時間と各ファイルの長さから、ファイルごとの進み具合(0〜1)を出すこと
  it('splits the processed time into per-file progress', () => {
    expect(fileProgress(0, [2, 4])).toEqual([0, 0]);
    expect(fileProgress(1, [2, 4])).toEqual([0.5, 0]);
    expect(fileProgress(3, [2, 4])).toEqual([1, 0.25]);
    expect(fileProgress(10, [2, 4])).toEqual([1, 1]);
  });
});
