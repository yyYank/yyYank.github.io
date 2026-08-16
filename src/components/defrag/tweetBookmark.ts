/* ツイートURLからブックマーク(フォルダ+断片)を作る。bookmarkSync.tsのフィード同期と同じ
   id採番規則(bm:/bmcard:)・親フォルダ(bookmarksフォルダ)を再利用し、表示上の一貫性を保つ */
import { BOOKMARKS_FOLDER_ID } from "./bookmarkSync";
import type { CardItem, Topic } from "./types";

export interface TweetData {
  text: string;
  author: string;
  createdAt: number | null;
}

/* x.com / twitter.com の /status/ を含むURLのみ対象にする(oEmbedが個別ツイート以外を想定していないため) */
export function isTweetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return (host === "x.com" || host === "twitter.com") && /\/status\/\d+/.test(u.pathname);
  } catch {
    return false;
  }
}

function allOriginsProxyUrl(url: string): string {
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

function corsProxyUrl(url: string): string {
  return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
}

/* oEmbedのhtmlは <blockquote>本文...<a>日付リンク</a></blockquote><script>... という構造。
   本文はblockquote直下のテキスト、日付はblockquote内最後のaタグのテキスト(例 "August 16, 2026")から取る */
function parseOembedHtml(html: string): { text: string; createdAt: number | null } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blockquote = doc.querySelector("blockquote");
  if (!blockquote) return { text: "", createdAt: null };

  const links = Array.from(blockquote.querySelectorAll("a"));
  const dateLink = links.length > 0 ? links[links.length - 1] : null;
  const dateText = dateLink?.textContent?.trim() ?? "";
  const parsed = dateText ? Date.parse(dateText) : NaN;
  const createdAt = Number.isNaN(parsed) ? null : parsed;

  // 本文取得のため日付リンク(末尾のaタグ)だけを取り除いてから残りのテキストを読む
  if (dateLink) dateLink.remove();
  const text = (blockquote.textContent ?? "").trim();

  return { text, createdAt };
}

/* corsproxy.io -> api.allorigins.win/raw の順でフォールバックする(feedsのFeedReader.tsxと同じ方針) */
async function fetchViaProxy(url: string): Promise<Response> {
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

export async function fetchTweet(url: string): Promise<TweetData> {
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
  const res = await fetchViaProxy(oembedUrl);
  const json = await res.json();
  const html: string = typeof json.html === "string" ? json.html : "";
  const author: string = typeof json.author_name === "string" ? json.author_name : "";
  const { text, createdAt } = parseOembedHtml(html);
  return { text, author, createdAt };
}

export function buildTweetBookmark(
  tweet: TweetData,
  url: string,
  now: number,
): { topic: Topic; card: CardItem } {
  const title = tweet.text.trim().slice(0, 40) || tweet.author || url;
  const createdAt = tweet.createdAt ?? now;
  const topic: Topic = {
    id: `bm:${url}`,
    title,
    parentId: BOOKMARKS_FOLDER_ID,
    createdAt,
  };
  const card: CardItem = {
    id: `bmcard:${url}`,
    kind: "card",
    text: `${tweet.text}\n${url}\nX(@${tweet.author})`,
    createdAt,
    topicId: topic.id,
  };
  return { topic, card };
}
