/* kochi-motion.js — tiny, dependency-free, time-pure animation helpers.
 *
 * Contract every scene follows:
 *   - Every frame is a pure function of time: render(t) must give the same picture
 *     for the same t. No CSS transitions, no setTimeout, no unseeded Math.random.
 *   - The renderer calls window.seek(t) with t = frame / 12 (12 poses per second).
 *   - KM.mount({duration, width, height, render}) wires up window.seek,
 *     window.SCENE and window.sceneReady (fonts loaded) for render.mjs,
 *     and a 12 fps preview player when the file is opened in a browser.
 */
(function (global) {
  'use strict';
  const KM = {};
  KM.FPS = 12;

  // ---------- basics ----------
  KM.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  KM.lerp = (a, b, p) => a + (b - a) * p;
  KM.mix = (a, b, p) => Array.isArray(a) ? a.map((v, i) => KM.lerp(v, b[i], p)) : KM.lerp(a, b, p);
  KM.loop = (t, period) => ((t % period) + period) % period / period; // 0..1 sawtooth
  KM.pingpong = (t, period) => { const p = KM.loop(t, period) * 2; return p < 1 ? p : 2 - p; };
  KM.deg = (r) => r * 180 / Math.PI;
  KM.rad = (d) => d * Math.PI / 180;

  // Quantise time to a frame grid. snap(t, 12) = poses on ones at 12 fps;
  // snap(t, 6) = poses on twos at 12 fps (for a deliberately choppier, hand-made feel).
  KM.snap = (t, fps = KM.FPS) => Math.floor(t * fps + 1e-6) / fps;

  // ---------- easing ----------
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (u) => ((ax * u + bx) * u + cx) * u;
    const sy = (u) => ((ay * u + by) * u + cy) * u;
    const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
    return (x) => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let u = x;
      for (let i = 0; i < 8; i++) { const e = sx(u) - x; const d = dx(u); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; u -= e / d; }
      let lo = 0, hi = 1; // bisection fallback
      if (Math.abs(sx(u) - x) > 1e-4) { u = x; for (let i = 0; i < 30; i++) { const v = sx(u); if (v < x) lo = u; else hi = u; u = (lo + hi) / 2; } }
      return sy(u);
    };
  }
  KM.cubicBezier = cubicBezier;
  const E = {
    linear: (p) => p,
    inQuad: (p) => p * p, outQuad: (p) => 1 - (1 - p) * (1 - p),
    inOutQuad: (p) => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2,
    inCubic: (p) => p * p * p, outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inOutCubic: (p) => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
    outQuart: (p) => 1 - Math.pow(1 - p, 4),
    inOutQuart: (p) => p < .5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2,
    outExpo: (p) => p === 1 ? 1 : 1 - Math.pow(2, -10 * p),
    inExpo: (p) => p === 0 ? 0 : Math.pow(2, 10 * p - 10),
    inOutExpo: (p) => p === 0 ? 0 : p === 1 ? 1 : p < .5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2,
    inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    outSine: (p) => Math.sin(p * Math.PI / 2),
    outBack: (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
    inBack: (p, s = 1.70158) => (s + 1) * p * p * p - s * p * p,
    // Named motion-design curves (CSS-style cubic-beziers)
    standard: cubicBezier(0.4, 0.0, 0.2, 1),     // general UI move
    decel: cubicBezier(0.0, 0.0, 0.2, 1),        // things entering
    accel: cubicBezier(0.4, 0.0, 1, 1),          // things leaving
    snappy: cubicBezier(0.7, 0, 0.15, 1),        // fast-in / long settle, explainer pops
    swoosh: cubicBezier(0.85, 0, 0.15, 1),       // wipes and big transitions
  };
  KM.ease = E;
  const getEase = (e) => typeof e === 'function' ? e : (E[e] || E.linear);

  // ---------- tweens ----------
  // progress(t, t0, t1, ease) -> eased 0..1, clamped
  KM.progress = (t, t0, t1, ease = 'standard') => getEase(ease)(KM.clamp((t - t0) / Math.max(1e-6, t1 - t0)));
  KM.tween = (t, t0, t1, a, b, ease = 'standard') => KM.mix(a, b, KM.progress(t, t0, t1, ease));

  // keys(t, [[time, value, easeIntoThisKey?], ...]) piecewise; values: number or array
  KM.keys = (t, ks) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) {
        const [t0, v0] = ks[i - 1], [t1, v1, e] = ks[i];
        return KM.mix(v0, v1, getEase(e || 'inOutSine')(KM.clamp((t - t0) / (t1 - t0))));
      }
    }
    return ks[ks.length - 1][1];
  };

  // Damped spring step response, 0 -> 1, starting at t0. Analytic (pure function of t).
  // Defaults give a lively ~0.6 s settle with one visible overshoot.
  KM.spring = (t, t0 = 0, { stiffness = 170, damping = 14, mass = 1 } = {}) => {
    const x = t - t0; if (x <= 0) return 0;
    const w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * x) * (Math.cos(wd * x) + (z * w0 / wd) * Math.sin(wd * x)); }
    return 1 - Math.exp(-w0 * x) * (1 + w0 * x);
  };
  KM.springTo = (t, t0, a, b, opts) => KM.mix(a, b, KM.spring(t, t0, opts));

  // ---------- seeded randomness ----------
  KM.rng = (seed = 1) => { let s = seed >>> 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let r = Math.imul(s ^ s >>> 15, 1 | s); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; }; };
  const hash = (i, seed) => { let h = (i * 374761393 + seed * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // smooth 1-D value noise in [-1, 1]
  KM.noise = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (KM.lerp(hash(i, seed), hash(i + 1, seed), u)) * 2 - 1; };
  KM.wiggle = (t, freq = 1, amp = 1, seed = 0) => KM.noise(t * freq, seed) * amp;

  // ---------- character helpers ----------
  // Blink: returns eye openness 1 (open) .. 0 (closed). Blinks every ~3-4 s, 2 frames closed at 12 fps.
  KM.blink = (t, seed = 0, every = 3.4) => {
    const r = KM.rng(seed + 99); const offs = r() * every;
    const local = ((t + offs) % every);
    return local < 1 / 12 ? 0.15 : local < 2 / 12 ? 0 : local < 3 / 12 ? 0.6 : 1;
  };
  // Idle breathing: 0..1 sine, ~3.5 s cycle
  KM.breathe = (t, period = 3.6, phase = 0) => (Math.sin((t / period + phase) * Math.PI * 2) + 1) / 2;

  // Two-joint IK (arm or leg). Shoulder (sx,sy) -> target (tx,ty), segment lengths l1,l2.
  // bend = +1 or -1 picks which way the elbow/knee points. Returns absolute directions in degrees
  // (SVG convention: 0 = +x, 90 = down, clockwise positive) for the upper and lower segment.
  // For big reaches, animate the TARGET POINT over time and solve each frame; never blend the angles
  // of two far-apart poses directly (the in-betweens swing through odd poses).
  KM.ik2 = (sx, sy, tx, ty, l1, l2, bend = 1) => {
    const dx = tx - sx, dy = ty - sy;
    const d = KM.clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const base = Math.atan2(dy, dx);
    const A = Math.acos(KM.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const a1 = base - bend * A;
    const ex = sx + Math.cos(a1) * l1, ey = sy + Math.sin(a1) * l1;
    const a2 = Math.atan2(ty - ey, tx - ex);
    return { a1: KM.deg(a1), a2: KM.deg(a2), elbow: [ex, ey] };
  };

  // ---------- SVG helpers ----------
  KM.$ = (sel, root = document) => root.querySelector(sel);
  KM.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  KM.set = (el, attrs) => { if (typeof el === 'string') el = KM.$(el); if (!el) return; for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
  KM.tf = (el, { x = 0, y = 0, r = 0, s = 1, sx, sy, ox = 0, oy = 0 } = {}) => {
    if (typeof el === 'string') el = KM.$(el); if (!el) return;
    const SX = sx ?? s, SY = sy ?? s;
    el.setAttribute('transform', `translate(${x + ox} ${y + oy}) rotate(${r}) scale(${SX} ${SY}) translate(${-ox} ${-oy})`);
  };
  KM.style = (el, props) => { if (typeof el === 'string') el = KM.$(el); if (!el) return; for (const k in props) el.style[k] = props[k]; };

  // ---------- text (Arabic-safe) ----------
  // Never animate Arabic per letter: it breaks joined letter forms. Animate whole words or lines.
  // splitWords wraps each space-separated word in a masked inline-block; the browser still
  // shapes every word as a unit and lays the words out right-to-left when dir="rtl".
  KM.splitWords = (el) => {
    if (typeof el === 'string') el = KM.$(el);
    if (el.dataset.split) return KM.$$('.km-wi', el);
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((w, i) => {
      const o = document.createElement('span'); o.className = 'km-w';
      o.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding:0.12em 0.04em 0.28em;margin:-0.12em -0.04em -0.28em';
      const inner = document.createElement('span'); inner.className = 'km-wi'; inner.style.display = 'inline-block';
      inner.textContent = w; o.append(inner); el.append(o);
      if (i < words.length - 1) el.append(document.createTextNode(' '));
    });
    el.dataset.split = '1';
    return KM.$$('.km-wi', el);
  };
  // Word-by-word rise through a mask. In RTL text the first word (rightmost) goes first.
  KM.revealWords = (el, t, t0, { stagger = 0.12, dur = 0.5, ease = 'snappy', dist = 1.7, out = null } = {}) => {
    const ws = KM.splitWords(el);
    ws.forEach((w, i) => {
      const p = KM.progress(t, t0 + i * stagger, t0 + i * stagger + dur, ease);
      let y = (1 - p) * dist;
      if (out) y -= KM.progress(t, out + i * stagger * 0.5, out + i * stagger * 0.5 + dur * 0.8, 'accel') * dist;
      w.style.transform = `translateY(${y.toFixed(4)}em)`;
    });
  };
  // Whole-line wipe that follows reading direction (right->left for RTL, left->right for LTR).
  KM.wipeLine = (el, p, rtl = true) => {
    if (typeof el === 'string') el = KM.$(el);
    const hidden = ((1 - KM.clamp(p)) * 100).toFixed(3) + '%';
    el.style.clipPath = rtl ? `inset(-20% 0 -20% ${hidden})` : `inset(-20% ${hidden} -20% 0)`;
  };

  // ---------- URL params ----------
  const qs = new URLSearchParams(global.location ? global.location.search : '');
  KM.param = (k, d) => qs.has(k) ? qs.get(k) : d;
  KM.isRender = qs.has('render');

  // ---------- mount ----------
  KM.mount = ({ duration, width = 1080, height = 1920, fps = KM.FPS, render, fonts = [] }) => {
    width = +KM.param('w', width); height = +KM.param('h', height);
    global.SCENE = { duration, width, height, fps };
    global.seek = (t) => { render(KM.clamp(t, 0, duration)); return true; };
    // load each face for BOTH Arabic and Latin subsets (sample text forces the right unicode-range files)
    const fontLoads = fonts.map((f) => document.fonts.load(f, 'أبجد هوز KOCHI 0123').catch(() => null));
    global.sceneReady = Promise.all(fontLoads).then(() => document.fonts.ready).then(() => { global.seek(0); return true; });
    if (!KM.isRender) global.sceneReady.then(() => KM.player(duration, fps));
    return global.SCENE;
  };

  // Preview player: plays at 12 fps exactly like the render. Space = play/pause, arrows = frame step.
  KM.player = (duration, fps) => {
    let frame = 0, playing = true, last = performance.now(), acc = 0;
    const n = Math.round(duration * fps);
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:28px;background:#0009;color:#fff;font:12px monospace;display:flex;align-items:center;gap:8px;padding:0 8px;z-index:9999';
    const range = document.createElement('input'); range.type = 'range'; range.min = 0; range.max = n - 1; range.style.flex = '1';
    const lab = document.createElement('span'); bar.append(lab, range); document.body.append(bar);
    const show = () => { global.seek(frame / fps); range.value = frame; lab.textContent = `${(frame / fps).toFixed(2)}s  f${frame}/${n - 1}  @${fps}fps`; };
    range.oninput = () => { frame = +range.value; playing = false; show(); };
    addEventListener('keydown', (e) => { if (e.code === 'Space') playing = !playing; if (e.code === 'ArrowRight') { frame = (frame + 1) % n; playing = false; show(); } if (e.code === 'ArrowLeft') { frame = (frame - 1 + n) % n; playing = false; show(); } });
    const tick = (now) => { acc += now - last; last = now; if (playing && acc >= 1000 / fps) { acc %= 1000 / fps; frame = (frame + 1) % n; show(); } requestAnimationFrame(tick); };
    show(); requestAnimationFrame(tick);
  };

  global.KM = KM;
})(typeof window !== 'undefined' ? window : globalThis);
