import { useMemo, useState } from "react";
import { shortDate } from "../format";
import { childrenOf } from "../tree";
import type { Item, Topic } from "../types";
import { useCopy } from "./useCopy";

export function TopicCopy({ items, topics, topicId }: { items: Item[]; topics: Topic[]; topicId: string }) {
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
