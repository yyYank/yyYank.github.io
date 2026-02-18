import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, '..', 'content', 'docs');
const outDir = join(__dirname, '..', 'data');
const outFile = join(outDir, 'snippets.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: '', body: content };
  const fm = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*"?([^"]*)"?$/);
    if (m) fm[m[1]] = m[2];
  }
  return { ...fm, body: content.slice(match[0].length).trim() };
}

function extractSnippets(body, docTitle, source) {
  const snippets = [];
  const lines = body.split('\n');
  let currentH2 = '';
  let currentH3 = '';
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines = [];
  let descLines = [];

  for (const line of lines) {
    if (inCodeBlock) {
      if (line.startsWith('```')) {
        // End of code block
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

// Main
const files = readdirSync(docsDir).filter(f => f.endsWith('.mdx'));
const allSnippets = [];

for (const file of files) {
  const content = readFileSync(join(docsDir, file), 'utf-8');
  const { title, body } = parseFrontmatter(content);
  const source = file.replace('.mdx', '');
  const snippets = extractSnippets(body, title, source);
  allSnippets.push(...snippets);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(allSnippets, null, 2));
console.log(`Generated ${allSnippets.length} snippets → ${outFile}`);
