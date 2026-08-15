import { useMemo, useState } from "react";
import { ROOT, childrenOf, pathLabel } from "../tree";
import type { Item, Topic } from "../types";
import { useCopy } from "./useCopy";

export function Draft({ topics, items, rootId, onClose }: { topics: Topic[]; items: Item[]; rootId: string; onClose: () => void }) {
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
