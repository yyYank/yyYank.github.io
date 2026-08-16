import { useState } from "react";
import { Sheet } from "./Sheet";
import { fetchTweet, isTweetUrl, type TweetData } from "../tweetBookmark";
import { fetchArticle, type ArticleData } from "../urlBookmark";

export type BookmarkResult =
  | { kind: "tweet"; data: TweetData }
  | { kind: "article"; data: ArticleData };

export function UrlBookmarkSheet({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (result: BookmarkResult, url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<BookmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = async () => {
    const v = url.trim();
    if (!v) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // ツイートURLはoEmbed経由、それ以外は汎用の記事フローで取得する
      if (isTweetUrl(v)) {
        const data = await fetchTweet(v);
        setResult({ kind: "tweet", data });
      } else {
        const data = await fetchArticle(v);
        setResult({ kind: "article", data });
      }
    } catch (e) {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet title="URLを保存" onClose={onClose}>
      <div className="dfg-sbody">
        <input className="dfg-titleinput" value={url} placeholder="https://... （X投稿 or 記事URL）"
          onChange={(e) => { setUrl(e.target.value); setResult(null); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) fetchPreview(); }} />
        {error && <div className="dfg-tweeterr">{error}</div>}
        {result && result.kind === "tweet" && (
          <div className="dfg-tweetpreview">
            <div className="dfg-tweettext">{result.data.text}</div>
            <div className="dfg-tweetauthor">X(@{result.data.author})</div>
          </div>
        )}
        {result && result.kind === "article" && (
          <div className="dfg-tweetpreview">
            <div className="dfg-tweettext">{result.data.title}</div>
            <div className="dfg-tweetauthor">{result.data.site}</div>
          </div>
        )}
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        {result ? (
          <button className="dfg-btn" data-key="1" onClick={() => onAdd(result, url.trim())}>追加</button>
        ) : (
          <button className="dfg-btn" data-key="1" onClick={fetchPreview} disabled={!url.trim() || loading}>
            {loading ? "取得中…" : "取得"}
          </button>
        )}
      </div>
    </Sheet>
  );
}
