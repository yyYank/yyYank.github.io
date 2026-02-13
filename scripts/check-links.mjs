import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  console.error('Missing dist/. Run `npm run build` first.');
  process.exit(1);
}

let scopePrefix = null;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--scope=')) {
    const value = arg.slice('--scope='.length).trim();
    if (value) scopePrefix = value.endsWith('/') ? value : `${value}/`;
  }
}

const htmlFiles = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (full.endsWith('.html')) htmlFiles.push(full);
  }
};
walk(distDir);

const toWebPath = (absPath) => `/${path.relative(distDir, absPath).replaceAll(path.sep, '/')}`;
const inScope = (file) => {
  if (!scopePrefix) return true;
  const webPath = toWebPath(file);
  return webPath.startsWith(scopePrefix);
};

const targets = htmlFiles.filter(inScope);
if (targets.length === 0) {
  console.error(`No HTML files found for scope: ${scopePrefix ?? '(all)'}`);
  process.exit(1);
}

const attrPattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
const failures = new Set();
let checkedRefs = 0;

const skipRef = (ref) =>
  !ref ||
  ref.startsWith('#') ||
  /^(https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(ref);

const fileExistsByWebPath = (webPath) => {
  const clean = webPath.split('#')[0].split('?')[0];
  if (!clean.startsWith('/')) return true;

  const absolute = path.join(distDir, clean.slice(1));
  const candidates = [];

  if (path.extname(absolute)) {
    candidates.push(absolute);
  } else {
    candidates.push(absolute);
    candidates.push(path.join(absolute, 'index.html'));
    candidates.push(`${absolute}.html`);
  }

  return candidates.some((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
};

for (const file of targets) {
  const html = fs.readFileSync(file, 'utf8');
  const sourceWebPath = toWebPath(file);
  const sourceDirWebPath = sourceWebPath.endsWith('/') ? sourceWebPath : sourceWebPath.replace(/[^/]*$/, '');

  for (const match of html.matchAll(attrPattern)) {
    const ref = match[1].trim();
    if (skipRef(ref)) continue;
    checkedRefs += 1;

    let resolved = ref;
    if (!resolved.startsWith('/')) {
      const base = sourceDirWebPath || '/';
      resolved = new URL(resolved, `https://example.test${base}`).pathname;
    } else {
      resolved = resolved.split('#')[0].split('?')[0];
    }

    if (!fileExistsByWebPath(resolved)) {
      failures.add(`${sourceWebPath} -> ${ref}`);
    }
  }
}

if (failures.size > 0) {
  console.error(`Broken local references found: ${failures.size}`);
  for (const f of [...failures].sort()) console.error(`- ${f}`);
  process.exit(1);
}

console.log(
  `OK: checked ${targets.length} HTML files and ${checkedRefs} local refs (${scopePrefix ?? 'all pages'})`
);
