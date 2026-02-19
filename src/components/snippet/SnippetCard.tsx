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
  isSelected?: boolean;
  index?: number;
  onClick?: () => void;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-accent-cyan/30 text-white px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function SnippetCard({
  snippet,
  query,
  isSelected = false,
  index = 0,
  onClick,
}: SnippetCardProps) {
  const codeLines = snippet.code.split('\n');

  return (
    <div
      className={`fzf-item border-b border-dark-700 last:border-b-0 cursor-pointer select-none transition-colors duration-100 ${
        isSelected ? 'bg-dark-700' : 'hover:bg-dark-800'
      }`}
      style={{ animationDelay: `${Math.min(index * 20, 250)}ms` }}
      onClick={onClick}
    >
      {/* Title row */}
      <div className="flex items-center gap-2 px-2 py-1.5 font-mono text-sm">
        <span
          className="w-4 shrink-0 text-accent-cyan transition-opacity duration-100"
          style={{ opacity: isSelected ? 1 : 0 }}
        >
          {'>'}
        </span>
        <span
          className={`flex-1 truncate transition-colors duration-100 ${
            isSelected ? 'text-white' : 'text-gray-300'
          }`}
        >
          {highlightMatch(snippet.title, query)}
        </span>
        <span className="text-xs text-accent-cyan/50 shrink-0">{snippet.lang}</span>
        <span className="text-xs text-gray-700 shrink-0 max-w-[8rem] truncate">
          {snippet.source}
        </span>
      </div>

      {/* Code preview */}
      <div className="relative ml-8 mr-2 mb-2">
        <pre
          className={`text-xs font-mono overflow-hidden transition-all duration-200 ${
            isSelected ? 'text-gray-300' : 'text-gray-600'
          }`}
          style={{
            maxHeight: isSelected ? '400px' : '3.6em',
            overflow: isSelected ? 'auto' : 'hidden',
          }}
        >
          <code>{highlightMatch(snippet.code, query)}</code>
        </pre>
        {!isSelected && codeLines.length > 3 && (
          <span className="text-gray-700 text-xs">··· {codeLines.length} lines</span>
        )}
        {isSelected && (
          <div className="absolute top-0 right-0">
            <CopyButton text={snippet.code} />
          </div>
        )}
      </div>
    </div>
  );
}
