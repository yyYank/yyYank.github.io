import { describe, expect, it } from "vitest";
import { buildIdf, cosine, similarity, vectorize } from "../similarity";

// 仕様書の実測値はidf+当時のコーパス依存で再現不能のため、
// 現実装の値を回帰テストとして固定する(切出しで挙動が変わっていないことの保証)
describe("similarity", () => {
  it("keeps current idf-less similarity values as regression anchors", () => {
    expect(similarity("保育園の送りが大変", "保育園めんどい")).toBeCloseTo(0.289, 3);
    expect(similarity("眠すぎるな", "眠い")).toBeCloseTo(0.167, 3);
    expect(similarity("眠い", "眠くて何も書けない")).toBeCloseTo(0.236, 3);
  });

  // 字面が全く重ならない断片は0になることを検証する
  it("returns 0 for fragments with no shared grams", () => {
    expect(similarity("眠い", "保育園の送りが大変")).toBe(0);
  });

  // idf込みの経路(投げる時のエコー等が使う)も0と正の値の関係を保つことを検証する
  it("keeps idf-weighted cosine positive for related pairs and 0 for unrelated", () => {
    const corpus = ["保育園の送りが大変", "保育園めんどい", "眠い"];
    const idf = buildIdf(corpus);
    const sim = (a: string, b: string) => cosine(vectorize(a, idf), vectorize(b, idf));
    expect(sim("保育園の送りが大変", "保育園めんどい")).toBeGreaterThan(0.05);
    expect(sim("眠い", "保育園の送りが大変")).toBe(0);
  });
});
