import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PasswordGenerator from '../PasswordGenerator';

const writeText = vi.fn(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

const passwords = () =>
  screen.queryAllByRole('listitem').map((el) => el.querySelector('code')?.textContent ?? '');

describe('PasswordGenerator', () => {
  beforeEach(() => {
    writeText.mockClear();
  });

  // 開いた時点で結果が出ていること（生成ボタンを押さなくてよい）
  it('初期表示で16文字のパスワードを10件表示する', () => {
    render(<PasswordGenerator />);
    const list = passwords();
    expect(list).toHaveLength(10);
    list.forEach((pw) => expect(pw).toHaveLength(16));
  });

  // 生成ボタンは置かない
  it('生成ボタンを表示しない', () => {
    render(<PasswordGenerator />);
    expect(screen.queryByRole('button', { name: '生成' })).not.toBeInTheDocument();
  });

  // 設定を変えたらその場で作り直すこと
  it('文字数を変えるとその長さで作り直す', () => {
    render(<PasswordGenerator />);
    fireEvent.change(screen.getByLabelText('文字数'), { target: { value: '8' } });
    passwords().forEach((pw) => expect(pw).toHaveLength(8));
  });

  it('半角英字を外すと数字だけで作り直す', () => {
    render(<PasswordGenerator />);
    fireEvent.click(screen.getByLabelText('半角英字'));
    passwords().forEach((pw) => expect(pw).toMatch(/^[0-9]+$/));
  });

  // 文字種がすべて外れたときは結果を出さない
  it('文字種をすべて外すと結果を表示しない', () => {
    render(<PasswordGenerator />);
    fireEvent.click(screen.getByLabelText('半角英字'));
    fireEvent.click(screen.getByLabelText('数字'));
    expect(passwords()).toHaveLength(0);
  });

  // コピー完了の言葉がサイト共通の「コピーしました」であること
  it('コピーすると「コピーしました」と表示する', async () => {
    render(<PasswordGenerator />);
    const first = passwords()[0];
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
    await waitFor(() => expect(screen.getByText('コピーしました')).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(first);
  });
});
