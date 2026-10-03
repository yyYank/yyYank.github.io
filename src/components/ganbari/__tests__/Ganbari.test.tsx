import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import Ganbari from '../Ganbari';
import { GANBARI_STORAGE_KEY } from '../ganbariData';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('Ganbari', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });
    storage.setItem(GANBARI_STORAGE_KEY, JSON.stringify({
      people: [{ id: 'person-1', name: 'ゆう' }],
      records: [
        { id: '1', personId: 'person-1', date: '2026-10-01', content: 'そうじ', stamp: '⭐', createdAt: '', kind: 'otetsudai' },
        { id: '2', personId: 'person-1', date: '2026-10-02', content: 'ピアノ', stamp: '⭐', createdAt: '', kind: 'naraigoto' },
        { id: '3', personId: 'person-1', date: '2026-10-03', content: 'すいえい', stamp: '🌊', createdAt: '', kind: 'naraigoto' },
      ],
    }));
  });

  it('2種類のポイントを別々に表示し、タブで切り替える', async () => {
    render(<Ganbari />);

    expect(await screen.findByRole('tab', { name: /おてつだい.*1 ポイント/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /ならいごと.*2 ポイント/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByText('ゆうの おてつだい ごうけい')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /ならいごと.*2 ポイント/ }));

    expect(screen.getByText('ゆうの ならいごと ごうけい')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ならいごと.*2 ポイント/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('ならいごとタブから追加した記録を、ならいごとポイントとして保存する', async () => {
    render(<Ganbari />);
    await userEvent.click(await screen.findByRole('tab', { name: /ならいごと.*2 ポイント/ }));
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.type(screen.getByPlaceholderText('なにをがんばったかな？'), 'えいご');
    await userEvent.click(screen.getByRole('button', { name: 'きろくする' }));

    const saved = JSON.parse(storage.getItem(GANBARI_STORAGE_KEY) ?? '{}');
    expect(saved.records).toContainEqual(expect.objectContaining({
      content: 'えいご',
      kind: 'naraigoto',
    }));
    expect(screen.getByRole('tab', { name: /ならいごと.*3 ポイント/ })).toBeInTheDocument();
  });

  it('スタンプ図鑑に取得種類数と所持数を表示する', async () => {
    render(<Ganbari />);

    const openButton = await screen.findByRole('button', { name: /スタンプずかん.*2\/100/ });
    expect(screen.queryByLabelText('⭐ 2こ')).not.toBeInTheDocument();

    await userEvent.click(openButton);

    expect(screen.getByLabelText('⭐ 2こ')).toHaveTextContent('×2');
    expect(screen.getByLabelText('🌊 1こ')).toHaveTextContent('×1');
  });
});
