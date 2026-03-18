import fs from 'node:fs/promises';
import path from 'node:path';

const SNAPSHOT_PATH = path.resolve('public/feeds-data.json');
const TIMEOUT_MS = 10000;

const FEEDS = {
  hatena: 'https://b.hatena.ne.jp/hotentry/it.rss',
  hackernews: 'https://hnrss.org/frontpage',
  nikkei: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf',
  reuters: 'https://assets.wor.jp/rss/rdf/reuters/top.rdf',
  toyokeizai: 'https://toyokeizai.net/list/feed/rss',
  reddit: [
    'https://www.reddit.com/r/programming/.rss',
    'https://www.reddit.com/r/technology/.rss',
  ],
  bbc: 'https://feeds.bbci.co.uk/news/rss.xml',
};

function emptyEntry() {
  return { items: [], fetchedAt: null, error: 'snapshot unavailable' };
}

function decodeXml(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripHtml(text) {
  return decodeXml(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickTag(block, tagNames) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
    const match = block.match(pattern);
    if (match) return stripHtml(match[1]);
  }
  return '';
}

function parseAtomEntries(xml, source) {
  const entries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)];
  return entries.map((match) => {
    const block = match[0];
    const linkMatch = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    return {
      title: pickTag(block, ['title']),
      link: linkMatch?.[1] ?? '',
      date: pickTag(block, ['updated', 'published']),
      description: pickTag(block, ['content', 'summary']).slice(0, 200),
      source,
    };
  }).filter((item) => item.title && item.link);
}

function parseRssItems(xml, source) {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  return items.map((match) => {
    const block = match[0];
    return {
      title: pickTag(block, ['title']),
      link: pickTag(block, ['link']),
      date: pickTag(block, ['pubDate', 'dc:date', 'date']),
      description: pickTag(block, ['description']).slice(0, 200),
      source,
    };
  }).filter((item) => item.title && item.link);
}

function parseFeed(xml, source) {
  if (/<entry\b/i.test(xml)) return parseAtomEntries(xml, source);
  return parseRssItems(xml, source);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'yyYank-feed-updater/1.0 (+https://yyyank.github.io)',
        'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadPreviousSnapshot() {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      generatedAt: null,
      feeds: {
        hatena: emptyEntry(),
        hackernews: emptyEntry(),
        nikkei: emptyEntry(),
        reuters: emptyEntry(),
        toyokeizai: emptyEntry(),
        reddit: emptyEntry(),
        bbc: emptyEntry(),
      },
    };
  }
}

async function resolveFeed(key, previousEntry) {
  try {
    const urls = Array.isArray(FEEDS[key]) ? FEEDS[key] : [FEEDS[key]];
    const settled = await Promise.allSettled(urls.map((url) => fetchText(url)));
    const items = settled.flatMap((result) => {
      if (result.status !== 'fulfilled') return [];
      return parseFeed(result.value, key);
    });

    if (items.length === 0) {
      throw new Error('no items parsed');
    }

    return {
      items,
      fetchedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...(previousEntry ?? emptyEntry()),
      error: `snapshot refresh failed: ${message}`,
    };
  }
}

async function main() {
  const previous = await loadPreviousSnapshot();
  const next = {
    generatedAt: new Date().toISOString(),
    feeds: {},
  };

  for (const key of Object.keys(FEEDS)) {
    next.feeds[key] = await resolveFeed(key, previous.feeds?.[key]);
  }

  await fs.writeFile(SNAPSHOT_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
