import type { Topic } from "../types";
import { Sheet } from "./Sheet";
import { TopicRows } from "./TopicRows";

export function PickSheet({ title, topics, current, onPick, onClose }: {
  title: string; topics: Topic[]; current?: string | null;
  onPick: (id: string | null) => void; onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="dfg-sbody">
        <TopicRows topics={topics} current={current} onPick={onPick} />
      </div>
    </Sheet>
  );
}
