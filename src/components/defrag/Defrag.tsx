import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { CSS } from "./styles";
import { useDrag } from "./useDrag";

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

interface Pos { x: number; y: number; r: number }
interface Child { id: string; text: string; createdAt: number }
interface CardItem {
  id: string; kind: "card"; text: string; createdAt: number;
  topicId: string | null; color?: string; pos?: Pos;
}
interface BundleItem {
  id: string; kind: "bundle"; title: string; createdAt: number;
  topicId: string | null; children: Child[]; color?: string; pos?: Pos;
}
type Item = CardItem | BundleItem;
type ItemPatch = Partial<Omit<CardItem, "id" | "kind">> & Partial<Omit<BundleItem, "id" | "kind">>;
interface Topic { id: string; title: string; parentId: string | null; createdAt: number }
type FolderRow = { type: "folder"; id: string; topic: Topic; title: string; depth: number; parent: string | null };
type ItemRow = { type: "item"; id: string; item: Item; depth: number; parent: string | null };
type Row = FolderRow | ItemRow;
interface Persisted {
  items: Item[]; topics: Topic[]; expanded: Record<string, boolean>; here: string;
}

/* ------------------------------------------------------------------ */
/* storage                                                             */
/* ------------------------------------------------------------------ */

const KEY = "defrag:v6";

