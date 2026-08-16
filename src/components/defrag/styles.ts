/* defragの盤面スタイル。文字列のまま維持する(フレームワーク非導入の方針) */
export const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.dfg{
  --ground:#0F1117; --panel:#191C25; --raised:#232733; --line:#2C313D;
  --ink:#E4E2DC; --muted:#767C8C; --lamp:#E8A13A; --rail:#2A2F3B;
  position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;
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
