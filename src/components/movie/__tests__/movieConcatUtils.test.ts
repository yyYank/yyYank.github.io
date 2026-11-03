import { describe, expect, it } from 'vitest';
import { buildConcatArgs, buildConcatList, moveItem } from '../movieConcatUtils';

describe('movieConcatUtils', () => {
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
