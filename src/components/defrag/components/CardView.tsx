import { useMemo, useState } from "react";
import { buildIdf, cosine, vectorize } from "../similarity";
import { absDate } from "../format";
import { flattenTexts, pathLabel } from "../tree";
import type { CardItem, Item, Topic } from "../types";
import { Palette } from "./Palette";
import { TopicRows } from "./TopicRows";

export function CardView({ card, items, topics, onMove, onColor, onDelete }: {
  card: CardItem; items: Item[]; topics: Topic[];
  onMove: (tid: string | null) => void; onColor: (c: string) => void; onDelete: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const near = useMemo(() => {
    const pool: string[] = [];
    items.forEach((it) => {
      if (it.id === card.id) return;
      flattenTexts(it).forEach((t) => pool.push(t));
    });
    const idf = buildIdf([card.text, ...pool]);
    const cv = vectorize(card.text, idf);
    return pool
      .map((t) => ({ text: t, s: cosine(cv, vectorize(t, idf)) }))
      .filter((e) => e.s > 0.05)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
  }, [card, items]);

  if (picking) {
    return (
      <div className="dfg-sbody">
        <TopicRows topics={topics} current={card.topicId} onPick={(tid) => { onMove(tid); setPicking(false); }} />
      </div>
    );
  }

  return (
    <>
      <div className="dfg-sbody">
        <div className="dfg-full">{card.text}</div>
        <div className="dfg-hint dfg-mono" style={{ marginTop: 14 }}>{absDate(card.createdAt, true)}</div>
        <div className="dfg-label">色</div>
        <Palette value={card.color} onPick={onColor} />
        <div className="dfg-label">いる場所</div>
        <button className="dfg-btn" data-block="1" onClick={() => setPicking(true)}>{pathLabel(topics, card.topicId)}</button>
        {near.length > 0 && (
          <>
            <div className="dfg-label">似ているかもしれないもの</div>
            {near.map((n, i) => <div className="dfg-sim" key={i}>{n.text}</div>)}
          </>
        )}
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-warn="1" onClick={onDelete}>捨てる</button>
      </div>
    </>
  );
}
