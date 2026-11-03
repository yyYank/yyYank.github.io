import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MovieConcatenator from '../MovieConcatenator';

const mocks = vi.hoisted(() => {
  const writeFile = vi.fn();
  const exec = vi.fn();
  const readFile = vi.fn();
  const getFFmpeg = vi.fn(async () => ({ writeFile, exec, readFile }));
  const readVideoSize = vi.fn(async () => ({ width: 1280, height: 720 }));
  return { writeFile, exec, readFile, getFFmpeg, readVideoSize };
});

vi.mock('../../../lib/ffmpeg', () => ({
  getFFmpeg: mocks.getFFmpeg,
}));

vi.mock('../videoSize', () => ({
  readVideoSize: mocks.readVideoSize,
}));

function createMp4(name: string, bytes: number[]): File {
  const file = new File(['video'], name, { type: 'video/mp4' });
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: vi.fn().mockResolvedValue(new Uint8Array(bytes).buffer),
  });
  return file;
}

describe('MovieConcatenator', () => {
  beforeEach(() => {
    mocks.writeFile.mockReset();
    mocks.exec.mockReset();
    mocks.readFile.mockReset();
    mocks.readVideoSize.mockClear();
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:movie'),
      revokeObjectURL: vi.fn(),
    });
  });

  // ファイルが2本未満のときは連結ボタンが押せないこと
  it('disables concat until at least two files are selected', async () => {
    render(<MovieConcatenator />);

    expect(screen.getByRole('button', { name: 'Concat' })).toBeDisabled();

    await userEvent.upload(screen.getByLabelText('MP4 Files'), [createMp4('a.mp4', [1])]);

    expect(screen.getByRole('button', { name: 'Concat' })).toBeDisabled();
  });

  // 順番を入れ替えてから連結すると、入れ替え後の順番で書き込み・連結され、ダウンロードできること
  it('concatenates files in the reordered order and offers a download', async () => {
    render(<MovieConcatenator />);

    await userEvent.upload(screen.getByLabelText('MP4 Files'), [
      createMp4('a.mp4', [1]),
      createMp4('b.mp4', [2]),
      createMp4('c.mp4', [3]),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'c.mp4 を上へ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Concat' }));

    await waitFor(() => {
      expect(mocks.exec).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /Download a_concat\.mp4/ })).toBeInTheDocument();
    });

    expect(mocks.writeFile.mock.calls.map((call) => Array.from(call[1] as Uint8Array))).toEqual([[1], [3], [2]]);
    expect(mocks.readVideoSize).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.mp4' }));
    expect(mocks.exec.mock.calls[0]?.[0]).toContain('output.mp4');
  });

  // 連結が終わると、結果の動画がプレビューとして再生できる状態で表示されること
  it('shows a preview of the concatenated movie', async () => {
    render(<MovieConcatenator />);

    expect(screen.queryByLabelText('連結結果のプレビュー')).not.toBeInTheDocument();

    await userEvent.upload(screen.getByLabelText('MP4 Files'), [
      createMp4('a.mp4', [1]),
      createMp4('b.mp4', [2]),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Concat' }));

    const preview = await screen.findByLabelText('連結結果のプレビュー');
    expect(preview.tagName).toBe('VIDEO');
    expect(preview).toHaveAttribute('src', 'blob:movie');
    expect(preview).toHaveAttribute('controls');
  });

  // 一覧から削除したファイルは連結対象に含まれないこと
  it('excludes removed files from concatenation', async () => {
    render(<MovieConcatenator />);

    await userEvent.upload(screen.getByLabelText('MP4 Files'), [
      createMp4('a.mp4', [1]),
      createMp4('b.mp4', [2]),
      createMp4('c.mp4', [3]),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'b.mp4 を削除' }));
    await userEvent.click(screen.getByRole('button', { name: 'Concat' }));

    await waitFor(() => {
      expect(mocks.exec).toHaveBeenCalledTimes(1);
    });

    expect(mocks.writeFile).toHaveBeenCalledTimes(2);
  });
});
