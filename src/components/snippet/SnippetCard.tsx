import CopyButton from './CopyButton';

export interface Snippet {
  id: string;
  title: string;
  code: string;
  lang: string;
  source: string;
  sourceTitle: string;
  description: string;
  tags: string[];
}

interface SnippetCardProps {
  snippet: Snippet;
  query: string;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-accent-cyan/30 text-white rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function SnippetCard({ snippet, query }: SnippetCardProps) {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg p-4 hover:border-accent-cyan/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-white font-medium text-sm">
          {highlightMatch(snippet.title, query)}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 text-xs rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20">
            {snippet.lang}
          </span>
          <span className="px-2 py-0.5 text-xs rounded bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
            {snippet.source}
          </span>
        </div>
      </div>
      {snippet.description && (
        <p className="text-gray-400 text-xs mb-2">{snippet.description}</p>
      )}
      <div className="relative group">
        <pre className="bg-dark-700 border border-dark-500 rounded-lg p-3 overflow-x-auto text-sm text-gray-100 font-mono">
          <code>{highlightMatch(snippet.code, query)}</code>
        </pre>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={snippet.code} />
        </div>
      </div>
    </div>
  );
}