async function loadAll(): Promise<Persisted | null> {
  try {
    const res = localStorage.getItem(KEY);
    return res ? JSON.parse(res) : null;
  } catch (e) {
    return null;
  }
}
async function saveAll(data: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {}
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const ROOT = "__root__";
const DAY = 86400000;
const daysAgo = (ts: number) => (Date.now() - ts) / DAY;

const AGE_STOPS: [number, number[]][] = [
  [0, [232, 161, 58]],
  [3, [201, 138, 70]],
  [14, [122, 124, 130]],
  [45, [78, 100, 122]],
  [120, [56, 74, 94]],
];

function ageColor(ts: number) {
  const d = daysAgo(ts);
  const last = AGE_STOPS[AGE_STOPS.length - 1];
  if (d >= last[0]) return `rgb(${last[1].join(",")})`;
  let a = AGE_STOPS[0];
  let b = last;
  for (let i = 0; i < AGE_STOPS.length - 1; i++) {
    if (d >= AGE_STOPS[i][0] && d <= AGE_STOPS[i + 1][0]) { a = AGE_STOPS[i]; b = AGE_STOPS[i + 1]; break; }
  }
  const span = b[0] - a[0];
  const t = span === 0 ? 0 : (d - a[0]) / span;
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * Math.min(Math.max(t, 0), 1)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/* 見るたびに変わらない表示にする */
function absDate(ts: number, withTime: boolean) {
  const d = new Date(ts);
  const y = d.getFullYear() === new Date().getFullYear() ? "" : `${d.getFullYear()}/`;
  const day = `${y}${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  return withTime ? `${day} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : day;
}
const shortDate = (ts: number) => absDate(ts, false);

/* 文字 n-gram (n=1,2,3) を出現回数つきで数える。日本語は漢字1文字が意味を持つので
   ユニグラムを落とさない。記号と空白だけ除く。 */
function grams(text: string) {
  const s = (text || "").replace(/[\s\u3000、。,.!?！？「」『』()（）ー\-~〜:：;；…・"'`]/g, "");
  const m = new Map<string, number>();
  const bump = (g: string) => m.set(g, (m.get(g) || 0) + 1);
  for (let i = 0; i < s.length; i++) {
    bump(s[i]);
    if (i + 2 <= s.length) bump(s.slice(i, i + 2));
    if (i + 3 <= s.length) bump(s.slice(i, i + 3));
  }
  return m;
}

/* ありふれた並びを軽くするための IDF。全断片から作り直す。 */
function buildIdf(texts: string[]) {
  const df = new Map<string, number>();
  texts.forEach((t) => {
    new Set(grams(t).keys()).forEach((g) => df.set(g, (df.get(g) || 0) + 1));
  });
  const n = Math.max(1, texts.length);
  const idf = new Map<string, number>();
  df.forEach((c, g) => idf.set(g, Math.log((n + 1) / (c + 0.5))));
  return idf;
}

/* tf-idf ベクトルにして正規化。長さの違う断片を素直に比べられるようにする。 */
function vectorize(text: string, idf: Map<string, number> | null) {
  const g = grams(text);
  const v = new Map<string, number>();
  let norm = 0;
  g.forEach((tf, key) => {
    const w = (1 + Math.log(tf)) * (idf ? idf.get(key) || Math.log(2) : 1);
    if (w <= 0) return;
    v.set(key, w);
    norm += w * w;
  });
  norm = Math.sqrt(norm) || 1;
  v.forEach((w, key) => v.set(key, w / norm));
  return v;
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  small.forEach((w, key) => {
    const o = large.get(key);
    if (o) dot += w * o;
  });
  return dot;
}

/* 単発で比べたいとき用。idf なしのコサイン。 */
function similarity(a: string, b: string) {
  return cosine(vectorize(a, null), vectorize(b, null));
}

const flattenTexts = (i: Item) => (i.kind === "bundle" ? i.children.map((c) => c.text) : [i.text]);
const itemStamp = (i: Item) => (i.kind === "bundle" ? i.children[0].createdAt : i.createdAt);
const itemLabel = (i: Item) => (i.kind === "bundle" ? i.title || "名前のない束" : i.text);
const childrenOf = (topics: Topic[], parentId: string | null) =>
  topics.filter((t) => (t.parentId || null) === parentId);

function descendantIds(topics: Topic[], id: string, acc: string[] = []) {
  childrenOf(topics, id).forEach((t) => { acc.push(t.id); descendantIds(topics, t.id, acc); });
  return acc;
}
function pathOf(topics: Topic[], id: string) {
  const out: Topic[] = [];
  let cur: Topic | null | undefined = topics.find((t) => t.id === id);
  while (cur) {
    out.unshift(cur);
    const parentId: string | null = cur.parentId;
    cur = parentId ? topics.find((t) => t.id === parentId) : null;
  }
  return out;
}
const pathLabel = (topics: Topic[], id: string | null) =>
  id && id !== ROOT ? "/ " + pathOf(topics, id).map((t) => t.title).join(" / ") : "/";

function flatTopics(
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
function buildRows(topics: Topic[], items: Item[], isOpen: (id: string) => boolean) {
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

function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg className="dfg-folder" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      {open ? (
        <path d="M1.6 13.2 3.3 7.4a1 1 0 0 1 .96-.7h9.6a.6.6 0 0 1 .58.77l-1.5 5.2a1 1 0 0 1-.96.73H2.2a.6.6 0 0 1-.6-.7Z
                 M1.4 11.6V3.6a.9.9 0 0 1 .9-.9h3.3l1.5 1.6h5a.9.9 0 0 1 .9.9v1.2"
          fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      ) : (
        <path d="M1.4 12.4V3.6a.9.9 0 0 1 .9-.9h3.3l1.5 1.6h6a.9.9 0 0 1 .9.9v7.2a.9.9 0 0 1-.9.9H2.3a.9.9 0 0 1-.9-.9Z"
          fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

export default function Defrag() {
  const [items, setItems] = useState<Item[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  const [drawer, setDrawer] = useState(false);
  const [here, setHere] = useState(ROOT);

  const [draft, setDraft] = useState("");
  const [quick, setQuick] = useState("");
  const [flash, setFlash] = useState(0);
  const [echo, setEcho] = useState<{ t: string; id: string; s: number }[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [copyTopic, setCopyTopic] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState<{ parentId: string | null } | null>(null);
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null);
  const [folderMenu, setFolderMenu] = useState<string | null>(null);
  const [moving, setMoving] = useState<Topic | null>(null);
  const [trash, setTrash] = useState<{ item: Item; index: number } | null>(null);
  const [tab, setTab] = useState<"compose" | "wall" | "viz">("compose");
  const [editor, setEditor] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    loadAll().then((d) => {
      if (!alive) return;
      if (d) {
        if (Array.isArray(d.items)) setItems(d.items);
        if (Array.isArray(d.topics)) setTopics(d.topics);
        if (d.expanded) setExpanded(d.expanded);
        if (d.here) setHere(d.here);
      }
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (ready) saveAll({ items, topics, expanded, here }); }, [items, topics, expanded, here, ready]);
  useEffect(() => { if (!drawer && taRef.current) taRef.current.focus(); }, [drawer]);

  /* 画面左端からのスワイプで開く */
  useEffect(() => {
    const el = document.querySelector(".dfg");
    if (!el) return;
    let x0: number | null = null;
    const start = (e: TouchEvent) => { const t = e.touches[0]; x0 = t && t.clientX < 22 ? t.clientX : null; };
    const mv = (e: TouchEvent) => {
      if (x0 == null) return;
      const t = e.touches[0];
      if (t && t.clientX - x0 > 40) { setDrawer(true); x0 = null; }
    };
    el.addEventListener("touchstart", start as EventListener, { passive: true });
    el.addEventListener("touchmove", mv as EventListener, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start as EventListener);
      el.removeEventListener("touchmove", mv as EventListener);
    };
  }, []);
  useEffect(() => {
    if (!echo.length) return;
    const t = setTimeout(() => setEcho([]), 12000);
    return () => clearTimeout(t);
  }, [echo]);

  useEffect(() => {
    if (!trash) return;
    const t = setTimeout(() => setTrash(null), 6000);
    return () => clearTimeout(t);
  }, [trash]);

  const hereId = here === ROOT ? null : here;
  const herePath = pathLabel(topics, here);

  const add = (text: string) => {
    const v = text.trim();
    if (!v) return;
    setItems((prev) => [{ id: uid(), kind: "card", text: v, createdAt: Date.now(), topicId: hereId }, ...prev]);
    setFlash(Date.now());
  };
  const throwIt = () => {
    if (!draft.trim()) return;
    const pool = items.flatMap((it) => flattenTexts(it).map((t) => ({ t, id: it.id })));
    const idf = buildIdf([draft, ...pool.map((x) => x.t)]);
    const dv = vectorize(draft, idf);
    const echoes = pool
      .map((x) => ({ ...x, s: cosine(dv, vectorize(x.t, idf)) }))
      .filter((e) => e.s > 0.07)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);
    add(draft);
    setEcho(echoes);
    setDraft("");
    if (taRef.current) taRef.current.focus();
  };
  const throwQuick = () => { if (quick.trim()) { add(quick); setQuick(""); } };

  const cardCount = useMemo(
    () => items.reduce((n, it) => n + (it.kind === "bundle" ? it.children.length : 1), 0), [items]);
  const recent = useMemo(() => items.filter((i) => i.kind === "card").slice(0, 2), [items]);

  const countIn = useCallback((tid: string) => {
    if (tid === ROOT) return items.filter((i) => !i.topicId).length;
    const ids: (string | null)[] = [tid, ...descendantIds(topics, tid)];
    return items.filter((i) => ids.includes(i.topicId)).length;
  }, [items, topics]);

  /* --- items --- */

  const moveItem = (id: string, topicId?: string | null, beforeId?: string | null) => {
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === id);
      if (from < 0) return prev;
      const next = prev.slice();
      const [m] = next.splice(from, 1);
      const moved = { ...m, topicId: topicId || null };
      if (beforeId) {
        const at = next.findIndex((i) => i.id === beforeId);
        next.splice(at < 0 ? next.length : at, 0, moved);
      } else {
        next.unshift(moved);
      }
      return next;
    });
  };

  const bundle = (dragId: string, targetId: string) => {
    setItems((prev) => {
      const di = prev.findIndex((i) => i.id === dragId);
      const ti = prev.findIndex((i) => i.id === targetId);
      if (di < 0 || ti < 0) return prev;
      const next = prev.slice();
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
    });
  };

  const sortWithin = (tid: string, dir: "new" | "old") => {
    setItems((prev) => {
      const key = tid === ROOT ? null : tid;
      const idx: number[] = [];
      prev.forEach((it, i) => { if ((it.topicId || null) === key) idx.push(i); });
      const vals = idx.map((i) => prev[i]).sort((a, b) =>
        dir === "new" ? itemStamp(b) - itemStamp(a) : itemStamp(a) - itemStamp(b));
      const next = prev.slice();
      idx.forEach((i, k) => (next[i] = vals[k]));
      return next;
    });
  };

  const trashItem = (id: string) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const gone = items[idx];
    setItems((p) => p.filter((i) => i.id !== id));
    setTrash({ item: gone, index: idx });
  };
  const undoTrash = () => {
    if (!trash) return;
    setItems((p) => { const n = p.slice(); n.splice(Math.min(trash.index, n.length), 0, trash.item); return n; });
    setTrash(null);
  };

  const patchItem = (id: string, patch: ItemPatch) =>
    setItems((p) => p.map((i) => (i.id === id ? ({ ...i, ...patch } as Item) : i)));

  const unbundle = (id: string) =>
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const b = prev[idx] as BundleItem;
      const loose: Item[] = b.children.map((c) => ({
        id: c.id, kind: "card", text: c.text, createdAt: c.createdAt, topicId: b.topicId || null }));
      const next = prev.slice();
      next.splice(idx, 1, ...loose);
      return next;
    });

  /* --- folders --- */

  const addFolder = (title: string, parentId?: string | null) => {
    const t: Topic = { id: uid(), title: title.trim() || "名前のないフォルダ", parentId: parentId || null, createdAt: Date.now() };
    setTopics((p) => [...p, t]);
    if (parentId) setExpanded((c) => ({ ...c, [parentId]: true }));
    setHere(t.id);
  };
  const patchFolder = (id: string, patch: Partial<Topic>) =>
    setTopics((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeFolder = (id: string) => {
    const t = topics.find((x) => x.id === id);
    const up = t ? t.parentId || null : null;
    setTopics((p) => p.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: up } : x)));
    setItems((p) => p.map((i) => (i.topicId === id ? { ...i, topicId: up } : i)));
    setHere(up || ROOT);
  };

  const nestFolder = (dragId: string, newParentId: string | null) => {
    if (dragId === newParentId) return;
    const pid = newParentId === ROOT ? null : newParentId;
    if (pid && descendantIds(topics, dragId).includes(pid)) return;
    setTopics((p) => {
      const t = p.find((x) => x.id === dragId);
      if (!t) return p;
      return [...p.filter((x) => x.id !== dragId), { ...t, parentId: pid }];
    });
    if (pid) setExpanded((c) => ({ ...c, [pid]: true }));
  };

  const moveFolderBefore = (dragId: string, beforeId: string | null) => {
    setTopics((p) => {
      const t = p.find((x) => x.id === dragId);
      if (!t) return p;
      if (beforeId && descendantIds(p, dragId).includes(beforeId)) return p;
      const target = beforeId ? p.find((x) => x.id === beforeId) : null;
      const parentId = target ? target.parentId || null : null;
      const next = p.filter((x) => x.id !== dragId);
      const at = beforeId ? next.findIndex((x) => x.id === beforeId) : next.length;
      next.splice(at < 0 ? next.length : at, 0, { ...t, parentId });
      return next;
    });
  };

  const promote = (id: string) => {
    const b = items.find((i) => i.id === id);
    if (!b || b.kind !== "bundle") return;
    const parent = b.topicId || null;
    const t: Topic = { id: uid(), title: b.title || "名前のないフォルダ", parentId: parent, createdAt: Date.now() };
    setTopics((p) => [...p, t]);
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      const loose: Item[] = b.children.map((c) => ({
        id: c.id, kind: "card", text: c.text, createdAt: c.createdAt, topicId: t.id }));
      const next = prev.slice();
      next.splice(idx, 1, ...loose);
      return next;
    });
    setExpanded((c) => ({ ...c, [t.id]: true, ...(parent ? { [parent]: true } : {}) }));
    setHere(t.id);
  };

  const openItem = items.find((i) => i.id === openId) || null;
  const exportItem = items.find((i) => i.id === exportId) || null;
  const menuFolder = topics.find((t) => t.id === folderMenu) || null;

  return (
    <div className="dfg">
      <style>{CSS}</style>

      <div className="dfg-top">
        <button className="dfg-burger" onClick={() => setDrawer(true)} aria-label="フォルダ">☰</button>
        <button className="dfg-tab" data-on={tab === "compose" ? "1" : "0"} onClick={() => setTab("compose")}>投げる</button>
        <button className="dfg-tab" data-on={tab === "wall" ? "1" : "0"} onClick={() => setTab("wall")}>付箋</button>
        <button className="dfg-tab" data-on={tab === "viz" ? "1" : "0"} onClick={() => setTab("viz")}>可視化</button>
        <span className="dfg-count dfg-mono">{cardCount}</span>
      </div>

      {tab === "compose" ? (
      <div className="dfg-compose">
        <button className="dfg-into" onClick={() => setDrawer(true)}>→ {herePath}</button>
        <textarea ref={taRef} className="dfg-ta" value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="いま浮かんだこと" autoComplete="off" autoCorrect="off" />
        {echo.length > 0 && (
          <div className="dfg-echo">
            <span className="dfg-echohead">前にも近いことを書いている</span>
            {echo.map((e, i) => (
              <button key={i} onClick={() => { setEcho([]); setOpenId(e.id); }}>{e.t}</button>
            ))}
          </div>
        )}
        <div className="dfg-composebar">
          <div className="dfg-recent">{echo.length ? null : recent.map((r) => <span key={r.id}>{itemLabel(r)}</span>)}</div>
          <button className="dfg-send" onClick={throwIt} disabled={!draft.trim()}>投げる</button>
        </div>
        {flash ? <div className="dfg-flash dfg-mono" key={flash}>投稿しました</div> : null}
      </div>
      ) : tab === "viz" ? (
        <Viz topics={topics} items={items} rootId={here} onOpen={setOpenId} onOpenDrawer={() => setDrawer(true)} />
      ) : (
        <Wall
          topics={topics} items={items} rootId={here}
          onOpenDrawer={() => setDrawer(true)}
          onOpen={setOpenId}
          onBundle={bundle}
          onPos={(id, pos) => patchItem(id, { pos })}
          onDraft={() => setEditor(here)}
        />
      )}

      {drawer && (
        <div className="dfg-drawer">
          <div className="dfg-dhead">
            <h2>フォルダ</h2>
            <button className="dfg-tool" onClick={() => setCreating({ parentId: hereId })} aria-label="新しいフォルダ">
              <svg viewBox="0 0 20 20" width="19" height="19">
                <path d="M2.2 15.4V4.6a1 1 0 0 1 1-1h3.6l1.7 1.8h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1Z"
                  fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M10 8.6v4.6M7.7 10.9h4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button className="dfg-tool" onClick={() => setExpanded({})} aria-label="すべてたたむ">
              <svg viewBox="0 0 20 20" width="19" height="19">
                <path d="M4 7.4 10 12l6-4.6M4 12.6 10 17l6-4.4" fill="none" stroke="currentColor"
                  strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 4h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button className="dfg-close" onClick={() => setDrawer(false)} aria-label="閉じる">✕</button>
          </div>
          <Tree
            topics={topics}
            items={items}
            expanded={expanded}
            here={here}
            countIn={countIn}
            onSelect={(id) => { setHere(id); setDrawer(false); setTab("compose"); }}
            onToggle={(id) => setExpanded((c) => ({ ...c, [id]: !c[id] }))}
            onOpenItem={setOpenId}
            onMenu={setFolderMenu}
            creating={creating}
            onCreate={(title) => {
              if (title.trim()) addFolder(title, creating?.parentId);
              setCreating(null);
            }}
            onCancelCreate={() => setCreating(null)}
            onNest={nestFolder}
            onFolderBefore={moveFolderBefore}
            onMoveItem={moveItem}
            onBundle={bundle}
            onTrash={trashItem}
          />
          <div className="dfg-bar">
            <div className="dfg-barinto">→ {herePath}</div>
            <div className="dfg-quick">
              <textarea value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="ここに投げる" rows={1} />
              <button onClick={throwQuick} disabled={!quick.trim()}>投</button>
            </div>
          </div>
        </div>
      )}

      {editor !== null && (
        <Draft topics={topics} items={items} rootId={editor} onClose={() => setEditor(null)} />
      )}

      {trash && (
        <div className="dfg-toast">
          <span>捨てた</span>
          <button onClick={undoTrash}>戻す</button>
        </div>
      )}

      {newFolder && (
        <NewFolder
          parentName={newFolder.parentId ? (topics.find((t) => t.id === newFolder.parentId) || {}).title : null}
          onClose={() => setNewFolder(null)}
          onCreate={(title) => { addFolder(title, newFolder.parentId); setNewFolder(null); }}
        />
      )}

      {menuFolder && !moving && (
        <FolderMenu
          folder={menuFolder}
          onRename={(v) => patchFolder(menuFolder.id, { title: v })}
          onCopy={() => { setCopyTopic(menuFolder.id); setFolderMenu(null); }}
          onWall={() => { setHere(menuFolder.id); setFolderMenu(null); setDrawer(false); setTab("wall"); }}
          onDraft={() => { setEditor(menuFolder.id); setFolderMenu(null); }}
          onAddChild={() => { setExpanded((c) => ({ ...c, [menuFolder.id]: true })); setCreating({ parentId: menuFolder.id }); setFolderMenu(null); }}
          onSort={(dir) => sortWithin(menuFolder.id, dir)}
          onMove={() => setMoving(menuFolder)}
          onDelete={() => { removeFolder(menuFolder.id); setFolderMenu(null); }}
          onClose={() => setFolderMenu(null)}
        />
      )}

      {moving && (
        <PickSheet
          title="どこの下に移すか"
          topics={topics.filter((t) => t.id !== moving.id && !descendantIds(topics, moving.id).includes(t.id))}
          current={moving.parentId}
          onPick={(pid) => { nestFolder(moving.id, pid); setMoving(null); setFolderMenu(null); }}
          onClose={() => setMoving(null)}
        />
      )}

      {copyTopic && (
        <Sheet title="まとめてコピー" onClose={() => setCopyTopic(null)}>
          <TopicCopy items={items} topics={topics} topicId={copyTopic} />
        </Sheet>
      )}

      {openItem && (
        <Sheet onClose={() => setOpenId(null)} title={openItem.kind === "bundle" ? "束" : "断片"}>
          {openItem.kind === "bundle" ? (
            <BundleView
              bundle={openItem}
              topics={topics}
              onChange={(patch) => patchItem(openItem.id, patch)}
              onExport={() => { setExportId(openItem.id); setOpenId(null); }}
              onUnbundle={() => { unbundle(openItem.id); setOpenId(null); }}
              onPromote={() => { promote(openItem.id); setOpenId(null); }}
            />
          ) : (
            <CardView
              card={openItem}
              items={items}
              topics={topics}
              onMove={(tid) => patchItem(openItem.id, { topicId: tid })}
              onColor={(c) => patchItem(openItem.id, { color: c })}
              onDelete={() => { trashItem(openItem.id); setOpenId(null); }}
            />
          )}
        </Sheet>
      )}

      {exportItem && exportItem.kind === "bundle" && (
        <Sheet onClose={() => setExportId(null)} title="束を書き出す">
          <BundleExport bundle={exportItem} />
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* tree — ここが唯一の作業面                                            */
/* ------------------------------------------------------------------ */

interface TreeRect {
  id: string; index: number; top: number; bottom: number; mid: number; h: number;
  parent?: string | null; droppable: boolean; band: number; sortable: boolean; isFolder?: boolean;
}
interface TreeDrag { id: string; kind: "item" | "folder"; index: number; startY: number; rects: TreeRect[] }
interface TreeDragState {
  id: string | null; kind: "item" | "folder" | null; offset: number;
  slot: number | null; dropId: string | null;
}
interface TreeProps {
  topics: Topic[]; items: Item[]; expanded: Record<string, boolean>; here: string;
  countIn: (tid: string) => number;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onOpenItem: (id: string) => void;
  onMenu: (id: string) => void;
  onNest: (dragId: string, newParentId: string) => void;
  onFolderBefore: (dragId: string, beforeId: string | null) => void;
  onMoveItem: (id: string, topicId?: string | null, beforeId?: string | null) => void;
  onBundle: (dragId: string, targetId: string) => void;
  onTrash: (id: string) => void;
  creating: { parentId: string | null } | null;
  onCreate: (title: string) => void;
  onCancelCreate: () => void;
}

function Tree({ topics, items, expanded, here, countIn, onSelect, onToggle, onOpenItem, onMenu,
  onNest, onFolderBefore, onMoveItem, onBundle, onTrash, creating, onCreate, onCancelCreate }: TreeProps) {
  const isOpen = useCallback((id: string) => !!expanded[id], [expanded]);
  const rows = useMemo(() => buildRows(topics, items, isOpen), [topics, items, isOpen]);
  const rootCount = useMemo(() => items.filter((i) => !i.topicId).length, [items]);

  const listRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const drag = useRef<TreeDrag | null>(null);

  const [dragState, setDragState] = useState<TreeDragState>({ id: null, kind: null, offset: 0, slot: null, dropId: null });
  const [swipe, setSwipe] = useState<{ id: string | null; dx: number }>({ id: null, dx: 0 });

  /* kind ごとに当たり判定を作る。フォルダは面で受け、断片は真ん中だけで束になる。 */
  const measure = (kind: "item" | "folder") => {
    const out: TreeRect[] = [];
    rows.forEach((r, i) => {
      const el = refs.current[r.id];
      if (!el) return;
      const b = el.getBoundingClientRect();
      const base = { id: r.id, index: i, top: b.top, bottom: b.bottom, mid: b.top + b.height / 2, h: b.height, parent: r.parent };
      if (kind === "item") {
        out.push({ ...base, droppable: true, band: r.type === "folder" ? 1 : 0.5, sortable: true, isFolder: r.type === "folder" });
      } else {
        out.push({ ...base, droppable: r.type === "folder", band: 0.44, sortable: r.type === "folder" });
      }
    });
    const rootEl = refs.current[ROOT];
    if (rootEl && kind === "item") {
      const b = rootEl.getBoundingClientRect();
      out.push({ id: ROOT, index: -1, top: b.top, bottom: b.bottom, mid: b.top + b.height / 2, h: b.height, droppable: true, band: 1, sortable: false, isFolder: true });
    }
    return out;
  };

  const beginDrag = (id: string, kind: "item" | "folder", index: number, y: number) => {
    drag.current = { id, kind, index, startY: y, rects: measure(kind) };
    setDragState({ id, kind, offset: 0, slot: null, dropId: null });
  };

  const dragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const y = e.clientY;
    let dropId: string | null = null;
    let slot: number | null = null;
    let over: TreeRect | null = null;
    for (const r of d.rects) {
      if (r.id === d.id || !r.droppable) continue;
      if (y >= r.top && y <= r.bottom) { over = r; break; }
    }
    if (over) {
      const band = over.h * over.band;
      if (y > over.mid - band / 2 && y < over.mid + band / 2) dropId = over.id;
    }
    if (!dropId) {
      slot = rows.length;
      for (const r of d.rects) {
        if (r.sortable && r.index >= 0 && y < r.mid) { slot = r.index; break; }
      }
    }
    setDragState({ id: d.id, kind: d.kind, offset: y - d.startY, slot, dropId });
  };

  const finishDrag = () => {
    const d = drag.current;
    const s = dragState;
    drag.current = null;
    setDragState({ id: null, kind: null, offset: 0, slot: null, dropId: null });
    if (!d) return;
    if (d.kind === "item") {
      if (s.dropId === ROOT) { onMoveItem(d.id, null, null); return; }
      if (s.dropId) {
        const target = rows.find((r) => r.id === s.dropId);
        if (target && target.type === "folder") onMoveItem(d.id, s.dropId, null);
        else if (target) onBundle(d.id, s.dropId);
        return;
      }
      if (s.slot !== null && s.slot !== d.index && s.slot !== d.index + 1) {
        const at = rows[s.slot];
        const prev = s.slot > 0 ? rows[s.slot - 1] : null;
        const parent = at ? at.parent : prev ? prev.parent : null;
        const before = at && at.type === "item" ? at.id : null;
        onMoveItem(d.id, parent, before);
      }
      return;
    }
    if (s.dropId) { onNest(d.id, s.dropId); return; }
    if (s.slot !== null && s.slot !== d.index && s.slot !== d.index + 1) {
      let before: string | null = null;
      for (let k = s.slot; k < rows.length; k++) {
        if (rows[k].type === "folder") { before = rows[k].id; break; }
      }
      onFolderBefore(d.id, before);
    }
  };

  const { down, move, up, tapped, holdRef } = useDrag<{ row: Row; index: number }>({
    isDragging: () => !!drag.current,
    onHold: ({ row, index }, _el, point) =>
      beginDrag(row.id, row.type === "item" ? "item" : "folder", index, point.y),
    onDragMove: dragMove,
    onDragEnd: finishDrag,
    swipe: {
      canSwipe: ({ row }) => row.type === "item",
      onSwipeMove: ({ row }, dx) => setSwipe({ id: row.id, dx: Math.min(0, dx) }),
      onSwipeEnd: ({ row }, el) => {
        const w = el.offsetWidth || 320;
        if (Math.abs(swipe.dx) > w * 0.36) onTrash(row.id);
        setSwipe({ id: null, dx: 0 });
      },
    },
  });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (drag.current || (holdRef.current && holdRef.current.mode === "swipe")) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [holdRef]);

  const s = dragState;

  return (
    <div className="dfg-tree" ref={listRef} data-drag={s.id ? "1" : "0"}
      onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="dfg-rootrow" ref={(el) => { refs.current[ROOT] = el; }}
        data-on={here === ROOT ? "1" : "0"} data-drop={s.dropId === ROOT ? "1" : "0"}
        onClick={tapped(() => onSelect(ROOT))}>
        <span className="dfg-mono">/</span>
        {rootCount > 0 && <em>{rootCount}</em>}
      </div>

      {rows.length === 0 && (
        <div className="dfg-empty">
          まだ何もない。
          <br />
          下から投げれば、ここに並ぶ。
        </div>
      )}

      {creating && !creating.parentId && (
        <NewRow depth={0} onCommit={onCreate} onCancel={onCancelCreate} />
      )}

      {rows.map((row, i) => {
        const dragging = s.id === row.id;
        const style: React.CSSProperties = { transform: dragging ? `translateY(${s.offset}px)` : undefined, zIndex: dragging ? 40 : undefined };

        if (row.type === "item") {
          const it = row.item;
          const stamp = itemStamp(it);
          const dx = swipe.id === row.id ? swipe.dx : 0;
          return (
            <React.Fragment key={row.id}>
              {s.slot === i && s.id ? <div className="dfg-slot" style={{ marginLeft: row.depth * 27 + 52 }} /> : null}
              <div className="dfg-itemrow" style={style}>
              <div className="dfg-rails">{Array.from({ length: row.depth }).map((_, k) => <i key={k} />)}</div>
              <span className="dfg-caretgap" />
              <div className="dfg-wrap">
                {dx < 0 && <div className="dfg-swipebg" data-armed={Math.abs(dx) > 110 ? "1" : "0"}>捨てる</div>}
                <div ref={(el) => { refs.current[row.id] = el; }} className="dfg-leaf"
                  data-dragging={dragging ? "1" : "0"} data-drop={s.dropId === row.id ? "1" : "0"}
                  style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
                  onPointerDown={(e) => down(e, { row, index: i })}>
                  {it.kind === "bundle"
                    ? <span className="dfg-stackmark" />
                    : <span className="dfg-pip" style={{ background: ageColor(stamp) }} />}
                  <p onClick={tapped(() => onOpenItem(row.id))}>{itemLabel(it)}</p>
                  <em>{it.kind === "bundle" ? `${it.children.length}枚` : absDate(stamp, false)}</em>
                </div>
              </div>
              </div>
            </React.Fragment>
          );
        }

        const open = isOpen(row.id);
        const total = countIn(row.id);
        return (
          <React.Fragment key={row.id}>
            {s.slot === i && s.id ? <div className="dfg-slot" style={{ marginLeft: row.depth * 27 + 52 }} /> : null}
            <div ref={(el) => { refs.current[row.id] = el; }} className="dfg-row"
              data-on={here === row.id ? "1" : "0"}
              data-dragging={dragging ? "1" : "0"}
              data-drop={s.dropId === row.id ? "1" : "0"}
              style={style} onPointerDown={(e) => down(e, { row, index: i })}>
              <div className="dfg-rails">
                {Array.from({ length: row.depth }).map((_, k) => <i key={k} />)}
              </div>
              <button className="dfg-caret" data-open={open ? "1" : "0"} data-empty={total === 0 ? "1" : "0"}
                onPointerDown={(e) => e.stopPropagation()} onClick={() => onToggle(row.id)}>
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="dfg-folderbox" data-on={here === row.id ? "1" : "0"}
                data-drop={s.dropId === row.id ? "1" : "0"}>
                <button className="dfg-node" onClick={tapped(() => onSelect(row.id))}>
                  <FolderIcon open={open} />
                  <b>{row.title}</b>
                  {total > 0 && <em>{total}</em>}
                </button>
                <button className="dfg-act" onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onMenu(row.id)}>⋯</button>
              </div>
            </div>
            {creating && creating.parentId === row.id && (
              <NewRow depth={row.depth + 1} onCommit={onCreate} onCancel={onCancelCreate} />
            )}
          </React.Fragment>
        );
      })}
      {s.slot === rows.length && s.id ? <div className="dfg-slot" /> : null}
    </div>
  );
}


