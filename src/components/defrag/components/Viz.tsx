import { useMemo, useState } from "react";
import { buildIdf, cosine, vectorize } from "../similarity";
import { ROOT, eachFragment, pathLabel, subtreeItems } from "../tree";
import { ageColor, DAY } from "../format";
import type { Frag, Item, Topic } from "../types";

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

interface VizProps {
  topics: Topic[]; items: Item[]; rootId: string;
  onOpen: (id: string) => void; onOpenDrawer: () => void;
}

export function Viz({ topics, items, rootId, onOpen, onOpenDrawer }: VizProps) {
  const [mode, setMode] = useState<"activity" | "clock" | "graph">("activity");
  const [scoped, setScoped] = useState(false);

  const source = useMemo(
    () => (scoped ? subtreeItems(topics, items, rootId) : items),
    [scoped, topics, items, rootId]
  );
  const frags = useMemo(() => eachFragment(source), [source]);

  return (
    <div className="dfg-viz">
      <div className="dfg-wallbar">
        <button className="dfg-into" style={{ flex: 1 }} onClick={onOpenDrawer}>
          {scoped ? pathLabel(topics, rootId === ROOT ? null : rootId) : "すべて"}
        </button>
        <button className="dfg-btn" data-quiet="1" style={{ color: scoped ? "var(--lamp)" : undefined }}
          onClick={() => setScoped((v) => !v)}>絞る</button>
      </div>

      <div className="dfg-vizmodes">
        <button className="dfg-chip" data-on={mode === "activity" ? "1" : "0"} onClick={() => setMode("activity")}>投稿数</button>
        <button className="dfg-chip" data-on={mode === "clock" ? "1" : "0"} onClick={() => setMode("clock")}>時刻</button>
        <button className="dfg-chip" data-on={mode === "graph" ? "1" : "0"} onClick={() => setMode("graph")}>類似</button>
      </div>

      <div className="dfg-vizbody">
        {frags.length === 0 ? (
          <div className="dfg-empty">まだ描けるものがない。</div>
        ) : mode === "activity" ? (
          <Activity frags={frags} />
        ) : mode === "clock" ? (
          <Clock frags={frags} />
        ) : (
          <Graph frags={frags} onOpen={onOpen} />
        )}
      </div>
    </div>
  );
}


