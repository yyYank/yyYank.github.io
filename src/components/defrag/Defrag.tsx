import { useState, useEffect, useReducer, useRef, useCallback, useMemo } from "react";
import { CSS } from "./styles";
import { buildIdf, cosine, vectorize } from "./similarity";
import { ROOT, descendantIds, flattenTexts, pathLabel } from "./tree";
import { loadAll, saveAll, storeReducer, uid } from "./store";
import { syncBookmarks, BOOKMARKS_FOLDER_ID, type Favorite } from "./bookmarkSync";
import { buildTweetBookmark, type TweetData } from "./tweetBookmark";
import type { Item, ItemPatch, Topic } from "./types";
import { Sheet } from "./components/Sheet";
import { TweetBookmarkSheet } from "./components/TweetBookmarkSheet";
import { Tree } from "./components/Tree";
import { Timeline } from "./components/Timeline";
import { Wall } from "./components/Wall";
import { Viz } from "./components/Viz";
import { Draft } from "./components/Draft";
import { NewFolder } from "./components/NewFolder";
import { FolderMenu } from "./components/FolderMenu";
import { PickSheet } from "./components/PickSheet";
import { CardView } from "./components/CardView";
import { BundleView } from "./components/BundleView";
import { TopicCopy } from "./components/TopicCopy";
import { BundleExport } from "./components/BundleExport";

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

export default function Defrag() {
  const [store, dispatch] = useReducer(storeReducer, { items: [], topics: [] });
  const { items, topics } = store;
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
  const [tweetSheet, setTweetSheet] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    loadAll().then((d) => {
      if (!alive) return;
      if (d) {
        let items: Item[] = Array.isArray(d.items) ? d.items : [];
        let topics: Topic[] = Array.isArray(d.topics) ? d.topics : [];
        // feedsのお気に入りをbookmarksフォルダへ追加専用で同期する(削除・改変は行わない)
        try {
          const raw = localStorage.getItem("feeds-favorites");
          const favorites: Favorite[] = raw ? JSON.parse(raw) : [];
          if (Array.isArray(favorites) && favorites.length > 0) {
            const synced = syncBookmarks(topics, items, favorites);
            items = synced.items;
            topics = synced.topics;
          }
        } catch (e) {
          // parse失敗時は同期をスキップし、既存データのみ読み込む
        }
        dispatch({ type: "load", items, topics });
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
    dispatch({ type: "addItem", item: { id: uid(), kind: "card", text: v, createdAt: Date.now(), topicId: hereId } });
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

  const countIn = useCallback((tid: string) => {
    if (tid === ROOT) return items.filter((i) => !i.topicId).length;
    const ids: (string | null)[] = [tid, ...descendantIds(topics, tid)];
    return items.filter((i) => ids.includes(i.topicId)).length;
  }, [items, topics]);

  /* --- items --- */

  const moveItem = (id: string, topicId?: string | null, beforeId?: string | null) =>
    dispatch({ type: "moveItem", id, topicId, beforeId });

  const bundle = (dragId: string, targetId: string) => dispatch({ type: "bundle", dragId, targetId });

  const sortWithin = (tid: string, dir: "new" | "old") => dispatch({ type: "sortWithin", tid, dir });

  const trashItem = (id: string) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const gone = items[idx];
    dispatch({ type: "removeItem", id });
    setTrash({ item: gone, index: idx });
  };
  const undoTrash = () => {
    if (!trash) return;
    dispatch({ type: "restoreItem", item: trash.item, index: trash.index });
    setTrash(null);
  };

  const patchItem = (id: string, patch: ItemPatch) => dispatch({ type: "patchItem", id, patch });

  const unbundle = (id: string) => dispatch({ type: "unbundle", id });

  /* --- folders --- */

  const addFolder = (title: string, parentId?: string | null) => {
    const t: Topic = { id: uid(), title: title.trim() || "名前のないフォルダ", parentId: parentId || null, createdAt: Date.now() };
    dispatch({ type: "addTopic", topic: t });
    if (parentId) setExpanded((c) => ({ ...c, [parentId]: true }));
    setHere(t.id);
  };
  const patchFolder = (id: string, patch: Partial<Topic>) => dispatch({ type: "patchTopic", id, patch });

  /* bookmarks親フォルダはbookmarkSync.tsの同期と共有するため、無ければここでも同じidで作る */
  const addTweetBookmark = (tweet: TweetData, url: string) => {
    const now = Date.now();
    if (!topics.some((t) => t.id === BOOKMARKS_FOLDER_ID)) {
      dispatch({ type: "addTopic", topic: { id: BOOKMARKS_FOLDER_ID, title: "bookmarks", parentId: null, createdAt: now } });
    }
    const { topic, card, monthTopic } = buildTweetBookmark(tweet, url, now);
    // 月フォルダはbookmarkSync.tsの同期と共有するため、無ければここでも同じidで作る(重複生成防止)
    if (!topics.some((t) => t.id === monthTopic.id)) dispatch({ type: "addTopic", topic: monthTopic });
    if (!topics.some((t) => t.id === topic.id)) dispatch({ type: "addTopic", topic });
    if (!items.some((i) => i.id === card.id)) dispatch({ type: "addItem", item: card });
    setTweetSheet(false);
  };

  const removeFolder = (id: string) => {
    const t = topics.find((x) => x.id === id);
    const up = t ? t.parentId || null : null;
    dispatch({ type: "removeFolder", id });
    setHere(up || ROOT);
  };

  const nestFolder = (dragId: string, newParentId: string | null) => {
    if (dragId === newParentId) return;
    const pid = newParentId === ROOT ? null : newParentId;
    if (pid && descendantIds(topics, dragId).includes(pid)) return;
    dispatch({ type: "nestFolder", dragId, newParentId });
    if (pid) setExpanded((c) => ({ ...c, [pid]: true }));
  };

  const moveFolderBefore = (dragId: string, beforeId: string | null) =>
    dispatch({ type: "moveFolderBefore", dragId, beforeId });

  const promote = (id: string) => {
    const b = items.find((i) => i.id === id);
    if (!b || b.kind !== "bundle") return;
    const parent = b.topicId || null;
    const t: Topic = { id: uid(), title: b.title || "名前のないフォルダ", parentId: parent, createdAt: Date.now() };
    dispatch({ type: "promote", id, topic: t });
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
        <div className="dfg-composetop">
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
            <div className="dfg-grow" />
            <button className="dfg-send" onClick={throwIt} disabled={!draft.trim()}>投げる</button>
          </div>
          {flash ? <div className="dfg-flash dfg-mono" key={flash}>投稿しました</div> : null}
        </div>
        <div className="dfg-composebottom">
          <Timeline items={items} hereId={hereId} onOpen={setOpenId} />
        </div>
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
            <button className="dfg-tool" onClick={() => setTweetSheet(true)} aria-label="ツイートを保存">𝕏</button>
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

      {tweetSheet && (
        <TweetBookmarkSheet onClose={() => setTweetSheet(false)} onAdd={addTweetBookmark} />
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
