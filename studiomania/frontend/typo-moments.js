// StudioMania — حركات التايبوجرافي «الاحترافية» (متبنية من الفيديو المرجع لحظة بلحظة، وبتشتغل على أي كلام عربي أو إنجليزي)
// بتتضاف لـ TypoEngine كأنواع جديدة بترسم الكادر كله بنفسها (الورق والحبيبات والإضاءة):
//   track  كلام كبير قاعد على خطين متقطعين والكاميرا ماشية معاه كلمة كلمة، صندوق بالقلم وشريط أسود ومؤشر
//          intro: فلاشات الافتتاح (كلمة بخط الإيد ← أحمر ممطوط ← أصفر) / outro: الكلام بيتكسّر بكسلات ويختفي
//   sign   السطر الصغير بين أقواس، وإمضا بتتكتب تحته، وكتابة مغبّشة في الخلفية، وخطوط قلم ودايرة حوالين الكلمة المهمة
//   spot   الجملة كاملة، ونجمة لمعة كبيرة من الجنب، والكادر بيضلم حوالين بقعة نور، وأيقونات بتطفو
//          intro: فلاش أصفر بنجمة بيضا وأيقونات طايرة / outro: فلاش أحمر
// sent = كلام الجملة كلها (اللي اتقال قبل البلوك بيبان على طول، واللي جوه البلوك بيظهر وهو بيتقال)

