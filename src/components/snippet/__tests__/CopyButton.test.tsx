import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CopyButton from '../CopyButton';

const writeText = vi.fn(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

describe('CopyButton', () => {
  // コピー完了の言葉がサイト共通の「コピーしました」であること
  it('コピーすると「コピーしました」と表示する', async () => {
    render(<CopyButton text="val x = 1" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByText('コピーしました')).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('val x = 1');
  });
});
