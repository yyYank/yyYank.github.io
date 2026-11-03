import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MovieConcatenator from '../MovieConcatenator';

const mocks = vi.hoisted(() => {
  const writeFile = vi.fn();
  const exec = vi.fn();
  const readFile = vi.fn();
  const deleteFile = vi.fn();
  const logListeners = new Set<(event: { message: string }) => void>();
  const on = vi.fn((_: string, listener: (event: { message: string }) => void) => logListeners.add(listener));
  const off = vi.fn((_: string, listener: (event: { message: string }) => void) => logListeners.delete(listener));
  const getFFmpeg = vi.fn(async () => ({ writeFile, exec, readFile, deleteFile, on, off }));
  return { writeFile, exec, readFile, deleteFile, on, off, logListeners, getFFmpeg };
});

// 1080x1920 の縦動画(回転情報なし)
const portraitLog = [
  '  Duration: 00:00:02.00, start: 0.000000, bitrate: 5000 kb/s',
  '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1080x1920, 4800 kb/s, 30 fps, 30 tbr, 30k tbn (default)',
  '  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)',
].join('\n');

// 1920x1080 の横動画
const landscapeLog = portraitLog.replace('1080x1920', '1920x1080');

// ffmpeg -i で調べたときに、中身の先頭バイトに応じたログを流す(9 なら横動画、それ以外は縦動画)
function setUpProbe() {
  mocks.exec.mockImplementation(async (args: string[]) => {
    if (args[0] === '-hide_banner') {
      const data = writtenInputs().get(args[2]) ?? [];
      const log = data[0] === 9 ? landscapeLog : portraitLog;
      log.split('\n').forEach((message) => mocks.logListeners.forEach((listener) => listener({ message })));
      return 1;
    }
    return 0;
  });
}

// 調べるための呼び出しを除いた、連結のための ffmpeg 呼び出し
function concatCalls(): string[][] {
  return mocks.exec.mock.calls.map((call) => call[0] as string[]).filter((args) => args[0] !== '-hide_banner');
}

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
    mocks.deleteFile.mockResolvedValue(undefined);
    mocks.logListeners.clear();
    setUpProbe();
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
      expect(concatCalls()).toHaveLength(1);
      expect(screen.getByRole('button', { name: /Download a_concat\.mp4/ })).toBeInTheDocument();
    });

    expect(concatenatedContents()).toEqual([[1], [3], [2]]);
    const args = concatCalls()[0];
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
      expect(concatCalls()).toHaveLength(1);
    });

    expect(concatenatedContents()).toEqual([[1], [3]]);
  });

  // トリムと同じく、ファイルを選んだ時点で中身を読み込んでおくこと(Concat を押すまで読み込みを遅らせない)
  it('reads file contents as soon as files are selected', async () => {
    const a = createMp4('a.mp4', [1]);
    const b = createMp4('b.mp4', [2]);
    render(<MovieConcatenator />);

    await userEvent.upload(screen.getByLabelText('MP4 Files'), [a, b]);

    await waitFor(() => {
      expect(a.arrayBuffer).toHaveBeenCalled();
      expect(b.arrayBuffer).toHaveBeenCalled();
    });
  });

  // 出力サイズを4つから選べ、最初はスマホ縦になっていること
  it('lets the user choose one of four fixed output sizes', () => {
    render(<MovieConcatenator />);

    const select = screen.getByLabelText('出力サイズ');
    expect(select).toHaveValue('スマホ縦');
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.text)).toEqual([
      'スマホ縦 (1080×1920)',
      'スマホ横 (1920×1080)',
      'PC横 (2560×1440)',
      'PC縦 (1440×2560)',
    ]);
  });

  // 縦と横の動画を混ぜると、選んだ出力サイズに収めて再エンコードでつなぐこと
  it('re-encodes into the chosen output size when portrait and landscape are mixed', async () => {
    render(<MovieConcatenator />);

    await userEvent.selectOptions(screen.getByLabelText('出力サイズ'), 'PC横');
    await userEvent.upload(screen.getByLabelText('MP4 Files'), [
      createMp4('a.mp4', [9]),
      createMp4('b.mp4', [1]),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Concat' }));

    await waitFor(() => {
      expect(concatCalls()).toHaveLength(1);
      expect(screen.getByRole('button', { name: /Download a_concat\.mp4/ })).toBeInTheDocument();
    });

    const args = concatCalls()[0];
    const filter = args[args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('pad=2560:1440');
    expect(args).not.toContain('copy');
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
