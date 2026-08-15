import { useState } from "react";
import { pathLabel } from "../tree";
import type { BundleItem, ItemPatch, Topic } from "../types";
import { Palette } from "./Palette";
import { TopicRows } from "./TopicRows";

export function BundleView({ bundle, topics, onChange, onExport, onUnbundle, onPromote }: {
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
