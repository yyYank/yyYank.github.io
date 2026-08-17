import { useEffect, useMemo, useRef, useState } from "react";
import { itemLabel, itemStamp } from "../tree";
import { absDate } from "../format";
import { useDrag } from "../useDrag";
import type { Item } from "../types";

/* 投げるタブ下半分に置く、選択中フォルダ直下(1階層のみ)の断片タイムライン。
   Twitter風に新しい順(itemStamp降順)で縦に並べ、タップで既存シートを開く。
   ツリーと同じ調停で左スワイプ削除(幅36%超)できる。 */
export function Timeline({ items, hereId, onOpen, onTrash }: {
  items: Item[]; hereId: string | null; onOpen: (id: string) => void; onTrash: (id: string) => void;
}) {
  const rows = useMemo(
    () =>
      items
        .filter((i) => (i.topicId || null) === hereId)
        .slice()
        .sort((a, b) => itemStamp(b) - itemStamp(a)),
    [items, hereId]
  );

  const [swipe, setSwipe] = useState<{ id: string | null; dx: number }>({ id: null, dx: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  const { down, move, up, tapped, holdRef } = useDrag<Item>({
    /* タイムラインは掴む操作を持たない。調停(スワイプ/スクロール判定)だけを借りる */
    holdMs: 600000,
    isDragging: () => false,
    onHold: () => {},
    onDragMove: () => {},
    onDragEnd: () => {},
    swipe: {
      canSwipe: () => true,
      onSwipeMove: (it, dx) => setSwipe({ id: it.id, dx: Math.min(0, dx) }),
      onSwipeEnd: (it, el) => {
        const w = el.offsetWidth || 320;
        if (Math.abs(swipe.dx) > w * 0.36) onTrash(it.id);
        setSwipe({ id: null, dx: 0 });
      },
    },
  });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (holdRef.current && holdRef.current.mode === "swipe") e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [holdRef]);

  if (rows.length === 0) {
    return <div className="dfg-tlempty">ここにはまだ断片がない</div>;
  }

  return (
    <div className="dfg-tl" ref={listRef} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {rows.map((it) => {
        const dx = swipe.id === it.id ? swipe.dx : 0;
        return (
          <div className="dfg-tlwrap" key={it.id}>
            {dx < 0 && <div className="dfg-swipebg" data-armed={Math.abs(dx) > 110 ? "1" : "0"}>捨てる</div>}
            <button
              className="dfg-tlrow"
              style={dx ? { transform: `translateX(${dx}px)`, background: "var(--ground)" } : undefined}
              onPointerDown={(e) => down(e, it)}
              onClick={tapped(() => onOpen(it.id))}
            >
              <p>{itemLabel(it)}</p>
              <em className="dfg-mono">{absDate(itemStamp(it), true)}</em>
            </button>
          </div>
        );
      })}
    </div>
  );
}
