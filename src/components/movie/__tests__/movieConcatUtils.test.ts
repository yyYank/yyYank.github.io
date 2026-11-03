import { describe, expect, it } from 'vitest';
import {
  buildConcatArgs,
  buildConcatList,
  buildReencodeArgs,
  canStreamCopy,
  moveItem,
  OUTPUT_SIZES,
  parseProbeLog,
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
  width: 1920,
  height: 1080,
  rotation: 0,
  fps: 30,
  audio: { codec: 'aac', sampleRate: 44100, channelLayout: 'stereo' },
  duration: 5.5,
};
const rotatedPortrait: VideoInfo = {
  ...landscape,
  rotation: -90,
  fps: 29.97,
  audio: null,
  duration: 3.25,
};

const phoneLandscape = OUTPUT_SIZES.find((size) => size.label === 'スマホ横')!;

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

  // コーデック・解像度・回転・fps・音声がすべて同じで、表示サイズが選んだ出力サイズと一致するときだけ再エンコードなしでつなぐこと
  it('allows stream copy only when all inputs match each other and the chosen output size', () => {
    expect(canStreamCopy([landscape, { ...landscape, duration: 1 }], phoneLandscape)).toBe(true);
    expect(canStreamCopy([landscape, landscape], OUTPUT_SIZES[0])).toBe(false);
    expect(canStreamCopy([landscape, rotatedPortrait], phoneLandscape)).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, rotation: -90 }], phoneLandscape)).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, videoCodec: 'hevc' }], phoneLandscape)).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, fps: 60 }], phoneLandscape)).toBe(false);
    expect(canStreamCopy([landscape, { ...landscape, audio: null }], phoneLandscape)).toBe(false);
  });

  // 再エンコード時は、縦横比を保って画面に収め(大きい動画だけ縮め、小さい動画は拡大しない)、余白は黒、
  // 音声のない動画には無音を足し、元のコーデックと fps のまま出力すること
  it('builds re-encode args that fit each input into the fixed size with black bars and silence', () => {
    const args = buildReencodeArgs(['in0.mp4', 'in1.mp4'], [landscape, rotatedPortrait], phoneLandscape, 'out.mp4');
    const filter = args[args.indexOf('-filter_complex') + 1];
    const fit =
      "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1";

    expect(args.slice(0, 4)).toEqual(['-i', 'in0.mp4', '-i', 'in1.mp4']);
    expect(filter).toBe(
      [
        `[0:v]${fit}[v0]`,
        '[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]',
        `[1:v]${fit}[v1]`,
        'anullsrc=r=44100:cl=stereo,atrim=duration=3.25[a1]',
        '[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]',
      ].join(';')
    );
    expect(args.slice(args.indexOf('-filter_complex') + 2)).toEqual([
      '-map',
      '[outv]',
      '-map',
      '[outa]',
      '-fps_mode',
      'passthrough',
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      'out.mp4',
    ]);
  });

  // どの動画にも音声がないときは、音声なしで出力すること
  it('builds video-only re-encode args when no input has audio', () => {
    const silent = { ...landscape, audio: null };
    const args = buildReencodeArgs(['in0.mp4', 'in1.mp4'], [silent, rotatedPortrait], phoneLandscape, 'out.mp4');
    const filter = args[args.indexOf('-filter_complex') + 1];

    expect(filter).toContain('[v0][v1]concat=n=2:v=1:a=0[outv]');
    expect(filter).not.toContain('anullsrc');
    expect(args).not.toContain('[outa]');
    expect(args).not.toContain('-c:a');
  });

  // 元のコーデックが HEVC なら HEVC で出力し、iPhone などで再生できるよう hvc1 タグを付けること
  it('re-encodes HEVC input as HEVC with the hvc1 tag', () => {
    const hevc = { ...landscape, videoCodec: 'hevc' };
    const args = buildReencodeArgs(['in0.mp4', 'in1.mp4'], [hevc, { ...hevc, rotation: -90 }], phoneLandscape, 'out.mp4');

    expect(args[args.indexOf('-c:v') + 1]).toBe('libx265');
    expect(args[args.indexOf('-tag:v') + 1]).toBe('hvc1');
  });

  // 対応していないコーデックのときは、勝手に別のコーデックにせずエラーにすること
  it('throws for an unsupported video codec instead of switching codecs', () => {
    const unknown = { ...landscape, videoCodec: 'prores' };
    expect(() =>
      buildReencodeArgs(['in0.mp4', 'in1.mp4'], [unknown, rotatedPortrait], phoneLandscape, 'out.mp4')
    ).toThrow(/prores/);
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
});
