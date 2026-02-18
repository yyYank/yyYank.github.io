import { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import SnippetCard from './SnippetCard';
import type { Snippet } from './SnippetCard';

interface SnippetSearchProps {
  snippets: Snippet[];
}

export default function SnippetSearch({ snippets }: SnippetSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse initial state from URL
  const params = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const [query, setQuery] = useState(params.get('q') || '');
  const [selectedLang, setSelectedLang] = useState(params.get('lang') || '');
  const [selectedTag, setSelectedTag] = useState(params.get('tag') || '');

  // Derive available languages and tags
  const languages = useMemo(
    () => [...new Set(snippets.map((s) => s.lang))].sort(),
    [snippets]
  );
  const tags = useMemo(
    () => [...new Set(snippets.flatMap((s) => s.tags))].sort(),
    [snippets]
  );

  // Fuse.js instance
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

  // Filter and search
  const results = useMemo(() => {
    let filtered = snippets;

    if (selectedLang) {
      filtered = filtered.filter((s) => s.lang === selectedLang);
    }
    if (selectedTag) {
      filtered = filtered.filter((s) => s.tags.includes(selectedTag));
    }

    if (!query.trim()) return filtered;

    // Search within filtered set
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

  // `/` key to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search snippets... (press / to focus)"
            className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-colors"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs text-gray-500 bg-dark-700 border border-dark-500 rounded">
            /
          </kbd>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-accent-cyan"
        >
          <option value="">All Languages</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-accent-cyan"
        >
          <option value="">All Tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>

        {(query || selectedLang || selectedTag) && (
          <button
            onClick={() => {
              setQuery('');
              setSelectedLang('');
              setSelectedTag('');
            }}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-sm text-gray-500 self-center">
          {results.length} snippet{results.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Results */}
      <div className="grid gap-4">
        {results.length > 0 ? (
          results.map((snippet) => (
            <SnippetCard key={snippet.id} snippet={snippet} query={query} />
          ))
        ) : (
          <div className="text-center py-12 text-gray-500">
            No snippets found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}
