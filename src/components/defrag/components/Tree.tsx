import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrag } from "../useDrag";
import { ROOT, buildRows, itemLabel, itemStamp } from "../tree";
import { absDate, ageColor } from "../format";
import type { Item, Row, Topic } from "../types";
import { FolderIcon } from "./FolderIcon";
import { NewRow } from "./NewRow";

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

export function Tree({ topics, items, expanded, here, countIn, onSelect, onToggle, onOpenItem, onMenu,
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

