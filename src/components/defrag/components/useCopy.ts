import { useRef, useState } from "react";

/* コピー成功の表示と、失敗時のフォールバック選択のためにrefを返す */
export function useCopy(text: string) {
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { if (ref.current) ref.current.select(); }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return { done, copy, ref };
}
