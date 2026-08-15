import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDrag } from "../useDrag";
import { ROOT, itemStamp, pathLabel, subtreeItems } from "../tree";
import { absDate, ageColor, colorOf } from "../format";
import type { Item, Pos, Topic } from "../types";

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
export function Wall({ topics, items, rootId, onOpenDrawer, onOpen, onBundle, onPos, onDraft }: WallProps) {
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

