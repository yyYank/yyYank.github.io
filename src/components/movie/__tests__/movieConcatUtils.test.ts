import { describe, expect, it } from 'vitest';
import { buildConcatArgs, buildConcatFilter, moveItem } from '../movieConcatUtils';

describe('movieConcatUtils', () => {
  // 各入力を1本目の解像度に揃えてから、本数分の映像・音声を concat するフィルタになること
  it('builds a concat filter that scales every input to the given size', () => {
    expect(buildConcatFilter(2, { width: 1280, height: 720 })).toBe(
      [
        '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v0]',
        '[0:a]aformat=sample_rates=44100:channel_layouts=stereo[a0]',
        '[1:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[v1]',
        '[1:a]aformat=sample_rates=44100:channel_layouts=stereo[a1]',
        '[v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]',
      ].join(';')
    );
  });

  // 入力ファイルが渡した順番どおりに -i で並び、出力が MP4 になること
  it('builds ffmpeg args with inputs in the given order', () => {
    const args = buildConcatArgs(['in0.mp4', 'in1.mp4', 'in2.mp4'], 'output.mp4', { width: 640, height: 480 });

    expect(args.slice(0, 6)).toEqual(['-i', 'in0.mp4', '-i', 'in1.mp4', '-i', 'in2.mp4']);
    expect(args).toContain('-filter_complex');
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('concat=n=3:v=1:a=1[outv][outa]');
    expect(args.slice(-1)).toEqual(['output.mp4']);
    expect(args).toContain('mpeg4');
  });

  // 順番の入れ替えで、指定した要素だけが隣に移動し、範囲外の移動は無視されること
  it('moves an item up or down and ignores out-of-range moves', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
