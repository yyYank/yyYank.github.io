import { describe, expect, it } from "vitest";
import { linkifyParts } from "../linkify";

describe("linkifyParts", () => {
  // URLを含まないテキストは分割されず1つの文字列要素のまま返る
  it("URLを含まないテキストはそのまま1要素で返す", () => {
    expect(linkifyParts("ただのメモです")).toEqual(["ただのメモです"]);
  });

  // 複数のURLがそれぞれ{url}要素として切り出され、間のテキストも保持される
  it("複数のURLをそれぞれ{url}要素として分割する", () => {
    const text = "見て https://a.example/x と https://b.example/y";
    expect(linkifyParts(text)).toEqual([
      "見て ",
      { url: "https://a.example/x" },
      " と ",
      { url: "https://b.example/y" },
    ]);
  });

  // URLの前後にあるテキストが欠落・重複せず残ることを検証する
  it("URL前後のテキストを欠落なく保持する", () => {
    const text = "前置き https://example.com/path 後書き";
    expect(linkifyParts(text)).toEqual([
      "前置き ",
      { url: "https://example.com/path" },
      " 後書き",
    ]);
  });
});
