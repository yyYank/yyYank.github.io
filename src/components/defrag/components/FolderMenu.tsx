import { useState } from "react";
import type { Topic } from "../types";
import { Sheet } from "./Sheet";

export function FolderMenu({ folder, onRename, onCopy, onWall, onDraft, onAddChild, onSort, onMove, onDelete, onClose }: {
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