function NewRow({ depth, onCommit, onCancel }: { depth: number; onCommit: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return (
    <div className="dfg-row">
      <div className="dfg-rails">{Array.from({ length: depth }).map((_, k) => <i key={k} />)}</div>
      <span className="dfg-caret" data-empty="1" />
      <div className="dfg-folderbox">
        <span className="dfg-node">
        <FolderIcon />
        <input ref={ref} className="dfg-newname" value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => onCommit(v)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(v);
            if (e.key === "Escape") onCancel();
          }} />
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 付箋の面 — フォルダ配下を一覧で見比べ、重ねて束ねる                  */
/* ------------------------------------------------------------------ */

function subtreeItems(topics: Topic[], items: Item[], rootId: string) {
  const ids: (string | null)[] = rootId === ROOT ? [null] : [rootId, ...descendantIds(topics, rootId)];
  return items.filter((i) => ids.includes(i.topicId || null) || ids.includes(i.topicId));
}

const NOTE_COLORS = [
  { id: "plain",  bg: "#EDE9DE", edge: "#BCB49F" },
  { id: "amber",  bg: "#F5D68B", edge: "#C99A2E" },
  { id: "rose",   bg: "#F2B9BC", edge: "#C46E76" },
  { id: "teal",   bg: "#A9DBD2", edge: "#489C93" },
  { id: "indigo", bg: "#BCC6F0", edge: "#6E7BC9" },
  { id: "olive",  bg: "#D2DFA4", edge: "#8DA34F" },
];
const colorOf = (id?: string) => NOTE_COLORS.find((c) => c.id === id) || NOTE_COLORS[0];

/* 置いた場所を覚える。まだ置かれていないものは、雑に散らしてから渡す。 */
function scatter(i: number, w: number): Pos {
  const cols = 2;
  const cw = (w - 24) / cols;
  const col = i % cols;
  const row = Math.floor(i / cols);
  const jx = ((i * 37) % 19) - 9;
  const jy = ((i * 53) % 23) - 11;
  return {
    x: Math.max(4, 10 + col * cw + jx),
    y: 10 + row * 132 + jy,
    r: (((i * 29) % 7) - 3) * 0.9,
  };
}

interface WallProps {
  topics: Topic[]; items: Item[]; rootId: string;
  onOpenDrawer: () => void;
  onOpen: (id: string) => void;
  onBundle: (dragId: string, targetId: string) => void;
  onPos: (id: string, pos: Pos) => void;
  onDraft: () => void;
}
interface WallRect { id: string; cx: number; cy: number; w: number; h: number }
interface WallDrag { id: string; x0: number; y0: number; base: Pos; rects: WallRect[] }

function Wall({ topics, items, rootId, onOpenDrawer, onOpen, onBundle, onPos, onDraft }: WallProps) {
  const list = useMemo(() => subtreeItems(topics, items, rootId), [topics, items, rootId]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const drag = useRef<WallDrag | null>(null);
  const [st, setSt] = useState<{ id: string | null; x: number; y: number; dropId: string | null }>({ id: null, x: 0, y: 0, dropId: null });

  /* 未配置のものに初期位置を与える */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const w = el.clientWidth || 360;
    list.forEach((it, i) => {
      if (!it.pos) onPos(it.id, scatter(i, w));
    });
  }, [list, onPos]);

  const height = useMemo(() => {
    let max = 260;
    list.forEach((it) => { if (it.pos) max = Math.max(max, it.pos.y + 200); });
    return max;
  }, [list]);

  const measure = () =>
    list.map((it) => {
      const el = refs.current[it.id];
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { id: it.id, cx: b.left + b.width / 2, cy: b.top + b.height / 2, w: b.width, h: b.height };
    }).filter((r): r is WallRect => r !== null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => { if (drag.current) e.preventDefault(); };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  const { down, move, up, tapped } = useDrag<Item>({
    /* 静止時間は仕様の0.2秒に統一(旧実装は180ms)。横はスワイプが無いので9pxで譲る */
    cancelX: 9,
    cancelY: 9,
    isDragging: () => !!drag.current,
    onHold: (item, _el, point) => {
      const base = item.pos || { x: 10, y: 10, r: 0 };
      drag.current = { id: item.id, x0: point.x, y0: point.y, base, rects: measure() };
      setSt({ id: item.id, x: base.x, y: base.y, dropId: null });
    },
    onDragMove: (e) => {
      const d = drag.current;
      if (!d) return;
      e.preventDefault();
      const nx = Math.max(0, d.base.x + (e.clientX - d.x0));
      const ny = Math.max(0, d.base.y + (e.clientY - d.y0));
      let dropId: string | null = null;
      for (const r of d.rects) {
        if (r.id === d.id) continue;
        if (Math.abs(e.clientX - r.cx) < r.w * 0.3 && Math.abs(e.clientY - r.cy) < r.h * 0.3) { dropId = r.id; break; }
      }
      setSt({ id: d.id, x: nx, y: ny, dropId });
    },
    onDragEnd: () => {
      const d = drag.current;
      if (d) {
        if (st.dropId) onBundle(d.id, st.dropId);
        else onPos(d.id, { x: st.x, y: st.y, r: d.base.r || 0 });
      }
      drag.current = null;
      setSt({ id: null, x: 0, y: 0, dropId: null });
    },
  });

  return (
    <div className="dfg-wall">
      <div className="dfg-wallbar">
        <button className="dfg-into" style={{ flex: 1 }} onClick={onOpenDrawer}>{pathLabel(topics, rootId === ROOT ? null : rootId)}</button>
        <button className="dfg-btn" data-quiet="1" onClick={onDraft}>下書き</button>
      </div>
      <div className="dfg-wallscroll" data-drag={st.id ? "1" : "0"}
        onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="dfg-canvas" ref={canvasRef} style={{ height }}>
          {list.length === 0 && <div className="dfg-empty">ここにはまだ何もない。</div>}
          {list.map((it) => {
            const dragging = st.id === it.id;
            const pos = dragging ? st : it.pos || { x: 10, y: 10, r: 0 };
            const rot = (it.pos && it.pos.r) || 1;
            const stamp = itemStamp(it);
            const col = colorOf(it.color);
            return (
              <div key={it.id} ref={(el) => { refs.current[it.id] = el; }} className="dfg-note"
                data-bundle={it.kind === "bundle" ? "1" : "0"}
                data-dragging={dragging ? "1" : "0"} data-drop={st.dropId === it.id ? "1" : "0"}
                style={{
                  left: pos.x, top: pos.y,
                  background: col.bg,
                  borderTopColor: it.color && it.color !== "plain" ? col.edge : ageColor(stamp),
                  color: "#23262E",
                  transform: dragging ? `rotate(${rot < 0 ? -3.5 : 3.5}deg) scale(1.06)` : undefined,
                }}
                onPointerDown={(e) => down(e, it)}
                onClick={tapped(() => onOpen(it.id))}>
                {it.kind === "bundle" && <span className="dfg-notestack" style={{ background: col.bg }} />}
                {it.kind === "bundle" && <b>{it.title || "名前のない束"}</b>}
                <q>{it.kind === "bundle" ? it.children.map((c) => c.text).join("\n\n") : it.text}</q>
                <footer>
                  <span className="dfg-pip" style={{ background: ageColor(stamp) }} />
                  <span>{absDate(stamp, true)}</span>
                  {it.kind === "bundle" && <span>{it.children.length}枚</span>}
                </footer>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* 可視化                                                              */
/* ------------------------------------------------------------------ */

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

interface Frag { id: string; ownerId: string; text: string; createdAt: number; topicId: string | null }

function eachFragment(items: Item[]) {
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

interface VizProps {
  topics: Topic[]; items: Item[]; rootId: string;
  onOpen: (id: string) => void; onOpenDrawer: () => void;
}

function Viz({ topics, items, rootId, onOpen, onOpenDrawer }: VizProps) {
  const [mode, setMode] = useState<"activity" | "clock" | "graph">("activity");
  const [scoped, setScoped] = useState(false);

  const source = useMemo(
    () => (scoped ? subtreeItems(topics, items, rootId) : items),
    [scoped, topics, items, rootId]
  );
  const frags = useMemo(() => eachFragment(source), [source]);

  return (
    <div className="dfg-viz">
      <div className="dfg-wallbar">
        <button className="dfg-into" style={{ flex: 1 }} onClick={onOpenDrawer}>
          {scoped ? pathLabel(topics, rootId === ROOT ? null : rootId) : "すべて"}
        </button>
        <button className="dfg-btn" data-quiet="1" style={{ color: scoped ? "var(--lamp)" : undefined }}
          onClick={() => setScoped((v) => !v)}>絞る</button>
      </div>

      <div className="dfg-vizmodes">
        <button className="dfg-chip" data-on={mode === "activity" ? "1" : "0"} onClick={() => setMode("activity")}>投稿数</button>
        <button className="dfg-chip" data-on={mode === "clock" ? "1" : "0"} onClick={() => setMode("clock")}>時刻</button>
        <button className="dfg-chip" data-on={mode === "graph" ? "1" : "0"} onClick={() => setMode("graph")}>類似</button>
      </div>

      <div className="dfg-vizbody">
        {frags.length === 0 ? (
          <div className="dfg-empty">まだ描けるものがない。</div>
        ) : mode === "activity" ? (
          <Activity frags={frags} />
        ) : mode === "clock" ? (
          <Clock frags={frags} />
        ) : (
          <Graph frags={frags} onOpen={onOpen} />
        )}
      </div>
    </div>
  );
}

/* 日ごとの投稿数 */
function Activity({ frags }: { frags: Frag[] }) {
  const { days, max } = useMemo(() => {
    const m = new Map<number, number>();
    let min = Infinity;
    frags.forEach((f) => {
      const d = new Date(f.createdAt);
      const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      m.set(k, (m.get(k) || 0) + 1);
      if (k < min) min = k;
    });
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const out: { t: number; n: number }[] = [];
    let mx = 1;
    for (let t = min; t <= end; t += DAY) {
      const n = m.get(t) || 0;
      if (n > mx) mx = n;
      out.push({ t, n });
    }
    return { days: out, max: mx };
  }, [frags]);

  const bw = 11;
  const gap = 3;
  const h = 190;
  const width = Math.max(days.length * (bw + gap), 260);

  return (
    <div className="dfg-scrollx">
      <svg width={width} height={h + 34} role="img">
        {days.map((d, i) => {
          const bh = d.n === 0 ? 2 : Math.max(3, (d.n / max) * h);
          const x = i * (bw + gap);
          const dt = new Date(d.t);
          const first = dt.getDate() === 1;
          return (
            <g key={d.t}>
              <rect x={x} y={h - bh} width={bw} height={bh} rx={2}
                fill={d.n === 0 ? "#232733" : ageColor(d.t)} opacity={d.n === 0 ? 0.5 : 1} />
              {first && (
                <>
                  <line x1={x - 1.5} y1={0} x2={x - 1.5} y2={h} stroke="#2C313D" strokeWidth="1" />
                  <text x={x} y={h + 20} fill="#6B7284" fontSize="10" fontFamily="ui-monospace, monospace">
                    {dt.getMonth() + 1}月
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="dfg-vizfoot dfg-mono">
        {frags.length}件 / {days.length}日 / 最多 {max}件
      </div>
    </div>
  );
}

/* 曜日 × 時間帯 */
function Clock({ frags }: { frags: Frag[] }) {
  const { grid, max } = useMemo(() => {
    const g = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let mx = 0;
    frags.forEach((f) => {
      const d = new Date(f.createdAt);
      g[d.getDay()][d.getHours()]++;
      if (g[d.getDay()][d.getHours()] > mx) mx = g[d.getDay()][d.getHours()];
    });
    return { grid: g, max: mx || 1 };
  }, [frags]);

  const cell = 13;
  const gap = 2;
  const left = 22;
  const top = 16;

  return (
    <div className="dfg-scrollx">
      <svg width={left + 24 * (cell + gap)} height={top + 7 * (cell + gap) + 8}>
        {[0, 6, 12, 18, 23].map((hh) => (
          <text key={hh} x={left + hh * (cell + gap)} y={10} fill="#6B7284" fontSize="9"
            fontFamily="ui-monospace, monospace">{hh}</text>
        ))}
        {grid.map((row, wd) => (
          <g key={wd}>
            <text x={0} y={top + wd * (cell + gap) + cell - 2} fill="#6B7284" fontSize="10">{WEEK[wd]}</text>
            {row.map((n, hh) => (
              <rect key={hh} x={left + hh * (cell + gap)} y={top + wd * (cell + gap)}
                width={cell} height={cell} rx={2.5}
                fill={n === 0 ? "#1A1D26" : "#E8A13A"} opacity={n === 0 ? 1 : 0.25 + (n / max) * 0.75} />
            ))}
          </g>
        ))}
      </svg>
      <div className="dfg-vizfoot dfg-mono">最も濃い枠で {max}件</div>
    </div>
  );
}

/* 断片どうしの近さ。線を引くだけで、まとめはしない。 */
function Graph({ frags, onOpen }: { frags: Frag[]; onOpen: (id: string) => void }) {
  const [level, setLevel] = useState(0.09);
  const list = useMemo(() => frags.slice(0, 140), [frags]);

  const vecs = useMemo(() => {
    const idf = buildIdf(list.map((f) => f.text));
    return list.map((f) => vectorize(f.text, idf));
  }, [list]);

  const edges = useMemo(() => {
    const out: { a: number; b: number; v: number }[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const v = cosine(vecs[i], vecs[j]);
        if (v >= level) out.push({ a: i, b: j, v });
      }
    }
    return out;
  }, [vecs, level]);

  const W = 340;
  const H = 340;

  const nodes = useMemo(() => {
    const n = list.map((f, i) => {
      const ang = (i / Math.max(1, list.length)) * Math.PI * 2;
      return { x: W / 2 + Math.cos(ang) * 120, y: H / 2 + Math.sin(ang) * 120, vx: 0, vy: 0 };
    });
    for (let step = 0; step < 220; step++) {
      for (let i = 0; i < n.length; i++) {
        for (let j = i + 1; j < n.length; j++) {
          let dx = n[j].x - n[i].x;
          let dy = n[j].y - n[i].y;
          let d2 = dx * dx + dy * dy || 0.01;
          const rep = 420 / d2;
          const d = Math.sqrt(d2);
          const ux = dx / d;
          const uy = dy / d;
          n[i].vx -= ux * rep; n[i].vy -= uy * rep;
          n[j].vx += ux * rep; n[j].vy += uy * rep;
        }
      }
      edges.forEach((e) => {
        const a = n[e.a];
        const b = n[e.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 46) * 0.012 * (0.4 + e.v);
        const ux = dx / d;
        const uy = dy / d;
        a.vx += ux * f; a.vy += uy * f;
        b.vx -= ux * f; b.vy -= uy * f;
      });
      n.forEach((p) => {
        p.vx += (W / 2 - p.x) * 0.0016;
        p.vy += (H / 2 - p.y) * 0.0016;
        p.x += Math.max(-6, Math.min(6, p.vx));
        p.y += Math.max(-6, Math.min(6, p.vy));
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x = Math.max(14, Math.min(W - 14, p.x));
        p.y = Math.max(14, Math.min(H - 14, p.y));
      });
    }
    return n;
  }, [list, edges]);

  const linked = useMemo(() => {
    const set = new Set();
    edges.forEach((e) => { set.add(e.a); set.add(e.b); });
    return set;
  }, [edges]);

  return (
    <>
      <div className="dfg-vizmodes" style={{ marginTop: 0 }}>
        <button className="dfg-chip" data-on={level === 0.05 ? "1" : "0"} onClick={() => setLevel(0.05)}>ゆるく</button>
        <button className="dfg-chip" data-on={level === 0.09 ? "1" : "0"} onClick={() => setLevel(0.09)}>ふつう</button>
        <button className="dfg-chip" data-on={level === 0.16 ? "1" : "0"} onClick={() => setLevel(0.16)}>きつく</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: "62vh" }}>
        {edges.map((e, i) => (
          <line key={i} x1={nodes[e.a].x} y1={nodes[e.a].y} x2={nodes[e.b].x} y2={nodes[e.b].y}
            stroke="#4E647A" strokeWidth={0.6 + e.v * 3} opacity={0.3 + e.v} />
        ))}
        {nodes.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={linked.has(i) ? 5.5 : 3.4}
            fill={ageColor(list[i].createdAt)} opacity={linked.has(i) ? 1 : 0.45}
            onClick={() => onOpen(list[i].ownerId)} style={{ cursor: "pointer" }} />
        ))}
      </svg>
      <div className="dfg-vizfoot dfg-mono">{list.length}件 / {edges.length}本の線</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 下書き — フォルダ配下を繋いだ状態から書き始める                      */
/* ------------------------------------------------------------------ */

function Draft({ topics, items, rootId, onClose }: { topics: Topic[]; items: Item[]; rootId: string; onClose: () => void }) {
  const initial = useMemo(() => {
    const render = (it: Item) => {
      if (it.kind === "bundle") {
        const head = it.title ? it.title + "\n\n" : "";
        return head + it.children.map((c) => c.text).join("\n\n");
      }
      return it.text;
    };
    const section = (tid: string, depth: number): string => {
      const t = topics.find((x) => x.id === tid);
      const parts: string[] = [];
      if (t) parts.push(`${"#".repeat(Math.min(depth + 1, 6))} ${t.title}`);
      const own = items.filter((i) => (i.topicId || null) === (tid === ROOT ? null : tid));
      if (own.length) parts.push(own.map(render).join("\n\n"));
      if (tid !== ROOT) childrenOf(topics, tid).forEach((c) => {
        const sec = section(c.id, depth + 1);
        if (sec) parts.push(sec);
      });
      return parts.join("\n\n");
    };
    return section(rootId, 0);
  }, [topics, items, rootId]);

  const [text, setText] = useState(initial);
  const { done, copy, ref } = useCopy(text);

  return (
    <div className="dfg-draft">
      <div className="dfg-wallbar">
        <h2>下書き — {pathLabel(topics, rootId === ROOT ? null : rootId)}</h2>
        <button className="dfg-btn" data-key="1" onClick={copy}>{done ? "コピーした" : "コピー"}</button>
        <button className="dfg-close" onClick={onClose} aria-label="閉じる">✕</button>
      </div>
      <textarea ref={ref} className="dfg-drafttext" value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* sheets                                                              */
/* ------------------------------------------------------------------ */

function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <>
      <div className="dfg-scrim" onClick={onClose} />
      <div className="dfg-sheet" role="dialog" aria-label={title}>
        <div className="dfg-shead">
          <h2>{title}</h2>
          <button className="dfg-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        {children}
      </div>
    </>
  );
}

function NewFolder({ parentName, onClose, onCreate }: {
  parentName?: string | null; onClose: () => void; onCreate: (title: string) => void;
}) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return (
    <Sheet title={parentName ? `${parentName} の下に` : "フォルダを作る"} onClose={onClose}>
      <div className="dfg-sbody">
        <input ref={ref} className="dfg-titleinput" value={v} placeholder="フォルダ名"
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onCreate(v); }} />
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={() => onCreate(v)} disabled={!v.trim()}>作る</button>
      </div>
    </Sheet>
  );
}

function FolderMenu({ folder, onRename, onCopy, onWall, onDraft, onAddChild, onSort, onMove, onDelete, onClose }: {
  folder: Topic;
  onRename: (v: string) => void;
  onCopy: () => void;
  onWall: () => void;
  onDraft: () => void;
  onAddChild: () => void;
  onSort: (dir: "new" | "old") => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(folder.title);
  return (
    <Sheet title="フォルダ" onClose={onClose}>
      <div className="dfg-sbody">
        <input className="dfg-titleinput" value={v} onChange={(e) => { setV(e.target.value); onRename(e.target.value); }} />
        <div className="dfg-label">できること</div>
        <button className="dfg-btn" data-block="1" data-key="1" onClick={onDraft}>下書きにする</button>
        <button className="dfg-btn" data-block="1" onClick={onWall}>付箋で並べる</button>
        <button className="dfg-btn" data-block="1" onClick={onCopy}>まとめてコピー</button>
        <button className="dfg-btn" data-block="1" onClick={onAddChild}>この下にフォルダを作る</button>
        <button className="dfg-btn" data-block="1" onClick={onMove}>別のフォルダの下に移す</button>
        <div className="dfg-label">中身を並べ直す</div>
        <div className="dfg-chips">
          <button className="dfg-chip" onClick={() => onSort("new")}>新しい順</button>
          <button className="dfg-chip" onClick={() => onSort("old")}>古い順</button>
        </div>
        <div className="dfg-label">消す</div>
        <button className="dfg-btn" data-block="1" data-warn="1" onClick={onDelete}>このフォルダを消す</button>
      </div>
    </Sheet>
  );
}

function TopicRows({ topics, current, onPick }: {
  topics: Topic[]; current?: string | null; onPick: (id: string | null) => void;
}) {
  const rows = useMemo(() => flatTopics(topics), [topics]);
  return (
    <>
      <button className="dfg-pickrow" data-on={!current ? "1" : "0"} onClick={() => onPick(null)}>
        <span className="dfg-mono">/</span>
      </button>
      {rows.map((r) => (
        <button key={r.topic.id} className="dfg-pickrow" data-on={current === r.topic.id ? "1" : "0"}
          style={{ paddingLeft: 10 + r.depth * 18 }} onClick={() => onPick(r.topic.id)}>
          <FolderIcon />{r.topic.title}
        </button>
      ))}
    </>
  );
}

function PickSheet({ title, topics, current, onPick, onClose }: {
  title: string; topics: Topic[]; current?: string | null;
  onPick: (id: string | null) => void; onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="dfg-sbody">
        <TopicRows topics={topics} current={current} onPick={onPick} />
      </div>
    </Sheet>
  );
}

function Palette({ value, onPick }: { value?: string; onPick: (id: string) => void }) {
  return (
    <div className="dfg-palette">
      {NOTE_COLORS.map((c) => (
        <button key={c.id} className="dfg-swatch" data-on={(value || "plain") === c.id ? "1" : "0"}
          style={{ background: c.bg, borderTopColor: c.edge }} onClick={() => onPick(c.id)} aria-label={c.id} />
      ))}
    </div>
  );
}

function CardView({ card, items, topics, onMove, onColor, onDelete }: {
  card: CardItem; items: Item[]; topics: Topic[];
  onMove: (tid: string | null) => void; onColor: (c: string) => void; onDelete: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const near = useMemo(() => {
    const pool: string[] = [];
    items.forEach((it) => {
      if (it.id === card.id) return;
      flattenTexts(it).forEach((t) => pool.push(t));
    });
    const idf = buildIdf([card.text, ...pool]);
    const cv = vectorize(card.text, idf);
    return pool
      .map((t) => ({ text: t, s: cosine(cv, vectorize(t, idf)) }))
      .filter((e) => e.s > 0.05)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
  }, [card, items]);

  if (picking) {
    return (
      <div className="dfg-sbody">
        <TopicRows topics={topics} current={card.topicId} onPick={(tid) => { onMove(tid); setPicking(false); }} />
      </div>
    );
  }

  return (
    <>
      <div className="dfg-sbody">
        <div className="dfg-full">{card.text}</div>
        <div className="dfg-hint dfg-mono" style={{ marginTop: 14 }}>{absDate(card.createdAt, true)}</div>
        <div className="dfg-label">色</div>
        <Palette value={card.color} onPick={onColor} />
        <div className="dfg-label">いる場所</div>
        <button className="dfg-btn" data-block="1" onClick={() => setPicking(true)}>{pathLabel(topics, card.topicId)}</button>
        {near.length > 0 && (
          <>
            <div className="dfg-label">似ているかもしれないもの</div>
            {near.map((n, i) => <div className="dfg-sim" key={i}>{n.text}</div>)}
          </>
        )}
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-warn="1" onClick={onDelete}>捨てる</button>
      </div>
    </>
  );
}

function BundleView({ bundle, topics, onChange, onExport, onUnbundle, onPromote }: {
  bundle: BundleItem; topics: Topic[];
  onChange: (patch: ItemPatch) => void;
  onExport: () => void; onUnbundle: () => void; onPromote: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const move = (i: number, dir: number) => {
    const next = bundle.children.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ children: next });
  };
  const drop = (i: number) => {
    const next = bundle.children.slice();
    next.splice(i, 1);
    onChange({ children: next });
  };

  if (picking) {
    return (
      <div className="dfg-sbody">
        <TopicRows topics={topics} current={bundle.topicId} onPick={(tid) => { onChange({ topicId: tid }); setPicking(false); }} />
      </div>
    );
  }

  return (
    <>
      <div className="dfg-sbody">
        <input className="dfg-titleinput" value={bundle.title} placeholder="この束は何の話か"
          onChange={(e) => onChange({ title: e.target.value })} />
        <div className="dfg-label">中身 — 上から順に書き出される</div>
        {bundle.children.map((c, i) => (
          <div className="dfg-child" key={c.id}>
            <p>{c.text}</p>
            <button className="dfg-mini" onClick={() => move(i, -1)} aria-label="上へ">↑</button>
            <button className="dfg-mini" onClick={() => move(i, 1)} aria-label="下へ">↓</button>
            <button className="dfg-mini" onClick={() => drop(i)} aria-label="外す">×</button>
          </div>
        ))}
        <div className="dfg-label">色</div>
        <Palette value={bundle.color} onPick={(c) => onChange({ color: c })} />
        <div className="dfg-label">いる場所</div>
        <button className="dfg-btn" data-block="1" onClick={() => setPicking(true)}>{pathLabel(topics, bundle.topicId)}</button>
        <div className="dfg-label">育ってきたら</div>
        <button className="dfg-btn" data-block="1" onClick={onPromote}>この束をフォルダにする</button>
      </div>
      <div className="dfg-sfoot">
        <button className="dfg-btn" data-quiet="1" onClick={onUnbundle}>束を解く</button>
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={onExport}>書き出す</button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* copy                                                                */
/* ------------------------------------------------------------------ */

function useCopy(text: string) {
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { if (ref.current) ref.current.select(); }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return { done, copy, ref };
}

function TopicCopy({ items, topics, topicId }: { items: Item[]; topics: Topic[]; topicId: string }) {
  const [md, setMd] = useState(true);
  const [dates, setDates] = useState(false);
  const [deep, setDeep] = useState(true);

  const text = useMemo(() => {
    const line = (t: string, ts: number) => (dates ? `${shortDate(ts)}  ${t}` : t);
    const renderItem = (it: Item) => {
      if (it.kind === "bundle") {
        const head = it.title ? (md ? `**${it.title}**` : it.title) : "";
        const body = it.children.map((c) => line(c.text, c.createdAt)).join("\n\n");
        return head ? `${head}\n\n${body}` : body;
      }
      return line(it.text, it.createdAt);
    };
    const section = (tid: string, depth: number): string => {
      const t = topics.find((x) => x.id === tid);
      if (!t) return "";
      const head = md ? `${"#".repeat(Math.min(depth + 1, 6))} ${t.title}` : t.title;
      const own = items.filter((i) => i.topicId === tid).map(renderItem).filter(Boolean);
      const parts = [head];
      if (own.length) parts.push(own.join("\n\n"));
      if (deep) childrenOf(topics, tid).forEach((c) => {
        const s = section(c.id, depth + 1);
        if (s) parts.push(s);
      });
      return parts.join("\n\n");
    };
    return section(topicId, 0);
  }, [items, topics, topicId, md, dates, deep]);

  const { done, copy, ref } = useCopy(text);
  const hasKids = childrenOf(topics, topicId).length > 0;

  return (
    <>
      <div className="dfg-sbody">
        <div className="dfg-chips">
          <button className="dfg-chip" data-on={md ? "1" : "0"} onClick={() => setMd((v) => !v)}>見出しをつける</button>
          <button className="dfg-chip" data-on={dates ? "1" : "0"} onClick={() => setDates((v) => !v)}>日付を入れる</button>
          {hasKids && <button className="dfg-chip" data-on={deep ? "1" : "0"} onClick={() => setDeep((v) => !v)}>子も含める</button>}
        </div>
        <textarea ref={ref} className="dfg-out" value={text} readOnly />
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={copy}>{done ? "コピーした" : "コピー"}</button>
      </div>
    </>
  );
}

function BundleExport({ bundle }: { bundle: BundleItem }) {
  const initial = useMemo(() => {
    const head = bundle.title ? bundle.title + "\n\n" : "";
    return head + bundle.children.map((c) => c.text).join("\n\n");
  }, [bundle]);
  const [text, setText] = useState(initial);
  const { done, copy, ref } = useCopy(text);
  return (
    <>
      <div className="dfg-sbody">
        <textarea ref={ref} className="dfg-out" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={copy}>{done ? "コピーした" : "コピー"}</button>
      </div>
    </>
  );
}
