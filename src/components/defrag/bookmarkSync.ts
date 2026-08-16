/* feedsのお気に入り(localStorage 'feeds-favorites')をdefragフォルダへ追加専用で同期する。
   既存id(フォルダ/断片)は絶対に書き換えない(リネーム・移動をユーザー操作として尊重するため)。 */
import type { CardItem, Item, Topic } from "./types";

export type FavoriteSource =
  | "hatena"
  | "hackernews"
  | "nikkei"
  | "reuters"
  | "toyokeizai"
  | "reddit"
  | "bbc"
  | "cisa"
  | "darkreading"
  | "bleepingcomputer"
  | "github";

export interface Favorite {
  title: string;
  link: string;
  date?: string;
  description?: string;
  source: FavoriteSource;
}

/* src/components/feeds/FeedReader.tsx の FEED_LABELS と同内容を保つ(表示の一貫性のため) */
export const FEED_LABELS: Record<FavoriteSource, string> = {
  hatena: "はてブ IT",
  hackernews: "Hacker News",
  nikkei: "日経",
  reuters: "Reuters",
  toyokeizai: "東洋経済",
  reddit: "Reddit",
  bbc: "BBC",
  cisa: "CISA",
  darkreading: "Dark Reading",
  bleepingcomputer: "BleepingComputer",
  github: "GitHub",
};

export const BOOKMARKS_FOLDER_ID = "bookmarks";

export interface SyncResult {
  topics: Topic[];
  items: Item[];
  added: boolean;
}

// 記事日時(favorite.date)を年代順の並びに使いたいのでDate.parseする。不正な値はnullにしてnowへフォールバックさせる。
function parseFavoriteDate(fav: Favorite): number | null {
  if (!fav.date) return null;
  const t = Date.parse(fav.date);
  return Number.isNaN(t) ? null : t;
}

const MONTH_FOLDER_PREFIX = "bm-month:";

// 月フォルダはローカルタイムの年月で括る(記事を読んだ地域の感覚に合わせるため)
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthFolderId(ts: number): string {
  return `${MONTH_FOLDER_PREFIX}${monthKey(ts)}`;
}

// 月フォルダが無ければbookmarks直下に作る。既にあれば何もしない(重複生成防止)
function ensureMonthFolder(
  nextTopics: Topic[],
  topicIds: Set<string>,
  ts: number,
  now: number,
): { id: string; created: boolean } {
  const id = monthFolderId(ts);
  if (topicIds.has(id)) return { id, created: false };
  nextTopics.push({ id, title: monthKey(ts), parentId: BOOKMARKS_FOLDER_ID, createdAt: now });
  topicIds.add(id);
  return { id, created: true };
}

export function syncBookmarks(
  topics: Topic[],
  items: Item[],
  favorites: Favorite[],
  now: number = Date.now(),
): SyncResult {
  if (favorites.length === 0) {
    return { topics, items, added: false };
  }

  const topicIds = new Set(topics.map((t) => t.id));
  const itemIds = new Set(items.map((i) => i.id));
  const nextTopics = topics.slice();
  const nextItems = items.slice();
  let added = false;

  // 親フォルダが無ければ追加する(既存があれば一切触らない)
  if (!topicIds.has(BOOKMARKS_FOLDER_ID)) {
    nextTopics.push({ id: BOOKMARKS_FOLDER_ID, title: "bookmarks", parentId: null, createdAt: now });
    topicIds.add(BOOKMARKS_FOLDER_ID);
    added = true;
  }

  for (const fav of favorites) {
    const parsedDate = parseFavoriteDate(fav);
    const createdAt = parsedDate ?? now;
    const topicId = `bm:${fav.link}`;
    if (!topicIds.has(topicId)) {
      // 新規の記事フォルダは記事日時の月フォルダ配下に作る
      const month = ensureMonthFolder(nextTopics, topicIds, createdAt, now);
      if (month.created) added = true;
      nextTopics.push({ id: topicId, title: fav.title, parentId: month.id, createdAt });
      topicIds.add(topicId);
      added = true;
    }

    const cardId = `bmcard:${fav.link}`;
    if (!itemIds.has(cardId)) {
      const label = FEED_LABELS[fav.source] ?? fav.source;
      const card: CardItem = {
        id: cardId,
        kind: "card",
        text: `${fav.title}\n${fav.link}\n${label}`,
        createdAt,
        topicId,
      };
      nextItems.push(card);
      itemIds.add(cardId);
      added = true;
    } else if (parsedDate !== null) {
      // 既存断片: 記事日時が判明していてcreatedAtとずれている場合のみ、日時だけを補正する(他フィールドは不変)
      const idx = nextItems.findIndex((i) => i.id === cardId);
      if (idx >= 0 && nextItems[idx].createdAt !== parsedDate) {
        nextItems[idx] = { ...nextItems[idx], createdAt: parsedDate };
        added = true;
      }
    }
  }

  // 移行: 旧仕様でbookmarks直下に作られたbm:フォルダを、対応するbmcard断片のcreatedAtから
  // 求めた月フォルダへ移す。手動でbookmarks外へ移動済み・既に月フォルダ配下のものは対象外
  // (parentIdがbookmarks直下でなければスキップ)。対応する断片が見つからない場合も移動しない。
  for (let i = 0; i < nextTopics.length; i++) {
    const t = nextTopics[i];
    if (!t.id.startsWith("bm:") || t.parentId !== BOOKMARKS_FOLDER_ID) continue;
    const cardId = `bmcard:${t.id.slice("bm:".length)}`;
    const card = nextItems.find((it) => it.id === cardId);
    if (!card) continue;
    const month = ensureMonthFolder(nextTopics, topicIds, card.createdAt, now);
    nextTopics[i] = { ...t, parentId: month.id };
    added = true;
  }

  if (!added) {
    return { topics, items, added: false };
  }
  return { topics: nextTopics, items: nextItems, added: true };
}
