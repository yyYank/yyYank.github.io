import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HeadacheDiary from '../HeadacheDiary';

const writeText = vi.fn(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

const ENTRIES = [
  { id: '3', datetime: '2026/09/25 09:30', tokyo: '晴れ 20℃', osaka: '曇り 21℃' },
  { id: '2', datetime: '2026/09/24 22:10', tokyo: '雨 18℃', osaka: '雨 19℃' },
  { id: '1', datetime: '2026/09/24 08:05', tokyo: '曇り 17℃', osaka: '晴れ 19℃' },
];

describe('HeadacheDiary', () => {
  beforeEach(() => {
    localStorage.setItem('headache-diary', JSON.stringify(ENTRIES));
    writeText.mockClear();
  });

  // 記録を日付の見出しでまとめること（Tweek の日ごとの列）
  it('記録を日付ごとの見出しでまとめる', async () => {
    render(<HeadacheDiary />);
    const headings = await screen.findAllByRole('heading');
    expect(headings.map((h) => h.textContent)).toEqual(['2026/09/25', '2026/09/24']);
  });

  // 見出しの下の行には時刻と天気を出し、日付は繰り返さない
  it('各行には時刻と天気を表示する', async () => {
    render(<HeadacheDiary />);
    const day = (await screen.findByRole('heading', { name: '2026/09/24' })).closest('section')!;
    const rows = within(day).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('22:10');
    expect(rows[0]).toHaveTextContent('東京:雨 18℃');
    expect(rows[0]).not.toHaveTextContent('2026/09/24');
  });

  // コピーする内容は今までと同じマークダウンで、言葉は「コピーしました」
  it('コピーすると「コピーしました」と表示し、マークダウンは変えない', async () => {
    render(<HeadacheDiary />);
    await screen.findAllByRole('heading');
    fireEvent.click(screen.getByRole('button', { name: 'マークダウンにコピー' }));
    await waitFor(() => expect(screen.getByText('コピーしました')).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(
      [
        '- 頭痛あり 2026/09/25 09:30、東京:晴れ 20℃ 大阪:曇り 21℃',
        '- 頭痛あり 2026/09/24 22:10、東京:雨 18℃ 大阪:雨 19℃',
        '- 頭痛あり 2026/09/24 08:05、東京:曇り 17℃ 大阪:晴れ 19℃',
      ].join('\n'),
    );
  });

  // 削除すると該当の行だけ消え、空になった日の見出しも消える
  it('削除した行が消え、空になった日の見出しも消える', async () => {
    render(<HeadacheDiary />);
    const day = (await screen.findByRole('heading', { name: '2026/09/25' })).closest('section')!;
    fireEvent.click(within(day).getByRole('button', { name: '削除' }));
    // 縮んで消える演出のあとに取り除かれる
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: '2026/09/25' })).not.toBeInTheDocument(),
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
