"use client";
import { useEffect, useMemo, useState } from "react";
import { LEVELS } from "./levels";

type Cell = string | null;
type St = { board: Cell[]; slots: Cell[]; extra: boolean };
type Sel = { w: "b" | "s"; i: number } | null;
type Save = { level: number; maxLevel: number; coins: number; magnet: number; hint: number; slot: number };
const DEF: Save = { level: 1, maxLevel: 1, coins: 200, magnet: 2, hint: 3, slot: 2 };
const KEY = "darien-cjs-save-v2";
const PRICE = 100, BASE_SLOTS = 9, EXTRA = 9;

function shuffle<T>(a: T[]) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export default function Game() {
  const [save, setSave] = useState<Save>(DEF);
  const [loaded, setLoaded] = useState(false);
  const [st, setSt] = useState<St | null>(null);
  const [hist, setHist] = useState<St[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [magnetMode, setMagnetMode] = useState(false);
  const [hl, setHl] = useState<number[]>([]);
  const [win, setWin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) setSave({ ...DEF, ...s }); } catch {} setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(KEY, JSON.stringify(save)); }, [save, loaded]);

  const lv = LEVELS[Math.min(save.level, LEVELS.length) - 1];
  const W = lv.rows[0].length;
  const target = useMemo(() => lv.rows.join("").split(""), [lv]);
  const real = target.map(c => c !== ".");
  const total = real.filter(Boolean).length;

  const start = () => {
    const idx = target.map((c, i) => (c === "." ? -1 : i)).filter(i => i >= 0);
    let colors = shuffle(idx.map(i => target[i]));
    // keep it from starting too easy: re-shuffle if >25% already correct
    for (let k = 0; k < 20 && colors.filter((c, j) => c === target[idx[j]]).length > total * 0.25; k++) colors = shuffle(colors);
    const board: Cell[] = target.map(() => null); idx.forEach((i, j) => (board[i] = colors[j]));
    setSt({ board, slots: Array(BASE_SLOTS).fill(null), extra: false }); setHist([]); setSel(null); setWin(false); setHl([]);
    setHint("点选一颗宝石，再点目标位置：空位＝移动，有宝石＝交换");
  };
  useEffect(() => { if (loaded) start(); /* eslint-disable-next-line */ }, [lv, loaded]);

  const ok = (b: Cell[], i: number) => real[i] && b[i] === target[i];
  const commit = (n: St) => {
    setHist(h => [...h.slice(-50), st!]); setSt(n); setSel(null); setHl([]);
    if (n.board.every((c, i) => !real[i] || c === target[i])) {
      setWin(true); setSave(s => ({ ...s, coins: s.coins + 50 + lv.id * 10, maxLevel: Math.max(s.maxLevel, Math.min(lv.id + 1, LEVELS.length)) }));
    }
  };
  const get = (s: St, p: NonNullable<Sel>) => (p.w === "b" ? s.board[p.i] : s.slots[p.i]);

  const tap = (p: NonNullable<Sel>) => {
    if (!st || win) return;
    if (p.w === "b" && !real[p.i]) return;
    const v = get(st, p);
    if (p.w === "b" && ok(st.board, p.i)) { setHint("✨ 这颗已放对，已锁定"); return; }
    if (magnetMode) { if (v) useMagnet(v); return; }
    if (!sel) { if (v) { setSel(p); setHint(""); } return; }
    if (sel.w === p.w && sel.i === p.i) { setSel(null); return; }
    const a = get(st, sel);
    const board = [...st.board], slots = [...st.slots];
    const set = (q: NonNullable<Sel>, c: Cell) => (q.w === "b" ? (board[q.i] = c) : (slots[q.i] = c));
    set(sel, v); set(p, a);
    commit({ ...st, board, slots });
  };

  const useMagnet = (c: string) => {
    if (!st) return;
    const board = [...st.board], slots = [...st.slots];
    // sources: c jewels not on correct cells
    const src: NonNullable<Sel>[] = [
      ...board.map((x, i) => ({ w: "b" as const, i, x })).filter(o => o.x === c && target[o.i] !== c),
      ...slots.map((x, i) => ({ w: "s" as const, i, x })).filter(o => o.x === c),
    ];
    const dst = target.map((t, i) => i).filter(i => target[i] === c && board[i] !== c);
    dst.forEach((d, k) => { const s = src[k]; if (!s) return; const disp = board[d]; board[d] = c; if (s.w === "b") board[s.i] = disp; else slots[s.i] = disp; });
    setMagnetMode(false); setSave(s => ({ ...s, magnet: s.magnet - 1 })); setHint("🧲 该颜色已全部归位");
    commit({ ...st, board, slots });
  };

  const showHint = () => {
    if (!st) return;
    for (let i = 0; i < st.board.length; i++) {
      if (!real[i] || ok(st.board, i)) continue;
      const need = target[i];
      const s = st.slots.findIndex(x => x === need);
      if (s >= 0) { setHl([i, -1 - s]); setHint("提示：把高亮的暂存宝石放到高亮格子"); return true; }
      const j = st.board.findIndex((x, k) => x === need && !ok(st.board, k));
      if (j >= 0) { setHl([i, j]); setHint("提示：交换两颗高亮宝石"); return true; }
    }
    return false;
  };

  const boost = (k: "magnet" | "hint" | "slot") => {
    if (!st || win) return;
    if (save[k] <= 0) { if (save.coins < PRICE) { setHint("金币不足"); return; } setSave(s => ({ ...s, coins: s.coins - PRICE, [k]: s[k] + 1 })); setHint("已购买道具 -100 金币"); return; }
    if (k === "slot") { if (st.extra) { setHint("额外暂存位已开启"); return; } setSave(s => ({ ...s, slot: s.slot - 1 })); commit({ ...st, extra: true, slots: [...st.slots, ...Array(EXTRA).fill(null)] }); setHint("已增加 9 个暂存位"); return; }
    if (k === "hint") { if (showHint()) setSave(s => ({ ...s, hint: s.hint - 1 })); return; }
    setSel(null); setMagnetMode(m => !m); setHint("磁铁：点任意一颗宝石，该颜色全部自动归位");
  };
  const undo = () => { if (!hist.length) return; setSt(hist[hist.length - 1]); setHist(h => h.slice(0, -1)); setSel(null); setHl([]); setHint("已撤销"); };

  if (!st) return <div className="app" />;
  const done = st.board.filter((c, i) => ok(st.board, i)).length;
  const pct = Math.floor((done / total) * 100);
  const isSel = (w: string, i: number) => sel && sel.w === w && sel.i === i;

  return (
    <div className="app">
      <div className="top">
        <button className="pill" onClick={() => setMenu(true)}>Lv {lv.id}</button>
        <a className="pill" href="/" style={{ textDecoration: "none" }}>🏠</a>
        <div className="title">Color Jewel Sort · {lv.name}</div>
        <div className="pill coin"><i />{save.coins}</div>
      </div>
      <div className="barrow"><div className="bar"><div style={{ width: pct + "%" }} /></div><span data-testid="pct">{pct}%</span></div>
      <div className="board" style={{ gridTemplateColumns: `repeat(${W},1fr)` }}>
        {target.map((t, i) => !real[i] ? <div key={i} /> :
          <div key={i} data-cell={i} data-target={t} data-color={st.board[i] || ""} className={`base ${hl.includes(i) ? "hl" : ""}`} style={{ ["--t" as string]: lv.palette[t] }} onClick={() => tap({ w: "b", i })}>
            {st.board[i] && <div className={`gem bead ${ok(st.board, i) ? "right" : ""} ${isSel("b", i) ? "sel" : ""}`} style={{ ["--c" as string]: lv.palette[st.board[i]!] }} />}
          </div>)}
      </div>
      <div className="hint">{hint}</div>
      <div className="trayarea">
        {Array.from({ length: st.slots.length / 9 }, (_, g) => <div key={g} className="tray9">
          {st.slots.slice(g * 9, g * 9 + 9).map((c, k) => { const i = g * 9 + k; return <div key={i} data-slot={i} data-color={c || ""} className={`sl ${hl.includes(-1 - i) ? "hl" : ""}`} onClick={() => tap({ w: "s", i })}>
            {c && <div className={`gem bead ${isSel("s", i) ? "sel" : ""}`} style={{ ["--c" as string]: lv.palette[c] }} />}</div>; })}
        </div>)}
        {!st.extra && <div className="tray9 locked" onClick={() => boost("slot")}>➕<br />额外暂存</div>}
      </div>
      <div className="boost">
        <button className="bt" onClick={() => boost("slot")}>🧺<span>{save.slot || "+"}</span><small>加暂存</small></button>
        <button className={`bt ${magnetMode ? "on" : ""}`} onClick={() => boost("magnet")}>🧲<span>{save.magnet || "+"}</span><small>磁铁</small></button>
        <button className="bt" onClick={() => boost("hint")}>💡<span>{save.hint || "+"}</span><small>提示</small></button>
      </div>
      <div className="row">
        <button className="btn gray" onClick={undo}>↩️ 撤销</button>
        <button className="btn gray" onClick={start}>🔄 重来</button>
      </div>
      {win && <div className="modal"><div className="card" data-testid="win">
        <h2>🎉 完成！</h2><p>「{lv.name}」拼好啦 · 获得 {50 + lv.id * 10} 金币</p>
        {lv.id < LEVELS.length ? <button className="btn" onClick={() => setSave(s => ({ ...s, level: lv.id + 1 }))}>下一关 ▶</button>
          : <><p>全部关卡通关！</p><button className="btn" onClick={() => setSave(s => ({ ...s, level: 1 }))}>回到第一关</button></>}
      </div></div>}
      {menu && <div className="modal" onClick={() => setMenu(false)}><div className="card" onClick={e => e.stopPropagation()}>
        <h3>选择关卡</h3>
        <div className="grid">{LEVELS.map(l => <button key={l.id} className="lv" disabled={l.id > save.maxLevel} onClick={() => { setSave(s => ({ ...s, level: l.id })); setMenu(false); }}>{l.id}</button>)}</div>
        <p style={{ fontSize: 12, color: "#777" }}>规则：画面一开始铺满打乱的宝石，每格底色是它该放的颜色。点选宝石再点目标：空位＝移动，有宝石＝交换。可借助下方暂存位中转。放对的宝石会发光并锁定。全部归位即过关，没有计时。</p>
        <button className="btn gray" onClick={() => setMenu(false)}>关闭</button>
      </div></div>}
    </div>
  );
}
