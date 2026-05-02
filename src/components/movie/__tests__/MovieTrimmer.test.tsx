import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MovieTrimmer from '../MovieTrimmer';

const ffmpegMocks = vi.hoisted(() => {
  const writeFile = vi.fn();
  const exec = vi.fn();
  const readFile = vi.fn();
  const getFFmpeg = vi.fn(async () => ({
    writeFile,
    exec,
    readFile,
  }));

  return {
    writeFile,
    exec,
    readFile,
    getFFmpeg,
  };
});

vi.mock('../../../lib/ffmpeg', () => ({
  getFFmpeg: ffmpegMocks.getFFmpeg,
}));

describe('MovieTrimmer', () => {
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

  it('clears metadata loading state after video metadata is available', async () => {
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    });

    render(<MovieTrimmer />);

    const input = screen.getByLabelText('File Upload');
    await userEvent.upload(input, file);

    expect(screen.getByText('動画メタデータを読み込み中...')).toBeInTheDocument();

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 12.5 });
    fireEvent.loadedMetadata(video);

    await waitFor(() => {
      expect(screen.queryByText('動画メタデータを読み込み中...')).not.toBeInTheDocument();
    });
    expect(screen.getAllByDisplayValue('12.5')).toHaveLength(2);
  });

  it('shows an error when video metadata does not provide a positive duration', async () => {
    const file = new File(['video'], 'zero.webm', { type: 'video/webm' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    });

    render(<MovieTrimmer />);

    await userEvent.upload(screen.getByLabelText('File Upload'), file);

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 0 });
    fireEvent.loadedMetadata(video);

    await waitFor(() => {
      expect(screen.getByText('動画の長さを取得できませんでした')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Trim' })).toBeDisabled();
  });

  it('uses cached upload data and falls back to re-encoding when copy trim fails', async () => {
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });
    const initialArrayBuffer = vi.fn().mockResolvedValue(new Uint8Array([9, 8, 7]).buffer);
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: initialArrayBuffer,
    });

    ffmpegMocks.exec
      .mockRejectedValueOnce(new Error('copy failed'))
      .mockResolvedValueOnce(undefined);

    render(<MovieTrimmer />);

    const input = screen.getByLabelText('File Upload');
    await userEvent.upload(input, file);

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 6 });
    fireEvent.loadedMetadata(video);

    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('should not be re-read')),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Trim' }));

    await waitFor(() => {
      expect(ffmpegMocks.writeFile).toHaveBeenCalledTimes(1);
      expect(ffmpegMocks.exec).toHaveBeenCalledTimes(2);
      expect(ffmpegMocks.readFile).toHaveBeenCalledTimes(1);
      expect(screen.getByText('完了')).toBeInTheDocument();
    });

    const writtenData = ffmpegMocks.writeFile.mock.calls[0]?.[1];
    expect(writtenData).toBeInstanceOf(Uint8Array);
    expect(initialArrayBuffer).toHaveBeenCalledTimes(1);
    expect(ffmpegMocks.exec.mock.calls[1]?.[0]).toContain('mpeg4');
    expect(screen.getByRole('button', { name: /Download clip_trimmed\.mp4/ })).toBeInTheDocument();
  });

  it('shows an error when the uploaded file cannot be read', async () => {
    const file = new File(['video'], 'broken.webm', { type: 'video/webm' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('read failed')),
    });

    render(<MovieTrimmer />);

    const input = screen.getByLabelText('File Upload');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('動画ファイルの読み込みに失敗しました: read failed')).toBeInTheDocument();
    });

    expect(document.querySelector('video')).toBeNull();
  });

  it('restores numeric inputs when invalid values are committed', async () => {
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    });

    render(<MovieTrimmer />);

    await userEvent.upload(screen.getByLabelText('File Upload'), file);

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 8.4 });
    fireEvent.loadedMetadata(video);

    const startInput = screen.getByLabelText('開始 (秒)');
    const endInput = screen.getByLabelText('終了 (秒)');

    await userEvent.clear(startInput);
    await userEvent.type(startInput, 'abc');
    fireEvent.blur(startInput);

    await userEvent.clear(endInput);
    await userEvent.type(endInput, 'xyz');
    fireEvent.keyDown(endInput, { key: 'Enter' });

    await waitFor(() => {
      expect(startInput).toHaveValue('0.0');
      expect(endInput).toHaveValue('8.4');
    });
  });

  it('shows ffmpeg errors when both trim strategies fail', async () => {
    const file = new File(['video'], 'clip.webm', { type: 'video/webm' });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(new Uint8Array([9, 8, 7]).buffer),
    });

    ffmpegMocks.exec
      .mockRejectedValueOnce(new Error('copy failed'))
      .mockRejectedValueOnce(new Error('encode failed'));

    render(<MovieTrimmer />);

    await userEvent.upload(screen.getByLabelText('File Upload'), file);

    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 6 });
    fireEvent.loadedMetadata(video);

    await userEvent.click(screen.getByRole('button', { name: 'Trim' }));

    await waitFor(() => {
      expect(screen.getByText('エラー: encode failed')).toBeInTheDocument();
    });

    expect(ffmpegMocks.readFile).not.toHaveBeenCalled();
  });
});
