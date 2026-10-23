"use client";
import { useEffect, useRef, useState } from "react";

// ---------- missions ----------
type Mission = { name: string; brief: string; enemies: number; peekers: number; speed: number; ammo: number; sky: [string, string]; seed: number };
const MISSIONS: Mission[] = [
  { name: "黎明哨站", brief: "清除 3 个巡逻机器人", enemies: 3, peekers: 0, speed: 0.5, ammo: 8, sky: ["#f6b67a", "#6b8fc4"], seed: 3 },
  { name: "港口仓库", brief: "清除 4 个目标，小心掩体后的敌人", enemies: 3, peekers: 1, speed: 0.7, ammo: 9, sky: ["#ffd2a1", "#4d78b8"], seed: 7 },
  { name: "黄昏街区", brief: "清除 5 个目标", enemies: 3, peekers: 2, speed: 0.9, ammo: 10, sky: ["#ff9a6b", "#3b3f7a"], seed: 11 },
  { name: "雨夜工厂", brief: "清除 6 个目标", enemies: 4, peekers: 2, speed: 1.1, ammo: 11, sky: ["#41507a", "#141a33"], seed: 19 },
  { name: "月下要塞", brief: "清除 7 个目标，爆头更高分", enemies: 4, peekers: 3, speed: 1.3, ammo: 12, sky: ["#2a3566", "#070a1c"], seed: 29 },
];
const SAVE = "darien-sniper-v1";
type Save = { unlocked: number; best: number[]; muted: boolean };

function rng(seed: number) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// ---------- audio ----------
class Sfx {
  ctx: AudioContext | null = null; muted = false;
  init() { if (!this.ctx) try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch {} this.ctx?.resume(); }
  noise(dur: number, freq: number, gain: number, type: BiquadFilterType = "lowpass", delay = 0) {
    const c = this.ctx; if (!c || this.muted) return;
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination); src.start(c.currentTime + delay);
  }
  tone(f0: number, f1: number, dur: number, gain: number, type: OscillatorType = "sine", delay = 0) {
    const c = this.ctx; if (!c || this.muted) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur);
  }
  shot() { this.noise(0.5, 2500, 0.9); this.tone(140, 40, 0.35, 0.8); this.noise(1.2, 400, 0.25, "lowpass", 0.08); }
  bolt() { this.noise(0.05, 3000, 0.3, "highpass", 0.35); this.noise(0.06, 2200, 0.3, "highpass", 0.6); }
  hit() { this.tone(1800, 900, 0.18, 0.25, "triangle", 0.12); this.noise(0.1, 5000, 0.3, "highpass", 0.12); }
  head() { this.tone(2400, 2400, 0.08, 0.2, "square", 0.12); this.tone(3200, 3200, 0.12, 0.15, "square", 0.2); }
  miss() { this.noise(0.25, 900, 0.3, "bandpass", 0.15); }
  empty() { this.tone(900, 700, 0.05, 0.2, "square"); }
}

// ---------- world types ----------
type Enemy = { x: number; y: number; s: number; xmin: number; xmax: number; vx: number; peek: boolean; cover?: Rect; phase: number; alive: boolean; die: number; up: number; walk: number };
type Rect = { x: number; y: number; w: number; h: number; s: number };
type Building = { x: w; w: number; h: number; c: string; win: number[] };
type w = number;
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; r: number };
type Fx = { x: number; y: number; t: number; text?: string; c?: string };

