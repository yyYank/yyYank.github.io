import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PagesSection from '../PagesSection';

function stripMotionProps<T extends Record<string, unknown>>(props: T) {
  const {
    animate,
    exit,
    initial,
    transition,
    whileHover,
    ...rest
  } = props;

  void animate;
  void exit;
  void initial;
  void transition;
  void whileHover;

  return rest;
}

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...stripMotionProps(props)}>{children}</span>
    ),
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...stripMotionProps(props)}>{children}</div>
    ),
    a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a {...stripMotionProps(props)}>{children}</a>
    ),
  },
}));

describe('PagesSection', () => {
  it('shows the movie and audio tools after opening the section', async () => {
    render(<PagesSection />);

    await userEvent.click(screen.getByRole('button', { name: /Pages/i }));

    expect(screen.getByRole('link', { name: /Movie Tool/ })).toHaveAttribute('href', '/movie/');
    expect(screen.getByRole('link', { name: /Audio Tool/ })).toHaveAttribute('href', '/sounds/');
  });

  it('hides page links until the section is opened', () => {
    render(<PagesSection />);

    expect(screen.queryByRole('link', { name: /Movie Tool/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Audio Tool/ })).not.toBeInTheDocument();
  });
});