/* 日ごとの投稿数 */
function Activity({ frags }: { frags: Frag[] }) {
  const { days, max } = useMemo(() => {
    const m = new Map<number, number>();
    let min = Infinity;
    frags.forEach((f) => {
      const d = new Date(f.createdAt);
      const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      m.set(k, (m.get(k) || 0) + 1);
      if (k < min) min = k;
    });
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const out: { t: number; n: number }[] = [];
    let mx = 1;
    for (let t = min; t <= end; t += DAY) {
      const n = m.get(t) || 0;
      if (n > mx) mx = n;
      out.push({ t, n });
    }
    return { days: out, max: mx };
  }, [frags]);

  const bw = 11;
  const gap = 3;
  const h = 190;
  const width = Math.max(days.length * (bw + gap), 260);

  return (
    <div className="dfg-scrollx">
      <svg width={width} height={h + 34} role="img">
        {days.map((d, i) => {
          const bh = d.n === 0 ? 2 : Math.max(3, (d.n / max) * h);
          const x = i * (bw + gap);
          const dt = new Date(d.t);
          const first = dt.getDate() === 1;
          return (
            <g key={d.t}>
              <rect x={x} y={h - bh} width={bw} height={bh} rx={2}
                fill={d.n === 0 ? "#232733" : ageColor(d.t)} opacity={d.n === 0 ? 0.5 : 1} />
              {first && (
                <>
                  <line x1={x - 1.5} y1={0} x2={x - 1.5} y2={h} stroke="#2C313D" strokeWidth="1" />
                  <text x={x} y={h + 20} fill="#6B7284" fontSize="10" fontFamily="ui-monospace, monospace">
                    {dt.getMonth() + 1}月
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="dfg-vizfoot dfg-mono">
        {frags.length}件 / {days.length}日 / 最多 {max}件
      </div>
    </div>
  );
}

/* 曜日 × 時間帯 */
function Clock({ frags }: { frags: Frag[] }) {
  const { grid, max } = useMemo(() => {
    const g = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let mx = 0;
    frags.forEach((f) => {
      const d = new Date(f.createdAt);
      g[d.getDay()][d.getHours()]++;
      if (g[d.getDay()][d.getHours()] > mx) mx = g[d.getDay()][d.getHours()];
    });
    return { grid: g, max: mx || 1 };
  }, [frags]);

  const cell = 13;
  const gap = 2;
  const left = 22;
  const top = 16;

  return (
    <div className="dfg-scrollx">
      <svg width={left + 24 * (cell + gap)} height={top + 7 * (cell + gap) + 8}>
        {[0, 6, 12, 18, 23].map((hh) => (
          <text key={hh} x={left + hh * (cell + gap)} y={10} fill="#6B7284" fontSize="9"
            fontFamily="ui-monospace, monospace">{hh}</text>
        ))}
        {grid.map((row, wd) => (
          <g key={wd}>
            <text x={0} y={top + wd * (cell + gap) + cell - 2} fill="#6B7284" fontSize="10">{WEEK[wd]}</text>
            {row.map((n, hh) => (
              <rect key={hh} x={left + hh * (cell + gap)} y={top + wd * (cell + gap)}
                width={cell} height={cell} rx={2.5}
                fill={n === 0 ? "#1A1D26" : "#E8A13A"} opacity={n === 0 ? 1 : 0.25 + (n / max) * 0.75} />
            ))}
          </g>
        ))}
      </svg>
      <div className="dfg-vizfoot dfg-mono">最も濃い枠で {max}件</div>
    </div>
  );
}

/* 断片どうしの近さ。線を引くだけで、まとめはしない。 */
function Graph({ frags, onOpen }: { frags: Frag[]; onOpen: (id: string) => void }) {
  const [level, setLevel] = useState(0.09);
  const list = useMemo(() => frags.slice(0, 140), [frags]);

  const vecs = useMemo(() => {
    const idf = buildIdf(list.map((f) => f.text));
    return list.map((f) => vectorize(f.text, idf));
  }, [list]);

  const edges = useMemo(() => {
    const out: { a: number; b: number; v: number }[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const v = cosine(vecs[i], vecs[j]);
        if (v >= level) out.push({ a: i, b: j, v });
      }
    }
    return out;
  }, [vecs, level]);

  const W = 340;
  const H = 340;

  const nodes = useMemo(() => {
    const n = list.map((f, i) => {
      const ang = (i / Math.max(1, list.length)) * Math.PI * 2;
      return { x: W / 2 + Math.cos(ang) * 120, y: H / 2 + Math.sin(ang) * 120, vx: 0, vy: 0 };
    });
    for (let step = 0; step < 220; step++) {
      for (let i = 0; i < n.length; i++) {
        for (let j = i + 1; j < n.length; j++) {
          let dx = n[j].x - n[i].x;
          let dy = n[j].y - n[i].y;
          let d2 = dx * dx + dy * dy || 0.01;
          const rep = 420 / d2;
          const d = Math.sqrt(d2);
          const ux = dx / d;
          const uy = dy / d;
          n[i].vx -= ux * rep; n[i].vy -= uy * rep;
          n[j].vx += ux * rep; n[j].vy += uy * rep;
        }
      }
      edges.forEach((e) => {
        const a = n[e.a];
        const b = n[e.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 46) * 0.012 * (0.4 + e.v);
        const ux = dx / d;
        const uy = dy / d;
        a.vx += ux * f; a.vy += uy * f;
        b.vx -= ux * f; b.vy -= uy * f;
      });
      n.forEach((p) => {
        p.vx += (W / 2 - p.x) * 0.0016;
        p.vy += (H / 2 - p.y) * 0.0016;
        p.x += Math.max(-6, Math.min(6, p.vx));
        p.y += Math.max(-6, Math.min(6, p.vy));
        p.vx *= 0.82;
        p.vy *= 0.82;
        p.x = Math.max(14, Math.min(W - 14, p.x));
        p.y = Math.max(14, Math.min(H - 14, p.y));
      });
    }
    return n;
  }, [list, edges]);

  const linked = useMemo(() => {
    const set = new Set();
    edges.forEach((e) => { set.add(e.a); set.add(e.b); });
    return set;
  }, [edges]);

  return (
    <>
      <div className="dfg-vizmodes" style={{ marginTop: 0 }}>
        <button className="dfg-chip" data-on={level === 0.05 ? "1" : "0"} onClick={() => setLevel(0.05)}>ゆるく</button>
        <button className="dfg-chip" data-on={level === 0.09 ? "1" : "0"} onClick={() => setLevel(0.09)}>ふつう</button>
        <button className="dfg-chip" data-on={level === 0.16 ? "1" : "0"} onClick={() => setLevel(0.16)}>きつく</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: "62vh" }}>
        {edges.map((e, i) => (
          <line key={i} x1={nodes[e.a].x} y1={nodes[e.a].y} x2={nodes[e.b].x} y2={nodes[e.b].y}
            stroke="#4E647A" strokeWidth={0.6 + e.v * 3} opacity={0.3 + e.v} />
        ))}
        {nodes.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={linked.has(i) ? 5.5 : 3.4}
            fill={ageColor(list[i].createdAt)} opacity={linked.has(i) ? 1 : 0.45}
            onClick={() => onOpen(list[i].ownerId)} style={{ cursor: "pointer" }} />
        ))}
      </svg>
      <div className="dfg-vizfoot dfg-mono">{list.length}件 / {edges.length}本の線</div>
    </>
  );
}
