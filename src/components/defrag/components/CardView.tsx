import { useMemo, useState } from "react";
import { buildIdf, cosine, vectorize } from "../similarity";
import { absDate } from "../format";
import { linkifyParts } from "../linkify";
import { flattenTexts, pathLabel } from "../tree";
import type { CardItem, Comment, Item, Topic } from "../types";
import { Palette } from "./Palette";

// storeのuidと同じ生成方式。componentsはstore.tsに依存しない方針のためここに閉じて複製する
const commentId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function CardView({ card, items, topics, onGoTopic, onGoNear, onColor, onDelete, onComments }: {
  card: CardItem; items: Item[]; topics: Topic[];
  onGoTopic: () => void; onGoNear: (topicId: string | null) => void;
  onColor: (c: string) => void; onDelete: () => void;
  onComments: (comments: Comment[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const near = useMemo(() => {
    // 束の断片は束自体のtopicIdをタップ先として使う
    const pool: { text: string; topicId: string | null }[] = [];
    items.forEach((it) => {
      if (it.id === card.id) return;
      flattenTexts(it).forEach((t) => pool.push({ text: t, topicId: it.topicId }));
    });
    const idf = buildIdf([card.text, ...pool.map((p) => p.text)]);
    const cv = vectorize(card.text, idf);
    return pool
      .map((p) => ({ ...p, s: cosine(cv, vectorize(p.text, idf)) }))
      .filter((e) => e.s > 0.05)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
  }, [card, items]);

  const comments = card.comments ?? [];
  const addComment = () => {
    const t = draft.trim();
    if (!t) return;
    onComments([...comments, { id: commentId(), text: t, createdAt: Date.now() }]);
    setDraft("");
  };
  const removeComment = (id: string) => onComments(comments.filter((c) => c.id !== id));

  return (
    <>
      <div className="dfg-sbody">
        <div className="dfg-full">
          {linkifyParts(card.text).map((p, i) => (
            typeof p === "string"
              ? <span key={i}>{p}</span>
              : <a key={i} className="dfg-link" href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>
          ))}
        </div>
        <div className="dfg-hint dfg-mono" style={{ marginTop: 14 }}>{absDate(card.createdAt, true)}</div>
        <div className="dfg-label">色</div>
        <Palette value={card.color} onPick={onColor} />
        <div className="dfg-label">いる場所</div>
        <button className="dfg-btn" data-block="1" onClick={onGoTopic}>{pathLabel(topics, card.topicId)}</button>
        {near.length > 0 && (
          <>
            <div className="dfg-label">似ているかもしれないもの</div>
            {near.map((n, i) => (
              <button className="dfg-sim" key={i} onClick={() => onGoNear(n.topicId)}>{n.text}</button>
            ))}
          </>
        )}
        <div className="dfg-label">コメント</div>
        {comments.map((c) => (
          <div className="dfg-comment" key={c.id}>
            <div className="dfg-commentbody">
              <p>{c.text}</p>
              <span className="dfg-commentmeta dfg-mono">{absDate(c.createdAt, true)}</span>
            </div>
            <button className="dfg-mini" onClick={() => removeComment(c.id)} aria-label="コメントを削除">×</button>
          </div>
        ))}
        <div className="dfg-commentadd">
          <textarea className="dfg-commentinput" value={draft} placeholder="コメントを書く"
            onChange={(e) => setDraft(e.target.value)} />
          <button className="dfg-btn" data-key="1" disabled={!draft.trim()} onClick={addComment}>追加</button>
        </div>
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-warn="1" onClick={onDelete}>捨てる</button>
      </div>
    </>
  );
}
