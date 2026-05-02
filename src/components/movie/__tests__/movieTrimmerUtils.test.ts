import { describe, expect, it } from 'vitest';
import {
  clampTrimEnd,
  clampTrimStart,
  formatVideoTime,
  getTrimmedFilename,
} from '../movieTrimmerUtils';

describe('movieTrimmerUtils', () => {
  it('formats seconds as hh:mm:ss.mmm', () => {
    expect(formatVideoTime(0)).toBe('0:00:00.000');
    expect(formatVideoTime(65.432)).toBe('0:01:05.432');
    expect(formatVideoTime(3661.009)).toBe('1:01:01.009');
  });

  it('clamps start time inside the current trim range', () => {
    expect(clampTrimStart(-1, 10)).toBe(0);
    expect(clampTrimStart(9.95, 10)).toBe(9.9);
    expect(clampTrimStart(4.5, 10)).toBe(4.5);
  });

  it('clamps end time inside the current trim range', () => {
    expect(clampTrimEnd(0, 5, 10)).toBe(5.1);
    expect(clampTrimEnd(11, 5, 10)).toBe(10);
    expect(clampTrimEnd(6.5, 5, 10)).toBe(6.5);
  });

  it('builds a trimmed filename while preserving the extension', () => {
    expect(getTrimmedFilename('clip.mp4')).toBe('clip_trimmed.mp4');
    expect(getTrimmedFilename('demo.final.webm')).toBe('demo.final_trimmed.webm');
    expect(getTrimmedFilename('recording')).toBe('recording_trimmed');
  });
});
