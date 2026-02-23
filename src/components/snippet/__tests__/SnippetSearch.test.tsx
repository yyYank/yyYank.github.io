import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SnippetSearch from '../SnippetSearch';
import type { Snippet } from '../SnippetCard';

// Mock SnippetCard to simplify testing
vi.mock('../SnippetCard', () => ({
  default: ({ snippet }: { snippet: Snippet }) => (
    <div data-testid={`snippet-${snippet.id}`}>{snippet.title}</div>
  ),
}));

const mockSnippets: Snippet[] = [
  {
    id: '1',
    title: 'Hello World',
    code: 'console.log("hello")',
    lang: 'javascript',
    source: 'https://example.com',
    sourceTitle: 'Example',
    description: 'A hello world snippet',
    tags: ['beginner', 'console'],
  },
  {
    id: '2',
    title: 'Fetch API',
    code: 'fetch("/api")',
    lang: 'typescript',
    source: 'https://example.com',
    sourceTitle: 'Example',
    description: 'Fetch example',
    tags: ['api', 'network'],
  },
  {
    id: '3',
    title: 'Rust Main',
    code: 'fn main() {}',
    lang: 'rust',
    source: 'https://example.com',
    sourceTitle: 'Example',
    description: 'Rust entry point',
    tags: ['beginner'],
  },
];

describe('SnippetSearch', () => {
  beforeEach(() => {
    // Reset URL params
    window.history.replaceState({}, '', '/');
  });

  it('renders FuzzySearchBar and filter selects', () => {
    render(<SnippetSearch snippets={mockSnippets} />);
    expect(screen.getByPlaceholderText('fuzzy search...')).toBeInTheDocument();
    expect(screen.getByDisplayValue('lang:all')).toBeInTheDocument();
    expect(screen.getByDisplayValue('tag:all')).toBeInTheDocument();
  });

  it('shows all snippets initially', () => {
    render(<SnippetSearch snippets={mockSnippets} />);
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.getByTestId('snippet-1')).toBeInTheDocument();
    expect(screen.getByTestId('snippet-2')).toBeInTheDocument();
    expect(screen.getByTestId('snippet-3')).toBeInTheDocument();
  });

  it('filters by language select', async () => {
    render(<SnippetSearch snippets={mockSnippets} />);
    const langSelect = screen.getByDisplayValue('lang:all');
    await userEvent.selectOptions(langSelect, 'rust');
    expect(screen.getByTestId('snippet-3')).toBeInTheDocument();
    expect(screen.queryByTestId('snippet-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('snippet-2')).not.toBeInTheDocument();
  });

  it('filters by tag select', async () => {
    render(<SnippetSearch snippets={mockSnippets} />);
    const tagSelect = screen.getByDisplayValue('tag:all');
    await userEvent.selectOptions(tagSelect, 'api');
    expect(screen.getByTestId('snippet-2')).toBeInTheDocument();
    expect(screen.queryByTestId('snippet-1')).not.toBeInTheDocument();
  });

  it('fuzzy searches by query', async () => {
    render(<SnippetSearch snippets={mockSnippets} />);
    const input = screen.getByPlaceholderText('fuzzy search...');
    await userEvent.type(input, 'Fetch');
    // Fuse.js should match "Fetch API"
    expect(screen.getByTestId('snippet-2')).toBeInTheDocument();
  });
});
