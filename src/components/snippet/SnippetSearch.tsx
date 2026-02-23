import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import SnippetCard from './SnippetCard';
import type { Snippet } from './SnippetCard';
import FuzzySearchBar from '../FuzzySearchBar';

interface SnippetSearchProps {
  snippets: Snippet[];
}

export default function SnippetSearch({ snippets }: SnippetSearchProps) {
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const [query, setQuery] = useState(params.get('q') || '');
  const [selectedLang, setSelectedLang] = useState(params.get('lang') || '');
  const [selectedTag, setSelectedTag] = useState(params.get('tag') || '');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const languages = useMemo(
    () => [...new Set(snippets.map((s) => s.lang))].sort(),
    [snippets]
  );
  const tags = useMemo(
    () => [...new Set(snippets.flatMap((s) => s.tags))].sort(),
    [snippets]
  );

  const fuse = useMemo(
    () =>
      new Fuse(snippets, {
        keys: [
          { name: 'title', weight: 0.4 },
          { name: 'code', weight: 0.3 },
          { name: 'source', weight: 0.15 },
          { name: 'description', weight: 0.1 },
          { name: 'lang', weight: 0.05 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [snippets]
  );

  const results = useMemo(() => {
    let filtered = snippets;
    if (selectedLang) filtered = filtered.filter((s) => s.lang === selectedLang);
    if (selectedTag) filtered = filtered.filter((s) => s.tags.includes(selectedTag));
    if (!query.trim()) return filtered;

    const searchBase = selectedLang || selectedTag ? filtered : snippets;
    const fuseForSearch =
      searchBase === snippets
        ? fuse
        : new Fuse(searchBase, {
            keys: [
              { name: 'title', weight: 0.4 },
              { name: 'code', weight: 0.3 },
              { name: 'source', weight: 0.15 },
              { name: 'description', weight: 0.1 },
              { name: 'lang', weight: 0.05 },
            ],
            threshold: 0.4,
            includeScore: true,
          });

    return fuseForSearch.search(query).map((r) => r.item);
  }, [query, selectedLang, selectedTag, snippets, fuse]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedLang, selectedTag]);

  // Update URL params
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    if (selectedLang) url.searchParams.set('lang', selectedLang);
    else url.searchParams.delete('lang');
    if (selectedTag) url.searchParams.set('tag', selectedTag);
    else url.searchParams.delete('tag');
    window.history.replaceState({}, '', url.toString());
  }, [query, selectedLang, selectedTag]);

  // Keyboard navigation (ArrowUp/Down only; `/` focus is handled by FuzzySearchBar)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results.length]);

  return (
    <div className="font-mono text-sm">
      {/* fzf-style search bar */}
      <FuzzySearchBar
        query={query}
        onChange={setQuery}
        resultCount={results.length}
        totalCount={snippets.length}
      />

      {/* Filters - compact monospace style */}
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="px-2 py-1 bg-dark-800 border border-dark-600 text-gray-400 focus:outline-none focus:border-accent-cyan"
        >
          <option value="">lang:all</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>

        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="px-2 py-1 bg-dark-800 border border-dark-600 text-gray-400 focus:outline-none focus:border-accent-cyan"
        >
          <option value="">tag:all</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        {(query || selectedLang || selectedTag) && (
          <button
            onClick={() => {
              setQuery('');
              setSelectedLang('');
              setSelectedTag('');
            }}
            className="px-2 py-1 text-gray-600 hover:text-gray-300 transition-colors"
          >
            [clear]
          </button>
        )}

        <span className="ml-auto text-gray-700 self-center hidden sm:block">
          ↑↓ navigate · / focus
        </span>
      </div>

      {/* Results - list style */}
      <div className="border border-dark-600">
        {results.length > 0 ? (
          results.map((snippet, i) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              query={query}
              isSelected={i === selectedIndex}
              index={i}
              onClick={() => setSelectedIndex(i)}
            />
          ))
        ) : (
          <div className="px-4 py-10 text-center text-gray-600">
            no results for &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
