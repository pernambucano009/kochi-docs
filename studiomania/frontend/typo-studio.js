// StudioMania — عناصر «ستوديو» (متاخدة من الفيديوهات المرجعية، وبتقرا الشخص اللي في الفيديو):
//   behind     كلام عملاق ورا الشخص (الكلام تحت والشخص فوقه، من الفصل اللي اتعمل وقت التحليل)
//   arc        الكلام متقوّس حوالين راس الشخص، كلمة كلمة، والكلمة المهمة (focus) حمرا أكبر
//   artype     كتابة حرف حرف بمؤشر برتقاني، ونقطة برتقاني فوق الكلمة المهمة وخط متعرج تحتها (ستايل العربي)
//   redword    كلمة واحدة بس في النص، حمرا ومنوّرة، بتتبدل مع كل كلمة بتتقال
//   signature  إمضا بتتكتب بقلم رفيع، ومعاها خطوط قلم طويلة بتدخل من برا وخط تحت
// doc.person = { fps, n, base, img: {x, y, w, h}, frames: [{box:[x0,y0,x1,y1], head:[cx,cy,r]} | null] } (بالبكسل في كادر الفيديو النهائي)
// كل حركة لو مفيش شخص (مفيش فيديو أو الفيديو مفيهوش حد) بتشتغل في نص الكادر.

