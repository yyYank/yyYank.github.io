import { describe, expect, it } from "vitest";
import { searchAll } from "../search";
import type { Item, Topic } from "../types";

const topics: Topic[] = [
  { id: "t1", title: "キーボード", parentId: null, createdAt: 1 },
  { id: "t2", title: "料理", parentId: null, createdAt: 2 },
];
const items: Item[] = [
  { id: "i1", kind: "card", text: "キーボードを新調したい", createdAt: 3, topicId: null },
  { id: "i2", kind: "card", text: "今日は眠い", createdAt: 4, topicId: null },
  {
    id: "b1", kind: "bundle", title: "買い物", createdAt: 5, topicId: null,
    children: [{ id: "c1", text: "キーボードの比較メモ", createdAt: 5 }],
  },
];

describe("searchAll", () => {
  // 空クエリは何もヒットしないことを検証する
  it("returns nothing for empty query", () => {
    expect(searchAll(topics, items, "")).toEqual([]);
    expect(searchAll(topics, items, "  ")).toEqual([]);
  });

  // 部分一致で断片とフォルダの両方がヒットすることを検証する
  it("hits both fragments and folders by substring", () => {
    const hits = searchAll(topics, items, "キーボード");
    const ids = hits.map((h) => (h.type === "topic" ? h.topic.id : h.item.id));
    expect(ids).toContain("t1");
    expect(ids).toContain("i1");
    expect(ids).toContain("b1");
    expect(ids).not.toContain("i2");
    expect(ids).not.toContain("t2");
  });

  // 完全な部分一致が曖昧一致より上位に来ることを検証する
  it("ranks substring matches above fuzzy-only matches", () => {
    const fuzzyItems: Item[] = [
      ...items,
      { id: "i3", kind: "card", text: "キー配列のこだわり", createdAt: 6, topicId: null },
    ];
    const hits = searchAll(topics, fuzzyItems, "キーボード");
    const first = hits[0];
    const firstText = first.type === "topic" ? first.topic.title : (first.item.kind === "card" ? first.item.text : first.item.title);
    expect(firstText.includes("キーボード")).toBe(true);
  });
});
