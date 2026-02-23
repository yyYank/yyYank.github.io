import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import FuzzySearchBar from '../FuzzySearchBar';

describe('FuzzySearchBar', () => {
  const defaultProps = {
    query: '',
    onChange: vi.fn(),
    resultCount: 5,
    totalCount: 10,
  };

  it('renders prompt, placeholder, and count', () => {
    render(<FuzzySearchBar {...defaultProps} />);
    expect(screen.getByText('>')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('fuzzy search...')).toBeInTheDocument();
    expect(screen.getByText('5/10')).toBeInTheDocument();
  });

  it('calls onChange on text input', async () => {
    const onChange = vi.fn();
    render(<FuzzySearchBar {...defaultProps} onChange={onChange} />);
    const input = screen.getByPlaceholderText('fuzzy search...');
    await userEvent.type(input, 'ab');
    expect(onChange).toHaveBeenCalledTimes(2);
    // Controlled component with static query='': each keystroke yields single char
    expect(onChange).toHaveBeenNthCalledWith(1, 'a');
    expect(onChange).toHaveBeenNthCalledWith(2, 'b');
  });

  it('shows spinner character when query is non-empty', () => {
    render(<FuzzySearchBar {...defaultProps} query="test" />);
    // When query is non-empty, prompt should be one of the spinner chars, not '>'
    expect(screen.queryByText('>')).not.toBeInTheDocument();
  });

  it('displays custom resultCount/totalCount', () => {
    render(<FuzzySearchBar {...defaultProps} resultCount={3} totalCount={42} />);
    expect(screen.getByText('3/42')).toBeInTheDocument();
  });

  it('accepts custom placeholder', () => {
    render(<FuzzySearchBar {...defaultProps} placeholder="search feeds..." />);
    expect(screen.getByPlaceholderText('search feeds...')).toBeInTheDocument();
  });
});