(function () {
  const E = window.TypoEngine;
  if (!E) return;
  const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / Math.max(1e-4, b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
  const eExpo = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(k)));
  const eIO = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  const eBack = (k) => { k = clamp(k); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function rng(s) { s = (s * 9301 + 49297) % 233280 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  const PAL = { paper: "#ecebe8", edge: "#b9b7b3", ink: "#191716", rule: "#7d3a33", red: "#c8121b", yellow: "#e0ab1c", yellowInk: "#3b2408",
    scribble: "#e0261f", star1: "#a9fbff", star2: "#1c46ff", dark: "#0c0808" };
  // الخطوط: هندسي للكلام، إمضا، وخط إيد للافتتاح (عربي ولاتيني). خط الكلام بيتغير من الستايل/المشروع (style.moments.sans / sansAr)
  const FONTS = { sans: ["TY Outfit", "TY Alexandria"], sign: ["TY Sign", "TY Ruqaa"], hand: ["TY Rock", "TY Ruqaa"] };
  E.MOMENT_FONTS = {
    latin: [["TY Outfit", "Outfit (زي الفيديو المرجع)"], ["TY Urbanist", "Urbanist"], ["TY Gabarito", "Gabarito"], ["TY Jakarta", "Plus Jakarta Sans"],
      ["TY Readex", "Readex Pro"]],
    arabic: [["TY Alexandria", "Alexandria (هندسي)"], ["TY Readex", "Readex Pro"], ["SM Cairo", "القاهرة"], ["SM Tajawal", "تجوال"], ["SM Changa", "تشانجا"],
      ["SM Lalezar", "لاله‌زار (عريض)"], ["SM Kufi", "كوفي"]],
  };
  const FACES = [["TY Outfit", "TY-Outfit-800.ttf", "800 900"], ["TY Outfit", "TY-Outfit-700.ttf", "500 799"], ["TY Urbanist", "TY-Urbanist-800.ttf", "500 900"],
    ["TY Gabarito", "TY-Gabarito-800.ttf", "800 900"], ["TY Gabarito", "TY-Gabarito-700.ttf", "500 799"], ["TY Readex", "TY-ReadexPro-700.ttf", "500 900"],
    ["TY Jakarta", "TY-Jakarta-800.ttf", "800 900"], ["TY Jakarta", "TY-Jakarta-700.ttf", "500 799"], ["TY Alexandria", "TY-Alexandria-800.ttf", "700 900"],
    ["TY Alexandria", "TY-Alexandria-500.ttf", "400 699"], ["TY Sign", "TY-MrsSaintDelafield.ttf", "400"], ["TY Ruqaa", "TY-ArefRuqaa-700.ttf", "400 900"],
    ["TY Rock", "TY-RockSalt.ttf", "400"]];
  let facesP = null;
  E.momentFonts = () => facesP || (facesP = Promise.all(FACES.map(([fam, file, w]) =>
    new FontFace(fam, `url(/fonts/${file})`, { weight: w }).load().then((f) => document.fonts.add(f)).catch(() => {}))));
  const MCTX = document.createElement("canvas").getContext("2d");
  const measure = (txt, font, ls = 0) => { MCTX.font = font; MCTX.letterSpacing = `${ls}px`; return MCTX.measureText(txt).width; };
  const baseOff = (font, size) => { MCTX.font = font; MCTX.letterSpacing = "0px"; const m = MCTX.measureText("Hxg"); return (size - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent; };

  E.FULL = new Set(["track", "sign", "spot"]);
  const P = E.prototype;
  // خط بنوعه (علامة ' مش " عشان بيتحط جوه style="...")
  P.fam = function (kind, ar) {
    const m = this.doc.style?.moments || {};
    const f = kind === "sans" ? (ar ? m.sansAr : m.sans) || FONTS.sans[ar ? 1 : 0] : FONTS[kind][ar ? 1 : 0];
    return `'${f}', '${FONTS[kind][ar ? 1 : 0]}'`;
  };

  P.pal = function () { return { ...PAL, ...(this.doc.style?.moments || {}) }; };
  P.mU = function () { const { w, h } = this.doc; return { W: w, H: h, tall: h > w * 1.2, S: Math.min(w, h) }; };

  // ---------- قوام
  P.mPaper = function (tint, edge, cx = 38, cy = 42) {
    const n = E.noise();
    return `<div style="position:absolute;inset:0;background:radial-gradient(130% 110% at ${cx}% ${cy}%, ${tint} 0%, ${tint} 30%, ${edge} 100%)"></div>
      <div style="position:absolute;inset:0;background:url(${n[3]});background-size:340px;opacity:.07;mix-blend-mode:multiply"></div>`;
  };
  P.mGrain = function (t, o = 0.13) {
    const n = E.noise();
    return `<div style="position:absolute;inset:0;background:url(${n[Math.floor(t * 24) % n.length]});background-size:300px;opacity:${o};mix-blend-mode:overlay"></div>`;
  };
  P.mDash = function (y, op = 0.75) {
    const s = this.mU().S;
    return `<div style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;height:${(s * 0.0028).toFixed(1)}px;opacity:${op};
      background:repeating-linear-gradient(90deg, ${this.pal().rule} 0 ${(s * 0.017).toFixed(1)}px, transparent ${(s * 0.017).toFixed(1)}px ${(s * 0.028).toFixed(1)}px)"></div>`;
  };
  P.mPen = function (d, p, w, color, op = 1) {
    if (p <= 0) return "";
    const { W, H } = this.mU();
    return `<svg viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;width:${W}px;height:${H}px;overflow:visible">
      <path d="${d}" fill="none" stroke="${color || this.pal().ink}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"
        pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="${(1000 * (1 - clamp(p))).toFixed(1)}" opacity="${op}"/></svg>`;
  };
  const roughRect = (x0, y0, x1, y1, seed, j = 10) => {
    const r = rng(seed), q = () => (r() - 0.5) * j;
    return `M${x0 + q()},${y0 + q()} L${x1 + q()},${y0 + q()} L${x1 + q()},${y1 + q()} L${x0 + q()},${y1 + q()} L${x0 + 14 + q()},${y0 + 6 + q()}`;
  };
  function star4(cx, cy, tips, k, fill) {
    let d = `M${tips[0][0]},${tips[0][1]}`;
    for (let i = 0; i < 4; i++) {
      const a = tips[i], b = tips[(i + 1) % 4], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      d += ` Q${cx + (mx - cx) * k},${cy + (my - cy) * k} ${b[0]},${b[1]}`;
    }
    return `<path d="${d} Z" fill="${fill}"/>`;
  }
  // كلام الجملة: اللي اتقال قبل البلوك ظاهر، واللي جواه بيظهر وهو بيتقال
  P.mSent = function (b) {
    const s = b.sent?.length ? b.sent : this.words(b);
    return s.filter((w) => w.t0 < b.t1 - 0.02);
  };
  // سطور الكلام (بيتلف على عرض maxW)، وكل كلمة بمكانها؛ العربي من اليمين
  function lines(words, font, ls, maxW, rtl) {
    const sp = measure(" ", font, ls), out = [];
    let cur = [], x = 0;
    words.forEach((w, i) => {
      const ww = measure(w.w, font, ls);
      if (cur.length && x + ww > maxW) { out.push({ items: cur, width: x - sp }); cur = []; x = 0; }
      cur.push({ i, x, w: ww });
      x += ww + sp;
    });
    if (cur.length) out.push({ items: cur, width: x - sp });
    if (rtl) out.forEach((L) => L.items.forEach((it) => (it.x = L.width - it.x - it.w)));
    return out;
  }

  // ======================================================== track
  P.k_track = function (b, t, k, th, bi) {
    const { W, H, tall, S } = this.mU(), pal = this.pal();
    const ws = this.words(b), ar = AR.test(ws.map((w) => w.w).join(" "));
    // افتتاح: 3 لقطات سريعة (خط إيد ← أحمر ممطوط ← أصفر)
    if (b.intro === "flash" && t < b.t0 + 0.125) return this.mFlash(b, t, ws[0]?.w || "", ar);
    const BIG = S * (tall ? 0.27 : 0.315), F = `800 ${BIG}px ${this.fam("sans", ar)}`, LS = ar ? 0 : -BIG * 0.045;
    const base = H * (tall ? 0.55 : 0.57), top = base - BIG * (ar ? 0.42 : 0.52);
    // أماكن الكلمات على السطر (العربي ماشي ناحية الشمال)
    const sp = measure(" ", F, LS);
    let acc = 0;
    const pos = ws.map((w) => { const wd = measure(w.w, F, LS); const x = ar ? -acc - wd : acc; acc += wd + sp; return { x, w: wd }; });
    const centerOf = (i) => pos[i].x + pos[i].w / 2;
    // الكاميرا: الكلمة اللي بتتقال قريبة من النص، وبتزحف ناحية الكلام الجاي
    const tgt = (i) => W * (ar ? 0.5 + (i % 2 ? -0.05 : 0.04) : 0.5 + (i % 2 ? 0.05 : -0.04)) - centerOf(i);
    let cam = tgt(0);
    ws.forEach((w, i) => { if (i) cam = lerp(cam, tgt(i), eIO(seg(t, w.t0 - 0.03, w.t0 + 0.09))); });
    cam += (ar ? 1 : -1) * W * 0.035 * seg(t, b.t0, b.t1);
    const outro = b.outro === "pixel" ? Math.max(b.t0 + 0.3, b.t1 - 0.24) : 1e9;
    if (t >= outro) return this.mPixel(b, t, ws, pos, cam, base, F, LS, ar, outro);
    let h = this.mPaper(pal.paper, pal.edge, 30, 45) + this.mDash(top) + this.mDash(base);
    const bo = baseOff(F, BIG);
    ws.forEach((w, i) => {
      if (i > 0 && t < w.t0 + 0.02) return;
      const a = i === 0 ? 1 : seg(t, w.t0 + 0.02, w.t0 + 0.1);
      const x = cam + pos[i].x + (ar ? -1 : 1) * (1 - eOut(a)) * S * 0.055;
      h += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${(base - bo).toFixed(1)}px;line-height:${BIG}px;font:${F};letter-spacing:${LS}px;white-space:nowrap;
        color:${a < 1 ? `rgba(25,23,22,${lerp(0.35, 1, a).toFixed(2)})` : pal.ink};filter:blur(${((1 - a) * 5).toFixed(1)}px)">${esc(w.w)}</div>`;
    });
    const pw = S * 0.0055;
    // صندوق بالقلم حوالين كلمة، وخط تحت لحد عندها
    const bx = Number.isInteger(b.box) ? b.box : ws.length > 1 ? 1 : -1;
    if (bx >= 0 && ws[bx] && t > ws[bx].t0 + 0.05) {
      const x0 = cam + pos[bx].x - BIG * 0.06, x1 = cam + pos[bx].x + pos[bx].w + BIG * 0.05;
      h += this.mPen(roughRect(x0, top + BIG * 0.03, x1, base + BIG * 0.02, bi * 7 + 5, S * 0.009), seg(t, ws[bx].t0 + 0.05, ws[bx].t0 + 0.1), pw * 1.1, pal.ink,
        1 - seg(t, ws[bx].t0 + 0.24, ws[bx].t0 + 0.3));
      const u0 = cam + Math.min(pos[0].x, pos[bx].x) - BIG * 0.2, u1 = cam + Math.max(pos[0].x + pos[0].w, pos[bx].x + pos[bx].w) + BIG * 0.2, uy = base + BIG * 0.15;
      h += this.mPen(`M${u0},${uy + 8} C${u0 + (u1 - u0) * 0.35},${uy - 6} ${u1 - (u1 - u0) * 0.4},${uy + 14} ${u1},${uy - 4}`, seg(t, ws[0].t0 + 0.2, ws[bx].t0 + 0.08), pw * 0.8,
        pal.ink, 1 - seg(t, ws[bx].t0 + 0.24, ws[bx].t0 + 0.3));
    }
    // شريط أسود بيغطي كلمة قبل ما تتقال وبينسحب عنها
    const rd = Number.isInteger(b.redact) ? b.redact : ws.length > 2 ? 2 : -1;
    if (rd >= 0 && ws[rd] && t > ws[rd].t0 - 0.04 && t < ws[rd].t0 + 0.08) {
      const kk = eIO(seg(t, ws[rd].t0 + 0.0, ws[rd].t0 + 0.08));
      const x0 = cam + pos[rd].x - BIG * 0.09, wd = pos[rd].w + BIG * 0.6;
      const left = ar ? x0 - BIG * 0.5 : x0;
      h += `<div style="position:absolute;left:${(ar ? left : lerp(left, left + wd - BIG * 0.35, kk)).toFixed(1)}px;top:${(top - BIG * 0.03 - kk * BIG * 0.09).toFixed(1)}px;
        width:${lerp(wd, BIG * 0.35, kk).toFixed(1)}px;height:${(base - top + BIG * 0.05).toFixed(1)}px;background:#121110"></div>`;
      h += this.mPen(roughRect(x0 - BIG * 0.06, base - BIG * 0.03, x0 + wd - BIG * 0.24, base + BIG * 0.2, bi * 11 + 9), seg(t, ws[rd].t0 - 0.04, ws[rd].t0), pw * 0.8);
    }
    // مؤشر كتابة بعد آخر كلمة اتقالت (آخر البلوك)
    const said = ws.filter((w) => w.t0 <= t).length - 1;
    if (said >= 0 && k > 0.55 && Math.floor(t * 4) % 2 === 0) {
      const p = pos[said], cx = ar ? cam + p.x - BIG * 0.1 : cam + p.x + p.w + BIG * 0.06;
      h += `<div style="position:absolute;left:${cx.toFixed(1)}px;top:${top.toFixed(1)}px;width:${(BIG * 0.035).toFixed(1)}px;height:${(base - top).toFixed(1)}px;background:${pal.ink}"></div>`;
    }
    return h + this.mGrain(t);
  };

  P.mFlash = function (b, t, word, ar) {
    const { W, H, S } = this.mU(), pal = this.pal(), f = Math.floor((t - b.t0) / 0.0417);
    if (f <= 0) return this.mPaper("#efeeeb", "#d8d6d2") + `<div dir="auto" style="position:absolute;left:0;right:0;top:${H * 0.22}px;text-align:center;font:${S * 0.24}px ${this.fam("hand", ar)};color:#1b1918;transform:rotate(-6deg)">${esc(ar ? word : word.toUpperCase())}</div>` + this.mGrain(t);
    if (f === 1) return `<div style="position:absolute;inset:0;background:${pal.red}"></div>
      <div dir="auto" style="position:absolute;left:0;right:0;top:${-H * 0.16}px;text-align:center;font:800 ${S * 0.48}px ${this.fam("sans", ar)};letter-spacing:-0.06em;color:#120a0a;transform:scaleY(1.9) scaleX(.8)">${esc(word)}</div>` + this.mGrain(t);
    return `<div style="position:absolute;inset:0;background:${pal.yellow}"></div>${this.mDash(H * 0.065, 0.9)}${this.mDash(H * 0.915, 0.9)}
      <div dir="auto" style="position:absolute;left:0;right:0;top:${H * 0.3}px;text-align:center;font:800 ${S * 0.23}px ${this.fam("sans", ar)};letter-spacing:-0.05em;color:${pal.yellowInk}">${esc(word)}</div>` + this.mGrain(t);
  };

  // الكلام بيتكسّر بكسلات وبيصغر ويتحوّل لشرَط ويختفي
  const PIX = document.createElement("canvas");
  P.mPixel = function (b, t, ws, pos, cam, base, F, LS, ar, t0) {
    const { W, H, S } = this.mU(), pal = this.pal(), k = seg(t, t0, t0 + 0.22);
    let h = this.mPaper(pal.paper, "#c9c7c3", 40, 45);
    const blk = Math.round(lerp(S * 0.0085, S * 0.02, eOut(k)));
    PIX.width = Math.ceil(W / blk); PIX.height = Math.ceil(H / blk);
    const g = PIX.getContext("2d");
    g.clearRect(0, 0, PIX.width, PIX.height);
    g.fillStyle = pal.ink;
    if (k < 0.38) {
      const sv = lerp(1, 0.3, eExpo(seg(k, 0.08, 0.38)));
      g.save(); g.translate(W / 2 / blk, base / blk); g.scale(sv / blk, sv / blk); g.translate(-W / 2, -base);
      g.font = F; g.letterSpacing = `${LS}px`; g.direction = ar ? "rtl" : "ltr"; g.textAlign = "left";
      ws.forEach((w, i) => { if (w.t0 <= t + 0.05) g.fillText(w.w, cam + pos[i].x, base); });
      g.restore();
    } else {
      const r = rng(7), y = Math.round(PIX.height * 0.5);
      let x = Math.round(PIX.width * 0.1);
      g.globalAlpha = 1 - seg(k, 0.75, 1);
      for (const ch of ws.map((w) => w.w).join(" ")) {
        if (ch === " ") { x += 2; continue; }
        if (r() > 0.3) g.fillRect(x, y, r() > 0.6 ? 2 : 1, 1);
        x += 1;
      }
      const vx = Math.round(PIX.width * 0.83);
      g.fillRect(vx, y - 2, 1, 1); g.fillRect(vx, y, 1, 1); g.fillRect(vx, y + 2, 1, 1);
    }
    h += `<img src="${PIX.toDataURL()}" style="position:absolute;left:0;top:0;width:${PIX.width * blk}px;height:${PIX.height * blk}px;image-rendering:pixelated">`;
    return h + this.mGrain(t);
  };

  // ======================================================== sign
  P.k_sign = function (b, t, k, th, bi) {
    const { W, H, tall, S } = this.mU(), pal = this.pal();
    const sent = this.mSent(b), ar = AR.test(sent.map((w) => w.w).join(" "));
    const SM = S * (tall ? 0.085 : 0.05), F = `${ar ? 800 : 700} ${SM}px ${this.fam("sans", ar)}`, LS = ar ? 0 : -SM * 0.02;
    const maxW = W * (tall ? 0.86 : 0.94);
    const L = lines(sent, F, LS, maxW, ar);
    const lh = SM * 1.35, y0 = H * 0.5 - (L.length - 1) * lh / 2;
    const x0 = ar ? W - W * 0.03 - maxW : W * 0.03;
    const at = {};
    L.forEach((ln, li) => ln.items.forEach((it) => (at[it.i] = { x: x0 + (ar ? maxW - ln.width : 0) + it.x, y: y0 + li * lh, w: it.w })));
    let h = this.mPaper("#ecebe9", "#cfcdca", 45, 40);
    const focus = Number.isInteger(b.focus) && b.focus >= 0 ? this.words(b)[b.focus] : null;
    const fi = focus ? sent.findIndex((w) => w.t0 === focus.t0) : -1;
    const sig = (b.sign || (focus ? focus.w : this.words(b).slice(-2).map((w) => w.w).join(" "))).trim();
    // كتابة كبيرة مغبّشة في الخلفية (عمق)
    const bk = seg(t, b.t0, b.t0 + 0.6);
    h += `<div dir="auto" style="position:absolute;${ar ? "right" : "left"}:${lerp(W * 0.5, W * 0.6, bk).toFixed(1)}px;top:${lerp(H * 0.06, H * 0.04, bk).toFixed(1)}px;font:${S * 0.3}px ${this.fam("sign", ar)};
      color:#3b3937;opacity:${(0.32 * (1 - seg(k, 0.55, 0.7))).toFixed(2)};filter:blur(${(S * 0.013).toFixed(1)}px);white-space:nowrap;transform:rotate(-8deg)">${esc(sig)}</div>`;
    // الكلام
    sent.forEach((w, i) => {
      if (w.t0 > t) return;
      const a = seg(t, w.t0, w.t0 + 0.08), p = at[i];
      const bold = i === fi && t >= w.t0;
      h += `<span style="position:absolute;left:${p.x.toFixed(1)}px;top:${(p.y - SM * 0.8).toFixed(1)}px;font:${bold ? 800 : ar ? 800 : 700} ${SM}px ${this.fam("sans", ar)};letter-spacing:${LS}px;white-space:nowrap;
        color:${pal.ink};opacity:${lerp(0.25, 1, a).toFixed(2)}">${esc(w.w)}</span>`;
    });
    const pw = S * 0.0045;
    // أقواس حوالين اللي اتقال (أول البلوك، وبتومض مرة)
    if ((k < 0.28 || (k > 0.36 && k < 0.42)) && L.length === 1) {
      const said = sent.map((w, i) => (w.t0 <= t ? i : -1)).filter((i) => i >= 0);
      if (said.length) {
        const xs = said.map((i) => [at[i].x, at[i].x + at[i].w]).flat();
        const bx0 = Math.min(...xs) - SM * 0.42, bx1 = Math.max(...xs) + SM * 0.48, by0 = y0 - SM * 1.15, by1 = y0 + SM * 0.55;
        h += `<div style="position:absolute;left:${bx0}px;top:${by0}px;width:${bx1 - bx0}px;height:${by1 - by0}px;border-top:2px dashed #4a4744;border-bottom:2px dashed #4a4744"></div>
          <div style="position:absolute;left:${bx0}px;top:${by0 - SM * 0.2}px;width:${pw}px;height:${by1 - by0 + SM * 0.4}px;background:#2b2927"></div>
          <div style="position:absolute;left:${bx1 - pw}px;top:${by0 - SM * 0.2}px;width:${pw}px;height:${by1 - by0 + SM * 0.4}px;background:#2b2927"></div>`;
      }
    }
    // الإمضا بتتكتب تحت الكلام
    const yS = y0 + (L.length - 1) * lh + SM * 1.2;
    if (k < 0.75) {
      const rv = eIO(seg(k, 0.02, 0.6)), fade = 1 - seg(k, 0.62, 0.75);
      h += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${ar ? "right" : "left"}:${W * 0.1}px;top:${yS}px;font:${S * 0.14}px ${this.fam("sign", ar)};color:#1d1b1a;white-space:nowrap;opacity:${fade.toFixed(2)};
        clip-path:inset(0 ${ar ? 0 : (100 - rv * 100).toFixed(1)}% 0 ${ar ? (100 - rv * 100).toFixed(1) : 0}%);transform:rotate(-4deg)">${esc(sig)}</div>`;
    }
    // خطوط القلم: خط نازل، ومنحنى كبير، وبرق ودايرة حوالين الكلمة المهمة
    const ex = ar ? W - W * 0.03 - SM * 0.2 : W * 0.03 + SM * 0.2;
    if (k > 0.1 && k < 0.2) h += this.mPen(`M${ex},${y0 - SM * 0.8} C${ex + 4},${y0 + H * 0.12} ${ex - 6},${y0 + H * 0.3} ${ex + 2},${H + 20}`, seg(k, 0.1, 0.14), pw * 0.9, "#2a2826");
    if (k > 0.6 && k < 0.8) {
      const cx = ar ? W * 0.4 : W * 0.6, s = ar ? -1 : 1;
      h += this.mPen(`M${cx},-20 C${cx + s * W * 0.12},${H * 0.15} ${cx + s * W * 0.2},${H * 0.45} ${cx - s * W * 0.02},${H * 0.52} C${cx - s * W * 0.12},${H * 0.56} ${cx + s * W * 0.02},${H * 0.36} ${cx + s * W * 0.1},${H * 0.3}`,
        seg(k, 0.6, 0.72), pw * 1.1, "#2a2826", 1 - seg(k, 0.72, 0.8));
    }
    if (fi >= 0) {
      const fw = sent[fi], p = at[fi];
      if (t > fw.t0 - 0.12 && t < fw.t0 + 0.02 + 0.12) {
        const x = ar ? p.x - SM * 0.4 : p.x - SM * 0.3;
        h += this.mPen(`M${x + SM * 0.6},${p.y - SM * 0.4} L${x + SM * 0.1},${p.y + SM * 1.7} L${x + SM * 0.95},${p.y + SM * 1.3} L${x + SM * 0.2},${p.y + SM * 3.5}`,
          seg(t, fw.t0 - 0.12, fw.t0 - 0.06), pw * 1.1, "#2a2826", 1 - seg(t, fw.t0 + 0.06, fw.t0 + 0.14));
      }
      if (t > fw.t0 - 0.02 && t < fw.t0 + 0.32) {
        const a = p.x - SM * 0.26, bb = p.x + p.w + SM * 0.26, cy = p.y - SM * 0.3, rx = (bb - a) / 2 + 8, ry = SM * 0.62, cx = (a + bb) / 2;
        h += this.mPen(`M${cx + rx * 0.2},${cy - ry} C${cx + rx * 1.15},${cy - ry * 1.1} ${cx + rx * 1.1},${cy + ry * 1.1} ${cx},${cy + ry} C${cx - rx * 1.15},${cy + ry} ${cx - rx * 1.1},${cy - ry * 1.05} ${cx + rx * 0.35},${cy - ry * 0.95}`,
          seg(t, fw.t0 - 0.02, fw.t0 + 0.06), pw, "#2a2826", 1 - seg(t, fw.t0 + 0.24, fw.t0 + 0.32));
      }
    }
    return h + this.mGrain(t);
  };

  // ======================================================== spot
  P.k_spot = function (b, t, k, th, bi) {
    const { W, H, tall, S } = this.mU(), pal = this.pal();
    const sent = this.mSent(b), ar = AR.test(sent.map((w) => w.w).join(" "));
    const icons = (b.icons?.length ? b.icons : b.icon ? [b.icon] : []).slice(0, 4);
    // مكان الأيقونات: في الناحية الفاضية (يمين الإنجليزي، شمال العربي)، وفوق وتحت الكلام في الطولي
    const slots = tall ? [[0.3, 0.3], [0.68, 0.28], [0.32, 0.7], [0.7, 0.72]] : [[0.565, 0.3], [0.72, 0.28], [0.69, 0.56], [0.77, 0.75]];
    const spots = icons.map((src, i) => { const [x, y] = slots[i]; return [src, ar && !tall ? 1 - x : x, y, S * (tall ? 0.09 : 0.06), [-18, 8, 0, 10][i]]; });
    if (b.intro === "burst" && t < b.t0 + 0.1) return this.mBurst(b, t, spots, ar);
    const t0 = b.intro === "burst" ? b.t0 + 0.1 : b.t0;
    const kk = seg(t, t0, b.t1);
    let h = this.mPaper("#f4f3f1", "#d8d6d3", 55, 50);
    const v = eIO(seg(t, t0 + 0.08, t0 + 0.9));
    h += `<div style="position:absolute;inset:0;background:radial-gradient(${lerp(140, 62, v)}% ${lerp(140, 78, v)}% at ${ar ? 44 : 56}% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 45%, rgba(40,22,18,${(0.25 + 0.7 * v).toFixed(2)}) 75%, rgba(12,8,8,${(0.4 + 0.6 * v).toFixed(2)}) 100%)"></div>`;
    // النجمة من الجنب (شمال للإنجليزي، يمين للعربي)
    const hue = eIO(seg(t, t0 + 0.13, t0 + 0.9)), c1 = hue < 0.5 ? pal.star1 : "#6fd8ff";
    const c2 = `rgb(${lerp(40, 28, hue).toFixed(0)},${lerp(200, 70, hue).toFixed(0)},${lerp(230, 255, hue).toFixed(0)})`;
    const g = lerp(1, 1.08, eOut(kk)), sx = ar ? W + S * 0.04 : -S * 0.04, dir = ar ? -1 : 1, cy = H * 0.49;
    const tips = (f) => [[sx + dir * W * (tall ? 0.24 : 0.3) * g * f, cy], [sx + dir * W * (tall ? 0.16 : 0.17) * g * f, cy + H * (tall ? 0.3 : 0.56) * g * f], [sx - dir * W * 0.3, cy], [sx + dir * W * (tall ? 0.16 : 0.17) * g * f, cy - H * (tall ? 0.3 : 0.56) * g * f]];
    h += `<svg viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;overflow:visible">
      <defs><radialGradient id="sg${bi}" cx="${sx}" cy="${cy}" r="${S * 0.6}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#ffffff"/><stop offset="0.22" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
        <filter id="gl${bi}"><feGaussianBlur stdDeviation="${S * 0.006}"/></filter></defs>
      <g filter="url(#gl${bi})" opacity=".6">${star4(sx, cy, tips(1.03), 0.1, c2)}</g>${star4(sx, cy, tips(1), 0.08, `url(#sg${bi})`)}</svg>`;
    // خربشات حمرا وخطوط سرعة طايرة أول ما المشهد يبدأ
    const burst = seg(t, t0, t0 + 0.25);
    if (burst < 1) {
      const r = rng(12 + bi);
      for (let i = 0; i < 10; i++) {
        const ang = (ar ? Math.PI : 0) + (-0.9 + r() * 1.6) * dir, d = S * (0.11 + r() * 0.15) + eOut(burst) * S * (0.26 + r() * 0.24);
        const x = W * (ar ? 0.28 : 0.72) + Math.cos(ang) * d, y = H * 0.42 + Math.sin(ang) * d * 0.8, red = i % 3 !== 0;
        h += this.mPen(`M${x},${y} q${dir * (30 + r() * 40)},${-20 + r() * 40} ${dir * (60 + r() * 50)},${-10 + r() * 30}`, 1, red ? S * 0.0046 : S * 0.0023, red ? pal.scribble : "#3a3a3a", 1 - burst);
      }
    }
    // الأيقونات
    spots.forEach(([src, x, y, s, rot], i) => {
      const a = eBack(seg(t, t0 + i * 0.02, t0 + 0.19 + i * 0.02)), fl = Math.sin((t * 1.6 + i) * 1.3) * S * 0.0055;
      h += `<img src="${esc(src)}" style="position:absolute;left:${(W * x - s / 2).toFixed(1)}px;top:${(H * y - s / 2 + fl).toFixed(1)}px;height:${s.toFixed(1)}px;
        transform:scale(${a.toFixed(3)}) rotate(${(rot * (1 - a) + rot * 0.3).toFixed(1)}deg);filter:drop-shadow(0 4px 6px rgba(0,0,0,.25)) brightness(${(1 - 0.35 * v).toFixed(2)})">`;
    });
    // الجملة: في النص على عرض الكادر، والكلمة المهمة بتتقل لما تتقال
    const SMx = S * (tall ? 0.085 : 0.05);
    let SM = SMx, F = `${ar ? 800 : 700} ${SM}px ${this.fam("sans", ar)}`;
    const total = (f) => measure(sent.map((w) => w.w).join(" "), f, ar ? 0 : -SM * 0.02);
    if (!tall) while (total(F) > W * 0.985 && SM > S * 0.03) { SM -= 1; F = `${ar ? 800 : 700} ${SM}px ${this.fam("sans", ar)}`; }
    const L = lines(sent, F, ar ? 0 : -SM * 0.02, W * (tall ? 0.74 : 0.985), ar);
    const shift = tall ? (ar ? -1 : 1) * W * 0.07 : 0;   // في الطولي الكلام بيبعد عن ناحية النجمة
    const lh = SM * 1.35, y0 = H * 0.5 - (L.length - 1) * lh / 2;
    const focus = Number.isInteger(b.focus) && b.focus >= 0 ? this.words(b)[b.focus] : null;
    L.forEach((ln, li) => ln.items.forEach((it) => {
      const w = sent[it.i];
      if (w.t0 > t + 0.02) return;
      const a = w.t0 < b.t0 ? 1 : seg(t, w.t0, w.t0 + 0.08);
      const hot = focus && w.t0 === focus.t0 && t >= w.t0;
      const x = (W - ln.width) / 2 + it.x + shift;
      const lead = ar ? it.x > ln.width * 0.7 : it.x < ln.width * 0.18;   // أول الجملة بيبهت ناحية النجمة
      h += `<span style="position:absolute;left:${x.toFixed(1)}px;top:${(y0 + li * lh - SM * 0.8).toFixed(1)}px;font:${hot ? 800 : ar ? 800 : 700} ${SM}px ${this.fam("sans", ar)};
        letter-spacing:${ar ? 0 : -SM * 0.02}px;white-space:nowrap;color:${hot ? "#0d0c0c" : `rgba(25,23,22,${lerp(1, 0.82, v).toFixed(2)})`};
        opacity:${(lerp(0.25, 1, a) * (lead ? lerp(1, 0.55, v) : 1)).toFixed(2)}">${esc(w.w)}</span>`;
    }));
    if (focus && t > focus.t0 - 0.1) {
      const pk = seg(t, focus.t0 - 0.1, focus.t0 + 0.1);
      h += `<div style="position:absolute;inset:0;background:radial-gradient(45% 55% at ${ar ? 44 : 56}% 50%, rgba(255,214,205,${(0.5 * pk).toFixed(2)}), rgba(0,0,0,0) 70%)"></div>`;
    }
    if (b.outro === "red") {
      const red = seg(t, b.t1 - 0.1, b.t1);
      if (red) h += `<div style="position:absolute;inset:0;background:radial-gradient(${lerp(10, 70, red)}% ${lerp(14, 90, red)}% at ${ar ? 70 : 30}% 52%, rgba(225,40,25,${red}), rgba(120,10,10,${red * 0.8}) 60%, rgba(10,5,5,${red}) 100%)"></div>`;
    }
    return h + this.mGrain(t);
  };

  P.mBurst = function (b, t, spots, ar) {
    const { W, H, S } = this.mU(), k = seg(t, b.t0, b.t0 + 0.1);
    let h = `<div style="position:absolute;inset:0;background:radial-gradient(120% 120% at ${ar ? 60 : 40}% 45%, #f6c62a, #d9980f)"></div>`;
    const cx = W * (ar ? 0.64 : 0.36), cy = H * 0.48, R = lerp(S * 0.35, S * 0.48, k);
    h += `<svg viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;filter:blur(${lerp(18, 8, k)}px)">${star4(cx, cy, [[cx + R, cy], [cx, cy + R], [cx - R, cy], [cx, cy - R]], 0.12, "#fffbe6")}</svg>`;
    const r = rng(4);
    for (let i = 0; i < 9; i++) {
      const y = H * (0.2 + r() * 0.6), x = W * (0.25 + r() * 0.5), len = S * (0.18 + r() * 0.24);
      h += `<div style="position:absolute;left:${x + (ar ? -1 : 1) * k * S * 0.11}px;top:${y}px;width:${len}px;height:${S * (0.009 + r() * 0.013)}px;background:rgba(255,255,240,.75);transform:rotate(${ar ? 22 : -22}deg);filter:blur(6px)"></div>`;
    }
    spots.forEach(([src, x, y, s]) => {
      h += `<img src="${esc(src)}" style="position:absolute;left:${lerp(W * 0.45, W * x, k)}px;top:${lerp(H * 0.48, H * y, k)}px;height:${s * 0.8}px;filter:blur(5px);opacity:.9">`;
    });
    return h + this.mGrain(t);
  };
})();
