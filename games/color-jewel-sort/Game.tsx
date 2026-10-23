"use client";
import { useEffect, useMemo, useState } from "react";
import { LEVELS } from "./levels";

type Tray = (string | null)[];
type St = { filled: boolean[]; slots: (Tray | null)[]; queue: string[]; extra: boolean; shelf: string[] };
const SHELF = 7;
type Save = { level: number; maxLevel: number; coins: number; magnet: number; brush: number; slot: number };
const DEF: Save = { level: 1, maxLevel: 1, coins: 200, magnet: 2, brush: 2, slot: 2 };
const KEY = "variant-cjs-save-v1";
const PRICE = 100;

function shuffle<T>(a: T[]) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function take(q: string[]): [Tray | null, string[]] { if (!q.length) return [null, q]; const t: Tray = q.slice(0, 9); while (t.length < 9) t.push(null); return [t, q.slice(9)]; }

export default function Game() {
  const [save, setSave] = useState<Save>(DEF);
  const [loaded, setLoaded] = useState(false);
  const [st, setSt] = useState<St | null>(null);
  const [hist, setHist] = useState<St[]>([]);
  const [magnetMode, setMagnetMode] = useState(false);
  const [brushMode, setBrushMode] = useState(false);
  const [win, setWin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) setSave({ ...DEF, ...s }); } catch {} setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(save)); }, [save, loaded]);

  const lv = LEVELS[Math.min(save.level, LEVELS.length) - 1];
  const W = lv.rows[0].length, H = lv.rows.length;
  const cells = useMemo(() => lv.rows.join("").split(""), [lv]);

  const start = () => {
    const need = cells.filter(c => c !== ".");
    let q = shuffle(need); const slots: (Tray | null)[] = [];
    for (let i = 0; i < 3; i++) { if (i < 2) { const [t, r] = take(q); slots.push(t); q = r; } else slots.push(null); }
    setSt({ filled: cells.map(c => c === "."), slots, queue: q, extra: false, shelf: [] }); setHist([]); setWin(false); setHint("点击下方托盘，豆子会飞到画上可放置的位置");
  };
  useEffect(() => { if (loaded) start(); /* eslint-disable-next-line */ }, [lv, loaded]);

  const isOpen = (f: boolean[], i: number) => {
    const x = i % W, y = Math.floor(i / W);
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) return true;
    return [i - 1, i + 1, i - W, i + W].some(j => f[j] && cells[j] !== ".");
  };
  const openCount = (s: St) => (s.extra ? 3 : 2);
  const refill = (s: St): St => {
    const slots = [...s.slots]; let q = s.queue;
    for (let i = 0; i < openCount(s); i++) if (!slots[i] || slots[i]!.every(b => !b)) { const [t, r] = take(q); slots[i] = t; q = r; }
    return { ...s, slots, queue: q };
  };
  const canMove = (s: St) => s.shelf.length < SHELF || s.shelf.some(b => s.filled.some((f, i) => !f && cells[i] === b && isOpen(s.filled, i))) || s.slots.some(t => t && t.some(b => b && s.filled.some((f, i) => !f && cells[i] === b && isOpen(s.filled, i))));
  const commit = (n: St) => {
    setHist(h => [...h.slice(-30), st!]);
    n = refill(n); setSt(n);
    if (n.filled.every(Boolean)) { setWin(true); setSave(s => ({ ...s, coins: s.coins + 50 + lv.id * 10, maxLevel: Math.max(s.maxLevel, Math.min(lv.id + 1, LEVELS.length)) })); return; }
    setHint(canMove(n) ? "" : "暂存架满了～试试「洗牌」、撤销或道具（不会失败哦）");
  };

  const tapTray = (k: number) => {
    if (!st || win) return;
    const t = st.slots[k]; if (!t) return;
    if (brushMode) {
      const beads = t.filter(Boolean) as string[]; const slots = [...st.slots]; slots[k] = null;
      setBrushMode(false); setSave(s => ({ ...s, brush: s.brush - 1 }));
      commit({ ...st, slots, queue: [...st.queue, ...shuffle(beads)] }); return;
    }
    if (magnetMode) return;
    const f = [...st.filled]; const tray = [...t]; let moved = true, n = 0;
    while (moved) { moved = false;
      for (let b = 0; b < 9; b++) { const c = tray[b]; if (!c) continue;
        const i = f.findIndex((v, j) => !v && cells[j] === c && isOpen(f, j));
        if (i >= 0) { f[i] = true; tray[b] = null; moved = true; n++; } } }
    if (!n) { setHint("这个托盘暂时没有能放的位置"); return; }
    const slots = [...st.slots]; slots[k] = tray; commit({ ...st, filled: f, slots });
  };
  const spot = (f: boolean[], c: string) => f.findIndex((v, j) => !v && cells[j] === c && isOpen(f, j));
  const tapGem = (k: number, b: number) => {
    if (!st || win) return; const c = st.slots[k]?.[b]; if (!c) return;
    const f = [...st.filled]; const slots = st.slots.map(t => t && [...t]); slots[k]![b] = null;
    const i = spot(f, c); let shelf = st.shelf;
    if (i >= 0) f[i] = true; else { if (shelf.length >= SHELF) { setHint("暂存架已满"); return; } shelf = [...shelf, c]; }
    // shelf gems auto-drop when a spot opens
    let m = true; while (m) { m = false; for (let s2 = 0; s2 < shelf.length; s2++) { const j = spot(f, shelf[s2]); if (j >= 0) { f[j] = true; shelf = shelf.filter((_, x) => x !== s2); m = true; break; } } }
    commit({ ...st, filled: f, slots, shelf });
  };
  const useMagnet = (c: string) => {
    if (!st) return;
    const f = st.filled.map((v, i) => v || cells[i] === c);
    const slots = st.slots.map(t => t && t.map(b => (b === c ? null : b)));
    setMagnetMode(false); setSave(s => ({ ...s, magnet: s.magnet - 1 }));
    commit({ ...st, filled: f, slots, shelf: st.shelf.filter(b => b !== c), queue: st.queue.filter(b => b !== c) });
  };
  const doShuffle = () => {
    if (!st) return;
    const all = shuffle([...st.shelf, ...st.slots.flatMap(t => (t || []).filter(Boolean) as string[]), ...st.queue]);
    // put playable beads first so a shuffle always helps
    const playable = new Set(cells.filter((c, i) => !st.filled[i] && isOpen(st.filled, i)));
    const q = [...all.filter(b => playable.has(b)), ...all.filter(b => !playable.has(b))];
    commit({ ...st, shelf: [], slots: st.slots.map(() => null), queue: q });
  };
  const boost = (k: "magnet" | "brush" | "slot") => {
    if (!st) return;
    if (save[k] <= 0) { if (save.coins < PRICE) { setHint("金币不足"); return; } setSave(s => ({ ...s, coins: s.coins - PRICE, [k]: s[k] + 1 })); setHint("已购买道具 -100 金币"); return; }
    if (k === "slot") { if (st.extra) { setHint("额外托盘已开启"); return; } setSave(s => ({ ...s, slot: s.slot - 1 })); commit({ ...st, extra: true }); return; }
    if (k === "magnet") { setBrushMode(false); setMagnetMode(m => !m); setHint("磁铁：点一颗托盘里的豆子，画上该颜色全部填满"); }
    else { setMagnetMode(false); setBrushMode(m => !m); setHint("刷子：点一个托盘，把它清空（豆子回到队列）"); }
  };
  const undo = () => { if (!hist.length) return; setSt(hist[hist.length - 1]); setHist(h => h.slice(0, -1)); setHint("已撤销"); };

  if (!st) return <div className="app" />;
  const done = st.filled.filter((v, i) => v && cells[i] !== ".").length, total = cells.filter(c => c !== ".").length;
  const pct = Math.floor((done / total) * 100);

  return (
    <div className="app">
      <div className="top">
        <button className="pill" onClick={() => setMenu(true)}>Lv {lv.id}</button>
        <a className="pill" href="/" style={{textDecoration:"none"}}>🏠</a><div className="title">Color Jewel Sort · {lv.name}</div>
        <div className="pill coin"><i />{save.coins}</div>
      </div>
      <div className="barrow"><div className="bar"><div style={{ width: pct + "%" }} /></div>{pct}%</div>
      <div className="board" style={{ gridTemplateColumns: `repeat(${W},1fr)` }}>
        {cells.map((c, i) => c === "." ? <div key={i} /> :
          <div key={i} className={`cell bead ${st.filled[i] ? "filled" : "empty"} ${!st.filled[i] && isOpen(st.filled, i) ? "open" : ""}`} style={{ ["--c" as string]: lv.palette[c] }} />)}
      </div>
      <div className="hint">{hint}</div>
      <div className="slots">
        {[0, 1, 2].map(k => {
          if (k === 2 && !st.extra) return <div key={k} className="slot locked" onClick={() => boost("slot")}>➕<br />额外托盘</div>;
          const t = st.slots[k];
          return <div key={k} className={`slot ${brushMode ? "sel" : ""}`} onClick={() => tapTray(k)}>
            {(t || Array(9).fill(null)).map((b, j) => b ? <div key={j} className="bead" style={{ ["--c" as string]: lv.palette[b], borderRadius: "50%", outline: magnetMode ? "2px solid #ff8a00" : "" }} onClick={e => { if (brushMode) return; e.stopPropagation(); if (magnetMode) useMagnet(b); else tapGem(k, j); }} /> : <div key={j} className="hole" />)}
          </div>;
        })}
      </div>
      <div className="shelf">{Array.from({ length: SHELF }, (_, i) => st.shelf[i] ? <div key={i} className="bead sg" style={{ ["--c" as string]: lv.palette[st.shelf[i]] }} /> : <div key={i} className="sg hole" />)}</div>
      <div className="queue">剩余托盘：{Math.ceil(st.queue.length / 9)}</div>
      <div className="boost">
        <button className="bt" onClick={() => boost("slot")}>🧺<span>{save.slot || "+"}</span><small>加托盘</small></button>
        <button className={`bt ${magnetMode ? "on" : ""}`} onClick={() => boost("magnet")}>🧲<span>{save.magnet || "+"}</span><small>磁铁</small></button>
        <button className={`bt ${brushMode ? "on" : ""}`} onClick={() => boost("brush")}>🖌️<span>{save.brush || "+"}</span><small>刷子</small></button>
      </div>
      <div className="row">
        <button className="btn gray" onClick={undo}>↩️ 撤销</button>
        <button className="btn" onClick={doShuffle}>🔀 洗牌</button>
        <button className="btn gray" onClick={start}>🔄 重来</button>
      </div>
      {win && <div className="modal"><div className="card">
        <h2>🎉 完成！</h2><p>「{lv.name}」拼好啦 · 获得 {50 + lv.id * 10} 金币</p>
        {lv.id < LEVELS.length ? <button className="btn" onClick={() => setSave(s => ({ ...s, level: lv.id + 1 }))}>下一关 ▶</button>
          : <><p>全部关卡通关！</p><button className="btn" onClick={() => setSave(s => ({ ...s, level: 1 }))}>回到第一关</button></>}
      </div></div>}
      {menu && <div className="modal" onClick={() => setMenu(false)}><div className="card" onClick={e => e.stopPropagation()}>
        <h3>选择关卡</h3>
        <div className="grid">{LEVELS.map(l => <button key={l.id} className="lv" disabled={l.id > save.maxLevel} onClick={() => { setSave(s => ({ ...s, level: l.id })); setMenu(false); }}>{l.id}</button>)}</div>
        <p style={{ fontSize: 12, color: "#777" }}>规则：点一颗宝石，它会放到画上同色且「靠边或挨着已放宝石」的位置（亮圈）；暂时没位置就进入暂存架（7格），有位置时自动落下。点托盘空白处＝整盘尝试放置。卡住时可洗牌/撤销，永不失败、没有计时。</p>
        <button className="btn gray" onClick={() => setMenu(false)}>关闭</button>
      </div></div>}
    </div>
  );
}
