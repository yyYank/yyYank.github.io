import { useMemo } from "react";
import { itemLabel, itemStamp } from "../tree";
import { absDate } from "../format";
import type { Item } from "../types";

/* 投げるタブ下半分に置く、選択中フォルダ直下(1階層のみ)の断片タイムライン。
   Twitter風に新しい順(itemStamp降順)で縦に並べ、タップで既存シートを開く。 */
export function Timeline({ items, hereId, onOpen }: {
  items: Item[]; hereId: string | null; onOpen: (id: string) => void;
}) {
  const rows = useMemo(
    () =>
      items
        .filter((i) => (i.topicId || null) === hereId)
        .slice()
        .sort((a, b) => itemStamp(b) - itemStamp(a)),
    [items, hereId]
  );

  if (rows.length === 0) {
    return <div className="dfg-tlempty">ここにはまだ断片がない</div>;
  }

  return (
    <div className="dfg-tl">
      {rows.map((it) => (
        <button key={it.id} className="dfg-tlrow" onClick={() => onOpen(it.id)}>
          <p>{itemLabel(it)}</p>
          <em className="dfg-mono">{absDate(itemStamp(it), true)}</em>
        </button>
      ))}
    </div>
  );
}
