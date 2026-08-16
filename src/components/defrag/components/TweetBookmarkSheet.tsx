import { useState } from "react";
import { Sheet } from "./Sheet";
import { fetchTweet, isTweetUrl, type TweetData } from "../tweetBookmark";

export function TweetBookmarkSheet({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (tweet: TweetData, url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [tweet, setTweet] = useState<TweetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = async () => {
    const v = url.trim();
    if (!isTweetUrl(v)) {
      setError("x.com / twitter.com のツイートURLを入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    setTweet(null);
    try {
      const t = await fetchTweet(v);
      setTweet(t);
    } catch (e) {
      setError("取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet title="ツイートを保存" onClose={onClose}>
      <div className="dfg-sbody">
        <input className="dfg-titleinput" value={url} placeholder="https://x.com/.../status/..."
          onChange={(e) => { setUrl(e.target.value); setTweet(null); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) fetchPreview(); }} />
        {error && <div className="dfg-tweeterr">{error}</div>}
        {tweet && (
          <div className="dfg-tweetpreview">
            <div className="dfg-tweettext">{tweet.text}</div>
            <div className="dfg-tweetauthor">X(@{tweet.author})</div>
          </div>
        )}
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        {tweet ? (
          <button className="dfg-btn" data-key="1" onClick={() => onAdd(tweet, url.trim())}>追加</button>
        ) : (
          <button className="dfg-btn" data-key="1" onClick={fetchPreview} disabled={!url.trim() || loading}>
            {loading ? "取得中…" : "取得"}
          </button>
        )}
      </div>
    </Sheet>
  );
}
