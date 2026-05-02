import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MovieTrimmer from '../MovieTrimmer';
import MovToMp4Converter from '../MovToMp4Converter';

const ffmpegMocks = vi.hoisted(() => {
  const writeFile = vi.fn();
  const exec = vi.fn();
  const readFile = vi.fn();
  const on = vi.fn();
  const off = vi.fn();
  const getFFmpeg = vi.fn(async () => ({
    writeFile,
    exec,
    readFile,
    on,
    off,
  }));

  return {
    writeFile,
    exec,
    readFile,
    on,
    off,
    getFFmpeg,
  };
});

vi.mock('../../../lib/ffmpeg', () => ({
  getFFmpeg: ffmpegMocks.getFFmpeg,
}));

describe('movie exporters', () => {
  beforeEach(() => {
    ffmpegMocks.writeFile.mockReset();
    ffmpegMocks.exec.mockReset();
    ffmpegMocks.readFile.mockReset();
    ffmpegMocks.getFFmpeg.mockClear();
    ffmpegMocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:movie'),
      revokeObjectURL: vi.fn(),
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('exports trimmed movie as mp4 when the download format is set to mp4', async () => {
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new Uint8Array([9, 8, 7]).buffer),
    });

    render(<MovieTrimmer />);

    await userEvent.upload(screen.getByLabelText('File Upload'), file);

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 6 });
    fireEvent.loadedMetadata(video);

    await userEvent.selectOptions(screen.getByLabelText('出力形式'), 'mp4');
    await userEvent.click(screen.getByRole('button', { name: 'Trim' }));

    await waitFor(() => {
      expect(ffmpegMocks.exec).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /Download clip_trimmed\.mp4/ })).toBeInTheDocument();
    });

    expect(ffmpegMocks.exec.mock.calls[0]?.[0]).toContain('copy');
    expect(ffmpegMocks.exec.mock.calls[1]?.[0]).toContain('mpeg4');
  });

  it('trims with stream copy then re-encodes when mp4 export is selected', async () => {
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new Uint8Array([9, 8, 7]).buffer),
    });

    render(<MovieTrimmer />);

    await userEvent.upload(screen.getByLabelText('File Upload'), file);

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 6 });
    fireEvent.loadedMetadata(video);

    await userEvent.selectOptions(screen.getByLabelText('出力形式'), 'mp4');
    await userEvent.click(screen.getByRole('button', { name: 'Trim' }));

    await waitFor(() => {
      expect(ffmpegMocks.exec).toHaveBeenCalledTimes(2);
      expect(screen.getByText('完了')).toBeInTheDocument();
    });
    expect(ffmpegMocks.exec.mock.calls[0]?.[0]).toContain('copy');
    expect(ffmpegMocks.exec.mock.calls[1]?.[0]).toContain('mpeg4');
  });

  it('converts mov files to mp4', async () => {
    const file = new File(['video'], 'clip.mov', { type: 'video/quicktime' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    });

    render(<MovToMp4Converter />);

    await userEvent.upload(screen.getByLabelText('File Upload'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Convert to MP4' }));

    await waitFor(() => {
      expect(ffmpegMocks.writeFile).toHaveBeenCalledTimes(1);
      expect(ffmpegMocks.exec).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /Download .*\.mp4/ })).toBeInTheDocument();
    });

    expect(ffmpegMocks.exec.mock.calls[0]?.[0]).toContain('output.mp4');
  });

  it('uses re-encoding when converting mov to mp4', async () => {
    const file = new File(['video'], 'clip.mov', { type: 'video/quicktime' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    });

    render(<MovToMp4Converter />);

    await userEvent.upload(screen.getByLabelText('File Upload'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Convert to MP4' }));

    await waitFor(() => {
      expect(ffmpegMocks.exec).toHaveBeenCalledTimes(1);
      expect(screen.getByText('変換完了')).toBeInTheDocument();
    });
  });
});
