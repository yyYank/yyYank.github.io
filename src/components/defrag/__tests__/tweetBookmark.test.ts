import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTweetBookmark, fetchTweet, isTweetUrl } from "../tweetBookmark";

// bookmarkSync.tsのmonthKeyと同じロジックでローカルタイムの月キーを求める(TZ差による環境依存を避けるため)
function monthKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthFolderIdOf(ts: number): string {
  return `bm-month:${monthKeyOf(ts)}`;
}

describe("isTweetUrl", () => {
  it("x.com/twitter.comの/status/URLを真と判定する", () => {
    expect(isTweetUrl("https://x.com/foo/status/12345")).toBe(true);
    expect(isTweetUrl("https://twitter.com/foo/status/12345")).toBe(true);
    expect(isTweetUrl("https://www.x.com/foo/status/12345")).toBe(true);
  });

  it("対象外URLを偽と判定する", () => {
    expect(isTweetUrl("https://x.com/foo")).toBe(false);
    expect(isTweetUrl("https://example.com/status/1")).toBe(false);
    expect(isTweetUrl("not a url")).toBe(false);
  });
});

describe("fetchTweet", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // oEmbedのhtmlは blockquote 本文 + 末尾aタグの日付、というX公式の構造を想定する
  const oembedHtml =
    '<blockquote class="twitter-tweet"><p>本文です</p>&mdash; 名前 (@handle) <a href="https://x.com/foo/status/12345">August 16, 2026</a></blockquote>';

  it("blockquoteから本文・著者・日時を抽出する", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ html: oembedHtml, author_name: "名前" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const tweet = await fetchTweet("https://x.com/foo/status/12345");

    expect(tweet.text).toContain("本文です");
    expect(tweet.author).toBe("名前");
    expect(tweet.createdAt).toBe(Date.parse("August 16, 2026"));
    // 最初のプロキシ(corsproxy.io)が呼ばれること
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("corsproxy.io");
  });

  it("日時パースに失敗した場合はnullにする", async () => {
    const html = '<blockquote><p>本文</p><a href="#">不明な日付</a></blockquote>';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ html, author_name: "名前" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const tweet = await fetchTweet("https://x.com/foo/status/12345");
    expect(tweet.createdAt).toBeNull();
  });

  it("1つ目のプロキシが失敗したら2つ目(allorigins)へフォールバックする", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ html: oembedHtml, author_name: "名前" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const tweet = await fetchTweet("https://x.com/foo/status/12345");

    expect(tweet.text).toContain("本文です");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("allorigins.win");
  });

  it("両方のプロキシが失敗したら例外を投げる", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTweet("https://x.com/foo/status/12345")).rejects.toThrow();
  });
});

describe("buildTweetBookmark", () => {
  it("フォルダと断片をbookmarkSyncと同じid規則・月フォルダ配下で組み立てる", () => {
    const tweet = { text: "本文です", author: "handle", createdAt: 1000 };
    const url = "https://x.com/foo/status/12345";

    const { topic, card, monthTopic } = buildTweetBookmark(tweet, url, 9999);
    const monthId = monthFolderIdOf(1000);

    expect(monthTopic).toEqual({
      id: monthId,
      title: monthKeyOf(1000),
      parentId: "bookmarks",
      createdAt: 9999,
    });
    expect(topic).toEqual({
      id: `bm:${url}`,
      title: "本文です",
      parentId: monthId,
      createdAt: 1000,
    });
    expect(card).toEqual({
      id: `bmcard:${url}`,
      kind: "card",
      text: `本文です\n${url}\nX(@handle)`,
      createdAt: 1000,
      topicId: `bm:${url}`,
    });
  });

  it("本文が空ならタイトルにauthorを使う", () => {
    const tweet = { text: "", author: "handle", createdAt: null };
    const url = "https://x.com/foo/status/1";

    const { topic, card, monthTopic } = buildTweetBookmark(tweet, url, 5000);

    expect(topic.title).toBe("handle");
    // ツイート日時が不明な場合はnowにフォールバックする(月フォルダもnow基準になる)
    expect(topic.createdAt).toBe(5000);
    expect(card.createdAt).toBe(5000);
    expect(monthTopic.id).toBe(monthFolderIdOf(5000));
  });

  it("本文が40文字を超える場合は先頭40文字程度に切り詰める", () => {
    const longText = "あ".repeat(80);
    const tweet = { text: longText, author: "handle", createdAt: 1000 };
    const url = "https://x.com/foo/status/2";

    const { topic } = buildTweetBookmark(tweet, url, 9999);

    expect(topic.title.length).toBeLessThanOrEqual(40);
    expect(topic.title).toBe(longText.slice(0, 40));
  });
});
