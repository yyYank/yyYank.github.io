import { absDate } from "../format";
import { itemLabel, itemStamp, pathLabel } from "../tree";
import type { SearchHit } from "../search";
import type { Topic } from "../types";
import { FolderIcon } from "./FolderIcon";

export function SearchResults({ hits, topics, onPickTopic, onPickItem }: {
  hits: SearchHit[];
  topics: Topic[];
  onPickTopic: (id: string) => void;
  onPickItem: (id: string) => void;
}) {
  if (hits.length === 0) {
    return <div className="dfg-empty">見つからなかった。</div>;
  }

  return (
    <div className="dfg-srlist">
      {hits.map((hit) =>
        hit.type === "topic" ? (
          <button key={`t-${hit.topic.id}`} className="dfg-srrow" onClick={() => onPickTopic(hit.topic.id)}>
            <FolderIcon />
            <span className="dfg-srmain">
              <b>{hit.topic.title}</b>
              <em>{pathLabel(topics, hit.topic.parentId)}</em>
            </span>
          </button>
        ) : (
          <button key={`i-${hit.item.id}`} className="dfg-srrow" onClick={() => onPickItem(hit.item.id)}>
            <span className="dfg-srmain">
              <p>{itemLabel(hit.item)}</p>
              <em>{pathLabel(topics, hit.item.topicId)} · {absDate(itemStamp(hit.item), false)}</em>
            </span>
          </button>
        )
      )}
    </div>
  );
}
