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
  E.STUDIO = new Set(["behind", "arc", "artype", "redword", "signature", "poster", "stack", "push", "crt", "ransom", "halo", "floor", "hand", "tags",
    "space", "route", "board", "cube", "comments", "lock", "thermal", "shapes", "select", "chat", "counter",
    "fill", "polaroid", "cards", "burst", "dots", "neon",
    "outline", "spin", "sweep", "extrude", "stories", "post",
    "retro", "duotone", "label", "mirror", "banners", "tiles", "bubble", "band"]);
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
    const n = String(i).padStart(5, "0");
    return { i, url: `${p.base}${n}.webp`, murl: p.mbase ? `${p.mbase}${n}.webp` : "", st: p.frames?.[i] || null, img: p.img };
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
  // الكلام اللي ورا الشخص: بدل ما نحط صورة الشخص فوق الكلام، بنقص شكل الشخص من الكلام نفسه
  // فالشخص اللي بيبان هو الفيديو الأصلي بجودته وألوانه (من غير صورة مكبّرة ولا اختلاف لون)
  P.behindPerson = function (t, inner) {
    const a = this.personAt(t);
    if (!a || !this.doc.transparent) return inner + (a ? this.personLayer(t) : "");
    const { x, y, w, h } = a.img;
    const src = a.murl || a.url;
    this._want = src;
    const m = `linear-gradient(#000,#000) 0 0/100% 100% no-repeat, url(${src}) ${x.toFixed(1)}px ${y.toFixed(1)}px/${w.toFixed(1)}px ${h.toFixed(1)}px no-repeat`;
    return `<img src="${src}" alt="" style="position:absolute;width:1px;height:1px;opacity:0">`
      + `<div style="position:absolute;inset:0;-webkit-mask:${m};-webkit-mask-composite:xor;mask:${m};mask-composite:exclude">${inner}</div>`;
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
  // لازم الصورة تبقى اتحملت واتفكّت فعلًا (decode) وبعدين يحصل رسم واحد على الأقل: قص الشخص من الكلام (mask)
  // بيستخدم الصورة دي، ولو الفريم اتصوّر قبلها الكلام بيطلع كامل فوق الراس
  P.settle = function () {
    const imgs = [...this.stage.querySelectorAll("img")];
    const one = (i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = i.onerror = r; })).then(() => (i.decode ? i.decode().catch(() => {}) : null));
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Promise.all(imgs.map(one)).then(imgs.length ? frame : null);
  };
  // المعاينة: الفريمات اللي جاية بتتحمل قبلها عشان مايبقاش فيه رعشة
  P.prefetchPerson = function (t) {
    const p = this.doc.person;
    if (!p?.n) return;
    this._pc = this._pc || new Map();
    for (let j = 0; j < 12; j++) {
      const i = clamp(Math.round(t * p.fps) + j, 0, p.n - 1);
      if (this._pc.has(i)) continue;
      const im = new Image(); im.src = `${p.mbase || p.base}${String(i).padStart(5, "0")}.webp`; this._pc.set(i, im);
      if (this._pc.size > 240) this._pc.delete(this._pc.keys().next().value);
    }
  };

  const onVideo = (eng) => !!eng.doc.transparent;
  const inkOf = (eng, th) => (onVideo(eng) ? "#FFFFFF" : th.ink);
  const shadow = (eng) => (onVideo(eng) ? "text-shadow:0 4px 22px rgba(0,0,0,.35);" : "");
  const fam = (s, latin, arabic) => (AR.test(s) ? `'${arabic}', 'SM Tajawal'` : `'${latin}', 'TY Outfit'`);
  const backdrop = (eng, th) => (onVideo(eng) ? "" : `<div style="position:absolute;inset:0;background:${th.bg}"></div>`);

  // ---------- behind: كلام عملاق ورا الشخص
  // مكان الراس الثابت للبلوك كله (الوسيط من الفريمات اللي القصّة فيها مضمونة): الكلام اللي وراه مايترعشش مع حركة الراس
  P.blockHead = function (b) {
    this._bh = this._bh || new Map();
    const key = `${b.t0}|${b.t1}`;
    if (!this._bh.has(key)) {
      const hs = [];
      for (let t = b.t0; t <= b.t1; t += 0.1) { const hd = this.headAt(t); if (hd.solid) hs.push(hd); }
      const med = (f) => { const v = hs.map(f).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
      this._bh.set(key, hs.length ? { x: med((q) => q.x), y: med((q) => q.y), r: med((q) => q.r), top: med((q) => q.top) } : null);
    }
    return this._bh.get(key);
  };
  // مقاسات الحبر الحقيقية للكلمة (عشان نحط الحروف نفسها في المكان، مش الصندوق اللي حواليها)
  const ink = (s, font) => {
    MC.font = font;
    const m = MC.measureText(s);
    return { w: m.width, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, fa: m.fontBoundingBoxAscent, fd: m.fontBoundingBoxDescent };
  };

  // ---------- behind
  P.k_behind = function (b, t, k, th) {
    const { w, h } = this.doc;
    const ws = this.words(b);
    const txt = this.text(b.text || ws.map((x) => x.w).join(" ")).trim();
    const parts = txt.split(/\s+/);
    const lines = parts.length > 2 ? [parts.slice(0, Math.ceil(parts.length / 2)).join(" "), parts.slice(Math.ceil(parts.length / 2)).join(" ")] : [txt];
    const ff = fam(txt, "TY Anton", "SM Lalezar");
    const bs = this.blockSolid(b);
    const hd = bs ? this.blockHead(b) : null;
    const m = Math.min(w, h) * 0.035;
    // 1) أكبر مقاس يكفّي العرض
    let size = Math.min(...lines.map((ln) => (w * 0.92) / Math.max(1, ink(ln, `400 100px ${ff}`).w) * 100), h * (h > w ? 0.3 : 0.5) / lines.length);
    const mt = (sz) => lines.map((ln) => ink(ln, `400 ${sz}px ${ff}`));
    let ms = mt(size);
    const lineH = (q) => q.a + q.d;
    const gap = () => size * 0.06;
    const blockH = () => ms.reduce((a2, q) => a2 + lineH(q), 0) + gap() * (lines.length - 1);
    // 2) المكان: لو الراس صغيرة بالنسبة للكلمة (زي المرجع) الكلمة ورا الراس على طول، والراس بتغطي حرف أو اتنين
    //    لو الراس كبيرة (لقطة قريبة) الكلمة بتطلع لفوق والشعر بيغطي الجزء التحتاني منها بس، ولو مفيش مكان بتصغر
    let cy, cx = w / 2;
    const widest = () => Math.max(...ms.map((q) => q.w));
    if (hd) {
      const cover = (hd.r * 2) / widest();
      if (cover <= 0.3) cy = hd.y - hd.r * 0.35;
      else {
        // لقطة قريبة: فوق الراس لو فيه مكان يكفّي كلمة كبيرة، والشعر بيغطي أقل من ربع الحروف من تحت
        const room = hd.top - m, full = size;
        const fitAbove = Math.min(full, size * room / Math.max(1, blockH() * 0.78));
        const left = hd.x - hd.r - m, right = w - m - (hd.x + hd.r);
        const space = Math.max(left, right);
        if (fitAbove >= full * 0.6 || space < w * 0.28) {
          size = Math.max(fitAbove, h * 0.05); ms = mt(size);
          cy = hd.top - blockH() * 0.28;
        } else {
          // مفيش مكان فوق: الكلمة في الناحية الفاضية ورا طرف الراس (الراس بتغطي أول الكلمة بس)
          const span = space * 1.25;
          size = Math.min(full, size * span / Math.max(1, widest()), h * 0.3); ms = mt(size);
          const ww = widest();
          cx = right >= left ? Math.min(w - m - ww / 2, hd.x + hd.r - space * 0.25 + ww / 2) : Math.max(m + ww / 2, hd.x - hd.r + space * 0.25 - ww / 2);
          cy = hd.y - hd.r * 0.15;
        }
      }
    } else if (bs === false) cy = m + blockH() / 2;   // القصّة مش مضمونة: فوق في الكادر بعيد عن الراس
    else cy = h * 0.32;
    cy = clamp(cy, m + blockH() / 2, h - m - blockH() / 2);
    // 3) كل سطر: بنحط الحبر نفسه في مكانه (الصندوق بيتحسب من مقاسات الخط)
    let y = cy - blockH() / 2, html = "";
    lines.forEach((ln, li) => {
      const q = ms[li];
      const t0 = (ws[Math.min(ws.length - 1, li * Math.ceil(ws.length / lines.length))]?.t0) ?? b.t0;
      const inkTop = y;
      y += lineH(q) + gap();
      if (t < t0) return;
      const e = eOut(seg(t, t0, t0 + 0.22)), out = 1 - seg(t, b.t1 - 0.15, b.t1);
      const base = (size - (q.fa + q.fd)) / 2 + q.fa;   // مكان السطر الأساسي جوه صندوق line-height:1
      const boxTop = inkTop + q.a - base;
      html += `<div style="position:absolute;left:${(cx - w / 2).toFixed(1)}px;width:${w}px;top:${boxTop.toFixed(1)}px;height:${size.toFixed(1)}px;text-align:center;transform:scale(${lerp(1.12, 1, e).toFixed(3)},${lerp(0.55, 1, e).toFixed(3)});transform-origin:50% ${(base - q.a / 2).toFixed(1)}px;
        font-family:${ff};font-size:${size.toFixed(1)}px;line-height:1;white-space:nowrap;color:${inkOf(this, th)};opacity:${(e * out).toFixed(3)};
        letter-spacing:-0.01em;filter:blur(${((1 - e) * 8).toFixed(1)}px);${onVideo(this) ? "text-shadow:0 6px 30px rgba(0,0,0,.25);" : ""}" dir="${this.dir(ln)}">${esc(ln)}</div>`;
    });
    return backdrop(this, th) + (bs ? this.behindPerson(t, html) : html);
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

  // =====================================================================
  // الدفعة التالتة
  //   space     الكلام متوزع في فراغ 3D والكاميرا ماشية جواه (13)
  //   route     خريطة نقط ومسار بيترسم وطيارة بين مكانين (14)
  //   board     لوحة تحقيق: ورق متدبّس وخيوط حمرا منوّرة (10)
  //   cube      مكعب سلكي بيلف حوالين الشخص أو الكلمة (14)
  //   comments  لوحة زجاج فيها كومنتات بتطلع ورا بعض (14)
  //   lock      كبسولة بقفل بيتقفل على الكلمة (16)
  //   thermal   الشخص بألوان كاميرا حرارية والكلام بطباشير (18)
  //   shapes    أشكال مرسومة بتترعش زي فيلم 16مم حوالين الكلام (17)
  //   select    مربع تحديد زي برامج التصميم والماوس بيسحبه (12، 14)
  //   chat      فقاعات شات ورا بعض وقبلها نقط الكتابة (10)
  //   counter   رقم بيعدّ لحد قيمته بمؤشر منوّر (10)
  // =====================================================================
  const chunks = (it, n) => {
    const per = Math.max(1, Math.ceil(it.length / n));
    const out = [];
    for (let i = 0; i < it.length; i += per) { const g = it.slice(i, i + per); out.push({ w: g.map((x) => x.w).join(" "), t0: g[0].t0 }); }
    return out;
  };
  const famOf = (s, latin = "TY Outfit", arabic = "TY PlexAr") => (AR.test(s) ? `'${arabic}', 'SM Tajawal'` : `'${latin}', 'SM Tajawal'`);
  const fitSize = (s, font, maxW, size) => { const tw = measure(s, `${font.replace("{}", size)}`); return tw > maxW ? size * maxW / tw : size; };

  // ---------- space
  P.k_space = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const it = this.items(b);
    const mn = Math.min(w, h), D = mn * 0.9;
    let cur = 0;
    it.forEach((x, i) => { if (t >= x.t0) cur = i; });
    const nx = it[cur + 1]?.t0 ?? b.t1;
    // كل كلمة على عمق، والكاميرا بتقرّب كلمة كلمة: الكلمة الحالية قريبة، واللي جاية بعيدة ولونها خفيف، واللي فاتت بتعدّي جنب الكاميرا
    const cam = D * (cur + 0.6 * eOut(seg(t, it[cur]?.t0 ?? b.t0, nx)));
    let world = "";
    it.forEach((x, i) => {
      const ang = i * 2.4 + bi;
      const px = i === 0 ? 0 : Math.cos(ang) * w * 0.3, py = i === 0 ? 0 : Math.sin(ang) * h * 0.16, ry = Math.cos(ang) * -18;
      const z = -(i + 0.5) * D + cam;
      if (z > D * 0.08 || z < -D * 3.2) return;
      const a = (t >= x.t0 - 0.6 ? 1 : 0.35) * clamp((z + D * 3.2) / D) * clamp((D * 0.08 - z) / (D * 0.2));
      const focus = i === b.focus || x.w.length >= 7;
      const sz = fitSize(x.w, `800 {}px ${famOf(x.w)}`, w * 0.9, mn * (focus ? 0.2 : 0.15) * this.ts);
      world += `<div dir="${this.dir(x.w)}" style="position:absolute;left:50%;top:45%;transform:translate(-50%,-50%) translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg);
        opacity:${a.toFixed(3)};font:800 ${sz.toFixed(1)}px ${famOf(x.w)};letter-spacing:-0.03em;white-space:nowrap;color:${focus ? th.accent || RED : inkOf(this, th)};${shadow(this)}">${esc(this.text(x.w))}</div>`;
    });
    return backdrop(this, th) + `<div style="position:absolute;inset:0;perspective:${D.toFixed(0)}px;perspective-origin:50% 45%;overflow:hidden"><div style="position:absolute;inset:0;transform-style:preserve-3d">${world}</div></div>`;
  };

  // ---------- route
  const PLANE = (s, col) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path fill="${col}" d="M21 15.5v-2L13 8.5V3a1.5 1.5 0 0 0-3 0v5.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-4.5z"/></svg>`;
  P.k_route = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const raw = String(b.text || this.words(b).map((x) => x.w).join(" ")).trim();
    const parts = raw.split(/\s*(?:→|->|—|-|إلى|الى|to)\s+/i).filter(Boolean);
    const ws = raw.split(/\s+/);
    const A = (parts.length > 1 ? parts[0] : ws[0] || "").replace(/[.,،!?؟]+$/, ""), B = (parts.length > 1 ? parts[parts.length - 1] : ws[ws.length - 1] || "").replace(/[.,،!?؟]+$/, "");
    const mid = parts.length > 1 ? "" : ws.slice(1, -1).join(" ");
    const ax = w * 0.24, ay = h * 0.6, bx2 = w * 0.76, by = h * 0.4, cx = w / 2, cy = Math.min(ay, by) - h * 0.2;
    const t0 = b.t0 + 0.2, pk = eOut(seg(t, t0 + 0.3, t0 + Math.max(0.8, (b.t1 - b.t0) * 0.6)));
    const dots = `<div style="position:absolute;inset:0;background:radial-gradient(circle, rgba(120,170,255,.55) 1.4px, transparent 1.6px) 0 0/${(mn * 0.028).toFixed(0)}px ${(mn * 0.028).toFixed(0)}px;
      -webkit-mask:radial-gradient(ellipse at 50% 50%, #000 30%, transparent 75%);mask:radial-gradient(ellipse at 50% 50%, #000 30%, transparent 75%)"></div>`;
    const under = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(6,14,40,.72)"></div>` : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%, #13254f, #050a1c 80%)"></div>`;
    const path = `M${ax} ${ay} Q ${cx} ${cy} ${bx2} ${by}`;
    const u = pk, px = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * bx2, py = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * by;
    const tx2 = 2 * (1 - u) * (cx - ax) + 2 * u * (bx2 - cx), ty2 = 2 * (1 - u) * (cy - ay) + 2 * u * (by - cy);
    const ang = Math.atan2(ty2, tx2) * 57.3 + 90;
    const pin = (x, y, label, at) => {
      if (t < at) return "";
      const p = POP(t, at);
      const sz = fitSize(label, `700 {}px ${famOf(label)}`, w * 0.4, mn * 0.045);
      return `<div style="position:absolute;left:${x - mn * 0.018}px;top:${y - mn * 0.05}px;width:${(mn * 0.036).toFixed(1)}px;height:${(mn * 0.036).toFixed(1)}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg) scale(${p.s.toFixed(3)});background:#E8182A;border:${(mn * 0.007).toFixed(1)}px solid #fff"></div>
        <div dir="${this.dir(label)}" style="position:absolute;left:${x}px;top:${(y - mn * 0.11).toFixed(1)}px;transform:translate(-50%,-50%) scale(${p.s.toFixed(3)});opacity:${p.a.toFixed(3)};background:rgba(255,255,255,.9);border-radius:${mn}px;padding:${(mn * 0.008).toFixed(1)}px ${(mn * 0.025).toFixed(1)}px;font:700 ${sz.toFixed(1)}px ${famOf(label)};color:#12233F;white-space:nowrap">${esc(this.text(label))}</div>`;
    };
    let html = under + dots
      + `<svg style="position:absolute;inset:0" width="${w}" height="${h}"><path d="${path}" pathLength="1" stroke="#fff" stroke-width="${(mn * 0.005).toFixed(1)}" fill="none" stroke-dasharray="${pk.toFixed(3)} 2" stroke-linecap="round" opacity=".9"/></svg>`
      + pin(ax, ay, A, b.t0) + pin(bx2, by, B, t0 + 0.3 + (b.t1 - b.t0) * 0.6 * 0.8);
    if (pk > 0 && pk < 1) html += `<div style="position:absolute;left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;transform:translate(-50%,-50%) rotate(${ang.toFixed(1)}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">${PLANE(mn * 0.08, "#fff")}</div>`;
    if (mid) html += `<div dir="${this.dir(mid)}" style="position:absolute;left:0;right:0;top:${(h * 0.2).toFixed(1)}px;text-align:center;font:800 ${fitSize(mid, `800 {}px ${famOf(mid)}`, w * 0.86, mn * 0.07).toFixed(1)}px ${famOf(mid)};color:#fff;opacity:${seg(t, b.t0, b.t0 + 0.2).toFixed(3)};${shadow(this)}">${esc(this.text(mid))}</div>`;
    return html;
  };

  // ---------- board
  P.k_board = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const notes = chunks(this.items(b), Math.min(5, Math.max(2, Math.ceil(this.items(b).length / 2))));
    const r = rng(bi * 17 + 9);
    const cx = w / 2, cy = h * 0.45;
    const spots = notes.map((n, i) => {
      const a = (-Math.PI / 2) + (i * Math.PI * 2) / notes.length + (r() - 0.5) * 0.5;
      return { ...n, x: cx + Math.cos(a) * w * 0.3, y: cy + Math.sin(a) * h * 0.24, rot: (r() - 0.5) * 12 };
    });
    const under = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(30,8,10,.7)"></div>` : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#4a2526,#160b0c 80%)"></div>`;
    let lines = "";
    spots.forEach((n, i) => {
      if (t < n.t0) return;
      const q = eOut(seg(t, n.t0, n.t0 + 0.3)), nx = i ? spots[i - 1] : { x: cx, y: cy };
      lines += `<line x1="${nx.x}" y1="${nx.y}" x2="${lerp(nx.x, n.x, q)}" y2="${lerp(nx.y, n.y, q)}" stroke="#ff1f2c" stroke-width="${(mn * 0.006).toFixed(1)}" style="filter:drop-shadow(0 0 ${(mn * 0.01).toFixed(1)}px #f00)"/>`;
    });
    let html = under + `<svg style="position:absolute;inset:0" width="${w}" height="${h}">${lines}</svg>`;
    spots.forEach((n) => {
      if (t < n.t0) return;
      const p = POP(t, n.t0, 0.16);
      const ff = AR.test(n.w) ? "'TY Ruqaa', 'SM Tajawal'" : "'TY Rock', 'TY Outfit'";
      const sz = fitSize(n.w, `400 {}px ${ff}`, w * 0.32, mn * 0.05);
      html += `<div dir="${this.dir(n.w)}" style="position:absolute;left:${n.x.toFixed(1)}px;top:${n.y.toFixed(1)}px;transform:translate(-50%,-50%) rotate(${n.rot.toFixed(1)}deg) scale(${p.s.toFixed(3)});opacity:${p.a.toFixed(3)};
        background:#F3EBDD;color:#1a1a1a;font:400 ${sz.toFixed(1)}px ${ff};padding:${(mn * 0.03).toFixed(1)}px ${(mn * 0.035).toFixed(1)}px;white-space:nowrap;box-shadow:0 ${(mn * 0.012).toFixed(1)}px ${(mn * 0.03).toFixed(1)}px rgba(0,0,0,.55)">
        <i style="position:absolute;left:50%;top:${(-mn * 0.012).toFixed(1)}px;width:${(mn * 0.028).toFixed(1)}px;height:${(mn * 0.028).toFixed(1)}px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ff6b6b,#b3121c);transform:translateX(-50%);box-shadow:0 2px 4px rgba(0,0,0,.5)"></i>${esc(this.text(n.w))}</div>`;
    });
    return html;
  };

  // ---------- cube
  P.k_cube = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const solid = this.blockSolid(b), hd = this.headAt(t);
    const size = solid ? clamp(hd.r * 3.2, mn * 0.4, mn * 0.75) : mn * 0.5;
    const cx = solid ? clamp(hd.x, size / 2, w - size / 2) : w / 2, cy = solid ? clamp(hd.y + hd.r * 0.4, size / 2, h - size / 2) : h * 0.42;
    const rot = (t - b.t0) * 30, k2 = eOut(seg(t, b.t0, b.t0 + 0.3));
    const faces = ["", "rotateY(90deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)"];
    let html = backdrop(this, th) + `<div style="position:absolute;left:${(cx - size / 2).toFixed(1)}px;top:${(cy - size / 2).toFixed(1)}px;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;perspective:${(size * 3).toFixed(0)}px;opacity:${k2.toFixed(3)}">
      <div style="position:absolute;inset:0;transform-style:preserve-3d;transform:scale(${lerp(0.7, 1, k2).toFixed(3)}) rotateX(-18deg) rotateY(${(35 + rot).toFixed(1)}deg)">
      ${faces.map((f) => `<div style="position:absolute;inset:0;border:${Math.max(2, mn * 0.004).toFixed(1)}px solid ${onVideo(this) ? "rgba(255,255,255,.92)" : th.ink};transform:${f} translateZ(${(size / 2).toFixed(1)}px)"></div>`).join("")}</div></div>`;
    // الكلام تحت المكعب (أو فوقه لو مفيش مكان)
    const ty = cy + size * 0.88 < h * 0.85 ? cy + size * 0.88 : cy - size * 0.88;
    const shown = it.filter((x) => t >= x.t0);
    if (shown.length) {
      const full = shown.map((x) => this.text(x.w)).join(" ");
      const sz = fitSize(it.map((x) => x.w).join(" "), `800 {}px ${famOf(full)}`, w * 0.86, mn * 0.08);
      html += `<div dir="${this.dir(full)}" style="position:absolute;left:0;right:0;top:${ty.toFixed(1)}px;transform:translateY(-50%);text-align:center;font:800 ${sz.toFixed(1)}px ${famOf(full)};letter-spacing:-0.03em;color:${inkOf(this, th)};${shadow(this)}">${shown.map((x, i) =>
        `<span style="${i === b.focus || (b.focus < 0 && i === it.length - 1) ? `color:${th.accent || RED}` : ""}">${esc(this.text(x.w))}</span>`).join(" ")}</div>`;
    }
    return html;
  };

  // ---------- comments
  const HANDLES = ["sara", "omar", "mona", "ali", "nour", "youssef", "hana"];
  P.k_comments = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const cs = chunks(this.items(b), Math.min(5, Math.max(2, Math.ceil(this.items(b).length / 3))));
    const fr = this.freeRect(b);
    // اللوحة جوه المساحة الفاضية بس (ماتغطيش الشخص)، ولو المساحة ضيقة الخط بيصغر
    const pw = Math.min(w * 0.62, fr.w), px = fr.side === "center" ? (w - pw) / 2 : fr.x + (fr.w - pw) / 2;
    const k2 = eOut(seg(t, b.t0, b.t0 + 0.4));
    const sz = mn * 0.034 * this.ts * clamp(pw / (w * 0.5), 0.7, 1);
    const top = fr.side === "center" ? h * 0.16 : fr.y;
    // اللي يكفّي بس من آخر الكومنتات (القديم بيطلع لفوق ويختفي)
    const maxH = fr.side === "center" ? h * 0.7 : fr.h;
    const fit = Math.max(1, Math.floor((maxH - mn * 0.08) / (sz * 5.2)));
    const live = cs.map((c, i) => (t >= c.t0 ? i : -1)).filter((i) => i >= 0);
    const keep = new Set(live.slice(-fit));
    const rows = cs.map((c, i) => {
      if (!keep.has(i)) return "";
      const p = POP(t, c.t0, 0.15), hue = (bi * 47 + i * 71) % 360;
      return `<div style="display:flex;gap:${(sz * 0.7).toFixed(1)}px;margin-bottom:${(sz * 1.2).toFixed(1)}px;opacity:${p.a.toFixed(3)};transform:translateY(${((1 - p.s) * sz * 3).toFixed(1)}px)">
        <b style="width:${(sz * 2.4).toFixed(1)}px;height:${(sz * 2.4).toFixed(1)}px;border-radius:50%;flex:none;background:linear-gradient(135deg,hsl(${hue} 70% 60%),hsl(${(hue + 60) % 360} 70% 40%))"></b>
        <div dir="${this.dir(c.w)}" style="font:400 ${sz.toFixed(1)}px 'TY Outfit', 'TY PlexAr';color:#eee;line-height:1.35"><span style="opacity:.65">@${HANDLES[(bi + i) % HANDLES.length]}</span><br>
        <b style="font:700 ${(sz * 1.25).toFixed(1)}px ${famOf(c.w)};color:#fff">${esc(this.text(c.w))}</b><div style="opacity:.45;font-size:${(sz * 0.8).toFixed(1)}px">${i + 1}m · Reply</div></div></div>`;
    }).join("");
    return backdrop(this, th) + `<div style="position:absolute;left:${px.toFixed(1)}px;top:${lerp(h, top, k2).toFixed(1)}px;width:${pw.toFixed(1)}px;max-height:${(fr.side === "center" ? h * 0.7 : fr.h).toFixed(1)}px;overflow:hidden;
      background:${onVideo(this) ? "rgba(36,36,42,.62)" : "rgba(24,24,30,.94)"};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.2);border-radius:${(mn * 0.03).toFixed(1)}px;padding:${(mn * 0.04).toFixed(1)}px;box-sizing:border-box">${rows}</div>`;
  };

  // ---------- lock
  P.k_lock = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : it.reduce((a, x, i) => (x.w.length > it[a].w.length ? i : a), 0);
    const main = (it[fi]?.w || "").replace(/[.,،!?؟]+$/, "");
    const ar = AR.test(main);
    const ff = ar ? "'SM Lalezar', 'SM Tajawal'" : "'TY Anton', 'TY Outfit'";
    const word = ar ? main : this.text(main).toUpperCase();
    let size = fitSize(word, `400 {}px ${ff}`, w * 0.56, mn * 0.2);
    const t0 = it[fi]?.t0 ?? b.t0;
    const p = eBack(seg(t, t0, t0 + 0.2)), shut = eOut(seg(t, b.t1 - 0.55, b.t1 - 0.35));
    const ink = onVideo(this) ? "#fff" : th.ink;
    const y = this.blockSolid(b) ? this.belowHead(b, size) : h * 0.45;
    const L = size * 0.7;
    const lock = `<svg width="${L.toFixed(1)}" height="${(L * 1.2).toFixed(1)}" viewBox="0 0 20 24" style="flex:none"><path d="M5 ${(11 - (1 - shut) * 4).toFixed(2)} V7 a5 5 0 0 1 10 0 V${(11 - (1 - shut) * 4).toFixed(2)}" fill="none" stroke="${ink}" stroke-width="2.4" transform="translate(${((1 - shut) * 3).toFixed(2)},0)"/><rect x="2" y="11" width="16" height="12" rx="2.5" fill="${ink}"/><circle cx="10" cy="17" r="1.8" fill="${onVideo(this) ? "#111" : th.bg}"/></svg>`;
    let html = backdrop(this, th);
    if (t >= t0) html += `<div style="position:absolute;left:${w / 2}px;top:${y.toFixed(1)}px;transform:translate(-50%,-50%) scale(${p.toFixed(3)});display:flex;align-items:center;gap:${(size * 0.18).toFixed(1)}px;
      border:${(mn * 0.007).toFixed(1)}px solid ${ink};border-radius:${mn}px;padding:${(size * 0.12).toFixed(1)}px ${(size * 0.32).toFixed(1)}px;font:400 ${size.toFixed(1)}px ${ff};color:${ink};line-height:1;white-space:nowrap;box-shadow:0 0 ${(mn * 0.05).toFixed(0)}px rgba(0,0,0,.3)" dir="${ar ? "rtl" : "ltr"}">${lock}<span>${esc(word)}</span></div>`;
    const rest = it.filter((x, i) => i !== fi && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (rest) html += `<div dir="${this.dir(rest)}" style="position:absolute;left:0;right:0;top:${(y + size * 0.95).toFixed(1)}px;text-align:center;font:700 ${(mn * 0.06).toFixed(1)}px ${famOf(rest)};color:${ink};${shadow(this)}">${esc(rest)}</div>`;
    return html;
  };

  // ---------- thermal
  const THERMAL = `<svg width="0" height="0" style="position:absolute"><filter id="tyThermal" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values=".3 .59 .11 0 0  .3 .59 .11 0 0  .3 .59 .11 0 0  0 0 0 1 0" result="g"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="22" result="s"/>
    <feColorMatrix in="s" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 1 0  0 0 0 0 1" result="sg"/>
    <feComposite in="sg" in2="g" operator="arithmetic" k2=".8" k3=".3" result="v"/>
    <feComponentTransfer in="v"><feFuncR type="table" tableValues=".04 .16 .35 .9 1 1"/><feFuncG type="table" tableValues=".08 .27 .78 .25 .55 .95"/><feFuncB type="table" tableValues=".63 1 .9 .3 .4 .85"/><feFuncA type="identity"/></feComponentTransfer>
    <feComposite in2="SourceAlpha" operator="in"/></filter></svg>`;
  P.k_thermal = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const a = this.personAt(t);
    let person = "";
    if (a) {
      const { x, y, w: iw, h: ih } = a.img;
      const j = rng(Math.floor(t * 12) + 3)();
      this._want = a.url;
      person = THERMAL + `<img src="${a.url}" alt="" style="position:absolute;left:${(x + (j - 0.5) * 4).toFixed(1)}px;top:${y.toFixed(1)}px;width:${iw.toFixed(1)}px;height:${ih.toFixed(1)}px;filter:url(#tyThermal) blur(1.5px);pointer-events:none">`;
    }
    const under = `<div style="position:absolute;inset:0;background:${onVideo(this) ? "rgba(8,14,70,.82)" : "radial-gradient(ellipse at 50% 45%, #16207a, #050835 80%)"}"></div>`;
    const shown = it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    let txt = "";
    if (shown) {
      const full = it.map((x) => this.text(x.w)).join(" ");
      const ff = AR.test(full) ? "'TY Ruqaa', 'SM Tajawal'" : "'TY Rock', 'TY Outfit'";
      const sz = fitSize(full, `400 {}px ${ff}`, w * 0.86, mn * 0.09);
      const r = rng(Math.floor(t * 12) * 5 + bi);
      const y = this.blockSolid(b) ? Math.max(sz, this.headAt(t).top - sz * 0.9) : h * 0.2;
      txt = `<div dir="${this.dir(full)}" style="position:absolute;left:${(w / 2 + (r() - 0.5) * 8).toFixed(1)}px;top:${(y + (r() - 0.5) * 8).toFixed(1)}px;transform:translate(-50%,-50%) rotate(${((r() - 0.5) * 4).toFixed(2)}deg);
        font:400 ${sz.toFixed(1)}px ${ff};color:rgba(255,255,255,.25);-webkit-text-stroke:${Math.max(2, sz * 0.05).toFixed(1)}px rgba(245,240,245,.95);text-shadow:0 0 6px rgba(255,255,255,.5);white-space:nowrap">${esc(shown)}</div>`;
    }
    return under + person + txt;
  };

  // ---------- shapes
  P.k_shapes = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const CR = "#E8DDE0";
    const B12 = Math.floor(t * 12);
    const j = rng(B12 * 7 + bi), dx = (j() - 0.5) * 4, dy = (j() - 0.5) * 4;
    const cx = w / 2, cy = this.blockSolid(b) ? this.belowHead(b, mn * 0.1) : h * 0.48, R = mn * 0.34;
    const p1 = eOut(seg(t, b.t0, b.t0 + 0.6)), p2 = eOut(seg(t, b.t0 + 0.3, b.t0 + 0.9));
    const sw = Math.max(3, mn * 0.008);
    const shapes = `<circle cx="${cx}" cy="${cy}" r="${R}" pathLength="1" stroke-dasharray="${p1.toFixed(3)} 2" fill="none" stroke-width="${sw}"/>
      <line x1="${cx - R * 1.3}" y1="${cy + R * 1.15}" x2="${lerp(cx - R * 1.3, cx + R * 1.3, p2)}" y2="${cy + R * 1.15}" stroke-width="${sw}"/>
      <line x1="${cx + R * 1.2}" y1="${cy - R * 1.2}" x2="${lerp(cx + R * 1.2, cx + R * 0.7, p2)}" y2="${lerp(cy - R * 1.2, cy - R * 0.7, p2)}" stroke-width="${sw}"/>
      ${[0, 1, 2, 3].map((q) => `<circle cx="${cx - R * 1.1 + q * R * 0.2}" cy="${cy - R * 1.05}" r="${(sw * 1.2 * p2).toFixed(1)}" stroke="none"/>`).join("")}`;
    const layer = (c, ox, op) => `<g transform="translate(${ox + dx},${dy})" fill="${c}" stroke="${c}" opacity="${op}">${shapes}</g>`;
    const svg = `<svg style="position:absolute;inset:0" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="tyWob${bi}"><feTurbulence baseFrequency="0.02" numOctaves="2" seed="${B12 % 20}"/><feDisplacementMap in="SourceGraphic" scale="${(mn * 0.01).toFixed(1)}"/></filter></defs>
      <g filter="url(#tyWob${bi})" style="filter:url(#tyWob${bi}) drop-shadow(0 0 ${(mn * 0.01).toFixed(1)}px rgba(255,240,230,.55))">${layer("#7fd08a", -6, 0.8)}${layer("#c25aa8", 6, 0.7)}${layer(CR, 0, 1)}</g></svg>`;
    const under = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(10,12,16,.55)"></div>` : `<div style="position:absolute;inset:0;background:#0D1117"></div>`;
    const shown = it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    let txt = "";
    if (shown) {
      const full = it.map((x) => this.text(x.w)).join(" ");
      const ff = AR.test(full) ? "'TY Ruqaa', 'SM Tajawal'" : "'TY Rock', 'TY Outfit'";
      const sz = fitSize(full, `400 {}px ${ff}`, R * 1.8, mn * 0.08);
      txt = `<div dir="${this.dir(full)}" style="position:absolute;left:${(cx + dx).toFixed(1)}px;top:${(cy + dy).toFixed(1)}px;transform:translate(-50%,-50%);font:400 ${sz.toFixed(1)}px ${ff};color:${CR};white-space:nowrap;text-shadow:-3px 0 rgba(127,208,138,.7),3px 0 rgba(194,90,168,.6),0 0 10px rgba(255,240,230,.5)">${esc(shown)}</div>`;
    }
    return under + svg + txt;
  };

  // ---------- select
  const CURSOR = (s) => `<svg width="${(s * 0.74).toFixed(1)}" height="${s.toFixed(1)}" viewBox="0 0 34 46" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))"><path d="M2 2 L2 38 L11 29 L17 44 L23 41 L17 27 L30 27 Z" fill="#fff" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  P.k_select = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const full = it.map((x) => this.text(x.w)).join(" ");
    const ff = famOf(full);
    const size = fitSize(full, `800 {}px ${ff}`, w * 0.74, mn * 0.12);
    const tw = Math.min(measure(full, `800 ${size}px ${ff}`), w * 0.74), bh = size * 1.25;
    const cx = w / 2, cy = this.blockSolid(b) ? this.belowHead(b, size) : h * 0.45;
    const t0 = it[0]?.t0 ?? b.t0;
    const kb = seg(t, t0 + 0.1, t0 + 0.25);
    const drag = eOut(seg(t, t0 + 0.6, t0 + 1.0));
    const grow = lerp(1, 1.12, drag);
    const bw = tw * grow + size * 0.5, bhh = bh * grow;
    const ink = inkOf(this, th), col = "#3B82F6";
    const shown = it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    let html = backdrop(this, th);
    html += `<div dir="${this.dir(full)}" style="position:absolute;left:${cx}px;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%) scale(${grow.toFixed(3)});font:800 ${size.toFixed(1)}px ${ff};letter-spacing:-0.03em;white-space:nowrap;color:${ink};${shadow(this)}">${esc(shown)}</div>`;
    if (kb > 0) {
      const hs = Math.max(8, mn * 0.016);
      const handles = [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]].map(([u, v]) =>
        `<i style="position:absolute;left:${(u * bw - hs / 2).toFixed(1)}px;top:${(v * bhh - hs / 2).toFixed(1)}px;width:${hs.toFixed(1)}px;height:${hs.toFixed(1)}px;background:#fff;border:2px solid ${col}"></i>`).join("");
      html += `<div style="position:absolute;left:${(cx - bw / 2).toFixed(1)}px;top:${(cy - bhh / 2).toFixed(1)}px;width:${bw.toFixed(1)}px;height:${bhh.toFixed(1)}px;border:${Math.max(2, mn * 0.003).toFixed(1)}px solid ${col};opacity:${kb.toFixed(3)}">${handles}
        <span style="position:absolute;left:0;top:${(-mn * 0.045).toFixed(1)}px;background:${col};color:#fff;font:600 ${(mn * 0.024).toFixed(1)}px 'TY Outfit';padding:2px 8px;border-radius:4px">${Math.round(bw)} × ${Math.round(bhh)}</span></div>`;
      // الماوس جاي من تحت يمين ويمسك الركن ويسحب
      const ca = eOut(seg(t, t0 + 0.2, t0 + 0.6));
      const mx = lerp(w * 1.05, cx + bw / 2, ca), my = lerp(h * 0.9, cy + bhh / 2, ca);
      html += `<div style="position:absolute;left:${mx.toFixed(1)}px;top:${my.toFixed(1)}px">${CURSOR(mn * 0.07)}</div>`;
    }
    return html;
  };

  // ---------- chat
  P.k_chat = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const cs = chunks(this.items(b), Math.min(4, Math.max(1, Math.ceil(this.items(b).length / 3))));
    const sz = mn * 0.045 * this.ts;
    const base = this.blockSolid(b) ? Math.min(h * 0.82, this.belowHead(b, sz) + h * 0.12) : h * 0.6;
    let html = backdrop(this, th);
    const shown = cs.filter((c) => t >= c.t0);
    const next = cs.find((c) => t < c.t0 && t >= c.t0 - 0.4);
    const items = shown.map((c, i) => ({ ...c, me: (i + bi) % 2 === 1 }));
    if (next) items.push({ dots: true, me: (shown.length + bi) % 2 === 1 });
    let y = base;
    for (let i = items.length - 1; i >= 0 && y > h * 0.08; i--) {
      const c = items[i];
      const p = c.dots ? 1 : eBack(seg(t, c.t0, c.t0 + 0.18));
      const bg = c.me ? "#2F7CF6" : "#E9E9EB", fg = c.me ? "#fff" : "#222";
      const side = c.me ? `right:${(w * 0.08).toFixed(1)}px` : `left:${(w * 0.08).toFixed(1)}px`;
      const inner = c.dots ? [0, 1, 2].map((q) => `<i style="display:inline-block;width:${(sz * 0.4).toFixed(1)}px;height:${(sz * 0.4).toFixed(1)}px;margin:0 ${(sz * 0.12).toFixed(1)}px;border-radius:50%;background:#9a9aa0;opacity:${(0.35 + 0.65 * Math.abs(Math.sin(t * 5 - q * 0.9))).toFixed(2)}"></i>`).join("")
        : esc(this.text(c.w));
      const lines = c.dots ? 1 : Math.max(1, Math.ceil(measure(c.w, `600 ${sz}px ${famOf(c.w)}`) / (w * 0.62)));
      const bh = sz * 1.35 * lines + sz * 1.1;
      html += `<div dir="${c.dots ? "ltr" : this.dir(c.w)}" style="position:absolute;${side};top:${(y - bh).toFixed(1)}px;max-width:${(w * 0.7).toFixed(1)}px;transform:scale(${p.toFixed(3)});transform-origin:${c.me ? "100%" : "0"} 100%;
        background:${bg};color:${fg};font:600 ${sz.toFixed(1)}px ${famOf(c.w || "a")};line-height:1.35;padding:${(sz * 0.55).toFixed(1)}px ${(sz * 0.9).toFixed(1)}px;border-radius:${(sz * 1.1).toFixed(1)}px;box-shadow:0 6px 18px rgba(0,0,0,.12)">${inner}</div>`;
      y -= bh + sz * 0.5;
    }
    return html;
  };

  // ---------- counter
  const AR_DIG = "٠١٢٣٤٥٦٧٨٩";
  P.k_counter = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const norm = (s) => s.replace(/[٠-٩]/g, (d) => AR_DIG.indexOf(d));
    const ni = it.findIndex((x) => /\d/.test(norm(x.w)));
    if (ni < 0) return this.k_push(b, t, k, th);
    const raw = norm(it[ni].w), m = raw.match(/([^\d]*)([\d][\d,.]*)(.*)/);
    const pre = m[1], num = m[2], post = m[3];
    const val = parseFloat(num.replace(/,/g, "")) || 0, dec = (num.split(".")[1] || "").length, commas = num.includes(",");
    const t0 = it[ni].t0, kk = eOut(seg(t, t0, t0 + 0.7));
    let cur = (val * kk).toFixed(dec);
    if (commas) cur = Number(cur).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const str = t >= t0 ? pre + cur + post : "";
    const size = fitSize(pre + num + post, `700 {}px 'TY Outfit'`, w * 0.84, mn * 0.2);
    const y = this.blockSolid(b) ? this.belowHead(b, size) : h * 0.45;
    const MAG = th.accent || RED;
    const ink = inkOf(this, th);
    let html = backdrop(this, th);
    const before = it.slice(0, ni).filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    const after = it.slice(ni + 1).filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (before) html += `<div dir="${this.dir(before)}" style="position:absolute;left:0;right:0;top:${(y - size * 0.95).toFixed(1)}px;text-align:center;font:600 ${(mn * 0.06).toFixed(1)}px ${famOf(before)};color:${ink};${shadow(this)}">${esc(before)}</div>`;
    if (str) html += `<div style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;transform:translateY(-50%);text-align:center;font:700 ${size.toFixed(1)}px 'TY Outfit';color:${ink};white-space:nowrap;text-shadow:0 0 ${kk >= 1 ? 40 : 10}px rgba(255,255,255,.45)">${esc(str)}<i style="display:inline-block;width:${(size * 0.06).toFixed(1)}px;height:${(size * 0.85).toFixed(1)}px;background:${MAG};box-shadow:0 0 ${(size * 0.15).toFixed(0)}px ${MAG};vertical-align:-8%;margin-left:${(size * 0.04).toFixed(1)}px;opacity:${Math.floor(t * 2.5) % 2 || kk < 1 ? 1 : 0}"></i></div>`;
    if (after) html += `<div dir="${this.dir(after)}" style="position:absolute;left:0;right:0;top:${(y + size * 0.75).toFixed(1)}px;text-align:center;font:600 ${(mn * 0.06).toFixed(1)}px ${famOf(after)};color:${ink};${shadow(this)}">${esc(after)}</div>`;
    return html;
  };

  // =====================================================================
  // الدفعة الرابعة
  //   fill      الصورة من الفيديو جوه حروف عملاقة (16)
  //   polaroid  بولارويد فيه لقطة من الفيديو والكلام بخط إيد بيتكتب (20)
  //   cards     كروت ملونة طايرة في 3D (8)
  //   burst     انفجار كوميكس برتقاني والكلمة في النص (20)
  //   dots      الشخص بيتحول لنقط منوّرة (11، 12)
  //   neon      كلام نيون أحمر منوّر ورا الشخص (13)
  // b.img = لقطة من الفيديو (السيرفر بيعملها)، ولو مفيش: أيقونة البلوك
  // =====================================================================
  const imgOf = (b) => b.img || b.icon || "";

  // ---------- fill
  P.k_fill = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const txt = it.map((x) => x.w).join(" ");
    const ar = AR.test(txt);
    const ff = ar ? "'SM Lalezar', 'SM Tajawal'" : "'TY Anton', 'TY Outfit'";
    const lines = it.length > 1 && !ar ? it.map((x) => x.w.toUpperCase()) : [ar ? txt : txt.toUpperCase()];
    const maxH = (h * 0.62) / lines.length;
    const src = imgOf(b);
    if (src) this._want = src;
    const paint = src ? `background:url(${src}) center/cover;-webkit-background-clip:text;background-clip:text;color:transparent;filter:contrast(1.2) brightness(1.7) saturate(1.1)`
      : `background:linear-gradient(160deg,#fff 0%,${th.accent || RED} 120%);-webkit-background-clip:text;background-clip:text;color:transparent`;
    // على أحمر دايمًا (زي المرجع) وحدود فاتحة رفيعة عشان الحروف تتقري حتى لو اللقطة غامقة
    let html = `<div style="position:absolute;inset:0;background:${RED}"></div>`;
    let y = (h - lines.reduce((a, l) => a + Math.min(maxH, fitSize(l, `400 {}px ${ff}`, w * 0.92, maxH * 1.2)) * 0.92, 0)) / 2;
    lines.forEach((ln, i) => {
      const sz = Math.min(maxH, fitSize(ln, `400 {}px ${ff}`, w * 0.92, maxH * 1.2));
      const t0 = it[Math.min(i, it.length - 1)].t0;
      if (t >= t0) {
        const p = eBack(seg(t, t0, t0 + 0.2));
        html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${w / 2}px;top:${(y + sz * 0.46).toFixed(1)}px;transform:translate(-50%,-50%) scale(${p.toFixed(3)}) scaleY(1.08);font-family:${ff};font-size:${sz.toFixed(1)}px;line-height:.95;white-space:nowrap;
          background-position:${(50 + (t - b.t0) * 3).toFixed(1)}% ${(40 + i * 20)}%;${paint};-webkit-text-stroke:${Math.max(1.5, sz * 0.008).toFixed(1)}px rgba(255,240,235,.9)">${esc(ln)}</div>`;
      }
      y += sz * 0.92;
    });
    return html;
  };

  // ---------- polaroid
  P.k_polaroid = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const src = imgOf(b);
    if (src) this._want = src;
    const pw = Math.min(w * 0.78, h * 0.5), ph = pw * 1.18;
    const k2 = eOut(seg(t, b.t0, b.t0 + 0.35));
    const rot = lerp(-9, -3, k2) + (bi % 2 ? 4 : 0);
    const cx = w / 2, cy = h * 0.44 + (1 - k2) * h * 0.1;
    const full = it.map((x) => this.text(x.w)).join(" ");
    const ar = AR.test(full);
    const ff = ar ? "'TY Ruqaa', 'SM Tajawal'" : "'TY Rock', 'TY Outfit'";
    const sz = fitSize(full, `400 {}px ${ff}`, pw * 0.86, mn * 0.06);
    // الكتابة بتظهر حرف حرف (زي إيد بتكتب) ومع رعشة خفيفة
    const n = Math.ceil(seg(t, it[0]?.t0 ?? b.t0, Math.max((it[it.length - 1]?.t0 ?? b.t0) + 0.4, (it[0]?.t0 ?? b.t0) + 0.6)) * [...full].length);
    const j = rng(Math.floor(t * 12) + bi);
    const under = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(80,10,14,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)"></div>` : backdrop(this, th);
    return under + `<div style="position:absolute;left:${(cx - pw / 2).toFixed(1)}px;top:${(cy - ph / 2).toFixed(1)}px;width:${pw.toFixed(1)}px;height:${ph.toFixed(1)}px;background:#ECEAE4;
      box-shadow:0 ${(mn * 0.03).toFixed(0)}px ${(mn * 0.06).toFixed(0)}px rgba(0,0,0,.45);transform:rotate(${rot.toFixed(2)}deg);opacity:${k2.toFixed(3)}">
      <div style="position:absolute;left:6%;top:5%;width:88%;height:70%;background:${src ? `url(${src}) center/cover` : `linear-gradient(150deg, ${th.accent || RED}, #121A2E)`};filter:saturate(.9) contrast(1.05)"></div>
      <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:6%;right:6%;top:79%;text-align:center;font:400 ${sz.toFixed(1)}px ${ff};color:#1a1a1a;white-space:nowrap;
        transform:translate(${((j() - 0.5) * 2).toFixed(1)}px,${((j() - 0.5) * 2).toFixed(1)}px)">${esc([...full].slice(0, n).join(""))}</div></div>`;
  };

  // ---------- cards
  const CARD_COLS = [["#E5261F", "#fff"], ["#F4EFE9", "#121A2E"], ["#121A2E", "#F4EFE9"], ["#F7D046", "#111"], ["#2F7CF6", "#fff"]];
  P.k_cards = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const cs = chunks(this.items(b), Math.min(4, Math.max(2, Math.ceil(this.items(b).length / 2))));
    const src = imgOf(b);
    if (src) this._want = src;
    const cw = Math.min(w * 0.5, h * 0.34), chh = cw * 1.42;
    let html = backdrop(this, th) + (onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.45)"></div>` : "");
    html += `<div style="position:absolute;inset:0;perspective:${(mn * 1.6).toFixed(0)}px">`;
    cs.forEach((c, i) => {
      if (t < c.t0 - 0.1) return;
      const kk = eOut(seg(t, c.t0 - 0.1, c.t0 + 0.35));
      const [bgc, col] = CARD_COLS[(i + bi) % CARD_COLS.length];
      const slot = i - (cs.length - 1) / 2;
      const x = w / 2 + slot * cw * 0.42 - cw / 2, y = h * 0.42 - chh / 2 + Math.abs(slot) * mn * 0.02;
      const z = lerp(-mn * 1.4, -Math.abs(slot) * mn * 0.08, kk);
      const fs = fitSize(c.w, `800 {}px ${famOf(c.w)}`, cw * 0.84, cw * 0.13);
      html += `<div dir="${this.dir(c.w)}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;height:${chh.toFixed(1)}px;box-sizing:border-box;
        transform:rotateY(${lerp(-60, -24 + slot * 6, kk).toFixed(1)}deg) translateZ(${z.toFixed(1)}px) rotateZ(${(slot * 3).toFixed(1)}deg);filter:blur(${((1 - kk) * 8).toFixed(1)}px);opacity:${clamp(kk * 2).toFixed(3)};
        background:${bgc};color:${col};border-radius:${(cw * 0.04).toFixed(1)}px;padding:${(cw * 0.08).toFixed(1)}px;box-shadow:0 ${(mn * 0.03).toFixed(0)}px ${(mn * 0.06).toFixed(0)}px rgba(0,0,0,.45);overflow:hidden">
        <div style="display:flex;justify-content:space-between;font:600 ${(cw * 0.035).toFixed(1)}px 'TY Outfit';opacity:.7"><span>■ ${String(i + 1).padStart(2, "0")}</span><span style="border:1px solid;border-radius:9px;padding:0 6px">NEW</span></div>
        <div style="font:800 ${fs.toFixed(1)}px ${famOf(c.w)};line-height:1.05;margin:${(cw * 0.06).toFixed(1)}px 0">${esc(this.text(c.w))}</div>
        <div style="height:${(chh * 0.36).toFixed(1)}px;border-radius:6px;background:${src ? `url(${src}) ${30 + i * 20}% 40%/cover` : `${col}22`}"></div>
        ${[70, 90, 55].map((pc) => `<div style="height:${(chh * 0.012).toFixed(1)}px;width:${pc}%;background:${col};opacity:.35;margin:${(chh * 0.022).toFixed(1)}px 0"></div>`).join("")}</div>`;
    });
    return html + "</div>";
  };

  // ---------- burst
  P.k_burst = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const txt = it.map((x) => this.text(x.w)).join(" ");
    const ar = AR.test(txt);
    const ff = ar ? "'SM Lalezar', 'SM Tajawal'" : "'TY Rock', 'TY Outfit'";
    const cx = w / 2, cy = h * 0.45;
    const t0 = it[0]?.t0 ?? b.t0;
    const pk = eBack(seg(t, t0, t0 + 0.18)), lk = eOut(seg(t, t0 - 0.05, t0 + 0.2));
    const r = rng(bi * 7 + 4);
    let lines = "";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * 6.283 + r() * 0.2, r1 = mn * (0.3 + r() * 0.06), r2 = mn * (0.55 + r() * 0.2) * lk;
      lines += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * Math.max(r1, r2)).toFixed(1)}" y2="${(cy + Math.sin(a) * Math.max(r1, r2)).toFixed(1)}" stroke="#111" stroke-width="${(mn * (0.006 + r() * 0.006)).toFixed(1)}" stroke-linecap="round"/>`;
    }
    const sz = fitSize(txt, `400 {}px ${ff}`, w * 0.84, mn * 0.2);
    const shake = t - t0 < 0.25 ? (r() - 0.5) * mn * 0.02 : 0;
    return `<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 45%, #f6a33a, #ee8a1c 55%, #d96f0f)"></div>
      <div style="position:absolute;inset:0;background:radial-gradient(circle, rgba(0,0,0,.14) 22%, transparent 24%) 0 0/${(mn * 0.025).toFixed(0)}px ${(mn * 0.025).toFixed(0)}px"></div>
      <svg style="position:absolute;inset:0" width="${w}" height="${h}">${lines}</svg>
      <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(cx + shake).toFixed(1)}px;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%) rotate(-4deg) scale(${pk.toFixed(3)});font:400 ${sz.toFixed(1)}px ${ff};color:#fff;
        -webkit-text-stroke:${(sz * 0.05).toFixed(1)}px #111;paint-order:stroke fill;white-space:nowrap;text-shadow:${(sz * 0.04).toFixed(1)}px ${(sz * 0.05).toFixed(1)}px 0 #111">${esc(txt)}</div>`;
  };

  // ---------- dots
  P.k_dots = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const a = this.personAt(t);
    const kk = eOut(seg(t, b.t0, b.t0 + 0.8));
    const step = mn * 0.012;
    let html = `<div style="position:absolute;inset:0;background:rgba(4,6,14,${onVideo(this) ? 0.86 : 1})"></div>`;
    if (a) {
      const { x, y, w: iw, h: ih } = a.img;
      this._want = a.url;
      const dot = `radial-gradient(circle, #000 ${(step * 0.28).toFixed(1)}px, transparent ${(step * 0.36).toFixed(1)}px) 0 0/${step.toFixed(1)}px ${step.toFixed(1)}px`;
      html += `<img src="${a.url}" alt="" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${iw.toFixed(1)}px;height:${ih.toFixed(1)}px;pointer-events:none;
        filter:brightness(${lerp(1, 2.1, kk).toFixed(2)}) saturate(1.3) drop-shadow(0 0 ${(mn * 0.006).toFixed(1)}px rgba(255,230,190,.6));-webkit-mask:${dot};mask:${dot};opacity:${lerp(0.4, 1, kk).toFixed(3)}">`;
    }
    // نقط بتلمع حوالين الشخص
    const r = rng(Math.floor(t * 15) + 3), hd = this.headAt(t);
    for (let i = 0; i < 70; i++) {
      const px = hd.x + (r() - 0.5) * w * 0.7, py = hd.y + (r() - 0.3) * h * 0.5, sz = 2 + r() * 3;
      html += `<i style="position:absolute;left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;background:#ffe9c4;opacity:${(r() * 0.8 * kk).toFixed(2)}"></i>`;
    }
    const it = this.items(b), fr = this.freeRect(b);
    const shown = it.filter((x) => t >= x.t0);
    shown.forEach((x, i) => {
      const p = POP(t, x.t0);
      const sz = fitSize(x.w, `800 {}px ${famOf(x.w)}`, fr.w * 0.9, mn * 0.08);
      html += `<div dir="${this.dir(x.w)}" style="position:absolute;left:${(fr.x + fr.w / 2).toFixed(1)}px;top:${(fr.y + fr.h * 0.2 + i * sz * 1.25).toFixed(1)}px;transform:translate(-50%,-50%) scale(${p.s.toFixed(3)});opacity:${p.a.toFixed(3)};
        font:800 ${sz.toFixed(1)}px ${famOf(x.w)};letter-spacing:-0.03em;white-space:nowrap;color:${i === b.focus ? th.accent || RED : "#fff"};text-shadow:0 0 ${(sz * 0.3).toFixed(0)}px rgba(255,230,190,.35)">${esc(this.text(x.w))}</div>`;
    });
    return html;
  };

  // ---------- neon
  P.k_neon = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const txt = it.map((x) => x.w).join(" ");
    const ar = AR.test(txt);
    const ff = ar ? "'SM Lalezar', 'SM Tajawal'" : "'TY Anton', 'TY Outfit'";
    const bs = this.blockSolid(b);
    const hd = this.headAt(t);
    const s2 = ar ? txt : txt.toUpperCase();
    const sz = fitSize(s2, `400 {}px ${ff}`, w * 0.92, mn * 0.36);
    // سطر واحد ورا فوق الراس (زي الكلام اللي ورا الشخص)، والشخص بيغطي الجزء التحتاني منه
    const cy = bs ? clamp(hd.top + sz * 0.3, sz * 0.6, h * 0.7) : h * 0.42;
    const under = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.35)"></div>` : `<div style="position:absolute;inset:0;background:#08080A"></div>`;
    let html = "";
    const shown = it.filter((x) => t >= x.t0);
    if (shown.length) {
      const last = shown[shown.length - 1];
      // النيون بيولّع برعشة
      const on = seg(t, last.t0, last.t0 + 0.25), fl = on < 1 ? (Math.floor(t * 30) % 3 ? 1 : 0.3) * on : 0.92 + Math.sin(t * 40) * 0.04;
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${w / 2}px;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%);font:400 ${sz.toFixed(1)}px ${ff};line-height:1;white-space:nowrap;color:#ff2a32;
        text-shadow:0 0 ${(sz * 0.05).toFixed(0)}px #ff1a24,0 0 ${(sz * 0.16).toFixed(0)}px #ff0010,0 0 ${(sz * 0.32).toFixed(0)}px rgba(255,0,20,.6)">${shown.map((x) =>
        `<span style="opacity:${(x === last ? fl : 0.92 + Math.sin(t * 40) * 0.04).toFixed(3)}">${esc(ar ? x.w : x.w.toUpperCase())}</span>`).join(" ")}</div>`;
    }
    return under + (bs ? this.behindPerson(t, html) : html);
  };

  // =====================================================================
  // الدفعة الخامسة (فيديو 24: بينك وأسود)
  //   outline  كلمة كبيرة بيضا بحدود بينك ودبل بينك، حروفها بتنط واحدة واحدة، وتاج بينك مايل بيتكتب فيه الكلمة المهمة
  //   spin     أول حرفين من الكلمة عملاقين بيلفوا مالين الكادر، وبعدين الكلمة كاملة على أسود بخط بينك
  //   sweep    كلمة عملاقة بتعدّي بسرعة بموشن بلير، وبعدين بتصغر في النص ونسخ منها بتلف حواليها في دايرة 3D
  //   extrude  كلام بينك بعمق 3D بيتكتب حرف حرف على شبكة، وآخر كلمة في مربع أسود
  //   stories  كروت ستوري بتلف في 3D والكلام على الكارت اللي في النص
  //   post     كارت بوست (شكل عام) بيدخل بنطة والكلام طالع منه بحدود بينك
  // =====================================================================
  const PINK = "#FF3EA5", PINKD = "#B3126A";
  const popFont = (s) => (AR.test(s) ? "'SM Lalezar', 'SM Tajawal'" : "'TY Outfit', 'SM Tajawal'");
  const pinkGrid = (eng, th) => (onVideo(eng) ? "" : `<div style="position:absolute;inset:0;background:#FBFAFC"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px) 0 0/${(eng.doc.w / 6).toFixed(0)}px ${(eng.doc.w / 6).toFixed(0)}px,linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px) 0 0/${(eng.doc.w / 6).toFixed(0)}px ${(eng.doc.w / 6).toFixed(0)}px"></div>`);
  // الحرف الأبيض بحدود بينك وعمق بينك غامق (نفس شكل المرجع)
  const outlined = (sz) => `color:#fff;-webkit-text-stroke:${(sz * 0.045).toFixed(1)}px ${PINK};paint-order:stroke fill;text-shadow:${[1, 2, 3, 4, 5, 6].map((k) => `${(sz * 0.012 * k).toFixed(1)}px ${(sz * 0.012 * k).toFixed(1)}px 0 ${PINKD}`).join(",")}`;

  // ---------- outline
  P.k_outline = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const ar = AR.test(it.map((x) => x.w).join(""));
    const ff = popFont(ar ? "ع" : "a");
    const per = it.length <= 2 ? 1 : 2;
    const lines = [];
    for (let i = 0; i < it.length; i += per) lines.push(it.slice(i, i + per));
    const size = Math.min(...lines.map((ln) => fitSize(ln.map((x) => this.text(x.w)).join(" "), `800 {}px ${ff}`, w * 0.9, mn * 0.3)), (h * 0.5) / lines.length);
    const cy0 = this.blockSolid(b) ? this.belowHead(b, size * lines.length) : h * 0.5;
    let html = pinkGrid(this, th);
    lines.forEach((ln, li) => {
      const y = cy0 + (li - (lines.length - 1) / 2) * size * 1.02;
      // الحروف بتنط واحدة واحدة (العربي متوصل: الكلمة كلها مرة واحدة)
      const parts = [];
      ln.forEach((x, wi) => {
        const s = this.text(x.w);
        const chars = AR.test(s) ? [s] : [...s];
        chars.forEach((c, ci) => parts.push({ c, t0: x.t0 + ci * 0.045 }));
        if (wi < ln.length - 1) parts.push({ c: " ", t0: x.t0 });
      });
      const inner = parts.map((q) => {
        if (q.c === " ") return " ";
        if (t < q.t0) return `<span style="opacity:0">${esc(q.c)}</span>`;
        const e = eBack(seg(t, q.t0, q.t0 + 0.2));
        return `<span style="display:inline-block;transform:translateY(${((1 - e) * size * 0.35).toFixed(1)}px) scale(${lerp(1.5, 1, e).toFixed(3)}) rotate(${((1 - e) * -12).toFixed(1)}deg)">${esc(q.c)}</span>`;
      }).join("");
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;transform:translateY(-50%) rotate(-4deg);text-align:center;white-space:pre;font:italic 800 ${size.toFixed(1)}px ${ff};letter-spacing:-0.03em;line-height:1;${outlined(size)}">${inner}</div>`;
    });
    // التاج البينك: الكلمة المهمة بتتكتب حرف حرف جواه
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : -1;
    if (fi >= 0 && t >= it[fi].t0 - 0.2) {
      const s = this.text(it[fi].w), n = Math.min([...s].length, Math.floor((t - it[fi].t0 + 0.2) / 0.06));
      const tz = size * 0.32, p = eBack(seg(t, it[fi].t0 - 0.2, it[fi].t0));
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${(w * 0.62).toFixed(1)}px;top:${(cy0 - size * (lines.length * 0.5 + 0.55)).toFixed(1)}px;transform:translate(-50%,-50%) rotate(-18deg) scale(${p.toFixed(3)});
        background:${PINK};padding:${(tz * 0.15).toFixed(1)}px ${(tz * 0.5).toFixed(1)}px;min-width:${(tz * 2.4).toFixed(0)}px;font:300 ${tz.toFixed(1)}px ${ff};color:transparent;-webkit-text-stroke:${Math.max(1, tz * 0.03).toFixed(1)}px #fff;white-space:nowrap;box-shadow:${(tz * 0.08).toFixed(1)}px ${(tz * 0.08).toFixed(1)}px 0 #111">${esc([...s].slice(0, n).join("")) || "&nbsp;"}</div>`;
    }
    return html;
  };

  // ---------- spin
  P.k_spin = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const main = it.reduce((a, x) => (x.w.length > a.w.length ? x : a), it[0] || { w: "", t0: b.t0 });
    const s = this.text(main.w).replace(/[.,،!?؟]+$/, "");
    const ar = AR.test(s);
    const ff = popFont(s);
    const dur = Math.max(0.4, b.t1 - b.t0), split = b.t0 + dur * 0.5;
    let html = `<div style="position:absolute;inset:0;background:#0B0B0D"></div>`;
    if (t < split) {
      // أول جزء: أول حرفين عملاقين بينك وأسود بيلفوا
      const g = ar ? s.slice(0, 2) : s.slice(0, 2).toLowerCase();
      const kk = eOut(seg(t, b.t0, split));
      const rot = lerp(-120, -20, kk), sc = lerp(1.6, 1.05, kk);
      html += `<div style="position:absolute;left:0;top:0;width:${(w * 0.42).toFixed(0)}px;height:${h}px;background:${PINK}"></div>
        <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)});font:800 ${(mn * 1.05).toFixed(0)}px ${ff};line-height:.8;white-space:nowrap;color:${PINKD};mix-blend-mode:normal;
        -webkit-text-stroke:${(mn * 0.01).toFixed(1)}px #111">${esc(g)}</div>
        <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(w * 0.25).toFixed(0)}px;top:50%;transform:translate(-50%,-50%) rotate(-90deg);font:600 ${(mn * 0.14).toFixed(0)}px ${ff};color:#fff;opacity:${seg(t, b.t0 + dur * 0.15, b.t0 + dur * 0.25).toFixed(3)};white-space:nowrap;letter-spacing:-0.02em">${esc(ar ? s : s.toLowerCase())}</div>`;
    } else {
      const p = eBack(seg(t, split, split + 0.18));
      const sz = fitSize(s, `800 {}px ${ff}`, w * 0.7, mn * 0.13);
      html += `<div style="position:absolute;left:0;right:0;top:${(h * 0.38).toFixed(0)}px;height:${(h * 0.24).toFixed(0)}px;background:${PINK};transform:skewY(-8deg) scaleX(${p.toFixed(3)})"></div>
        <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:50%;top:${(h * 0.5).toFixed(0)}px;transform:translate(-50%,-50%) rotate(-8deg) scale(${p.toFixed(3)});font:800 ${sz.toFixed(1)}px ${ff};color:#fff;white-space:nowrap;letter-spacing:-0.02em;
        background:#0B0B0D;padding:${(sz * 0.1).toFixed(1)}px ${(sz * 0.3).toFixed(1)}px">${esc(ar ? s : s.toLowerCase())}</div>`;
    }
    return html;
  };

  // ---------- sweep
  P.k_sweep = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const main = it.reduce((a, x) => (x.w.length > a.w.length ? x : a), it[0] || { w: "", t0: b.t0 });
    const s = this.text(main.w).replace(/[.,،!?؟]+$/, "");
    const ar = AR.test(s);
    const ff = popFont(s);
    const dur = Math.max(0.6, b.t1 - b.t0), t0 = b.t0, mid = t0 + Math.min(1.0, dur * 0.45);
    let html = `<div style="position:absolute;inset:0;background:${onVideo(this) ? "rgba(5,5,7,.86)" : "#050507"}"></div>`;
    if (t < mid) {
      // الكلمة العملاقة بتعدّي من اليمين للشمال وهي بتلف، ومعاها نسخ مطموسة وراها (موشن بلير)
      const kk = seg(t, t0, mid), x = lerp(w * 1.1, -w * 0.4, eOut(kk));
      const big = (ar ? s : s.toUpperCase());
      const sz = mn * 0.55;
      for (let q = 3; q >= 0; q--) {
        const xx = x + q * mn * 0.06 * (1 - kk);
        html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${xx.toFixed(1)}px;top:50%;transform:translateY(-50%) perspective(${(mn * 2).toFixed(0)}px) rotateY(${lerp(-35, 10, kk).toFixed(1)}deg) rotateZ(${lerp(14, -6, kk).toFixed(1)}deg);
          font:800 ${sz.toFixed(0)}px ${ff};color:#fff;white-space:nowrap;opacity:${(q ? 0.22 : 1).toFixed(2)};filter:blur(${(q * 4 + (1 - kk) * 10).toFixed(1)}px)">${esc(big)}</div>`;
      }
    } else {
      // الكلمة صغيرة في النص، ونسخ منها بتلف حواليها في دايرة 3D
      const kk = eOut(seg(t, mid, mid + 0.35));
      const ring = 10, R = mn * 0.36, rot = (t - mid) * 40;
      const rz = mn * 0.05;
      let r = "";
      for (let q = 0; q < ring; q++) {
        const a = (q * 360) / ring + rot;
        r += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotateY(${a.toFixed(1)}deg) translateZ(${R.toFixed(0)}px);font:500 ${rz.toFixed(1)}px ${ff};color:#fff;white-space:nowrap;
          opacity:${(0.25 + 0.55 * Math.max(0, Math.cos((a * Math.PI) / 180))).toFixed(2)};filter:blur(${(Math.max(0, -Math.cos((a * Math.PI) / 180)) * 2).toFixed(1)}px)">${esc(ar ? s : s.toLowerCase())}</div>`;
      }
      html += `<div style="position:absolute;inset:0;perspective:${(mn * 1.6).toFixed(0)}px;opacity:${kk.toFixed(3)}"><div style="position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(-16deg)">${r}</div></div>`;
      const sz = fitSize(s, `800 {}px ${ff}`, w * 0.6, mn * 0.11);
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-4deg) scale(${lerp(2.5, 1, kk).toFixed(3)});filter:blur(${((1 - kk) * 8).toFixed(1)}px);font:800 ${sz.toFixed(1)}px ${ff};color:#fff;white-space:nowrap">${esc(ar ? s : s.toLowerCase())}</div>`;
    }
    return html;
  };

  // ---------- extrude
  P.k_extrude = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const last = it.length > 1 ? it[it.length - 1] : null;
    const body = last ? it.slice(0, -1) : it;
    const full = body.map((x) => this.text(x.w)).join(" ");
    const ar = AR.test(full);
    const ff = popFont(full);
    const per = body.length <= 2 ? 1 : 2;
    const lines = [];
    for (let i = 0; i < body.length; i += per) lines.push(body.slice(i, i + per));
    const size = Math.min(...lines.map((ln) => fitSize(ln.map((x) => this.text(x.w)).join(" "), `800 {}px ${ff}`, w * 0.74, mn * 0.16)));
    const deep = [1, 2, 3, 4, 5, 6, 7, 8].map((q) => `${(size * 0.008 * q).toFixed(1)}px ${(size * 0.012 * q).toFixed(1)}px 0 ${q === 8 ? "#5c0a37" : PINKD}`).join(",");
    let html = pinkGrid(this, th);
    if (!onVideo(this)) html += `<svg style="position:absolute;left:${(w * 0.5 - mn * 0.3).toFixed(0)}px;top:${(h * 0.45 - mn * 0.3).toFixed(0)}px" width="${(mn * 0.6).toFixed(0)}" height="${(mn * 0.6).toFixed(0)}" viewBox="-50 -50 100 100"><polygon fill="#E8E4F8" points="${Array.from({ length: 16 }, (_, q) => { const r = q % 2 ? 22 : 48, a = (q * Math.PI) / 8; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join(" ")}"/></svg>`;
    const cy0 = this.blockSolid(b) ? this.belowHead(b, size * lines.length) : h * 0.45;
    lines.forEach((ln, li) => {
      const y = cy0 + (li - (lines.length - 1) / 2) * size * 1.05;
      // حرف حرف (العربي: كلمة كلمة)
      const parts = [];
      ln.forEach((x, wi) => {
        const s = this.text(x.w), chars = AR.test(s) ? [s] : [...s];
        const span = Math.max(0.12, Math.min(0.4, (it[it.indexOf(x) + 1]?.t0 ?? x.t0 + 0.4) - x.t0));
        chars.forEach((c, ci) => parts.push({ c, t0: x.t0 + (span * ci) / chars.length }));
        if (wi < ln.length - 1) parts.push({ c: " ", t0: x.t0 });
      });
      const inner = parts.map((q) => (q.c === " " ? " " : t >= q.t0 ? esc(q.c) : "")).join("");
      if (inner.trim()) html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;transform:translateY(-50%) perspective(${(mn * 1.5).toFixed(0)}px) rotateY(-14deg) rotateX(8deg);text-align:center;white-space:pre;
        font:800 ${size.toFixed(1)}px ${ff};letter-spacing:-0.02em;line-height:1;color:${PINK};text-shadow:${deep}">${inner}</div>`;
    });
    if (last && t >= last.t0) {
      const s = this.text(last.w), p = eBack(seg(t, last.t0, last.t0 + 0.18));
      const lz = fitSize(s, `800 {}px ${popFont(s)}`, w * 0.6, size * 0.9);
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:50%;top:${(cy0 + size * (lines.length * 0.55 + 0.6)).toFixed(1)}px;transform:translate(-50%,-50%) rotate(-6deg) scale(${p.toFixed(3)});background:#0B0B0D;color:#fff;
        font:800 ${lz.toFixed(1)}px ${popFont(s)};padding:${(lz * 0.08).toFixed(1)}px ${(lz * 0.3).toFixed(1)}px;white-space:nowrap;letter-spacing:-0.02em">${esc(s)}</div>`;
    }
    return html;
  };

  // ---------- stories
  P.k_stories = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const src = imgOf(b);
    if (src) this._want = src;
    const cw = Math.min(w * 0.56, h * 0.33), chh = cw * 1.72, R = cw * 1.7;
    const kk = eOut(seg(t, b.t0, b.t0 + 0.45));
    const base = lerp(-120, 0, kk);
    const checker = `repeating-conic-gradient(rgba(255,255,255,.35) 0 25%, transparent 0 50%) 0 0/${(cw * 0.12).toFixed(0)}px ${(cw * 0.12).toFixed(0)}px`;
    let cards = "";
    for (let q = -2; q <= 2; q++) {
      const a = base + q * 40;
      const img = src ? `url(${src}) ${30 + q * 15}% 30%/cover` : `linear-gradient(170deg,#fff 0%,${PINK} 100%)`;
      const center = q === 0;
      const txt = center ? it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ") : "";
      const fz = fitSize(it.map((x) => this.text(x.w)).join(" "), `800 {}px ${popFont(txt || "a")}`, cw * 1.6, cw * 0.16);
      cards += `<div style="position:absolute;left:50%;top:50%;width:${cw.toFixed(0)}px;height:${chh.toFixed(0)}px;margin:${(-chh / 2).toFixed(0)}px 0 0 ${(-cw / 2).toFixed(0)}px;transform:rotateY(${a.toFixed(1)}deg) translateZ(${R.toFixed(0)}px);
        border-radius:${(cw * 0.08).toFixed(0)}px;overflow:hidden;background:${img};box-shadow:0 0 0 ${(cw * 0.012).toFixed(1)}px #fff inset;backface-visibility:hidden">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,${PINK}dd)"></div>
        <div style="position:absolute;left:0;right:0;bottom:0;height:35%;background:${checker};opacity:.45"></div>
        <div style="position:absolute;left:6%;top:3%;width:${(cw * 0.1).toFixed(0)}px;height:${(cw * 0.1).toFixed(0)}px;border-radius:50%;background:#111;border:2px solid #fff"></div>
        <div style="position:absolute;left:20%;top:4.5%;width:40%;height:${(cw * 0.025).toFixed(1)}px;border-radius:9px;background:rgba(255,255,255,.8)"></div>
        <div style="position:absolute;left:6%;right:22%;bottom:4%;height:${(cw * 0.1).toFixed(0)}px;border-radius:${cw}px;border:2px solid rgba(255,255,255,.85)"></div>
        ${txt ? `<div dir="${this.dir(txt)}" style="position:absolute;left:8%;right:8%;top:28%;font:800 ${fz.toFixed(1)}px ${popFont(txt)};color:${src ? "#fff" : "#111"};${src ? "text-shadow:0 2px 12px rgba(0,0,0,.55);" : ""}line-height:1.05;letter-spacing:-0.02em">${esc(txt)}</div>` : ""}</div>`;
    }
    const under = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.6)"></div>` : `<div style="position:absolute;inset:0;background:#050507"></div>
      <div style="position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px) 0 0/${(w / 6).toFixed(0)}px ${(w / 6).toFixed(0)}px,linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px) 0 0/${(w / 6).toFixed(0)}px ${(w / 6).toFixed(0)}px"></div>`;
    return under + `<div style="position:absolute;inset:0;perspective:${(mn * 2.2).toFixed(0)}px"><div style="position:absolute;inset:0;transform-style:preserve-3d;transform:translateZ(${(-R).toFixed(0)}px)">${cards}</div></div>`;
  };

  // ---------- post
  P.k_post = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const src = imgOf(b);
    if (src) this._want = src;
    const cw = Math.min(w * 0.7, h * 0.42);
    const p = eBack(seg(t, b.t0, b.t0 + 0.35));
    const cx = w / 2, cy = h * 0.47;
    const ic = (d) => `<svg width="${(cw * 0.06).toFixed(0)}" height="${(cw * 0.06).toFixed(0)}" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2">${d}</svg>`;
    const icons = [ic('<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>'), ic('<path d="M21 12a8 8 0 1 1-3-6.3L21 4v5h-5"/>'), ic('<path d="M3 11l18-8-8 18-2-8z"/>')].join(`<i style="width:${(cw * 0.04).toFixed(0)}px"></i>`);
    const card = `<div style="position:absolute;left:${(cx - cw / 2).toFixed(0)}px;top:${(cy - cw * 0.72).toFixed(0)}px;width:${cw.toFixed(0)}px;background:#fff;border-radius:${(cw * 0.02).toFixed(0)}px;box-shadow:0 ${(mn * 0.03).toFixed(0)}px ${(mn * 0.08).toFixed(0)}px rgba(0,0,0,.25);
      transform:perspective(${(mn * 2).toFixed(0)}px) rotateY(${lerp(30, -8, p).toFixed(1)}deg) rotateZ(${lerp(-10, 3, p).toFixed(1)}deg) scale(${lerp(0.6, 1, p).toFixed(3)});opacity:${clamp(p * 1.5).toFixed(3)};padding:${(cw * 0.03).toFixed(0)}px;box-sizing:border-box">
      <div style="display:flex;align-items:center;gap:${(cw * 0.025).toFixed(0)}px;font:700 ${(cw * 0.035).toFixed(1)}px 'TY Outfit';color:#111;margin-bottom:${(cw * 0.025).toFixed(0)}px"><b style="width:${(cw * 0.07).toFixed(0)}px;height:${(cw * 0.07).toFixed(0)}px;border-radius:50%;background:#111"></b>studio<span style="margin-left:auto;opacity:.5">•••</span></div>
      <div style="height:${(cw * 0.9).toFixed(0)}px;background:${src ? `url(${src}) center/cover` : `repeating-conic-gradient(${PINK} 0 25%, #111 0 50%) 0 0/${(cw * 0.25).toFixed(0)}px ${(cw * 0.25).toFixed(0)}px`};filter:${src ? "contrast(1.1) saturate(1.2)" : "none"}"></div>
      <div style="display:flex;align-items:center;margin-top:${(cw * 0.03).toFixed(0)}px">${icons}</div>
      <div style="font:600 ${(cw * 0.03).toFixed(1)}px 'TY Outfit';color:#111;margin-top:${(cw * 0.02).toFixed(0)}px">${(12 + bi * 7) % 90 + 10}.${bi % 9}K likes</div></div>`;
    // الكلام طالع من الكارت (فوق شمال الصورة) بنفس شكل outline
    const shown = it.filter((x) => t >= x.t0);
    let txt = "";
    if (shown.length) {
      const full = it.map((x) => this.text(x.w)).join(" ");
      const ar = AR.test(full);
      const sz = fitSize(full, `800 {}px ${popFont(full)}`, w * 0.9, mn * 0.17);
      const last = shown[shown.length - 1], e = eBack(seg(t, last.t0, last.t0 + 0.2));
      txt = `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${(cy - cw * 0.5).toFixed(0)}px;text-align:center;transform:rotate(-6deg);font:italic 800 ${sz.toFixed(1)}px ${popFont(full)};letter-spacing:-0.03em;line-height:1;white-space:nowrap;${outlined(sz)}">${shown.map((x) =>
        `<span style="display:inline-block;${x === last ? `transform:scale(${lerp(1.5, 1, e).toFixed(3)})` : ""}">${esc(this.text(x.w))}</span>`).join(" ")}</div>`;
    }
    return pinkGrid(this, th) + card + txt;
  };

  // =====================================================================
  // الدفعة السادسة (فيديو 25: بوستر قديم، ورق بيج وأحمر وأزرق)
  //   retro    ورق بيج ونجمة حمرا ورا الشخص (سيلويت أسود)، كلام كريمي مضغوط خشن وراه، ولافتات سودا بتتكتب
  //   duotone  الفيديو أزرق بنقط والشخص سيلويت، كلام كريمي عملاق وراه، وكلام أحمر بيتكتب تحت وأشرطة ألوان صغيرة
  //   label    كلمة حمرا كبيرة مضغوطة وتاج أزرق بيتكتب فوقها، وتفاصيل صغيرة (نقط وخطوط وبرواز)
  //   mirror   كلمة مضغوطة غامقة وانعكاسها تحتها باهت
  //   banners  شرايط مايلة بتتحرك عكس بعض فيها الكلمة متكررة
  //   tiles    كروت صور مدوّرة (من الفيديو) وكارت أحمر في النص فيه الكلمة متكررة فوق بعض
  //   bubble   فقاعة كلام حمرا فيها الكلمة، وكلمة كبيرة كريمي وكلمة صغيرة سودا
  //   band     شريط أزرق مايل ورا كلمة كريمي عملاقة، وكلمة صغيرة سودا بتعدّي عليها
  // =====================================================================
  const RR = "#C0322D", RB = "#2A5797", CREAM = "#F1E9D8", INKR = "#16161A";
  const cond = (s) => (AR.test(s) ? "'SM Lalezar', 'SM Tajawal'" : "'TY Anton', 'TY Outfit'");
  const ROUGH = `<svg width="0" height="0" style="position:absolute"><filter id="tyRough"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter></svg>`;
  const paper = (eng) => `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 40% 35%, #D6C4AA, #BFA98C 85%)"></div>
    <svg style="position:absolute;inset:0;opacity:.18;mix-blend-mode:multiply" width="${eng.doc.w}" height="${eng.doc.h}"><filter id="tyPaper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="8"/><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 1.2 -0.2"/></filter><rect width="100%" height="100%" filter="url(#tyPaper)"/></svg>`;
  const star = (cx, cy, r, col, n = 14, seed = 1) => {
    const rr = rng(seed);
    const pts = Array.from({ length: n * 2 }, (_, q) => { const rad = q % 2 ? r * (0.55 + rr() * 0.1) : r * (0.9 + rr() * 0.2), a = (q * Math.PI) / n; return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`; });
    return `<polygon fill="${col}" points="${pts.join(" ")}"/>`;
  };
  // الشخص سيلويت (لون واحد) بقصّته الحادة، أو مفيش لو مفيش فيديو
  P.silhouette = function (t, col) {
    const a = this.personAt(t);
    if (!a || !this.doc.transparent) return "";
    const { x, y, w, h } = a.img, src = a.murl || a.url;
    this._want = src;
    return `<img src="${src}" alt="" style="position:absolute;width:1px;height:1px;opacity:0"><div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;background:${col};
      -webkit-mask:url(${src}) 0 0/100% 100% no-repeat;mask:url(${src}) 0 0/100% 100% no-repeat"></div>`;
  };
  const labelBox = (s, x, y, sz, bg, fg, rot = 0, sc = 1) => `<div dir="${AR.test(s) ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;transform:translate(-50%,-50%) rotate(${rot}deg) scale(${sc.toFixed(3)});background:${bg};color:${fg};
    font:700 ${sz.toFixed(1)}px ${AR.test(s) ? "'TY PlexAr'" : "'TY Outfit'"};padding:${(sz * 0.12).toFixed(1)}px ${(sz * 0.3).toFixed(1)}px;white-space:nowrap;letter-spacing:-0.01em;line-height:1.1">${esc(s) || "&nbsp;"}</div>`;
  const typed = (s, t, t0, cps = 16) => [...s].slice(0, Math.max(0, Math.floor((t - t0) * cps))).join("");

  // ---------- retro
  P.k_retro = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const n1 = Math.max(1, Math.ceil(it.length / 2));
    const head = it.slice(0, n1), rest = it.slice(n1);
    const bs = this.blockSolid(b), hd = bs ? this.blockHead(b) : null;
    const cx = hd ? hd.x : w / 2, cy = hd ? hd.y + hd.r * 0.6 : h * 0.4;
    const big = head.filter((x) => t >= x.t0).map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
    const sz = fitSize(head.map((x) => (AR.test(x.w) ? x.w : x.w.toUpperCase())).join(" "), `400 {}px ${cond(big || "a")}`, w * 0.94, mn * 0.36);
    const ks = eBack(seg(t, b.t0, b.t0 + 0.25));
    let html = paper(this) + ROUGH + `<svg style="position:absolute;inset:0" width="${w}" height="${h}"><g transform="translate(${cx} ${cy}) scale(${ks.toFixed(3)}) rotate(${((t - b.t0) * 6).toFixed(1)}) translate(${-cx} ${-cy})">${star(cx, cy, mn * 0.42, RR, 13, bi + 2)}</g></svg>`;
    if (big) html += `<div dir="${this.dir(big)}" style="position:absolute;left:0;right:0;top:${(hd ? Math.max(sz * 0.6, hd.top + sz * 0.15) : h * 0.32).toFixed(1)}px;transform:translateY(-50%) scaleY(1.15);text-align:center;font:400 ${sz.toFixed(1)}px ${cond(big)};color:${CREAM};
      line-height:1;white-space:nowrap;filter:url(#tyRough)">${esc(big)}</div>`;
    html += this.silhouette(t, INKR);
    // لافتات سودا: باقي الكلام بيتكتب جواها
    rest.forEach((x, i) => {
      if (t < x.t0) return;
      const s = AR.test(x.w) ? x.w : this.text(x.w).toLowerCase();
      html += labelBox(typed(s, t, x.t0, 20), cx + (i % 2 ? 1 : -1) * w * 0.08, (hd ? hd.y + hd.r * 1.8 : h * 0.55) + i * mn * 0.1, mn * 0.06, INKR, CREAM, i % 2 ? 3 : -2);
    });
    // سطر صغير فوق بيتكتب فيه الجملة كلها
    const all = it.map((x) => this.text(x.w)).join(" ");
    html += `<div dir="${this.dir(all)}" style="position:absolute;left:${(w * 0.55).toFixed(0)}px;top:${(h * 0.05).toFixed(0)}px;font:500 ${(mn * 0.022).toFixed(1)}px 'TY Outfit', 'TY PlexAr';color:${INKR};opacity:.8;white-space:nowrap">${esc(typed(all.toLowerCase(), t, b.t0, 24))}</div>`;
    return html;
  };

  // ---------- duotone
  P.k_duotone = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const n1 = Math.max(1, Math.ceil(it.length * 0.6));
    const head = it.slice(0, n1), rest = it.slice(n1);
    const bs = this.blockSolid(b), hd = bs ? this.blockHead(b) : null;
    const dot = (mn * 0.012).toFixed(1);
    let html = `<div style="position:absolute;inset:0;background:${onVideo(this) ? "rgba(26,62,128,.78)" : "linear-gradient(180deg,#3E6DB5,#18325E)"}"></div>
      <div style="position:absolute;inset:0;background:radial-gradient(circle, rgba(10,20,50,.35) 30%, transparent 32%) 0 0/${dot}px ${dot}px"></div>` + ROUGH;
    // الكلام الكريمي العملاق: كل كلمة في سطر، وراه الشخص
    const lines = head.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase()));
    const sz = Math.min(...lines.map((s) => fitSize(s, `400 {}px ${cond(s)}`, w * 0.92, mn * 0.4)), (h * 0.55) / Math.max(1, lines.length));
    const top = hd ? Math.max(sz * 0.55, hd.top) : h * 0.18;
    let words = "";
    head.forEach((x, i) => {
      if (t < x.t0) return;
      const e = eOut(seg(t, x.t0, x.t0 + 0.15));
      words += `<div dir="${this.dir(lines[i])}" style="position:absolute;left:0;right:0;top:${(top + i * sz * 0.95).toFixed(1)}px;transform:translateY(-50%) scaleY(1.12) translateX(${((1 - e) * w * 0.1).toFixed(1)}px);opacity:${e.toFixed(3)};text-align:center;
        font:400 ${sz.toFixed(1)}px ${cond(lines[i])};color:${CREAM};line-height:1;white-space:nowrap;filter:url(#tyRough)">${esc(lines[i])}</div>`;
    });
    html += words + this.silhouette(t, INKR);
    // الكلام الأحمر بيتكتب تحت
    const red = rest.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
    if (red && t >= rest[0].t0) {
      const rz = fitSize(red, `400 {}px ${cond(red)}`, w * 0.86, mn * 0.18);
      html += `<div dir="${this.dir(red)}" style="position:absolute;left:0;right:0;top:${Math.min(h * 0.82, top + head.length * sz * 0.95 + rz * 0.3).toFixed(1)}px;text-align:center;font:400 ${rz.toFixed(1)}px ${cond(red)};color:${RR};white-space:nowrap;transform:scaleY(1.1);filter:url(#tyRough)">${esc(typed(red, t, rest[0].t0, 14))}</div>`;
    }
    // أشرطة ألوان صغيرة تحت
    html += `<div style="position:absolute;left:50%;bottom:${(h * 0.05).toFixed(0)}px;transform:translateX(-50%);display:flex;height:${(mn * 0.018).toFixed(0)}px">${["#fff", "#fff", "#d9d4cc", RR, RB, "#fff", RR].map((c) => `<i style="width:${(mn * 0.035).toFixed(0)}px;background:${c}"></i>`).join("")}</div>`;
    return html;
  };

  // ---------- label
  P.k_label = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : 0;
    const main = it[fi] || { w: "", t0: b.t0 };
    const s = AR.test(main.w) ? main.w : this.text(main.w).toUpperCase();
    const rest = it.filter((x, i) => i !== fi);
    const sz = fitSize(s, `400 {}px ${cond(s)}`, w * 0.8, mn * 0.3);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.45;
    let html = (onVideo(this) ? "" : paper(this)) + ROUGH;
    if (t >= main.t0) {
      const e = eOut(seg(t, main.t0, main.t0 + 0.18));
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${cy.toFixed(1)}px;transform:translateY(-50%) scaleY(${lerp(0.4, 1.15, e).toFixed(3)});text-align:center;font:400 ${sz.toFixed(1)}px ${cond(s)};color:${RR};line-height:1;white-space:nowrap;filter:url(#tyRough)">${esc(s)}</div>`;
    }
    if (rest.length && t >= rest[0].t0) {
      const r = rest.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
      html += labelBox(typed(r, t, rest[0].t0, 18), w * 0.55, cy + sz * 0.05, sz * 0.2, RB, "#fff", -1);
    }
    // تفاصيل صغيرة (زي المرجع): نقط فوق، وخطوط حمرا وبرواز تحت
    const k2 = seg(t, b.t0, b.t0 + 0.4);
    html += `<div style="position:absolute;left:${(w * 0.12).toFixed(0)}px;top:${(cy - sz * 1.1).toFixed(0)}px;display:flex;gap:${(mn * 0.012).toFixed(0)}px;opacity:${k2.toFixed(2)}">${[1, 0.6, 0.3, 0.8].map((o) => `<i style="width:${(mn * 0.018).toFixed(0)}px;height:${(mn * 0.018).toFixed(0)}px;border-radius:50%;background:${INKR};opacity:${o}"></i>`).join("")}</div>`;
    const sy = cy + sz * 0.9;
    for (let q = 0; q < 6; q++) html += `<i style="position:absolute;left:${(w * 0.2).toFixed(0)}px;top:${(sy + q * mn * 0.022).toFixed(0)}px;width:${(mn * 0.1 * k2).toFixed(0)}px;height:${(mn * 0.01).toFixed(0)}px;background:${RR}"></i>
      <i style="position:absolute;right:${(w * 0.2).toFixed(0)}px;top:${(sy + q * mn * 0.022).toFixed(0)}px;width:${(mn * 0.1 * k2).toFixed(0)}px;height:${(mn * 0.01).toFixed(0)}px;background:${RR}"></i>`;
    html += `<div style="position:absolute;left:50%;top:${sy.toFixed(0)}px;width:${(mn * 0.14).toFixed(0)}px;height:${(mn * 0.2 * k2).toFixed(0)}px;transform:translateX(-50%);border:${(mn * 0.005).toFixed(1)}px solid ${INKR};border-bottom:none"></div>`;
    return html;
  };

  // ---------- mirror
  P.k_mirror = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const s = it.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
    const sz = fitSize(s, `400 {}px ${cond(s)}`, w * 0.9, mn * 0.26);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.45;
    const ink = onVideo(this) ? CREAM : INKR;
    // الحروف بتطلع من تحت لفوق واحدة واحدة
    const parts = [];
    it.forEach((x, wi) => {
      const q = AR.test(x.w) ? x.w : this.text(x.w).toUpperCase(), chars = AR.test(q) ? [q] : [...q];
      chars.forEach((c, ci) => parts.push({ c, t0: x.t0 + ci * 0.04 }));
      if (wi < it.length - 1) parts.push({ c: " ", t0: x.t0 });
    });
    const inner = (flip) => parts.map((q) => {
      if (q.c === " ") return " ";
      const e = eOut(seg(t, q.t0, q.t0 + 0.2));
      return `<span style="display:inline-block;opacity:${e.toFixed(3)};transform:translateY(${((1 - e) * sz * 0.4 * (flip ? -1 : 1)).toFixed(1)}px)">${esc(q.c)}</span>`;
    }).join("");
    const base = `position:absolute;left:0;right:0;text-align:center;font:400 ${sz.toFixed(1)}px ${cond(s)};line-height:1;white-space:pre;color:${ink}`;
    return (onVideo(this) ? "" : paper(this)) + `<div dir="${this.dir(s)}" style="${base};top:${(cy - sz * 0.5).toFixed(1)}px;height:${sz.toFixed(1)}px">${inner(false)}</div>
      <div dir="${this.dir(s)}" style="${base};top:${(cy + sz * 0.45 + sz * 0.7).toFixed(1)}px;height:${sz.toFixed(1)}px;transform:scaleY(-0.7);transform-origin:50% 0;opacity:.35;filter:blur(${(sz * 0.02).toFixed(1)}px);
        -webkit-mask:linear-gradient(0deg,rgba(0,0,0,.9),transparent 75%);mask:linear-gradient(0deg,rgba(0,0,0,.9),transparent 75%)">${inner(true)}</div>`;
  };

  // ---------- banners
  P.k_banners = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const main = it.reduce((a, x) => (x.w.length > a.w.length ? x : a), it[0] || { w: "", t0: b.t0 });
    const s = AR.test(main.w) ? main.w : this.text(main.w).toUpperCase().replace(/[.,،!?؟]+$/, "");
    const bands = [[h * 0.3, -8, INKR, CREAM, 1], [h * 0.52, 6, CREAM, INKR, -1], [h * 0.72, -5, RB, "#fff", 1]];
    const sz = mn * 0.09;
    const rep = Array(10).fill(esc(s)).join(` <span style="opacity:.6">•</span> `);
    let html = onVideo(this) ? "" : paper(this);
    bands.forEach(([y, rot, bg, fg, dir], i) => {
      const t0 = b.t0 + i * 0.12;
      if (t < t0) return;
      const e = eOut(seg(t, t0, t0 + 0.3)), off = ((t - b.t0) * mn * 0.25 * dir) % (w * 0.8) - w * 0.4;
      html += `<div style="position:absolute;left:${(-w * 0.3).toFixed(0)}px;width:${(w * 1.6).toFixed(0)}px;top:${y.toFixed(0)}px;transform:translateY(-50%) rotate(${rot}deg) scaleX(${e.toFixed(3)});background:${bg};overflow:hidden;height:${(sz * 1.35).toFixed(0)}px">
        <div dir="ltr" style="position:absolute;left:${off.toFixed(1)}px;top:50%;transform:translateY(-50%);white-space:nowrap;font:400 ${sz.toFixed(1)}px ${cond(s)};color:${fg};letter-spacing:.02em">${rep}</div></div>`;
    });
    return html;
  };

  // ---------- tiles
  P.k_tiles = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const src = imgOf(b);
    if (src) this._want = src;
    const tw = w * 0.42, thh = tw * 1.1, gap = mn * 0.025;
    const pan = (t - b.t0) * mn * 0.03;
    const kk = eOut(seg(t, b.t0, b.t0 + 0.4));
    let grid = "";
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      const x = w / 2 + c * (tw + gap) - tw / 2 + (r % 2) * tw * 0.3, y = h / 2 + r * (thh + gap) - thh / 2 - pan;
      if (r === 0 && c === 0) continue;
      grid += `<div style="position:absolute;left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${tw.toFixed(0)}px;height:${thh.toFixed(0)}px;border-radius:${(tw * 0.08).toFixed(0)}px;overflow:hidden;
        background:${src ? `url(${src}) ${(50 + c * 20)}% ${(40 + r * 15)}%/${(220 + ((r * 5 + c * 3 + bi) % 4) * 40)}%` : "#2a2a2e"};filter:grayscale(1) contrast(1.1) brightness(.7)"></div>`;
    }
    // الكارت الأحمر في النص: الكلمة المهمة متكررة فوق بعض، أو الكلام كله
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : -1;
    const shown = it.filter((x) => t >= x.t0);
    let center = "";
    if (shown.length) {
      const lines = fi >= 0 ? [0, 1, 2].map(() => it[fi].w) : shown.map((x) => x.w);
      const L = lines.map((s) => (AR.test(s) ? s : this.text(s).toUpperCase()));
      const fz = Math.min(...L.map((s) => fitSize(s, `400 {}px ${cond(s)}`, tw * 1.1, tw * 0.4)), (thh * 1.1) / L.length);
      center = `<div style="position:absolute;left:${(w / 2 - tw * 0.65).toFixed(0)}px;top:${(h / 2 - thh * 0.62).toFixed(0)}px;width:${(tw * 1.3).toFixed(0)}px;height:${(thh * 1.24).toFixed(0)}px;border-radius:${(tw * 0.08).toFixed(0)}px;background:${RR};overflow:hidden;
        display:flex;flex-direction:column;align-items:center;justify-content:center;transform:scale(${lerp(0.7, 1, kk).toFixed(3)});box-shadow:0 ${(mn * 0.02).toFixed(0)}px ${(mn * 0.05).toFixed(0)}px rgba(0,0,0,.4)">${L.map((s, i) =>
          `<div dir="${this.dir(s)}" style="font:400 ${fz.toFixed(1)}px ${cond(s)};line-height:.95;white-space:nowrap;color:${fi >= 0 && i !== 1 ? "#7a1a17" : CREAM};transform:scaleY(1.15)">${esc(s)}</div>`).join("")}</div>`;
    }
    return (onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(190,170,140,.92)"></div>` : paper(this))
      + `<div style="position:absolute;inset:0;transform:rotate(-6deg) scale(${lerp(1.3, 1, kk).toFixed(3)})">${grid}${center}</div>`;
  };

  // ---------- bubble
  P.k_bubble = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : it.length - 1;
    const word = it[fi] || { w: "", t0: b.t0 };
    const others = it.filter((x, i) => i !== fi);
    const bigW = others[0], smallW = others.slice(1);
    let html = onVideo(this) ? "" : paper(this) + `<div style="position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.07) 1px,transparent 1px) 0 0/${(w / 6).toFixed(0)}px ${(w / 6).toFixed(0)}px,linear-gradient(90deg,rgba(0,0,0,.07) 1px,transparent 1px) 0 0/${(w / 6).toFixed(0)}px ${(w / 6).toFixed(0)}px"></div>`;
    const cy = this.blockSolid(b) ? this.belowHead(b, mn * 0.2) : h * 0.5;
    if (bigW && t >= bigW.t0) {
      const s = AR.test(bigW.w) ? bigW.w : this.text(bigW.w).toUpperCase();
      const z = fitSize(s, `400 {}px ${cond(s)}`, w * 0.5, mn * 0.3), e = eOut(seg(t, bigW.t0, bigW.t0 + 0.18));
      html += `<i style="position:absolute;left:${(w * 0.12).toFixed(0)}px;top:${(cy + z * 0.3).toFixed(0)}px;width:${(w * 0.3 * e).toFixed(0)}px;height:${(mn * 0.04).toFixed(0)}px;background:${RR}"></i>
        <div dir="${this.dir(s)}" style="position:absolute;left:${(w * 0.3).toFixed(0)}px;top:${cy.toFixed(0)}px;transform:translate(-50%,-50%) scaleY(1.15) scale(${e.toFixed(3)});font:400 ${z.toFixed(1)}px ${cond(s)};color:${onVideo(this) ? CREAM : "#F4EEE3"};white-space:nowrap;text-shadow:0 2px 0 rgba(0,0,0,.15)">${esc(s)}</div>`;
    }
    smallW.forEach((x, i) => {
      if (t < x.t0) return;
      const s = AR.test(x.w) ? x.w : this.text(x.w).toUpperCase();
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${(w * 0.42).toFixed(0)}px;top:${(cy + mn * 0.12 + i * mn * 0.09).toFixed(0)}px;transform:rotate(-8deg);font:400 ${(mn * 0.09).toFixed(1)}px ${cond(s)};color:${INKR};white-space:nowrap">${esc(s)}</div>`;
    });
    if (t >= word.t0) {
      const s = AR.test(word.w) ? word.w : this.text(word.w).toUpperCase();
      const z = fitSize(s, `400 {}px ${cond(s)}`, w * 0.42, mn * 0.11), p = eBack(seg(t, word.t0, word.t0 + 0.2));
      const shown = typed(s, t, word.t0, 14);
      html += `<div style="position:absolute;left:${(w * 0.66).toFixed(0)}px;top:${(cy - mn * 0.2).toFixed(0)}px;transform:translate(-50%,-50%) rotate(-5deg) scale(${p.toFixed(3)})">
        <div dir="${this.dir(s)}" style="background:${RR};color:${CREAM};font:400 ${z.toFixed(1)}px ${cond(s)};padding:${(z * 0.2).toFixed(1)}px ${(z * 0.45).toFixed(1)}px;border-radius:${(z * 0.6).toFixed(0)}px;white-space:nowrap;min-width:${(z * 2).toFixed(0)}px;text-align:center">${esc(shown) || "&nbsp;"}</div>
        <i style="position:absolute;left:18%;bottom:${(-z * 0.3).toFixed(0)}px;width:0;height:0;border-left:${(z * 0.25).toFixed(0)}px solid transparent;border-right:${(z * 0.25).toFixed(0)}px solid transparent;border-top:${(z * 0.4).toFixed(0)}px solid ${RR};transform:skewX(-20deg)"></i></div>`;
    }
    return html;
  };

  // ---------- band
  P.k_band = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    // الكلمة العملاقة: المهمة (focus) أو أول كلمة (زي «SAVE yourself» في المرجع)
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : 0;
    const main = it[fi] || { w: "", t0: b.t0 };
    const s = AR.test(main.w) ? main.w : this.text(main.w).toUpperCase();
    const rest = it.filter((x, i) => i !== fi);
    const z = fitSize(s, `400 {}px ${cond(s)}`, w * 0.8, mn * 0.36);
    const cy = this.blockSolid(b) ? this.belowHead(b, z) : h * 0.5;
    const kb = eOut(seg(t, b.t0, b.t0 + 0.3));
    let html = (onVideo(this) ? "" : paper(this)) + `<div style="position:absolute;left:${(-w * 0.1).toFixed(0)}px;width:${(w * 1.2 * kb).toFixed(0)}px;top:${(cy + z * 0.08).toFixed(0)}px;height:${(z * 0.42).toFixed(0)}px;background:${RB};transform:rotate(-4deg)"></div>`;
    if (t >= main.t0) {
      const e = eOut(seg(t, main.t0, main.t0 + 0.18));
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${cy.toFixed(1)}px;transform:translateY(-50%) rotate(-4deg) scaleY(${lerp(0.5, 1.15, e).toFixed(3)});text-align:center;font:400 ${z.toFixed(1)}px ${cond(s)};color:${CREAM};white-space:nowrap;line-height:1;
        text-shadow:0 ${(z * 0.02).toFixed(1)}px 0 rgba(0,0,0,.2)">${esc(s)}</div>`;
    }
    if (rest.length && t >= rest[0].t0) {
      const r = rest.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
      html += `<div dir="${this.dir(r)}" style="position:absolute;left:0;right:0;top:${(cy - z * 0.05).toFixed(1)}px;transform:translateY(-50%) rotate(-4deg);text-align:center;font:400 ${(z * 0.2).toFixed(1)}px ${cond(r)};color:${INKR};white-space:nowrap">${esc(typed(r, t, rest[0].t0, 16))}</div>`;
    }
    return html;
  };
})();
