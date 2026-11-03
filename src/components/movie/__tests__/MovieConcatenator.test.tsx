import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MovieConcatenator from '../MovieConcatenator';

const mocks = vi.hoisted(() => {
  const writeFile = vi.fn();
  const exec = vi.fn();
  const readFile = vi.fn();
  const deleteFile = vi.fn();
  const getFFmpeg = vi.fn(async () => ({ writeFile, exec, readFile, deleteFile }));
  return { writeFile, exec, readFile, deleteFile, getFFmpeg };
});

vi.mock('../../../lib/ffmpeg', () => ({
  getFFmpeg: mocks.getFFmpeg,
}));

function createMp4(name: string, bytes: number[]): File {
  const file = new File(['video'], name, { type: 'video/mp4' });
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: vi.fn().mockResolvedValue(new Uint8Array(bytes).buffer),
  });
  return file;
}

// ffmpeg に書き込まれた入力ファイル名と中身の対応を作る
function writtenInputs(): Map<string, number[]> {
  return new Map(
    mocks.writeFile.mock.calls
      .filter((call) => call[1] instanceof Uint8Array)
      .map((call) => [call[0] as string, Array.from(call[1] as Uint8Array)])
  );
}

// concat 用リストに並んだ入力ファイルの中身を、リストの順番で返す
function concatenatedContents(): number[][] {
  const listCall = mocks.writeFile.mock.calls.find((call) => typeof call[1] === 'string');
  const names = [...(listCall?.[1] as string).matchAll(/file '([^']+)'/g)].map((m) => m[1]);
  const inputs = writtenInputs();
  return names.map((name) => inputs.get(name) ?? []);
}

describe('MovieConcatenator', () => {
  beforeEach(() => {
    mocks.writeFile.mockReset();
    mocks.exec.mockReset();
    mocks.readFile.mockReset();
    mocks.deleteFile.mockReset();
    mocks.exec.mockResolvedValue(0);
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

  // 順番を入れ替えてから連結すると、入れ替え後の順番で再エンコードなしに連結され、ダウンロードできること
  it('concatenates files in the reordered order with stream copy and offers a download', async () => {
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

    expect(concatenatedContents()).toEqual([[1], [3], [2]]);
    const args = mocks.exec.mock.calls[0]?.[0] as string[];
    expect(args).toContain('copy');
    expect(args).not.toContain('-filter_complex');
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

    expect(concatenatedContents()).toEqual([[1], [3]]);
  });

  // ffmpeg が失敗(戻り値が0以外)したら、エラーを表示してダウンロードもプレビューも出さないこと
  it('shows an error instead of a download when ffmpeg fails', async () => {
    mocks.exec.mockResolvedValue(1);
    render(<MovieConcatenator />);

    await userEvent.upload(screen.getByLabelText('MP4 Files'), [
      createMp4('a.mp4', [1]),
      createMp4('b.mp4', [2]),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Concat' }));

    expect(await screen.findByText(/エラー/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('連結結果のプレビュー')).not.toBeInTheDocument();
  });

  // 出力が 0B のときは、エラーを表示してダウンロードを出さないこと
  it('shows an error instead of a download when the output is empty', async () => {
    mocks.readFile.mockResolvedValue(new Uint8Array([]));
    render(<MovieConcatenator />);

    await userEvent.upload(screen.getByLabelText('MP4 Files'), [
      createMp4('a.mp4', [1]),
      createMp4('b.mp4', [2]),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Concat' }));

    expect(await screen.findByText(/エラー/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download/ })).not.toBeInTheDocument();
  });
});
