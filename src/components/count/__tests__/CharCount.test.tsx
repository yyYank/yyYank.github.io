import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CharCount from '../CharCount';

describe('CharCount', () => {
  // 入力と同時に文字数が変わること
  it('入力した文字数をその場で表示する', () => {
    render(<CharCount />);
    const input = screen.getByRole('textbox');
    fireEvent.input(input, { target: { value: 'あいうえお' } });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('空のときは0文字と表示する', () => {
    render(<CharCount />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('文字')).toBeInTheDocument();
  });
});
