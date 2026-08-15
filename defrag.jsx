import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ------------------------------------------------------------------ */
/* storage                                                             */
/* ------------------------------------------------------------------ */

const KEY = "defrag:v6";

async function loadAll() {
  try {
    const res = await window.storage.get(KEY);
    return res ? JSON.parse(res.value) : null;
  } catch (e) {
    return null;
  }
}
async function saveAll(data) {
  try {
    await window.storage.set(KEY, JSON.stringify(data));
  } catch (e) {}
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const ROOT = "__root__";
const DAY = 86400000;
const daysAgo = (ts) => (Date.now() - ts) / DAY;

const AGE_STOPS = [
  [0, [232, 161, 58]],
  [3, [201, 138, 70]],
  [14, [122, 124, 130]],
  [45, [78, 100, 122]],
  [120, [56, 74, 94]],
];

function ageColor(ts) {
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

const pad2 = (n) => String(n).padStart(2, "0");

/* 見るたびに変わらない表示にする */
function absDate(ts, withTime) {
  const d = new Date(ts);
  const y = d.getFullYear() === new Date().getFullYear() ? "" : `${d.getFullYear()}/`;
  const day = `${y}${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  return withTime ? `${day} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : day;
}
const shortDate = (ts) => absDate(ts, false);

/* 文字 n-gram (n=1,2,3) を出現回数つきで数える。日本語は漢字1文字が意味を持つので
   ユニグラムを落とさない。記号と空白だけ除く。 */
function grams(text) {
  const s = (text || "").replace(/[\s\u3000、。,.!?！？「」『』()（）ー\-~〜:：;；…・"'`]/g, "");
  const m = new Map();
  const bump = (g) => m.set(g, (m.get(g) || 0) + 1);
  for (let i = 0; i < s.length; i++) {
    bump(s[i]);
    if (i + 2 <= s.length) bump(s.slice(i, i + 2));
    if (i + 3 <= s.length) bump(s.slice(i, i + 3));
  }
  return m;
}

/* ありふれた並びを軽くするための IDF。全断片から作り直す。 */
function buildIdf(texts) {
  const df = new Map();
  texts.forEach((t) => {
    new Set(grams(t).keys()).forEach((g) => df.set(g, (df.get(g) || 0) + 1));
  });
  const n = Math.max(1, texts.length);
  const idf = new Map();
  df.forEach((c, g) => idf.set(g, Math.log((n + 1) / (c + 0.5))));
  return idf;
}

/* tf-idf ベクトルにして正規化。長さの違う断片を素直に比べられるようにする。 */
function vectorize(text, idf) {
  const g = grams(text);
  const v = new Map();
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

function cosine(a, b) {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  small.forEach((w, key) => {
    const o = large.get(key);
    if (o) dot += w * o;
  });
  return dot;
}

/* 単発で比べたいとき用。idf なしのコサイン。 */
function similarity(a, b) {
  return cosine(vectorize(a, null), vectorize(b, null));
}

const flattenTexts = (i) => (i.kind === "bundle" ? i.children.map((c) => c.text) : [i.text]);
const itemStamp = (i) => (i.kind === "bundle" ? i.children[0].createdAt : i.createdAt);
const itemLabel = (i) => (i.kind === "bundle" ? i.title || "名前のない束" : i.text);
const childrenOf = (topics, parentId) => topics.filter((t) => (t.parentId || null) === parentId);

function descendantIds(topics, id, acc = []) {
  childrenOf(topics, id).forEach((t) => { acc.push(t.id); descendantIds(topics, t.id, acc); });
  return acc;
}
function pathOf(topics, id) {
  const out = [];
  let cur = topics.find((t) => t.id === id);
  while (cur) { out.unshift(cur); cur = cur.parentId ? topics.find((t) => t.id === cur.parentId) : null; }
  return out;
}
const pathLabel = (topics, id) =>
  id && id !== ROOT ? "/ " + pathOf(topics, id).map((t) => t.title).join(" / ") : "/";

function flatTopics(topics, parentId = null, depth = 0, out = []) {
  childrenOf(topics, parentId).forEach((t) => {
    out.push({ topic: t, depth });
    flatTopics(topics, t.id, depth + 1, out);
  });
  return out;
}

/* explorer と同じ並び。フォルダが先、そのあと直下の断片。 */
function buildRows(topics, items, isOpen) {
  const out = [];
  const walk = (parentId, depth) => {
    childrenOf(topics, parentId).forEach((t) => {
      out.push({ type: "folder", id: t.id, topic: t, title: t.title, depth, parent: t.parentId || null });
      if (isOpen(t.id)) {
        walk(t.id, depth + 1);
        items.filter((i) => i.topicId === t.id).forEach((it) =>
          out.push({ type: "item", id: it.id, item: it, depth: depth + 1, parent: t.id })
        );
      }
    });
  };
  walk(null, 0);
  items.filter((i) => !i.topicId).forEach((it) =>
    out.push({ type: "item", id: it.id, item: it, depth: 0, parent: null })
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.dfg{
  --ground:#0F1117; --panel:#191C25; --raised:#232733; --line:#2C313D;
  --ink:#E4E2DC; --muted:#767C8C; --lamp:#E8A13A; --rail:#2A2F3B;
  position:fixed;inset:0;display:flex;flex-direction:column;
  background:var(--ground);color:var(--ink);
  font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;overflow:hidden;
}
.dfg-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}

.dfg-top{display:flex;align-items:center;gap:3px;padding:10px 14px 8px;flex:0 0 auto}
.dfg-burger{appearance:none;border:0;background:transparent;color:var(--muted);font-size:18px;
  width:40px;height:40px;margin-right:2px;border-radius:9px;cursor:pointer;flex:0 0 auto;font-family:inherit}
.dfg-burger:active{background:var(--panel);color:var(--ink)}
.dfg-drawer{position:absolute;inset:0;z-index:60;background:#131620;display:flex;flex-direction:column;
  animation:dfgslide .2s cubic-bezier(.2,.8,.3,1)}
@keyframes dfgslide{from{transform:translateX(-18px);opacity:.4}}
.dfg-dhead{display:flex;align-items:center;gap:8px;padding:12px 12px 10px;flex:0 0 auto;border-bottom:1px solid var(--line)}
.dfg-dhead h2{margin:0;flex:1;font-size:12px;font-weight:700;letter-spacing:.16em;color:var(--muted)}
.dfg-tab{appearance:none;border:0;background:transparent;color:var(--muted);font-size:14.5px;font-weight:600;
  letter-spacing:.04em;padding:9px 16px;border-radius:999px;font-family:inherit;cursor:pointer;transition:.15s}
.dfg-tab[data-on="1"]{color:var(--ink);background:var(--panel)}
.dfg-count{margin-left:auto;font-size:11px;color:var(--muted);letter-spacing:.08em;flex:0 0 auto}

/* ---- compose ---- */
.dfg-compose{flex:1;display:flex;flex-direction:column;padding:2px 18px 0;min-height:0;position:relative}
.dfg-into{appearance:none;border:0;background:transparent;font-family:inherit;text-align:left;padding:6px 0;
  font-size:12px;letter-spacing:.06em;color:var(--lamp);opacity:.9;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;cursor:pointer;flex:0 0 auto}
.dfg-ta{flex:1;width:100%;background:transparent;border:0;resize:none;outline:none;color:var(--ink);
  font-family:inherit;font-size:19px;line-height:1.75;padding:10px 0 0;caret-color:var(--lamp)}
.dfg-ta::placeholder{color:#454B5A}
.dfg-composebar{flex:0 0 auto;display:flex;align-items:flex-end;gap:14px;padding:12px 0 max(20px,env(safe-area-inset-bottom))}
.dfg-recent{flex:1;min-width:0;font-size:12px;line-height:1.5;color:#525869}
.dfg-recent span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfg-send{flex:0 0 auto;width:66px;height:66px;border-radius:50%;border:0;background:var(--lamp);color:#141621;
  font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:transform .12s;
  box-shadow:0 0 34px rgba(232,161,58,.22)}
.dfg-send:disabled{background:var(--raised);color:#4E5464;box-shadow:none}
.dfg-send:active:not(:disabled){transform:scale(.93)}
.dfg-flash{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);font-size:13px;color:var(--lamp);
  letter-spacing:.2em;pointer-events:none;animation:dfgflash .7s ease-out forwards}
@keyframes dfgflash{0%{opacity:0}25%{opacity:1}100%{opacity:0}}

/* ---- tree ---- */
.dfg-tree{flex:1;overflow-y:auto;padding:2px 12px 16px}
.dfg-tree[data-drag="1"]{overflow:hidden;touch-action:none}
.dfg-rootrow{display:flex;align-items:center;gap:9px;min-height:42px;padding:0 12px;margin-bottom:7px;
  border-radius:8px;border:1px dashed var(--line);color:var(--muted);font-size:13px;cursor:pointer}
.dfg-rootrow[data-on="1"]{border-style:solid;border-color:transparent;background:var(--panel);
  box-shadow:inset 2px 0 0 var(--lamp);color:var(--ink)}
.dfg-rootrow[data-drop="1"]{border-style:solid;border-color:var(--lamp);background:#1D1B18}
.dfg-rootrow em{font-style:normal;font-size:10.5px;color:#5D6474;font-family:ui-monospace,monospace}

.dfg-row{display:flex;align-items:stretch;min-height:52px;gap:6px;margin-bottom:5px;touch-action:pan-y;
  transition:transform .1s}
.dfg-row[data-dragging="1"]{z-index:40}
.dfg-row[data-dragging="1"] .dfg-folderbox{background:var(--raised);box-shadow:0 14px 34px rgba(0,0,0,.6)}
.dfg-folderbox{flex:1;min-width:0;display:flex;align-items:stretch;background:var(--panel);
  border:1px solid var(--line);border-radius:9px;transition:background .12s,box-shadow .12s,border-color .12s}
.dfg-folderbox[data-on="1"]{background:#20242F;border-color:#39404F;box-shadow:inset 3px 0 0 var(--lamp)}
.dfg-folderbox[data-drop="1"]{border-color:var(--lamp);box-shadow:0 0 0 1px var(--lamp) inset;background:#1D1B18}
.dfg-rails{display:flex;flex:0 0 auto}
.dfg-rails i{width:27px;border-left:1px solid var(--rail);margin-left:6px;position:relative}
.dfg-rails i:last-child::after{content:"";position:absolute;left:0;top:50%;width:19px;height:1px;background:var(--rail)}
.dfg-rails i[data-last="1"]{border-left-color:transparent}
.dfg-rails i[data-last="1"]::before{content:"";position:absolute;left:-1px;top:0;height:50%;width:1px;background:var(--rail)}
.dfg-node{flex:1;min-width:0;display:flex;align-items:center;gap:9px;padding:12px 2px 12px 12px;background:transparent;
  border:0;color:inherit;font-family:inherit;text-align:left;cursor:pointer}
.dfg-node b{font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfg-node em{font-style:normal;font-size:10.5px;color:#5D6474;font-family:ui-monospace,monospace;flex:0 0 auto}
.dfg-caret{appearance:none;flex:0 0 auto;width:46px;align-self:stretch;background:transparent;
  border:0;color:#6A7284;display:flex;align-items:center;justify-content:center;
  cursor:pointer;font-family:inherit;padding:0}
.dfg-caret svg{transition:transform .16s cubic-bezier(.2,.8,.3,1)}
.dfg-caret[data-open="1"] svg{transform:rotate(90deg)}
.dfg-caret[data-empty="1"]{opacity:.3}
.dfg-caret:active{color:var(--lamp)}
.dfg-folder{flex:0 0 auto;color:#6B7284}
.dfg-folderbox[data-on="1"] .dfg-folder{color:var(--lamp)}
.dfg-act{appearance:none;border:0;background:transparent;color:#4E5464;width:38px;flex:0 0 auto;font-size:15px;
  cursor:pointer;font-family:inherit}
.dfg-act:active{color:var(--ink)}
.dfg-slot{height:3px;background:var(--lamp);border-radius:2px;margin:1px 0}

.dfg-itemrow{display:flex;align-items:stretch;gap:6px;margin-bottom:5px;transition:transform .1s}
.dfg-caretgap{flex:0 0 auto;width:46px}
.dfg-wrap{position:relative;flex:1;min-width:0}
.dfg-swipebg{position:absolute;inset:0;border-radius:9px;background:#2A1A1D;display:flex;align-items:center;
  justify-content:flex-end;padding-right:18px;font-size:12.5px;font-weight:700;letter-spacing:.1em;color:#8C5A60}
.dfg-swipebg[data-armed="1"]{background:#3A1F24;color:#E08088}
.dfg-leaf{position:relative;display:flex;align-items:center;gap:9px;padding:0 8px 0 11px;border-radius:9px;
  background:var(--panel);border:1px solid var(--line);min-height:44px;touch-action:pan-y;
  transition:box-shadow .12s,border-color .12s}
.dfg-leaf[data-dragging="1"]{box-shadow:0 14px 34px rgba(0,0,0,.6);background:var(--raised)}
.dfg-leaf[data-drop="1"]{border-color:var(--lamp);box-shadow:0 0 0 1px var(--lamp) inset}
.dfg-leaf p{margin:0;flex:1;min-width:0;font-size:13.5px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;padding:11px 0;cursor:pointer}
.dfg-leaf em{font-style:normal;font-size:10px;color:#5D6474;flex:0 0 auto;font-family:ui-monospace,monospace}
.dfg-pip{width:5px;height:5px;border-radius:50%;flex:0 0 auto}
.dfg-stackmark{flex:0 0 auto;width:13px;height:13px;border:1px solid #5D6474;border-radius:3px;position:relative}
.dfg-stackmark::after{content:"";position:absolute;left:2px;right:-3px;top:3px;bottom:-3px;border:1px solid #5D6474;
  border-radius:3px;background:var(--panel)}
.dfg-empty{padding:44px 24px;text-align:center;color:#4E5464;font-size:13.5px;line-height:2}

/* ---- throw bar in tree ---- */
.dfg-bar{flex:0 0 auto;border-top:1px solid var(--line);padding:9px 12px max(12px,env(safe-area-inset-bottom));
  background:#131620}
.dfg-barinto{font-size:10.5px;letter-spacing:.08em;color:var(--lamp);opacity:.85;margin-bottom:7px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfg-quick{display:flex;gap:8px;align-items:flex-end}
.dfg-quick textarea{flex:1;min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:11px;
  color:var(--ink);font-family:inherit;font-size:14.5px;line-height:1.6;padding:12px 12px;outline:none;resize:none;
  height:46px;max-height:120px;caret-color:var(--lamp)}
.dfg-quick button{flex:0 0 auto;width:46px;height:46px;border-radius:12px;border:0;background:var(--lamp);
  color:#141621;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}
.dfg-quick button:disabled{background:var(--raised);color:#4E5464}

.dfg-echo{flex:0 0 auto;border-left:2px solid #4E647A;padding:2px 0 2px 11px;margin-bottom:4px;
  animation:dfgfade .3s}
.dfg-echohead{display:block;font-size:10px;letter-spacing:.12em;color:#4E647A;margin-bottom:6px}
.dfg-echo button{display:block;width:100%;text-align:left;appearance:none;border:0;background:transparent;
  color:#98A0B0;font-family:inherit;font-size:12.5px;line-height:1.55;padding:3px 0;cursor:pointer;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfg-echo button:active{color:var(--ink)}

/* ---- wall : 付箋を面で並べる ---- */
.dfg-wall{flex:1;min-height:0;display:flex;flex-direction:column}
.dfg-wallscroll{flex:1;overflow-y:auto}
.dfg-wallscroll[data-drag="1"]{overflow:hidden;touch-action:none}
.dfg-canvas{position:relative;width:100%}
.dfg-note{position:absolute;width:46%;min-height:112px;border-radius:3px;padding:11px 11px 24px;
  border:1px solid rgba(0,0,0,.16);border-top:4px solid var(--edge);touch-action:pan-y;color:#23262E;
  box-shadow:0 5px 14px rgba(0,0,0,.45);cursor:pointer;display:flex;flex-direction:column}
.dfg-note[data-bundle="1"]{width:56%}
.dfg-note[data-dragging="1"]{z-index:40;box-shadow:0 22px 50px rgba(0,0,0,.65)}
.dfg-note{transition:box-shadow .14s,border-color .12s,transform .14s cubic-bezier(.2,.8,.3,1)}
.dfg-note[data-drop="1"]{border-color:var(--lamp);box-shadow:0 0 0 1px var(--lamp) inset}
.dfg-note q{quotes:none;flex:1;font-size:12.5px;line-height:1.62;color:#23262E;overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;word-break:break-word;white-space:pre-wrap}
.dfg-note footer{position:absolute;left:12px;right:12px;bottom:8px;display:flex;align-items:center;gap:7px;
  font-size:9.5px;color:rgba(35,38,46,.5);font-family:ui-monospace,monospace}
.dfg-note b{font-size:13px;font-weight:700;display:block;margin-bottom:5px}
.dfg-notestack{position:absolute;inset:-1px;border-radius:3px;border:1px solid rgba(0,0,0,.14);
  z-index:-1;transform:translate(4px,5px)}
.dfg-wallbar{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid var(--line)}
.dfg-wallbar h2{margin:0;flex:1;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dfg-wallhint{font-size:11.5px;color:#565C6C;line-height:1.7;padding:10px 14px max(24px,env(safe-area-inset-bottom))}

.dfg-viz{flex:1;min-height:0;display:flex;flex-direction:column}
.dfg-vizmodes{display:flex;gap:7px;padding:10px 12px 4px;flex:0 0 auto}
.dfg-vizbody{flex:1;overflow-y:auto;padding:10px 12px max(24px,env(safe-area-inset-bottom))}
.dfg-scrollx{overflow-x:auto;padding-bottom:4px}
.dfg-scrollx::-webkit-scrollbar{height:4px}
.dfg-scrollx::-webkit-scrollbar-thumb{background:#2C313D;border-radius:2px}
.dfg-vizfoot{font-size:10.5px;color:#565C6C;letter-spacing:.08em;padding:10px 2px 0}

/* ---- draft ---- */
.dfg-draft{position:absolute;inset:0;z-index:68;background:var(--ground);display:flex;flex-direction:column;
  animation:dfgup .2s cubic-bezier(.2,.8,.3,1)}
.dfg-drafttext{flex:1;width:100%;background:transparent;border:0;outline:none;resize:none;color:var(--ink);
  font-family:inherit;font-size:15.5px;line-height:1.9;padding:14px 16px;caret-color:var(--lamp)}

/* ---- sheet ---- */
.dfg-scrim{position:absolute;inset:0;background:rgba(8,9,13,.72);z-index:70;animation:dfgfade .18s}
@keyframes dfgfade{from{opacity:0}}
.dfg-sheet{position:absolute;left:0;right:0;bottom:0;top:34px;z-index:71;background:var(--ground);
  border-radius:18px 18px 0 0;border-top:1px solid var(--line);display:flex;flex-direction:column;
  animation:dfgup .22s cubic-bezier(.2,.8,.3,1)}
@keyframes dfgup{from{transform:translateY(26px);opacity:.5}}
.dfg-shead{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;flex:0 0 auto;border-bottom:1px solid var(--line)}
.dfg-shead h2{margin:0;font-size:14px;font-weight:700;letter-spacing:.05em;flex:1;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.dfg-tool{appearance:none;border:0;background:transparent;color:var(--muted);width:44px;height:44px;
  border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.dfg-tool:active{background:var(--raised);color:var(--ink)}
.dfg-newname{flex:1;min-width:0;background:#0E1016;border:1px solid var(--lamp);border-radius:5px;color:var(--ink);
  font-family:inherit;font-size:14px;padding:6px 8px;outline:none}
.dfg-close{appearance:none;border:1px solid var(--line);background:var(--panel);color:var(--ink);
  width:44px;height:44px;border-radius:12px;font-size:16px;font-family:inherit;cursor:pointer;flex:0 0 auto}
.dfg-close:active{background:var(--raised)}
.dfg-sbody{flex:1;overflow-y:auto;padding:16px}
.dfg-sfoot{flex:0 0 auto;display:flex;gap:9px;padding:12px 16px max(18px,env(safe-area-inset-bottom));
  border-top:1px solid var(--line)}
.dfg-btn{appearance:none;font-family:inherit;font-size:13px;font-weight:600;letter-spacing:.03em;padding:12px 15px;
  border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer}
.dfg-btn:active{background:var(--raised)}
.dfg-btn[data-key="1"]{background:var(--lamp);border-color:var(--lamp);color:#141621}
.dfg-btn[data-quiet="1"]{background:transparent;border-color:transparent;color:var(--muted);padding:12px 10px}
.dfg-btn[data-warn="1"]{color:#C2757A;border-color:transparent;background:transparent}
.dfg-btn[data-block="1"]{display:block;width:100%;text-align:left;margin-bottom:8px}
.dfg-grow{flex:1}
.dfg-titleinput{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--ink);
  font-family:inherit;font-size:15px;font-weight:700;padding:11px 12px;outline:none}
.dfg-titleinput:focus{border-color:var(--lamp)}
.dfg-label{font-size:10.5px;letter-spacing:.14em;color:#565C6C;margin:20px 0 9px}
.dfg-out{width:100%;min-height:260px;background:var(--panel);border:1px solid var(--line);border-radius:11px;
  color:var(--ink);font-family:inherit;font-size:14.5px;line-height:1.85;padding:14px;outline:none;resize:vertical}
.dfg-hint{font-size:11.5px;color:#565C6C;line-height:1.7;margin-top:10px}
.dfg-sim{background:var(--panel);border:1px solid var(--line);border-left:2px solid #4E647A;border-radius:8px;
  padding:11px 12px;margin-bottom:8px;font-size:13px;line-height:1.6;color:#A8AEBC;display:-webkit-box;
  -webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.dfg-full{font-size:16px;line-height:1.8;white-space:pre-wrap;word-break:break-word}
.dfg-child{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:12px;margin-bottom:8px;
  display:flex;gap:10px;align-items:flex-start}
.dfg-child p{margin:0;flex:1;font-size:14px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.dfg-mini{appearance:none;border:0;background:transparent;color:#5D6474;font-family:inherit;font-size:16px;
  padding:2px 5px;cursor:pointer;line-height:1}
.dfg-pickrow{display:flex;align-items:center;gap:8px;padding:12px 10px;border-radius:8px;background:var(--panel);
  border:1px solid var(--line);margin-bottom:6px;cursor:pointer;font-family:inherit;color:var(--ink);font-size:14px;
  width:100%;text-align:left}
.dfg-pickrow[data-on="1"]{border-color:var(--lamp)}
.dfg-chip{appearance:none;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-family:inherit;
  font-size:13px;font-weight:600;padding:7px 13px;border-radius:999px;cursor:pointer;white-space:nowrap}
.dfg-chip[data-on="1"]{background:var(--lamp);border-color:var(--lamp);color:#141621}
.dfg-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.dfg-palette{display:flex;gap:10px;flex-wrap:wrap}
.dfg-swatch{appearance:none;width:46px;height:46px;border-radius:8px;cursor:pointer;border:1px solid rgba(0,0,0,.2);
  border-top:4px solid transparent;padding:0}
.dfg-swatch[data-on="1"]{box-shadow:0 0 0 2px var(--lamp)}
.dfg-toast{position:absolute;left:16px;right:16px;bottom:max(84px,env(safe-area-inset-bottom));z-index:65;
  background:var(--raised);border:1px solid var(--line);border-radius:11px;padding:13px 14px;display:flex;
  align-items:center;gap:12px;font-size:13px;box-shadow:0 14px 40px rgba(0,0,0,.5);animation:dfgup .18s}
.dfg-toast span{flex:1;color:var(--muted)}
.dfg-toast button{appearance:none;border:0;background:transparent;color:var(--lamp);font-family:inherit;
  font-size:13px;font-weight:700;padding:4px 6px;cursor:pointer}
@media (prefers-reduced-motion:reduce){.dfg *{animation:none!important;transition:none!important}}
`;

function FolderIcon({ open }) {
  return (
    <svg className="dfg-folder" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      {open ? (
        <path d="M1.6 13.2 3.3 7.4a1 1 0 0 1 .96-.7h9.6a.6.6 0 0 1 .58.77l-1.5 5.2a1 1 0 0 1-.96.73H2.2a.6.6 0 0 1-.6-.7Z
                 M1.4 11.6V3.6a.9.9 0 0 1 .9-.9h3.3l1.5 1.6h5a.9.9 0 0 1 .9.9v1.2"
          fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      ) : (
        <path d="M1.4 12.4V3.6a.9.9 0 0 1 .9-.9h3.3l1.5 1.6h6a.9.9 0 0 1 .9.9v7.2a.9.9 0 0 1-.9.9H2.3a.9.9 0 0 1-.9-.9Z"
          fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

export default function Defrag() {
  const [items, setItems] = useState([]);
  const [topics, setTopics] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [ready, setReady] = useState(false);

  const [drawer, setDrawer] = useState(false);
  const [here, setHere] = useState(ROOT);

  const [draft, setDraft] = useState("");
  const [quick, setQuick] = useState("");
  const [flash, setFlash] = useState(0);
  const [echo, setEcho] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [exportId, setExportId] = useState(null);
  const [copyTopic, setCopyTopic] = useState(null);
  const [newFolder, setNewFolder] = useState(null);
  const [creating, setCreating] = useState(null);
  const [folderMenu, setFolderMenu] = useState(null);
  const [moving, setMoving] = useState(null);
  const [trash, setTrash] = useState(null);
  const [tab, setTab] = useState("compose");
  const [editor, setEditor] = useState(null);

  const taRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadAll().then((d) => {
      if (!alive) return;
      if (d) {
        if (Array.isArray(d.items)) setItems(d.items);
        if (Array.isArray(d.topics)) setTopics(d.topics);
        if (d.expanded) setExpanded(d.expanded);
        if (d.here) setHere(d.here);
      }
      setReady(true);
    });
    return () => (alive = false);
  }, []);

  useEffect(() => { if (ready) saveAll({ items, topics, expanded, here }); }, [items, topics, expanded, here, ready]);
  useEffect(() => { if (!drawer && taRef.current) taRef.current.focus(); }, [drawer]);

  /* 画面左端からのスワイプで開く */
  useEffect(() => {
    const el = document.querySelector(".dfg");
    if (!el) return;
    let x0 = null;
    const start = (e) => { const t = e.touches[0]; x0 = t && t.clientX < 22 ? t.clientX : null; };
    const mv = (e) => {
      if (x0 == null) return;
      const t = e.touches[0];
      if (t && t.clientX - x0 > 40) { setDrawer(true); x0 = null; }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", mv, { passive: true });
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", mv); };
  }, []);
  useEffect(() => {
    if (!echo.length) return;
    const t = setTimeout(() => setEcho([]), 12000);
    return () => clearTimeout(t);
  }, [echo]);

  useEffect(() => {
    if (!trash) return;
    const t = setTimeout(() => setTrash(null), 6000);
    return () => clearTimeout(t);
  }, [trash]);

  const hereId = here === ROOT ? null : here;
  const herePath = pathLabel(topics, here);

  const add = (text) => {
    const v = text.trim();
    if (!v) return;
    setItems((prev) => [{ id: uid(), kind: "card", text: v, createdAt: Date.now(), topicId: hereId }, ...prev]);
    setFlash(Date.now());
  };
  const throwIt = () => {
    if (!draft.trim()) return;
    const pool = items.flatMap((it) => flattenTexts(it).map((t) => ({ t, id: it.id })));
    const idf = buildIdf([draft, ...pool.map((x) => x.t)]);
    const dv = vectorize(draft, idf);
    const echoes = pool
      .map((x) => ({ ...x, s: cosine(dv, vectorize(x.t, idf)) }))
      .filter((e) => e.s > 0.07)
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);
    add(draft);
    setEcho(echoes);
    setDraft("");
    if (taRef.current) taRef.current.focus();
  };
  const throwQuick = () => { if (quick.trim()) { add(quick); setQuick(""); } };

  const cardCount = useMemo(
    () => items.reduce((n, it) => n + (it.kind === "bundle" ? it.children.length : 1), 0), [items]);
  const recent = useMemo(() => items.filter((i) => i.kind === "card").slice(0, 2), [items]);

  const countIn = useCallback((tid) => {
    if (tid === ROOT) return items.filter((i) => !i.topicId).length;
    const ids = [tid, ...descendantIds(topics, tid)];
    return items.filter((i) => ids.includes(i.topicId)).length;
  }, [items, topics]);

  /* --- items --- */

  const moveItem = (id, topicId, beforeId) => {
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === id);
      if (from < 0) return prev;
      const next = prev.slice();
      const [m] = next.splice(from, 1);
      const moved = { ...m, topicId: topicId || null };
      if (beforeId) {
        const at = next.findIndex((i) => i.id === beforeId);
        next.splice(at < 0 ? next.length : at, 0, moved);
      } else {
        next.unshift(moved);
      }
      return next;
    });
  };

  const bundle = (dragId, targetId) => {
    setItems((prev) => {
      const di = prev.findIndex((i) => i.id === dragId);
      const ti = prev.findIndex((i) => i.id === targetId);
      if (di < 0 || ti < 0) return prev;
      const next = prev.slice();
      const src = next[di];
      const dst = next[ti];
      const kids = src.kind === "bundle" ? src.children : [{ id: src.id, text: src.text, createdAt: src.createdAt }];
      next[ti] =
        dst.kind === "bundle"
          ? { ...dst, children: [...dst.children, ...kids] }
          : {
              id: uid(), kind: "bundle", title: "", createdAt: Date.now(), topicId: dst.topicId || null,
              children: [{ id: dst.id, text: dst.text, createdAt: dst.createdAt }, ...kids],
            };
      next.splice(di, 1);
      return next;
    });
  };

  const sortWithin = (tid, dir) => {
    setItems((prev) => {
      const key = tid === ROOT ? null : tid;
      const idx = [];
      prev.forEach((it, i) => { if ((it.topicId || null) === key) idx.push(i); });
      const vals = idx.map((i) => prev[i]).sort((a, b) =>
        dir === "new" ? itemStamp(b) - itemStamp(a) : itemStamp(a) - itemStamp(b));
      const next = prev.slice();
      idx.forEach((i, k) => (next[i] = vals[k]));
      return next;
    });
  };

  const trashItem = (id) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const gone = items[idx];
    setItems((p) => p.filter((i) => i.id !== id));
    setTrash({ item: gone, index: idx });
  };
  const undoTrash = () => {
    if (!trash) return;
    setItems((p) => { const n = p.slice(); n.splice(Math.min(trash.index, n.length), 0, trash.item); return n; });
    setTrash(null);
  };

  const patchItem = (id, patch) => setItems((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const unbundle = (id) =>
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const b = prev[idx];
      const loose = b.children.map((c) => ({
        id: c.id, kind: "card", text: c.text, createdAt: c.createdAt, topicId: b.topicId || null }));
      const next = prev.slice();
      next.splice(idx, 1, ...loose);
      return next;
    });

  /* --- folders --- */

  const addFolder = (title, parentId) => {
    const t = { id: uid(), title: title.trim() || "名前のないフォルダ", parentId: parentId || null, createdAt: Date.now() };
    setTopics((p) => [...p, t]);
    if (parentId) setExpanded((c) => ({ ...c, [parentId]: true }));
    setHere(t.id);
  };
  const patchFolder = (id, patch) => setTopics((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeFolder = (id) => {
    const t = topics.find((x) => x.id === id);
    const up = t ? t.parentId || null : null;
    setTopics((p) => p.filter((x) => x.id !== id).map((x) => (x.parentId === id ? { ...x, parentId: up } : x)));
    setItems((p) => p.map((i) => (i.topicId === id ? { ...i, topicId: up } : i)));
    setHere(up || ROOT);
  };

  const nestFolder = (dragId, newParentId) => {
    if (dragId === newParentId) return;
    const pid = newParentId === ROOT ? null : newParentId;
    if (pid && descendantIds(topics, dragId).includes(pid)) return;
    setTopics((p) => {
      const t = p.find((x) => x.id === dragId);
      if (!t) return p;
      return [...p.filter((x) => x.id !== dragId), { ...t, parentId: pid }];
    });
    if (pid) setExpanded((c) => ({ ...c, [pid]: true }));
  };

  const moveFolderBefore = (dragId, beforeId) => {
    setTopics((p) => {
      const t = p.find((x) => x.id === dragId);
      if (!t) return p;
      if (beforeId && descendantIds(p, dragId).includes(beforeId)) return p;
      const target = beforeId ? p.find((x) => x.id === beforeId) : null;
      const parentId = target ? target.parentId || null : null;
      const next = p.filter((x) => x.id !== dragId);
      const at = beforeId ? next.findIndex((x) => x.id === beforeId) : next.length;
      next.splice(at < 0 ? next.length : at, 0, { ...t, parentId });
      return next;
    });
  };

  const promote = (id) => {
    const b = items.find((i) => i.id === id);
    if (!b || b.kind !== "bundle") return;
    const parent = b.topicId || null;
    const t = { id: uid(), title: b.title || "名前のないフォルダ", parentId: parent, createdAt: Date.now() };
    setTopics((p) => [...p, t]);
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      const loose = b.children.map((c) => ({
        id: c.id, kind: "card", text: c.text, createdAt: c.createdAt, topicId: t.id }));
      const next = prev.slice();
      next.splice(idx, 1, ...loose);
      return next;
    });
    setExpanded((c) => ({ ...c, [t.id]: true, ...(parent ? { [parent]: true } : {}) }));
    setHere(t.id);
  };

  const openItem = items.find((i) => i.id === openId) || null;
  const exportItem = items.find((i) => i.id === exportId) || null;
  const menuFolder = topics.find((t) => t.id === folderMenu) || null;

  return (
    <div className="dfg">
      <style>{CSS}</style>

      <div className="dfg-top">
        <button className="dfg-burger" onClick={() => setDrawer(true)} aria-label="フォルダ">☰</button>
        <button className="dfg-tab" data-on={tab === "compose" ? "1" : "0"} onClick={() => setTab("compose")}>投げる</button>
        <button className="dfg-tab" data-on={tab === "wall" ? "1" : "0"} onClick={() => setTab("wall")}>付箋</button>
        <button className="dfg-tab" data-on={tab === "viz" ? "1" : "0"} onClick={() => setTab("viz")}>可視化</button>
        <span className="dfg-count dfg-mono">{cardCount}</span>
      </div>

      {tab === "compose" ? (
      <div className="dfg-compose">
        <button className="dfg-into" onClick={() => setDrawer(true)}>→ {herePath}</button>
        <textarea ref={taRef} className="dfg-ta" value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="いま浮かんだこと" autoComplete="off" autoCorrect="off" />
        {echo.length > 0 && (
          <div className="dfg-echo">
            <span className="dfg-echohead">前にも近いことを書いている</span>
            {echo.map((e, i) => (
              <button key={i} onClick={() => { setEcho([]); setOpenId(e.id); }}>{e.t}</button>
            ))}
          </div>
        )}
        <div className="dfg-composebar">
          <div className="dfg-recent">{echo.length ? null : recent.map((r) => <span key={r.id}>{itemLabel(r)}</span>)}</div>
          <button className="dfg-send" onClick={throwIt} disabled={!draft.trim()}>投げる</button>
        </div>
        {flash ? <div className="dfg-flash dfg-mono" key={flash}>投稿しました</div> : null}
      </div>
      ) : tab === "viz" ? (
        <Viz topics={topics} items={items} rootId={here} onOpen={setOpenId} onOpenDrawer={() => setDrawer(true)} />
      ) : (
        <Wall
          topics={topics} items={items} rootId={here}
          onOpenDrawer={() => setDrawer(true)}
          onOpen={setOpenId}
          onBundle={bundle}
          onPos={(id, pos) => patchItem(id, { pos })}
          onDraft={() => setEditor(here)}
        />
      )}

      {drawer && (
        <div className="dfg-drawer">
          <div className="dfg-dhead">
            <h2>フォルダ</h2>
            <button className="dfg-tool" onClick={() => setCreating({ parentId: hereId })} aria-label="新しいフォルダ">
              <svg viewBox="0 0 20 20" width="19" height="19">
                <path d="M2.2 15.4V4.6a1 1 0 0 1 1-1h3.6l1.7 1.8h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1Z"
                  fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M10 8.6v4.6M7.7 10.9h4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button className="dfg-tool" onClick={() => setExpanded({})} aria-label="すべてたたむ">
              <svg viewBox="0 0 20 20" width="19" height="19">
                <path d="M4 7.4 10 12l6-4.6M4 12.6 10 17l6-4.4" fill="none" stroke="currentColor"
                  strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 4h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button className="dfg-close" onClick={() => setDrawer(false)} aria-label="閉じる">✕</button>
          </div>
          <Tree
            topics={topics}
            items={items}
            expanded={expanded}
            here={here}
            countIn={countIn}
            onSelect={(id) => { setHere(id); setDrawer(false); setTab("compose"); }}
            onToggle={(id) => setExpanded((c) => ({ ...c, [id]: !c[id] }))}
            onOpenItem={setOpenId}
            onMenu={setFolderMenu}
            creating={creating}
            onCreate={(title) => {
              if (title.trim()) addFolder(title, creating.parentId);
              setCreating(null);
            }}
            onCancelCreate={() => setCreating(null)}
            onNest={nestFolder}
            onFolderBefore={moveFolderBefore}
            onMoveItem={moveItem}
            onBundle={bundle}
            onTrash={trashItem}
          />
          <div className="dfg-bar">
            <div className="dfg-barinto">→ {herePath}</div>
            <div className="dfg-quick">
              <textarea value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="ここに投げる" rows={1} />
              <button onClick={throwQuick} disabled={!quick.trim()}>投</button>
            </div>
          </div>
        </div>
      )}

      {editor !== null && (
        <Draft topics={topics} items={items} rootId={editor} onClose={() => setEditor(null)} />
      )}

      {trash && (
        <div className="dfg-toast">
          <span>捨てた</span>
          <button onClick={undoTrash}>戻す</button>
        </div>
      )}

      {newFolder && (
        <NewFolder
          parentName={newFolder.parentId ? (topics.find((t) => t.id === newFolder.parentId) || {}).title : null}
          onClose={() => setNewFolder(null)}
          onCreate={(title) => { addFolder(title, newFolder.parentId); setNewFolder(null); }}
        />
      )}

      {menuFolder && !moving && (
        <FolderMenu
          folder={menuFolder}
          onRename={(v) => patchFolder(menuFolder.id, { title: v })}
          onCopy={() => { setCopyTopic(menuFolder.id); setFolderMenu(null); }}
          onWall={() => { setHere(menuFolder.id); setFolderMenu(null); setDrawer(false); setTab("wall"); }}
          onDraft={() => { setEditor(menuFolder.id); setFolderMenu(null); }}
          onAddChild={() => { setExpanded((c) => ({ ...c, [menuFolder.id]: true })); setCreating({ parentId: menuFolder.id }); setFolderMenu(null); }}
          onSort={(dir) => sortWithin(menuFolder.id, dir)}
          onMove={() => setMoving(menuFolder)}
          onDelete={() => { removeFolder(menuFolder.id); setFolderMenu(null); }}
          onClose={() => setFolderMenu(null)}
        />
      )}

      {moving && (
        <PickSheet
          title="どこの下に移すか"
          topics={topics.filter((t) => t.id !== moving.id && !descendantIds(topics, moving.id).includes(t.id))}
          current={moving.parentId}
          onPick={(pid) => { nestFolder(moving.id, pid); setMoving(null); setFolderMenu(null); }}
          onClose={() => setMoving(null)}
        />
      )}

      {copyTopic && (
        <Sheet title="まとめてコピー" onClose={() => setCopyTopic(null)}>
          <TopicCopy items={items} topics={topics} topicId={copyTopic} />
        </Sheet>
      )}

      {openItem && (
        <Sheet onClose={() => setOpenId(null)} title={openItem.kind === "bundle" ? "束" : "断片"}>
          {openItem.kind === "bundle" ? (
            <BundleView
              bundle={openItem}
              topics={topics}
              onChange={(patch) => patchItem(openItem.id, patch)}
              onExport={() => { setExportId(openItem.id); setOpenId(null); }}
              onUnbundle={() => { unbundle(openItem.id); setOpenId(null); }}
              onPromote={() => { promote(openItem.id); setOpenId(null); }}
            />
          ) : (
            <CardView
              card={openItem}
              items={items}
              topics={topics}
              onMove={(tid) => patchItem(openItem.id, { topicId: tid })}
              onColor={(c) => patchItem(openItem.id, { color: c })}
              onDelete={() => { trashItem(openItem.id); setOpenId(null); }}
            />
          )}
        </Sheet>
      )}

      {exportItem && (
        <Sheet onClose={() => setExportId(null)} title="束を書き出す">
          <BundleExport bundle={exportItem} />
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* tree — ここが唯一の作業面                                            */
/* ------------------------------------------------------------------ */

function Tree({ topics, items, expanded, here, countIn, onSelect, onToggle, onOpenItem, onMenu,
  onNest, onFolderBefore, onMoveItem, onBundle, onTrash, creating, onCreate, onCancelCreate }) {
  const isOpen = useCallback((id) => !!expanded[id], [expanded]);
  const rows = useMemo(() => buildRows(topics, items, isOpen), [topics, items, isOpen]);
  const rootCount = useMemo(() => items.filter((i) => !i.topicId).length, [items]);

  const listRef = useRef(null);
  const refs = useRef({});
  const hold = useRef(null);
  const drag = useRef(null);
  const suppress = useRef(false);

  const [dragState, setDragState] = useState({ id: null, kind: null, offset: 0, slot: null, dropId: null });
  const [swipe, setSwipe] = useState({ id: null, dx: 0 });

  /* kind ごとに当たり判定を作る。フォルダは面で受け、断片は真ん中だけで束になる。 */
  const measure = (kind) => {
    const out = [];
    rows.forEach((r, i) => {
      const el = refs.current[r.id];
      if (!el) return;
      const b = el.getBoundingClientRect();
      const base = { id: r.id, index: i, top: b.top, bottom: b.bottom, mid: b.top + b.height / 2, h: b.height, parent: r.parent };
      if (kind === "item") {
        out.push({ ...base, droppable: true, band: r.type === "folder" ? 1 : 0.5, sortable: true, isFolder: r.type === "folder" });
      } else {
        out.push({ ...base, droppable: r.type === "folder", band: 0.44, sortable: r.type === "folder" });
      }
    });
    const rootEl = refs.current[ROOT];
    if (rootEl && kind === "item") {
      const b = rootEl.getBoundingClientRect();
      out.push({ id: ROOT, index: -1, top: b.top, bottom: b.bottom, mid: b.top + b.height / 2, h: b.height, droppable: true, band: 1, sortable: false, isFolder: true });
    }
    return out;
  };

  const beginDrag = (id, kind, index, el, pid, y) => {
    drag.current = { id, kind, index, startY: y, rects: measure(kind) };
    setDragState({ id, kind, offset: 0, slot: null, dropId: null });
    suppress.current = true;
    try { el.setPointerCapture(pid); } catch (e) {}
  };

  const dragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const y = e.clientY;
    let dropId = null;
    let slot = null;
    let over = null;
    for (const r of d.rects) {
      if (r.id === d.id || !r.droppable) continue;
      if (y >= r.top && y <= r.bottom) { over = r; break; }
    }
    if (over) {
      const band = over.h * over.band;
      if (y > over.mid - band / 2 && y < over.mid + band / 2) dropId = over.id;
    }
    if (!dropId) {
      slot = rows.length;
      for (const r of d.rects) {
        if (r.sortable && r.index >= 0 && y < r.mid) { slot = r.index; break; }
      }
    }
    setDragState({ id: d.id, kind: d.kind, offset: y - d.startY, slot, dropId });
  };

  const finishDrag = () => {
    const d = drag.current;
    const s = dragState;
    drag.current = null;
    setDragState({ id: null, kind: null, offset: 0, slot: null, dropId: null });
    if (!d) return;
    if (d.kind === "item") {
      if (s.dropId === ROOT) { onMoveItem(d.id, null, null); return; }
      if (s.dropId) {
        const target = rows.find((r) => r.id === s.dropId);
        if (target && target.type === "folder") onMoveItem(d.id, s.dropId, null);
        else if (target) onBundle(d.id, s.dropId);
        return;
      }
      if (s.slot !== null && s.slot !== d.index && s.slot !== d.index + 1) {
        const at = rows[s.slot];
        const prev = s.slot > 0 ? rows[s.slot - 1] : null;
        const parent = at ? at.parent : prev ? prev.parent : null;
        const before = at && at.type === "item" ? at.id : null;
        onMoveItem(d.id, parent, before);
      }
      return;
    }
    if (s.dropId) { onNest(d.id, s.dropId); return; }
    if (s.slot !== null && s.slot !== d.index && s.slot !== d.index + 1) {
      let before = null;
      for (let k = s.slot; k < rows.length; k++) {
        if (rows[k].type === "folder") { before = rows[k].id; break; }
      }
      onFolderBefore(d.id, before);
    }
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const block = (e) => { if (drag.current || (hold.current && hold.current.mode === "swipe")) e.preventDefault(); };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  /* 押さえれば掴む、横に払えば捨てる、縦はスクロール */
  const down = (e, row, i) => {
    hold.current = { id: row.id, type: row.type, index: i, x: e.clientX, y: e.clientY,
      el: e.currentTarget, pid: e.pointerId, mode: null };
    hold.current.timer = setTimeout(() => {
      const h = hold.current;
      if (!h || h.mode) return;
      h.mode = "drag";
      beginDrag(row.id, row.type === "item" ? "item" : "folder", i, h.el, h.pid, h.y);
    }, 200);
  };

  const move = (e) => {
    if (drag.current) { dragMove(e); return; }
    const h = hold.current;
    if (!h) return;
    const dx = e.clientX - h.x;
    const dy = e.clientY - h.y;
    if (!h.mode) {
      if (h.type === "item" && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        h.mode = "swipe";
        clearTimeout(h.timer);
        suppress.current = true;
        try { h.el.setPointerCapture(h.pid); } catch (err) {}
      } else if (Math.abs(dx) > 12 || Math.abs(dy) > 9) {
        h.mode = "scroll";
        clearTimeout(h.timer);
        hold.current = null;
      }
      return;
    }
    if (h.mode === "swipe") { e.preventDefault(); setSwipe({ id: h.id, dx: Math.min(0, dx) }); }
  };

  const up = () => {
    if (drag.current) { finishDrag(); hold.current = null; return; }
    const h = hold.current;
    hold.current = null;
    if (!h) return;
    clearTimeout(h.timer);
    if (h.mode === "swipe") {
      const w = h.el.offsetWidth || 320;
      if (Math.abs(swipe.dx) > w * 0.36) onTrash(h.id);
      setSwipe({ id: null, dx: 0 });
    }
  };

  const tapped = (fn) => () => {
    if (suppress.current) { suppress.current = false; return; }
    fn();
  };

  const s = dragState;

  return (
    <div className="dfg-tree" ref={listRef} data-drag={s.id ? "1" : "0"}
      onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="dfg-rootrow" ref={(el) => (refs.current[ROOT] = el)}
        data-on={here === ROOT ? "1" : "0"} data-drop={s.dropId === ROOT ? "1" : "0"}
        onClick={tapped(() => onSelect(ROOT))}>
        <span className="dfg-mono">/</span>
        {rootCount > 0 && <em>{rootCount}</em>}
      </div>

      {rows.length === 0 && (
        <div className="dfg-empty">
          まだ何もない。
          <br />
          下から投げれば、ここに並ぶ。
        </div>
      )}

      {creating && !creating.parentId && (
        <NewRow depth={0} onCommit={onCreate} onCancel={onCancelCreate} />
      )}

      {rows.map((row, i) => {
        const dragging = s.id === row.id;
        const style = { transform: dragging ? `translateY(${s.offset}px)` : undefined, zIndex: dragging ? 40 : undefined };

        if (row.type === "item") {
          const it = row.item;
          const stamp = itemStamp(it);
          const dx = swipe.id === row.id ? swipe.dx : 0;
          return (
            <React.Fragment key={row.id}>
              {s.slot === i && s.id ? <div className="dfg-slot" style={{ marginLeft: row.depth * 27 + 52 }} /> : null}
              <div className="dfg-itemrow" style={style}>
              <div className="dfg-rails">{Array.from({ length: row.depth }).map((_, k) => <i key={k} />)}</div>
              <span className="dfg-caretgap" />
              <div className="dfg-wrap">
                {dx < 0 && <div className="dfg-swipebg" data-armed={Math.abs(dx) > 110 ? "1" : "0"}>捨てる</div>}
                <div ref={(el) => (refs.current[row.id] = el)} className="dfg-leaf"
                  data-dragging={dragging ? "1" : "0"} data-drop={s.dropId === row.id ? "1" : "0"}
                  style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
                  onPointerDown={(e) => down(e, row, i)}>
                  {it.kind === "bundle"
                    ? <span className="dfg-stackmark" />
                    : <span className="dfg-pip" style={{ background: ageColor(stamp) }} />}
                  <p onClick={tapped(() => onOpenItem(row.id))}>{itemLabel(it)}</p>
                  <em>{it.kind === "bundle" ? `${it.children.length}枚` : absDate(stamp, false)}</em>
                </div>
              </div>
              </div>
            </React.Fragment>
          );
        }

        const open = isOpen(row.id);
        const total = countIn(row.id);
        return (
          <React.Fragment key={row.id}>
            {s.slot === i && s.id ? <div className="dfg-slot" style={{ marginLeft: row.depth * 27 + 52 }} /> : null}
            <div ref={(el) => (refs.current[row.id] = el)} className="dfg-row"
              data-on={here === row.id ? "1" : "0"}
              data-dragging={dragging ? "1" : "0"}
              data-drop={s.dropId === row.id ? "1" : "0"}
              style={style} onPointerDown={(e) => down(e, row, i)}>
              <div className="dfg-rails">
                {Array.from({ length: row.depth }).map((_, k) => <i key={k} />)}
              </div>
              <button className="dfg-caret" data-open={open ? "1" : "0"} data-empty={total === 0 ? "1" : "0"}
                onPointerDown={(e) => e.stopPropagation()} onClick={() => onToggle(row.id)}>
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="dfg-folderbox" data-on={here === row.id ? "1" : "0"}
                data-drop={s.dropId === row.id ? "1" : "0"}>
                <button className="dfg-node" onClick={tapped(() => onSelect(row.id))}>
                  <FolderIcon open={open} />
                  <b>{row.title}</b>
                  {total > 0 && <em>{total}</em>}
                </button>
                <button className="dfg-act" onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onMenu(row.id)}>⋯</button>
              </div>
            </div>
            {creating && creating.parentId === row.id && (
              <NewRow depth={row.depth + 1} onCommit={onCreate} onCancel={onCancelCreate} />
            )}
          </React.Fragment>
        );
      })}
      {s.slot === rows.length && s.id ? <div className="dfg-slot" /> : null}
    </div>
  );
}


function NewRow({ depth, onCommit, onCancel }) {
  const [v, setV] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return (
    <div className="dfg-row">
      <div className="dfg-rails">{Array.from({ length: depth }).map((_, k) => <i key={k} />)}</div>
      <span className="dfg-caret" data-empty="1" />
      <div className="dfg-folderbox">
        <span className="dfg-node">
        <FolderIcon />
        <input ref={ref} className="dfg-newname" value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => onCommit(v)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit(v);
            if (e.key === "Escape") onCancel();
          }} />
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 付箋の面 — フォルダ配下を一覧で見比べ、重ねて束ねる                  */
/* ------------------------------------------------------------------ */

function subtreeItems(topics, items, rootId) {
  const ids = rootId === ROOT ? [null] : [rootId, ...descendantIds(topics, rootId)];
  return items.filter((i) => ids.includes(i.topicId || null) || ids.includes(i.topicId));
}

const NOTE_COLORS = [
  { id: "plain",  bg: "#EDE9DE", edge: "#BCB49F" },
  { id: "amber",  bg: "#F5D68B", edge: "#C99A2E" },
  { id: "rose",   bg: "#F2B9BC", edge: "#C46E76" },
  { id: "teal",   bg: "#A9DBD2", edge: "#489C93" },
  { id: "indigo", bg: "#BCC6F0", edge: "#6E7BC9" },
  { id: "olive",  bg: "#D2DFA4", edge: "#8DA34F" },
];
const colorOf = (id) => NOTE_COLORS.find((c) => c.id === id) || NOTE_COLORS[0];

/* 置いた場所を覚える。まだ置かれていないものは、雑に散らしてから渡す。 */
function scatter(i, w) {
  const cols = 2;
  const cw = (w - 24) / cols;
  const col = i % cols;
  const row = Math.floor(i / cols);
  const jx = ((i * 37) % 19) - 9;
  const jy = ((i * 53) % 23) - 11;
  return {
    x: Math.max(4, 10 + col * cw + jx),
    y: 10 + row * 132 + jy,
    r: (((i * 29) % 7) - 3) * 0.9,
  };
}

function Wall({ topics, items, rootId, onOpenDrawer, onOpen, onBundle, onPos, onDraft }) {
  const list = useMemo(() => subtreeItems(topics, items, rootId), [topics, items, rootId]);
  const canvasRef = useRef(null);
  const refs = useRef({});
  const hold = useRef(null);
  const drag = useRef(null);
  const suppress = useRef(false);
  const [st, setSt] = useState({ id: null, x: 0, y: 0, dropId: null });

  /* 未配置のものに初期位置を与える */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const w = el.clientWidth || 360;
    list.forEach((it, i) => {
      if (!it.pos) onPos(it.id, scatter(i, w));
    });
  }, [list, onPos]);

  const height = useMemo(() => {
    let max = 260;
    list.forEach((it) => { if (it.pos) max = Math.max(max, it.pos.y + 200); });
    return max;
  }, [list]);

  const measure = () =>
    list.map((it) => {
      const el = refs.current[it.id];
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { id: it.id, cx: b.left + b.width / 2, cy: b.top + b.height / 2, w: b.width, h: b.height };
    }).filter(Boolean);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const block = (e) => { if (drag.current) e.preventDefault(); };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  const down = (e, item) => {
    const base = item.pos || { x: 10, y: 10, r: 0 };
    hold.current = { id: item.id, x: e.clientX, y: e.clientY, el: e.currentTarget, pid: e.pointerId, mode: null };
    hold.current.timer = setTimeout(() => {
      const h = hold.current;
      if (!h || h.mode) return;
      h.mode = "drag";
      suppress.current = true;
      drag.current = { id: item.id, x0: h.x, y0: h.y, base, rects: measure() };
      setSt({ id: item.id, x: base.x, y: base.y, dropId: null });
      try { h.el.setPointerCapture(h.pid); } catch (err) {}
    }, 180);
  };

  const move = (e) => {
    const d = drag.current;
    if (!d) {
      const h = hold.current;
      if (h && !h.mode && (Math.abs(e.clientX - h.x) > 9 || Math.abs(e.clientY - h.y) > 9)) {
        clearTimeout(h.timer);
        hold.current = null;
      }
      return;
    }
    e.preventDefault();
    const nx = Math.max(0, d.base.x + (e.clientX - d.x0));
    const ny = Math.max(0, d.base.y + (e.clientY - d.y0));
    let dropId = null;
    for (const r of d.rects) {
      if (r.id === d.id) continue;
      if (Math.abs(e.clientX - r.cx) < r.w * 0.3 && Math.abs(e.clientY - r.cy) < r.h * 0.3) { dropId = r.id; break; }
    }
    setSt({ id: d.id, x: nx, y: ny, dropId });
  };

  const up = () => {
    const d = drag.current;
    if (hold.current) { clearTimeout(hold.current.timer); hold.current = null; }
    if (d) {
      if (st.dropId) onBundle(d.id, st.dropId);
      else onPos(d.id, { x: st.x, y: st.y, r: d.base.r || 0 });
    }
    drag.current = null;
    setSt({ id: null, x: 0, y: 0, dropId: null });
  };

  const tapped = (fn) => () => {
    if (suppress.current) { suppress.current = false; return; }
    fn();
  };

  return (
    <div className="dfg-wall">
      <div className="dfg-wallbar">
        <button className="dfg-into" style={{ flex: 1 }} onClick={onOpenDrawer}>{pathLabel(topics, rootId === ROOT ? null : rootId)}</button>
        <button className="dfg-btn" data-quiet="1" onClick={onDraft}>下書き</button>
      </div>
      <div className="dfg-wallscroll" data-drag={st.id ? "1" : "0"}
        onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="dfg-canvas" ref={canvasRef} style={{ height }}>
          {list.length === 0 && <div className="dfg-empty">ここにはまだ何もない。</div>}
          {list.map((it) => {
            const dragging = st.id === it.id;
            const pos = dragging ? st : it.pos || { x: 10, y: 10, r: 0 };
            const rot = (it.pos && it.pos.r) || 1;
            const stamp = itemStamp(it);
            const col = colorOf(it.color);
            return (
              <div key={it.id} ref={(el) => (refs.current[it.id] = el)} className="dfg-note"
                data-bundle={it.kind === "bundle" ? "1" : "0"}
                data-dragging={dragging ? "1" : "0"} data-drop={st.dropId === it.id ? "1" : "0"}
                style={{
                  left: pos.x, top: pos.y,
                  background: col.bg,
                  borderTopColor: it.color && it.color !== "plain" ? col.edge : ageColor(stamp),
                  color: "#23262E",
                  transform: dragging ? `rotate(${rot < 0 ? -3.5 : 3.5}deg) scale(1.06)` : undefined,
                }}
                onPointerDown={(e) => down(e, it)}
                onClick={tapped(() => onOpen(it.id))}>
                {it.kind === "bundle" && <span className="dfg-notestack" style={{ background: col.bg }} />}
                {it.kind === "bundle" && <b>{it.title || "名前のない束"}</b>}
                <q>{it.kind === "bundle" ? it.children.map((c) => c.text).join("\n\n") : it.text}</q>
                <footer>
                  <span className="dfg-pip" style={{ background: ageColor(stamp) }} />
                  <span>{absDate(stamp, true)}</span>
                  {it.kind === "bundle" && <span>{it.children.length}枚</span>}
                </footer>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* 可視化                                                              */
/* ------------------------------------------------------------------ */

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function eachFragment(items) {
  const out = [];
  items.forEach((it) => {
    if (it.kind === "bundle") {
      it.children.forEach((c) => out.push({ id: c.id, ownerId: it.id, text: c.text, createdAt: c.createdAt, topicId: it.topicId || null }));
    } else {
      out.push({ id: it.id, ownerId: it.id, text: it.text, createdAt: it.createdAt, topicId: it.topicId || null });
    }
  });
  return out;
}

function Viz({ topics, items, rootId, onOpen, onOpenDrawer }) {
  const [mode, setMode] = useState("activity");
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
function Activity({ frags }) {
  const { days, max } = useMemo(() => {
    const m = new Map();
    let min = Infinity;
    frags.forEach((f) => {
      const d = new Date(f.createdAt);
      const k = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      m.set(k, (m.get(k) || 0) + 1);
      if (k < min) min = k;
    });
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const out = [];
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
function Clock({ frags }) {
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
function Graph({ frags, onOpen }) {
  const [level, setLevel] = useState(0.09);
  const list = useMemo(() => frags.slice(0, 140), [frags]);

  const vecs = useMemo(() => {
    const idf = buildIdf(list.map((f) => f.text));
    return list.map((f) => vectorize(f.text, idf));
  }, [list]);

  const edges = useMemo(() => {
    const out = [];
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

/* ------------------------------------------------------------------ */
/* 下書き — フォルダ配下を繋いだ状態から書き始める                      */
/* ------------------------------------------------------------------ */

function Draft({ topics, items, rootId, onClose }) {
  const initial = useMemo(() => {
    const render = (it) => {
      if (it.kind === "bundle") {
        const head = it.title ? it.title + "\n\n" : "";
        return head + it.children.map((c) => c.text).join("\n\n");
      }
      return it.text;
    };
    const section = (tid, depth) => {
      const t = topics.find((x) => x.id === tid);
      const parts = [];
      if (t) parts.push(`${"#".repeat(Math.min(depth + 1, 6))} ${t.title}`);
      const own = items.filter((i) => (i.topicId || null) === (tid === ROOT ? null : tid));
      if (own.length) parts.push(own.map(render).join("\n\n"));
      if (tid !== ROOT) childrenOf(topics, tid).forEach((c) => {
        const sec = section(c.id, depth + 1);
        if (sec) parts.push(sec);
      });
      return parts.join("\n\n");
    };
    return section(rootId, 0);
  }, [topics, items, rootId]);

  const [text, setText] = useState(initial);
  const { done, copy, ref } = useCopy(text);

  return (
    <div className="dfg-draft">
      <div className="dfg-wallbar">
        <h2>下書き — {pathLabel(topics, rootId === ROOT ? null : rootId)}</h2>
        <button className="dfg-btn" data-key="1" onClick={copy}>{done ? "コピーした" : "コピー"}</button>
        <button className="dfg-close" onClick={onClose} aria-label="閉じる">✕</button>
      </div>
      <textarea ref={ref} className="dfg-drafttext" value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* sheets                                                              */
/* ------------------------------------------------------------------ */

function Sheet({ title, onClose, children }) {
  return (
    <>
      <div className="dfg-scrim" onClick={onClose} />
      <div className="dfg-sheet" role="dialog" aria-label={title}>
        <div className="dfg-shead">
          <h2>{title}</h2>
          <button className="dfg-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        {children}
      </div>
    </>
  );
}

function NewFolder({ parentName, onClose, onCreate }) {
  const [v, setV] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return (
    <Sheet title={parentName ? `${parentName} の下に` : "フォルダを作る"} onClose={onClose}>
      <div className="dfg-sbody">
        <input ref={ref} className="dfg-titleinput" value={v} placeholder="フォルダ名"
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onCreate(v); }} />
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={() => onCreate(v)} disabled={!v.trim()}>作る</button>
      </div>
    </Sheet>
  );
}

function FolderMenu({ folder, onRename, onCopy, onWall, onDraft, onAddChild, onSort, onMove, onDelete, onClose }) {
  const [v, setV] = useState(folder.title);
  return (
    <Sheet title="フォルダ" onClose={onClose}>
      <div className="dfg-sbody">
        <input className="dfg-titleinput" value={v} onChange={(e) => { setV(e.target.value); onRename(e.target.value); }} />
        <div className="dfg-label">できること</div>
        <button className="dfg-btn" data-block="1" data-key="1" onClick={onDraft}>下書きにする</button>
        <button className="dfg-btn" data-block="1" onClick={onWall}>付箋で並べる</button>
        <button className="dfg-btn" data-block="1" onClick={onCopy}>まとめてコピー</button>
        <button className="dfg-btn" data-block="1" onClick={onAddChild}>この下にフォルダを作る</button>
        <button className="dfg-btn" data-block="1" onClick={onMove}>別のフォルダの下に移す</button>
        <div className="dfg-label">中身を並べ直す</div>
        <div className="dfg-chips">
          <button className="dfg-chip" onClick={() => onSort("new")}>新しい順</button>
          <button className="dfg-chip" onClick={() => onSort("old")}>古い順</button>
        </div>
        <div className="dfg-label">消す</div>
        <button className="dfg-btn" data-block="1" data-warn="1" onClick={onDelete}>このフォルダを消す</button>
      </div>
    </Sheet>
  );
}

function TopicRows({ topics, current, onPick }) {
  const rows = useMemo(() => flatTopics(topics), [topics]);
  return (
    <>
      <button className="dfg-pickrow" data-on={!current ? "1" : "0"} onClick={() => onPick(null)}>
        <span className="dfg-mono">/</span>
      </button>
      {rows.map((r) => (
        <button key={r.topic.id} className="dfg-pickrow" data-on={current === r.topic.id ? "1" : "0"}
          style={{ paddingLeft: 10 + r.depth * 18 }} onClick={() => onPick(r.topic.id)}>
          <FolderIcon />{r.topic.title}
        </button>
      ))}
    </>
  );
}

function PickSheet({ title, topics, current, onPick, onClose }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="dfg-sbody">
        <TopicRows topics={topics} current={current} onPick={onPick} />
      </div>
    </Sheet>
  );
}

function Palette({ value, onPick }) {
  return (
    <div className="dfg-palette">
      {NOTE_COLORS.map((c) => (
        <button key={c.id} className="dfg-swatch" data-on={(value || "plain") === c.id ? "1" : "0"}
          style={{ background: c.bg, borderTopColor: c.edge }} onClick={() => onPick(c.id)} aria-label={c.id} />
      ))}
    </div>
  );
}

function CardView({ card, items, topics, onMove, onColor, onDelete }) {
  const [picking, setPicking] = useState(false);
  const near = useMemo(() => {
    const pool = [];
    items.forEach((it) => {
      if (it.id === card.id) return;
      flattenTexts(it).forEach((t) => pool.push(t));
    });
    const idf = buildIdf([card.text, ...pool]);
    const cv = vectorize(card.text, idf);
    return pool
      .map((t) => ({ text: t, s: cosine(cv, vectorize(t, idf)) }))
      .filter((e) => e.s > 0.05)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
  }, [card, items]);

  if (picking) {
    return (
      <div className="dfg-sbody">
        <TopicRows topics={topics} current={card.topicId} onPick={(tid) => { onMove(tid); setPicking(false); }} />
      </div>
    );
  }

  return (
    <>
      <div className="dfg-sbody">
        <div className="dfg-full">{card.text}</div>
        <div className="dfg-hint dfg-mono" style={{ marginTop: 14 }}>{absDate(card.createdAt, true)}</div>
        <div className="dfg-label">色</div>
        <Palette value={card.color} onPick={onColor} />
        <div className="dfg-label">いる場所</div>
        <button className="dfg-btn" data-block="1" onClick={() => setPicking(true)}>{pathLabel(topics, card.topicId)}</button>
        {near.length > 0 && (
          <>
            <div className="dfg-label">似ているかもしれないもの</div>
            {near.map((n, i) => <div className="dfg-sim" key={i}>{n.text}</div>)}
          </>
        )}
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-warn="1" onClick={onDelete}>捨てる</button>
      </div>
    </>
  );
}

function BundleView({ bundle, topics, onChange, onExport, onUnbundle, onPromote }) {
  const [picking, setPicking] = useState(false);
  const move = (i, dir) => {
    const next = bundle.children.slice();
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ children: next });
  };
  const drop = (i) => {
    const next = bundle.children.slice();
    next.splice(i, 1);
    onChange({ children: next });
  };

  if (picking) {
    return (
      <div className="dfg-sbody">
        <TopicRows topics={topics} current={bundle.topicId} onPick={(tid) => { onChange({ topicId: tid }); setPicking(false); }} />
      </div>
    );
  }

  return (
    <>
      <div className="dfg-sbody">
        <input className="dfg-titleinput" value={bundle.title} placeholder="この束は何の話か"
          onChange={(e) => onChange({ title: e.target.value })} />
        <div className="dfg-label">中身 — 上から順に書き出される</div>
        {bundle.children.map((c, i) => (
          <div className="dfg-child" key={c.id}>
            <p>{c.text}</p>
            <button className="dfg-mini" onClick={() => move(i, -1)} aria-label="上へ">↑</button>
            <button className="dfg-mini" onClick={() => move(i, 1)} aria-label="下へ">↓</button>
            <button className="dfg-mini" onClick={() => drop(i)} aria-label="外す">×</button>
          </div>
        ))}
        <div className="dfg-label">色</div>
        <Palette value={bundle.color} onPick={(c) => onChange({ color: c })} />
        <div className="dfg-label">いる場所</div>
        <button className="dfg-btn" data-block="1" onClick={() => setPicking(true)}>{pathLabel(topics, bundle.topicId)}</button>
        <div className="dfg-label">育ってきたら</div>
        <button className="dfg-btn" data-block="1" onClick={onPromote}>この束をフォルダにする</button>
      </div>
      <div className="dfg-sfoot">
        <button className="dfg-btn" data-quiet="1" onClick={onUnbundle}>束を解く</button>
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={onExport}>書き出す</button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* copy                                                                */
/* ------------------------------------------------------------------ */

function useCopy(text) {
  const [done, setDone] = useState(false);
  const ref = useRef(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { if (ref.current) ref.current.select(); }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };
  return { done, copy, ref };
}

function TopicCopy({ items, topics, topicId }) {
  const [md, setMd] = useState(true);
  const [dates, setDates] = useState(false);
  const [deep, setDeep] = useState(true);

  const text = useMemo(() => {
    const line = (t, ts) => (dates ? `${shortDate(ts)}  ${t}` : t);
    const renderItem = (it) => {
      if (it.kind === "bundle") {
        const head = it.title ? (md ? `**${it.title}**` : it.title) : "";
        const body = it.children.map((c) => line(c.text, c.createdAt)).join("\n\n");
        return head ? `${head}\n\n${body}` : body;
      }
      return line(it.text, it.createdAt);
    };
    const section = (tid, depth) => {
      const t = topics.find((x) => x.id === tid);
      if (!t) return "";
      const head = md ? `${"#".repeat(Math.min(depth + 1, 6))} ${t.title}` : t.title;
      const own = items.filter((i) => i.topicId === tid).map(renderItem).filter(Boolean);
      const parts = [head];
      if (own.length) parts.push(own.join("\n\n"));
      if (deep) childrenOf(topics, tid).forEach((c) => {
        const s = section(c.id, depth + 1);
        if (s) parts.push(s);
      });
      return parts.join("\n\n");
    };
    return section(topicId, 0);
  }, [items, topics, topicId, md, dates, deep]);

  const { done, copy, ref } = useCopy(text);
  const hasKids = childrenOf(topics, topicId).length > 0;

  return (
    <>
      <div className="dfg-sbody">
        <div className="dfg-chips">
          <button className="dfg-chip" data-on={md ? "1" : "0"} onClick={() => setMd((v) => !v)}>見出しをつける</button>
          <button className="dfg-chip" data-on={dates ? "1" : "0"} onClick={() => setDates((v) => !v)}>日付を入れる</button>
          {hasKids && <button className="dfg-chip" data-on={deep ? "1" : "0"} onClick={() => setDeep((v) => !v)}>子も含める</button>}
        </div>
        <textarea ref={ref} className="dfg-out" value={text} readOnly />
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={copy}>{done ? "コピーした" : "コピー"}</button>
      </div>
    </>
  );
}

function BundleExport({ bundle }) {
  const initial = useMemo(() => {
    const head = bundle.title ? bundle.title + "\n\n" : "";
    return head + bundle.children.map((c) => c.text).join("\n\n");
  }, [bundle]);
  const [text, setText] = useState(initial);
  const { done, copy, ref } = useCopy(text);
  return (
    <>
      <div className="dfg-sbody">
        <textarea ref={ref} className="dfg-out" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="dfg-sfoot">
        <span className="dfg-grow" />
        <button className="dfg-btn" data-key="1" onClick={copy}>{done ? "コピーした" : "コピー"}</button>
      </div>
    </>
  );
}
