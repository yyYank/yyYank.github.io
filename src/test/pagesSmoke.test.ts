import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(root, ...parts), 'utf8');
}

const topLevelPages = [
  ['src/pages/404.astro', 'BaseLayout title="404 - Page Not Found"'],
  ['src/pages/diary.astro', '<HeadacheDiary client:load />'],
  ['src/pages/feeds.astro', '<FeedReader client:load />'],
  ['src/pages/index.astro', '<PagesSection client:load />'],
  ['src/pages/toolkit.astro', '<CharCount client:load />'],
  ['src/pages/toolkit.astro', '<ImagePaste client:load />'],
  ['src/pages/toolkit.astro', '<MovieTrimmer client:load />'],
  ['src/pages/toolkit.astro', '<MovToMp4Converter client:load />'],
  ['src/pages/toolkit.astro', '<OcrTool />'],
  ['src/pages/toolkit.astro', '<PasswordGenerator client:load />'],
  ['src/pages/toolkit.astro', '<AudioTrimmer client:load />'],
  ['src/pages/snippet.astro', '<SnippetSearch client:load snippets={allSnippets} />'],
  ['src/pages/transient.astro', '<TransientNotes client:load />'],
] as const;

describe('page smoke checks', () => {
  it.each(topLevelPages)('%s keeps its primary content wiring', (pagePath, marker) => {
    const body = read(pagePath);
    expect(body).toContain(marker);
  });

  it('keeps docs index wired to the Astro v6 id helper', () => {
    const body = read('src/pages/docs/index.astro');
    expect(body).toContain("import { isTopLevelIndexId } from '../../lib/content';");
    expect(body).toContain(".filter((doc) => !isTopLevelIndexId(doc.id))");
  });

  it('keeps kotlin-rev index wired to the Astro v6 id helper', () => {
    const body = read('src/pages/kotlin-rev/index.astro');
    expect(body).toContain("import { isTopLevelIndexId } from '../../lib/content';");
    expect(body).toContain("const indexDoc = allDocs.find((doc) => isTopLevelIndexId(doc.id));");
    expect(body).toContain("throw new Error('kotlinrev index document is missing.')");
  });
});
