import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(root, ...parts), 'utf8');
}

describe('Astro v6 migration files', () => {
  it('pins Node 22.12.0 in .nvmrc', () => {
    expect(read('.nvmrc').trim()).toBe('22.12.0');
  });

  it('uses Node 22 in all GitHub Actions workflows', () => {
    const workflowDir = path.join(root, '.github', 'workflows');
    const workflows = fs.readdirSync(workflowDir).filter((name) => name.endsWith('.yml'));

    for (const workflow of workflows) {
      const body = read('.github', 'workflows', workflow);
      expect(body).toMatch(/node-version:\s*'22'/);
    }
  });

  it('uses the new Astro content config path', () => {
    expect(fs.existsSync(path.join(root, 'src', 'content.config.ts'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src', 'content', 'config.ts'))).toBe(false);
  });

  it('loads Tailwind through ESM config files', () => {
    expect(read('tailwind.config.js')).toMatch(/import typography from '@tailwindcss\/typography';/);
    expect(read('astro.config.mjs')).toMatch(/import tailwindcss from 'tailwindcss';/);
    expect(read('astro.config.mjs')).not.toMatch(/@astrojs\/tailwind/);
  });

  it('keeps the movie page wired into the site navigation', () => {
    expect(read('src', 'pages', 'movie.astro')).toMatch(/<MovieTrimmer client:load \/>/);
    expect(read('src', 'components', 'Header.astro')).toMatch(/\{ href: '\/movie\/', label: 'Movie' \}/);
    expect(read('src', 'components', 'PagesSection.tsx')).toMatch(/\{ href: '\/movie\/', label: 'Movie Tool', desc: '動画トリミング' \}/);
  });
});
