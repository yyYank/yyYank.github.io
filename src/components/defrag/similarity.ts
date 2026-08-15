/* 文字 n-gram (n=1,2,3) を出現回数つきで数える。日本語は漢字1文字が意味を持つので
   ユニグラムを落とさない。記号と空白だけ除く。 */
export function grams(text: string) {
  const s = (text || "").replace(/[\s　、。,.!?！？「」『』()（）ー\-~〜:：;；…・"'`]/g, "");
  const m = new Map<string, number>();
  const bump = (g: string) => m.set(g, (m.get(g) || 0) + 1);
  for (let i = 0; i < s.length; i++) {
    bump(s[i]);
    if (i + 2 <= s.length) bump(s.slice(i, i + 2));
    if (i + 3 <= s.length) bump(s.slice(i, i + 3));
  }
  return m;
}

/* ありふれた並びを軽くするための IDF。全断片から作り直す。 */
export function buildIdf(texts: string[]) {
  const df = new Map<string, number>();
  texts.forEach((t) => {
    new Set(grams(t).keys()).forEach((g) => df.set(g, (df.get(g) || 0) + 1));
  });
  const n = Math.max(1, texts.length);
  const idf = new Map<string, number>();
  df.forEach((c, g) => idf.set(g, Math.log((n + 1) / (c + 0.5))));
  return idf;
}

/* tf-idf ベクトルにして正規化。長さの違う断片を素直に比べられるようにする。 */
export function vectorize(text: string, idf: Map<string, number> | null) {
  const g = grams(text);
  const v = new Map<string, number>();
  let norm = 0;
  g.forEach((tf, key) => {
    const w = (1 + Math.log(tf)) * (idf ? idf.get(key) || Math.log(2) : 1);
    if (w <= 0) return;
    v.set(key, w);
    norm += w * w;
  });
  norm = Math.sqrt(norm) || 1;
  v.forEach((w, key) => v.set(key, w / norm));
  return v;
}

export function cosine(a: Map<string, number>, b: Map<string, number>) {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  small.forEach((w, key) => {
    const o = large.get(key);
    if (o) dot += w * o;
  });
  return dot;
}

/* 単発で比べたいとき用。idf なしのコサイン。 */
export function similarity(a: string, b: string) {
  return cosine(vectorize(a, null), vectorize(b, null));
}
