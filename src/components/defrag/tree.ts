import type { Item, Row, Topic, Frag } from "./types";

/* ルートはフォルダではない。IDのないルートを表す番兵 */
export const ROOT = "__root__";

export const flattenTexts = (i: Item) => (i.kind === "bundle" ? i.children.map((c) => c.text) : [i.text]);
export const itemStamp = (i: Item) => (i.kind === "bundle" ? i.children[0].createdAt : i.createdAt);
export const itemLabel = (i: Item) => (i.kind === "bundle" ? i.title || "名前のない束" : i.text);
export const childrenOf = (topics: Topic[], parentId: string | null) =>
  topics.filter((t) => (t.parentId || null) === parentId);

export function descendantIds(topics: Topic[], id: string, acc: string[] = []) {
  childrenOf(topics, id).forEach((t) => { acc.push(t.id); descendantIds(topics, t.id, acc); });
  return acc;
}

export function pathOf(topics: Topic[], id: string) {
  const out: Topic[] = [];
  let cur: Topic | null | undefined = topics.find((t) => t.id === id);
  while (cur) {
    out.unshift(cur);
    const parentId: string | null = cur.parentId;
    cur = parentId ? topics.find((t) => t.id === parentId) : null;
  }
  return out;
}

export const pathLabel = (topics: Topic[], id: string | null) =>
  id && id !== ROOT ? "/ " + pathOf(topics, id).map((t) => t.title).join(" / ") : "/";

export function flatTopics(
  topics: Topic[],
  parentId: string | null = null,
  depth = 0,
  out: { topic: Topic; depth: number }[] = []
) {
  childrenOf(topics, parentId).forEach((t) => {
    out.push({ topic: t, depth });
    flatTopics(topics, t.id, depth + 1, out);
  });
  return out;
}

/* explorer と同じ並び。フォルダが先、そのあと直下の断片。 */
export function buildRows(topics: Topic[], items: Item[], isOpen: (id: string) => boolean) {
  const out: Row[] = [];
  const walk = (parentId: string | null, depth: number) => {
    childrenOf(topics, parentId).forEach((t) => {
      out.push({ type: "folder", id: t.id, topic: t, title: t.title, depth, parent: t.parentId || null });
      if (isOpen(t.id)) {
        walk(t.id, depth + 1);
        items.filter((i) => i.topicId === t.id).forEach((it) =>
          out.push({ type: "item", id: it.id, item: it, depth: depth + 1, parent: t.id })
        );
      }
    });
  };
  walk(null, 0);
  items.filter((i) => !i.topicId).forEach((it) =>
    out.push({ type: "item", id: it.id, item: it, depth: 0, parent: null })
  );
  return out;
}

export function subtreeItems(topics: Topic[], items: Item[], rootId: string) {
  const ids: (string | null)[] = rootId === ROOT ? [null] : [rootId, ...descendantIds(topics, rootId)];
  return items.filter((i) => ids.includes(i.topicId || null) || ids.includes(i.topicId));
}

export function eachFragment(items: Item[]) {
  const out: Frag[] = [];
  items.forEach((it) => {
    if (it.kind === "bundle") {
      it.children.forEach((c) => out.push({ id: c.id, ownerId: it.id, text: c.text, createdAt: c.createdAt, topicId: it.topicId || null }));
    } else {
      out.push({ id: it.id, ownerId: it.id, text: it.text, createdAt: it.createdAt, topicId: it.topicId || null });
    }
  });
  return out;
}
