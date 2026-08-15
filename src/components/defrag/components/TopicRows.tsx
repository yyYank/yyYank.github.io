import { useMemo } from "react";
import { flatTopics } from "../tree";
import type { Topic } from "../types";
import { FolderIcon } from "./FolderIcon";

export function TopicRows({ topics, current, onPick }: {
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
