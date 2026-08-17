import { similarity } from "./similarity";
import { flattenTexts } from "./tree";
import type { Item, Topic } from "./types";

/* 部分一致を最優先し、外部ライブラリを増やさないため曖昧一致は既存のn-gram類似度で補う */

export type SearchHit =
  | { type: "topic"; topic: Topic; score: number }
  | { type: "item"; item: Item; score: number };

const FUZZY_THRESHOLD = 0.08;
const LIMIT = 30;

function scoreText(query: string, text: string): number {
  if (text.toLowerCase().includes(query.toLowerCase())) {
    return 2 + similarity(query, text);
  }
  const s = similarity(query, text);
  return s >= FUZZY_THRESHOLD ? s : 0;
}

export function searchAll(topics: Topic[], items: Item[], query: string): SearchHit[] {
  const q = query.trim();
  if (!q) return [];

  const hits: SearchHit[] = [];

  topics.forEach((topic) => {
    const score = scoreText(q, topic.title);
    if (score > 0) hits.push({ type: "topic", topic, score });
  });

  items.forEach((item) => {
    const texts = item.kind === "bundle" ? [item.title, ...flattenTexts(item)] : flattenTexts(item);
    const score = Math.max(...texts.map((t) => scoreText(q, t)));
    if (score > 0) hits.push({ type: "item", item, score });
  });

  return hits.sort((a, b) => b.score - a.score).slice(0, LIMIT);
}
