/* 記事URLからブックマーク(フォルダ+断片)を作る。tweetBookmark.tsのツイート版と同じ
   id採番規則(bm:/bmcard:)・親フォルダ(bookmarksフォルダ)を再利用し、表示上の一貫性を保つ */
import { BOOKMARKS_FOLDER_ID, monthFolderId, monthKey } from "./bookmarkSync";
import { fetchViaProxy } from "./proxyFetch";
import type { CardItem, Topic } from "./types";

export interface ArticleData {
  title: string;
  site: string;
  createdAt: number | null;
}

// og:*系メタタグが無いサイトも多いため、<title>要素・hostnameへ段階的にフォールバックする
export async function fetchArticle(url: string): Promise<ArticleData> {
  const res = await fetchViaProxy(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");

  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim();
  const titleTag = doc.querySelector("title")?.textContent?.trim();
  const title = ogTitle || titleTag || url;

  const ogSite = doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim();
  let site = ogSite || "";
  if (!site) {
    try {
      site = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      site = "";
    }
  }

  const publishedMeta = doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content")?.trim();
  const timeTag = doc.querySelector("time[datetime]")?.getAttribute("datetime")?.trim();
  const candidates = [publishedMeta, timeTag];
  let createdAt: number | null = null;
  for (const c of candidates) {
    if (!c) continue;
    const parsed = Date.parse(c);
    if (!Number.isNaN(parsed)) { createdAt = parsed; break; }
  }

  return { title, site, createdAt };
}

// bookmarkSync.tsの月別配置(bm-month:YYYY-MM)と揃えるため、記事フォルダは公開日時の月フォルダ配下に置く。
// 月フォルダのTopicも返し、既存かどうかの判定(重複生成防止)は呼び出し側(Defrag.tsx)に委ねる。
export function buildUrlBookmark(
  article: ArticleData,
  url: string,
  now: number,
): { topic: Topic; card: CardItem; monthTopic: Topic } {
  const title = article.title.trim().slice(0, 40) || url;
  const createdAt = article.createdAt ?? now;
  const monthId = monthFolderId(createdAt);
  const monthTopic: Topic = {
    id: monthId,
    title: monthKey(createdAt),
    parentId: BOOKMARKS_FOLDER_ID,
    createdAt: now,
  };
  const topic: Topic = {
    id: `bm:${url}`,
    title,
    parentId: monthId,
    createdAt,
  };
  const card: CardItem = {
    id: `bmcard:${url}`,
    kind: "card",
    text: `${article.title}\n${url}\n${article.site}`,
    createdAt,
    topicId: topic.id,
  };
  return { topic, card, monthTopic };
}
