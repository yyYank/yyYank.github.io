import { describe, expect, it } from "vitest";
import { syncBookmarks } from "../bookmarkSync";
import type { Item, Topic } from "../types";

// 実装(monthKey)と同じロジックでローカルタイムの月キーを求める。
// TZ差によるテストの環境依存を避けるため、期待値を固定文字列にせずここで算出する。
function monthKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthFolderIdOf(ts: number): string {
  return `bm-month:${monthKeyOf(ts)}`;
}

describe("syncBookmarks", () => {
  it("空状態からbookmarksフォルダ・月フォルダ・サブフォルダ・断片を新規生成する", () => {
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
    ];
    const res = syncBookmarks([], [], favorites, 1000);
    const monthId = monthFolderIdOf(1000);

    expect(res.added).toBe(true);
    expect(res.topics).toEqual([
      { id: "bookmarks", title: "bookmarks", parentId: null, createdAt: 1000 },
      { id: monthId, title: monthKeyOf(1000), parentId: "bookmarks", createdAt: 1000 },
      { id: "bm:https://example.com/a", title: "記事A", parentId: monthId, createdAt: 1000 },
    ]);
    expect(res.items).toEqual([
      {
        id: "bmcard:https://example.com/a",
        kind: "card",
        text: "記事A\nhttps://example.com/a\nはてブ IT",
        createdAt: 1000,
        topicId: "bm:https://example.com/a",
      },
    ]);
  });

  it("再実行しても既存データを変化させない(冪等)", () => {
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
    ];
    const first = syncBookmarks([], [], favorites, 1000);
    const second = syncBookmarks(first.topics, first.items, favorites, 2000);

    expect(second.added).toBe(false);
    expect(second.topics).toEqual(first.topics);
    expect(second.items).toEqual(first.items);
  });

  it("ユーザーによるフォルダ名変更・移動を上書きしない", () => {
    const favorites = [
      { title: "元タイトル", link: "https://example.com/a", source: "hatena" as const },
    ];
    const base = syncBookmarks([], [], favorites, 1000);
    // ユーザーがサブフォルダ名を変更し、別フォルダへ移動したと仮定する
    const renamedTopics: Topic[] = base.topics.map((t) =>
      t.id === "bm:https://example.com/a" ? { ...t, title: "自分で付けた名前", parentId: null } : t,
    );

    const res = syncBookmarks(renamedTopics, base.items, favorites, 3000);

    expect(res.added).toBe(false);
    const sub = res.topics.find((t) => t.id === "bm:https://example.com/a");
    expect(sub?.title).toBe("自分で付けた名前");
    expect(sub?.parentId).toBe(null);
  });

  it("一部のフォルダ/断片だけ欠けている場合はその分だけ補完する", () => {
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
      { title: "記事B", link: "https://example.com/b", source: "github" as const },
    ];
    // 記事Aのみ既存(親フォルダ・サブフォルダ・断片あり)、記事Bは未同期
    const existing = syncBookmarks([], [], [favorites[0]], 1000);

    const res = syncBookmarks(existing.topics, existing.items, favorites, 5000);

    expect(res.added).toBe(true);
    // 記事Aは変更されないこと
    expect(res.topics.find((t) => t.id === "bm:https://example.com/a")).toEqual(
      existing.topics.find((t) => t.id === "bm:https://example.com/a"),
    );
    // 記事Bが補完されること
    expect(res.topics.some((t) => t.id === "bm:https://example.com/b")).toBe(true);
    expect(res.items.some((i) => i.id === "bmcard:https://example.com/b")).toBe(true);
    // 親フォルダは1つのままであること
    expect(res.topics.filter((t) => t.id === "bookmarks")).toHaveLength(1);
    // 記事A・Bとも同じ月に作られたので、月フォルダも1つのまま(重複生成なし)であること
    expect(res.topics.filter((t) => t.id === monthFolderIdOf(1000))).toHaveLength(1);
  });

  it("追加するものが何もなければaddedはfalseで入力をそのまま返す", () => {
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
    ];
    const base = syncBookmarks([], [], favorites, 1000);

    const res = syncBookmarks(base.topics, base.items, favorites, 9999);

    expect(res.added).toBe(false);
    expect(res.topics).toBe(base.topics);
    expect(res.items).toBe(base.items);
  });

  it("お気に入りが無い場合は何も追加しない", () => {
    const topics: Topic[] = [];
    const items: Item[] = [];
    const res = syncBookmarks(topics, items, [], 1000);

    expect(res.added).toBe(false);
    expect(res.topics).toBe(topics);
    expect(res.items).toBe(items);
  });

  it("新規生成時、favorite.dateが有効ならDate.parseした値をcreatedAtに使う(サブフォルダ・断片とも)", () => {
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const, date: "2024-01-15T09:30:00Z" },
    ];
    const res = syncBookmarks([], [], favorites, 9999999);

    const expected = Date.parse("2024-01-15T09:30:00Z");
    expect(res.topics.find((t) => t.id === "bm:https://example.com/a")?.createdAt).toBe(expected);
    expect(res.items.find((i) => i.id === "bmcard:https://example.com/a")?.createdAt).toBe(expected);
    // 月フォルダは記事日時(date)の月を基準にする。now(9999999)の月ではない
    expect(res.topics.find((t) => t.id === "bm:https://example.com/a")?.parentId).toBe(
      monthFolderIdOf(expected),
    );
  });

  it("新規生成時、favorite.dateが不正な文字列ならnowにフォールバックする", () => {
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const, date: "not-a-date" },
    ];
    const res = syncBookmarks([], [], favorites, 1234);

    expect(res.items.find((i) => i.id === "bmcard:https://example.com/a")?.createdAt).toBe(1234);
  });

  it("既存bmcard断片は、favorite.dateが有効でcreatedAtとずれている場合createdAtのみ補正しaddedはtrueになる", () => {
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
    ];
    const base = syncBookmarks([], [], favorites, 1000);

    const withDate = [{ ...favorites[0], date: "2024-01-15T09:30:00Z" }];
    const res = syncBookmarks(base.topics, base.items, withDate, 5000);

    const expected = Date.parse("2024-01-15T09:30:00Z");
    const before = base.items.find((i) => i.id === "bmcard:https://example.com/a")!;
    const after = res.items.find((i) => i.id === "bmcard:https://example.com/a")!;
    expect(res.added).toBe(true);
    expect(after.createdAt).toBe(expected);
    // createdAt以外のフィールドは不変であること
    expect(after).toEqual({ ...before, createdAt: expected });
    // 既存のitems配列オブジェクト自体は書き換えない(補正は新しい配列上で行う)
    expect(before.createdAt).toBe(1000);
  });

  it("既存bmcard断片は、favorite.dateが未指定/不正なら補正せずaddedはfalseのまま", () => {
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
    ];
    const base = syncBookmarks([], [], favorites, 1000);

    const invalidDate = [{ ...favorites[0], date: "not-a-date" }];
    const res = syncBookmarks(base.topics, base.items, invalidDate, 5000);

    expect(res.added).toBe(false);
    expect(res.items).toBe(base.items);
  });

  it("既存bmcard断片は、favorite.dateがcreatedAtと一致していれば補正せずaddedはfalseのまま", () => {
    const date = "2024-01-15T09:30:00Z";
    const favorites = [
      { title: "記事A", link: "https://example.com/a", source: "hatena" as const, date },
    ];
    const base = syncBookmarks([], [], favorites, 1000);

    const res = syncBookmarks(base.topics, base.items, favorites, 5000);

    expect(res.added).toBe(false);
    expect(res.items).toBe(base.items);
  });

  describe("月フォルダへの移行", () => {
    it("bookmarks直下のままの旧bm:フォルダを、対応するbmcard断片のcreatedAtから求めた月フォルダへ移す", () => {
      const favorites = [
        { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
      ];
      // 旧仕様(月フォルダなし)で作られたデータを模す
      const legacyCreatedAt = Date.parse("2023-05-10T00:00:00Z");
      const legacyTopics: Topic[] = [
        { id: "bookmarks", title: "bookmarks", parentId: null, createdAt: legacyCreatedAt },
        { id: "bm:https://example.com/a", title: "記事A", parentId: "bookmarks", createdAt: legacyCreatedAt },
      ];
      const legacyItems: Item[] = [
        {
          id: "bmcard:https://example.com/a",
          kind: "card",
          text: "記事A\nhttps://example.com/a\nはてブ IT",
          createdAt: legacyCreatedAt,
          topicId: "bm:https://example.com/a",
        },
      ];

      const res = syncBookmarks(legacyTopics, legacyItems, favorites, 9999999);

      const monthId = monthFolderIdOf(legacyCreatedAt);
      expect(res.added).toBe(true);
      const moved = res.topics.find((t) => t.id === "bm:https://example.com/a");
      expect(moved?.parentId).toBe(monthId);
      // 移行以外のフィールドは不変であること
      expect(moved?.title).toBe("記事A");
      expect(moved?.createdAt).toBe(legacyCreatedAt);
      expect(res.topics.some((t) => t.id === monthId)).toBe(true);
      // 月フォルダは重複生成されないこと
      expect(res.topics.filter((t) => t.id === monthId)).toHaveLength(1);
    });

    it("手動でbookmarks外へ移動されたフォルダは移行対象にしない", () => {
      const favorites = [
        { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
      ];
      const legacyCreatedAt = 1000;
      const legacyTopics: Topic[] = [
        { id: "bookmarks", title: "bookmarks", parentId: null, createdAt: legacyCreatedAt },
        // ユーザーが手動でbookmarks外(ルート)へ移動したと仮定する
        { id: "bm:https://example.com/a", title: "記事A", parentId: null, createdAt: legacyCreatedAt },
      ];
      const legacyItems: Item[] = [
        {
          id: "bmcard:https://example.com/a",
          kind: "card",
          text: "記事A\nhttps://example.com/a\nはてブ IT",
          createdAt: legacyCreatedAt,
          topicId: "bm:https://example.com/a",
        },
      ];

      const res = syncBookmarks(legacyTopics, legacyItems, favorites, 9999);

      const moved = res.topics.find((t) => t.id === "bm:https://example.com/a");
      expect(moved?.parentId).toBe(null);
    });

    it("既に月フォルダ配下のものは移行対象にしない(重複生成なし)", () => {
      const favorites = [
        { title: "記事A", link: "https://example.com/a", source: "hatena" as const },
      ];
      const createdAt = 1000;
      const monthId = monthFolderIdOf(createdAt);
      const topics: Topic[] = [
        { id: "bookmarks", title: "bookmarks", parentId: null, createdAt },
        { id: monthId, title: monthKeyOf(createdAt), parentId: "bookmarks", createdAt },
        { id: "bm:https://example.com/a", title: "記事A", parentId: monthId, createdAt },
      ];
      const items: Item[] = [
        {
          id: "bmcard:https://example.com/a",
          kind: "card",
          text: "記事A\nhttps://example.com/a\nはてブ IT",
          createdAt,
          topicId: "bm:https://example.com/a",
        },
      ];

      const res = syncBookmarks(topics, items, favorites, 9999);

      expect(res.added).toBe(false);
      expect(res.topics).toBe(topics);
    });

    it("対応するbmcard断片が無い場合は移行しない", () => {
      const favorites = [
        { title: "記事B", link: "https://example.com/b", source: "hatena" as const },
      ];
      const legacyCreatedAt = 1000;
      const legacyTopics: Topic[] = [
        { id: "bookmarks", title: "bookmarks", parentId: null, createdAt: legacyCreatedAt },
        // 断片が無い(削除済み等)旧bm:フォルダ
        { id: "bm:https://example.com/a", title: "記事A", parentId: "bookmarks", createdAt: legacyCreatedAt },
      ];
      const legacyItems: Item[] = [];

      const res = syncBookmarks(legacyTopics, legacyItems, favorites, 9999);

      const untouched = res.topics.find((t) => t.id === "bm:https://example.com/a");
      expect(untouched?.parentId).toBe("bookmarks");
    });
  });
});
