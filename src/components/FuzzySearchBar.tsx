import { useState, useEffect, useRef } from 'react';

interface FuzzySearchBarProps {
  query: string;
  onChange: (query: string) => void;
  resultCount: number;
  totalCount: number;
  placeholder?: string;
  autoFocus?: boolean;
}

const SPINNER_CHARS = ['|', '/', '-', '\\'];

export default function FuzzySearchBar({
  query,
  onChange,
  resultCount,
  totalCount,
  placeholder = 'fuzzy search...',
  autoFocus = true,
}: FuzzySearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  // Spinner animation while searching
  useEffect(() => {
    if (!query.trim()) return;
    const interval = setInterval(() => {
      setSpinnerIndex((i) => (i + 1) % SPINNER_CHARS.length);
    }, 120);
    return () => clearInterval(interval);
  }, [query]);

  // `/` key to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="mb-3">
      <div className="flex items-center border border-dark-600 focus-within:border-accent-cyan transition-colors duration-200">
        <span className="px-3 text-accent-cyan select-none font-bold">
          {query.trim() ? SPINNER_CHARS[spinnerIndex] : '>'}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 py-2.5 bg-transparent text-white placeholder-gray-600 focus:outline-none"
          autoFocus={autoFocus}
        />
        <span className="px-3 text-xs text-gray-600">
          {resultCount}/{totalCount}
        </span>
        <kbd className="mr-2 px-1.5 py-0.5 text-xs text-gray-600 bg-dark-700 border border-dark-600">
          /
        </kbd>
      </div>
    </div>
  );
}