export default function Game() {
  const cv = useRef<HTMLCanvasElement>(null);
  const [save, setSave] = useState<Save>({ unlocked: 1, best: [], muted: false });
  const [screen, setScreen] = useState<"menu" | "play" | "end">("menu");
  const [mi, setMi] = useState(0);
  const [hud, setHud] = useState({ ammo: 0, left: 0, score: 0, shots: 0, hits: 0, heads: 0 });
  const [result, setResult] = useState<{ win: boolean; score: number; acc: number; heads: number } | null>(null);
  const sfx = useRef(new Sfx());
  const game = useRef<any>(null);

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(SAVE) || "null"); if (s) setSave(s); } catch {} }, []);
  useEffect(() => { localStorage.setItem(SAVE, JSON.stringify(save)); sfx.current.muted = save.muted; }, [save]);

  const startMission = (i: number) => { sfx.current.init(); setMi(i); setScreen("play"); setResult(null); };

  useEffect(() => {
    if (screen !== "play") return;
    const canvas = cv.current!; const ctx = canvas.getContext("2d")!;
    const M = MISSIONS[mi]; const R = rng(M.seed);
    let W = 0, H = 0, dpr = 1;
    const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; };
    resize(); window.addEventListener("resize", resize);
    // layout in normalized units then scaled each frame (u = W, v = H)
    const horizon = 0.52;
    const mountains = Array.from({ length: 14 }, (_, i) => ({ x: i / 13, h: 0.06 + R() * 0.1 }));
    const buildings: Building[] = []; for (let x = -0.02; x < 1.02;) { const bw = 0.05 + R() * 0.08; buildings.push({ x, w: bw, h: 0.1 + R() * 0.22, c: `hsl(${210 + R() * 30},${15 + R() * 15}%,${18 + R() * 14}%)`, win: Array.from({ length: 40 }, () => R()) }); x += bw + 0.005; }
    // ground lanes: depth s from 0.45 (far) to 1 (near)
    const lanes = [{ y: 0.6, s: 0.45 }, { y: 0.7, s: 0.65 }, { y: 0.83, s: 0.9 }];
    const covers: Rect[] = [];
    const enemies: Enemy[] = [];
    for (let i = 0; i < M.enemies; i++) {
      const L = lanes[i % lanes.length]; const x0 = 0.1 + R() * 0.8;
      enemies.push({ x: x0, y: L.y, s: L.s, xmin: Math.max(0.05, x0 - 0.2), xmax: Math.min(0.95, x0 + 0.2), vx: (R() > 0.5 ? 1 : -1) * 0.03 * M.speed * (0.7 + R() * 0.6), peek: false, phase: R() * 6, alive: true, die: 0, up: 1, walk: 0 });
    }
    for (let i = 0; i < M.peekers; i++) {
      const L = lanes[(i + 1) % lanes.length]; const x = 0.15 + (i + 0.5) / M.peekers * 0.7 + (R() - 0.5) * 0.1;
      const c: Rect = { x: x - 0.05 * L.s, y: L.y - 0.07 * L.s * 1.25, w: 0.1 * L.s, h: 0.07 * L.s * 1.25, s: L.s }; covers.push(c);
      enemies.push({ x, y: L.y, s: L.s, xmin: x, xmax: x, vx: 0, peek: true, cover: c, phase: R() * 6, alive: true, die: 0, up: 0, walk: 0 });
    }
    // decorative crates
    for (let i = 0; i < 4; i++) { const L = lanes[i % 3]; const x = R(); covers.push({ x, y: L.y - 0.045 * L.s, w: 0.06 * L.s, h: 0.045 * L.s, s: L.s }); }
    covers.sort((a, b) => a.s - b.s);

    const st = {
      aim: { x: W / 2, y: H / 2 }, showScope: false, ammo: M.ammo, chamber: 0, recoil: 0, shake: 0, flash: 0, slow: 0, timeScale: 1,
      score: 0, shots: 0, hits: 0, heads: 0, parts: [] as Particle[], fx: [] as Fx[], tracer: null as null | { x: number; y: number; t: number }, over: false, t: 0,
    };
    // geometry helpers (screen px)
    const ePx = (e: Enemy) => { const h = 0.16 * H * e.s; const lift = e.peek ? (1 - e.up) * h * 0.75 : 0; return { x: e.x * W, foot: e.y * H + lift, h }; };
    const headOf = (e: Enemy) => { const p = ePx(e); return { x: p.x, y: p.foot - p.h * 0.86, r: p.h * 0.13 }; };
    const bodyOf = (e: Enemy) => { const p = ePx(e); return { x: p.x - p.h * 0.17, y: p.foot - p.h * 0.72, w: p.h * 0.34, h: p.h * 0.72 }; };
    const coverPx = (c: Rect) => ({ x: c.x * W, y: c.y * H, w: c.w * W, h: c.h * H });
    const inR = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const sway = () => ({ x: Math.sin(st.t * 0.9) * 5 + Math.sin(st.t * 2.3) * 2, y: Math.cos(st.t * 0.7) * 4 + Math.sin(st.t * 1.7) * 2 });
    (window as any).__sniper = { targets: () => enemies.filter(e => e.alive).map(e => ({ head: headOf(e), body: bodyOf(e), peek: e.peek, up: e.up })), state: () => ({ ammo: st.ammo, score: st.score, hits: st.hits, heads: st.heads, chamber: st.chamber }), sway };

    const burst = (x: number, y: number, n: number, c: string, sp: number) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random()); st.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: 0, max: 0.4 + Math.random() * 0.5, c, r: 1 + Math.random() * 2.5 }); } };
    const sync = () => setHud({ ammo: st.ammo, left: enemies.filter(e => e.alive).length, score: st.score, shots: st.shots, hits: st.hits, heads: st.heads });
    sync();

    const fire = (px: number, py: number) => {
      if (st.over) return;
      if (st.chamber > 0) return;
      if (st.ammo <= 0) { sfx.current.empty(); return; }
      const sw = sway(); const x = px + sw.x * 0.35, y = py + sw.y * 0.35; // sway applies (scaled to world)
      st.ammo--; st.shots++; st.chamber = 0.9; st.recoil = 1; st.shake = 1; st.flash = 1;
      st.tracer = { x, y, t: 0 }; sfx.current.shot(); sfx.current.bolt();
      // cover blocks first (frontmost)
      let target: Enemy | null = null, head = false;
      const alive = enemies.filter(e => e.alive).sort((a, b) => b.s - a.s);
      for (const e of alive) { const h = headOf(e); if (Math.hypot(x - h.x, y - h.y) <= h.r * 1.15) { target = e; head = true; break; } if (inR(x, y, bodyOf(e))) { target = e; break; } }
      const blocking = covers.find(c => inR(x, y, coverPx(c)) && (!target || c.s >= target.s - 0.0001));
      if (target && !blocking) {
        target.alive = false; target.die = 0.001; st.hits++; const pts = head ? 150 : 100; st.score += pts; if (head) st.heads++;
        st.slow = 0.9; burst(x, y, 40, head ? "#7ff" : "#ffd36b", 220); burst(x, y, 15, "#fff", 120);
        st.fx.push({ x, y, t: 0, text: head ? "爆头! +150" : "命中 +100", c: head ? "#6ff" : "#ffd36b" });
        sfx.current.hit(); if (head) sfx.current.head();
        // others on alert: speed up a bit
        enemies.forEach(e => (e.vx *= 1.1));
      } else {
        burst(x, y, 18, blocking ? "#c9a46b" : "#bba", 90); st.fx.push({ x, y, t: 0, text: "未命中", c: "#ddd" }); sfx.current.miss();
      }
      sync();
      const left = enemies.filter(e => e.alive).length;
      if (left === 0 || st.ammo === 0) setTimeout(() => {
        st.over = true; const win = enemies.every(e => !e.alive); const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
        const score = st.score + (win ? st.ammo * 50 : 0);
        setResult({ win, score, acc, heads: st.heads });
        if (win) setSave(s => { const best = [...s.best]; best[mi] = Math.max(best[mi] || 0, score); return { ...s, best, unlocked: Math.max(s.unlocked, Math.min(MISSIONS.length, mi + 2)) }; });
        setScreen("end");
      }, 1300);
    };
    game.current = { fire };

    // input: press shows scope, release fires (tap = shoot at point)
    const pos = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => { sfx.current.init(); st.aim = pos(e); st.showScope = true; };
    const move = (e: PointerEvent) => { st.aim = pos(e); if (e.pointerType === "mouse") st.showScope = true; };
    const up = (e: PointerEvent) => { st.aim = pos(e); fire(st.aim.x, st.aim.y); if (e.pointerType !== "mouse") setTimeout(() => (st.showScope = false), 700); };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up);

    // ---------- drawing ----------
    const drawRobot = (e: Enemy) => {
      const p = ePx(e); const h = p.h; const t = st.t;
      ctx.save(); ctx.translate(p.x, p.foot);
      if (!e.alive) { const k = Math.min(1, e.die / 0.8); ctx.globalAlpha = 1 - k; ctx.rotate(k * 1.3 * (e.vx >= 0 ? 1 : -1)); }
      const legSwing = e.peek ? 0 : Math.sin(e.walk) * h * 0.06;
      ctx.fillStyle = "#1f2433";
      ctx.fillRect(-h * 0.12 + legSwing, -h * 0.3, h * 0.09, h * 0.3); ctx.fillRect(h * 0.03 - legSwing, -h * 0.3, h * 0.09, h * 0.3);
      const g = ctx.createLinearGradient(-h * 0.2, 0, h * 0.2, 0); g.addColorStop(0, "#3a4258"); g.addColorStop(0.5, "#6c7899"); g.addColorStop(1, "#2a3042");
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-h * 0.17, -h * 0.72, h * 0.34, h * 0.44, h * 0.06); ctx.fill();
      ctx.fillStyle = "#ff8a3d"; ctx.fillRect(-h * 0.05, -h * 0.6, h * 0.1, h * 0.04); // chest light
      ctx.fillStyle = "#2a3042"; ctx.fillRect(h * 0.15, -h * 0.66, h * 0.22, h * 0.05); // rifle
      const hg = ctx.createRadialGradient(-h * 0.04, -h * 0.9, 1, 0, -h * 0.86, h * 0.14); hg.addColorStop(0, "#9aa6c4"); hg.addColorStop(1, "#30374d");
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -h * 0.86, h * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,${60 + 40 * Math.sin(t * 6)},60,1)`; ctx.shadowColor = "#f44"; ctx.shadowBlur = 8;
      ctx.fillRect(-h * 0.09, -h * 0.89, h * 0.18, h * 0.04); ctx.shadowBlur = 0;
      ctx.strokeStyle = "#30374d"; ctx.lineWidth = Math.max(1, h * 0.015); ctx.beginPath(); ctx.moveTo(h * 0.05, -h * 0.98); ctx.lineTo(h * 0.09, -h * 1.08); ctx.stroke();
      ctx.restore();
    };
    const drawCover = (c: Rect) => {
      const r = coverPx(c); const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, "#8a6a45"); g.addColorStop(1, "#4d3a26");
      ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = "#2e2216"; ctx.lineWidth = Math.max(1, r.h * 0.05); ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.moveTo(r.x + r.w, r.y); ctx.lineTo(r.x, r.y + r.h); ctx.stroke();
    };
    const night = M.seed > 15;
    const drawWorld = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, H * horizon); sky.addColorStop(0, M.sky[1]); sky.addColorStop(1, M.sky[0]);
      ctx.fillStyle = sky; ctx.fillRect(-W, -H, W * 3, H * 3);
      ctx.fillStyle = night ? "#fff8e0" : "#fff3c4"; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 40; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.16, H * 0.05, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = night ? "#1a2040" : "#7d86a8"; ctx.beginPath(); ctx.moveTo(-W, H * horizon);
      mountains.forEach(m => ctx.lineTo(m.x * W, H * (horizon - 0.12 - m.h))); ctx.lineTo(W * 2, H * horizon); ctx.fill();
      buildings.forEach(b => { const x = b.x * W, w = b.w * W, h = b.h * H, y = H * horizon - h; ctx.fillStyle = b.c; ctx.fillRect(x, y, w, h);
        let k = 0; for (let yy = y + 6; yy < y + h - 8; yy += 12) for (let xx = x + 4; xx < x + w - 6; xx += 10) { const on = b.win[k++ % 40] > (night ? 0.55 : 0.85); ctx.fillStyle = on ? "#ffd98a" : "rgba(0,0,0,.25)"; ctx.fillRect(xx, yy, 5, 6); } });
      const gr = ctx.createLinearGradient(0, H * horizon, 0, H); gr.addColorStop(0, night ? "#2b3040" : "#8c8a74"); gr.addColorStop(1, night ? "#15171f" : "#4c4a3c");
      ctx.fillStyle = gr; ctx.fillRect(-W, H * horizon, W * 3, H);
      lanes.forEach(l => { ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(-W, l.y * H, W * 3, 2); });
      // fence posts for depth
      ctx.fillStyle = "rgba(0,0,0,.35)"; for (let x = 0; x < W; x += 40) ctx.fillRect(x, H * horizon - 10, 3, 12);
      // depth-sorted enemies & covers
      const items: { s: number; d: () => void }[] = [];
      enemies.forEach(e => { if (e.alive || e.die < 0.8) items.push({ s: e.s - 0.001, d: () => drawRobot(e) }); });
      covers.forEach(c => items.push({ s: c.s, d: () => drawCover(c) }));
      items.sort((a, b) => a.s - b.s).forEach(i => i.d());
      st.parts.forEach(p => { ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
      if (night) { ctx.fillStyle = "rgba(10,15,40,.25)"; ctx.fillRect(-W, -H, W * 3, H * 3); }
    };

    let last = performance.now(), raf = 0;
    const loop = (now: number) => {
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      st.timeScale += ((st.slow > 0 ? 0.25 : 1) - st.timeScale) * 0.2; st.slow = Math.max(0, st.slow - dt);
      const gdt = dt * st.timeScale; st.t += dt;
      enemies.forEach(e => {
        if (!e.alive) { e.die += gdt; return; }
        if (e.peek) { const c = Math.sin(st.t * 0.8 + e.phase); e.up += ((c > 0.2 ? 1 : 0) - e.up) * Math.min(1, gdt * 4); }
        else { e.x += e.vx * gdt; e.walk += gdt * 8 * Math.abs(e.vx) / 0.03; if (e.x < e.xmin || e.x > e.xmax) { e.vx *= -1; e.x = Math.max(e.xmin, Math.min(e.xmax, e.x)); } }
      });
      st.parts.forEach(p => { p.life += gdt; p.x += p.vx * gdt; p.y += p.vy * gdt; p.vy += 300 * gdt; }); st.parts = st.parts.filter(p => p.life < p.max);
      st.fx.forEach(f => (f.t += dt)); st.fx = st.fx.filter(f => f.t < 1.2);
      if (st.chamber > 0) st.chamber = Math.max(0, st.chamber - dt);
      st.recoil *= Math.pow(0.02, dt); st.shake *= Math.pow(0.005, dt); st.flash = Math.max(0, st.flash - dt * 6);
      if (st.tracer) { st.tracer.t += dt; if (st.tracer.t > 0.15) st.tracer = null; }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sh = st.shake * 8; ctx.save(); ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      drawWorld(); ctx.restore();
      // dim overview
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(0, 0, W, H);
      // scope
      const sw = sway(); const R0 = Math.min(W, H) * 0.3; const Z = 2.6;
      const cx = st.aim.x, cy = st.aim.y - st.recoil * 40;
      if (st.showScope) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 7); ctx.clip();
        ctx.translate(cx, cy); ctx.scale(Z, Z); ctx.translate(-(st.aim.x + sw.x * 0.35), -(st.aim.y + sw.y * 0.35) + st.recoil * 25);
        drawWorld();
        if (st.tracer) { ctx.strokeStyle = `rgba(255,240,200,${1 - st.tracer.t / 0.15})`; ctx.lineWidth = 1.5 / Z; ctx.beginPath(); ctx.moveTo(st.tracer.x + 30, st.tracer.y + 60); ctx.lineTo(st.tracer.x, st.tracer.y); ctx.stroke(); }
        ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 7); ctx.clip();
        const vg = ctx.createRadialGradient(cx, cy, R0 * 0.6, cx, cy, R0); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.75)"); ctx.fillStyle = vg; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
        const lens = ctx.createLinearGradient(cx - R0, cy - R0, cx + R0, cy + R0); lens.addColorStop(0, "rgba(120,200,255,.10)"); lens.addColorStop(0.5, "rgba(255,255,255,0)"); ctx.fillStyle = lens; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
        ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(cx - R0, cy); ctx.lineTo(cx - 8, cy); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + R0, cy); ctx.moveTo(cx, cy - R0); ctx.lineTo(cx, cy - 8); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + R0); ctx.stroke();
        ctx.lineWidth = 5; [[-R0, -R0 * 0.55], [R0 * 0.55, R0], ].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(cx + a, cy); ctx.lineTo(cx + b, cy); ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(cx, cy + R0 * 0.55); ctx.lineTo(cx, cy + R0); ctx.stroke();
        ctx.lineWidth = 1; for (let i = 1; i <= 4; i++) { const d = i * R0 * 0.1; ctx.beginPath(); ctx.moveTo(cx - 4, cy + d); ctx.lineTo(cx + 4, cy + d); ctx.moveTo(cx + d, cy - 3); ctx.lineTo(cx + d, cy + 3); ctx.moveTo(cx - d, cy - 3); ctx.lineTo(cx - d, cy + 3); ctx.stroke(); }
        ctx.fillStyle = st.chamber > 0 ? "#888" : "#ff3b3b"; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 7); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#111"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R0 + 4, 0, 7); ctx.stroke();
        ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R0 + 9, 0, 7); ctx.stroke();
        if (st.chamber > 0) { ctx.strokeStyle = "#ffd36b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R0 + 14, -Math.PI / 2, -Math.PI / 2 + (1 - st.chamber / 0.9) * Math.PI * 2); ctx.stroke(); }
      } else {
        ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.moveTo(cx - 22, cy); ctx.lineTo(cx + 22, cy); ctx.moveTo(cx, cy - 22); ctx.lineTo(cx, cy + 22); ctx.stroke();
      }
      // hit markers / labels (screen space, mapped near scope center)
      st.fx.forEach(f => { const a = 1 - f.t / 1.2; const mx = st.showScope ? cx + (f.x - st.aim.x) * Z : f.x, my = st.showScope ? cy + (f.y - st.aim.y) * Z : f.y;
        if (f.text !== "未命中") { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3; const s = 10 + f.t * 6; ctx.beginPath(); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { ctx.moveTo(mx + sx * s * 0.5, my + sy * s * 0.5); ctx.lineTo(mx + sx * s, my + sy * s); }); ctx.stroke(); }
        ctx.globalAlpha = a; ctx.fillStyle = f.c!; ctx.font = "bold 20px system-ui"; ctx.textAlign = "center"; ctx.shadowColor = "#000"; ctx.shadowBlur = 6; ctx.fillText(f.text!, mx, my - 30 - f.t * 30); ctx.shadowBlur = 0; ctx.globalAlpha = 1; });
      if (st.flash > 0) { ctx.fillStyle = `rgba(255,220,150,${st.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
      if (st.slow > 0) { ctx.strokeStyle = `rgba(120,220,255,${Math.min(0.5, st.slow)})`; ctx.lineWidth = 12; ctx.strokeRect(0, 0, W, H); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); };
  }, [screen, mi]);

  const M = MISSIONS[mi];
  return (
    <div className="sn">
      {screen === "play" && <>
        <canvas ref={cv} className="sn-cv" data-testid="sniper-canvas" />
        <div className="sn-hud">
          <a href="/" className="sn-b">🏠</a>
          <div className="sn-info"><b>{M.name}</b><span>剩余目标 <i data-testid="left">{hud.left}</i></span></div>
          <div className="sn-info"><span>得分 <i data-testid="score">{hud.score}</i></span><span>命中率 {hud.shots ? Math.round((hud.hits / hud.shots) * 100) : 0}%</span></div>
          <button className="sn-b" onClick={() => setSave(s => ({ ...s, muted: !s.muted }))}>{save.muted ? "🔇" : "🔊"}</button>
        </div>
        <div className="sn-ammo">{Array.from({ length: MISSIONS[mi].ammo }, (_, i) => <span key={i} className={i < hud.ammo ? "" : "used"} />)}<em>{hud.ammo}</em></div>
        <div className="sn-tip">按住瞄准 · 松开射击 · 没有时间限制</div>
      </>}
      {screen === "menu" && <div className="sn-menu">
        <a href="/" className="sn-back">← Darien Games</a>
        <h1>暗夜狙击</h1><p className="sn-sub">SNIPER · 冷静呼吸，一击必中</p>
        <div className="sn-list">{MISSIONS.map((m, i) => <button key={i} disabled={i + 1 > save.unlocked} onClick={() => startMission(i)} data-testid={`mission-${i}`}>
          <b>任务 {i + 1} · {m.name}</b><small>{m.brief} · 弹药 {m.ammo}</small><em>{i + 1 > save.unlocked ? "🔒" : save.best[i] ? `最佳 ${save.best[i]}` : "▶"}</em></button>)}</div>
        <p className="sn-help">玩法：按住屏幕显示狙击镜，移动到目标上，松开即开火（电脑可直接点击）。瞄头部可爆头加分。准星会随呼吸轻微晃动，没有计时，弹药耗尽可重试。</p>
        <button className="sn-b" onClick={() => setSave(s => ({ ...s, muted: !s.muted }))}>{save.muted ? "🔇 已静音" : "🔊 音效开"}</button>
      </div>}
      {screen === "end" && result && <div className="sn-menu">
        <h1>{result.win ? "任务完成" : "弹药耗尽"}</h1>
        <div className="sn-res" data-testid="result"><div>得分<b>{result.score}</b></div><div>命中率<b>{result.acc}%</b></div><div>爆头<b>{result.heads}</b></div></div>
        {result.win && mi + 1 < MISSIONS.length && <button className="sn-go" onClick={() => startMission(mi + 1)}>下一个任务 ▶</button>}
        <button className="sn-go alt" onClick={() => startMission(mi)}>再来一次</button>
        <button className="sn-go alt" onClick={() => setScreen("menu")}>任务列表</button>
      </div>}
    </div>
  );
}
