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
  E.studioFonts = () => facesP || (facesP = Promise.all([...FACES.map(([fam, file, w]) =>
    new FontFace(fam, `url(/fonts/${file})`, { weight: w }).load().then((f) => document.fonts.add(f)).catch(() => {})),
    ...["SM Lalezar", "SM Changa", "SM Kufi", "SM Tajawal"].map((f) => E.font(f))]));
  E.STUDIO = new Set(["behind", "arc", "artype", "redword", "signature", "poster", "stack", "push", "crt", "ransom", "halo", "floor", "hand", "tags"]);
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
      return { x: a.st.head[0], y: a.st.head[1], r: Math.max(a.st.head[2], Math.min(w, h) * 0.06), top: Math.max(0, a.st.box[1]), has: true,
               solid: (a.st.solid ?? 1) >= 0.6 };
    return { x: w / 2, y: h * 0.42, r: Math.min(w, h) * 0.13, top: h * 0.3, has: false, solid: false, any: !!a?.st };
  };
  // القرار (ورا الراس ولا بعيد عنها) مرة واحدة للبلوك كله، عشان الكلام مايتنططش بين الفريمات
  P.blockSolid = function (b) {
    const p = this.doc.person;
    if (!p?.n) return null;
    this._bs = this._bs || new Map();
    const key = `${b.t0}|${b.t1}`;
    if (!this._bs.has(key)) {
      let n = 0, ok = 0;
      for (let t = b.t0; t <= b.t1; t += 0.1) {
        const hd = this.headAt(t);
        n++; if (hd.solid) ok++;
      }
      this._bs.set(key, n ? ok / n >= 0.6 : false);
    }
    return this._bs.get(key);
  };
  // الكلام اللي في النص بينزل تحت الدقن لو فيه وش (مرة واحدة للبلوك كله)
  P.belowHead = function (b, size) {
    const { h } = this.doc;
    if (!this.blockSolid(b)) return h * 0.5;
    let low = 0;
    for (let t = b.t0; t <= b.t1; t += 0.1) { const hd = this.headAt(t); if (hd.solid) low = Math.max(low, hd.y + hd.r * 1.2); }
    return clamp(low + size * 0.6, h * 0.5, h * 0.64);
  };
  P.atY = function (y, inner) {
    return `<div style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;display:flex;justify-content:center;transform:translateY(-50%)">${inner}</div>`;
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
    const bs = this.blockSolid(b);
    const safe = bs === null || bs;
    let html = backdrop(this, th);
    const maxW = w * 0.9, maxH = h * (h > w ? 0.2 : 0.4) / lines.length;
    lines.forEach((ln, li) => {
      const base = measure(ln, `400 100px ${ff}`) || 100;
      const size = Math.min((maxW / base) * 100, maxH * 1.25);
      // الكلام بيقعد بحيث الراس يغطي الجزء التحتاني منه
      // القصّة مش مضمونة (ضلمة، ضهره للكاميرا): الكلام فوق في الكادر بعيد عن الراس بدل ما يتحط وراها
      const cy = safe ? clamp(hd.top + size * (0.15 + li * 0.95) - (lines.length - 1) * size * 0.45, size * 0.6, h * 0.7)
        : h * 0.06 + size * (0.5 + li * 0.95);
      const t0 = (ws[Math.min(ws.length - 1, li * Math.ceil(ws.length / lines.length))]?.t0) ?? b.t0;
      const e = eOut(seg(t, t0, t0 + 0.22)), out = 1 - seg(t, b.t1 - 0.15, b.t1);
      if (t < t0) return;
      html += `<div style="position:absolute;left:${w / 2}px;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%) scale(${lerp(1.12, 1, e).toFixed(3)},${lerp(0.55, 1, e).toFixed(3)});
        font-family:${ff};font-size:${size.toFixed(1)}px;line-height:1;white-space:nowrap;color:${inkOf(this, th)};opacity:${(e * out).toFixed(3)};
        letter-spacing:-0.01em;filter:blur(${((1 - e) * 8).toFixed(1)}px);${onVideo(this) ? "text-shadow:0 6px 30px rgba(0,0,0,.25);" : ""}" dir="${this.dir(ln)}">${esc(ln)}</div>`;
    });
    return html + (bs ? this.personLayer(t) : "");
  };

  // ---------- arc: الكلام متقوّس حوالين الراس
  P.k_arc = function (b, t, k, th) {
    const { w, h } = this.doc;
    const ws = this.words(b);
    const hd = this.headAt(t);
    let R = Math.min(Math.max(hd.r * 2.1, Math.min(w, h) * 0.22), Math.min(w, h) * 0.4);
    const pad = Math.min(w, h) * 0.075 * this.ts * 1.2;
    // الراس قريبة من حرف الكادر: الدايرة بتصغر بس بتفضل حوالين الراس (ماتعديش فوقها)
    if (hd.solid) R = Math.max(hd.r * 1.7, Math.min(R, hd.x - pad, w - hd.x - pad, hd.y - pad * 1.5));
    const ar = AR.test(ws.map((x) => x.w).join(""));
    const base = Math.min(w, h) * 0.075 * this.ts;
    // كل كلمة بزاويتها (من فوق الشمال لفوق اليمين حوالين الراس)
    let sizes = ws.map((x, i) => (i === b.focus ? base * 1.6 : base));
    let lens = ws.map((x, i) => measure(this.text(x.w) + " ", `800 ${sizes[i]}px ${fam(x.w, "TY Outfit", "SM Lalezar")}`));
    let total = lens.reduce((a, c) => a + c, 0);
    // الكلام أطول من القوس: الخط بيصغر بدل ما الكلمات تركب على بعض
    const room = Math.PI * 1.2 * R;
    if (total > room) { const f = room / total; sizes = sizes.map((z) => z * f); lens = lens.map((z) => z * f); total = room; }
    const span = Math.min(Math.PI * 1.25, total / R);
    let ang = -Math.PI / 2 - span / 2;
    const order = ar ? [...ws.keys()].reverse() : [...ws.keys()];
    const at = {};
    for (const i of order) { at[i] = ang + (lens[i] / R) / 2; ang += lens[i] / R; }
    // الدايرة كلها جوه الكادر
    const m = base * 1.2;
    // القصّة مش مضمونة: القوس فوق في الكادر بدل ما نخمّن مكان الراس
    const guess = this.blockSolid(b) === false || (!hd.solid && (hd.has || hd.any));
    const cx = guess ? w / 2 : clamp(hd.x, R + m, w - R - m), cy = guess ? R + m * 1.5 : clamp(hd.y, R + m * 1.5, h - m);
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
    return bgc + this.atY(this.belowHead(b, size), `<div dir="${dir}" style="font-family:${fam(full, "TY Outfit", "TY PlexAr")};font-weight:400;font-size:${size.toFixed(1)}px;color:${ink};max-width:86%;text-align:center;line-height:1.5;${shadow(this)}">${shown}${caret}</div>`);
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
    return backdrop(this, th) + this.atY(this.belowHead(b, size), `<div dir="${this.dir(s)}" style="font:700 ${size.toFixed(1)}px ${ff};color:${col};letter-spacing:0.02em;
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
    const W2 = Math.min(tw, w * 0.86), cx = w / 2, cy = this.belowHead(b, size);
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

  // =====================================================================
  // الدفعة التانية من عناصر الفيديوهات المرجعية
  //   poster  بوستر أحمر مالي الشاشة بكلام أسود مضغوط (14، 16)
  //   stack   كومة كلام مايلة أبيض صغير وأحمر كبير، في الناحية الفاضية جنب الشخص (11، 12)
  //   push    كلمة بتزق اللي قبلها (10)
  //   crt     كلام منوّر ضبابي بحواف أحمر وأزرق وجلتش على كل كلمة (19)
  //   ransom  حروف مقصوصة من مجلات، كل حرف بلون وخط (10)
  //   halo    دايرة متقطعة بتلف حوالين الراس والكلام بخط إيد حواليها (16)
  //   floor   كلام نايم على الأرض بمنظور ومنوّر (13)
  //   hand    خط إيد بيرتعش بحواف خضرا وبنفسجي زي الفيلم (17، 21)
  //   tags    كلمات على مربعات حمرا (14)
  // =====================================================================
  const POP = (t, t0, d = 0.14) => ({ a: seg(t, t0, t0 + 0.05), s: lerp(0.6, 1, eOut(seg(t, t0, t0 + d))) });

  // الكلام اللي هيتكتب بأوقاته: نص البلوك لو مكتوب، وإلا الكلام المتقال
  P.items = function (b) {
    const ws = this.words(b);
    const txt = String(b.text || "").trim();
    if (!txt || txt === ws.map((x) => x.w).join(" ")) return ws.map((x) => ({ w: x.w, t0: x.t0 }));
    const toks = txt.split(/\s+/);
    return toks.map((w, i) => ({ w, t0: ws.length ? ws[Math.min(ws.length - 1, Math.floor((i * ws.length) / toks.length))].t0 : b.t0 + i * 0.25 }));
  };
  // المساحة الفاضية للكلام في البلوك ده: جنب الحاجة اللي في الفيديو (anchor)، أو الناحية التانية من الشخص، أو النص
  P.freeRect = function (b) {
    const { w, h } = this.doc;
    this._fr = this._fr || new Map();
    const key = `${b.t0}|${b.t1}|${b.anchor || ""}|${b.place || ""}`;
    if (this._fr.has(key)) return this._fr.get(key);
    const mid = (b.t0 + b.t1) / 2, m = Math.min(w, h) * 0.05;
    let r = null;
    const bx = b.anchor && this.anchorBox(b.anchor, mid);
    const pa = this.personAt(mid)?.st;
    if (bx) r = this.placeRect(bx, b.place);
    else if (pa && !this.blockSolid(b)) {
      // الشخص باين بس قصّته مش مضمونة: الكلام في الناحية البعيدة عن جسمه كله
      const [x0, , x1] = pa.box, lw = x0 - m * 2, rw = w - x1 - m * 2;
      if (Math.max(lw, rw) > w * 0.3) r = lw > rw ? { x: m, y: h * 0.14, w: lw, h: h * 0.56, side: "left" } : { x: x1 + m, y: h * 0.14, w: rw, h: h * 0.56, side: "right" };
      else r = { x: m, y: m * 1.5, w: w - m * 2, h: h * 0.24, side: "above" };
    } else if (this.blockSolid(b)) {
      const hd = this.headAt(mid), a = this.personAt(mid), box = a?.st?.box;
      const gap = hd.r * 1.5;
      const left = { x: m, w: hd.x - gap - m }, right = { x: hd.x + gap, w: w - m - hd.x - gap };
      const side = left.w > right.w ? left : right;
      if (side.w > w * 0.3) r = { x: side.x, y: h * 0.14, w: side.w, h: h * 0.56, side: side === left ? "left" : "right" };
      else r = { x: m, y: Math.min(h * 0.62, (box ? box[3] : h * 0.6)), w: w - m * 2, h: h * 0.24, side: "below" };
      if (r.side === "below" && r.y + r.h > h * 0.9) r = { x: m, y: m, w: w - m * 2, h: Math.max(h * 0.18, hd.top - m * 2), side: "above" };
    }
    if (!r) r = { x: w * 0.08, y: h * 0.2, w: w * 0.84, h: h * 0.56, side: "center" };
    this._fr.set(key, r);
    return r;
  };

  // ---------- poster
  P.k_poster = function (b, t, k, th) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const ar = AR.test(it.map((x) => x.w).join(""));
    const ff = ar ? "'SM Lalezar', 'SM Tajawal'" : "'TY Anton', 'TY Outfit'";
    const per = it.length <= 2 ? 1 : it.length <= 4 ? 2 : 3;
    const lines = [];
    for (let i = 0; i < it.length; i += per) lines.push(it.slice(i, i + per));
    while (lines.length > 4) { const x = lines.pop(); lines[lines.length - 1].push(...x); }
    const up = (s) => (ar ? s : s.toUpperCase());
    const maxH = (h * 0.8) / lines.length;
    const sizes = lines.map((ln) => Math.min(((w * 0.94) / (measure(up(ln.map((x) => x.w).join(" ")), `400 100px ${ff}`) || 100)) * 100, maxH / 1.0));
    const total = sizes.reduce((a, c) => a + c * 0.98, 0);
    let y = (h - total) / 2;
    let html = `<div style="position:absolute;inset:0;background:${RED}"></div>`;
    lines.forEach((ln, li) => {
      const sz = sizes[li];
      const shown = ln.filter((x) => t >= x.t0);
      if (shown.length) {
        const last = shown[shown.length - 1], p = POP(t, last.t0);
        html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${ar ? "right" : "left"}:${(w * 0.03).toFixed(1)}px;top:${(y + sz * 0.49).toFixed(1)}px;transform:translateY(-50%) scaleY(1.1);
          font-family:${ff};font-size:${sz.toFixed(1)}px;line-height:1;white-space:nowrap;color:#0B0B0B;letter-spacing:-0.01em">${shown.map((x, j) =>
            `<span style="display:inline-block;${x === last ? `opacity:${p.a.toFixed(3)};transform:scale(${p.s.toFixed(3)});transform-origin:50% 60%;` : ""}">${esc(up(x.w))}</span>`).join(" ")}</div>`;
      }
      y += sz * 0.98;
    });
    return html;
  };

  // ---------- stack
  P.k_stack = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const r = this.freeRect(b);
    const ar = AR.test(it.map((x) => x.w).join(""));
    const big = new Set([b.focus >= 0 ? b.focus : -1, ...it.map((x, i) => [i, x.w.length]).sort((a, c) => c[1] - a[1]).slice(0, Math.max(1, Math.floor(it.length / 3))).map((x) => x[0])]);
    const fw = ar ? "'SM Lalezar', 'SM Tajawal'" : "'TY Outfit', 'SM Tajawal'";
    const fs = ar ? "'TY PlexAr', 'SM Tajawal'" : "'TY Outfit', 'SM Tajawal'";
    const base = Math.min(w, h) * 0.065 * this.ts;
    let rows = it.map((x, i) => {
      const bg = big.has(i);
      let sz = bg ? Math.min(base * 3.2, (r.w * 0.92) / Math.max(1, measure(x.w, `800 100px ${fw}`) / 100)) : base;
      return { ...x, bg, sz, rot: bg ? -(9 + ((i * 37 + bi * 11) % 11)) : 0 };
    });
    let tot = rows.reduce((a, c) => a + c.sz * (c.bg ? 0.95 : 1.25), 0);
    if (tot > r.h) { const f = r.h / tot; rows = rows.map((x) => ({ ...x, sz: x.sz * f })); tot = r.h; }
    let y = r.y + (r.h - tot) / 2, html = backdrop(this, th);
    const ink = inkOf(this, th), red = th.accent || RED;
    rows.forEach((x, i) => {
      const hh = x.sz * (x.bg ? 0.95 : 1.25);
      if (t >= x.t0) {
        const p = POP(t, x.t0, 0.12);
        const cx = x.bg ? r.x + r.w / 2 + ((i % 2 ? 1 : -1) * r.w * 0.05) : (ar ? r.x + r.w * 0.8 : r.x + r.w * 0.2);
        html += `<div dir="${this.dir(x.w)}" style="position:absolute;left:${cx.toFixed(1)}px;top:${(y + hh / 2).toFixed(1)}px;transform:translate(-50%,-50%) rotate(${x.rot}deg) scale(${p.s.toFixed(3)});opacity:${p.a.toFixed(3)};
          font:${x.bg ? 800 : 600} ${x.sz.toFixed(1)}px ${x.bg ? fw : fs};letter-spacing:${x.bg ? "-0.045em" : "-0.02em"};white-space:nowrap;line-height:1;color:${x.bg ? red : ink};${shadow(this)}">${esc(this.text(x.w))}</div>`;
      }
      y += hh;
    });
    return html;
  };

  // ---------- push
  P.k_push = function (b, t, k, th) {
    const { w } = this.doc;
    const it = this.items(b);
    const ar = AR.test(it.map((x) => x.w).join(""));
    const dir = ar ? -1 : 1;
    const size = Math.min(w, this.doc.h) * 0.085 * this.ts;
    const y = this.belowHead(b, size);
    const ff = ar ? "'TY PlexAr', 'SM Tajawal'" : "'TY Outfit', 'SM Tajawal'";
    let html = backdrop(this, th);
    it.forEach((x, i) => {
      const t1 = it[i + 1]?.t0 ?? b.t1 + 9;
      if (t < x.t0 - 0.05 || t > t1 + 0.25) return;
      const kin = eOut(seg(t, x.t0 - 0.05, x.t0 + 0.12)), kout = eOut(seg(t, t1, t1 + 0.25));
      const cx = w / 2 + dir * ((1 - kin) * w * 0.2 - kout * w * 0.24);
      html += `<div dir="${this.dir(x.w)}" style="position:absolute;left:${cx.toFixed(1)}px;top:${y.toFixed(1)}px;transform:translate(-50%,-50%);opacity:${(kin * (1 - kout)).toFixed(3)};
        filter:blur(${((1 - kin) * 6 + kout * 6).toFixed(1)}px);font:${ar ? 700 : 800} ${size.toFixed(1)}px ${ff};letter-spacing:-0.03em;white-space:nowrap;color:${inkOf(this, th)};${shadow(this)}">${esc(this.text(x.w))}</div>`;
    });
    return html;
  };

  // ---------- crt
  P.k_crt = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const ar = AR.test(it.map((x) => x.w).join(""));
    const ff = ar ? "'TY PlexAr', 'SM Tajawal'" : "'TY Outfit', 'SM Tajawal'";
    const shown = it.filter((x) => t >= x.t0);
    const per = it.length <= 3 ? 1 : it.length <= 6 ? 2 : 3;
    const lines = [];
    for (let i = 0; i < it.length; i += per) lines.push(it.slice(i, i + per));
    const widest = Math.max(...lines.map((ln) => measure(ln.map((x) => this.text(x.w).toUpperCase()).join(" "), `800 100px ${ff}`)), 1);
    const size = Math.min((w * 0.78 / widest) * 100, (h * 0.5) / lines.length / 1.1, Math.min(w, h) * 0.16);
    const inner = lines.map((ln) => ln.filter((x) => t >= x.t0)).filter((ln) => ln.length)
      .map((ln) => `<div style="font:800 ${size.toFixed(1)}px ${ff};letter-spacing:-0.035em;line-height:1.08;white-space:nowrap" dir="${ar ? "rtl" : "ltr"}">${esc(ln.map((x) => (ar ? x.w : this.text(x.w).toUpperCase())).join(" "))}</div>`).join("");
    const sp = Math.max(3, size * 0.05);
    const box = (css) => `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;${css}">${inner}</div>`;
    const fl = 0.93 + rng(Math.floor(t * 30) + 7)() * 0.1;
    let txt = `<div style="position:absolute;inset:0;opacity:${fl.toFixed(3)}">
      ${box("color:#fff;filter:blur(" + (size * 0.35).toFixed(1) + "px);opacity:.55;transform:scale(1.04)")}${box("color:#fff;filter:blur(" + (size * 0.09).toFixed(1) + "px);opacity:.6")}
      ${box(`color:#ff2a1e;filter:blur(1.6px);transform:translateX(${-sp}px)`)}${box(`color:#1e74ff;filter:blur(1.6px);transform:translateX(${sp}px);mix-blend-mode:screen`)}
      ${box("color:#fff;filter:blur(1.2px)")}</div>`;
    // جلتش أول كل كلمة: نطة، أو نسخة مزاحة، أو شريحة متكبّرة
    const cur = shown[shown.length - 1];
    if (cur && t - cur.t0 < 0.09) {
      const r = rng(Math.floor(cur.t0 * 100) + bi), kind = ["jump", "double", "slice"][Math.floor(r() * 3)];
      if (kind === "jump") txt = `<div style="position:absolute;inset:0;transform:translate(${((r() - 0.5) * w * 0.03).toFixed(1)}px,${((r() - 0.5) * h * 0.03).toFixed(1)}px)">${txt}</div>`;
      else if (kind === "double") txt += `<div style="position:absolute;inset:0;transform:translateY(${(size * 0.5).toFixed(1)}px);opacity:.45">${txt}</div>`;
      else {
        const y0 = 35 + r() * 25;
        txt += `<div style="position:absolute;inset:0;clip-path:inset(${y0.toFixed(1)}% 0 ${(100 - y0 - 6).toFixed(1)}% 0);transform:translateX(${((r() - 0.5) * w * 0.08).toFixed(1)}px) scale(1.06)">${txt}</div>`;
      }
    }
    const roll = ((t * 0.35) % 1) * h;
    const under = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(10,4,4,.6)"></div>` : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%, #2a1212 0%, #0a0606 75%)"></div>`;
    return under + txt
      + `<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 2px, transparent 2px 5px);pointer-events:none"></div>`
      + `<div style="position:absolute;left:0;right:0;top:${roll.toFixed(1)}px;height:${(h * 0.05).toFixed(1)}px;background:linear-gradient(transparent, rgba(255,255,255,.07), transparent)"></div>`
      + `<div style="position:absolute;inset:0;box-shadow:inset 0 0 ${(Math.min(w, h) * 0.18).toFixed(0)}px rgba(0,0,0,.85)"></div>`;
  };

  // ---------- ransom
  const PAPERS = [["#E5261F", "#FFFFFF"], ["#111111", "#F2E9D8"], ["#FFFFFF", "#121A2E"], ["#E5261F", "#111111"], ["#111111", "#F7D046"], ["#FFFFFF", "#7A3FC8"], ["#121A2E", "#E8E2D6"]];
  const LAT = ["400 1em 'TY Anton'", "800 1em 'TY Gabarito'", "400 0.8em 'TY Rock'", "800 1em 'TY Outfit'", "700 1em 'TY Readex'", "800 1em 'TY Urbanist'"];
  const ARF = ["400 1em 'SM Lalezar'", "700 1em 'TY Ruqaa'", "700 1em 'TY PlexAr'", "700 1em 'SM Changa'", "700 1em 'SM Kufi'"];
  P.k_ransom = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const r = this.freeRect(b);
    const chips = [];
    it.forEach((x, wi) => {
      const ar = AR.test(x.w);
      const parts = ar ? [x.w] : [...this.text(x.w).toUpperCase()];
      parts.forEach((c, j) => chips.push({ c, ar, t0: x.t0 + j * 0.035, wi, n: chips.length }));
    });
    const rr = rng(bi * 13 + 5);
    chips.forEach((c) => { c.p = PAPERS[Math.floor(rr() * PAPERS.length)]; c.f = (c.ar ? ARF : LAT)[Math.floor(rr() * (c.ar ? ARF : LAT).length)]; c.rot = (rr() - 0.5) * 14; c.dy = (rr() - 0.5) * 0.2; });
    let size = Math.min(w, h) * 0.11 * this.ts;
    const lay = (sz) => {
      const rows = [[]];
      let x = 0;
      chips.forEach((c) => {
        c.font = c.f.replace(/^(\d+) ([\d.]+)em /, (m0, wt, em) => `${wt} ${(sz * em).toFixed(1)}px `);
        c.cw = measure(c.c, c.font) + sz * 0.3;
      });
      // الكلمة كلها بتنزل السطر اللي بعده لو مش هتكفي (ماتتقسمش من النص)
      const wordW = {};
      chips.forEach((c) => { wordW[c.wi] = (wordW[c.wi] || 0) + c.cw + sz * 0.04; });
      chips.forEach((c, i) => {
        const first = i === 0 || chips[i - 1].wi !== c.wi;
        const gap = first ? sz * 0.35 : sz * 0.04;
        const need = first ? wordW[c.wi] : c.cw;
        if (x + gap + need > r.w && rows[rows.length - 1].length && (first || x + gap + c.cw > r.w)) { rows.push([]); x = 0; } else x += rows[rows.length - 1].length ? gap : 0;
        c.x = x; x += c.cw; rows[rows.length - 1].push(c);
      });
      return rows;
    };
    let rows = lay(size);
    while (rows.length * size * 1.35 > r.h && size > 8) { size *= 0.88; rows = lay(size); }
    const rtl = AR.test(it.map((x) => x.w).join(""));
    let html = backdrop(this, th);
    const top = r.y + (r.h - rows.length * size * 1.35) / 2;
    rows.forEach((row, ri) => {
      const rw = row.length ? row[row.length - 1].x + row[row.length - 1].cw : 0;
      const ox = r.x + (r.w - rw) / 2;
      row.forEach((c) => {
        if (t < c.t0) return;
        const p = POP(t, c.t0, 0.1);
        const cx = rtl ? ox + rw - c.x - c.cw / 2 : ox + c.x + c.cw / 2;
        html += `<div dir="${c.ar ? "rtl" : "ltr"}" style="position:absolute;left:${cx.toFixed(1)}px;top:${(top + (ri + 0.5 + c.dy) * size * 1.35).toFixed(1)}px;transform:translate(-50%,-50%) rotate(${c.rot.toFixed(1)}deg) scale(${p.s.toFixed(3)});opacity:${p.a.toFixed(3)};
          background:${c.p[1]};color:${c.p[0]};font:${c.font};line-height:1.05;padding:${(size * 0.06).toFixed(1)}px ${(size * 0.12).toFixed(1)}px;white-space:nowrap;
          box-shadow:0 ${(size * 0.06).toFixed(1)}px ${(size * 0.14).toFixed(1)}px rgba(0,0,0,.35);outline:${Math.max(2, size * 0.035).toFixed(1)}px solid #fff">${esc(c.c)}</div>`;
      });
    });
    return html;
  };

  // ---------- halo
  P.k_halo = function (b, t, k, th) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const mn = Math.min(w, h);
    const solid = this.blockSolid(b);
    const hd = this.headAt(t);
    const R = solid ? clamp(hd.r * 1.5, mn * 0.14, mn * 0.36) : mn * 0.22;
    const cx = solid ? hd.x : w / 2, cy = solid ? hd.y : h * 0.32;
    const sw = Math.max(3, mn * 0.007);
    const ring = `<svg style="position:absolute;left:${(cx - R - sw).toFixed(1)}px;top:${(cy - R - sw).toFixed(1)}px;overflow:visible;opacity:${seg(t, b.t0, b.t0 + 0.2).toFixed(3)}" width="${(R * 2 + sw * 2).toFixed(1)}" height="${(R * 2 + sw * 2).toFixed(1)}">
      <circle cx="${(R + sw).toFixed(1)}" cy="${(R + sw).toFixed(1)}" r="${R.toFixed(1)}" fill="none" stroke="#fff" stroke-width="${sw.toFixed(1)}" stroke-dasharray="${(R * 0.24).toFixed(1)} ${(R * 0.2).toFixed(1)}" stroke-dashoffset="${(-(t - b.t0) * R * 0.7).toFixed(1)}" opacity=".9"/></svg>`;
    // الكلام بيتوزع حوالين الدايرة: فوق، شمال، يمين، تحت شمال، تحت يمين
    const ANG = [-90, 200, -20, 150, 30, -135, -45];
    const ar = AR.test(it.map((x) => x.w).join(""));
    const ff = ar ? "'TY Ruqaa', 'SM Tajawal'" : "'TY Rock', 'TY Outfit'";
    let html = backdrop(this, th) + ring;
    it.forEach((x, i) => {
      if (t < x.t0) return;
      const focus = i === b.focus || (b.focus < 0 && i === it.length - 1);
      let sz = mn * (focus ? 0.085 : 0.06) * this.ts * (ar ? 1.25 : 1);
      const tw = measure(x.w, `400 ${sz}px ${ff}`);
      if (tw > w * 0.44) sz *= (w * 0.44) / tw;
      const a = (ANG[i % ANG.length] * Math.PI) / 180, rr = R + sz * 0.9 + (i >= ANG.length ? sz * 1.3 : 0);
      const tw2 = measure(x.w, `400 ${sz}px ${ff}`);
      const px = clamp(cx + Math.cos(a) * (rr + Math.abs(Math.cos(a)) * tw2 * 0.45), tw2 / 2 + mn * 0.03, w - tw2 / 2 - mn * 0.03);
      const py = clamp(cy + Math.sin(a) * rr, sz, h - sz);
      const p = POP(t, x.t0);
      html += `<div dir="${this.dir(x.w)}" style="position:absolute;left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;transform:translate(-50%,-50%) rotate(${(focus ? 8 : (i % 2 ? -4 : 3))}deg) scale(${p.s.toFixed(3)});opacity:${p.a.toFixed(3)};
        font:400 ${sz.toFixed(1)}px ${ff};white-space:nowrap;line-height:1.2;color:${focus ? th.accent || RED : onVideo(this) ? "#fff" : th.ink};${shadow(this)}">${esc(this.text(x.w))}</div>`;
    });
    return html;
  };

  // ---------- floor
  P.k_floor = function (b, t, k, th) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const ar = AR.test(it.map((x) => x.w).join(""));
    const ff = ar ? "'SM Lalezar', 'SM Tajawal'" : "'TY Outfit', 'SM Tajawal'";
    const per = it.length <= 3 ? it.length : Math.ceil(it.length / 2);
    const lines = [it.slice(0, per), it.slice(per)].filter((l) => l.length);
    const widest = Math.max(...lines.map((ln) => measure(ln.map((x) => this.text(x.w)).join(" "), `800 100px ${ff}`)), 1);
    const size = Math.min((w * 0.86 / widest) * 100, Math.min(w, h) * 0.17);
    const drift = (t - b.t0) * size * 0.25;
    let html = backdrop(this, th);
    const ink = onVideo(this) ? "255,250,242" : th.ink === "#F4F4F2" ? "244,244,242" : "18,26,46";
    lines.forEach((ln, li) => {
      const shown = ln.filter((x) => t >= x.t0);
      if (!shown.length) return;
      const last = shown[shown.length - 1], p = POP(t, last.t0, 0.18);
      const y = h * (lines.length > 1 ? 0.7 + li * 0.13 : 0.78) - drift;
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${w / 2}px;top:${y.toFixed(1)}px;transform:translate(-50%,-50%) perspective(${(h * 0.6).toFixed(0)}px) rotateX(58deg);
        font:800 ${size.toFixed(1)}px ${ff};letter-spacing:-0.03em;white-space:nowrap;color:rgba(${ink},.9);text-shadow:0 0 ${(size * 0.3).toFixed(0)}px rgba(255,240,220,.45),0 6px 18px rgba(0,0,0,.35)">${shown.map((x) =>
          `<span style="display:inline-block;${x === last ? `opacity:${p.a.toFixed(3)};transform:scale(${p.s.toFixed(3)})` : ""}">${esc(this.text(x.w))}</span>`).join(" ")}</div>`;
    });
    return html;
  };

  // ---------- hand
  P.k_hand = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const ar = AR.test(it.map((x) => x.w).join(""));
    const ff = ar ? "'TY Ruqaa', 'SM Tajawal'" : "'TY Rock', 'TY Outfit'";
    let size = Math.min(w, h) * 0.085 * this.ts * (ar ? 1.3 : 1);
    const full = it.map((x) => this.text(x.w)).join(" ");
    const tw = measure(full, `400 ${size}px ${ff}`);
    const nLines = Math.max(1, Math.ceil(tw / (w * 0.84)));
    if (nLines > 3) size *= (3 * w * 0.84) / tw;
    const cy = this.blockSolid(b) ? this.belowHead(b, size * Math.min(3, nLines)) : h * 0.5;
    const j = rng(Math.floor(t * 12) * 7 + bi);   // رعشة 12 فريم في الثانية زي الفيلم
    const dx = (j() - 0.5) * size * 0.05, dy = (j() - 0.5) * size * 0.05, rot = (j() - 0.5) * 1.6;
    const ink = onVideo(this) ? "#E8DDE0" : th.ink;
    const words = it.map((x) => {
      const kk = seg(t, x.t0, x.t0 + 0.28);
      const clip = ar ? `inset(-40% 0 -40% ${((1 - kk) * 100).toFixed(1)}%)` : `inset(-40% ${((1 - kk) * 100).toFixed(1)}% -40% -10%)`;
      return `<span style="display:inline-block;clip-path:${clip}">${esc(this.text(x.w))}</span>`;
    }).join(" ");
    const layer = (col, ox, op) => `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(w * 0.08 + ox).toFixed(1)}px;right:${(w * 0.08 - ox).toFixed(1)}px;top:${cy.toFixed(1)}px;transform:translateY(-50%);
      text-align:center;font:400 ${size.toFixed(1)}px ${ff};line-height:1.35;color:${col};opacity:${op}">${words}</div>`;
    const o = size * 0.035;
    return backdrop(this, th) + `<div style="position:absolute;inset:0;transform:translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg);filter:blur(0.6px) drop-shadow(0 0 ${(size * 0.12).toFixed(1)}px ${onVideo(this) ? "rgba(255,240,230,.45)" : "transparent"})">
      ${layer("#7fd08a", -o, 0.7)}${layer("#c25aa8", o, 0.65)}${layer(ink, 0, 1)}</div>`;
  };

  // ---------- tags
  P.k_tags = function (b, t, k, th) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const r = this.freeRect(b);
    const ar = AR.test(it.map((x) => x.w).join(""));
    const ff = ar ? "'TY PlexAr', 'SM Tajawal'" : "'TY Outfit', 'SM Tajawal'";
    let size = Math.min(w, h) * 0.065 * this.ts;
    const widest = Math.max(...it.map((x) => measure(this.text(x.w), `700 ${size}px ${ff}`)), 1);
    if (widest + size * 0.8 > r.w * 0.8) size *= (r.w * 0.8) / (widest + size * 0.8);
    const step = Math.min(size * 1.55, r.h / Math.max(1, it.length));
    if (step < size * 1.3) size = step / 1.3;
    const top = r.y + (r.h - step * it.length) / 2;
    let html = backdrop(this, th);
    it.forEach((x, i) => {
      if (t < x.t0) return;
      const p = POP(t, x.t0, 0.12);
      const off = [0, 0.18, 0.06, 0.24, 0.1][i % 5] * r.w;
      const pos = ar ? `right:${(w - (r.x + r.w) + off).toFixed(1)}px` : `left:${(r.x + off).toFixed(1)}px`;
      html += `<div dir="${this.dir(x.w)}" style="position:absolute;${pos};top:${(top + step * (i + 0.5)).toFixed(1)}px;transform:translateY(-50%) scale(${p.s.toFixed(3)});transform-origin:${ar ? "100%" : "0"} 50%;opacity:${p.a.toFixed(3)};
        background:${th.accent || RED};color:#fff;font:700 ${size.toFixed(1)}px ${ff};letter-spacing:-0.02em;padding:${(size * 0.04).toFixed(1)}px ${(size * 0.22).toFixed(1)}px ${(size * 0.12).toFixed(1)}px;border-radius:${(size * 0.12).toFixed(1)}px;white-space:nowrap;line-height:1.1">${esc(this.text(x.w))}</div>`;
    });
    return html;
  };
})();