(function () {
  const E = window.TypoEngine;
  if (!E) return;
  const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / Math.max(1e-4, b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
  const eBack = (k) => { k = clamp(k); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function rng(s) { s = (s * 9301 + 49297) % 233280 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  const FACES = [["TY Anton", "TY-Anton.ttf", "400"], ["TY Pen", "TY-DawningPen.ttf", "400"], ["TY PlexAr", "TY-PlexArabic-700.ttf", "700"],
    ["TY PlexAr", "TY-PlexArabic-400.ttf", "400"], ["TY Ruqaa", "TY-ArefRuqaa-700.ttf", "400 900"], ["TY Outfit", "TY-Outfit-800.ttf", "800 900"]];
  let facesP = null;
  E.studioFonts = () => facesP || (facesP = Promise.all(FACES.map(([fam, file, w]) =>
    new FontFace(fam, `url(/fonts/${file})`, { weight: w }).load().then((f) => document.fonts.add(f)).catch(() => {}))));
  E.STUDIO = new Set(["behind", "arc", "artype", "redword", "signature"]);
  E.TYPING = new Set(["type", "artype"]);
  const MC = document.createElement("canvas").getContext("2d");
  const measure = (s, font) => { MC.font = font; return MC.measureText(s).width; };
  const P = E.prototype;
  const RED = "#E5261F", ORANGE = "#EE5A2F", NAVY = "#121A2E";

  // ---------- الشخص
  P.personAt = function (t) {
    const p = this.doc.person;
    if (!p?.n) return null;
    const i = clamp(Math.round(t * p.fps), 0, p.n - 1);
    return { i, url: `${p.base}${String(i).padStart(5, "0")}.webp`, st: p.frames?.[i] || null, img: p.img };
  };
  // الشخص لوحده فوق الكلام (نفس قص الفيديو ونفس التغميق)
  P.personLayer = function (t) {
    const a = this.personAt(t);
    if (!a) return "";
    const { x, y, w, h } = a.img;
    this._want = a.url;
    return `<img src="${a.url}" alt="" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;
      filter:brightness(${(1 - (this.doc.dim || 0)).toFixed(3)});pointer-events:none">`;
  };
  // الراس بالبكسل (لو مفيش شخص: نص الكادر من فوق شوية)
  P.headAt = function (t) {
    const { w, h } = this.doc;
    const a = this.personAt(t);
    // الراس لازم يكون جوه الكادر بعد القص (فيديو عريض في كادر طولي ممكن يقص الشخص برّه)
    if (a?.st && a.st.head[0] > w * 0.08 && a.st.head[0] < w * 0.92 && a.st.head[1] > 0 && a.st.head[1] < h * 0.85)
      return { x: a.st.head[0], y: a.st.head[1], r: Math.max(a.st.head[2], Math.min(w, h) * 0.06), top: Math.max(0, a.st.box[1]), has: true };
    return { x: w / 2, y: h * 0.42, r: Math.min(w, h) * 0.13, top: h * 0.3, has: false };
  };
  // السيرفر بيستنى الصور اللي في الفريم تتحمل قبل ما يصوّر
  P.settle = function () {
    const imgs = [...this.stage.querySelectorAll("img")].filter((i) => !i.complete);
    return Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
  };
  // المعاينة: الفريمات اللي جاية بتتحمل قبلها عشان مايبقاش فيه رعشة
  P.prefetchPerson = function (t) {
    const p = this.doc.person;
    if (!p?.n) return;
    this._pc = this._pc || new Map();
    for (let j = 0; j < 12; j++) {
      const i = clamp(Math.round(t * p.fps) + j, 0, p.n - 1);
      if (this._pc.has(i)) continue;
      const im = new Image(); im.src = `${p.base}${String(i).padStart(5, "0")}.webp`; this._pc.set(i, im);
      if (this._pc.size > 240) this._pc.delete(this._pc.keys().next().value);
    }
  };

  const onVideo = (eng) => !!eng.doc.transparent;
  const inkOf = (eng, th) => (onVideo(eng) ? "#FFFFFF" : th.ink);
  const shadow = (eng) => (onVideo(eng) ? "text-shadow:0 4px 22px rgba(0,0,0,.35);" : "");
  const fam = (s, latin, arabic) => (AR.test(s) ? `'${arabic}', 'SM Tajawal'` : `'${latin}', 'TY Outfit'`);
  const backdrop = (eng, th) => (onVideo(eng) ? "" : `<div style="position:absolute;inset:0;background:${th.bg}"></div>`);

  // ---------- behind: كلام عملاق ورا الشخص
  P.k_behind = function (b, t, k, th) {
    const { w, h } = this.doc;
    const ws = this.words(b);
    const txt = this.text(b.text || ws.map((x) => x.w).join(" ")).trim();
    const lines = txt.split(/\s+/).length > 2 ? [txt.split(/\s+/).slice(0, Math.ceil(txt.split(/\s+/).length / 2)).join(" "), txt.split(/\s+/).slice(Math.ceil(txt.split(/\s+/).length / 2)).join(" ")] : [txt];
    const ff = fam(txt, "TY Anton", "SM Lalezar");
    const hd = this.headAt(t);
    let html = backdrop(this, th);
    const maxW = w * 0.9, maxH = h * (h > w ? 0.2 : 0.4) / lines.length;
    lines.forEach((ln, li) => {
      const base = measure(ln, `400 100px ${ff}`) || 100;
      const size = Math.min((maxW / base) * 100, maxH * 1.25);
      // الكلام بيقعد بحيث الراس يغطي الجزء التحتاني منه
      const cy = clamp(hd.top + size * (0.15 + li * 0.95) - (lines.length - 1) * size * 0.45, size * 0.6, h * 0.7);
      const t0 = (ws[Math.min(ws.length - 1, li * Math.ceil(ws.length / lines.length))]?.t0) ?? b.t0;
      const e = eOut(seg(t, t0, t0 + 0.22)), out = 1 - seg(t, b.t1 - 0.15, b.t1);
      if (t < t0) return;
      html += `<div style="position:absolute;left:${w / 2}px;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%) scale(${lerp(1.12, 1, e).toFixed(3)},${lerp(0.55, 1, e).toFixed(3)});
        font-family:${ff};font-size:${size.toFixed(1)}px;line-height:1;white-space:nowrap;color:${inkOf(this, th)};opacity:${(e * out).toFixed(3)};
        letter-spacing:-0.01em;filter:blur(${((1 - e) * 8).toFixed(1)}px);${onVideo(this) ? "text-shadow:0 6px 30px rgba(0,0,0,.25);" : ""}" dir="${this.dir(ln)}">${esc(ln)}</div>`;
    });
    return html + this.personLayer(t);
  };

  // ---------- arc: الكلام متقوّس حوالين الراس
  P.k_arc = function (b, t, k, th) {
    const { w, h } = this.doc;
    const ws = this.words(b);
    const hd = this.headAt(t);
    const R = Math.min(Math.max(hd.r * 2.1, Math.min(w, h) * 0.22), Math.min(w, h) * 0.4);
    const ar = AR.test(ws.map((x) => x.w).join(""));
    const base = Math.min(w, h) * 0.075 * this.ts;
    // كل كلمة بزاويتها (من فوق الشمال لفوق اليمين حوالين الراس)
    const sizes = ws.map((x, i) => (i === b.focus ? base * 1.6 : base));
    const lens = ws.map((x, i) => measure(this.text(x.w) + " ", `800 ${sizes[i]}px ${fam(x.w, "TY Outfit", "SM Lalezar")}`));
    const total = lens.reduce((a, c) => a + c, 0);
    const span = Math.min(Math.PI * 1.25, total / R);
    let ang = -Math.PI / 2 - span / 2;
    const order = ar ? [...ws.keys()].reverse() : [...ws.keys()];
    const at = {};
    for (const i of order) { at[i] = ang + (lens[i] / R) / 2; ang += lens[i] / R; }
    // الدايرة كلها جوه الكادر
    const m = base * 1.2;
    const cx = clamp(hd.x, R + m, w - R - m), cy = clamp(hd.y, R + m * 1.5, h - m);
    let html = backdrop(this, th);
    ws.forEach((x, i) => {
      if (t < x.t0) return;
      const e = eBack(seg(t, x.t0, x.t0 + 0.16));
      const s = this.text(x.w), sz = sizes[i], a = at[i], f = fam(s, "TY Outfit", "SM Lalezar");
      const chars = AR.test(s) ? [s] : [...s];   // العربي متوصل: الكلمة كلها على المماس
      let off = -measure(s, `800 ${sz}px ${f}`) / 2;
      for (const ch of chars) {
        const cw = measure(ch, `800 ${sz}px ${f}`), aa = a + (off + cw / 2) / R;
        const x0 = cx + Math.cos(aa) * R, y0 = cy + Math.sin(aa) * R;
        html += `<div style="position:absolute;left:${x0.toFixed(1)}px;top:${y0.toFixed(1)}px;transform:translate(-50%,-50%) rotate(${(aa + Math.PI / 2).toFixed(4)}rad) scale(${e.toFixed(3)});
          font:800 ${sz.toFixed(1)}px ${f};color:${i === b.focus ? (th.accent || RED) : inkOf(this, th)};white-space:pre;line-height:1;${shadow(this)}">${esc(ch)}</div>`;
        off += cw;
      }
    });
    return html;
  };

  // ---------- artype: كتابة بمؤشر برتقاني ونقطة وخط متعرج
  P.k_artype = function (b, t, k, th) {
    const { w, h } = this.doc;
    const ws = this.words(b);
    const full = ws.map((x) => this.text(x.w)).join(" ");
    const dir = this.dir(full);
    const size = Math.min(w, h) * 0.07 * this.ts;
    const ink = onVideo(this) ? "#FFFFFF" : (th.ink === "#F4F4F2" ? th.ink : NAVY);
    const bgc = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${th.ink === "#F4F4F2" ? th.bg : "#F4EFE9"}"></div>`;
    const focus = b.focus >= 0 ? b.focus : ws.length - 1;
    let shown = "";
    let typing = false;
    ws.forEach((x, i) => {
      if (t < x.t0) return;
      const chars = [...this.text(x.w)];
      const d = Math.max(0.12, Math.min(0.35, x.t1 - x.t0));
      const n = Math.ceil(chars.length * clamp((t - x.t0) / d));
      if (n < chars.length) typing = true;
      let part = esc(chars.slice(0, n).join(""));
      if (i === focus && n === chars.length) {
        const e = eBack(seg(t, x.t0 + d, x.t0 + d + 0.18));
        const sq = Array.from({ length: 14 }, (_, j) => `${(j / 13 * 100).toFixed(1)},${j % 2 ? 7 : 1}`).join(" ");
        part = `<span style="position:relative;display:inline-block;font-weight:700">${part}
          <i style="position:absolute;left:50%;top:-${(size * 0.18).toFixed(1)}px;width:${(size * 0.2).toFixed(1)}px;height:${(size * 0.2).toFixed(1)}px;border-radius:50%;background:${ORANGE};transform:translate(-50%,0) scale(${e.toFixed(3)})"></i>
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" style="position:absolute;left:0;bottom:-${(size * 0.12).toFixed(1)}px;width:100%;height:${(size * 0.14).toFixed(1)}px;overflow:visible">
            <polyline points="${sq}" fill="none" stroke="${ORANGE}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-dasharray="200" stroke-dashoffset="${(200 * (1 - eOut(seg(t, x.t0 + d, x.t0 + d + 0.3)))).toFixed(1)}"/></svg></span>`;
      }
      shown += (shown ? " " : "") + part;
    });
    const on = typing || Math.floor(t * 2.4) % 2 === 0;
    const caret = `<span style="display:inline-block;width:${(size * 0.07).toFixed(1)}px;height:${(size * 1.05).toFixed(1)}px;background:${ORANGE};vertical-align:-0.18em;margin-inline-start:${(size * 0.12).toFixed(1)}px;opacity:${on ? 1 : 0}"></span>`;
    return bgc + this.center(`<div dir="${dir}" style="font-family:${fam(full, "TY Outfit", "TY PlexAr")};font-weight:400;font-size:${size.toFixed(1)}px;color:${ink};max-width:86%;text-align:center;line-height:1.5;${shadow(this)}">${shown}${caret}</div>`);
  };

  // ---------- redword: كلمة واحدة حمرا في النص
  P.k_redword = function (b, t, k, th) {
    const { w, h } = this.doc;
    const ws = this.words(b);
    // كلمة واحدة: اللي مكتوبة في البلوك، ولو مفيش: الكلمة اللي بتتقال دلوقتي
    const one = String(b.text || "").trim();
    const cur = one && one.split(/\s+/).length <= 2 ? { w: one, t0: b.t0 } : [...ws].reverse().find((x) => t >= x.t0) || ws[0];
    if (!cur) return "";
    const s = this.text(cur.w).replace(/[.,،!?؟]+$/, "") + (/[.!?؟]$/.test(cur.w) ? "." : "");
    const ff = fam(s, "TY Outfit", "TY PlexAr");
    let size = Math.min(w, h) * 0.12 * this.ts;
    const tw = measure(s, `700 ${size}px ${ff}`);
    if (tw > w * 0.8) size *= (w * 0.8) / tw;
    const e = seg(t, cur.t0, cur.t0 + 0.08);
    const col = th.accent || RED;
    return backdrop(this, th) + this.center(`<div dir="${this.dir(s)}" style="font:700 ${size.toFixed(1)}px ${ff};color:${col};letter-spacing:0.02em;
      text-transform:uppercase;filter:blur(${((1 - e) * 5).toFixed(1)}px);text-shadow:0 0 ${(size * 0.25).toFixed(1)}px ${col}66">${esc(s)}</div>`);
  };

  // ---------- signature: إمضا بتتكتب
  P.k_signature = function (b, t, k, th, i) {
    const { w, h } = this.doc;
    const ws = this.words(b);
    const s = (b.sign || b.text || ws.map((x) => x.w).join(" ")).trim();
    const ar = AR.test(s);
    const ff = ar ? "'TY Ruqaa', 'SM Tajawal'" : "'TY Pen', 'TY Outfit'";
    const pen = onVideo(this) || th.ink === "#F4F4F2" ? "#E9E6E0" : th.ink;
    let size = Math.min(w, h) * 0.16 * this.ts;
    const tw = measure(s, `400 ${size}px ${ff}`);
    if (tw > w * 0.86) size *= (w * 0.86) / tw;
    const W2 = Math.min(tw, w * 0.86), cx = w / 2, cy = h * 0.5;
    const t0 = ws[0]?.t0 ?? b.t0, dur = Math.max(0.6, Math.min(1.6, (b.t1 - t0) * 0.7));
    const p = eOut(seg(t, t0, t0 + dur));
    const r = rng(i + 3);
    // خط طويل بلفات بيدخل من برا ويعدّي على أول الكلمة، وخط تحت بعد ما الكتابة تخلص
    const x0 = cx - W2 / 2, y0 = cy;
    const loop = `M${(x0 - w * 0.35).toFixed(1)},${(y0 - h * 0.35).toFixed(1)} C${(x0 - w * 0.1).toFixed(1)},${(y0 - h * 0.2).toFixed(1)} ${(x0 - w * 0.2).toFixed(1)},${(y0 + h * 0.12).toFixed(1)} ${(x0 - w * 0.05).toFixed(1)},${(y0 + h * 0.14).toFixed(1)}
      C${(x0 + w * 0.05).toFixed(1)},${(y0 + h * 0.16).toFixed(1)} ${(x0 + w * 0.02).toFixed(1)},${(y0 - h * 0.08).toFixed(1)} ${(x0 + size * 0.2).toFixed(1)},${(y0 + size * 0.1).toFixed(1)}`;
    const under = `M${(x0 + W2 * 0.1).toFixed(1)},${(y0 + size * 0.42).toFixed(1)} C${(cx).toFixed(1)},${(y0 + size * (0.32 + r() * 0.1)).toFixed(1)} ${(cx + W2 * 0.3).toFixed(1)},${(y0 + size * 0.5).toFixed(1)} ${(x0 + W2 * 1.08).toFixed(1)},${(y0 + size * 0.36).toFixed(1)}`;
    const run = (d, kk, len, sw) => (kk <= 0 ? "" : `<path d="${d}" pathLength="1" fill="none" stroke="${pen}" stroke-width="${sw}" stroke-linecap="round"
      stroke-dasharray="${Math.min(len, clamp(kk)).toFixed(3)} 2" stroke-dashoffset="${(-Math.max(0, kk - len)).toFixed(3)}"/>`);
    const svg = `<svg viewBox="0 0 ${w} ${h}" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">
      ${run(loop, seg(t, t0 - 0.15, t0 + 0.45) * 1.5, 0.6, Math.max(1.5, size * 0.018))}
      ${run(under, seg(t, t0 + dur * 0.85, t0 + dur + 0.35), 1, Math.max(1.5, size * 0.02))}</svg>`;
    const tip = p > 0 && p < 1 ? `<div style="position:absolute;left:${(ar ? x0 + W2 * (1 - p) : x0 + W2 * p).toFixed(1)}px;top:${(cy - size * 0.05 + (r() - 0.5) * size * 0.2).toFixed(1)}px;width:${(size * 0.06).toFixed(1)}px;height:${(size * 0.06).toFixed(1)}px;border-radius:50%;background:#fff;box-shadow:0 0 ${(size * 0.15).toFixed(1)}px #fff;transform:translate(-50%,-50%)"></div>` : "";
    const clip = ar ? `inset(-60% 0 -60% ${((1 - p) * 100).toFixed(2)}%)` : `inset(-60% ${((1 - p) * 100).toFixed(2)}% -60% -5%)`;
    return backdrop(this, th) + svg + `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%) rotate(-3deg);font-family:${ff};font-size:${size.toFixed(1)}px;
      line-height:1.5;white-space:nowrap;color:${pen};-webkit-text-stroke:${(size * 0.012).toFixed(2)}px ${pen};clip-path:${clip};${shadow(this)}">${esc(s)}</div>` + tip;
  };
})();
