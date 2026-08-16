import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUrlBookmark, fetchArticle } from "../urlBookmark";

// bookmarkSync.tsのmonthKeyと同じロジックでローカルタイムの月キーを求める(TZ差による環境依存を避けるため)
function monthKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthFolderIdOf(ts: number): string {
  return `bm-month:${monthKeyOf(ts)}`;
}

function htmlResponse(html: string) {
  return { ok: true, text: async () => html };
}

describe("fetchArticle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("og:title / og:site_name / article:published_time が全て存在する場合に正しく抽出できる", async () => {
    const html = `<html><head>
      <meta property="og:title" content="OGタイトル" />
      <meta property="og:site_name" content="サイト名" />
      <meta property="article:published_time" content="2026-08-16T00:00:00Z" />
      <title>titleタグ</title>
    </head></html>`;
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(html));
    vi.stubGlobal("fetch", fetchMock);

    const article = await fetchArticle("https://example.com/foo");

    expect(article.title).toBe("OGタイトル");
    expect(article.site).toBe("サイト名");
    expect(article.createdAt).toBe(Date.parse("2026-08-16T00:00:00Z"));
    // 最初のプロキシ(corsproxy.io)が呼ばれること
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("corsproxy.io");
  });

  it("og:titleが無い場合は<title>要素へフォールバックする", async () => {
    const html = `<html><head><title>titleタグ</title></head></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));

    const article = await fetchArticle("https://example.com/foo");
    expect(article.title).toBe("titleタグ");
  });

  it("og:site_nameが無い場合はhostname(www除去)へフォールバックする", async () => {
    const html = `<html><head><title>t</title></head></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));

    const article = await fetchArticle("https://www.example.com/foo");
    expect(article.site).toBe("example.com");
  });

  it("article:published_timeが無い場合はtime[datetime]へフォールバックする", async () => {
    const html = `<html><body><time datetime="2026-01-02T00:00:00Z">1月2日</time></body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));

    const article = await fetchArticle("https://example.com/foo");
    expect(article.createdAt).toBe(Date.parse("2026-01-02T00:00:00Z"));
  });

  it("日時系タグが両方とも無い場合createdAtがnullになる", async () => {
    const html = `<html><head><title>t</title></head></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));

    const article = await fetchArticle("https://example.com/foo");
    expect(article.createdAt).toBeNull();
  });

  it("title/site/日時いずれのタグも無いhtmlの場合、title=urlにフォールバックする", async () => {
    const html = `<html><body>本文だけ</body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));

    const url = "https://example.com/foo";
    const article = await fetchArticle(url);
    expect(article.title).toBe(url);
    expect(article.site).toBe("example.com");
    expect(article.createdAt).toBeNull();
  });

  it("両方のプロキシが失敗したら例外を投げる", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchArticle("https://example.com/foo")).rejects.toThrow();
  });
});

describe("buildUrlBookmark", () => {
  it("フォルダと断片をbookmarkSyncと同じid規則・月フォルダ配下で組み立てる", () => {
    const article = { title: "記事タイトル", site: "サイト名", createdAt: 1000 };
    const url = "https://example.com/foo";

    const { topic, card, monthTopic } = buildUrlBookmark(article, url, 9999);
    const monthId = monthFolderIdOf(1000);

    expect(monthTopic).toEqual({
      id: monthId,
      title: monthKeyOf(1000),
      parentId: "bookmarks",
      createdAt: 9999,
    });
    expect(topic).toEqual({
      id: `bm:${url}`,
      title: "記事タイトル",
      parentId: monthId,
      createdAt: 1000,
    });
    expect(card).toEqual({
      id: `bmcard:${url}`,
      kind: "card",
      text: `記事タイトル\n${url}\nサイト名`,
      createdAt: 1000,
      topicId: `bm:${url}`,
    });
  });

  it("タイトルが空ならurlをタイトルに使う", () => {
    const article = { title: "", site: "サイト名", createdAt: null };
    const url = "https://example.com/bar";

    const { topic, card, monthTopic } = buildUrlBookmark(article, url, 5000);

    expect(topic.title).toBe(url);
    // 公開日時が不明な場合はnowにフォールバックする(月フォルダもnow基準になる)
    expect(topic.createdAt).toBe(5000);
    expect(card.createdAt).toBe(5000);
    expect(monthTopic.id).toBe(monthFolderIdOf(5000));
  });

  it("タイトルが40文字を超える場合は先頭40文字程度に切り詰める", () => {
    const longText = "あ".repeat(80);
    const article = { title: longText, site: "サイト名", createdAt: 1000 };
    const url = "https://example.com/baz";

    const { topic } = buildUrlBookmark(article, url, 9999);

    expect(topic.title.length).toBeLessThanOrEqual(40);
    expect(topic.title).toBe(longText.slice(0, 40));
  });
});
