import type { Child, Item, ItemPatch, Persisted, Topic } from "./types";
import { descendantIds, itemStamp, ROOT } from "./tree";

/* 保存キーと形式は既存データ互換のため変えない */
export const KEY = "defrag:v6";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function loadAll(): Promise<Persisted | null> {
  try {
    const res = localStorage.getItem(KEY);
    return res ? JSON.parse(res) : null;
  } catch (e) {
    return null;
  }
}

export async function saveAll(data: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {}
}

export interface StoreState {
  items: Item[];
  topics: Topic[];
}

export type StoreAction =
  | { type: "load"; items: Item[]; topics: Topic[] }
  | { type: "addItem"; item: Item }
  | { type: "moveItem"; id: string; topicId?: string | null; beforeId?: string | null }
  | { type: "bundle"; dragId: string; targetId: string }
  | { type: "unbundle"; id: string }
  | { type: "sortWithin"; tid: string; dir: "new" | "old" }
  | { type: "removeItem"; id: string }
  | { type: "restoreItem"; item: Item; index: number }
  | { type: "patchItem"; id: string; patch: ItemPatch }
  | { type: "addTopic"; topic: Topic }
  | { type: "patchTopic"; id: string; patch: Partial<Topic> }
  | { type: "removeFolder"; id: string }
  | { type: "nestFolder"; dragId: string; newParentId: string | null }
  | { type: "moveFolderBefore"; dragId: string; beforeId: string | null }
  | { type: "promote"; id: string; topic: Topic };

function moveItem(items: Item[], id: string, topicId?: string | null, beforeId?: string | null): Item[] {
  const from = items.findIndex((i) => i.id === id);
  if (from < 0) return items;
  const next = items.slice();
  const [m] = next.splice(from, 1);
  const moved = { ...m, topicId: topicId || null };
  if (beforeId) {
    const at = next.findIndex((i) => i.id === beforeId);
    next.splice(at < 0 ? next.length : at, 0, moved);
  } else {
    next.unshift(moved);
  }
  return next;
}

function bundleItems(items: Item[], dragId: string, targetId: string): Item[] {
  const di = items.findIndex((i) => i.id === dragId);
  const ti = items.findIndex((i) => i.id === targetId);
  if (di < 0 || ti < 0) return items;
  const next = items.slice();
  const src = next[di];
  const dst = next[ti];
  const kids: Child[] =
    src.kind === "bundle" ? src.children : [{ id: src.id, text: src.text, createdAt: src.createdAt }];
  next[ti] =
    dst.kind === "bundle"
      ? { ...dst, children: [...dst.children, ...kids] }
      : {
          id: uid(), kind: "bundle", title: "", createdAt: Date.now(), topicId: dst.topicId || null,
          children: [{ id: dst.id, text: dst.text, createdAt: dst.createdAt }, ...kids],
        };
  next.splice(di, 1);
  return next;
}

function unbundleItem(items: Item[], id: string): Item[] {
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return items;
  const b = items[idx];
  if (b.kind !== "bundle") return items;
  const loose: Item[] = b.children.map((c) => ({
    id: c.id, kind: "card", text: c.text, createdAt: c.createdAt, topicId: b.topicId || null }));
  const next = items.slice();
  next.splice(idx, 1, ...loose);
  return next;
}

function sortWithin(items: Item[], tid: string, dir: "new" | "old"): Item[] {
  const key = tid === ROOT ? null : tid;
  const idx: number[] = [];
  items.forEach((it, i) => { if ((it.topicId || null) === key) idx.push(i); });
  const vals = idx.map((i) => items[i]).sort((a, b) =>
    dir === "new" ? itemStamp(b) - itemStamp(a) : itemStamp(a) - itemStamp(b));
  const next = items.slice();
  idx.forEach((i, k) => (next[i] = vals[k]));
  return next;
}

function nestFolder(topics: Topic[], dragId: string, newParentId: string | null): Topic[] {
  if (dragId === newParentId) return topics;
  const pid = newParentId === ROOT ? null : newParentId;
  if (pid && descendantIds(topics, dragId).includes(pid)) return topics;
  const t = topics.find((x) => x.id === dragId);
  if (!t) return topics;
  return [...topics.filter((x) => x.id !== dragId), { ...t, parentId: pid }];
}

function moveFolderBefore(topics: Topic[], dragId: string, beforeId: string | null): Topic[] {
  const t = topics.find((x) => x.id === dragId);
  if (!t) return topics;
  if (beforeId && descendantIds(topics, dragId).includes(beforeId)) return topics;
  const target = beforeId ? topics.find((x) => x.id === beforeId) : null;
  const parentId = target ? target.parentId || null : null;
  const next = topics.filter((x) => x.id !== dragId);
  const at = beforeId ? next.findIndex((x) => x.id === beforeId) : next.length;
  next.splice(at < 0 ? next.length : at, 0, { ...t, parentId });
  return next;
}

export function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case "load":
      return { items: action.items, topics: action.topics };
    case "addItem":
      return { ...state, items: [action.item, ...state.items] };
    case "moveItem":
      return { ...state, items: moveItem(state.items, action.id, action.topicId, action.beforeId) };
    case "bundle":
      return { ...state, items: bundleItems(state.items, action.dragId, action.targetId) };
    case "unbundle":
      return { ...state, items: unbundleItem(state.items, action.id) };
    case "sortWithin":
      return { ...state, items: sortWithin(state.items, action.tid, action.dir) };
    case "removeItem":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case "restoreItem": {
      const next = state.items.slice();
      next.splice(Math.min(action.index, next.length), 0, action.item);
      return { ...state, items: next };
    }
    case "patchItem":
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? ({ ...i, ...action.patch } as Item) : i)),
      };
    case "addTopic":
      return { ...state, topics: [...state.topics, action.topic] };
    case "patchTopic":
      return {
        ...state,
        topics: state.topics.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case "removeFolder": {
      const t = state.topics.find((x) => x.id === action.id);
      const up = t ? t.parentId || null : null;
      return {
        topics: state.topics
          .filter((x) => x.id !== action.id)
          .map((x) => (x.parentId === action.id ? { ...x, parentId: up } : x)),
        items: state.items.map((i) => (i.topicId === action.id ? { ...i, topicId: up } : i)),
      };
    }
    case "nestFolder":
      return { ...state, topics: nestFolder(state.topics, action.dragId, action.newParentId) };
    case "moveFolderBefore":
      return { ...state, topics: moveFolderBefore(state.topics, action.dragId, action.beforeId) };
    case "promote": {
      const b = state.items.find((i) => i.id === action.id);
      if (!b || b.kind !== "bundle") return state;
      const idx = state.items.findIndex((i) => i.id === action.id);
      const loose: Item[] = b.children.map((c) => ({
        id: c.id, kind: "card", text: c.text, createdAt: c.createdAt, topicId: action.topic.id }));
      const items = state.items.slice();
      items.splice(idx, 1, ...loose);
      return { items, topics: [...state.topics, action.topic] };
    }
  }
}
