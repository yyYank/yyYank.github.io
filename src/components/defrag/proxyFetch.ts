/* CORSプロキシ経由のfetchをtweetBookmark.ts/urlBookmark.tsで共有するための共通実装。
   corsproxy.io -> api.allorigins.win/raw の順でフォールバックする(feedsのFeedReader.tsxと同じ方針) */

export function allOriginsProxyUrl(url: string): string {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

export function corsProxyUrl(url: string): string {
  return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
}

export async function fetchViaProxy(url: string): Promise<Response> {
  const endpoints = [corsProxyUrl(url), allOriginsProxyUrl(url)];
  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error("oEmbed fetch failed");
}
