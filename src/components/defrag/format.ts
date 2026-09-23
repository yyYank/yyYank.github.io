export const DAY = 86400000;
const daysAgo = (ts: number) => (Date.now() - ts) / DAY;

/* 琥珀(新しい)→青(古い)。経過時間は文字でなく色で伝える */
export const AGE_STOPS: [number, number[]][] = [
  [0, [232, 161, 58]],
  [3, [201, 138, 70]],
  [14, [122, 124, 130]],
  [45, [78, 100, 122]],
  [120, [56, 74, 94]],
];

export function ageColor(ts: number) {
  const d = daysAgo(ts);
  const last = AGE_STOPS[AGE_STOPS.length - 1];
  if (d >= last[0]) return `rgb(${last[1].join(",")})`;
  let a = AGE_STOPS[0];
  let b = last;
  for (let i = 0; i < AGE_STOPS.length - 1; i++) {
    if (d >= AGE_STOPS[i][0] && d <= AGE_STOPS[i + 1][0]) { a = AGE_STOPS[i]; b = AGE_STOPS[i + 1]; break; }
  }
  const span = b[0] - a[0];
  const t = span === 0 ? 0 : (d - a[0]) / span;
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * Math.min(Math.max(t, 0), 1)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/* 見るたびに変わらない表示にする */
export function absDate(ts: number, withTime: boolean) {
  const d = new Date(ts);
  const y = d.getFullYear() === new Date().getFullYear() ? "" : `${d.getFullYear()}/`;
  const day = `${y}${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  return withTime ? `${day} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : day;
}
export const shortDate = (ts: number) => absDate(ts, false);

/* 明るい紙色に墨字。暗い盤面に貼る前提 */
export const NOTE_COLORS = [
  { id: "plain",  bg: "var(--note-plain)",  edge: "var(--note-plain-edge)" },
  { id: "amber",  bg: "var(--note-amber)",  edge: "var(--note-amber-edge)" },
  { id: "rose",   bg: "var(--note-rose)",   edge: "var(--note-rose-edge)" },
  { id: "teal",   bg: "var(--note-teal)",   edge: "var(--note-teal-edge)" },
  { id: "indigo", bg: "var(--note-indigo)", edge: "var(--note-indigo-edge)" },
  { id: "olive",  bg: "var(--note-olive)",  edge: "var(--note-olive-edge)" },
];
export const colorOf = (id?: string) => NOTE_COLORS.find((c) => c.id === id) || NOTE_COLORS[0];
