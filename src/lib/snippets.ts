import { getCollection } from 'astro:content';
import type { Snippet } from '../components/snippet/SnippetCard';

export function extractSnippets(body: string, docTitle: string, source: string): Snippet[] {
  const snippets: Snippet[] = [];
  const lines = body.split('\n');
  let currentH2 = '';
  let currentH3 = '';
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let descLines: string[] = [];

  for (const line of lines) {
    if (inCodeBlock) {
      if (line.startsWith('```')) {
        inCodeBlock = false;
        const title = currentH3 || currentH2;
        if (title && codeLines.length > 0) {
          snippets.push({
            id: `${source}-${snippets.length}`,
            title,
            code: codeLines.join('\n'),
            lang: codeLang || 'text',
            source,
            sourceTitle: docTitle,
            description: descLines.join(' ').trim(),
            tags: [source],
          });
        }
        codeLines = [];
        codeLang = '';
        descLines = [];
      } else {
        codeLines.push(line);
      }
      continue;
    }

    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);
    const codeStart = line.match(/^```(\w*)/);

    if (h2Match) {
      currentH2 = h2Match[1].trim();
      currentH3 = '';
      descLines = [];
    } else if (h3Match) {
      currentH3 = h3Match[1].trim();
      descLines = [];
    } else if (codeStart) {
      inCodeBlock = true;
      codeLang = codeStart[1] || '';
    } else if (line.trim() && !line.startsWith('#')) {
      descLines.push(line.trim());
    }
  }

  return snippets;
}

export async function loadAllSnippets(): Promise<Snippet[]> {
  const docs = await getCollection('docs', ({ data }) => !data.draft);
  return docs.flatMap((doc) => extractSnippets(doc.body, doc.data.title, doc.id));
}
