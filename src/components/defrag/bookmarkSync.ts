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
    const topicId = `bm:${fav.link}`;
    if (!topicIds.has(topicId)) {
      nextTopics.push({ id: topicId, title: fav.title, parentId: BOOKMARKS_FOLDER_ID, createdAt: now });
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
        createdAt: now,
        topicId,
      };
      nextItems.push(card);
      itemIds.add(cardId);
      added = true;
    }
  }

  if (!added) {
    return { topics, items, added: false };
  }
  return { topics: nextTopics, items: nextItems, added: true };
}
