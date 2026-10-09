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
    ["TY PlexAr", "TY-PlexArabic-400.ttf", "400"], ["TY Ruqaa", "TY-ArefRuqaa-700.ttf", "400 900"], ["TY Outfit", "TY-Outfit-800.ttf", "800 900"],
    ["TY Serif", "TY-InstrumentSerif.ttf", "400"], ["TY SerifI", "TY-InstrumentSerif-Italic.ttf", "400"], ["TY Pixel", "TY-VT323.ttf", "400"],
    ["TY Type", "TY-SpecialElite.ttf", "400"], ["TY Rock", "TY-RockSalt.ttf", "400"]];
  let facesP = null;
  E.studioFonts = () => facesP || (facesP = Promise.all([...FACES.map(([fam, file, w]) =>
    new FontFace(fam, `url(/fonts/${file})`, { weight: w }).load().then((f) => document.fonts.add(f)).catch(() => {})),
    ...["SM Lalezar", "SM Changa", "SM Kufi", "SM Tajawal"].map((f) => E.font(f))]));
  E.STUDIO = new Set(["behind", "arc", "artype", "redword", "signature", "poster", "stack", "push", "crt", "ransom", "halo", "floor", "hand", "tags",
    "space", "route", "board", "cube", "comments", "lock", "thermal", "shapes", "select", "chat", "counter",
    "fill", "polaroid", "cards", "burst", "dots", "neon",
    "outline", "spin", "sweep", "extrude", "stories", "post",
    "retro", "duotone", "label", "mirror", "banners", "tiles", "bubble", "band", "emerge",
    "film", "ghost", "notify", "dialog", "pills", "steps", "scribble", "list", "prompt", "spread",
    "serif", "chalk", "ticket", "frame", "toggle", "years", "wave", "spaced", "search", "digits", "torn",
    "emoji", "doodle", "browser", "split", "spotlight", "phone",
    "window", "inline", "bigtype", "checks", "progress", "flow", "aura", "stairs", "dates", "endcard",
    "wintitle", "corners", "inbox", "doc", "workcards", "call", "canvas",
    "colorcard", "imsg", "dashboard", "apps", "bell", "chapter", "sidepanel",
    "clones", "megapan", "badge", "leaderboard", "donut", "photowords",
    "titlecard", "departures", "loading", "countdown", "dragdrop", "lineup", "isomap", "stickers",
    "promptline", "crowd", "photohero", "menu", "pricing", "pins", "result", "calendar", "mapdots", "marker",
    "lowerthird", "cardwords", "bars", "table", "dayplan", "stutter"]);
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
    // رسمة واحدة على الأقل دايمًا قبل التصوير (حتى من غير صور): من غيرها السيرفر ساعات بيصوّر الفريم القديم
    // فترانزيشن زي المسحة كان بيفضل لازق ثانية في الفيديو النهائي
    return Promise.all(imgs.map(one)).then(frame);
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
        html += `<div data-free style="position:absolute;left:${x0.toFixed(1)}px;top:${y0.toFixed(1)}px;transform:translate(-50%,-50%) rotate(${(aa + Math.PI / 2).toFixed(4)}rad) scale(${e.toFixed(3)});
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
    return backdrop(this, th) + `<div data-free style="position:absolute;inset:0;perspective:${D.toFixed(0)}px;perspective-origin:50% 45%;overflow:hidden"><div style="position:absolute;inset:0;transform-style:preserve-3d">${world}</div></div>`;
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
        <div data-free dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)});font:800 ${(mn * 1.05).toFixed(0)}px ${ff};line-height:.8;white-space:nowrap;color:${PINKD};mix-blend-mode:normal;
        -webkit-text-stroke:${(mn * 0.01).toFixed(1)}px #111">${esc(g)}</div>
        <div data-free dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(w * 0.25).toFixed(0)}px;top:50%;transform:translate(-50%,-50%) rotate(-90deg);font:600 ${(mn * 0.14).toFixed(0)}px ${ff};color:#fff;opacity:${seg(t, b.t0 + dur * 0.15, b.t0 + dur * 0.25).toFixed(3)};white-space:nowrap;letter-spacing:-0.02em">${esc(ar ? s : s.toLowerCase())}</div>`;
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
        html += `<div data-free dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${xx.toFixed(1)}px;top:50%;transform:translateY(-50%) perspective(${(mn * 2).toFixed(0)}px) rotateY(${lerp(-35, 10, kk).toFixed(1)}deg) rotateZ(${lerp(14, -6, kk).toFixed(1)}deg);
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
      html += `<div data-free style="position:absolute;inset:0;perspective:${(mn * 1.6).toFixed(0)}px;opacity:${kk.toFixed(3)}"><div style="position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(-16deg)">${r}</div></div>`;
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
      html += `<div data-free style="position:absolute;left:${(-w * 0.3).toFixed(0)}px;width:${(w * 1.6).toFixed(0)}px;top:${y.toFixed(0)}px;transform:translateY(-50%) rotate(${rot}deg) scaleX(${e.toFixed(3)});background:${bg};overflow:hidden;height:${(sz * 1.35).toFixed(0)}px">
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

  // ---------- emerge: الكلام بيطلع من ورا راس الشخص
  // كل كلمة بتبدأ مستخبية ورا الراس (الشخص قدامها)، وبعدين بتتزحلق برّه لناحية وتكبر، ناحية شمال وناحية يمين بالتبادل
  P.k_emerge = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const bs = this.blockSolid(b);
    const hd = (bs && this.blockHead(b)) || { x: w / 2, y: h * 0.38, r: mn * 0.13, top: h * 0.25 };
    const ink = inkOf(this, th);
    let html = "";
    // الناحية اللي فيها مكان: لو ناحية ضيقة (الراس قريبة من الحرف) الكلام كله بيطلع للناحية التانية تحت بعض
    const roomL = hd.x - hd.r * 1.2 - mn * 0.04, roomR = w - (hd.x + hd.r * 1.2) - mn * 0.04;
    const both = Math.min(roomL, roomR) > w * 0.25;
    const only = roomR >= roomL ? 1 : -1;
    it.forEach((x, i) => {
      if (t < x.t0) return;
      const s = this.text(x.w);
      const ff = famOf(s);
      const side = both ? (i % 2 ? 1 : -1) : only;
      const room = side < 0 ? roomL : roomR;
      const sz = fitSize(s, `800 {}px ${ff}`, Math.max(room, w * 0.25), mn * 0.11 * this.ts);
      const tw = measure(s, `800 ${sz}px ${ff}`);
      const row = both ? Math.floor(i / 2) : i;
      const ex = hd.x + side * (hd.r * 1.2 + tw / 2), ey = hd.y - hd.r * 0.9 + row * sz * 1.15;
      const e = eOut(seg(t, x.t0, x.t0 + 0.5));
      const px = lerp(hd.x, ex, e), py = lerp(hd.y - hd.r * 0.3, ey, e);
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;transform:translate(-50%,-50%) scale(${lerp(0.55, 1, e).toFixed(3)}) rotate(${(side * (1 - e) * -10).toFixed(1)}deg);
        font:800 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.03em;white-space:nowrap;color:${i === b.focus ? th.accent || RED : ink};${shadow(this)}">${esc(s)}</div>`;
    });
    return backdrop(this, th) + (bs ? this.behindPerson(t, html) : html);
  };

  // =====================================================================
  // الدفعة 7 (34 فيديو مرجعي جديد):
  //   film      برواز فيلم (أركان وعلامات وباركود) والكلام بيدخل بموشن بلير
  //   ghost     الكلمة المهمة عملاقة باهتة ومغبّشة ورا، والكلام واضح صغير فوقها
  //   notify    إشعارات موبايل بتنزل فوق بعض
  //   dialog    رسالة نظام قديمة (ويندوز) والماوس بيدوس «تمام»
  //   pills     زراير لامعة بتطلع والماوس بيدوس عليها
  //   steps     كروت مرقّمة 01 و02 و03
  //   scribble  دايرة حمرا بالقلم حوالين الكلمة المهمة وكلام آلة كاتبة تحتها
  //   list      لستة: الجديد ملوّن بسهم وشريط، واللي قبله رمادي
  //   prompt    مربع كتابة بتاع ذكاء اصطناعي والكلام بيتكتب فيه وزرار الإرسال
  //   spread    الكلام متفرّق كلمة كلمة في أماكن مختلفة من الكادر
  // =====================================================================
  const SERIF = (s) => (AR.test(s) ? "'TY Ruqaa', 'SM Tajawal'" : "'TY SerifI', serif");
  const PIXEL = (s) => (AR.test(s) ? "'TY PlexAr', 'SM Tajawal'" : "'TY Pixel', monospace");
  const TYPEW = (s) => (AR.test(s) ? "'SM Kufi', 'SM Tajawal'" : "'TY Type', monospace");
  const isAr = (it) => it.some((x) => AR.test(x.w));
  const focusOf = (b, it) => (b.focus >= 0 && b.focus < it.length ? b.focus : it.reduce((a, x, i) => (x.w.length > it[a].w.length ? i : a), 0));
  // سطور بالعرض: كل سطر div لوحده (عشان fitFrame يقدر يدخّله في الكادر)
  P.wrapItems = function (it, font, maxW) {
    const lines = [[]];
    let cur = 0;
    const sp = measure(" ", font);
    it.forEach((x) => {
      const ww = measure(this.text(x.w), font);
      if (lines[lines.length - 1].length && cur + sp + ww > maxW) { lines.push([]); cur = 0; }
      cur += (lines[lines.length - 1].length ? sp : 0) + ww;
      lines[lines.length - 1].push(x);
    });
    return lines.filter((l) => l.length);
  };
  const cursorSvg = (x, y, sz, hand = false) => `<svg data-free width="${sz.toFixed(0)}" height="${(sz * 1.4).toFixed(0)}" viewBox="0 0 20 28" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">${hand
    ? `<path d="M7 1.5c1.2 0 2 .9 2 2V11l1-.2c1-.2 2 .4 2.2 1.3l.2.6.5-.1c1-.2 2 .4 2.2 1.4l.1.4.4-.1c1.1-.2 2.1.5 2.2 1.6l.6 5.2c.2 2.5-1 4.9-3.2 6H9.4c-1.4-.8-2.6-2-3.3-3.5L2.7 17c-.5-1 0-2.2 1-2.6.8-.3 1.7 0 2.2.7L5 16V3.5c0-1.1.9-2 2-2z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/>`
    : `<path d="M2 1.5v22l5.6-5.4 3.6 8.2 3.3-1.5-3.6-8h7.6z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>`}</svg>`;

  // ---------- film: برواز فيلم والكلام بيدخل بموشن بلير
  P.k_film = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const vid = onVideo(this), ink = vid ? "#fff" : "#141414", line = vid ? "rgba(255,255,255,.7)" : "rgba(20,20,20,.65)", acc = "#3BD24A";
    const it = this.items(b);
    const kk = eOut(seg(t, b.t0, b.t0 + 0.35));
    const m = mn * 0.06, fs = mn * 0.022, lw = Math.max(1, mn * 0.0025);
    const bx = m, by = h * 0.09, bw = w - m * 2, bh = h * 0.82;
    let html = vid ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.18)"></div>` : `<div style="position:absolute;inset:0;background:#F1F0EC"></div>`;
    html += `<div style="position:absolute;left:${bx.toFixed(0)}px;top:${by.toFixed(0)}px;width:${bw.toFixed(0)}px;height:${bh.toFixed(0)}px;border:${lw.toFixed(1)}px solid ${line};opacity:${kk.toFixed(3)};transform:scale(${lerp(1.05, 1, kk).toFixed(4)})">
      ${[[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy]) => `<i style="position:absolute;${cx ? "right" : "left"}:${(-lw * 4).toFixed(0)}px;${cy ? "bottom" : "top"}:${(-lw * 4).toFixed(0)}px;width:${(mn * 0.06).toFixed(0)}px;height:${(mn * 0.06).toFixed(0)}px;
        border-${cx ? "right" : "left"}:${(lw * 3).toFixed(1)}px solid ${ink};border-${cy ? "bottom" : "top"}:${(lw * 3).toFixed(1)}px solid ${ink}"></i>`).join("")}</div>`;
    const lab = (s, css) => `<div dir="ltr" style="position:absolute;${css};font:400 ${fs.toFixed(1)}px 'TY Pixel', monospace;letter-spacing:.12em;color:${ink};opacity:${(0.8 * kk).toFixed(2)};white-space:nowrap">${s}</div>`;
    const fr = 10 + (bi % 26);
    html += lab(`FILM 400 &nbsp;·&nbsp; ${fr}`, `left:${bx.toFixed(0)}px;top:${(by - fs * 1.6).toFixed(0)}px`) + lab(`${fr}A ▶`, `right:${bx.toFixed(0)}px;top:${(by - fs * 1.6).toFixed(0)}px`)
      + lab(`▶ ${fr + 1} &nbsp; ${fr + 1}A`, `left:${bx.toFixed(0)}px;top:${(by + bh + fs * 0.5).toFixed(0)}px`)
      + `<div style="position:absolute;left:50%;top:${(by + bh - mn * 0.11).toFixed(0)}px;width:${(mn * 0.24).toFixed(0)}px;height:${(mn * 0.05).toFixed(0)}px;transform:translateX(-50%);opacity:${(0.85 * kk).toFixed(2)};
        background:repeating-linear-gradient(90deg,${ink} 0 ${(lw * 1.2).toFixed(1)}px,transparent 0 ${(lw * 2.4).toFixed(1)}px,${ink} 0 ${(lw * 4.2).toFixed(1)}px,transparent 0 ${(lw * 5.6).toFixed(1)}px)"></div>`;
    // الكلام: سطور، كل كلمة بتدخل من اليمين متغبّشة وبتقف
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : -1;
    const sz = mn * 0.11 * this.ts;
    const lines = this.wrapItems(it, `800 ${sz}px ${ff}`, w * 0.74);
    const lsz = Math.min(sz, (bh * 0.6) / Math.max(1, lines.length) / 1.05);
    const cy = this.blockSolid(b) ? Math.min(by + bh * 0.8, this.belowHead(b, lsz) + lsz * (lines.length - 1) * 0.5) : h * 0.5;
    const y0 = cy - (lines.length - 1) * lsz * 0.525;
    lines.forEach((ln, li) => {
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${(y0 + li * lsz * 1.05).toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:800 ${lsz.toFixed(1)}px ${ff};letter-spacing:-0.04em;line-height:1">${ln.map((x) => {
        const e = eOut(seg(t, x.t0, x.t0 + 0.22));
        const hot = it.indexOf(x) === fi;
        return `<span style="display:inline-block;opacity:${(t >= x.t0 ? clamp(e * 2) : 0).toFixed(3)};transform:translateX(${((1 - e) * mn * 0.22 * (ar ? -1 : 1)).toFixed(1)}px) scaleX(${(1 + (1 - e) * 0.5).toFixed(3)});
          filter:blur(${((1 - e) * lsz * 0.08).toFixed(1)}px);color:${hot ? acc : ink};${hot && !vid ? "text-shadow:0 0 " + (lsz * 0.15).toFixed(0) + "px rgba(59,210,74,.45);" : ""}${vid ? "text-shadow:0 4px 22px rgba(0,0,0,.35)" : ""}">${esc(this.text(x.w))}</span>`;
      }).join(" ")}</div>`;
    });
    return html;
  };

  // ---------- ghost: الكلمة المهمة عملاقة باهتة ورا، والكلام واضح فوقها
  P.k_ghost = function (b, t, k, th) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const vid = onVideo(this), ink = inkOf(this, th);
    const fi = focusOf(b, it), main = it[fi];
    const g = this.text(main.w), gf = famOf(g);
    const gz = fitSize(g, `800 {}px ${gf}`, w * 1.3, mn * 0.5);
    const cy = this.blockSolid(b) ? this.belowHead(b, mn * 0.1) : h * 0.48;
    const ge = eOut(seg(t, main.t0 - 0.1, main.t0 + 0.7));
    let html = backdrop(this, th);
    if (t >= main.t0 - 0.1)
      html += `<div data-free dir="${this.dir(g)}" style="position:absolute;left:50%;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%) translateX(${(-(t - main.t0) * mn * 0.015).toFixed(1)}px) scale(${lerp(1.18, 1, ge).toFixed(4)});
        font:800 ${gz.toFixed(1)}px ${gf};letter-spacing:-0.05em;white-space:nowrap;color:${ink};opacity:${(ge * (vid ? 0.32 : 0.2)).toFixed(3)};filter:blur(${lerp(gz * 0.06, gz * 0.012, ge).toFixed(1)}px)">${esc(g)}</div>`;
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.075 * this.ts;
    const lines = this.wrapItems(it, `600 ${sz}px ${ff}`, w * 0.8);
    const y0 = cy - (lines.length - 1) * sz * 0.6;
    lines.forEach((ln, li) => {
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${(y0 + li * sz * 1.2).toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:600 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.02em;color:${ink};${shadow(this)}">${ln.map((x) => {
        const e = eOut(seg(t, x.t0, x.t0 + 0.3));
        return `<span style="display:inline-block;opacity:${e.toFixed(3)};filter:blur(${((1 - e) * sz * 0.2).toFixed(1)}px);font-weight:${x === main ? 800 : 600}">${esc(this.text(x.w))}</span>`;
      }).join(" ")}</div>`;
    });
    return html;
  };

  // ---------- notify: إشعارات موبايل بتنزل فوق بعض
  const NCOL = [["#34C759", "#1E9E3E"], ["#FF5FA2", "#C2185B"], ["#3D8BFF", "#1F5FD0"], ["#FFB23E", "#EE7A12"]];
  P.k_notify = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 3))));
    const r = this.freeRect(b);
    const sz = mn * 0.034 * this.ts;
    const cw = Math.min(r.w, w * 0.86), x = r.x + (r.w - cw) / 2;
    const ch = sz * 3.7, gap = sz * 0.55;
    const top = r.side === "below" ? r.y : r.side === "center" ? h * 0.22 : r.y;
    const shown = cs.filter((c) => t >= c.t0).reverse();
    const ar = isAr(it);
    const lastE = shown.length ? eBack(seg(t, shown[0].t0, shown[0].t0 + 0.35)) : 1;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#20243A,#5A4B7A 55%,#C77B8A)"></div>`;
    const maxN = Math.max(1, Math.floor((Math.min(r.h, h * 0.6) + gap) / (ch + gap)));
    shown.slice(0, maxN + 1).forEach((c, i) => {
      const idx = cs.indexOf(c);
      const y = i === 0 ? lerp(top - ch * 1.2, top, lastE) : top + lerp(i - 1, i, lastE) * (ch + gap);
      const fade = i >= maxN ? 1 - lastE : 1;
      const [c0, c1] = NCOL[(idx + bi) % NCOL.length];
      const s = this.text(c.w);
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;height:${ch.toFixed(1)}px;box-sizing:border-box;opacity:${(i === 0 ? clamp(lastE * 2) : fade).toFixed(3)};
        background:rgba(246,246,248,.9);border-radius:${(sz * 1.1).toFixed(1)}px;box-shadow:0 ${(sz * 0.3).toFixed(1)}px ${(sz * 1.2).toFixed(1)}px rgba(0,0,0,.22);display:flex;align-items:center;gap:${(sz * 0.6).toFixed(1)}px;padding:0 ${(sz * 0.7).toFixed(1)}px">
        <div style="flex:none;width:${(sz * 2.2).toFixed(1)}px;height:${(sz * 2.2).toFixed(1)}px;border-radius:${(sz * 0.55).toFixed(1)}px;background:linear-gradient(160deg,${c0},${c1});display:flex;align-items:center;justify-content:center">
          <svg width="${(sz * 1.2).toFixed(0)}" height="${(sz * 1.2).toFixed(0)}" viewBox="0 0 24 24"><path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z" fill="#fff"/></svg></div>
        <div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;font:400 ${(sz * 0.62).toFixed(1)}px ${famOf(ar ? "ع" : "a")};color:#8a8a90"><span>${ar ? "رسالة" : "Message"}</span><span>${ar ? "دلوقتي" : "now"}</span></div>
          <div style="font:700 ${sz.toFixed(1)}px ${famOf(s)};color:#111;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(s)}</div></div></div>`;
    });
    return html;
  };

  // ---------- dialog: رسالة نظام قديمة والماوس بيدوس «تمام»
  P.k_dialog = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const ar = isAr(it);
    const fs = mn * 0.042 * this.ts;
    const dw = Math.min(w * 0.86, fs * 17);
    const p = eBack(seg(t, b.t0, b.t0 + 0.22));
    const msg = it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    const cy = this.blockSolid(b) ? Math.min(h * 0.72, this.belowHead(b, fs * 5)) : h * 0.5;
    const bev = (inset) => `border:${(fs * 0.08).toFixed(1)}px solid;border-color:${inset ? "#404040 #fff #fff #404040" : "#fff #404040 #404040 #fff"}`;
    // الماوس بيروح على «تمام» في آخر البلوك وبيدوس
    const tc = seg(t, b.t1 - 0.7, b.t1 - 0.25), press = t > b.t1 - 0.25 && t < b.t1 - 0.05;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#2F8A88"></div>`;
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${((w - dw) / 2).toFixed(1)}px;top:${cy.toFixed(1)}px;width:${dw.toFixed(1)}px;transform:translateY(-50%) scale(${p.toFixed(3)});background:#C3C3C3;${bev(false)};box-shadow:${(fs * 0.25).toFixed(0)}px ${(fs * 0.25).toFixed(0)}px 0 rgba(0,0,0,.35)">
      <div style="display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,#0A246A,#3A6EA5);color:#fff;font:700 ${(fs * 0.7).toFixed(1)}px ${famOf(ar ? "ع" : "a")};padding:${(fs * 0.2).toFixed(1)}px ${(fs * 0.3).toFixed(1)}px">
        <span>${ar ? "رسالة من النظام" : "System message"}</span><span style="width:${(fs * 0.9).toFixed(0)}px;height:${(fs * 0.8).toFixed(0)}px;background:#C3C3C3;color:#111;${bev(false)};display:flex;align-items:center;justify-content:center;font-size:${(fs * 0.6).toFixed(0)}px">✕</span></div>
      <div style="display:flex;gap:${(fs * 0.6).toFixed(1)}px;align-items:flex-start;padding:${(fs * 0.7).toFixed(1)}px ${(fs * 0.7).toFixed(1)}px ${(fs * 0.4).toFixed(1)}px">
        <svg width="${(fs * 1.6).toFixed(0)}" height="${(fs * 1.6).toFixed(0)}" viewBox="0 0 24 24" style="flex:none"><path d="M12 2.5 23 21.5H1z" fill="#FFD21F" stroke="#111" stroke-width="1"/><rect x="11" y="9" width="2" height="7" fill="#111"/><rect x="11" y="17.5" width="2" height="2" fill="#111"/></svg>
        <div style="flex:1;font:400 ${(ar ? fs * 0.85 : fs * 1.15).toFixed(1)}px ${PIXEL(ar ? "ع" : "a")};color:#111;line-height:1.15;min-height:${(fs * 2.4).toFixed(0)}px">${esc(msg)}<span style="opacity:${(Math.floor(t * 2.5) % 2).toFixed(0)}">_</span></div></div>
      <div style="display:flex;justify-content:center;gap:${(fs * 0.6).toFixed(1)}px;padding:0 0 ${(fs * 0.6).toFixed(1)}px">${[ar ? "تمام" : "OK", ar ? "إلغاء" : "Cancel"].map((s, i) =>
        `<span style="min-width:${(fs * 3.4).toFixed(0)}px;text-align:center;${bev(i === 0 && press)};background:#C3C3C3;font:400 ${(fs * 0.75).toFixed(1)}px ${famOf(s)};padding:${(fs * 0.12).toFixed(1)}px 0;color:#111;${i === 0 ? `outline:1px dotted #111;outline-offset:-${(fs * 0.22).toFixed(0)}px` : ""}">${s}</span>`).join("")}</div></div>`;
    if (tc > 0) {
      const tx = ar ? w / 2 + fs * 2.2 : w / 2 - fs * 1.6, ty = cy + fs * 1.9;
      html += cursorSvg(lerp(w * 0.85, tx, eOut(tc)), lerp(h * 0.85, ty, eOut(tc)), fs * 1.1);
    }
    return html;
  };

  // ---------- pills: زراير لامعة بتطلع والماوس بيدوس عليها
  const PCOL = [["#6BF27A", "#16A82E", "rgba(22,168,46,.5)"], ["#6AAEFF", "#1E5FE0", "rgba(30,95,224,.5)"], ["#FFBE6A", "#F0641E", "rgba(240,100,30,.5)"]];
  P.k_pills = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 2))));
    const r = this.freeRect(b);
    const [c0, c1, gl] = PCOL[bi % PCOL.length];
    const sz = mn * 0.05 * this.ts;
    const step = sz * 2.7;
    const shown = cs.filter((c) => t >= c.t0);
    const fit = Math.max(1, Math.floor(r.h / step));
    const vis = shown.slice(-fit);
    const y0 = r.y + Math.max(0, (r.h - vis.length * step) / 2) + step / 2;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#173A1E,#07120A 75%)"></div>`;
    let last = null;
    vis.forEach((c, i) => {
      const s = this.text(c.w), ff = famOf(s);
      const z = fitSize(s, `700 {}px ${ff}`, r.w - sz * 2.4, sz);
      const cx = r.x + r.w / 2 + (i % 2 ? 1 : -1) * Math.min(r.w * 0.1, sz * 2);
      const y = y0 + i * step;
      const p = eBack(seg(t, c.t0, c.t0 + 0.25));
      const isLast = c === shown[shown.length - 1];
      const click = isLast && t > c.t0 + 0.35 && t < c.t0 + 0.5;
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${cx.toFixed(1)}px;top:${y.toFixed(1)}px;transform:translate(-50%,-50%) scale(${(p * (click ? 0.93 : 1)).toFixed(3)});white-space:nowrap;
        font:700 ${z.toFixed(1)}px ${ff};color:#fff;padding:${(sz * 0.5).toFixed(1)}px ${(sz * 1.1).toFixed(1)}px;border-radius:${(sz * 2).toFixed(0)}px;background:linear-gradient(180deg,${c0},${c1});
        box-shadow:inset 0 ${(sz * 0.12).toFixed(1)}px 0 rgba(255,255,255,.5),inset 0 -${(sz * 0.1).toFixed(1)}px 0 rgba(0,0,0,.15),0 ${(sz * 0.25).toFixed(1)}px ${(sz * (isLast ? 1.2 : 0.6)).toFixed(1)}px ${gl};text-shadow:0 1px 2px rgba(0,0,0,.2)">${esc(s)}</div>`;
      if (isLast) last = { x: cx, y, w: measure(s, `700 ${z}px ${ff}`) + sz * 2.2, t0: c.t0 };
    });
    if (last) {
      const e = eOut(seg(t, last.t0 + 0.05, last.t0 + 0.35));
      const tx = last.x + last.w * 0.25, ty = last.y + sz * 0.1;
      html += cursorSvg(lerp(tx + sz * 3, tx, e), lerp(ty + sz * 3, ty, e), sz * 1.2, true);
    }
    return html;
  };

  // ---------- steps: كروت مرقّمة
  P.k_steps = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(3, Math.max(1, Math.ceil(it.length / 2))));
    const r = this.freeRect(b);
    const ar = isAr(it);
    const sz = mn * 0.042 * this.ts;
    const cw = Math.min(r.w, w * 0.8), ch = sz * 2.9, gap = sz * 0.7;
    const total = cs.length * ch + (cs.length - 1) * gap;
    const y0 = r.y + Math.max(0, (r.h - total) / 2);
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#FAFAFA 60%,#E3F7E6)"></div>`;
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const e = eOut(seg(t, c.t0, c.t0 + 0.32));
      // الكروت مدرّجة شوية (زي السلم)، كل واحد مزحوق عن اللي قبله
      const off = i * Math.max(0, Math.min(sz * 1.2, (r.w - cw * 0.9) / 3));
      const x = r.x + (ar ? r.w - cw * 0.9 - off : off);
      const s = this.text(c.w);
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${clamp(x, mn * 0.03, w - cw - mn * 0.03).toFixed(1)}px;top:${(y0 + i * (ch + gap)).toFixed(1)}px;width:${(cw * 0.9).toFixed(1)}px;height:${ch.toFixed(1)}px;box-sizing:border-box;
        transform:translateX(${((1 - e) * (ar ? 1 : -1) * w * 0.25).toFixed(1)}px);opacity:${e.toFixed(3)};display:flex;align-items:center;gap:${(sz * 0.6).toFixed(1)}px;padding:0 ${(sz * 0.8).toFixed(1)}px;
        background:linear-gradient(180deg,rgba(250,250,250,.96),rgba(230,230,232,.96));border:1px solid rgba(0,0,0,.08);border-radius:${(sz * 0.7).toFixed(1)}px;box-shadow:0 ${(sz * 0.25).toFixed(1)}px ${(sz * 0.8).toFixed(1)}px rgba(0,0,0,.14)">
        <span dir="ltr" style="flex:none;font:800 ${(sz * 1.9).toFixed(1)}px 'TY Outfit';letter-spacing:-0.08em;color:transparent;-webkit-text-stroke:${(sz * 0.07).toFixed(1)}px #222">${String(i + 1).padStart(2, "0")}</span>
        <span style="font:600 ${sz.toFixed(1)}px ${famOf(s)};color:#2a2a2e;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(s)}</span></div>`;
    });
    return html;
  };

  // ---------- scribble: دايرة حمرا بالقلم حوالين الكلمة المهمة، وكلام آلة كاتبة تحتها
  P.k_scribble = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const vid = onVideo(this), ink = vid ? "#fff" : "#1A1A1A", red = "#E0261F";
    const fi = focusOf(b, it), main = it[fi];
    const s = AR.test(main.w) ? main.w : this.text(main.w).toUpperCase();
    const ff = famOf(s);
    const sz = fitSize(s, `800 {}px ${ff}`, w * 0.66, mn * 0.16);
    const tw = measure(s, `800 ${sz}px ${ff}`);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.44;
    let html = vid ? "" : `<div style="position:absolute;inset:0;background:#EEECE6"></div><div style="position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px) 0 0/${(mn / 14).toFixed(0)}px ${(mn / 14).toFixed(0)}px,linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px) 0 0/${(mn / 14).toFixed(0)}px ${(mn / 14).toFixed(0)}px"></div>`;
    if (t >= main.t0) {
      const e = eBack(seg(t, main.t0, main.t0 + 0.2));
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${cy.toFixed(1)}px;transform:translateY(-50%) scale(${e.toFixed(3)});text-align:center;white-space:nowrap;font:800 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.03em;color:${ink};${shadow(this)}">${esc(s)}</div>`;
      // الدايرة: لفة ونص متعرجة بتترسم
      const rx = tw / 2 + sz * 0.45, ry = sz * 0.78, rr = rng(bi * 13 + 5);
      const pts = [];
      const N = 64;
      for (let q = 0; q <= N; q++) {
        const a = -Math.PI * 0.6 + (q / N) * Math.PI * 2.15, j = 1 + (rr() - 0.5) * 0.03 + (q / N) * 0.06;
        pts.push([w / 2 + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j - sz * 0.05]);
      }
      let L = 0;
      for (let q = 1; q < pts.length; q++) L += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]);
      const d = seg(t, main.t0 + 0.15, main.t0 + 0.6);
      html += `<svg data-free width="${w}" height="${h}" style="position:absolute;inset:0;overflow:visible"><polyline points="${pts.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="${red}" stroke-width="${(mn * 0.009).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"
        stroke-dasharray="${L.toFixed(0)}" stroke-dashoffset="${(L * (1 - d)).toFixed(1)}"/></svg>`;
    }
    const rest = it.filter((x, i) => i !== fi && i > fi);
    const before = it.filter((x, i) => i < fi);
    const line = (arr, y) => {
      if (!arr.length || t < arr[0].t0) return "";
      const txt = arr.map((x) => this.text(x.w)).join(" ");
      const tf = TYPEW(txt), z = fitSize(txt, `400 {}px ${tf}`, w * 0.8, mn * 0.055 * this.ts);
      const shown = arr.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
      const u = seg(t, arr[arr.length - 1].t0 + 0.2, arr[arr.length - 1].t0 + 0.5), uw = measure(txt, `400 ${z}px ${tf}`);
      return `<div dir="${this.dir(txt)}" style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:400 ${z.toFixed(1)}px ${tf};color:${ink};${shadow(this)}">${esc(shown)}</div>
        <i style="position:absolute;left:${((w - uw) / 2).toFixed(1)}px;top:${(y + z * 0.65).toFixed(1)}px;width:${(uw * u).toFixed(1)}px;height:${(mn * 0.006).toFixed(1)}px;background:${red};border-radius:3px;transform:rotate(-1deg)"></i>`;
    };
    html += line(before, cy - sz * 1.25) + line(rest, cy + sz * 1.25);
    return html;
  };

  // ---------- list: لستة، الجديد ملوّن بسهم وشريط واللي قبله رمادي
  P.k_list = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(5, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it);
    const r = this.freeRect(b);
    const vid = onVideo(this);
    const acc = ["#7B4DFF", "#2F7CF6", "#E0261F"][bi % 3];
    const dim = vid ? "rgba(255,255,255,.5)" : "#B4B4BC";
    const sz = mn * 0.06 * this.ts, rowH = sz * 1.35;
    const shown = cs.filter((c) => t >= c.t0);
    const ai = shown.length - 1;
    const e = ai >= 0 ? eOut(seg(t, shown[ai].t0, shown[ai].t0 + 0.3)) : 0;
    const cyR = r.y + r.h / 2;
    const scroll = (Math.max(0, ai - 1) + e * (ai > 0 ? 1 : 0)) * rowH;
    const x0 = ar ? r.x + r.w - sz * 1.6 : r.x + sz * 1.6;
    let html = vid ? "" : `<div style="position:absolute;inset:0;background:#FAFAFA"></div>`;
    shown.forEach((c, i) => {
      const s = this.text(c.w), ff = famOf(s);
      const active = i === ai;
      const z = fitSize(s, `500 {}px ${ff}`, r.w - sz * 2.2, sz);
      const y = cyR + i * rowH - scroll;
      const a = active ? e : 1;
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${ar ? "right" : "left"}:${(ar ? w - x0 : x0).toFixed(1)}px;top:${y.toFixed(1)}px;transform:translateY(-50%) translateX(${((1 - a) * sz * (ar ? -1 : 1)).toFixed(1)}px);white-space:nowrap;
        font:500 ${z.toFixed(1)}px ${ff};letter-spacing:-0.02em;color:${active ? acc : dim};opacity:${clamp(a * 1.5).toFixed(3)};${vid && active ? "text-shadow:0 2px 14px rgba(0,0,0,.35)" : ""}">${esc(s)}</div>`;
      if (active) {
        const tw = measure(s, `500 ${z}px ${ff}`);
        const bx = ar ? x0 - tw - sz * 0.4 : x0 + tw + sz * 0.4;
        const bw = Math.min(mn * 0.22, Math.max(0, (ar ? bx - mn * 0.02 : w - mn * 0.02 - bx))) * e;
        html += `<svg width="${(sz * 1.1).toFixed(0)}" height="${(sz * 0.9).toFixed(0)}" viewBox="0 0 24 20" style="position:absolute;${ar ? "right" : "left"}:${((ar ? w - x0 : x0) - sz * 1.4).toFixed(1)}px;top:${(y - sz * 0.45).toFixed(1)}px;${ar ? "transform:scaleX(-1)" : ""}"><path d="M1 10h20M13 2l8 8-8 8" fill="none" stroke="${acc}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <i data-free style="position:absolute;${ar ? "right" : "left"}:${(ar ? w - bx : bx).toFixed(1)}px;top:${(y - sz * 0.22).toFixed(1)}px;width:${bw.toFixed(1)}px;height:${(sz * 0.44).toFixed(1)}px;background:linear-gradient(${ar ? 270 : 90}deg,${acc},${acc}00)"></i>`;
      }
    });
    return html;
  };

  // ---------- prompt: مربع كتابة بتاع ذكاء اصطناعي
  const GLOW = ["#C6F432", "#3D8BFF", "#B57BFF"];
  P.k_prompt = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const ar = isAr(it);
    const acc = GLOW[bi % GLOW.length];
    const sz = mn * 0.042 * this.ts;
    const bw = Math.min(w * 0.86, sz * 19);
    const txt = it.filter((x) => t >= x.t0).map((x, i, a) => (i === a.length - 1 ? typed(this.text(x.w), t, x.t0, 30) : this.text(x.w))).join(" ");
    const done = it.length && t > it[it.length - 1].t0 + 0.4;
    const p = eOut(seg(t, b.t0, b.t0 + 0.28));
    const cy = this.blockSolid(b) ? Math.min(h * 0.8, this.belowHead(b, sz * 4)) : h * 0.5;
    const pulse = done ? 1 + 0.08 * Math.sin((t - it[it.length - 1].t0) * 9) : 1;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#1d1f24,#060607 70%)"></div>`;
    // عنوان فوق المربع (زي «What will you build next?») في نص المرات
    if (bi % 2 === 1) {
      const q = ar ? "هتعمل إيه النهارده؟" : "What will you build next?", hz = sz * 1.5;
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${(cy - sz * 6.2).toFixed(1)}px;text-align:center;white-space:nowrap;font:600 ${hz.toFixed(1)}px ${famOf(q)};letter-spacing:-0.03em;color:${onVideo(this) ? "#fff" : "#F2F2F2"};opacity:${p.toFixed(3)};${shadow(this)}">${q}</div>`;
    }
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${((w - bw) / 2).toFixed(1)}px;top:${cy.toFixed(1)}px;width:${bw.toFixed(1)}px;box-sizing:border-box;transform:translateY(calc(-50% + ${((1 - p) * sz * 2).toFixed(1)}px));opacity:${p.toFixed(3)};
      background:rgba(24,24,27,.9);border:${Math.max(1, sz * 0.05).toFixed(1)}px solid ${acc}88;border-radius:${(sz * 1.1).toFixed(1)}px;padding:${(sz * 0.8).toFixed(1)}px ${(sz * 0.9).toFixed(1)}px ${(sz * 0.6).toFixed(1)}px;
      box-shadow:0 0 ${(sz * 1.6).toFixed(0)}px ${acc}55,inset 0 0 ${(sz * 0.8).toFixed(0)}px ${acc}22">
      <div style="font:500 ${sz.toFixed(1)}px ${famOf(ar ? "ع" : "a")};color:#EDEDED;line-height:1.35;min-height:${(sz * 2.7).toFixed(0)}px">${txt ? esc(txt) : `<span style="color:#77777d">${ar ? "اكتب أي حاجة…" : "Ask anything…"}</span>`}<span style="display:inline-block;width:${(sz * 0.08).toFixed(1)}px;height:${(sz * 1.05).toFixed(1)}px;background:${acc};vertical-align:-0.15em;margin:0 ${(sz * 0.08).toFixed(1)}px;opacity:${done ? 0 : Math.floor(t * 3) % 2}"></span></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:${(sz * 0.5).toFixed(1)}px">
        <span style="width:${(sz * 1.5).toFixed(0)}px;height:${(sz * 1.5).toFixed(0)}px;border-radius:50%;border:1px solid #444;color:#aaa;display:flex;align-items:center;justify-content:center;font:400 ${sz.toFixed(0)}px 'TY Outfit'">+</span>
        <span style="width:${(sz * 1.7).toFixed(0)}px;height:${(sz * 1.7).toFixed(0)}px;border-radius:50%;background:${acc};display:flex;align-items:center;justify-content:center;transform:scale(${pulse.toFixed(3)})">
          <svg width="${(sz * 0.9).toFixed(0)}" height="${(sz * 0.9).toFixed(0)}" viewBox="0 0 24 24"><path d="M12 20V5M5 11l7-7 7 7" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div></div>`;
    return html;
  };

  // ---------- spread: الكلام متفرّق كلمة كلمة في أماكن مختلفة
  P.k_spread = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const r = this.freeRect(b);
    const ink = inkOf(this, th);
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : -1;
    const cols = r.w > w * 0.6 ? 3 : 2, rows = Math.max(2, Math.ceil(it.length / cols));
    const cw = r.w / cols, chh = r.h / rows;
    const rr = rng(bi * 31 + 7);
    // كل كلمة في خانة عشوائية (من غير ما خانتين يتكرروا)
    const cells = Array.from({ length: cols * rows }, (_, q) => q);
    for (let q = cells.length - 1; q > 0; q--) { const j = Math.floor(rr() * (q + 1)); [cells[q], cells[j]] = [cells[j], cells[q]]; }
    let html = backdrop(this, th);
    it.forEach((x, i) => {
      const c = cells[i % cells.length];
      const jx = (rr() - 0.5) * cw * 0.35, jy = (rr() - 0.5) * chh * 0.35;
      if (t < x.t0) return;
      const s = this.text(x.w), ff = famOf(s), hot = i === fi;
      const z = fitSize(s, `${hot ? 800 : 500} {}px ${ff}`, cw * 0.95, mn * (hot ? 0.1 : 0.062) * this.ts);
      const e = eOut(seg(t, x.t0, x.t0 + 0.3));
      const cx = r.x + (c % cols + 0.5) * cw + jx, cy = r.y + (Math.floor(c / cols) + 0.5) * chh + jy;
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%) translateY(${((1 - e) * z * 0.6).toFixed(1)}px);opacity:${e.toFixed(3)};filter:blur(${((1 - e) * z * 0.15).toFixed(1)}px);
        white-space:nowrap;font:${hot ? 800 : 500} ${z.toFixed(1)}px ${ff};letter-spacing:-0.02em;color:${hot ? th.accent || RED : ink};${shadow(this)}">${esc(s)}</div>`;
    });
    return html;
  };

  // =====================================================================
  // الدفعة 8 (باقي الـ34 فيديو):
  //   serif    كلام عريض وكلمة مهمة بخط سيريف مايل ملوّن جنبه
  //   chalk    سبورة متعلقة والكلام بيتكتب عليها بالطباشير
  //   ticket   تذكرة سينما بحروف مقطّعة والكلمة المهمة عليها
  //   frame    برواز دهب فيه الكلام
  //   toggle   زرار تشغيل بيتقلب والكلمة المهمة بتنوّر
  //   years    عمود أرقام/كلمة متكررة بيلف ويقف على القيمة
  //   wave     كلام أحمر عملاق ماشي على خط متعرج في الكادر
  //   spaced   كلام متوزّع على عرض الكادر بمسافات واسعة
  //   search   خانة بحث والكلام بيتكتب فيها وتحتها اقتراحات
  //   digits   رقم أو كلمة في مربعات بتتقلب حرف حرف
  //   torn     شرايط ورق مقطوع بالكلام بخط آلة كاتبة
  // =====================================================================
  const GREEN = "#3BD24A";
  const accentOf = (th, bi, list) => list[bi % list.length] || th.accent || RED;
  const lineHtml = (eng, ln, sz, ff, ink, y, extra = "", word = null) => `<div dir="${AR.test(ln.map((x) => x.w).join("")) ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:800 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.03em;color:${ink};${extra}">${ln.map((x) => (word ? word(x) : esc(eng.text(x.w)))).join(" ")}</div>`;

  // ---------- serif
  P.k_serif = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ink = inkOf(this, th), acc = accentOf(th, bi, [GREEN, "#FFFFFF", "#E0261F", "#F2C14E"]);
    const fi = focusOf(b, it);
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.085 * this.ts;
    const lines = this.wrapItems(it, `800 ${sz}px ${ff}`, w * 0.8);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.48;
    const y0 = cy - (lines.length - 1) * sz * 0.6;
    let html = backdrop(this, th);
    const accInk = onVideo(this) || acc !== "#FFFFFF" ? acc : th.accent || RED;
    lines.forEach((ln, li) => {
      html += lineHtml(this, ln, sz, ff, ink, y0 + li * sz * 1.2, shadow(this), (x) => {
        const e = eOut(seg(t, x.t0, x.t0 + 0.28)), hot = it.indexOf(x) === fi;
        const s = this.text(x.w);
        const st = hot ? `font:400 ${(sz * 1.25).toFixed(1)}px ${SERIF(s)};letter-spacing:0;color:${accInk}` : "";
        return `<span style="display:inline-block;opacity:${e.toFixed(3)};filter:blur(${((1 - e) * sz * 0.12).toFixed(1)}px);transform:translateY(${((1 - e) * sz * 0.3).toFixed(1)}px);${st}">${esc(s)}</span>`;
      });
    });
    return html;
  };

  // ---------- chalk
  const CHALK = (s) => (AR.test(s) ? "'TY Ruqaa', 'SM Tajawal'" : "'TY Rock', cursive");
  P.k_chalk = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const ar = isAr(it);
    const bw = Math.min(w * 0.86, mn * 0.95), bh = bw * 0.62;
    const cy = this.blockSolid(b) ? Math.min(h - bh * 0.55, this.belowHead(b, bh * 0.4) + bh * 0.2) : h * 0.47;
    const p = eBack(seg(t, b.t0, b.t0 + 0.3));
    const sw = Math.sin((t - b.t0) * 2.2) * (1 - seg(t, b.t0, b.t0 + 1.4)) * 4;
    const font = CHALK(ar ? "ع" : "a");
    const txt = it.filter((x) => t >= x.t0).map((x, i, a) => (i === a.length - 1 ? typed(this.text(x.w), t, x.t0, 22) : this.text(x.w))).join(" ");
    const full = it.map((x) => this.text(x.w)).join(" ");
    // المقاس على قد الكلام كله عشان مايتغيرش وهو بيتكتب
    let fz = mn * 0.1;
    for (let q = 0; q < 8; q++) { const lines = Math.ceil(measure(full, `400 ${fz}px ${font}`) / (bw * 0.82)); if (lines * fz * 1.5 <= bh * 0.72) break; fz *= 0.86; }
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#3B6FD0,#1D3E8C 80%)"></div>`;
    html += `<svg data-free width="${w}" height="${h}" style="position:absolute;inset:0;overflow:visible"><path d="M${(w / 2 - bw * 0.3).toFixed(0)} ${(cy - bh / 2).toFixed(0)} L${(w / 2).toFixed(0)} ${(cy - bh * 0.85).toFixed(0)} L${(w / 2 + bw * 0.3).toFixed(0)} ${(cy - bh / 2).toFixed(0)}" fill="none" stroke="#2a2a2a" stroke-width="${(mn * 0.005).toFixed(1)}" opacity="${p.toFixed(2)}"/>
      <circle cx="${(w / 2).toFixed(0)}" cy="${(cy - bh * 0.85).toFixed(0)}" r="${(mn * 0.012).toFixed(1)}" fill="#C9302C"/></svg>
      <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${((w - bw) / 2).toFixed(1)}px;top:${(cy - bh / 2).toFixed(1)}px;width:${bw.toFixed(1)}px;height:${bh.toFixed(1)}px;box-sizing:border-box;transform-origin:50% -40%;transform:rotate(${sw.toFixed(2)}deg) scale(${p.toFixed(3)});
        border:${(mn * 0.028).toFixed(0)}px solid #8A5A32;border-radius:${(mn * 0.01).toFixed(0)}px;box-shadow:inset 0 0 0 ${(mn * 0.004).toFixed(0)}px #5E3A1D,0 ${(mn * 0.02).toFixed(0)}px ${(mn * 0.05).toFixed(0)}px rgba(0,0,0,.45);
        background:radial-gradient(ellipse at 40% 30%,#3E4A44,#262D2A 80%);display:flex;align-items:center;justify-content:center;padding:${(bw * 0.06).toFixed(0)}px;text-align:center">
        <div style="font:400 ${fz.toFixed(1)}px ${font};line-height:1.5;color:#F2F0E6;opacity:.92;filter:url(#tyRough);text-shadow:0 0 ${(fz * 0.06).toFixed(1)}px rgba(255,255,255,.4)">${esc(txt) || "&nbsp;"}</div></div>${ROUGH}`;
    return html;
  };

  // ---------- ticket
  const TICKET = [["#F4A23A", "#E07B1F", "#3A1E06"], ["#E9C93F", "#C9A21A", "#3A2A06"], ["#E25A4D", "#B83A2E", "#FFF4E6"]];
  P.k_ticket = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const [c0, c1, ink] = TICKET[bi % TICKET.length];
    const s = it.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
    const tw = Math.min(w * 0.84, mn * 0.9), thh = tw * 0.42;
    const cy = this.blockSolid(b) ? Math.min(h - thh, this.belowHead(b, thh * 0.5)) : h * 0.5;
    const shown = it.filter((x) => t >= x.t0).map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
    const font = cond(s);
    const fz = Math.min(thh * 0.34, fitSize(s, `400 {}px ${font}`, tw * 0.62, thh * 0.34) * 1);
    const lines = measure(s, `400 ${fz}px ${font}`) > tw * 0.62 ? 2 : 1;
    const p = eBack(seg(t, b.t0, b.t0 + 0.32));
    const serial = String(700000 + ((bi * 7919) % 99999));
    const notch = (mn * 0.03).toFixed(0);
    const card = (rot, dx, dy, sc, body) => `<div style="position:absolute;left:${((w - tw) / 2 + dx).toFixed(1)}px;top:${(cy - thh / 2 + dy).toFixed(1)}px;width:${tw.toFixed(1)}px;height:${thh.toFixed(1)}px;transform:rotate(${rot}deg) scale(${sc.toFixed(3)});
      background:linear-gradient(160deg,${c0},${c1});-webkit-mask:radial-gradient(circle ${notch}px at 0 50%,transparent 98%,#000) 0 0/51% 100% no-repeat,radial-gradient(circle ${notch}px at 100% 50%,transparent 98%,#000) 100% 0/51% 100% no-repeat;
      mask:radial-gradient(circle ${notch}px at 0 50%,transparent 98%,#000) 0 0/51% 100% no-repeat,radial-gradient(circle ${notch}px at 100% 50%,transparent 98%,#000) 100% 0/51% 100% no-repeat;filter:drop-shadow(0 ${(mn * 0.012).toFixed(0)}px ${(mn * 0.02).toFixed(0)}px rgba(0,0,0,.35))">${body}</div>`;
    const inner = `<div style="position:absolute;inset:${(thh * 0.1).toFixed(0)}px ${(tw * 0.12).toFixed(0)}px;border:${(mn * 0.004).toFixed(1)}px dashed ${ink}55;display:flex;align-items:center;justify-content:center">
        <div dir="${this.dir(s)}" style="font:400 ${fz.toFixed(1)}px ${font};color:${ink};line-height:1;text-align:center;${lines > 1 ? "" : "white-space:nowrap;"}max-width:${(tw * 0.66).toFixed(0)}px">${esc(shown) || "&nbsp;"}</div></div>
      ${[0, 1].map((q) => `<div dir="ltr" style="position:absolute;${q ? "right" : "left"}:${(tw * 0.03).toFixed(0)}px;top:50%;transform:translateY(-50%) rotate(${q ? 90 : -90}deg);font:400 ${(thh * 0.12).toFixed(1)}px 'TY Pixel',monospace;letter-spacing:.15em;color:${ink}">${serial}</div>`).join("")}`;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#1F5A3A"></div><div style="position:absolute;inset:0;background:repeating-conic-gradient(#111 0 25%,#EEE 0 50%) 0 ${(h * 0.7).toFixed(0)}px/${(mn * 0.12).toFixed(0)}px ${(mn * 0.12).toFixed(0)}px;opacity:.9;clip-path:polygon(0 72%,100% 64%,100% 100%,0 100%)"></div>`;
    html += card(-9, -tw * 0.04, thh * 0.18, p, "") + card(-3, 0, 0, p, inner);
    return html;
  };

  // ---------- frame: برواز دهب
  P.k_frame = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const fw = Math.min(w * 0.78, mn * 0.82), fh = fw * 0.8;
    const cy = this.blockSolid(b) ? Math.min(h - fh * 0.55, this.belowHead(b, fh * 0.3) + fh * 0.2) : h * 0.48;
    const p = eBack(seg(t, b.t0, b.t0 + 0.3));
    const ar = isAr(it);
    const words = it.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase()));
    const font = cond(words.join(""));
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : -1;
    // سطور بالمقاس اللي يملا البرواز
    let fz = fh * 0.22, lines;
    for (let q = 0; q < 8; q++) { lines = this.wrapItems(it.map((x, i) => ({ ...x, w: words[i] })), `400 ${fz}px ${font}`, fw * 0.66); if (lines.length * fz * 1.02 <= fh * 0.6) break; fz *= 0.88; }
    const gold = "linear-gradient(135deg,#8C6A1E,#F7DE8B 22%,#B98A2E 45%,#FCEBA8 62%,#9A7224 85%)";
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#7A1F24,#3A0B10 80%)"></div>`;
    html += `<div style="position:absolute;left:${((w - fw) / 2).toFixed(1)}px;top:${(cy - fh / 2).toFixed(1)}px;width:${fw.toFixed(1)}px;height:${fh.toFixed(1)}px;box-sizing:border-box;transform:scale(${p.toFixed(3)});
      padding:${(fw * 0.07).toFixed(0)}px;background:${gold};box-shadow:0 ${(mn * 0.02).toFixed(0)}px ${(mn * 0.06).toFixed(0)}px rgba(0,0,0,.5),inset 0 0 0 ${(fw * 0.012).toFixed(0)}px #6E5216,inset 0 0 0 ${(fw * 0.03).toFixed(0)}px #E8C66A">
      <div style="width:100%;height:100%;box-sizing:border-box;border:${(fw * 0.012).toFixed(0)}px solid #7A5A18;background:radial-gradient(ellipse at 50% 40%,#5A3A22,#2E1A0E);display:flex;flex-direction:column;align-items:center;justify-content:center">
      ${lines.map((ln) => `<div dir="${ar ? "rtl" : "ltr"}" style="white-space:nowrap;font:400 ${fz.toFixed(1)}px ${font};line-height:1.02;color:#F2C14E;text-shadow:0 ${(fz * 0.04).toFixed(1)}px 0 #7A4A10">${ln.map((x) => {
        const e = eOut(seg(t, x.t0, x.t0 + 0.2)), hot = it.findIndex((y) => y.t0 === x.t0) === fi;
        return `<span style="display:inline-block;opacity:${e.toFixed(3)};transform:scale(${lerp(1.4, 1, e).toFixed(3)});${hot ? "color:#FFF3C4;" : ""}">${esc(x.w)}</span>`;
      }).join(" ")}</div>`).join("")}</div></div>`;
    return html;
  };

  // ---------- toggle
  P.k_toggle = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : it.length - 1;
    const main = it[fi];
    const rest = it.filter((x, i) => i !== fi);
    const vid = onVideo(this), acc = accentOf(th, bi, ["#D6F63A", "#3BD24A", "#2F7CF6"]);
    const tw = mn * 0.42, thh = tw * 0.5;
    const cy = this.blockSolid(b) ? Math.min(h * 0.62, this.belowHead(b, thh)) : h * 0.42;
    const on = eOut(seg(t, main.t0 - 0.05, main.t0 + 0.25));
    const p = eBack(seg(t, b.t0, b.t0 + 0.25));
    let html = vid ? "" : `<div style="position:absolute;inset:0;background:${lerpCol("#F4F4F2", acc, on * 0.85)}"></div>`;
    html += `<div style="position:absolute;left:${((w - tw) / 2).toFixed(1)}px;top:${(cy - thh / 2).toFixed(1)}px;width:${tw.toFixed(1)}px;height:${thh.toFixed(1)}px;border-radius:${thh.toFixed(0)}px;transform:scale(${p.toFixed(3)});
      background:${lerpCol("#C9C9CC", "#1A1A1A", on)};box-shadow:inset 0 ${(thh * 0.06).toFixed(1)}px ${(thh * 0.15).toFixed(1)}px rgba(0,0,0,.35)">
      <div style="position:absolute;top:${(thh * 0.1).toFixed(1)}px;left:${lerp(thh * 0.1, tw - thh * 0.9, on).toFixed(1)}px;width:${(thh * 0.8).toFixed(1)}px;height:${(thh * 0.8).toFixed(1)}px;border-radius:50%;
        background:${lerpCol("#FFFFFF", acc, on)};box-shadow:0 ${(thh * 0.06).toFixed(1)}px ${(thh * 0.12).toFixed(1)}px rgba(0,0,0,.35)"></div></div>`;
    const ink = vid ? "#fff" : on > 0.5 ? "#111" : "#1A1A1A";
    if (rest.length && t >= rest[0].t0) {
      const r = rest.map((x) => this.text(x.w)).join(" "), rf = famOf(r);
      const z = fitSize(r, `600 {}px ${rf}`, w * 0.84, mn * 0.06 * this.ts);
      html += `<div dir="${this.dir(r)}" style="position:absolute;left:0;right:0;top:${(cy - thh * 1.1).toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:600 ${z.toFixed(1)}px ${rf};color:${ink};opacity:${eOut(seg(t, rest[0].t0, rest[0].t0 + 0.25)).toFixed(3)};${shadow(this)}">${esc(rest.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" "))}</div>`;
    }
    if (t >= main.t0 - 0.05) {
      const s = this.text(main.w), ff = famOf(s);
      const z = fitSize(s, `800 {}px ${ff}`, w * 0.86, mn * 0.24);
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${(cy + thh * 0.5 + z * 0.7).toFixed(1)}px;transform:translateY(-50%) scale(${lerp(0.8, 1, on).toFixed(3)});text-align:center;white-space:nowrap;font:800 ${z.toFixed(1)}px ${ff};letter-spacing:-0.05em;
        color:${ink};opacity:${lerp(0.15, 1, on).toFixed(3)};filter:blur(${((1 - on) * z * 0.06).toFixed(1)}px);${shadow(this)}">${esc(s)}</div>`;
    }
    return html;
  };
  function lerpCol(a, b, k) {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(k))).join(",")})`;
  }

  // ---------- years: عمود بيلف ويقف على القيمة
  P.k_years = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ni = it.findIndex((x) => /[0-9٠-٩]/.test(x.w));
    const fi = ni >= 0 ? ni : focusOf(b, it);
    const main = it[fi];
    const raw = this.text(main.w).replace(/[.,،!?؟]+$/, "");
    const num = ni >= 0 ? parseInt(raw.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^0-9]/g, ""), 10) : NaN;
    const rows = 9;
    const labelAt = (q) => (Number.isFinite(num) ? String(num + q) : raw);
    const vid = onVideo(this);
    const s0 = labelAt(0), ff = famOf(s0);
    const sz = fitSize(s0, `800 {}px ${ff}`, w * 0.8, mn * 0.24);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.45;
    const roll = (1 - eOut(seg(t, main.t0 - 0.35, main.t0 + 0.25))) * 6;
    let html = vid ? "" : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#2E8B3E,#14501F 80%)"></div>
      <div style="position:absolute;left:50%;top:0;bottom:0;width:${(mn * 0.012).toFixed(0)}px;background:rgba(255,255,255,.7);transform:translateX(-50%)"></div>`;
    for (let q = -rows; q <= rows; q++) {
      const off = q + roll;
      const y = cy + off * sz * 0.92;
      if (y < -sz || y > h + sz) continue;
      const d = Math.abs(off);
      const lab = labelAt(-Math.round(q));
      html += `<div dir="${this.dir(lab)}" style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:800 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.04em;line-height:1;
        color:${d < 0.5 ? "#fff" : "transparent"};-webkit-text-stroke:${d < 0.5 ? 0 : (sz * 0.012).toFixed(1)}px ${vid ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.35)"};opacity:${clamp(1 - d * 0.16, 0.08, 1).toFixed(3)};${d < 0.5 ? shadow(this) : ""}">${esc(lab)}</div>`;
    }
    const rest = it.filter((x, i) => i !== fi && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (rest) {
      const z = fitSize(rest, `600 {}px ${famOf(rest)}`, w * 0.84, mn * 0.045 * this.ts);
      html += `<div style="position:absolute;left:0;right:0;top:${Math.min(h * 0.9, cy + sz * 1.8).toFixed(1)}px;text-align:center"><span dir="${this.dir(rest)}" style="display:inline-block;white-space:nowrap;font:600 ${z.toFixed(1)}px ${famOf(rest)};color:#fff;background:rgba(0,0,0,.72);padding:${(z * 0.25).toFixed(1)}px ${(z * 0.5).toFixed(1)}px;border-radius:${(z * 0.3).toFixed(1)}px">${esc(rest)}</span></div>`;
    }
    return html;
  };

  // ---------- wave: كلام أحمر عملاق على خط متعرج
  P.k_wave = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const s = it.map((x) => this.text(x.w)).join(" ");
    const ar = isAr(it);
    const font = AR.test(s) ? "'SM Lalezar', 'SM Tajawal'" : "'TY Anton', 'TY Outfit'";
    const amp = mn * 0.12, cy = h * (0.35 + (bi % 3) * 0.12);
    const ph = (bi % 2) * Math.PI;
    let d = "";
    const N = 40, x0 = w * 0.04, x1 = w * 0.96;
    for (let q = 0; q <= N; q++) { const x = lerp(x0, x1, q / N), y = cy + Math.sin(ph + (q / N) * Math.PI * 2.2) * amp; d += `${q ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }
    let pathLen = 0;
    for (let q = 1; q <= N; q++) { const a = (q - 1) / N, c = q / N; pathLen += Math.hypot((x1 - x0) / N, (Math.sin(ph + c * Math.PI * 2.2) - Math.sin(ph + a * Math.PI * 2.2)) * amp); }
    const fz = clamp((pathLen * 0.94) / Math.max(1, measure(s, `400 100px ${font}`) / 100), mn * 0.08, mn * 0.26);
    const shown = it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    const slide = (1 - eOut(seg(t, b.t0, b.t0 + 0.6))) * 30;
    const red = accentOf(th, bi, ["#E5261F", "#E5261F", "#FF3EA5"]);
    const html = `<svg data-free width="${w}" height="${h}" style="position:absolute;inset:0;overflow:visible"><defs><path id="tyWave${bi}" d="${d}"/></defs>
      <text font-family="${font.replace(/'/g, "")}" font-size="${fz.toFixed(1)}" fill="${red}" style="paint-order:stroke;stroke:rgba(0,0,0,.18);stroke-width:${(fz * 0.03).toFixed(1)}px">
      <textPath href="#tyWave${bi}" startOffset="${(ar ? 100 - slide : slide).toFixed(1)}%" text-anchor="${ar ? "end" : "start"}">${esc(shown)}</textPath></text></svg>`;
    return backdrop(this, th) + (this.blockSolid(b) && (bi % 2 === 0) ? this.behindPerson(t, html) : html);
  };

  // ---------- spaced: كلام بمسافات واسعة على عرض الكادر
  P.k_spaced = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ink = inkOf(this, th);
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : -1;
    const sz = mn * 0.05 * this.ts;
    const per = clamp(Math.ceil(it.length / Math.ceil(it.length / 4)), 2, 4);
    const lines = [];
    for (let i = 0; i < it.length; i += per) lines.push(it.slice(i, i + per));
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.5;
    const y0 = cy - (lines.length - 1) * sz * 0.9;
    let html = backdrop(this, th);
    lines.forEach((ln, li) => {
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(w * 0.1).toFixed(0)}px;right:${(w * 0.1).toFixed(0)}px;top:${(y0 + li * sz * 1.8).toFixed(1)}px;transform:translateY(-50%);display:flex;justify-content:${ln.length > 1 ? "space-between" : "center"};
        font:500 ${sz.toFixed(1)}px ${ff};color:${ink};${shadow(this)}">${ln.map((x) => {
        const e = eOut(seg(t, x.t0, x.t0 + 0.22)), hot = it.indexOf(x) === fi;
        return `<span style="white-space:nowrap;opacity:${(t >= x.t0 ? e : hot ? 0 : 0.18 * seg(t, b.t0, b.t0 + 0.3)).toFixed(3)};${hot ? `font-weight:800;color:${th.accent || RED}` : ""}">${esc(this.text(x.w))}</span>`;
      }).join("")}</div>`;
    });
    return html;
  };

  // ---------- search: خانة بحث
  P.k_search = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const ar = isAr(it);
    const sz = mn * 0.042 * this.ts;
    const bw = Math.min(w * 0.86, sz * 18), bh = sz * 2.4;
    const cy = this.blockSolid(b) ? Math.min(h * 0.7, this.belowHead(b, bh * 2)) : h * 0.42;
    const txt = it.filter((x) => t >= x.t0).map((x, i, a) => (i === a.length - 1 ? typed(this.text(x.w), t, x.t0, 28) : this.text(x.w))).join(" ");
    const done = it.length && t > it[it.length - 1].t0 + 0.35;
    const dk = eOut(seg(t, it.length ? it[it.length - 1].t0 + 0.35 : b.t1, (it.length ? it[it.length - 1].t0 : b.t1) + 0.7));
    const p = eBack(seg(t, b.t0, b.t0 + 0.25));
    const ff = famOf(ar ? "ع" : "a");
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#F7F7F8"></div>`;
    const glass = "rgba(255,255,255,.96)";
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${((w - bw) / 2).toFixed(1)}px;top:${(cy - bh / 2).toFixed(1)}px;width:${bw.toFixed(1)}px;transform:scale(${p.toFixed(3)});transform-origin:50% 0">
      <div style="height:${bh.toFixed(1)}px;box-sizing:border-box;display:flex;align-items:center;gap:${(sz * 0.6).toFixed(1)}px;padding:0 ${(sz * 0.8).toFixed(1)}px;background:${glass};border-radius:${(done ? sz * 1.2 : bh / 2).toFixed(1)}px ${(done ? sz * 1.2 : bh / 2).toFixed(1)}px ${(done ? 0 : bh / 2).toFixed(1)}px ${(done ? 0 : bh / 2).toFixed(1)}px;
        box-shadow:0 ${(sz * 0.25).toFixed(1)}px ${(sz * 1.2).toFixed(1)}px rgba(0,0,0,.18);border:1px solid rgba(0,0,0,.06)">
        <svg width="${(sz * 1.1).toFixed(0)}" height="${(sz * 1.1).toFixed(0)}" viewBox="0 0 24 24" style="flex:none"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="#5F6368" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="#5F6368" stroke-width="2.6" stroke-linecap="round"/></svg>
        <div style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:500 ${sz.toFixed(1)}px ${ff};color:#202124">${esc(txt)}<span style="display:inline-block;width:${(sz * 0.07).toFixed(1)}px;height:${(sz * 1.1).toFixed(1)}px;background:#1A73E8;vertical-align:-0.18em;margin:0 ${(sz * 0.06).toFixed(1)}px;opacity:${done ? 0 : Math.floor(t * 3) % 2}"></span></div></div>
      ${dk > 0 ? `<div style="background:${glass};border-radius:0 0 ${(sz * 1.2).toFixed(1)}px ${(sz * 1.2).toFixed(1)}px;box-shadow:0 ${(sz * 0.4).toFixed(1)}px ${(sz * 1.2).toFixed(1)}px rgba(0,0,0,.18);overflow:hidden;height:${(sz * 4.6 * dk).toFixed(1)}px;border-top:1px solid #E8EAED">
        ${[0.78, 0.55, 0.66].map((q, i) => `<div style="display:flex;align-items:center;gap:${(sz * 0.6).toFixed(1)}px;padding:${(sz * 0.35).toFixed(1)}px ${(sz * 0.8).toFixed(1)}px"><svg width="${(sz * 0.8).toFixed(0)}" height="${(sz * 0.8).toFixed(0)}" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="#9AA0A6" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="#9AA0A6" stroke-width="2.6" stroke-linecap="round"/></svg>
          <div style="font:${i ? 400 : 600} ${(sz * 0.85).toFixed(1)}px ${ff};color:${i ? "#5F6368" : "#202124"};white-space:nowrap;overflow:hidden;max-width:${(bw * q).toFixed(0)}px;text-overflow:ellipsis">${esc(i === 0 ? txt : txt.split(" ").slice(0, Math.max(1, txt.split(" ").length - i)).join(" "))}</div></div>`).join("")}</div>` : ""}</div>`;
    return html;
  };

  // ---------- digits: مربعات بتتقلب حرف حرف
  P.k_digits = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ni = it.findIndex((x) => /[0-9٠-٩]/.test(x.w));
    const fi = ni >= 0 ? ni : focusOf(b, it);
    const main = it[fi];
    let raw = this.text(main.w).replace(/[.,،!?؟]+$/, "");
    if (!AR.test(raw)) raw = raw.toUpperCase();
    const chars = AR.test(raw) && ni < 0 ? [raw] : [...raw].slice(0, 9);
    const n = chars.length;
    const gap = mn * 0.02;
    const tile = Math.min(mn * 0.22, (w * 0.88 - gap * (n - 1)) / n);
    const tileW = AR.test(raw) && ni < 0 ? Math.min(w * 0.8, measure(raw, `400 ${tile * 0.7}px ${cond(raw)}`) + tile * 0.5) : tile;
    const totalW = n * tileW + (n - 1) * gap;
    const cy = this.blockSolid(b) ? this.belowHead(b, tile) : h * 0.45;
    const [bg, line, ink] = [["#FFFFFF", "#D2261E", "#D2261E"], ["#1C1C1C", "#F2C14E", "#F2C14E"], ["#FFFFFF", "#1E5FE0", "#111"]][bi % 3];
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${["#2E8B3E", "#C9302C", "#F2C14E"][bi % 3]}"></div>
      <div style="position:absolute;inset:0;background:linear-gradient(rgba(0,0,0,.08) 1px,transparent 1px) 0 0/${(mn / 12).toFixed(0)}px ${(mn / 12).toFixed(0)}px,linear-gradient(90deg,rgba(0,0,0,.08) 1px,transparent 1px) 0 0/${(mn / 12).toFixed(0)}px ${(mn / 12).toFixed(0)}px"></div>`;
    chars.forEach((c, i) => {
      const t0 = main.t0 - 0.15 + i * 0.07;
      const f = eOut(seg(t, t0, t0 + 0.3));
      if (t < t0) return;
      const x = (w - totalW) / 2 + i * (tileW + gap);
      html += `<div style="position:absolute;left:${x.toFixed(1)}px;top:${(cy - tile * 0.6).toFixed(1)}px;width:${tileW.toFixed(1)}px;height:${(tile * 1.2).toFixed(1)}px;box-sizing:border-box;perspective:${(tile * 6).toFixed(0)}px">
        <div style="width:100%;height:100%;box-sizing:border-box;transform:rotateX(${((1 - f) * 90).toFixed(1)}deg);transform-origin:50% 100%;background:${bg};border:${(tile * 0.06).toFixed(1)}px solid ${line};border-radius:${(tile * 0.08).toFixed(1)}px;
          box-shadow:0 ${(tile * 0.06).toFixed(1)}px 0 ${line},0 ${(tile * 0.12).toFixed(1)}px ${(tile * 0.2).toFixed(1)}px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font:400 ${(tile * 0.78).toFixed(1)}px ${cond(c)};color:${ink};line-height:1">
          ${esc(c)}<i style="position:absolute;left:0;right:0;top:50%;height:${Math.max(1, tile * 0.015).toFixed(1)}px;background:rgba(0,0,0,.18)"></i></div></div>`;
    });
    const rest = it.filter((x, i) => i !== fi && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (rest) {
      const z = fitSize(rest, `400 {}px ${cond(rest)}`, w * 0.84, mn * 0.08);
      html += `<div dir="${this.dir(rest)}" style="position:absolute;left:0;right:0;top:${(cy - tile * 0.6 - z * 0.9).toFixed(1)}px;text-align:center;white-space:nowrap;font:400 ${z.toFixed(1)}px ${cond(rest)};color:#fff;letter-spacing:.02em;text-shadow:0 ${(z * 0.05).toFixed(1)}px 0 rgba(0,0,0,.4)">${esc(AR.test(rest) ? rest : rest.toUpperCase())}</div>`;
    }
    return html;
  };

  // ---------- torn: شرايط ورق مقطوع
  P.k_torn = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 3))));
    const r = this.freeRect(b);
    const sz = mn * 0.05 * this.ts;
    const step = sz * 2.3;
    const shown = cs.filter((c) => t >= c.t0);
    const vis = shown.slice(-Math.max(1, Math.floor(r.h / step)));
    const y0 = r.y + Math.max(0, (r.h - vis.length * step) / 2) + step / 2;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#6B4A2E,#33220F 85%)"></div>`;
    vis.forEach((c, i) => {
      const s = this.text(c.w), tf = TYPEW(s);
      const z = fitSize(s, `400 {}px ${tf}`, r.w * 0.82, sz);
      const tw = measure(s, `400 ${z}px ${tf}`) + z * 1.6;
      const rr = rng(bi * 17 + cs.indexOf(c) * 5 + 3);
      const pts = [];
      for (let q = 0; q <= 14; q++) pts.push(`${((q / 14) * 100).toFixed(1)}% ${(rr() * 14).toFixed(1)}%`);
      for (let q = 14; q >= 0; q--) pts.push(`${((q / 14) * 100).toFixed(1)}% ${(86 + rr() * 14).toFixed(1)}%`);
      const e = eBack(seg(t, c.t0, c.t0 + 0.28));
      const rot = (rr() - 0.5) * 6;
      const cx = r.x + r.w / 2 + (rr() - 0.5) * Math.max(0, r.w - tw) * 0.5;
      html += `<div style="position:absolute;left:${cx.toFixed(1)}px;top:${(y0 + i * step).toFixed(1)}px;transform:translate(-50%,-50%) rotate(${rot.toFixed(2)}deg) scale(${e.toFixed(3)});filter:drop-shadow(0 ${(sz * 0.15).toFixed(1)}px ${(sz * 0.25).toFixed(1)}px rgba(0,0,0,.45))">
        <div dir="${this.dir(s)}" style="clip-path:polygon(${pts.join(",")});background:linear-gradient(180deg,#F1E6CF,#E2D2B0);padding:${(z * 0.5).toFixed(1)}px ${(z * 0.8).toFixed(1)}px;white-space:nowrap;font:400 ${z.toFixed(1)}px ${tf};color:#2A2118">${esc(s)}</div></div>`;
    });
    return html;
  };

  // =====================================================================
  // رموز وتيمبليتس (من الـ34 فيديو):
  //   emoji      الكلام وإيموجي على قد المعنى بتطلع وتطفو حواليه، والكلمة المهمة منوّرة
  //   doodle     خربشة بالقلم حوالين الكلام: لمعة، سهم ملفوف، نجمة، خط متعرج
  //   browser    شباك متصفح: العنوان بيتكتب والكلام عنوان الصفحة وزرار
  //   split      قبل/بعد: صورة من الفيديو متقسومة نصين بخط بيتحرك
  //   spotlight  مسرح غامق وكشاف نور نازل على الكلمة
  //   phone      موبايل في النص والكلام على شاشته فوق صورة من الفيديو
  // =====================================================================
  const EMOJI = [[/money|cash|price|buy|sell|paid|دولار|فلوس|مال|سعر|اشتر|بيع|ربح/i, "💸"], [/love|heart|حب|قلب/i, "❤️"], [/fire|hot|viral|trend|نار|ترند/i, "🔥"],
    [/\btime\b|\bhours?\b|minute|\blate\b|وقت|ساعة|دقيق|بدري/i, "⏰"], [/idea|think|فكر/i, "💡"], [/brain|mind|smart|عقل|مخ|ذكي/i, "🧠"], [/sad|cry|tears|حزين|زعل|بكا|دموع/i, "😢"],
    [/angry|mad|hate|غضب|متضايق|بكره/i, "😡"], [/laugh|funny|lol|ضحك|هزار/i, "😂"], [/risk|danger|warn|careful|خطر|تحذير|حذر/i, "⚠️"],
    [/success|win|grow|launch|rocket|نجاح|نجح|كسب|نمو|اطلاق/i, "🚀"], [/\bsee\b|\blook|watch|\beyes?\b|شوف|بص|عين|اتفرج/i, "👀"], [/phone|mobile|app|موبايل|تليفون|تطبيق/i, "📱"],
    [/video|film|movie|camera|فيديو|فيلم|كاميرا|تصوير/i, "🎬"], [/music|song|sound|موسيق|اغني|أغني|صوت/i, "🎵"], [/food|eat|hungry|popcorn|أكل|اكل|جعان/i, "🍿"],
    [/work|job|office|business|شغل|وظيف|بيزنس/i, "💼"], [/gym|fit|muscle|strong|workout|جيم|تمرين|عضل|قوي/i, "💪"], [/sleep|tired|نوم|نام|تعبان/i, "😴"],
    [/star|best|top|نجم|أحسن|احسن|أفضل/i, "⭐"], [/why|how|what|question|ليه|ازاي|إزاي|سؤال/i, "🤔"], [/yes|right|correct|done|تمام|صح|خلاص/i, "✅"],
    [/wrong|never|mistake|غلط|أبدا|ابدا|خطأ/i, "❌"], [/water|drink|مية|ماء|اشرب/i, "💧"], [/world|global|travel|عالم|سفر|دول/i, "🌍"], [/gift|free|bonus|هدي|مجان|ببلاش/i, "🎁"],
    [/baby|kid|child|طفل|عيال|بيبي/i, "👶"], [/animal|tiger|lion|wild|حيوان|نمر|أسد|اسد/i, "🐯"], [/shock|wow|crazy|omg|صدم|مجنون|يا نهار/i, "🤯"]];
  const emojiOf = (s) => (EMOJI.find(([re]) => re.test(s)) || [])[1];
  P.k_emoji = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ink = inkOf(this, th), acc = th.accent || RED;
    const fi = focusOf(b, it);
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.08 * this.ts;
    const lines = this.wrapItems(it, `800 ${sz}px ${ff}`, w * 0.8);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.48;
    const y0 = cy - (lines.length - 1) * sz * 0.6;
    let html = backdrop(this, th);
    lines.forEach((ln, li) => {
      html += lineHtml(this, ln, sz, ff, ink, y0 + li * sz * 1.2, shadow(this), (x) => {
        const e = eOut(seg(t, x.t0, x.t0 + 0.2)), hot = it.indexOf(x) === fi;
        return `<span style="display:inline-block;opacity:${e.toFixed(3)};transform:scale(${lerp(0.7, 1, e).toFixed(3)});${hot ? `color:${acc};text-shadow:0 0 ${(sz * 0.3).toFixed(0)}px ${acc},0 0 ${(sz * 0.08).toFixed(0)}px ${acc}` : ""}">${esc(this.text(x.w))}</span>`;
      });
    });
    // الإيموجي: واحدة لكل كلمة ليها معنى، وإلا اتنين من الافتراضي
    let em = it.map((x) => ({ e: emojiOf(x.w), t0: x.t0 })).filter((x) => x.e);
    if (!em.length) em = [["✨", "👀"], ["🔥", "💡"], ["🤯", "🚀"]][bi % 3].map((e, i) => ({ e, t0: it[Math.min(it.length - 1, i * 2)].t0 }));
    const half = (lines.length * sz * 1.2) / 2 + sz * 1.1;
    const spots = [[-0.32, -1], [0.33, 1], [0.36, -1], [-0.3, 1], [0, -1.25], [0.05, 1.3]];
    em.slice(0, 6).forEach((x, i) => {
      if (t < x.t0) return;
      const [fx, fy] = spots[(i + bi) % spots.length];
      const p = eBack(seg(t, x.t0, x.t0 + 0.3));
      const bob = Math.sin((t - x.t0) * 3 + i) * mn * 0.01;
      const ez = mn * (0.1 + ((i + bi) % 3) * 0.02);
      html += `<div style="position:absolute;left:${(w / 2 + fx * w).toFixed(1)}px;top:${(cy + fy * half + bob).toFixed(1)}px;transform:translate(-50%,-50%) scale(${p.toFixed(3)}) rotate(${((i % 2 ? 1 : -1) * 10 * (1 - p + 0.4)).toFixed(1)}deg);font-size:${ez.toFixed(0)}px;line-height:1;
        font-family:'Noto Color Emoji','Apple Color Emoji',sans-serif;filter:drop-shadow(0 ${(ez * 0.06).toFixed(0)}px ${(ez * 0.1).toFixed(0)}px rgba(0,0,0,.25))">${x.e}</div>`;
    });
    return html;
  };

  // ---------- doodle: خربشة بالقلم حوالين الكلام
  P.k_doodle = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const vid = onVideo(this), ink = inkOf(this, th);
    const pen = vid ? "#FFFFFF" : accentOf(th, bi, ["#E0261F", "#1E5FE0", "#111111"]);
    const fi = focusOf(b, it);
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.085 * this.ts;
    const lines = this.wrapItems(it, `800 ${sz}px ${ff}`, w * 0.74);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.47;
    const y0 = cy - (lines.length - 1) * sz * 0.6;
    const tw = Math.max(...lines.map((ln) => measure(ln.map((x) => this.text(x.w)).join(" "), `800 ${sz}px ${ff}`)));
    let html = vid ? "" : `<div style="position:absolute;inset:0;background:#F3F1EC"></div>`;
    lines.forEach((ln, li) => {
      html += lineHtml(this, ln, sz, ff, ink, y0 + li * sz * 1.2, shadow(this), (x) => {
        const e = eOut(seg(t, x.t0, x.t0 + 0.2));
        return `<span style="display:inline-block;opacity:${e.toFixed(3)};transform:translateY(${((1 - e) * sz * 0.25).toFixed(1)}px)">${esc(this.text(x.w))}</span>`;
      });
    });
    const L = (w0, h0) => Math.hypot(w0, h0) * 1.6;
    const draw = (d, len, t0, dur = 0.35, sw = 0.008) => {
      const q = seg(t, t0, t0 + dur);
      return q > 0 ? `<path d="${d}" fill="none" stroke="${pen}" stroke-width="${(mn * sw).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${(len * (1 - q)).toFixed(1)}"/>` : "";
    };
    const x0 = w / 2 - tw / 2, x1 = w / 2 + tw / 2, top = y0 - sz * 0.7, bot = y0 + (lines.length - 1) * sz * 1.2 + sz * 0.6;
    const ta = it[0].t0 + 0.1, tf = it[fi].t0 + 0.15;
    let svg = "";
    // لمعة (3 شرط) فوق أول الكلام
    const sx = ar ? x1 + sz * 0.15 : x0 - sz * 0.15, sy = top, dir = ar ? 1 : -1;
    [[-0.9, -0.2], [-0.5, -0.75], [0.15, -0.95]].forEach(([a, c], i) => {
      const ax = sx + dir * a * sz * 0.2, ay = sy + c * sz * 0.2, bx = sx + dir * a * sz * 0.65, by = sy + c * sz * 0.65;
      svg += draw(`M${ax.toFixed(1)} ${ay.toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}`, L(bx - ax, by - ay), ta + i * 0.06, 0.18);
    });
    // خط متعرج تحت الكلام كله
    let zz = `M${x0.toFixed(1)} ${(bot + sz * 0.2).toFixed(1)}`;
    const nz = 9;
    for (let q = 1; q <= nz; q++) zz += ` Q${lerp(x0, x1, (q - 0.5) / nz).toFixed(1)} ${(bot + sz * (q % 2 ? 0.45 : -0.05)).toFixed(1)} ${lerp(x0, x1, q / nz).toFixed(1)} ${(bot + sz * 0.2).toFixed(1)}`;
    svg += draw(zz, tw * 1.25, tf, 0.45);
    // سهم ملفوف جاي من تحت على الكلمة المهمة
    const ax = ar ? x0 - sz * 0.3 : x1 + sz * 0.3, ay = bot + sz * 1.6;
    const tx = ar ? x0 + sz * 0.2 : x1 - sz * 0.2, ty = bot + sz * 0.55;
    const cx1 = ax + (ar ? -1 : 1) * sz * 0.9;
    svg += draw(`M${ax.toFixed(1)} ${(ay + sz * 0.6).toFixed(1)} C${cx1.toFixed(1)} ${(ay + sz * 0.2).toFixed(1)} ${cx1.toFixed(1)} ${(ay - sz * 0.6).toFixed(1)} ${ax.toFixed(1)} ${(ay - sz * 0.3).toFixed(1)} S${tx.toFixed(1)} ${(ty + sz * 0.4).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`, sz * 4, tf + 0.2, 0.4)
      + draw(`M${(tx - sz * 0.28).toFixed(1)} ${(ty + sz * 0.12).toFixed(1)} L${tx.toFixed(1)} ${ty.toFixed(1)} L${(tx + sz * 0.05).toFixed(1)} ${(ty + sz * 0.3).toFixed(1)}`, sz * 0.8, tf + 0.55, 0.12);
    // نجمة صغيرة في الناحية التانية
    const stx = ar ? x0 - sz * 0.2 : x1 + sz * 0.25, sty = top - sz * 0.1, R = sz * 0.32;
    const star = Array.from({ length: 6 }, (_, q) => { const a = -Math.PI / 2 + (q * 4 * Math.PI) / 5; return `${q ? "L" : "M"}${(stx + Math.cos(a) * R).toFixed(1)} ${(sty + Math.sin(a) * R).toFixed(1)}`; }).join(" ");
    svg += draw(star, R * 9, ta + 0.25, 0.35, 0.006);
    return html + `<svg data-free width="${w}" height="${h}" style="position:absolute;inset:0;overflow:visible">${svg}</svg>`;
  };

  // ---------- browser: شباك متصفح
  P.k_browser = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it);
    const fi = focusOf(b, it);
    const slug = AR.test(it[fi].w) ? "studio.app" : `${this.text(it[fi].w).toLowerCase().replace(/[^a-z0-9]/g, "") || "studio"}.com`;
    const ww = Math.min(w * 0.88, mn * 0.95), wh = ww * 0.82;
    const cy = this.blockSolid(b) ? Math.min(h - wh * 0.55, this.belowHead(b, wh * 0.3) + wh * 0.25) : h * 0.48;
    const p = eOut(seg(t, b.t0, b.t0 + 0.35));
    const bar = ww * 0.075;
    const url = typed(`www.${slug}`, t, b.t0 + 0.15, 26);
    const acc = accentOf(th, bi, ["#2F7CF6", "#3BD24A", "#7B4DFF"]);
    const ff = famOf(ar ? "ع" : "a");
    const words = it.map((x) => this.text(x.w));
    let fz = ww * 0.085;
    for (let q = 0; q < 6; q++) { if (this.wrapItems(it, `800 ${fz}px ${ff}`, ww * 0.8).length * fz * 1.15 <= wh * 0.42) break; fz *= 0.88; }
    const lines = this.wrapItems(it, `800 ${fz}px ${ff}`, ww * 0.8);
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#E9ECF2,#C9D2E2)"></div>`;
    html += `<div style="position:absolute;left:${((w - ww) / 2).toFixed(1)}px;top:${(cy - wh / 2).toFixed(1)}px;width:${ww.toFixed(1)}px;height:${wh.toFixed(1)}px;border-radius:${(ww * 0.03).toFixed(0)}px;overflow:hidden;background:#fff;
      transform:translateY(${((1 - p) * h * 0.25).toFixed(1)}px) scale(${lerp(0.92, 1, p).toFixed(3)});opacity:${clamp(p * 2).toFixed(3)};box-shadow:0 ${(mn * 0.03).toFixed(0)}px ${(mn * 0.08).toFixed(0)}px rgba(0,0,0,.35)">
      <div style="height:${bar.toFixed(1)}px;background:#ECEDF0;display:flex;align-items:center;gap:${(bar * 0.2).toFixed(1)}px;padding:0 ${(bar * 0.35).toFixed(1)}px">
        ${["#FF5F57", "#FEBC2E", "#28C840"].map((c) => `<i style="width:${(bar * 0.24).toFixed(1)}px;height:${(bar * 0.24).toFixed(1)}px;border-radius:50%;background:${c}"></i>`).join("")}
        <div dir="ltr" style="flex:1;margin:0 ${(bar * 0.3).toFixed(1)}px;height:${(bar * 0.56).toFixed(1)}px;border-radius:${(bar * 0.3).toFixed(1)}px;background:#fff;display:flex;align-items:center;gap:${(bar * 0.15).toFixed(1)}px;padding:0 ${(bar * 0.3).toFixed(1)}px;font:500 ${(bar * 0.3).toFixed(1)}px 'TY Outfit';color:#5F6368">
          <svg width="${(bar * 0.26).toFixed(0)}" height="${(bar * 0.3).toFixed(0)}" viewBox="0 0 10 12"><rect x="1" y="5" width="8" height="6.5" rx="1.2" fill="#5F6368"/><path d="M2.8 5V3.6a2.2 2.2 0 0 1 4.4 0V5" fill="none" stroke="#5F6368" stroke-width="1.3"/></svg>${esc(url)}</div></div>
      <div dir="${ar ? "rtl" : "ltr"}" style="padding:${(ww * 0.06).toFixed(0)}px ${(ww * 0.08).toFixed(0)}px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${(wh * 0.06).toFixed(0)}px"><i style="width:${(ww * 0.14).toFixed(0)}px;height:${(ww * 0.03).toFixed(0)}px;border-radius:4px;background:#202124"></i>
          <span style="display:flex;gap:${(ww * 0.03).toFixed(0)}px">${[0, 1, 2].map(() => `<i style="width:${(ww * 0.07).toFixed(0)}px;height:${(ww * 0.015).toFixed(0)}px;border-radius:3px;background:#C4C7CC"></i>`).join("")}</span></div>
        ${lines.map((ln) => `<div style="white-space:nowrap;font:800 ${fz.toFixed(1)}px ${ff};letter-spacing:-0.03em;line-height:1.15;color:#141414">${ln.map((x) => {
          const e = eOut(seg(t, x.t0, x.t0 + 0.25)), hot = it.indexOf(x) === fi;
          return `<span style="opacity:${e.toFixed(3)};${hot ? `color:${acc}` : ""}">${esc(this.text(x.w))}</span>`;
        }).join(" ")}</div>`).join("")}
        <div style="margin-top:${(wh * 0.05).toFixed(0)}px;display:flex;gap:${(ww * 0.03).toFixed(0)}px;opacity:${seg(t, it[it.length - 1].t0, it[it.length - 1].t0 + 0.3).toFixed(3)}">
          <span style="padding:${(ww * 0.018).toFixed(0)}px ${(ww * 0.05).toFixed(0)}px;border-radius:999px;background:${acc};color:#fff;font:700 ${(ww * 0.032).toFixed(1)}px ${ff}">${ar ? "ابدأ دلوقتي" : "Get started"}</span>
          <span style="padding:${(ww * 0.018).toFixed(0)}px ${(ww * 0.05).toFixed(0)}px;border-radius:999px;border:1px solid #C4C7CC;color:#202124;font:600 ${(ww * 0.032).toFixed(1)}px ${ff}">${ar ? "اعرف أكتر" : "Learn more"}</span></div>
        ${[0.9, 0.7, 0.8].map((q) => `<i style="display:block;width:${(q * 100).toFixed(0)}%;height:${(ww * 0.018).toFixed(0)}px;border-radius:4px;background:#ECEDF0;margin-top:${(wh * 0.04).toFixed(0)}px"></i>`).join("")}</div></div>`;
    void words;
    return html;
  };

  // ---------- split: قبل/بعد
  P.k_split = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const src = imgOf(b);
    if (src) this._want = src;
    const vsAt = it.findIndex((x) => /^(vs\.?|versus|ضد|قصاد|مقابل|ولا)$/i.test(x.w));
    const cs = vsAt > 0 && vsAt < it.length - 1 ? [it.slice(0, vsAt), it.slice(vsAt + 1)].map((g) => ({ w: g.map((x) => x.w).join(" "), t0: g[0].t0 })) : chunks(it, 2);
    const ar = isAr(it);
    const tall = h > w;
    const pw = tall ? w * 0.86 : w * 0.42, ph = tall ? h * 0.32 : h * 0.6;
    const gap = mn * 0.03;
    const p = eOut(seg(t, b.t0, b.t0 + 0.4));
    const reveal = eOut(seg(t, cs[1] ? cs[1].t0 - 0.1 : b.t0 + 0.6, (cs[1] ? cs[1].t0 : b.t0 + 0.6) + 0.5));
    const labels = [cs[0]?.w || (ar ? "قبل" : "Before"), cs[1]?.w || (ar ? "بعد" : "After")].map((s) => this.text(s));
    const panel = (i) => {
      const x = tall ? (w - pw) / 2 : w / 2 - pw - gap / 2 + i * (pw + gap);
      const y = tall ? h / 2 - ph - gap / 2 + i * (ph + gap) : (h - ph) / 2;
      const show = i === 0 ? p : reveal;
      const fl = i === 0 ? "grayscale(1) brightness(.75) contrast(.9)" : "saturate(1.35) contrast(1.08)";
      const s = labels[i], z = fitSize(s, `800 {}px ${famOf(s)}`, pw * 0.86, mn * 0.07 * this.ts);
      return `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${pw.toFixed(1)}px;height:${ph.toFixed(1)}px;border-radius:${(mn * 0.03).toFixed(0)}px;overflow:hidden;opacity:${show.toFixed(3)};
        transform:translate${tall ? "Y" : "X"}(${((1 - show) * (i ? 1 : -1) * mn * 0.1).toFixed(1)}px);box-shadow:0 ${(mn * 0.02).toFixed(0)}px ${(mn * 0.05).toFixed(0)}px rgba(0,0,0,.35);
        background:${src ? `url(${src}) center/cover` : i ? "linear-gradient(160deg,#FFB23E,#E0261F)" : "linear-gradient(160deg,#9A9AA0,#4A4A50)"};filter:${src ? fl : "none"}"></div>
        <div dir="${this.dir(s)}" style="position:absolute;left:${(x + pw / 2).toFixed(1)}px;top:${(y + ph * 0.14).toFixed(1)}px;transform:translate(-50%,-50%);opacity:${show.toFixed(3)};white-space:nowrap;font:800 ${z.toFixed(1)}px ${famOf(s)};color:#fff;
          text-shadow:0 2px 14px rgba(0,0,0,.6)">${esc(s)}</div>`;
    };
    let html = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.45)"></div>` : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#3A3D44,#141518 80%)"></div>`;
    html += panel(0) + panel(1);
    if (vsAt > 0 && t >= it[vsAt].t0) {
      const vz = mn * 0.09, e2 = eBack(seg(t, it[vsAt].t0, it[vsAt].t0 + 0.3));
      html += `<div style="position:absolute;left:50%;top:50%;width:${(vz * 1.6).toFixed(0)}px;height:${(vz * 1.6).toFixed(0)}px;transform:translate(-50%,-50%) scale(${e2.toFixed(3)});border-radius:50%;background:#fff;color:#151515;
        display:flex;align-items:center;justify-content:center;font:800 ${vz.toFixed(1)}px ${famOf(it[vsAt].w)};box-shadow:0 ${(vz * 0.1).toFixed(0)}px ${(vz * 0.4).toFixed(0)}px rgba(0,0,0,.35)">${esc(this.text(it[vsAt].w))}</div>`;
    }
    return html;
  };

  // ---------- spotlight: كشاف نور على الكلمة
  P.k_spotlight = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const fi = focusOf(b, it), main = it[fi];
    const vid = onVideo(this);
    const lx = w / 2, cy = this.blockSolid(b) ? this.belowHead(b, mn * 0.1) : h * 0.55;
    const on = eOut(seg(t, b.t0, b.t0 + 0.25));
    const flick = 0.92 + 0.08 * Math.sin(t * 37) * (1 - seg(t, b.t0, b.t0 + 0.6));
    const tint = ["255,244,214", "214,236,255", "255,214,214"][bi % 3];
    let html = vid ? `<div style="position:absolute;inset:0;background:radial-gradient(ellipse ${(w * 0.6).toFixed(0)}px ${(h * 0.55).toFixed(0)}px at ${lx}px ${cy.toFixed(0)}px,transparent 30%,rgba(0,0,0,${(0.78 * on).toFixed(2)}) 75%)"></div>`
      : `<div style="position:absolute;inset:0;background:#0B0B0D"></div>`;
    // الكشاف: شعاع من فوق، ودايرة نور على الأرض
    html += `<div style="position:absolute;left:0;top:0;width:${w}px;height:${(cy + mn * 0.25).toFixed(0)}px;opacity:${(on * flick * (vid ? 0.55 : 0.9)).toFixed(3)};mix-blend-mode:screen;
      background:linear-gradient(180deg,rgba(${tint},.75),rgba(${tint},.18));clip-path:polygon(${(50 - 6).toFixed(1)}% 0,${(50 + 6).toFixed(1)}% 0,${(50 + 34).toFixed(1)}% 100%,${(50 - 34).toFixed(1)}% 100%);filter:blur(${(mn * 0.02).toFixed(0)}px)"></div>
      <div style="position:absolute;left:${(lx - w * 0.36).toFixed(0)}px;top:${(cy + mn * 0.14).toFixed(0)}px;width:${(w * 0.72).toFixed(0)}px;height:${(mn * 0.2).toFixed(0)}px;border-radius:50%;opacity:${(on * flick).toFixed(3)};
        background:radial-gradient(ellipse,rgba(${tint},.55),transparent 70%);mix-blend-mode:screen"></div>
      <div style="position:absolute;left:${(lx - mn * 0.05).toFixed(0)}px;top:${(-mn * 0.02).toFixed(0)}px;width:${(mn * 0.1).toFixed(0)}px;height:${(mn * 0.05).toFixed(0)}px;border-radius:0 0 ${(mn * 0.05).toFixed(0)}px ${(mn * 0.05).toFixed(0)}px;background:#2A2A2E"></div>`;
    const s = AR.test(main.w) ? main.w : this.text(main.w).toUpperCase(), ff = famOf(s);
    const z = fitSize(s, `800 {}px ${ff}`, w * 0.72, mn * 0.17);
    if (t >= main.t0) {
      const e = eOut(seg(t, main.t0, main.t0 + 0.3));
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${cy.toFixed(1)}px;transform:translateY(-50%) scale(${lerp(0.85, 1, e).toFixed(3)});text-align:center;white-space:nowrap;font:800 ${z.toFixed(1)}px ${ff};letter-spacing:-0.03em;
        color:#FFF;opacity:${e.toFixed(3)};text-shadow:0 0 ${(z * 0.35).toFixed(0)}px rgba(${tint},.65),0 ${(z * 0.06).toFixed(0)}px ${(z * 0.1).toFixed(0)}px rgba(0,0,0,.6)">${esc(s)}</div>`;
    }
    const others = it.filter((x, i) => i !== fi);
    const before = others.filter((x) => x.t0 < main.t0 && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    const after = others.filter((x) => x.t0 > main.t0 && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    const small = (s2, y) => { if (!s2) return ""; const f2 = famOf(s2), z2 = fitSize(s2, `500 {}px ${f2}`, w * 0.8, mn * 0.05 * this.ts);
      return `<div dir="${this.dir(s2)}" style="position:absolute;left:0;right:0;top:${y.toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:500 ${z2.toFixed(1)}px ${f2};color:rgba(255,255,255,.85)">${esc(s2)}</div>`; };
    return html + small(before, cy - z * 0.95) + small(after, cy + z * 0.95);
  };

  // ---------- phone: موبايل والكلام على شاشته
  P.k_phone = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const src = imgOf(b);
    if (src) this._want = src;
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : -1;
    const phh = Math.min(h * 0.78, w * 1.25), pw = phh * 0.49;
    const r = this.freeRect(b);
    const cx = this.blockSolid(b) && r.side !== "center" && r.w > pw * 0.9 ? r.x + r.w / 2 : w / 2;
    const cy = h / 2;
    const p = eOut(seg(t, b.t0, b.t0 + 0.4));
    const rot = (bi % 2 ? 1 : -1) * lerp(14, 4, p);
    const sz = pw * 0.125;
    const lines = this.wrapItems(it, `800 ${sz}px ${ff}`, pw * 0.76);
    const acc = th.accent || RED;
    const bez = pw * 0.035;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#2B2F3A,#0E0F13 80%)"></div>`;
    html += `<div style="position:absolute;left:${(cx - pw / 2).toFixed(1)}px;top:${(cy - phh / 2).toFixed(1)}px;width:${pw.toFixed(1)}px;height:${phh.toFixed(1)}px;box-sizing:border-box;border-radius:${(pw * 0.16).toFixed(0)}px;background:#0A0A0B;padding:${bez.toFixed(1)}px;
      transform:translateY(${((1 - p) * h * 0.4).toFixed(1)}px) rotate(${rot.toFixed(2)}deg);box-shadow:0 0 0 ${(pw * 0.012).toFixed(1)}px #3A3A3E,0 ${(mn * 0.04).toFixed(0)}px ${(mn * 0.1).toFixed(0)}px rgba(0,0,0,.5)">
      <div style="position:relative;width:100%;height:100%;border-radius:${(pw * 0.13).toFixed(0)}px;overflow:hidden;background:${src ? `url(${src}) center/cover` : "linear-gradient(170deg,#3D8BFF,#B57BFF)"}">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.05) 30%,rgba(0,0,0,.65))"></div>
        <div dir="ltr" style="position:absolute;left:${(pw * 0.08).toFixed(0)}px;right:${(pw * 0.08).toFixed(0)}px;top:${(pw * 0.04).toFixed(0)}px;display:flex;justify-content:space-between;font:700 ${(pw * 0.045).toFixed(1)}px 'TY Outfit';color:#fff"><span>9:41</span><span>●●● ▮</span></div>
        <i style="position:absolute;left:50%;top:${(pw * 0.03).toFixed(0)}px;width:${(pw * 0.3).toFixed(0)}px;height:${(pw * 0.075).toFixed(0)}px;border-radius:999px;background:#000;transform:translateX(-50%)"></i>
        <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(pw * 0.08).toFixed(0)}px;right:${(pw * 0.16).toFixed(0)}px;bottom:${(phh * 0.12).toFixed(0)}px">
          ${lines.map((ln) => `<div style="white-space:nowrap;font:800 ${sz.toFixed(1)}px ${ff};line-height:1.12;color:#fff;letter-spacing:-0.02em;text-shadow:0 2px 10px rgba(0,0,0,.5)">${ln.map((x) => {
            const e = eOut(seg(t, x.t0, x.t0 + 0.22)), hot = it.indexOf(x) === fi;
            return `<span style="display:inline-block;opacity:${e.toFixed(3)};transform:translateY(${((1 - e) * sz * 0.3).toFixed(1)}px);${hot ? `background:${acc};padding:0 ${(sz * 0.12).toFixed(1)}px;border-radius:${(sz * 0.12).toFixed(1)}px` : ""}">${esc(this.text(x.w))}</span>`;
          }).join(" ")}</div>`).join("")}</div>
        <div style="position:absolute;${ar ? "left" : "right"}:${(pw * 0.04).toFixed(0)}px;bottom:${(phh * 0.14).toFixed(0)}px;display:flex;flex-direction:column;gap:${(pw * 0.05).toFixed(0)}px;align-items:center;font-size:${(pw * 0.075).toFixed(0)}px;color:#fff;font-family:'Noto Color Emoji',sans-serif">
          <span>🤍</span><span>💬</span><span>↗️</span></div></div></div>`;
    return html;
  };

  // =====================================================================
  // 🎞️ ترانزيشنز أول البلوك (b.trans): بتتعمل بعد fitFrame عشان القياس مايتلخبطش بالزووم والإزاحة
  //   whip سحبة سريعة بموشن بلير · zoom زووم داخل · glitch جلتش ألوان · flash فلاش أبيض · iris دايرة بتفتح
  //   leak تسريب نور برتقاني · burn حرق فيلم · rise طالع من تحت
  // =====================================================================
  const TRANS_DUR = { whip: 0.28, zoom: 0.32, glitch: 0.3, flash: 0.25, iris: 0.4, leak: 0.7, burn: 0.6, rise: 0.35, wipe: 0.45, blur: 0.4, pop: 0.35 };
  P.applyTrans = function (b, t, bi) {
    const tr = b?.trans;
    if (!tr || !TRANS_DUR[tr]) return;
    const d = TRANS_DUR[tr], q = (t - b.t0) / d;
    if (q >= 1 || q < 0) return;
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const e = eOut(q), inv = 1 - e;
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:absolute;inset:0";
    let over = "";
    const dir = bi % 2 ? -1 : 1;
    if (tr === "whip") { wrap.style.transform = `translateX(${(dir * inv * w * 0.7).toFixed(1)}px) skewX(${(dir * -inv * 18).toFixed(1)}deg)`; wrap.style.filter = `blur(${(inv * mn * 0.025).toFixed(1)}px)`; }
    else if (tr === "zoom") { wrap.style.transform = `scale(${lerp(1.7, 1, e).toFixed(4)})`; wrap.style.filter = `blur(${(inv * mn * 0.02).toFixed(1)}px)`; wrap.style.opacity = clamp(q * 3).toFixed(3); }
    else if (tr === "rise") { wrap.style.transform = `translateY(${(inv * h * 0.18).toFixed(1)}px)`; wrap.style.opacity = clamp(q * 2.5).toFixed(3); wrap.style.filter = `blur(${(inv * mn * 0.012).toFixed(1)}px)`; }
    else if (tr === "wipe") {
      // لوح لون بيعدّي الكادر ويكشف اللقطة الجديدة وراه
      const c = ["#F2602A", "#2F7CF6", "#151515"][bi % 3];
      const px = lerp(-1.05, 1.05, eOut(q));
      over = `<div style="position:absolute;top:0;bottom:0;left:0;width:100%;background:${c};transform:translateX(${(px * w).toFixed(1)}px)"></div>`;
      wrap.style.clipPath = `inset(0 ${(clamp(1 - px) * 100).toFixed(1)}% 0 0)`;
    }
    else if (tr === "blur") { wrap.style.filter = `blur(${(inv * mn * 0.04).toFixed(1)}px)`; wrap.style.opacity = clamp(q * 1.6).toFixed(3); }
    else if (tr === "pop") { wrap.style.transform = `scale(${lerp(0.82, 1, eBack(q)).toFixed(4)})`; wrap.style.clipPath = `inset(${(inv * 8).toFixed(2)}% round ${(inv * mn * 0.05).toFixed(0)}px)`; }
    else if (tr === "iris") { const R = Math.hypot(w, h) * 0.55 * eOut(q); wrap.style.clipPath = `circle(${R.toFixed(1)}px at 50% 50%)`; }
    else if (tr === "glitch") {
      const rr = rng(Math.floor(t * 30) + bi * 7);
      const j = (rr() - 0.5) * mn * 0.06 * inv;
      wrap.style.transform = `translateX(${j.toFixed(1)}px)`;
      wrap.style.filter = `drop-shadow(${(mn * 0.012 * inv).toFixed(1)}px 0 0 rgba(255,0,60,.85)) drop-shadow(${(-mn * 0.012 * inv).toFixed(1)}px 0 0 rgba(0,200,255,.85))`;
      for (let k2 = 0; k2 < 5; k2++) if (rr() < inv) over += `<i style="position:absolute;left:0;right:0;top:${(rr() * h).toFixed(0)}px;height:${(rr() * mn * 0.03 + 2).toFixed(0)}px;background:rgba(${rr() < 0.5 ? "255,0,80" : "0,220,255"},.35);transform:translateX(${((rr() - 0.5) * w * 0.2).toFixed(0)}px)"></i>`;
    } else if (tr === "flash") { over = `<div style="position:absolute;inset:0;background:#fff;opacity:${(inv * 0.9).toFixed(3)}"></div>`; wrap.style.transform = `scale(${lerp(1.08, 1, e).toFixed(4)})`; }
    else if (tr === "leak") {
      const a = Math.sin(q * Math.PI);
      over = `<div style="position:absolute;inset:0;mix-blend-mode:screen;opacity:${(a * 0.85).toFixed(3)};background:radial-gradient(ellipse ${(w * 0.7).toFixed(0)}px ${(h * 0.6).toFixed(0)}px at ${lerp(-10, 110, q).toFixed(0)}% 30%,rgba(255,140,40,.95),rgba(255,60,90,.5) 45%,transparent 70%),
        radial-gradient(ellipse ${(w * 0.5).toFixed(0)}px ${(h * 0.4).toFixed(0)}px at ${lerp(110, 20, q).toFixed(0)}% 80%,rgba(255,210,120,.8),transparent 70%)"></div>`;
      wrap.style.opacity = clamp(q * 2).toFixed(3);
    } else if (tr === "burn") {
      const a = Math.sin(q * Math.PI), fl = 0.8 + 0.2 * Math.sin(t * 50);
      over = `<div style="position:absolute;inset:0;mix-blend-mode:screen;opacity:${(a * fl).toFixed(3)};background:radial-gradient(ellipse ${(w * 0.9).toFixed(0)}px ${(h * 0.7).toFixed(0)}px at ${dir > 0 ? "0%" : "100%"} 0%,#FFF2C8,#FF9A2E 30%,#C2240E 55%,transparent 75%)"></div>`;
      wrap.style.filter = `sepia(${(a * 0.6).toFixed(2)}) brightness(${(1 + a * 0.4).toFixed(2)})`;
    }
    while (this.stage.firstChild) wrap.appendChild(this.stage.firstChild);
    this.stage.appendChild(wrap);
    if (over) this.stage.insertAdjacentHTML("beforeend", over);
  };

  // =====================================================================
  // الدفعة 10 (فيديوهات الأرشيف: إعلانات منتجات بستايل واجهات وإديتوريال):
  //   window    الفيديو بيصغر جوه برواز بعلامات أركان على ورق فاتح، وكلام كبير جنبه
  //   inline    كلام كبير وصورة صغيرة من الفيديو جوه السطر نفسه
  //   bigtype   كلمة عملاقة بتتكتب حرف حرف بمؤشر عريض ملوّن، ورقم فصل صغير
  //   checks    لستة بتتعلّم ✓ واحدة واحدة
  //   progress  شرايط بتتملا بنسب
  //   flow      خطوات أوتوميشن: بداية ← خطوة ← نتيجة بخطوط بتوصل بينهم
  //   aura      خلفية ألوان ناعمة بتتحرك وكلام صغير في النص
  //   stairs    كلمات في مربعات بيضا نازلة زي السلم وقبل كل واحدة رمز
  //   dates     شريط أيام/أرقام والرقم المهم عليه دايرة
  //   endcard   كارت النهاية: علامة وكلمة كبيرة وجملة في كبسولة
  // =====================================================================
  const PAPER = "#EFEDE8", INK = "#151515", ORG = "#F2602A";
  // البرواز اللي الفيديو بيبان منه (أو صورة من الفيديو لو مفيش فيديو ورا)
  P.k_window = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const tall = h > w;
    const box = this.personAt((b.t0 + b.t1) / 2)?.st?.box;
    // البرواز: حوالين الشخص لو باين، وإلا ناحية
    let R;
    if (tall) R = { x: w * 0.12, y: h * 0.1, w: w * 0.76, h: h * 0.42 };
    else R = { x: w * 0.5, y: h * 0.18, w: w * 0.42, h: h * 0.64 };
    if (box && !tall) { const cx = (box[0] + box[2]) / 2; if (cx < w / 2) R.x = w * 0.06; }
    const textLeft = !tall && R.x > w * 0.3;
    const e = eOut(seg(t, b.t0, b.t0 + 0.6));
    const cur = { x: lerp(0, R.x, e), y: lerp(0, R.y, e), w: lerp(w, R.w, e), h: lerp(h, R.h, e) };
    const vid = onVideo(this);
    const src = imgOf(b);
    if (src) this._want = src;
    let html = vid ? `<div style="position:absolute;left:${cur.x.toFixed(1)}px;top:${cur.y.toFixed(1)}px;width:${cur.w.toFixed(1)}px;height:${cur.h.toFixed(1)}px;box-shadow:0 0 0 ${(Math.max(w, h) * 2).toFixed(0)}px ${PAPER}"></div>`
      : `<div style="position:absolute;inset:0;background:${PAPER}"></div><div style="position:absolute;left:${cur.x.toFixed(1)}px;top:${cur.y.toFixed(1)}px;width:${cur.w.toFixed(1)}px;height:${cur.h.toFixed(1)}px;background:${src ? `url(${src}) center/cover` : "linear-gradient(160deg,#9AA3B5,#4B5468)"}"></div>`;
    // علامات الأركان والنقط
    const L = mn * 0.03, lw = Math.max(1.5, mn * 0.003), o = mn * 0.012, ka = seg(t, b.t0 + 0.4, b.t0 + 0.7);
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([cx, cy]) => {
      const x = cur.x + cx * cur.w + (cx ? o : -o), y = cur.y + cy * cur.h + (cy ? o : -o);
      html += `<i style="position:absolute;left:${(x - (cx ? L : 0)).toFixed(1)}px;top:${(y - (cy ? L : 0)).toFixed(1)}px;width:${L.toFixed(1)}px;height:${L.toFixed(1)}px;opacity:${ka.toFixed(2)};
        border-${cx ? "right" : "left"}:${lw.toFixed(1)}px solid ${INK};border-${cy ? "bottom" : "top"}:${lw.toFixed(1)}px solid ${INK}"></i>`;
    });
    html += `<div dir="ltr" style="position:absolute;left:${(R.x).toFixed(0)}px;top:${(R.y + R.h + o * 2.5).toFixed(0)}px;font:400 ${(mn * 0.022).toFixed(1)}px 'TY Pixel',monospace;color:${INK};opacity:${(ka * 0.7).toFixed(2)};letter-spacing:.1em">( ${String(bi + 1).padStart(2, "0")} )</div>`;
    // الكلام الكبير في الناحية الفاضية
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const area = tall ? { x: w * 0.1, y: R.y + R.h + mn * 0.12, w: w * 0.8, h: h * 0.36 } : textLeft ? { x: w * 0.06, y: h * 0.2, w: R.x - w * 0.1, h: h * 0.6 } : { x: R.x + R.w + w * 0.04, y: h * 0.2, w: w - (R.x + R.w) - w * 0.1, h: h * 0.6 };
    let sz = mn * (tall ? 0.11 : 0.12);
    let lines = this.wrapItems(it, `600 ${sz}px ${ff}`, area.w);
    for (let q = 0; q < 6 && lines.length * sz * 1.02 > area.h; q++) { sz *= 0.88; lines = this.wrapItems(it, `600 ${sz}px ${ff}`, area.w); }
    const y0 = area.y + Math.max(0, (area.h - lines.length * sz * 1.02) / 2);
    lines.forEach((ln, li) => {
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${area.x.toFixed(1)}px;width:${area.w.toFixed(1)}px;top:${(y0 + li * sz * 1.02).toFixed(1)}px;text-align:${ar ? "right" : "left"};white-space:nowrap;font:600 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.045em;line-height:1;color:${INK}">${ln.map((x) => {
        const q = eOut(seg(t, x.t0, x.t0 + 0.3));
        return `<span style="display:inline-block;opacity:${q.toFixed(3)};transform:translateY(${((1 - q) * sz * 0.35).toFixed(1)}px)">${esc(this.text(x.w))}</span>`;
      }).join(" ")}</div>`;
    });
    return html;
  };

  // ---------- inline: صورة صغيرة جوه السطر
  P.k_inline = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const src = imgOf(b);
    if (src) this._want = src;
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : -1;
    const at = Math.min(it.length - 1, Math.max(0, Math.floor(it.length / 2) - 1));
    let sz = mn * 0.13;
    const chipW = sz * 1.25;
    const fake = it.map((x, i) => (i === at ? { ...x, w: x.w + " WWW" } : x));
    let lines = this.wrapItems(fake, `600 ${sz}px ${ff}`, w * 0.84);
    for (let q = 0; q < 6 && lines.length * sz > h * 0.6; q++) { sz *= 0.88; lines = this.wrapItems(fake, `600 ${sz}px ${ff}`, w * 0.84); }
    const y0 = h / 2 - (lines.length * sz * 0.98) / 2;
    let html = `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    lines.forEach((ln, li) => {
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(w * 0.08).toFixed(0)}px;right:${(w * 0.08).toFixed(0)}px;top:${(y0 + li * sz * 0.98).toFixed(1)}px;white-space:nowrap;text-align:${li % 2 ? (ar ? "left" : "right") : (ar ? "right" : "left")};
        font:600 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.05em;line-height:1;color:${INK}">${ln.map((x) => {
        const i = fake.indexOf(x), real = it[i];
        const q = eOut(seg(t, real.t0, real.t0 + 0.28));
        let s = `<span style="display:inline-block;opacity:${q.toFixed(3)};transform:translateY(${((1 - q) * sz * 0.3).toFixed(1)}px);${i === fi ? `color:${ORG}` : ""}">${esc(this.text(real.w))}</span>`;
        if (i === at) {
          const c = eBack(seg(t, real.t0 + 0.1, real.t0 + 0.4));
          s += ` <span style="display:inline-block;width:${(chipW * c).toFixed(1)}px;height:${(sz * 0.78).toFixed(1)}px;vertical-align:-0.06em;border-radius:${(sz * 0.12).toFixed(1)}px;overflow:hidden;
            background:${src ? `url(${src}) center/cover` : `linear-gradient(160deg,${ORG},#7B4DFF)`};box-shadow:0 ${(sz * 0.05).toFixed(1)}px ${(sz * 0.15).toFixed(1)}px rgba(0,0,0,.2)"></span>`;
        }
        return s;
      }).join(" ")}</div>`;
    });
    return html;
  };

  // ---------- bigtype: كلمة عملاقة بتتكتب بمؤشر عريض
  P.k_bigtype = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const vid = onVideo(this);
    const ink = vid ? "#fff" : INK, acc = accentOf(th, bi, [ORG, "#2F7CF6", "#3BD24A"]);
    const num = it[0].w.match(/^[0-9٠-٩]{1,2}$/) ? this.text(it[0].w) : String(bi + 1).padStart(2, "0");
    const words = it[0].w.match(/^[0-9٠-٩]{1,2}$/) ? it.slice(1) : it;
    const full = words.map((x) => this.text(x.w)).join(" ");
    const ff = famOf(full);
    const sz = fitSize(full, `500 {}px ${ff}`, w * 0.84, mn * 0.36);
    const shown = words.filter((x) => t >= x.t0).map((x, i, a) => (i === a.length - 1 ? typed(this.text(x.w), t, x.t0, 14) : this.text(x.w))).join(" ");
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.52;
    const blink = Math.floor(t * 2.4) % 2 || shown.length < full.length;
    let html = vid ? "" : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    html += `<div dir="ltr" style="position:absolute;left:${(w * 0.08).toFixed(0)}px;top:${(cy - sz * 0.95).toFixed(1)}px;font:500 ${(sz * 0.32).toFixed(1)}px 'TY Outfit';letter-spacing:-0.04em;color:${ink};opacity:${seg(t, b.t0, b.t0 + 0.3).toFixed(2)}">${esc(num)}</div>
      <div dir="${this.dir(full)}" style="position:absolute;left:0;right:0;top:${cy.toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:500 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.06em;line-height:1;color:${ink};${shadow(this)}">${esc(shown)}<span style="display:inline-block;width:${(sz * 0.07).toFixed(1)}px;height:${(sz * 0.9).toFixed(1)}px;background:${acc};vertical-align:-0.08em;margin:0 ${(sz * 0.05).toFixed(1)}px;opacity:${blink ? 1 : 0}"></span></div>`;
    return html;
  };

  // كارت أبيض للعناصر اللي فوق الفيديو
  const card = (x, y, cw, chh, mn, inner, extra = "") => `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;${chh ? `height:${chh.toFixed(1)}px;` : ""}box-sizing:border-box;background:rgba(255,255,255,.96);border-radius:${(mn * 0.03).toFixed(0)}px;
    box-shadow:0 ${(mn * 0.015).toFixed(0)}px ${(mn * 0.05).toFixed(0)}px rgba(0,0,0,.18);padding:${(mn * 0.04).toFixed(0)}px;${extra}">${inner}</div>`;

  // ---------- checks: لستة بتتعلّم
  P.k_checks = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(5, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it);
    const r = this.freeRect(b);
    const sz = mn * 0.05 * this.ts;
    const row = sz * 1.55;
    const acc = accentOf(th, bi, ["#16A34A", "#2F7CF6", ORG]);
    const shown = cs.filter((c) => t >= c.t0);
    const maxN = Math.max(1, Math.floor(Math.min(r.h, h * 0.5) / row));
    const vis = shown.slice(-maxN);
    const cw = Math.min(r.w, w * 0.84);
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    const inner = vis.map((c) => {
      const s = this.text(c.w), ff = famOf(s);
      const ck = seg(t, c.t0 + 0.15, c.t0 + 0.45), a = eOut(seg(t, c.t0, c.t0 + 0.25));
      const z = fitSize(s, `500 {}px ${ff}`, cw - sz * 3.4, sz);
      return `<div dir="${ar ? "rtl" : "ltr"}" style="display:flex;align-items:center;gap:${(sz * 0.5).toFixed(1)}px;height:${row.toFixed(1)}px;opacity:${a.toFixed(3)};transform:translateY(${((1 - a) * sz * 0.5).toFixed(1)}px)">
        <svg width="${(sz * 1.15).toFixed(0)}" height="${(sz * 1.15).toFixed(0)}" viewBox="0 0 24 24" style="flex:none"><circle cx="12" cy="12" r="10" fill="${ck >= 1 ? acc : "none"}" stroke="${ck > 0 ? acc : "#B4B4BC"}" stroke-width="2"/>
          <path d="M7 12.5l3.3 3.2L17 9" fill="none" stroke="${ck >= 1 ? "#fff" : acc}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16" stroke-dashoffset="${(16 * (1 - ck)).toFixed(1)}"/></svg>
        <span style="white-space:nowrap;font:500 ${z.toFixed(1)}px ${ff};letter-spacing:-0.02em;color:${ck >= 1 ? INK : "#8A8A92"}">${esc(s)}</span></div>`;
    }).join("");
    const chh = vis.length * row + mn * 0.08;
    html += card(r.x + (r.w - cw) / 2, r.y + Math.max(0, (r.h - chh) / 2), cw, 0, mn, inner);
    return html;
  };

  // ---------- progress: شرايط بتتملا
  P.k_progress = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it);
    const r = this.freeRect(b);
    const sz = mn * 0.042 * this.ts;
    const cw = Math.min(r.w, w * 0.84);
    const cols = [["#DDF6C8", "#2E7D32"], ["#FCE7A8", "#8A6100"], ["#D6E6FF", "#1E5FE0"], ["#FFD9CC", "#B83A0E"]];
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    const inner = cs.map((c, i) => {
      if (t < c.t0) return "";
      const s = this.text(c.w), ff = famOf(s);
      const m = c.w.match(/[0-9٠-٩]+/);
      const pct = m ? clamp(parseInt(m[0].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10), 5, 100) : 62 + ((i * 17 + bi * 11) % 34);
      const f = eOut(seg(t, c.t0 + 0.1, c.t0 + 0.8));
      const [pb, pf] = cols[(i + bi) % cols.length];
      const z = fitSize(s, `500 {}px ${ff}`, cw * 0.62, sz);
      return `<div dir="${ar ? "rtl" : "ltr"}" style="margin-bottom:${(sz * 0.9).toFixed(1)}px;opacity:${eOut(seg(t, c.t0, c.t0 + 0.2)).toFixed(3)}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${(sz * 0.35).toFixed(1)}px"><span style="white-space:nowrap;font:500 ${z.toFixed(1)}px ${ff};color:${INK}">${esc(s)}</span>
          <span dir="ltr" style="font:600 ${(sz * 0.85).toFixed(1)}px 'TY Outfit';background:${pb};color:${pf};padding:${(sz * 0.12).toFixed(1)}px ${(sz * 0.4).toFixed(1)}px;border-radius:${(sz * 0.25).toFixed(1)}px">${Math.round(pct * f)}%</span></div>
        <div style="height:${(sz * 0.32).toFixed(1)}px;border-radius:${sz.toFixed(0)}px;background:#E6E6EA;overflow:hidden"><i style="display:block;height:100%;width:${(pct * f).toFixed(1)}%;background:${INK};border-radius:${sz.toFixed(0)}px;${ar ? "margin-left:auto" : ""}"></i></div></div>`;
    }).join("");
    const chh = cs.length * sz * 2.6;
    html += card(r.x + (r.w - cw) / 2, r.y + Math.max(0, (r.h - chh) / 2), cw, 0, mn, inner);
    return html;
  };

  // ---------- flow: خطوات أوتوميشن
  P.k_flow = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(3, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it);
    const r = this.freeRect(b);
    const sz = mn * 0.04 * this.ts;
    const nw = Math.min(r.w, w * 0.78), nh = sz * 3.1, gap = sz * 1.8;
    const total = cs.length * nh + (cs.length - 1) * gap;
    const x = r.x + (r.w - nw) / 2, y0 = r.y + Math.max(0, (r.h - total) / 2);
    const labs = ar ? ["البداية", "الخطوة", "النتيجة"] : ["TRIGGER", "ACTION", "RESULT"];
    const icons = ["⚡", "▶", "✓"];
    const acc = accentOf(th, bi, ["#16A34A", ORG, "#7B4DFF"]);
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    let svg = "";
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const y = y0 + i * (nh + gap);
      const a = eBack(seg(t, c.t0, c.t0 + 0.3));
      if (i > 0) {
        const q = seg(t, c.t0 - 0.15, c.t0 + 0.15), ya = y - gap, len = gap;
        svg += `<path d="M${(x + nw / 2).toFixed(1)} ${ya.toFixed(1)} L${(x + nw / 2).toFixed(1)} ${(ya + len * q).toFixed(1)}" stroke="#9A9AA2" stroke-width="${Math.max(1.5, mn * 0.003).toFixed(1)}"/>
          <circle cx="${(x + nw / 2).toFixed(1)}" cy="${(ya + len * q).toFixed(1)}" r="${(mn * 0.007).toFixed(1)}" fill="#9A9AA2"/>`;
      }
      const s = this.text(c.w), ff = famOf(s);
      const z = fitSize(s, `600 {}px ${ff}`, nw - sz * 4, sz * 1.05);
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${nw.toFixed(1)}px;height:${nh.toFixed(1)}px;box-sizing:border-box;transform:scale(${a.toFixed(3)});
        background:#fff;border:1px solid #E2E2E6;border-${ar ? "right" : "left"}:${(sz * 0.18).toFixed(1)}px solid ${acc};border-radius:${(sz * 0.4).toFixed(1)}px;box-shadow:0 ${(sz * 0.2).toFixed(1)}px ${(sz * 0.6).toFixed(1)}px rgba(0,0,0,.12);
        display:flex;align-items:center;gap:${(sz * 0.6).toFixed(1)}px;padding:0 ${(sz * 0.7).toFixed(1)}px">
        <span style="flex:none;width:${(sz * 1.6).toFixed(0)}px;height:${(sz * 1.6).toFixed(0)}px;border-radius:${(sz * 0.4).toFixed(0)}px;background:${acc}22;color:${acc};display:flex;align-items:center;justify-content:center;font:700 ${(sz * 0.8).toFixed(0)}px 'TY Outfit'">${icons[Math.min(2, i)]}</span>
        <span style="min-width:0"><span style="display:block;font:600 ${(sz * 0.55).toFixed(1)}px ${famOf(labs[0])};letter-spacing:.12em;color:#8A8A92">${labs[i === cs.length - 1 && i > 0 ? 2 : Math.min(1, i)]}</span>
        <span style="display:block;white-space:nowrap;font:600 ${z.toFixed(1)}px ${ff};color:${INK}">${esc(s)}</span></span></div>`;
    });
    return html + `<svg data-free width="${w}" height="${h}" style="position:absolute;inset:0;overflow:visible">${svg}</svg>`;
  };

  // ---------- aura: خلفية ألوان ناعمة بتتحرك
  const AURA = [["#FF8A3D", "#FF5FA2", "#B9A6FF", "#FFE3C8"], ["#7FB8FF", "#9AF0D2", "#C9B6FF", "#EAF4FF"], ["#B5E86A", "#FFD36A", "#7FD1B0", "#F3F8E6"]];
  P.k_aura = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const [c1, c2, c3, base] = AURA[bi % AURA.length];
    const u = t - b.t0;
    const blob = (c, x, y, r) => `radial-gradient(circle ${(r * mn).toFixed(0)}px at ${x.toFixed(1)}% ${y.toFixed(1)}%,${c},transparent 70%)`;
    const bgI = [blob(c1, 30 + Math.sin(u * 0.7) * 18, 70 + Math.cos(u * 0.5) * 10, 0.9), blob(c2, 75 + Math.cos(u * 0.6) * 15, 35 + Math.sin(u * 0.8) * 12, 0.8), blob(c3, 50 + Math.sin(u * 0.9) * 20, 55, 0.7)].join(",");
    const a = eOut(seg(t, b.t0, b.t0 + 0.5));
    let html = `<div style="position:absolute;inset:0;background:${bgI},${base};opacity:${a.toFixed(3)};filter:blur(${(mn * 0.02).toFixed(0)}px)"></div>`;
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.045 * this.ts;
    const lines = this.wrapItems(it, `500 ${sz}px ${ff}`, w * 0.7);
    const y0 = h / 2 - (lines.length - 1) * sz * 0.65;
    lines.forEach((ln, li) => {
      html += lineHtml(this, ln, sz, ff, "#1E1E22", y0 + li * sz * 1.3, "font-weight:500;letter-spacing:-0.01em", (x) => {
        const q = eOut(seg(t, x.t0, x.t0 + 0.4));
        return `<span style="display:inline-block;opacity:${q.toFixed(3)};filter:blur(${((1 - q) * sz * 0.25).toFixed(1)}px)">${esc(this.text(x.w))}</span>`;
      });
    });
    return html;
  };

  // ---------- stairs: كلمات في مربعات نازلة زي السلم
  // رموز مرسومة (مش حروف، عشان الخط مش لازم يكون فيه الرمز)
  const STAIR_ICONS = ['<path d="M3 12h15M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    '<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    '<path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" fill="currentColor"/>'];
  P.k_stairs = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, it.length)));
    const ar = isAr(it);
    const r = this.freeRect(b);
    const sz = mn * 0.075 * this.ts;
    const step = sz * 1.7;
    const total = cs.length * step;
    const y0 = r.y + Math.max(0, (r.h - total) / 2);
    const dx = Math.min(sz * 1.2, (r.w * 0.4) / Math.max(1, cs.length - 1));
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const s = this.text(c.w), ff = famOf(s);
      const z = fitSize(s, `500 {}px ${ff}`, r.w * 0.7, sz);
      const a = eOut(seg(t, c.t0, c.t0 + 0.25));
      const off = r.x + r.w * 0.08 + i * dx;
      const pos = ar ? `right:${(w - (r.x + r.w) + r.w * 0.08 + i * dx).toFixed(1)}px` : `left:${off.toFixed(1)}px`;
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${pos};top:${(y0 + i * step).toFixed(1)}px;display:flex;align-items:center;gap:${(z * 0.25).toFixed(1)}px;opacity:${a.toFixed(3)};transform:translateY(${((1 - a) * z * 0.4).toFixed(1)}px)">
        <svg width="${(z * 0.62).toFixed(0)}" height="${(z * 0.62).toFixed(0)}" viewBox="0 0 24 24" style="flex:none;color:${onVideo(this) ? "#fff" : INK};${ar ? "transform:scaleX(-1)" : ""}">${STAIR_ICONS[(i + bi) % STAIR_ICONS.length]}</svg>
        <span style="white-space:nowrap;background:#fff;color:${INK};font:500 ${z.toFixed(1)}px ${ff};letter-spacing:-0.04em;line-height:1.05;padding:${(z * 0.08).toFixed(1)}px ${(z * 0.18).toFixed(1)}px;box-shadow:0 ${(z * 0.05).toFixed(1)}px ${(z * 0.15).toFixed(1)}px rgba(0,0,0,.12)">${esc(s)}</span></div>`;
    });
    return html;
  };

  // ---------- dates: شريط أيام والرقم المهم عليه دايرة
  P.k_dates = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ni = it.findIndex((x) => /[0-9٠-٩]/.test(x.w));
    const n0 = ni >= 0 ? parseInt(it[ni].w.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^0-9]/g, ""), 10) : 12 + (bi % 15);
    const vid = onVideo(this), ink = vid ? "#fff" : INK;
    const sz = mn * 0.13;
    const gapX = sz * 1.15 * (String(n0).length > 2 ? 2.1 : 1);
    const cy = this.blockSolid(b) ? Math.min(h * 0.82, this.belowHead(b, sz) + sz * 0.6) : h * 0.55;
    const slide = (1 - eOut(seg(t, b.t0, b.t0 + 0.7))) * gapX * 3;
    let html = vid ? `<div style="position:absolute;left:0;right:0;top:${(cy - sz * 0.9).toFixed(0)}px;height:${(sz * 1.8).toFixed(0)}px;background:linear-gradient(transparent,rgba(0,0,0,.35),transparent)"></div>` : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    for (let q = -6; q <= 6; q++) {
      const x = w / 2 + q * gapX + slide;
      if (x < -gapX || x > w + gapX) continue;
      const d = Math.abs(x - w / 2) / gapX;
      html += `<div dir="ltr" style="position:absolute;left:${x.toFixed(1)}px;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%);font:500 ${sz.toFixed(1)}px 'TY Outfit';letter-spacing:-0.04em;color:${ink};opacity:${clamp(1 - d * 0.18, 0.15, 1).toFixed(3)};${shadow(this)}">${n0 + q}</div>`;
    }
    const ring = seg(t, b.t0 + 0.6, b.t0 + 1.0);
    const R = sz * (String(n0).length > 2 ? 1.25 : 0.75);
    const L = 2 * Math.PI * R;
    html += `<svg data-free width="${w}" height="${h}" style="position:absolute;inset:0;overflow:visible"><ellipse cx="${(w / 2).toFixed(1)}" cy="${cy.toFixed(1)}" rx="${R.toFixed(1)}" ry="${(sz * 0.75).toFixed(1)}" fill="none" stroke="${ink}" stroke-width="${Math.max(2, mn * 0.004).toFixed(1)}"
      stroke-dasharray="${L.toFixed(0)}" stroke-dashoffset="${(L * (1 - ring)).toFixed(1)}" transform="rotate(-90 ${(w / 2).toFixed(1)} ${cy.toFixed(1)})"/></svg>`;
    const rest = it.filter((x, i) => i !== ni && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (rest) { const f2 = famOf(rest), z = fitSize(rest, `500 {}px ${f2}`, w * 0.84, mn * 0.05 * this.ts);
      html += `<div dir="${this.dir(rest)}" style="position:absolute;left:0;right:0;top:${(cy - sz * 1.3).toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:500 ${z.toFixed(1)}px ${f2};color:${ink};${shadow(this)}">${esc(rest)}</div>`; }
    return html;
  };

  // ---------- endcard: كارت النهاية
  P.k_endcard = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : 0;
    const main = this.text(it[fi].w), rest = it.filter((x, i) => i !== fi);
    // كارت فاتح أو كارت أزرق بكلام أبيض (زي المرجع)
    const solid = bi % 2 === 1, ecInk = solid ? "#fff" : INK;
    const solidC = ["#3B4BE8", ORG][Math.floor(bi / 2) % 2];
    const acc = solid ? "#FFFFFF" : accentOf(th, bi, [ORG, "#2F7CF6", "#16A34A"]);
    const ff = famOf(main);
    const sz = fitSize(main, `700 {}px ${ff}`, w * 0.6, mn * 0.11);
    const a = eOut(seg(t, b.t0, b.t0 + 0.5));
    const m = sz * 0.95;
    // العلامة: دايرة بخطوط زي الغروب
    const mark = `<svg width="${m.toFixed(0)}" height="${m.toFixed(0)}" viewBox="0 0 20 20"><defs><clipPath id="tyEc${bi}"><circle cx="10" cy="10" r="9.5"/></clipPath></defs><g clip-path="url(#tyEc${bi})"><rect width="20" height="20" fill="${acc}"/>
      ${[11.5, 14, 16.5].map((y) => `<rect x="0" y="${y}" width="20" height="1.1" fill="${solid ? solidC : PAPER}"/>`).join("")}</g></svg>`;
    let html = `<div style="position:absolute;inset:0;background:${solid ? solidC : PAPER}"></div>
      <div dir="${this.dir(main)}" style="position:absolute;left:0;right:0;top:${(h * 0.47).toFixed(1)}px;transform:translateY(-50%) scale(${lerp(0.92, 1, a).toFixed(3)});display:flex;justify-content:center;align-items:center;gap:${(sz * 0.2).toFixed(1)}px;opacity:${a.toFixed(3)}">
        ${mark}<span style="white-space:nowrap;font:700 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.04em;color:${ecInk}">${esc(main)}</span></div>`;
    if (rest.length && t >= rest[0].t0) {
      const s = rest.map((x) => this.text(x.w)).join(" "), f2 = famOf(s), z = fitSize(s, `500 {}px ${f2}`, w * 0.7, mn * 0.04 * this.ts);
      html += `<div style="position:absolute;left:0;right:0;top:${(h * 0.47 + sz * 1.1).toFixed(1)}px;text-align:center;opacity:${eOut(seg(t, rest[0].t0, rest[0].t0 + 0.3)).toFixed(3)}">
        <span dir="${this.dir(s)}" style="display:inline-block;white-space:nowrap;font:500 ${z.toFixed(1)}px ${f2};color:${ecInk};border:${Math.max(1.5, z * 0.06).toFixed(1)}px solid ${ecInk};border-radius:999px;padding:${(z * 0.2).toFixed(1)}px ${(z * 0.7).toFixed(1)}px">${esc(s)}</span></div>`;
    }
    return html;
  };

  // =====================================================================
  // فيديو مرجعي 1 (إعلان مساعد ذكي): اللي كان فايت
  //   wintitle  الفيديو في برواز وكلمة عملاقة راكبة على رجله (نصها جوه ونصها برّه)
  //   corners   خلفية ملونة والفيديو برواز صغير في النص، والكلام متقسم على ركنين عكس بعض
  //   inbox     صندوق رسايل: صف صف بصورة واسم وساعة وموضوع وتاجات
  //   doc       صفحة دوكيومنت مكبّرة والكلام بيتعلّم بالهايلايتر وهو بيتقال
  //   workcards كارت موعد في الكاليندر ورسالة فيها ملف
  //   call      مكالمة فيديو: الفيديو في مربع وجنبه مربعات بأسامي، والكلام ترجمة تحت
  //   canvas    كروت صغيرة كتير متفرقة على لوحة بيضا والكاميرا بتقرّب على الجديد
  // =====================================================================
  // فتحة في الورق يبان منها الفيديو (لو فيه فيديو ورا)، أو صورة من الفيديو/لون
  P.hole = function (b, R, col, radius = 0) {
    const src = imgOf(b);
    if (src) this._want = src;
    const r = radius ? `border-radius:${radius.toFixed(0)}px;` : "";
    return onVideo(this) ? `<div style="position:absolute;left:${R.x.toFixed(1)}px;top:${R.y.toFixed(1)}px;width:${R.w.toFixed(1)}px;height:${R.h.toFixed(1)}px;${r}box-shadow:0 0 0 ${(Math.max(this.doc.w, this.doc.h) * 2).toFixed(0)}px ${col}"></div>`
      : `<div style="position:absolute;inset:0;background:${col}"></div><div style="position:absolute;left:${R.x.toFixed(1)}px;top:${R.y.toFixed(1)}px;width:${R.w.toFixed(1)}px;height:${R.h.toFixed(1)}px;${r}background:${src ? `url(${src}) center/cover` : "linear-gradient(160deg,#9AA3B5,#4B5468)"}"></div>`;
  };
  const dotCorners = (R, sz, col, a = 1) => [[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy]) => `<i style="position:absolute;left:${(R.x + cx * R.w - sz / 2 + (cx ? sz : -sz)).toFixed(1)}px;top:${(R.y + cy * R.h - sz / 2 + (cy ? sz : -sz)).toFixed(1)}px;width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;background:${col};opacity:${a.toFixed(2)}"></i>`).join("");

  // ---------- wintitle
  P.k_wintitle = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const tall = h > w;
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : it.length - 1;
    const main = it[fi];
    const e = eOut(seg(t, b.t0, b.t0 + 0.6));
    const T = tall ? { x: w * 0.18, y: h * 0.2, w: w * 0.64, h: h * 0.36 } : { x: w * 0.3, y: h * 0.1, w: w * 0.4, h: h * 0.58 };
    const R = { x: lerp(0, T.x, e), y: lerp(0, T.y, e), w: lerp(w, T.w, e), h: lerp(h, T.h, e) };
    let html = this.hole(b, R, PAPER) + dotCorners(R, mn * 0.012, ORG, seg(t, b.t0 + 0.4, b.t0 + 0.7));
    const s = this.text(main.w), ff = famOf(s);
    const sz = fitSize(s, `600 {}px ${ff}`, w * 0.94, mn * 0.3);
    if (t >= main.t0) {
      const q = eOut(seg(t, main.t0, main.t0 + 0.35));
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${(T.y + T.h).toFixed(1)}px;transform:translateY(${lerp(-0.2, -0.42, q).toFixed(3) * 1}em);text-align:center;white-space:nowrap;
        font:600 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.06em;line-height:1;color:${INK};opacity:${q.toFixed(3)};clip-path:inset(${((1 - q) * 100).toFixed(1)}% 0 0 0)">${esc(s)}</div>`;
    }
    const rest = it.filter((x, i) => i !== fi && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (rest) { const f2 = famOf(rest), z = fitSize(rest, `500 {}px ${f2}`, w * 0.8, mn * 0.05 * this.ts);
      html += `<div dir="${this.dir(rest)}" style="position:absolute;left:0;right:0;top:${(T.y - z * 1.4).toFixed(1)}px;text-align:center;white-space:nowrap;font:500 ${z.toFixed(1)}px ${f2};color:${INK}">${esc(rest)}</div>`; }
    return html;
  };

  // ---------- corners
  P.k_corners = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const bg = ["#3B4BE8", ORG, "#151515"][bi % 3];
    const half = Math.max(1, Math.ceil(it.length / 2));
    const A = it.slice(0, half), B = it.slice(half);
    const e = eOut(seg(t, b.t0, b.t0 + 0.55));
    const T = h > w ? { x: w * 0.3, y: h * 0.38, w: w * 0.4, h: h * 0.24 } : { x: w * 0.4, y: h * 0.3, w: w * 0.2, h: h * 0.4 };
    const R = { x: lerp(0, T.x, e), y: lerp(0, T.y, e), w: lerp(w, T.w, e), h: lerp(h, T.h, e) };
    let html = this.hole(b, R, bg);
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.075 * this.ts;
    const put = (arr, top) => {
      if (!arr.length || t < arr[0].t0) return "";
      const lines = this.wrapItems(arr, `500 ${sz}px ${ff}`, w * 0.5);
      const side = top ? (ar ? "right" : "left") : (ar ? "left" : "right");
      return lines.map((ln, li) => `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${side}:${(w * 0.06).toFixed(0)}px;${top ? `top:${(h * 0.07 + li * sz * 1.02).toFixed(1)}px` : `bottom:${(h * 0.07 + (lines.length - 1 - li) * sz * 1.02).toFixed(1)}px`};white-space:nowrap;
        font:500 ${sz.toFixed(1)}px ${ff};letter-spacing:-0.04em;line-height:1;color:#fff">${ln.map((x) => { const q = eOut(seg(t, x.t0, x.t0 + 0.3));
          return `<span style="display:inline-block;opacity:${q.toFixed(3)};transform:translateY(${((1 - q) * sz * 0.4).toFixed(1)}px)">${esc(this.text(x.w))}</span>`; }).join(" ")}</div>`).join("");
    };
    // نقط صغيرة وكلام صغير زي المرجع
    const a2 = seg(t, b.t0 + 0.4, b.t0 + 0.8);
    html += `<div dir="ltr" style="position:absolute;left:${(w * 0.06).toFixed(0)}px;bottom:${(h * 0.04).toFixed(0)}px;font:400 ${(mn * 0.018).toFixed(1)}px 'TY Pixel',monospace;letter-spacing:.12em;color:#fff;opacity:${(a2 * 0.75).toFixed(2)}">A-SERIES · MOVE FASTER · ${String(bi + 1).padStart(2, "0")}</div>`;
    return html + put(A, true) + put(B, false);
  };

  // ---------- inbox
  const NAMES = { ar: ["مريم سامي", "عمر خالد", "نور حسن", "يوسف علي"], en: ["Maya Lee", "Omar Hart", "Nora Park", "Sam Brooks"] };
  const AVC = ["#F4A3A3", "#9EC5FF", "#B6E3A8", "#FFD08A"];
  P.k_inbox = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 3))));
    const ar = isAr(it), L = ar ? "ar" : "en", ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const sz = mn * 0.036 * this.ts;
    const rw = Math.min(r.w, w * 0.88), rh = sz * 4.6;
    const shown = cs.filter((c) => t >= c.t0).reverse();
    const lastE = shown.length ? eOut(seg(t, shown[0].t0, shown[0].t0 + 0.35)) : 1;
    const maxN = Math.max(1, Math.floor(Math.min(r.h, h * 0.7) / rh));
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#F6F6F4"></div>`;
    const x = r.x + (r.w - rw) / 2, top = r.y + Math.max(0, (r.h - Math.min(maxN, cs.length) * rh) / 2);
    const tags = ar ? [["محتاج رد", "#FFE1D6", "#B83A0E"], ["عميل", "#FFD6E2", "#C2185B"]] : [["Needs Attention", "#FFE1D6", "#B83A0E"], ["Client", "#FFD6E2", "#C2185B"]];
    shown.slice(0, maxN + 1).forEach((c, i) => {
      const idx = cs.indexOf(c);
      const y = top + lerp(i - 1, i, i === 0 ? 1 : lastE) * rh - (i === 0 ? (1 - lastE) * rh * 0.6 : 0);
      const a = i === 0 ? lastE : i >= maxN ? 1 - lastE : 1;
      const s = this.text(c.w), nm = NAMES[L][(idx + bi) % 4];
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${rw.toFixed(1)}px;height:${(rh - sz * 0.3).toFixed(1)}px;box-sizing:border-box;opacity:${a.toFixed(3)};
        background:#fff;border-radius:${(sz * 0.6).toFixed(1)}px;box-shadow:0 ${(sz * 0.15).toFixed(1)}px ${(sz * 0.6).toFixed(1)}px rgba(0,0,0,.1);display:flex;gap:${(sz * 0.6).toFixed(1)}px;padding:${(sz * 0.55).toFixed(1)}px ${(sz * 0.7).toFixed(1)}px">
        <span style="flex:none;width:${(sz * 1.9).toFixed(0)}px;height:${(sz * 1.9).toFixed(0)}px;border-radius:50%;background:${AVC[(idx + bi) % 4]};display:flex;align-items:center;justify-content:center;font:700 ${(sz * 0.8).toFixed(0)}px ${famOf(nm)};color:#333">${esc([...nm][0])}</span>
        <span style="flex:1;min-width:0">
          <span style="display:flex;justify-content:space-between;font:700 ${(sz * 0.8).toFixed(1)}px ${famOf(nm)};color:#111"><span>${esc(nm)}</span><span dir="ltr" style="font-weight:500;color:#555">${10 + ((idx * 7 + bi) % 2)}:${String(10 + ((idx * 13 + bi * 7) % 49)).padStart(2, "0")}</span></span>
          <span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:700 ${sz.toFixed(1)}px ${ff};color:#111;margin-top:${(sz * 0.1).toFixed(1)}px">${esc(s)}</span>
          <span style="display:flex;gap:${(sz * 0.3).toFixed(1)}px;margin-top:${(sz * 0.3).toFixed(1)}px">${tags.slice(0, idx % 2 ? 1 : 2).map(([l, b2, f]) => `<span style="font:600 ${(sz * 0.55).toFixed(1)}px ${famOf(l)};background:${b2};color:${f};padding:${(sz * 0.1).toFixed(1)}px ${(sz * 0.35).toFixed(1)}px;border-radius:${(sz * 0.3).toFixed(1)}px">${l}</span>`).join("")}</span></span></div>`;
    });
    return html;
  };

  // ---------- doc: دوكيومنت والكلام بيتعلّم بالهايلايتر
  P.k_doc = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const hl = ["#E9D7FF", "#FFF07A", "#C9F2D0"][bi % 3];
    const zoom = lerp(1, 1.12, seg(t, b.t0, b.t1));
    const sz = mn * 0.05 * this.ts;
    const pw = w * 0.92;
    const filler = ar ? "الصبح الشوارع فاضية تقريبا والمحلات لسه قافلة والنور طالع على الحيطان والناس بتبدأ يومها على مهلها" : "morning the streets are almost empty storefronts still closed and the light climbs the walls while people start their day";
    const fw = filler.split(" ");
    let html = `<div style="position:absolute;inset:0;background:#FFFFFF"></div>`;
    // شريط الأدوات والمسطرة
    const tb = mn * 0.075;
    html += `<div dir="ltr" style="position:absolute;left:0;right:0;top:0;height:${tb.toFixed(0)}px;background:#F1F3F4;border-bottom:1px solid #DADCE0;display:flex;align-items:center;gap:${(tb * 0.5).toFixed(0)}px;padding:0 ${(tb * 0.4).toFixed(0)}px;font:500 ${(tb * 0.32).toFixed(1)}px 'TY Outfit';color:#444">
      <span>↶ ↷</span><span>100% ▾</span><span>${ar ? "نص عادي" : "Normal text"} ▾</span><span>Helvetica ▾</span><b>B</b><i>I</i><u>U</u></div>
      <div style="position:absolute;left:0;right:0;top:${tb.toFixed(0)}px;height:${(tb * 0.4).toFixed(0)}px;background:repeating-linear-gradient(90deg,#BDC1C6 0 1px,transparent 1px ${(w / 40).toFixed(0)}px);opacity:.6"></div>`;
    const words = [...fw.slice(0, 9).map((x) => ({ w: x, f: 1 })), ...it.map((x) => ({ ...x, f: 0 })), ...fw.slice(9).map((x) => ({ w: x, f: 1 }))];
    const body = words.map((x) => {
      if (x.f) return `<span style="color:#5F6368">${esc(x.w)}</span>`;
      const q = seg(t, x.t0, x.t0 + 0.25);
      return `<span style="color:#111;font-weight:600;background:linear-gradient(${ar ? 270 : 90}deg,${hl} ${(q * 100).toFixed(0)}%,transparent ${(q * 100).toFixed(0)}%);padding:0 ${(sz * 0.08).toFixed(1)}px">${esc(this.text(x.w))}</span>`;
    }).join(" ");
    html += `<div style="position:absolute;inset:${(tb * 1.4).toFixed(0)}px 0 0 0;transform:scale(${zoom.toFixed(4)});transform-origin:50% 30%">
      <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${((w - pw) / 2).toFixed(0)}px;width:${pw.toFixed(0)}px;top:${(h * 0.12).toFixed(0)}px;font:400 ${sz.toFixed(1)}px ${ff};line-height:1.55;color:#202124">
        <div dir="ltr" style="font:500 ${(sz * 0.7).toFixed(1)}px 'TY Pixel',monospace;color:#5F6368;margin-bottom:${(sz * 0.4).toFixed(1)}px">EN 00:00–00:18 [ SCRIPT ] [ V03 ]</div>${body}</div></div>`;
    return html;
  };

  // ---------- workcards: موعد في الكاليندر ورسالة فيها ملف
  P.k_workcards = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(3, Math.max(1, Math.ceil(it.length / 3))));
    const ar = isAr(it), L = ar ? "ar" : "en", ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const sz = mn * 0.04 * this.ts;
    const cw = Math.min(r.w, w * 0.84);
    const x = r.x + (r.w - cw) / 2;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#4A154B"></div><div style="position:absolute;left:${(w * 0.62).toFixed(0)}px;top:0;bottom:0;right:0;background:#F8F8F8"></div>`;
    let y = r.y + r.h * 0.05;
    const box = (inner, c) => { const a = eBack(seg(t, c.t0, c.t0 + 0.3)); const s2 = `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;box-sizing:border-box;transform:scale(${a.toFixed(3)});transform-origin:50% 0;
      background:#fff;border-radius:${(sz * 0.5).toFixed(1)}px;box-shadow:0 ${(sz * 0.2).toFixed(1)}px ${(sz * 0.8).toFixed(1)}px rgba(0,0,0,.18);padding:${(sz * 0.7).toFixed(1)}px">${inner}</div>`; return s2; };
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const s = this.text(c.w);
      if (i === 0) {
        html += box(`<div style="display:flex;gap:${(sz * 0.6).toFixed(1)}px;align-items:center"><span dir="ltr" style="flex:none;width:${(sz * 2).toFixed(0)}px;height:${(sz * 2).toFixed(0)}px;border-radius:${(sz * 0.3).toFixed(0)}px;border:2px solid #1A73E8;color:#1A73E8;display:flex;align-items:center;justify-content:center;font:700 ${(sz * 0.9).toFixed(0)}px 'TY Outfit'">31</span>
          <span><span style="display:block;font:700 ${sz.toFixed(1)}px ${ff};color:#111;white-space:nowrap">${esc(s)}</span><span style="display:block;font:500 ${(sz * 0.75).toFixed(1)}px ${ff};color:#1A73E8;border-${ar ? "right" : "left"}:3px solid #1A73E8;padding:0 ${(sz * 0.4).toFixed(1)}px;margin-top:${(sz * 0.3).toFixed(1)}px">${ar ? "النهارده من 4:00 لـ 5:30" : "Today from 4:00 to 5:30"}</span></span></div>`, c);
        y += sz * 4.4;
      } else if (i === 1) {
        const nm = NAMES[L][bi % 4];
        html += box(`<div style="display:flex;gap:${(sz * 0.6).toFixed(1)}px"><span style="flex:none;width:${(sz * 1.8).toFixed(0)}px;height:${(sz * 1.8).toFixed(0)}px;border-radius:${(sz * 0.4).toFixed(0)}px;background:${AVC[bi % 4]};display:flex;align-items:center;justify-content:center;font:700 ${(sz * 0.8).toFixed(0)}px ${famOf(nm)}">${esc([...nm][0])}</span>
          <span><span style="font:700 ${(sz * 0.85).toFixed(1)}px ${famOf(nm)};color:#111">${esc(nm)}</span> <span dir="ltr" style="font:500 ${(sz * 0.7).toFixed(1)}px 'TY Outfit';color:#777">05:58</span>
          <span style="display:block;font:500 ${sz.toFixed(1)}px ${ff};color:#111;margin-top:${(sz * 0.2).toFixed(1)}px">${esc(s)}</span></span></div>`, c);
        y += sz * 3.8;
      } else {
        html += box(`<div style="display:flex;gap:${(sz * 0.6).toFixed(1)}px;align-items:center"><svg width="${(sz * 1.6).toFixed(0)}" height="${(sz * 2).toFixed(0)}" viewBox="0 0 16 20" style="flex:none"><path d="M2 1h8l4 4v14H2z" fill="#0F9D58"/><path d="M5 9h6M5 12h6M5 15h4" stroke="#fff" stroke-width="1.4"/></svg>
          <span><span style="display:block;font:700 ${sz.toFixed(1)}px ${ff};color:#111;white-space:nowrap">${esc(s)}</span><span style="display:block;font:500 ${(sz * 0.7).toFixed(1)}px ${ff};color:#777">${ar ? "اتعدّل من 5 ساعات" : "Edited 5 hours ago"}</span></span></div>`, c);
        y += sz * 3.6;
      }
    });
    return html;
  };

  // ---------- call: مكالمة فيديو
  P.k_call = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), L = ar ? "ar" : "en", ff = famOf(ar ? "ع" : "a");
    const tall = h > w;
    const g = mn * 0.012;
    const e = eOut(seg(t, b.t0, b.t0 + 0.5));
    // المربعات: الفيديو كبير، وتلاتة صغيرين
    const main = tall ? { x: g, y: h * 0.08, w: w - g * 2, h: h * 0.42 } : { x: g, y: g, w: w * 0.6 - g * 1.5, h: h * 0.62 };
    const small = tall ? [0, 1, 2].map((i) => ({ x: g + i * ((w - g) / 3), y: h * 0.5 + g, w: (w - g) / 3 - g, h: h * 0.18 }))
      : [0, 1, 2].map((i) => ({ x: w * 0.6 + g * 0.5, y: g + i * ((h * 0.62 + g) / 3), w: w * 0.4 - g * 1.5, h: (h * 0.62 + g) / 3 - g }));
    const M = { x: lerp(0, main.x, e), y: lerp(0, main.y, e), w: lerp(w, main.w, e), h: lerp(h, main.h, e) };
    let html = this.hole(b, M, "#1C1C1E", mn * 0.015 * e);
    const nm = NAMES[L];
    html += `<div style="position:absolute;left:${(M.x + g * 2).toFixed(1)}px;top:${(M.y + M.h - mn * 0.06).toFixed(1)}px;font:600 ${(mn * 0.025).toFixed(1)}px ${famOf(nm[0])};color:#fff;background:rgba(0,0,0,.45);padding:${(mn * 0.004).toFixed(1)}px ${(mn * 0.01).toFixed(1)}px;border-radius:${(mn * 0.008).toFixed(1)}px;opacity:${e.toFixed(2)}">${esc(nm[0])}</div>`;
    small.forEach((S, i) => {
      const a = eOut(seg(t, b.t0 + 0.3 + i * 0.12, b.t0 + 0.6 + i * 0.12));
      const agent = i === 1;
      html += `<div style="position:absolute;left:${S.x.toFixed(1)}px;top:${S.y.toFixed(1)}px;width:${S.w.toFixed(1)}px;height:${S.h.toFixed(1)}px;border-radius:${(mn * 0.015).toFixed(0)}px;overflow:hidden;opacity:${a.toFixed(3)};
        background:${agent ? "#C9C2FF" : `linear-gradient(160deg,${AVC[(i + bi) % 4]},#4B5468)`};display:flex;align-items:center;justify-content:center">
        ${agent ? `<svg width="${(S.h * 0.32).toFixed(0)}" height="${(S.h * 0.32).toFixed(0)}" viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 1 7 7v5l2 3h-4l-1 3h-2l-1-3h-2l-1 3H8l-1-3H3l2-3v-5a7 7 0 0 1 7-7z" fill="#4B3FD1"/><circle cx="9.5" cy="10.5" r="1.4" fill="#fff"/><circle cx="14.5" cy="10.5" r="1.4" fill="#fff"/></svg>`
          : `<svg width="${(S.h * 0.5).toFixed(0)}" height="${(S.h * 0.5).toFixed(0)}" viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.5" fill="rgba(255,255,255,.75)"/><path d="M3 22c1-5 5-7.5 9-7.5s8 2.5 9 7.5z" fill="rgba(255,255,255,.75)"/></svg>`}
        <span style="position:absolute;left:${(g * 1.5).toFixed(0)}px;bottom:${(g * 1.2).toFixed(0)}px;font:600 ${(mn * 0.022).toFixed(1)}px ${famOf(nm[0])};color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6)">${esc(agent ? (ar ? "المساعد" : "Assistant") : nm[(i + 1) % 4])}</span></div>`;
    });
    // الكلام: ترجمة مباشرة تحت
    const shown = it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (shown) {
      const z = mn * 0.042 * this.ts, cy = tall ? h * 0.8 : h * 0.82;
      html += `<div style="position:absolute;left:${(w * 0.06).toFixed(0)}px;right:${(w * 0.06).toFixed(0)}px;top:${cy.toFixed(0)}px;text-align:center">
        <span dir="${ar ? "rtl" : "ltr"}" style="display:inline-block;max-width:100%;font:600 ${z.toFixed(1)}px ${ff};line-height:1.35;color:#fff;background:rgba(0,0,0,.72);padding:${(z * 0.3).toFixed(1)}px ${(z * 0.6).toFixed(1)}px;border-radius:${(z * 0.35).toFixed(1)}px">${esc(shown)}</span></div>`;
    }
    return html;
  };

  // ---------- canvas: كروت صغيرة متفرقة والكاميرا بتقرّب
  P.k_canvas = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const rr = rng(bi * 41 + 9);
    const sz = mn * 0.034;
    const cw = mn * 0.42;
    // أماكن الكروت الحقيقية (فيها الكلام) والكروت الفاضية (زينة)
    const spots = Array.from({ length: 14 }, () => ({ x: rr() * (w - cw), y: h * 0.06 + rr() * h * 0.82, kind: Math.floor(rr() * 3) }));
    const real = cs.map((c, i) => ({ ...spots[i * 3], c }));
    const shown = cs.filter((c) => t >= c.t0);
    const cur = real[Math.max(0, shown.length - 1)];
    const e = eOut(seg(t, (cur?.c || { t0: b.t0 }).t0, (cur?.c || { t0: b.t0 }).t0 + 0.6));
    const Z = lerp(shown.length > 1 ? 1.5 : 1, 1.5, e);
    const fx = cur ? cur.x + cw / 2 : w / 2, fy = cur ? cur.y + sz * 2 : h / 2;
    const tx = w / 2 - fx * Z, ty = h / 2 - fy * Z;
    let inner = "";
    spots.forEach((S, i) => {
      const r = real.find((q) => q === S || (q.x === S.x && q.y === S.y));
      const icon = `<span style="flex:none;width:${(sz * 1.3).toFixed(0)}px;height:${(sz * 1.3).toFixed(0)}px;border-radius:50%;background:${[ORG, "#3B4BE8", "#16A34A"][S.kind]}"></span>`;
      if (r && t >= r.c.t0) {
        const a = eOut(seg(t, r.c.t0, r.c.t0 + 0.3));
        inner += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${S.x.toFixed(0)}px;top:${S.y.toFixed(0)}px;width:${cw.toFixed(0)}px;box-sizing:border-box;opacity:${a.toFixed(3)};background:#fff;border:1px solid #E6E6EA;border-radius:${(sz * 0.5).toFixed(1)}px;
          padding:${(sz * 0.6).toFixed(1)}px;display:flex;gap:${(sz * 0.5).toFixed(1)}px;box-shadow:0 ${(sz * 0.2).toFixed(1)}px ${(sz * 0.6).toFixed(1)}px rgba(0,0,0,.08)">${icon}
          <span style="font:500 ${sz.toFixed(1)}px ${ff};color:#111;line-height:1.35">${esc(this.text(r.c.w))}</span></div>`;
      } else if (!r) {
        inner += `<div style="position:absolute;left:${S.x.toFixed(0)}px;top:${S.y.toFixed(0)}px;width:${(cw * 0.7).toFixed(0)}px;opacity:${(0.8 * seg(t, b.t0, b.t0 + 0.4)).toFixed(2)};background:#fff;border:1px solid #EEE;border-radius:${(sz * 0.5).toFixed(1)}px;padding:${(sz * 0.5).toFixed(1)}px;display:flex;gap:${(sz * 0.4).toFixed(1)}px">${icon}
          <span style="flex:1">${[0.9, 0.6].map((q) => `<i style="display:block;height:${(sz * 0.35).toFixed(1)}px;width:${(q * 100).toFixed(0)}%;background:#E8E8EC;border-radius:3px;margin:${(sz * 0.15).toFixed(1)}px 0"></i>`).join("")}</span></div>`;
      }
    });
    return `<div style="position:absolute;inset:0;background:#FBFBFA"></div><div style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform-origin:0 0;transform:translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${Z.toFixed(4)})">${inner}</div>`;
  };

  // =====================================================================
  // فيديو مرجعي 2 (إعلان تطبيق عيلة/شغل):
  //   colorcard  خلفية لون واحد وكلام صغير أبيض في النص كلمة كلمة
  //   imsg       محادثة موبايل بهيدر فيه صورة واسم الشخص
  //   dashboard  كارت داشبورد: أرقام بتعدّ وخط بياني بيترسم
  //   apps       شبكة تطبيقات بتتوصل واحد واحد بسبينر
  //   bell       جرس إشعارات والعداد بيزيد وزرار «إنشاء» كبير
  //   chapter    خلفية ملونة والفيديو في ركن ورقم فصل عملاق «01)»
  //   sidepanel  الفيديو في ناحية وبانل أبيض فيه صفوف بأرقام في الناحية التانية
  // =====================================================================
  const SOLID = ["#3B4BE8", ORG, "#151515", "#16A34A"];
  P.k_colorcard = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.05 * this.ts;
    const lines = this.wrapItems(it, `500 ${sz}px ${ff}`, w * 0.7);
    const y0 = h / 2 - (lines.length - 1) * sz * 0.65;
    let html = `<div style="position:absolute;inset:0;background:${SOLID[bi % SOLID.length]}"></div>`;
    lines.forEach((ln, li) => {
      html += lineHtml(this, ln, sz, ff, "#fff", y0 + li * sz * 1.3, "font-weight:500;letter-spacing:-0.02em", (x) => {
        const q = eOut(seg(t, x.t0, x.t0 + 0.25));
        return `<span style="display:inline-block;opacity:${q.toFixed(3)};transform:translateY(${((1 - q) * sz * 0.3).toFixed(1)}px)">${esc(this.text(x.w))}</span>`;
      });
    });
    return html;
  };

  // ---------- imsg
  P.k_imsg = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 3))));
    const ar = isAr(it), L = ar ? "ar" : "en", ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.05 * this.ts;
    const nm = NAMES[L][bi % 4];
    const hy = h * 0.12;
    let html = `<div style="position:absolute;inset:0;background:#FFFFFF"></div>
      <div style="position:absolute;left:0;right:0;top:${(hy - sz * 1.6).toFixed(0)}px;display:flex;flex-direction:column;align-items:center;gap:${(sz * 0.2).toFixed(1)}px;opacity:${eOut(seg(t, b.t0, b.t0 + 0.3)).toFixed(3)}">
        <span style="width:${(sz * 2.6).toFixed(0)}px;height:${(sz * 2.6).toFixed(0)}px;border-radius:50%;background:${AVC[bi % 4]};display:flex;align-items:center;justify-content:center;font:700 ${(sz * 1.1).toFixed(0)}px ${famOf(nm)};color:#333">${esc([...nm][0])}</span>
        <span style="font:500 ${(sz * 0.8).toFixed(1)}px ${famOf(nm)};color:#111">${esc(nm)} ›</span></div>
      <div dir="ltr" style="position:absolute;left:${(w * 0.05).toFixed(0)}px;top:${(hy - sz * 1.4).toFixed(0)}px;font:600 ${(sz * 0.7).toFixed(1)}px 'TY Outfit';color:#fff;background:#8E8E93;border-radius:999px;padding:${(sz * 0.1).toFixed(1)}px ${(sz * 0.45).toFixed(1)}px">${12 + bi * 7}</div>
      <div style="position:absolute;left:0;right:0;top:${(hy + sz * 2.4).toFixed(0)}px;height:1px;background:#E5E5EA"></div>`;
    let y = hy + sz * 3.6;
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const me = i % 2 === 1;
      const p = eBack(seg(t, c.t0, c.t0 + 0.25));
      const s = this.text(c.w);
      const lines = Math.max(1, Math.ceil(measure(s, `500 ${sz}px ${ff}`) / (w * 0.6)));
      const bh = sz * 1.3 * lines + sz * 1.1;
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${me ? "right" : "left"}:${(w * 0.06).toFixed(0)}px;top:${y.toFixed(1)}px;max-width:${(w * 0.68).toFixed(0)}px;transform:scale(${p.toFixed(3)});transform-origin:${me ? "100%" : "0"} 100%;
        background:${me ? "#1E9BFF" : "#E9E9EB"};color:${me ? "#fff" : "#111"};font:500 ${sz.toFixed(1)}px ${ff};line-height:1.3;padding:${(sz * 0.5).toFixed(1)}px ${(sz * 0.85).toFixed(1)}px;border-radius:${(sz * 1.1).toFixed(1)}px">${esc(s)}</div>`;
      y += bh + sz * 0.5;
    });
    return html;
  };

  // ---------- dashboard: أرقام بتعدّ وخط بياني
  P.k_dashboard = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const cw = Math.min(r.w, w * 0.86), ch = Math.min(r.h, cw * 0.78);
    const x = r.x + (r.w - cw) / 2, y = r.y + (r.h - ch) / 2;
    const sz = cw * 0.05;
    const acc = ["#3B4BE8", "#16A34A", ORG][bi % 3];
    const nums = it.map((q) => q.w.match(/[0-9٠-٩]+/)).filter(Boolean).map((m) => parseInt(m[0].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10));
    const vals = [nums[0] ?? 15 + bi, nums[1] ?? 3 + (bi % 5)];
    const title = it.filter((q) => !/[0-9٠-٩]/.test(q.w)).map((q) => this.text(q.w)).join(" ");
    const a = eOut(seg(t, b.t0, b.t0 + 0.35)), cnt = eOut(seg(t, b.t0 + 0.2, b.t0 + 1.2)), ln = seg(t, b.t0 + 0.4, b.t0 + 1.6);
    const rr = rng(bi * 19 + 3);
    const pts = Array.from({ length: 9 }, (_, i) => [i / 8, 0.25 + rr() * 0.6]);
    const gw = cw * 0.86, gh = ch * 0.38, gx = cw * 0.07, gy = ch * 0.52;
    const path = pts.map(([px, py], i) => `${i ? "L" : "M"}${(gx + px * gw).toFixed(1)} ${(gy + gh - py * gh).toFixed(1)}`).join(" ");
    const area = path + ` L${(gx + gw).toFixed(1)} ${(gy + gh).toFixed(1)} L${gx.toFixed(1)} ${(gy + gh).toFixed(1)}Z`;
    const L2 = gw * 1.6;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;height:${ch.toFixed(1)}px;box-sizing:border-box;transform:translateY(${((1 - a) * ch * 0.2).toFixed(1)}px);opacity:${a.toFixed(3)};
      background:#fff;border-radius:${(sz * 0.6).toFixed(1)}px;box-shadow:0 ${(sz * 0.3).toFixed(1)}px ${sz.toFixed(1)}px rgba(0,0,0,.16);padding:${(sz * 1.1).toFixed(1)}px">
      <div style="font:700 ${(sz * 1.25).toFixed(1)}px ${ff};color:${acc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title || (ar ? "نظرة عامة" : "Overview"))}</div>
      <div dir="ltr" style="display:flex;gap:${(sz * 2).toFixed(1)}px;margin-top:${(sz * 0.6).toFixed(1)}px">${vals.map((v, i) => `<div><div style="font:700 ${(sz * 2.2).toFixed(1)}px 'TY Outfit';color:#111;letter-spacing:-0.04em">${Math.round(v * cnt).toLocaleString("en")}<span style="font-size:.4em;color:${i ? ORG : acc}"> ●</span></div>
        <div style="font:500 ${(sz * 0.7).toFixed(1)}px ${famOf(ar ? "ع" : "a")};color:#777">${ar ? ["الأسبوع ده", "النهارده"][i] : ["this week", "today"][i]}</div></div>`).join("")}</div>
      <svg width="${cw.toFixed(0)}" height="${ch.toFixed(0)}" style="position:absolute;left:0;top:0;overflow:visible">
        ${[0, 1, 2, 3].map((q) => `<line x1="${gx.toFixed(0)}" x2="${(gx + gw).toFixed(0)}" y1="${(gy + (q / 3) * gh).toFixed(0)}" y2="${(gy + (q / 3) * gh).toFixed(0)}" stroke="#EEE"/>`).join("")}
        <path d="${area}" fill="${acc}" opacity="${(0.12 * ln).toFixed(3)}"/>
        <path d="${path}" fill="none" stroke="${acc}" stroke-width="${(sz * 0.18).toFixed(1)}" stroke-linejoin="round" stroke-dasharray="${L2.toFixed(0)}" stroke-dashoffset="${(L2 * (1 - ln)).toFixed(1)}"/></svg></div>`;
    return html;
  };

  // ---------- apps: شبكة تطبيقات بتتوصل
  const APPC = [["#EA4335", "M"], ["#1A73E8", "31"], ["#5E6AD2", "◐"], ["#635BFF", "S"], ["#0F9D58", "▲"], ["#188038", "▦"]];
  P.k_apps = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    // عمود واحد لو المكان ضيق (الطولي)، وإلا عمودين
    const cols = r.w < w * 0.6 || h > w ? 1 : 2, rows = cols === 1 ? Math.min(5, Math.max(3, it.length)) : 3;
    const gw = Math.min(cols === 1 ? Math.max(r.w, w * 0.7) : r.w, w * 0.88), tile = gw / cols, th2 = Math.min(cols === 1 ? tile * 0.2 : tile * 0.5, (r.h || h * 0.5) / rows);
    const x0 = Math.max(mn * 0.03, r.x + (r.w - gw) / 2), y0 = r.y + Math.max(0, (r.h - th2 * rows) / 2);
    const names = it.map((x) => this.text(x.w));
    const sz = th2 * 0.24;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#F2F2F0"></div>`;
    for (let i = 0; i < cols * rows; i++) {
      const c = i % cols, rI = Math.floor(i / cols);
      const nm = names[i % names.length];
      const t0 = b.t0 + i * ((b.t1 - b.t0 - 0.4) / (cols * rows));
      const a = eOut(seg(t, t0 - 0.2, t0 + 0.1));
      const busy = t >= t0 && t < t0 + 0.45, done = t >= t0 + 0.45;
      const [col, glyph] = APPC[(i + bi) % APPC.length];
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(x0 + c * tile + tile * 0.03).toFixed(1)}px;top:${(y0 + rI * th2 + th2 * 0.05).toFixed(1)}px;width:${(tile * 0.94).toFixed(1)}px;height:${(th2 * 0.9).toFixed(1)}px;box-sizing:border-box;opacity:${a.toFixed(3)};
        background:#fff;border-radius:${(sz * 0.6).toFixed(1)}px;border:${done ? 2 : 1}px solid ${done ? col : "#E3E3E6"};display:flex;align-items:center;gap:${(sz * 0.7).toFixed(1)}px;padding:0 ${(sz * 0.9).toFixed(1)}px">
        <span dir="ltr" style="flex:none;width:${(sz * 2).toFixed(0)}px;height:${(sz * 2).toFixed(0)}px;border-radius:${(sz * 0.5).toFixed(0)}px;background:${col};color:#fff;display:flex;align-items:center;justify-content:center;font:800 ${(sz * 0.9).toFixed(0)}px 'TY Outfit'">${glyph}</span>
        <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 ${sz.toFixed(1)}px ${ff};color:#111">${esc(nm)}</span>
        ${busy ? `<svg width="${sz.toFixed(0)}" height="${sz.toFixed(0)}" viewBox="0 0 24 24" style="flex:none;transform:rotate(${((t * 720) % 360).toFixed(0)}deg)"><circle cx="12" cy="12" r="9" fill="none" stroke="#999" stroke-width="3" stroke-dasharray="40 20"/></svg>`
          : done ? `<svg width="${sz.toFixed(0)}" height="${sz.toFixed(0)}" viewBox="0 0 24 24" style="flex:none"><circle cx="12" cy="12" r="11" fill="${col}"/><path d="M7 12.5l3 3L17 9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>` : ""}</div>`;
    }
    return html;
  };

  // ---------- bell: جرس والعداد بيزيد
  P.k_bell = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const sz = mn * 0.13;
    const cy = this.blockSolid(b) ? Math.min(h * 0.72, this.belowHead(b, sz)) : h * 0.42;
    const ni = it.findIndex((x) => /[0-9٠-٩]/.test(x.w));
    const target = ni >= 0 ? parseInt(it[ni].w.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^0-9]/g, ""), 10) || 3 : 3;
    const n = Math.max(1, Math.round(target * seg(t, b.t0 + 0.2, b.t1 - 0.4)));
    const ring = Math.sin((t - b.t0) * 18) * 12 * Math.max(0, 1 - ((t - b.t0) % 1) * 3);
    const zoom = lerp(1.25, 1, eOut(seg(t, b.t0, b.t0 + 0.6)));
    const label = it.filter((x, i) => i !== ni).map((x) => this.text(x.w)).join(" ") || (ar ? "إشعارات" : "Updates");
    let html = onVideo(this) ? `<div style="position:absolute;inset:0;background:rgba(255,255,255,.88)"></div>` : `<div style="position:absolute;inset:0;background:#FAFAFA"></div>`;
    html += `<div style="position:absolute;left:50%;top:${cy.toFixed(1)}px;transform:translate(-50%,-50%) scale(${zoom.toFixed(3)});display:flex;gap:${(sz * 0.25).toFixed(1)}px;align-items:center">
      <span style="width:${sz.toFixed(0)}px;height:${sz.toFixed(0)}px;border-radius:${(sz * 0.28).toFixed(0)}px;border:2px solid #E5E5E8;background:#fff;display:flex;align-items:center;justify-content:center">
        <svg width="${(sz * 0.42).toFixed(0)}" height="${(sz * 0.42).toFixed(0)}" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="#9AA0A6" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="#9AA0A6" stroke-width="2.6" stroke-linecap="round"/></svg></span>
      <span style="position:relative;width:${sz.toFixed(0)}px;height:${sz.toFixed(0)}px;border-radius:${(sz * 0.28).toFixed(0)}px;border:2px solid #E5E5E8;background:#fff;display:flex;align-items:center;justify-content:center">
        <svg width="${(sz * 0.5).toFixed(0)}" height="${(sz * 0.5).toFixed(0)}" viewBox="0 0 24 24" style="transform:rotate(${ring.toFixed(1)}deg);transform-origin:50% 10%"><path d="M12 3a6 6 0 0 1 6 6v4l2 3H4l2-3V9a6 6 0 0 1 6-6zM10 19a2 2 0 0 0 4 0" fill="none" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>
        <b dir="ltr" style="position:absolute;top:${(-sz * 0.16).toFixed(0)}px;right:${(-sz * 0.16).toFixed(0)}px;min-width:${(sz * 0.42).toFixed(0)}px;height:${(sz * 0.42).toFixed(0)}px;border-radius:999px;background:#F2542D;color:#fff;font:700 ${(sz * 0.26).toFixed(0)}px 'TY Outfit';display:flex;align-items:center;justify-content:center;padding:0 ${(sz * 0.06).toFixed(0)}px">${n}</b></span>
      <span style="height:${sz.toFixed(0)}px;border-radius:${(sz * 0.28).toFixed(0)}px;background:#111;color:#fff;display:flex;align-items:center;gap:${(sz * 0.12).toFixed(0)}px;padding:0 ${(sz * 0.35).toFixed(0)}px;font:500 ${(sz * 0.36).toFixed(0)}px ${ff}"><span style="font-family:'TY Outfit'">+</span> ${ar ? "إنشاء" : "Create"}</span></div>`;
    const z = fitSize(label, `500 {}px ${ff}`, w * 0.84, mn * 0.08);
    html += `<div dir="${this.dir(label)}" style="position:absolute;left:0;right:0;top:${(cy + sz * 1.1).toFixed(1)}px;text-align:center;white-space:nowrap;font:500 ${z.toFixed(1)}px ${ff};letter-spacing:-0.03em;color:#111;opacity:${eOut(seg(t, it[0].t0, it[0].t0 + 0.3)).toFixed(3)}">${esc(label)} <span dir="ltr">(${n})</span></div>`;
    return html;
  };

  // ---------- chapter: خلفية ملونة والفيديو في ركن ورقم فصل عملاق
  P.k_chapter = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const e = eOut(seg(t, b.t0, b.t0 + 0.55));
    const T = h > w ? { x: w * 0.42, y: h * 0.12, w: w * 0.5, h: h * 0.28 } : { x: w * 0.6, y: h * 0.08, w: w * 0.34, h: h * 0.44 };
    const R = { x: lerp(0, T.x, e), y: lerp(0, T.y, e), w: lerp(w, T.w, e), h: lerp(h, T.h, e) };
    const bg = SOLID[bi % 2];
    let html = this.hole(b, R, bg);
    const m = it[0].w.match(/^[0-9٠-٩]{1,2}$/);
    const num = m ? this.text(it[0].w) : String(bi + 1).padStart(2, "0");
    const words = m ? it.slice(1) : it;
    const nz = mn * 0.62;
    const q = eOut(seg(t, b.t0 + 0.2, b.t0 + 0.7));
    html += `<div dir="ltr" style="position:absolute;left:${(-nz * 0.12).toFixed(0)}px;bottom:${(h * 0.05).toFixed(0)}px;font:500 ${nz.toFixed(0)}px 'TY Outfit';letter-spacing:-0.07em;line-height:.8;color:#fff;opacity:${q.toFixed(3)};transform:translateY(${((1 - q) * nz * 0.2).toFixed(1)}px)">${esc(num)})</div>`;
    if (words.length && t >= words[0].t0) {
      const s = words.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" "), ff = famOf(s);
      const z = fitSize(s, `500 {}px ${ff}`, w * 0.4, mn * 0.05 * this.ts);
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${(T.x).toFixed(0)}px;top:${(T.y + T.h + z * 0.6).toFixed(0)}px;white-space:nowrap;font:500 ${z.toFixed(1)}px ${ff};color:#fff">${esc(s)}</div>`;
    }
    html += `<div dir="ltr" style="position:absolute;right:${(w * 0.05).toFixed(0)}px;bottom:${(h * 0.04).toFixed(0)}px;font:400 ${(mn * 0.018).toFixed(1)}px 'TY Pixel',monospace;letter-spacing:.12em;color:#fff;opacity:.7">CHAPTER ${esc(num)}</div>`;
    return html;
  };

  // ---------- sidepanel: الفيديو في ناحية وبانل أبيض بصفوف في الناحية التانية
  P.k_sidepanel = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(5, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const tall = h > w;
    const e = eOut(seg(t, b.t0, b.t0 + 0.5));
    const P2 = tall ? { x: 0, y: h * 0.5, w, h: h * 0.5 } : { x: ar ? w * 0.5 : 0, y: 0, w: w * 0.5, h };
    const V = tall ? { x: 0, y: 0, w, h: h * 0.5 } : { x: ar ? 0 : w * 0.5, y: 0, w: w * 0.5, h };
    const R = { x: lerp(0, V.x, e), y: lerp(0, V.y, e), w: lerp(w, V.w, e), h: lerp(h, V.h, e) };
    let html = this.hole(b, R, "#FFFFFF");
    const sz = mn * 0.042 * this.ts;
    const row = sz * 2.6;
    const pad = Math.min(P2.w, P2.h) * 0.08;
    const dateMode = bi % 2 === 1;
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const a = eOut(seg(t, c.t0, c.t0 + 0.3));
      const y = P2.y + pad + i * row;
      if (y + row > P2.y + P2.h) return;
      const s = this.text(c.w);
      const n = c.w.match(/[0-9٠-٩]+/);
      const val = n ? this.text(n[0]) : (1000 + ((i * 733 + bi * 97) % 6000)).toLocaleString("en");
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(P2.x + pad).toFixed(1)}px;width:${(P2.w - pad * 2).toFixed(1)}px;top:${y.toFixed(1)}px;height:${(row - sz * 0.4).toFixed(1)}px;display:flex;align-items:center;gap:${(sz * 0.6).toFixed(1)}px;
        border-bottom:1px solid #EEE;opacity:${a.toFixed(3)};transform:translateY(${((1 - a) * sz).toFixed(1)}px)">
        ${dateMode ? `<span dir="ltr" style="flex:none;width:${(sz * 1.8).toFixed(0)}px;height:${(sz * 1.8).toFixed(0)}px;border-radius:${(sz * 0.4).toFixed(0)}px;background:${["#FFE1D6", "#E0E7FF", "#DCFCE7", "#FEF3C7"][i % 4]};display:flex;align-items:center;justify-content:center;font:700 ${(sz * 0.8).toFixed(0)}px 'TY Outfit';color:#333">${10 + i * 3}</span>` : ""}
        <span style="flex:1;min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 ${sz.toFixed(1)}px ${ff};color:#111">${esc(s)}</span>
          ${dateMode ? "" : `<span dir="ltr" style="display:block;font:500 ${(sz * 0.7).toFixed(1)}px 'TY Outfit';color:#888">${val} ${ar ? "مشاهدة" : "views"}</span>`}</span>
        <span dir="ltr" style="flex:none;font:600 ${(sz * 0.75).toFixed(1)}px 'TY Outfit';color:${dateMode ? "#16A34A" : "#3B4BE8"}">${dateMode ? (ar ? "النهارده" : "today") : `${1 + (i % 4)}:${String(10 + ((i * 17) % 50)).padStart(2, "0")} avg`}</span></div>`;
    });
    return html;
  };

  // =====================================================================
  // فيديو مرجعي 3 (ابني تطبيقك):
  //   clones      الشخص متكرر كذا مرة جنب بعض وواحد منهم سيلويت ملوّن
  //   megapan     كلمة عملاقة جدًا والكاميرا ماشية على حروفها
  //   badge       دايرة لون كبيرة فيها أول حرف وبعدين بتكبر لكبسولة فيها الكلمة
  //   leaderboard ترتيب: صفوف بأرقام والجديد بيطلع فوق منوّر
  //   donut       دايرة نسبة بتتملا والرقم في النص
  //   photowords  كلمات متفرقة وصور من الفيديو طايرة حواليها
  // =====================================================================
  P.k_clones = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const a = this.personAt(t);
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    if (a && this.doc.transparent) {
      const { x, y, w: iw, h: ih } = a.img, src = a.url, msrc = a.murl || a.url;
      this._want = src;
      const n = Math.min(5, Math.max(3, it.length));
      const sc = 0.82;
      for (let q = 0; q < n; q++) {
        const t0 = b.t0 + q * Math.min(0.35, (b.t1 - b.t0) / (n + 1));
        if (t < t0) continue;
        const e = eOut(seg(t, t0, t0 + 0.3));
        const off = (q - (n - 1) / 2) * (w / n);
        const cx = w / 2 + off;
        const silo = q === (bi % n);
        const style = `position:absolute;left:${(cx - (iw * sc) / 2).toFixed(1)}px;top:${(y + ih * (1 - sc)).toFixed(1)}px;width:${(iw * sc).toFixed(1)}px;height:${(ih * sc).toFixed(1)}px;opacity:${e.toFixed(3)};transform:translateY(${((1 - e) * mn * 0.05).toFixed(1)}px)`;
        html += silo ? `<div style="${style};background:#3FC5F0;-webkit-mask:url(${msrc}) 0 0/100% 100% no-repeat;mask:url(${msrc}) 0 0/100% 100% no-repeat"></div>`
          : `<img src="${src}" alt="" style="${style};filter:drop-shadow(0 ${(mn * 0.01).toFixed(0)}px ${(mn * 0.02).toFixed(0)}px rgba(0,0,0,.25))">`;
      }
    }
    const s = it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (s) { const z = fitSize(s, `600 {}px ${ff}`, w * 0.86, mn * 0.06 * this.ts);
      html += `<div style="position:absolute;left:0;right:0;top:${(h * 0.86).toFixed(0)}px;text-align:center"><span dir="${this.dir(s)}" style="display:inline-block;white-space:nowrap;font:600 ${z.toFixed(1)}px ${ff};color:#111;background:#fff;padding:${(z * 0.2).toFixed(1)}px ${(z * 0.5).toFixed(1)}px;border-radius:${(z * 0.25).toFixed(1)}px">${esc(s)}</span></div>`; }
    return html;
  };

  // ---------- megapan: كلمة عملاقة والكاميرا ماشية عليها
  P.k_megapan = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const it = this.items(b);
    if (!it.length) return "";
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : it.reduce((a2, x, i) => (x.w.length > it[a2].w.length ? i : a2), 0);
    const s = this.text(it[fi].w), ff = famOf(s);
    const sz = Math.min(w, h) * 0.95;
    const tw = bi % 2 === 1 ? measure(s, `400 ${sz * 1.05}px ${SERIF(s)}`) : measure(s, `500 ${sz}px ${ff}`);
    const ar = AR.test(s);
    const q = seg(t, b.t0, b.t1);
    const pos = lerp(w * 0.1, w * 0.9 - tw, ar ? 1 - q : q);
    const vid = onVideo(this);
    let html = vid ? "" : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    const serifV = bi % 2 === 1;
    html += `<div data-free dir="ltr" style="position:absolute;left:${pos.toFixed(1)}px;top:50%;transform:translateY(-52%);white-space:nowrap;font:${serifV ? `400 ${(sz * 1.05).toFixed(0)}px ${SERIF(s)}` : `500 ${sz.toFixed(0)}px ${ff}`};letter-spacing:${serifV ? "-0.03em" : "-0.06em"};line-height:1;color:${serifV ? "#F2E23A" : vid ? "#fff" : INK}">${esc(s)}</div>`;
    return html;
  };

  // ---------- badge: دايرة بأول حرف بتكبر لكبسولة
  P.k_badge = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : 0;
    const s = this.text(it[fi].w), ff = famOf(s);
    const col = [ORG, "#3B4BE8", "#16A34A"][bi % 3];
    const D = mn * 0.36;
    const p = eBack(seg(t, b.t0, b.t0 + 0.35));
    const grow = eOut(seg(t, b.t0 + 0.7, b.t0 + 1.2));
    const z = fitSize(s, `600 {}px ${ff}`, w * 0.7, D * 0.42);
    const fullW = Math.max(D, measure(s, `600 ${z}px ${ff}`) + D * 0.6);
    const cw = lerp(D, fullW, grow);
    const cy = this.blockSolid(b) ? this.belowHead(b, D * 0.5) : h * 0.48;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#1C1C1E"></div>`;
    const pp = eOut(seg(t, b.t0 + 0.2, b.t0 + 0.7));
    html += `<div style="position:absolute;left:${(-mn * 0.08).toFixed(0)}px;bottom:${(-mn * 0.08).toFixed(0)}px;width:${(mn * 0.4).toFixed(0)}px;height:${(mn * 0.4).toFixed(0)}px;border-radius:50%;background:#B9A6FF;transform:scale(${pp.toFixed(3)})"></div>`;
    html += `<div style="position:absolute;left:${(w / 2 - cw / 2).toFixed(1)}px;top:${(cy - D / 2).toFixed(1)}px;width:${cw.toFixed(1)}px;height:${D.toFixed(1)}px;border-radius:${(D / 2).toFixed(0)}px;background:${col};transform:scale(${p.toFixed(3)});
      display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 ${(D * 0.06).toFixed(0)}px ${(D * 0.2).toFixed(0)}px rgba(0,0,0,.3)">
      <span dir="${this.dir(s)}" style="white-space:nowrap;font:600 ${(grow > 0.05 ? z : D * 0.45).toFixed(1)}px ${ff};color:#fff;letter-spacing:-0.02em">${esc(grow > 0.05 ? s : [...s][0] || "")}</span></div>`;
    const rest = it.filter((x, i) => i !== fi && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (rest) { const f2 = famOf(rest), z2 = fitSize(rest, `500 {}px ${f2}`, w * 0.84, mn * 0.05 * this.ts);
      html += `<div dir="${this.dir(rest)}" style="position:absolute;left:0;right:0;top:${(cy + D * 0.75).toFixed(1)}px;text-align:center;white-space:nowrap;font:500 ${z2.toFixed(1)}px ${f2};color:${onVideo(this) ? "#fff" : "#EDEDED"};${shadow(this)}">${esc(rest)}</div>`; }
    return html;
  };

  // ---------- leaderboard
  P.k_leaderboard = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it), L = ar ? "ar" : "en", ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const cw = Math.min(r.w, w * 0.86);
    const sz = mn * 0.038 * this.ts, row = sz * 2;
    const shown = cs.filter((c) => t >= c.t0);
    const others = NAMES[L];
    // الصفوف: كلام البلوك (الجديد فوق) وبعده أسامي ثابتة
    const rows = [...shown.slice().reverse().map((c) => ({ s: this.text(c.w), me: c === shown[shown.length - 1], t0: c.t0 })), ...others.map((s) => ({ s }))].slice(0, 7);
    const x = r.x + (r.w - cw) / 2, y0 = r.y + Math.max(0, (r.h - rows.length * row - sz * 2.5) / 2);
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#141416"></div>`;
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y0.toFixed(1)}px;width:${cw.toFixed(1)}px;box-sizing:border-box;background:#1E1E22;border:1px solid #333;border-radius:${(sz * 0.6).toFixed(1)}px;padding:${(sz * 0.7).toFixed(1)}px">
      <div style="font:600 ${(sz * 1.1).toFixed(1)}px ${ar ? famOf("ع") : "'TY Outfit'"};letter-spacing:.06em;color:#EDEDED;margin-bottom:${(sz * 0.5).toFixed(1)}px">${ar ? "الترتيب" : "LEADERBOARD"}</div>
      ${rows.map((q, i) => { const a = q.t0 != null ? eOut(seg(t, q.t0, q.t0 + 0.3)) : 1;
        return `<div style="display:flex;align-items:center;gap:${(sz * 0.6).toFixed(1)}px;height:${(row - sz * 0.2).toFixed(1)}px;margin-bottom:${(sz * 0.2).toFixed(1)}px;padding:0 ${(sz * 0.5).toFixed(1)}px;border-radius:${(sz * 0.3).toFixed(1)}px;
          background:${q.me ? "#ECECEC" : "transparent"};color:${q.me ? "#111" : "#D8D8DC"};opacity:${a.toFixed(3)};transform:translateY(${((1 - a) * -row).toFixed(1)}px)">
          <span dir="ltr" style="width:${(sz * 1.2).toFixed(0)}px;font:600 ${(sz * 0.8).toFixed(1)}px 'TY Outfit'">${i + 1}</span>
          <span style="width:${(sz * 0.9).toFixed(0)}px;height:${(sz * 0.9).toFixed(0)}px;border-radius:${(sz * 0.2).toFixed(0)}px;background:${AVC[i % 4]}"></span>
          <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:500 ${(sz * 0.85).toFixed(1)}px ${famOf(q.s)}">${esc(q.s)}</span>
          <span dir="ltr" style="font:600 ${(sz * 0.8).toFixed(1)}px 'TY Pixel',monospace">${14820 - i * 380}</span></div>`; }).join("")}</div>`;
    return html;
  };

  // ---------- donut
  P.k_donut = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const m = it.map((x) => x.w.match(/[0-9٠-٩]+/)).find(Boolean);
    const pct = m ? clamp(parseInt(m[0].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10), 1, 100) : 72;
    const label = it.filter((x) => !/[0-9٠-٩]/.test(x.w)).map((x) => this.text(x.w)).join(" ");
    const D = mn * 0.5, R = D * 0.4, L = 2 * Math.PI * R;
    const f = eOut(seg(t, b.t0 + 0.2, b.t0 + 1.3));
    const cy = this.blockSolid(b) ? Math.min(h * 0.62, this.belowHead(b, D * 0.5)) : h * 0.46;
    const col = ["#7B6CFF", ORG, "#16A34A"][bi % 3];
    let html = onVideo(this) ? `<div style="position:absolute;left:${(w / 2 - D * 0.7).toFixed(0)}px;top:${(cy - D * 0.7).toFixed(0)}px;width:${(D * 1.4).toFixed(0)}px;height:${(D * 1.5).toFixed(0)}px;border-radius:${(D * 0.1).toFixed(0)}px;background:rgba(20,20,24,.86)"></div>`
      : `<div style="position:absolute;inset:0;background:#141416"></div>`;
    html += `<svg width="${D.toFixed(0)}" height="${D.toFixed(0)}" style="position:absolute;left:${(w / 2 - D / 2).toFixed(1)}px;top:${(cy - D / 2).toFixed(1)}px;transform:rotate(-90deg)">
      <circle cx="${(D / 2).toFixed(1)}" cy="${(D / 2).toFixed(1)}" r="${R.toFixed(1)}" fill="none" stroke="#2C2C32" stroke-width="${(D * 0.09).toFixed(1)}"/>
      <circle cx="${(D / 2).toFixed(1)}" cy="${(D / 2).toFixed(1)}" r="${R.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${(D * 0.09).toFixed(1)}" stroke-linecap="round" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${(L * (1 - (pct / 100) * f)).toFixed(1)}"/></svg>
      <div dir="ltr" style="position:absolute;left:0;right:0;top:${cy.toFixed(1)}px;transform:translateY(-50%);text-align:center;font:600 ${(D * 0.2).toFixed(1)}px 'TY Outfit';color:#fff;letter-spacing:-0.03em">${Math.round(pct * f)}%</div>`;
    if (label) { const z = fitSize(label, `500 {}px ${ff}`, D * 1.3, mn * 0.045 * this.ts);
      html += `<div dir="${this.dir(label)}" style="position:absolute;left:0;right:0;top:${(cy + D * 0.6).toFixed(1)}px;text-align:center;white-space:nowrap;font:500 ${z.toFixed(1)}px ${ff};color:#D8D8DC;opacity:${eOut(seg(t, it[0].t0, it[0].t0 + 0.3)).toFixed(3)}">${esc(label)}</div>`; }
    return html;
  };

  // ---------- photowords: كلمات متفرقة وصور طايرة
  P.k_photowords = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const src = imgOf(b);
    if (src) this._want = src;
    const rr = rng(bi * 23 + 11);
    const u = t - b.t0;
    let html = `<div style="position:absolute;inset:0;background:#F3F3F1"></div>`;
    for (let q = 0; q < 6; q++) {
      const px = rr() * 0.9, py = rr() * 0.9, sc = 0.12 + rr() * 0.1;
      const a = eOut(seg(t, b.t0 + q * 0.12, b.t0 + q * 0.12 + 0.4));
      const pw = mn * sc * 1.6, ph = pw * 1.25;
      const dx = Math.sin(u * 0.6 + q) * mn * 0.015, dy = Math.cos(u * 0.5 + q) * mn * 0.015;
      html += `<div style="position:absolute;left:${(px * (w - pw) + dx).toFixed(1)}px;top:${(py * (h - ph) + dy).toFixed(1)}px;width:${pw.toFixed(0)}px;height:${ph.toFixed(0)}px;opacity:${(a * 0.95).toFixed(3)};border-radius:${(mn * 0.008).toFixed(0)}px;
        background:${src ? `url(${src}) ${(rr() * 100).toFixed(0)}% ${(rr() * 100).toFixed(0)}%/${(250 + rr() * 150).toFixed(0)}%` : `linear-gradient(160deg,${AVC[q % 4]},#FFFFFF)`};box-shadow:0 ${(mn * 0.006).toFixed(0)}px ${(mn * 0.02).toFixed(0)}px rgba(0,0,0,.15)"></div>`;
    }
    const sz = mn * 0.08 * this.ts;
    // أماكن متباعدة (عشان الكلمات ماتركبش على بعض)
    const pos = [[-0.2, -0.22], [0.18, -0.08], [-0.16, 0.06], [0.2, 0.2], [0, -0.36], [-0.18, 0.34]];
    it.slice(0, 6).forEach((x, i) => {
      if (t < x.t0) return;
      const s = this.text(x.w), ff = famOf(s);
      const e = eOut(seg(t, x.t0, x.t0 + 0.3));
      const [ox, oy] = pos[i];
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${(w / 2 + ox * w).toFixed(1)}px;top:${(h / 2 + oy * h * 0.62).toFixed(1)}px;transform:translate(-50%,-50%);white-space:nowrap;font:500 ${fitSize(s, `500 {}px ${ff}`, w * 0.5, sz).toFixed(1)}px ${ff};letter-spacing:-0.04em;color:${INK};opacity:${e.toFixed(3)};filter:blur(${((1 - e) * sz * 0.12).toFixed(1)}px)">${esc(s)}</div>`;
    });
    return html;
  };

  // =====================================================================
  // فيديو مرجعي 4 (مواقع حقيقية في 10 دقايق، سينمائي):
  //   titlecard  عنوان فوق الفيديو بيتبني: كلام صغير وبعدين كلمة عملاقة تحته
  //   departures لوحة مواعيد قطر زرقا بصفوف ودقايق وساعة شغالة
  //   loading    شاشة «بيتعمل»: ترس بيلف وجملة الحالة ونقط
  //   countdown  عدّاد تنازلي بأعمدة أرقام بتلف (أيام وساعات ودقايق)
  //   dragdrop   صور بتطير لجوه مربع الكتابة وعليها أسامي
  //   lineup     أسامي كبيرة فوق بعض والحالي منوّر برتقاني وجنبه صورة
  //   isomap     خريطة أيزومتريك برتقاني بمربعات عليها أسامي
  //   stickers   كلمة عملاقة وحواليها تاجات مايلة بحدود
  // =====================================================================
  P.k_titlecard = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const n = it.length;
    const bigN = Math.max(1, Math.min(2, Math.floor(n / 2)));
    const small = it.slice(0, n - bigN), big = it.slice(n - bigN);
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const cy = this.blockSolid(b) ? this.belowHead(b, mn * 0.12) : h * 0.55;
    const sz = mn * 0.06 * this.ts;
    let html = `<div style="position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,.35))"></div>`;
    const sm = small.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (sm) html += `<div dir="${this.dir(sm)}" style="position:absolute;left:0;right:0;top:${(cy - sz * 1.2).toFixed(1)}px;text-align:center;white-space:nowrap;font:500 ${sz.toFixed(1)}px ${ff};color:#fff;letter-spacing:-0.01em;text-shadow:0 2px 14px rgba(0,0,0,.4)">${esc(sm)}</div>`;
    if (t >= big[0].t0) {
      const s = big.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
      const bf = famOf(s);
      const z = fitSize(s, `600 {}px ${bf}`, w * 0.92, mn * 0.22);
      const q = eOut(seg(t, big[0].t0, big[0].t0 + 0.3));
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${(cy + z * 0.15).toFixed(1)}px;text-align:center;white-space:nowrap;font:600 ${z.toFixed(1)}px ${bf};letter-spacing:-0.06em;line-height:1;color:#fff;
        opacity:${q.toFixed(3)};transform:scaleY(${lerp(0.6, 1, q).toFixed(3)});transform-origin:50% 0;text-shadow:0 4px 24px rgba(0,0,0,.35)">${esc(s)}</div>`;
    }
    return backdrop(this, th) + html;
  };

  // ---------- departures: لوحة مواعيد قطر
  P.k_departures = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const bw = Math.min(r.w, w * 0.9);
    const sz = mn * 0.045 * this.ts;
    const tilt = (bi % 2 ? -1 : 1) * 4;
    const p = eOut(seg(t, b.t0, b.t0 + 0.4));
    const sec = 13 + Math.floor((t - b.t0) * 1);
    const x = r.x + (r.w - bw) / 2, y = r.y + r.h * 0.12;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#0E1A2B"></div>`;
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${bw.toFixed(1)}px;box-sizing:border-box;transform:perspective(${(w * 2).toFixed(0)}px) rotateY(${tilt}deg) scale(${lerp(1.1, 1, p).toFixed(3)});opacity:${p.toFixed(3)};
      background:#1B67C9;border:${(sz * 0.12).toFixed(1)}px solid #0D3E80;border-radius:${(sz * 0.3).toFixed(1)}px;box-shadow:0 ${(sz * 0.5).toFixed(1)}px ${(sz * 1.5).toFixed(1)}px rgba(0,0,0,.4);overflow:hidden">
      <div style="background:#0D3E80;color:#fff;font:700 ${(sz * 0.85).toFixed(1)}px ${ff};padding:${(sz * 0.35).toFixed(1)}px ${(sz * 0.6).toFixed(1)}px;display:flex;justify-content:space-between"><span>${ar ? "رصيف 1 · القطارات الجاية" : "Platform 1 · Upcoming"}</span><span>🚆</span></div>
      ${cs.map((c, i) => { const a = t >= c.t0 ? eOut(seg(t, c.t0, c.t0 + 0.2)) : 0; const s = this.text(c.w);
        return `<div style="display:flex;align-items:center;gap:${(sz * 0.5).toFixed(1)}px;padding:${(sz * 0.35).toFixed(1)}px ${(sz * 0.6).toFixed(1)}px;border-bottom:1px solid rgba(255,255,255,.18);color:#fff;opacity:${(0.25 + 0.75 * a).toFixed(3)}">
          <span dir="ltr" style="flex:none;width:${(sz * 1.3).toFixed(0)}px;height:${(sz * 1.3).toFixed(0)}px;border-radius:50%;background:#E0336B;display:flex;align-items:center;justify-content:center;font:700 ${(sz * 0.55).toFixed(0)}px 'TY Outfit'">R${i + 1}</span>
          <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 ${sz.toFixed(1)}px ${ff}">${a ? esc(s) : ""}</span>
          <span style="font:700 ${(sz * 0.9).toFixed(1)}px ${ff}">${a ? `${1 + i * 4} ${ar ? "د" : "Min"}` : ""}</span></div>`; }).join("")}
      <div dir="ltr" style="text-align:right;color:#fff;font:600 ${(sz * 0.9).toFixed(1)}px 'TY Pixel',monospace;padding:${(sz * 0.3).toFixed(1)}px ${(sz * 0.6).toFixed(1)}px">11:20:${String(sec % 60).padStart(2, "0")}</div></div>`;
    return html;
  };

  // ---------- loading: ترس بيلف وجملة الحالة
  P.k_loading = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const cy = h * 0.45, G = mn * 0.16;
    const s = it.filter((x) => t >= x.t0).map((x) => this.text(x.w)).join(" ");
    const dots = ".".repeat(1 + (Math.floor(t * 3) % 3));
    const gear = `<svg width="${G.toFixed(0)}" height="${G.toFixed(0)}" viewBox="0 0 24 24" style="transform:rotate(${((t - b.t0) * 120).toFixed(1)}deg)"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4-2.1.8a7 7 0 0 1-.6 1.5l1 2-1.7 1.7-2-1a7 7 0 0 1-1.5.6L13 21h-2l-.8-2.1a7 7 0 0 1-1.5-.6l-2 1L5 17.6l1-2a7 7 0 0 1-.6-1.5L3 13v-2l2.1-.8a7 7 0 0 1 .6-1.5l-1-2L6.4 5l2 1a7 7 0 0 1 1.5-.6L11 3h2l.8 2.1a7 7 0 0 1 1.5.6l2-1L19 6.4l-1 2a7 7 0 0 1 .6 1.5z" fill="#151515"/></svg>`;
    let html = `<div style="position:absolute;inset:0;background:#FAFAFA"></div>
      <div style="position:absolute;left:0;right:0;top:${(cy - G / 2).toFixed(0)}px;display:flex;justify-content:center;opacity:${eOut(seg(t, b.t0, b.t0 + 0.3)).toFixed(3)}">${gear}</div>`;
    if (s) { const z = fitSize(s + "...", `500 {}px ${ff}`, w * 0.84, mn * 0.055 * this.ts);
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${(cy + G * 0.9).toFixed(1)}px;text-align:center;white-space:nowrap;font:500 ${z.toFixed(1)}px ${ff};color:#333">${esc(s)}<span dir="ltr">${dots}</span></div>
        <div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${(cy + G * 0.9 + z * 1.8).toFixed(1)}px;text-align:center;font:400 ${(z * 0.7).toFixed(1)}px ${ff};color:#999">${ar ? "ممكن تقفل الصفحة، هنبعتلك لما يخلص" : "You can close this window, we'll let you know"}</div>`; }
    return html;
  };

  // ---------- countdown: أعمدة أرقام بتلف
  P.k_countdown = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const vid = onVideo(this);
    const ink = vid ? "#fff" : "#F3F3F3";
    const nums = it.map((x) => x.w.match(/[0-9٠-٩]+/)).filter(Boolean).map((m) => parseInt(m[0].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10));
    const base = [nums[0] ?? 14, 8, 12, 24];
    const labs = ar ? ["يوم", "ساعة", "دقيقة", "ثانية"] : ["DAYS", "HRS", "MIN", "SEC"];
    const cols = 4, cw = Math.min(w * 0.22, mn * 0.24);
    const sz = cw * 0.5;
    const cy = this.blockSolid(b) ? Math.min(h * 0.7, this.belowHead(b, sz)) : h * 0.5;
    const elapsed = t - b.t0;
    let html = vid ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,.55)"></div>` : `<div style="position:absolute;inset:0;background:#0E0E10"></div>`;
    for (let c = 0; c < cols; c++) {
      const roll = (1 - eOut(seg(t, b.t0 + c * 0.12, b.t0 + 0.6 + c * 0.12))) * 4;
      let v = base[c] - (c === 3 ? Math.floor(elapsed) : 0);
      if (v < 0) v += 60;
      const x = w / 2 + (c - (cols - 1) / 2) * cw;
      for (let q = -1; q <= 1; q++) {
        const y = cy + (q + roll - Math.round(roll)) * sz * 1.1 + Math.round(roll) * 0;
        const d = Math.abs(q + roll - Math.round(roll));
        const val = (v + q + 60) % 60;
        html += `<div dir="ltr" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;transform:translate(-50%,-50%);font:600 ${sz.toFixed(1)}px 'TY Outfit';letter-spacing:-0.04em;color:${ink};opacity:${clamp(1 - d * 0.55, 0.06, 1).toFixed(3)}">${String(val).padStart(2, "0")}</div>`;
      }
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${(cy + sz * 0.75).toFixed(1)}px;transform:translateX(-50%);font:600 ${(sz * 0.2).toFixed(1)}px ${famOf(labs[c])};letter-spacing:.12em;color:${ORG}">${labs[c]}</div>`;
    }
    const label = it.filter((x) => !/[0-9٠-٩]/.test(x.w) && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (label) { const z = fitSize(label, `600 {}px ${ff}`, w * 0.84, mn * 0.07);
      html += `<div dir="${this.dir(label)}" style="position:absolute;left:0;right:0;top:${(cy - sz * 2.6).toFixed(1)}px;text-align:center;white-space:nowrap;font:600 ${z.toFixed(1)}px ${ff};color:${ORG};letter-spacing:-0.02em">${esc(AR.test(label) ? label : label.toUpperCase())}</div>`; }
    return html;
  };

  // ---------- dragdrop: صور بتطير لجوه مربع الكتابة
  P.k_dragdrop = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const src = imgOf(b);
    if (src) this._want = src;
    const sz = mn * 0.04 * this.ts;
    const bw = Math.min(w * 0.86, sz * 19), bh = sz * 6.5;
    const bx = (w - bw) / 2, by = h * 0.55 - bh / 2;
    const names = it.map((x) => this.text(x.w)).slice(0, 5);
    const tw = sz * 2.6;
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#F4F4F2"></div>`;
    let landed = 0;
    let thumbs = "";
    names.forEach((nm, i) => {
      const t0 = it[i].t0;
      if (t < t0 - 0.1) return;
      const q = eOut(seg(t, t0, t0 + 0.55));
      if (q >= 1) landed++;
      const sx = w * (0.15 + ((i * 37) % 70) / 100), sy = h * 0.14 + (i % 2) * h * 0.08;
      const tx = bx + sz * 0.8 + i * (tw + sz * 0.4), ty = by + sz * 0.8;
      const x = lerp(sx, tx, q), y = lerp(sy, ty, q) - Math.sin(q * Math.PI) * mn * 0.06;
      const bg = src ? `url(${src}) ${(20 + i * 15) % 100}% 40%/300%` : `linear-gradient(160deg,${AVC[i % 4]},#ddd)`;
      thumbs += `<div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${tw.toFixed(1)}px;height:${tw.toFixed(1)}px;border-radius:${(sz * 0.3).toFixed(1)}px;background:${bg};transform:rotate(${((1 - q) * (i % 2 ? 8 : -8)).toFixed(1)}deg) scale(${lerp(1.3, 1, q).toFixed(3)});box-shadow:0 ${(sz * 0.2).toFixed(1)}px ${(sz * 0.5).toFixed(1)}px rgba(0,0,0,.25)">
        <span dir="${this.dir(nm)}" style="position:absolute;left:50%;top:${(tw + sz * 0.15).toFixed(0)}px;transform:translateX(-50%);white-space:nowrap;font:600 ${(sz * 0.5).toFixed(1)}px ${famOf(nm)};color:#fff;background:#2F7CF6;padding:0 ${(sz * 0.25).toFixed(1)}px;border-radius:${(sz * 0.15).toFixed(1)}px">${String(i + 1).padStart(2, "0")} ${esc(nm)}</span></div>`;
    });
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${bx.toFixed(1)}px;top:${by.toFixed(1)}px;width:${bw.toFixed(1)}px;height:${bh.toFixed(1)}px;box-sizing:border-box;background:#fff;border-radius:${(sz * 0.8).toFixed(1)}px;border:1px solid #E5E5E8;box-shadow:0 ${(sz * 0.3).toFixed(1)}px ${sz.toFixed(1)}px rgba(0,0,0,.12)">
      <div style="position:absolute;left:${(sz * 0.8).toFixed(0)}px;right:${(sz * 0.8).toFixed(0)}px;bottom:${(sz * 1.6).toFixed(0)}px;font:500 ${(sz * 0.85).toFixed(1)}px ${ff};color:#8A8A92">${landed ? (ar ? `ضيف الصور دي للقايمة (${landed})` : `Add these images to the lineup (${landed})`) : (ar ? "اسحب الصور هنا…" : "Drop images here…")}</div>
      <div style="position:absolute;left:${(sz * 0.8).toFixed(0)}px;right:${(sz * 0.8).toFixed(0)}px;bottom:${(sz * 0.5).toFixed(0)}px;display:flex;justify-content:space-between;font:600 ${(sz * 0.7).toFixed(1)}px 'TY Outfit';color:#555"><span>+</span><span style="background:#111;color:#fff;border-radius:${(sz * 0.3).toFixed(0)}px;padding:0 ${(sz * 0.4).toFixed(0)}px">➤</span></div></div>`;
    return html + thumbs;
  };

  // ---------- lineup: أسامي كبيرة فوق بعض والحالي منوّر
  P.k_lineup = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const src = imgOf(b);
    if (src) this._want = src;
    const ar = isAr(it);
    const shown = it.filter((x) => t >= x.t0);
    const ai = shown.length - 1;
    const sz = mn * 0.1;
    const font = cond(it.map((x) => x.w).join(""));
    const x0 = w * 0.06;
    const scroll = Math.max(0, ai - 3) * sz * 1.02;
    let html = `<div style="position:absolute;inset:0;background:#0C0C0E"></div>`;
    it.forEach((x, i) => {
      const s = AR.test(x.w) ? x.w : this.text(x.w).toUpperCase();
      const y = h * 0.2 + i * sz * 1.02 - scroll;
      if (y < -sz || y > h) return;
      const on = i === ai;
      html += `<div dir="${this.dir(s)}" style="position:absolute;${ar ? "right" : "left"}:${x0.toFixed(0)}px;top:${y.toFixed(1)}px;white-space:nowrap;font:400 ${fitSize(s, `400 {}px ${font}`, w * 0.62, sz).toFixed(1)}px ${font};line-height:1;color:${on ? ORG : i < ai ? "#EDEDED" : "#3A3A3E"};transition:none">${esc(s)}</div>`;
    });
    if (ai >= 0) {
      const pw = Math.min(w * 0.28, mn * 0.34), py = h * 0.2 + ai * sz * 1.02 - scroll - pw * 0.3;
      const q = eOut(seg(t, it[ai].t0, it[ai].t0 + 0.25));
      html += `<div style="position:absolute;${ar ? "left" : "right"}:${(w * 0.06).toFixed(0)}px;top:${py.toFixed(1)}px;width:${pw.toFixed(1)}px;height:${(pw * 1.2).toFixed(1)}px;border-radius:${(mn * 0.01).toFixed(0)}px;opacity:${q.toFixed(3)};
        background:${src ? `url(${src}) ${(30 + ai * 20) % 100}% 30%/260%` : `linear-gradient(160deg,${AVC[ai % 4]},#333)`};filter:grayscale(.2)"></div>`;
    }
    return html;
  };

  // ---------- isomap: خريطة أيزومتريك
  P.k_isomap = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const cs = chunks(it, Math.min(4, it.length));
    const S = mn * 0.16;
    const cx = w / 2, cy = h * 0.55;
    const iso = (gx, gy) => [cx + (gx - gy) * S * 0.87, cy + (gx + gy) * S * 0.5];
    const tiles = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [2, 0], [0, 2]];
    let svg = "";
    tiles.forEach(([gx, gy], i) => {
      const a = eOut(seg(t, b.t0 + i * 0.05, b.t0 + i * 0.05 + 0.3));
      const [x, y] = iso(gx, gy);
      const lift = (1 - a) * S;
      const ptsTop = [[0, -0.5], [0.87, 0], [0, 0.5], [-0.87, 0]].map(([dx, dy]) => `${(x + dx * S).toFixed(1)},${(y + dy * S - lift).toFixed(1)}`).join(" ");
      svg += `<polygon points="${ptsTop}" fill="${i % 3 ? "#E8622C" : "#F08A4B"}" stroke="#2A0F05" stroke-width="2" opacity="${a.toFixed(3)}"/>`;
    });
    let html = `<div style="position:absolute;inset:0;background:#141010"></div><div style="position:absolute;inset:0;background:linear-gradient(rgba(232,98,44,.12) 1px,transparent 1px) 0 0/${(S * 0.5).toFixed(0)}px ${(S * 0.5).toFixed(0)}px,linear-gradient(90deg,rgba(232,98,44,.12) 1px,transparent 1px) 0 0/${(S * 0.5).toFixed(0)}px ${(S * 0.5).toFixed(0)}px"></div>
      <svg width="${w}" height="${h}" style="position:absolute;inset:0">${svg}</svg>`;
    const spots = [[0, 0], [1, -1], [-1, 1], [1, 1]];
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const [x, y] = iso(...spots[i]);
      const s = this.text(c.w), z = fitSize(s, `700 {}px ${famOf(s)}`, S * 1.6, mn * 0.032);
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;transform:translate(-50%,-50%) scale(${eBack(seg(t, c.t0, c.t0 + 0.25)).toFixed(3)});white-space:nowrap;font:700 ${z.toFixed(1)}px ${famOf(s)};color:#fff;background:#2A0F05;padding:${(z * 0.2).toFixed(1)}px ${(z * 0.4).toFixed(1)}px;border-radius:${(z * 0.2).toFixed(1)}px">${esc(AR.test(s) ? s : s.toUpperCase())}</div>`;
    });
    const title = ar ? "المكان" : "VENUE";
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${ar ? "right" : "left"}:${(w * 0.06).toFixed(0)}px;top:${(h * 0.07).toFixed(0)}px;font:400 ${(mn * 0.16).toFixed(0)}px ${cond(title)};color:#fff;line-height:1">${title}</div>`;
    return html;
  };

  // ---------- stickers: كلمة عملاقة وحواليها تاجات مايلة
  P.k_stickers = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const n = it.length;
    const bigN = Math.max(1, Math.min(2, Math.ceil(n / 3)));
    const big = it.slice(n - bigN), tags = it.slice(0, n - bigN);
    const bg = [ORG, "#3B4BE8", "#E9E3D6"][bi % 3], ink = bi % 3 === 2 ? INK : "#111";
    let html = `<div style="position:absolute;inset:0;background:${bg}"></div>`;
    const spots = [[0.18, 0.3, -12], [0.55, 0.22, 8], [0.78, 0.36, -6], [0.3, 0.45, 10], [0.7, 0.5, -14], [0.12, 0.6, 6]];
    tags.forEach((x, i) => {
      if (t < x.t0) return;
      const s = AR.test(x.w) ? x.w : this.text(x.w).toUpperCase();
      const [fx, fy, rot] = spots[i % spots.length];
      const p = eBack(seg(t, x.t0, x.t0 + 0.25));
      const z = mn * 0.085;
      html += `<div dir="${this.dir(s)}" style="position:absolute;left:${(fx * w).toFixed(1)}px;top:${(fy * h).toFixed(1)}px;transform:translate(-50%,-50%) rotate(${rot}deg) scale(${p.toFixed(3)});white-space:nowrap;font:400 ${z.toFixed(1)}px ${cond(s)};color:${ink};border:${(z * 0.06).toFixed(1)}px solid ${ink};padding:${(z * 0.1).toFixed(1)}px ${(z * 0.3).toFixed(1)}px">${esc(s)}</div>`;
    });
    if (t >= big[0].t0) {
      const s = big.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" ");
      const z = fitSize(s, `400 {}px ${cond(s)}`, AR.test(s) ? w * 0.94 : w * 1.12, mn * 0.5);
      const q = eOut(seg(t, big[0].t0, big[0].t0 + 0.3));
      html += `<div data-free dir="${this.dir(s)}" style="position:absolute;left:50%;bottom:${(-z * 0.12).toFixed(0)}px;transform:translateX(-50%) translateY(${((1 - q) * z * 0.5).toFixed(1)}px);white-space:nowrap;font:400 ${z.toFixed(1)}px ${cond(s)};line-height:1;color:${ink}">${esc(s)}</div>`;
    }
    return html;
  };

  // =====================================================================
  // فيديو مرجعي 5 (مواقع لأصحاب المشاريع):
  //   promptline سطر كتابة صغير فوق الفيديو وزرار إرسال برتقاني في آخره
  //   crowd      بوستر أزرق: الشخص متكرر سيلويتات بيضا وعنوان كبير
  //   photohero  كارت صورة من الفيديو وكلمة عملاقة بيضا راكبة عليه
  //   menu       قايمة منسدلة والماوس بيعدّي على الاختيارات
  //   pricing    اختيارات منتج بأسعار وزرار اختيار بيتنقل
  //   pins       نقط مرقّمة بتطلع فوق صورة وعليها كلام
  //   result     كارت نتيجة بحث: اسم الموقع واللينك وعنوان أزرق ووصف
  //   calendar   كاليندر شهر وكارت موعد بيطلع على يوم
  //   mapdots    خريطة ودواير أماكن بتنبض وعليها أسامي
  //   marker     عنوان سيريف كبير وهايلايتر أصفر بيتسحب ورا جزء منه
  // =====================================================================
  P.k_promptline = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const txt = it.filter((x) => t >= x.t0).map((x, i, a) => (i === a.length - 1 ? typed(this.text(x.w), t, x.t0, 26) : this.text(x.w))).join(" ");
    const full = it.map((x) => this.text(x.w)).join(" ");
    const sz = fitSize(full, `500 {}px ${ff}`, w * 0.72, mn * 0.045 * this.ts);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.5;
    const done = t > it[it.length - 1].t0 + 0.4;
    return backdrop(this, th) + `<div style="position:absolute;left:0;right:0;top:${cy.toFixed(1)}px;transform:translateY(-50%);display:flex;justify-content:center;align-items:center;gap:${(sz * 0.4).toFixed(1)}px;opacity:${eOut(seg(t, b.t0, b.t0 + 0.25)).toFixed(3)}">
      <span dir="${ar ? "rtl" : "ltr"}" style="white-space:nowrap;font:500 ${sz.toFixed(1)}px ${ff};color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.45)">${esc(txt)}</span>
      <span style="flex:none;width:${(sz * 1.15).toFixed(0)}px;height:${(sz * 1.15).toFixed(0)}px;border-radius:${(sz * 0.25).toFixed(0)}px;background:${ORG};display:flex;align-items:center;justify-content:center;transform:scale(${done ? 1 + 0.08 * Math.sin(t * 9) : 1})">
        <svg width="${(sz * 0.6).toFixed(0)}" height="${(sz * 0.6).toFixed(0)}" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>`;
  };

  // ---------- crowd: بوستر أزرق وسيلويتات
  P.k_crowd = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const bg = ["#2D5BFF", ORG, "#151515"][bi % 3];
    let html = `<div style="position:absolute;inset:0;background:${bg}"></div>`;
    const a = this.personAt(t);
    if (a && this.doc.transparent) {
      const { y, w: iw, h: ih } = a.img, msrc = a.murl || a.url;
      this._want = msrc;
      const n = 4, sc = 0.55;
      for (let q = 0; q < n; q++) {
        const e = eOut(seg(t, b.t0 + q * 0.12, b.t0 + q * 0.12 + 0.35));
        const cx = w * (0.2 + q * 0.2);
        html += `<div style="position:absolute;left:${(cx - (iw * sc) / 2).toFixed(1)}px;top:${(y + ih * (1 - sc) + h * 0.05).toFixed(1)}px;width:${(iw * sc).toFixed(1)}px;height:${(ih * sc).toFixed(1)}px;background:#fff;opacity:${e.toFixed(3)};
          transform:translateX(${((1 - e) * w * 0.1).toFixed(1)}px);-webkit-mask:url(${msrc}) 0 0/100% 100% no-repeat;mask:url(${msrc}) 0 0/100% 100% no-repeat"></div>`;
      }
    }
    const s = it.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase()));
    const lines = [];
    for (let i = 0; i < s.length; i += Math.max(1, Math.ceil(s.length / 3))) lines.push(it.slice(i, i + Math.max(1, Math.ceil(s.length / 3))));
    const font = cond(s.join(""));
    const z = Math.min(...lines.map((ln) => fitSize(ln.map((x) => (AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())).join(" "), `400 {}px ${font}`, w * 0.86, mn * 0.16)));
    lines.forEach((ln, li) => {
      html += `<div dir="${AR.test(ln[0].w) ? "rtl" : "ltr"}" style="position:absolute;left:${(w * 0.07).toFixed(0)}px;right:${(w * 0.07).toFixed(0)}px;top:${(h * 0.08 + li * z * 1.02).toFixed(1)}px;white-space:nowrap;font:400 ${z.toFixed(1)}px ${font};line-height:1;color:#fff">${ln.map((x) => {
        const q = eOut(seg(t, x.t0, x.t0 + 0.2));
        return `<span style="display:inline-block;opacity:${q.toFixed(3)};transform:translateY(${((1 - q) * z * 0.3).toFixed(1)}px)">${esc(AR.test(x.w) ? x.w : this.text(x.w).toUpperCase())}</span>`;
      }).join(" ")}${li === lines.length - 1 ? ` <span dir="ltr" style="font-size:.5em;vertical-align:.6em">©${2026}</span>` : ""}</div>`;
    });
    return html;
  };

  // ---------- photohero: صورة وكلمة عملاقة راكبة عليها
  P.k_photohero = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const src = imgOf(b);
    if (src) this._want = src;
    const fi = b.focus >= 0 && b.focus < it.length ? b.focus : it.reduce((a2, x, i) => (x.w.length > it[a2].w.length ? i : a2), 0);
    const s = this.text(it[fi].w), ff = famOf(s);
    const cw = w * 0.86, chh = Math.min(h * 0.62, cw * 1.05);
    const x = (w - cw) / 2, y = (h - chh) / 2;
    const e = eOut(seg(t, b.t0, b.t0 + 0.5));
    const z = fitSize(s, `800 {}px ${ff}`, cw * 0.95, mn * 0.3);
    const q = eOut(seg(t, it[fi].t0, it[fi].t0 + 0.35));
    let html = `<div style="position:absolute;inset:0;background:${PAPER}"></div>
      <div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;height:${chh.toFixed(1)}px;overflow:hidden;transform:scale(${lerp(1.08, 1, e).toFixed(4)});opacity:${e.toFixed(3)};
        background:${src ? `url(${src}) center/cover` : "linear-gradient(160deg,#4E7A3A,#1E3A1A)"}">
        <div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;bottom:${(-z * 0.12).toFixed(1)}px;text-align:center;white-space:nowrap;font:800 ${z.toFixed(1)}px ${ff};letter-spacing:-0.05em;line-height:1;color:#fff;transform:translateY(${((1 - q) * z * 0.6).toFixed(1)}px)">${esc(s)}</div></div>
      ${dotCorners({ x, y, w: cw, h: chh }, mn * 0.01, ORG, e)}`;
    const rest = it.filter((x2, i) => i !== fi && t >= x2.t0).map((x2) => this.text(x2.w)).join(" ");
    if (rest) { const f2 = famOf(rest), z2 = fitSize(rest, `500 {}px ${SERIF(rest)}`, cw, mn * 0.05 * this.ts);
      html += `<div dir="${this.dir(rest)}" style="position:absolute;left:${x.toFixed(1)}px;right:${x.toFixed(1)}px;top:${(y + chh + z2 * 0.5).toFixed(1)}px;white-space:nowrap;font:400 ${z2.toFixed(1)}px ${SERIF(rest)};color:${INK}">${esc(rest)}</div>`; void f2; }
    return html;
  };

  // ---------- menu: قايمة منسدلة
  P.k_menu = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const sz = mn * 0.045 * this.ts;
    const mw = Math.min(r.w, w * 0.78), row = sz * 2;
    const x = r.x + (r.w - mw) / 2, y = r.y + Math.max(0, (r.h - cs.length * row) / 2);
    const p = eOut(seg(t, b.t0, b.t0 + 0.25));
    const shown = cs.filter((c) => t >= c.t0);
    const ai = shown.length - 1;
    const icons = ["◫", "⇪", "▤", "✦"];
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#7A1F24"></div>`;
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${mw.toFixed(1)}px;box-sizing:border-box;background:#fff;border-radius:${(sz * 0.4).toFixed(1)}px;padding:${(sz * 0.3).toFixed(1)}px;
      box-shadow:0 ${(sz * 0.3).toFixed(1)}px ${sz.toFixed(1)}px rgba(0,0,0,.25);transform:scaleY(${p.toFixed(3)});transform-origin:50% 0">
      ${cs.map((c, i) => `<div style="display:flex;align-items:center;gap:${(sz * 0.5).toFixed(1)}px;height:${(row - sz * 0.2).toFixed(1)}px;padding:0 ${(sz * 0.5).toFixed(1)}px;border-radius:${(sz * 0.25).toFixed(1)}px;
        background:${i === ai ? "#F0F0F2" : "transparent"};opacity:${t >= c.t0 ? 1 : 0.3}"><span style="font:400 ${sz.toFixed(0)}px 'TY Outfit';color:#555">${icons[i % 4]}</span>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:500 ${sz.toFixed(1)}px ${ff};color:#111">${t >= c.t0 ? esc(this.text(c.w)) : ""}</span></div>`).join("")}</div>`;
    if (ai >= 0) {
      const cyR = y + sz * 0.3 + ai * row + row * 0.55;
      html += cursorSvg(ar ? x + mw * 0.3 : x + mw * 0.7, cyR, sz * 0.9);
    }
    return html;
  };

  // ---------- pricing: اختيارات بأسعار
  P.k_pricing = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(3, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const sz = mn * 0.042 * this.ts;
    const cw = Math.min(r.w, w * 0.8), row = sz * 2.8;
    const x = r.x + (r.w - cw) / 2, y = r.y + Math.max(0, (r.h - cs.length * row - sz * 3) / 2);
    const shown = cs.filter((c) => t >= c.t0);
    const ai = shown.length - 1;
    const prices = [90, 75, 60, 120];
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#F7F3EE"></div>`;
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;box-sizing:border-box;background:#fff;border-radius:${(sz * 0.4).toFixed(1)}px;padding:${(sz * 0.8).toFixed(1)}px;box-shadow:0 ${(sz * 0.3).toFixed(1)}px ${sz.toFixed(1)}px rgba(0,0,0,.15);opacity:${eOut(seg(t, b.t0, b.t0 + 0.3)).toFixed(3)}">
      ${cs.map((c, i) => { const on = i === ai, vis = t >= c.t0;
        return `<div style="display:flex;align-items:center;gap:${(sz * 0.6).toFixed(1)}px;height:${row.toFixed(1)}px;border-bottom:1px solid #EEE;opacity:${vis ? 1 : 0.25}">
          <span style="flex:1;min-width:0"><span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:700 ${sz.toFixed(1)}px ${ff};color:#C0322D">${vis ? esc(this.text(c.w)) : "—"}</span>
          <span style="display:block;font:400 ${(sz * 0.6).toFixed(1)}px ${ff};color:#888">${ar ? "شحن مجاني · متاح" : "Free shipping · in stock"}</span></span>
          <span dir="ltr" style="font:600 ${sz.toFixed(1)}px 'TY Outfit';color:#111">$${prices[i % 4]}.00</span>
          <span style="flex:none;width:${(sz * 0.9).toFixed(0)}px;height:${(sz * 0.9).toFixed(0)}px;border-radius:50%;border:2px solid ${on ? "#C0322D" : "#BBB"};box-sizing:border-box;display:flex;align-items:center;justify-content:center">${on ? `<i style="width:55%;height:55%;border-radius:50%;background:#C0322D"></i>` : ""}</span></div>`; }).join("")}
      <div style="margin-top:${(sz * 0.8).toFixed(1)}px;text-align:center;background:#C0322D;color:#fff;font:700 ${(sz * 0.85).toFixed(1)}px ${ff};padding:${(sz * 0.45).toFixed(1)}px;border-radius:${(sz * 0.3).toFixed(1)}px">${ar ? "اطلب دلوقتي" : "PRE-ORDER"}</div></div>`;
    return html;
  };

  // ---------- pins: نقط مرقّمة على صورة
  P.k_pins = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const src = imgOf(b);
    if (src) this._want = src;
    const cs = chunks(it, Math.min(4, it.length));
    const ar = isAr(it);
    const cw = w * 0.88, chh = Math.min(h * 0.6, cw * 0.95);
    const x = (w - cw) / 2, y = (h - chh) / 2;
    const e = eOut(seg(t, b.t0, b.t0 + 0.4));
    const spots = [[0.25, 0.3], [0.72, 0.25], [0.6, 0.68], [0.22, 0.72]];
    let html = `<div style="position:absolute;inset:0;background:${PAPER}"></div>
      <div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;height:${chh.toFixed(1)}px;border-radius:${(mn * 0.02).toFixed(0)}px;opacity:${e.toFixed(3)};
        background:${src ? `url(${src}) center/cover` : "linear-gradient(160deg,#DCE6FF,#9CB3F0)"};box-shadow:0 ${(mn * 0.02).toFixed(0)}px ${(mn * 0.05).toFixed(0)}px rgba(0,0,0,.18)"></div>`;
    const pz = mn * 0.06;
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const [fx, fy] = spots[i];
      const px = x + fx * cw, py = y + fy * chh;
      const p = eBack(seg(t, c.t0, c.t0 + 0.3));
      const s = this.text(c.w), z = fitSize(s, `600 {}px ${famOf(s)}`, cw * 0.45, mn * 0.038 * this.ts);
      const right = fx < 0.5;
      html += `<div style="position:absolute;left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;width:${pz.toFixed(0)}px;height:${pz.toFixed(0)}px;transform:translate(-50%,-50%) scale(${p.toFixed(3)});border-radius:50%;background:#fff;border:${(pz * 0.06).toFixed(1)}px solid #111;
        display:flex;align-items:center;justify-content:center;font:700 ${(pz * 0.5).toFixed(1)}px 'TY Outfit';color:#111;box-shadow:0 0 0 ${(pz * 0.3 * (1 + Math.sin(t * 5))).toFixed(1)}px rgba(255,255,255,.35)">${i + 1}</div>
        <div dir="${this.dir(s)}" style="position:absolute;${right ? `left:${(px + pz * 0.7).toFixed(1)}px` : `right:${(w - px + pz * 0.7).toFixed(1)}px`};top:${py.toFixed(1)}px;transform:translateY(-50%);opacity:${clamp(p).toFixed(3)};white-space:nowrap;
          font:600 ${z.toFixed(1)}px ${famOf(s)};color:#111;background:#fff;padding:${(z * 0.2).toFixed(1)}px ${(z * 0.45).toFixed(1)}px;border-radius:${(z * 0.25).toFixed(1)}px;box-shadow:0 ${(z * 0.1).toFixed(1)}px ${(z * 0.4).toFixed(1)}px rgba(0,0,0,.18)">${esc(s)}</div>`;
    });
    void ar;
    return html;
  };

  // ---------- result: نتيجة بحث
  P.k_result = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const title = it.map((x) => this.text(x.w)).join(" ");
    const fi = focusOf(b, it);
    const site = AR.test(it[fi].w) ? (ar ? "موقعك" : "Site") : this.text(it[fi].w);
    const slug = AR.test(it[fi].w) ? "studio.app" : `${site.toLowerCase().replace(/[^a-z0-9]/g, "") || "studio"}.com`;
    const sz = mn * 0.05 * this.ts;
    const cw = Math.min(w * 0.9, sz * 18);
    const x = (w - cw) / 2, y = h * 0.34;
    const shown = it.filter((q) => t >= q.t0).map((q) => this.text(q.w)).join(" ");
    const a = eOut(seg(t, b.t0, b.t0 + 0.35));
    const tabs = ar ? ["الكل", "صور", "فيديوهات", "أخبار"] : ["All", "Images", "Videos", "News"];
    let html = `<div style="position:absolute;inset:0;background:#FFFFFF"></div>
      <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${(y - sz * 2.2).toFixed(1)}px;display:flex;gap:${(sz * 1).toFixed(1)}px;font:500 ${(sz * 0.7).toFixed(1)}px ${ff};color:#5F6368">${tabs.map((q, i) => `<span style="${i === 0 ? "color:#111;border-bottom:3px solid #111;padding-bottom:4px" : ""}">${q}</span>`).join("")}</div>
      <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;opacity:${a.toFixed(3)};transform:translateY(${((1 - a) * sz).toFixed(1)}px)">
        <div style="display:flex;align-items:center;gap:${(sz * 0.4).toFixed(1)}px"><span style="width:${(sz * 1.2).toFixed(0)}px;height:${(sz * 1.2).toFixed(0)}px;border-radius:50%;background:#3B4BE8;color:#fff;display:flex;align-items:center;justify-content:center;font:700 ${(sz * 0.6).toFixed(0)}px ${famOf(site)}">${esc([...site][0] || "S")}</span>
          <span><span style="display:block;font:500 ${(sz * 0.7).toFixed(1)}px ${famOf(site)};color:#202124">${esc(site)}</span><span dir="ltr" style="display:block;font:400 ${(sz * 0.6).toFixed(1)}px 'TY Outfit';color:#5F6368">https://www.${esc(slug)}</span></span></div>
        <div style="font:500 ${(sz * 1.1).toFixed(1)}px ${ff};color:#1A0DAB;margin-top:${(sz * 0.4).toFixed(1)}px;line-height:1.3">${esc(shown)}</div>
        <div style="font:400 ${(sz * 0.7).toFixed(1)}px ${ff};color:#4D5156;line-height:1.5;margin-top:${(sz * 0.3).toFixed(1)}px;opacity:${seg(t, it[it.length - 1].t0, it[it.length - 1].t0 + 0.4).toFixed(3)}">${esc(ar ? `${title}. اعرف كل حاجة عن ${site} واحجز دلوقتي وابدأ النهارده.` : `${title}. Learn everything about ${site}, book online and get started today.`)}</div></div>`;
    void fi;
    return html;
  };

  // ---------- calendar: شهر وموعد بيطلع على يوم
  P.k_calendar = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const src = imgOf(b);
    if (src) this._want = src;
    const gw = w * 0.92, cell = gw / 7, gh = cell * 5;
    const x0 = (w - gw) / 2, y0 = (h - gh) / 2 + mn * 0.03;
    const days = ar ? ["أحد", "اتنين", "تلات", "أربع", "خميس", "جمعة", "سبت"] : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const target = 10 + (bi % 12);
    const a = eOut(seg(t, b.t0, b.t0 + 0.3));
    let html = `<div style="position:absolute;inset:0;background:#FBFBFA"></div>`;
    days.forEach((d, i) => { html += `<div style="position:absolute;left:${(x0 + i * cell).toFixed(1)}px;top:${(y0 - mn * 0.05).toFixed(1)}px;width:${cell.toFixed(1)}px;text-align:center;font:600 ${(mn * 0.022).toFixed(1)}px ${famOf(d)};color:#888;opacity:${a.toFixed(3)}">${d}</div>`; });
    for (let q = 0; q < 35; q++) {
      const c = q % 7, rI = Math.floor(q / 7), day = q - 2;
      html += `<div style="position:absolute;left:${(x0 + c * cell).toFixed(1)}px;top:${(y0 + rI * cell).toFixed(1)}px;width:${cell.toFixed(1)}px;height:${cell.toFixed(1)}px;box-sizing:border-box;border:1px solid #ECECEE;opacity:${a.toFixed(3)}">
        <span dir="ltr" style="position:absolute;left:${(cell * 0.1).toFixed(0)}px;top:${(cell * 0.08).toFixed(0)}px;font:500 ${(cell * 0.16).toFixed(1)}px 'TY Outfit';color:${day === target ? ORG : "#999"}">${day > 0 && day <= 31 ? day : ""}</span></div>`;
    }
    const tq = target + 2, tc = tq % 7, tr2 = Math.floor(tq / 7);
    const p = eBack(seg(t, it[0].t0, it[0].t0 + 0.35));
    const s = it.filter((q) => t >= q.t0).map((q) => this.text(q.w)).join(" ");
    const ew = cell * 2.4, eh = cell * 2.4;
    const ex = clamp(x0 + tc * cell + cell / 2 - ew / 2, x0, x0 + gw - ew), ey = y0 + tr2 * cell + cell / 2 - eh / 2;
    html += `<div style="position:absolute;left:${ex.toFixed(1)}px;top:${ey.toFixed(1)}px;width:${ew.toFixed(1)}px;height:${eh.toFixed(1)}px;transform:scale(${p.toFixed(3)});border-radius:${(cell * 0.08).toFixed(0)}px;overflow:hidden;
      background:${src ? `url(${src}) center/cover` : "#2E6B3A"};box-shadow:0 ${(cell * 0.1).toFixed(0)}px ${(cell * 0.3).toFixed(0)}px rgba(0,0,0,.3)">
      <div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;bottom:0;padding:${(cell * 0.12).toFixed(0)}px;background:linear-gradient(transparent,rgba(0,0,0,.65));font:400 ${(cell * 0.2).toFixed(1)}px ${SERIF(s || "a")};color:#fff;line-height:1.1">${esc(s)}<span dir="ltr" style="display:block;font:600 ${(cell * 0.14).toFixed(1)}px 'TY Outfit'">${target}.08 · 2:00 PM</span></div></div>`;
    void ff;
    return html;
  };

  // ---------- mapdots: خريطة ودواير بتنبض
  P.k_mapdots = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const cs = chunks(it, Math.min(4, it.length));
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const cw = w * 0.88, chh = Math.min(h * 0.5, cw * 0.8);
    const x = (w - cw) / 2, y = (h - chh) / 2;
    const a = eOut(seg(t, b.t0, b.t0 + 0.35));
    const rr = rng(bi * 7 + 1);
    let roads = "";
    for (let q = 0; q < 9; q++) roads += `<path d="M${(rr() * cw).toFixed(0)} 0 C${(rr() * cw).toFixed(0)} ${(chh * 0.3).toFixed(0)} ${(rr() * cw).toFixed(0)} ${(chh * 0.7).toFixed(0)} ${(rr() * cw).toFixed(0)} ${chh.toFixed(0)}" stroke="#D6DCE6" stroke-width="${(mn * 0.004).toFixed(1)}" fill="none"/>`;
    let html = `<div style="position:absolute;inset:0;background:#F2EEE6"></div>
      <div style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;height:${chh.toFixed(1)}px;border-radius:${(mn * 0.025).toFixed(0)}px;overflow:hidden;background:#EEF1F5;opacity:${a.toFixed(3)};box-shadow:0 ${(mn * 0.015).toFixed(0)}px ${(mn * 0.04).toFixed(0)}px rgba(0,0,0,.15)">
        <svg width="${cw.toFixed(0)}" height="${chh.toFixed(0)}" style="position:absolute;inset:0">${roads}<path d="M0 ${(chh * 0.6).toFixed(0)} Q${(cw * 0.4).toFixed(0)} ${(chh * 0.4).toFixed(0)} ${cw.toFixed(0)} ${(chh * 0.7).toFixed(0)}" stroke="#BFD4F2" stroke-width="${(mn * 0.03).toFixed(0)}" fill="none"/></svg></div>
      <div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(x + mn * 0.03).toFixed(1)}px;top:${(y - mn * 0.06).toFixed(1)}px;font:600 ${(mn * 0.03).toFixed(1)}px ${ff};color:#111">${ar ? "المبيعات حسب المكان" : "Sales by location"}</div>`;
    const spots = [[0.3, 0.4], [0.65, 0.3], [0.5, 0.7], [0.8, 0.62]];
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const [fx, fy] = spots[i];
      const px = x + fx * cw, py = y + fy * chh;
      const p = eBack(seg(t, c.t0, c.t0 + 0.3));
      const R = mn * (0.035 + (i % 3) * 0.012);
      const pulse = 1 + 0.5 * ((t * 1.2 + i * 0.3) % 1);
      const s = this.text(c.w), z = fitSize(s, `600 {}px ${famOf(s)}`, cw * 0.4, mn * 0.032 * this.ts);
      html += `<div style="position:absolute;left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;width:${(R * 2).toFixed(0)}px;height:${(R * 2).toFixed(0)}px;transform:translate(-50%,-50%) scale(${(p * pulse).toFixed(3)});border-radius:50%;background:rgba(59,75,232,${(0.35 / pulse).toFixed(2)})"></div>
        <div style="position:absolute;left:${px.toFixed(1)}px;top:${py.toFixed(1)}px;width:${(R * 0.8).toFixed(0)}px;height:${(R * 0.8).toFixed(0)}px;transform:translate(-50%,-50%) scale(${p.toFixed(3)});border-radius:50%;background:#3B4BE8;border:2px solid #fff"></div>
        <div dir="${this.dir(s)}" style="position:absolute;left:${px.toFixed(1)}px;top:${(py + R * 1.1).toFixed(1)}px;transform:translateX(-50%);opacity:${clamp(p).toFixed(3)};white-space:nowrap;font:600 ${z.toFixed(1)}px ${famOf(s)};color:#111">${esc(s)}</div>`;
    });
    return html;
  };

  // ---------- marker: عنوان سيريف وهايلايتر أصفر
  P.k_marker = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it);
    const fi = focusOf(b, it);
    const sz = mn * 0.11 * this.ts * 0.8;
    const font = SERIF(ar ? "ع" : "a");
    const lines = this.wrapItems(it, `400 ${sz}px ${font}`, w * 0.84);
    const vid = onVideo(this);
    const ink = vid ? "#fff" : INK;
    const y0 = h * 0.62 - (lines.length - 1) * sz * 0.55;
    let html = vid ? `<div style="position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,.45))"></div>` : `<div style="position:absolute;inset:0;background:${PAPER}"></div>`;
    lines.forEach((ln, li) => {
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${(y0 + li * sz * 1.1).toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:400 ${sz.toFixed(1)}px ${font};line-height:1.1;color:${ink}">${ln.map((x) => {
        const q = eOut(seg(t, x.t0, x.t0 + 0.25)), hot = it.indexOf(x) === fi;
        const hl = hot ? seg(t, x.t0 + 0.1, x.t0 + 0.5) : 0;
        return `<span style="display:inline-block;opacity:${q.toFixed(3)};padding:0 ${(sz * 0.08).toFixed(1)}px;${hot ? `color:#111;background:linear-gradient(${ar ? 270 : 90}deg,#F7E733 ${(hl * 100).toFixed(0)}%,transparent ${(hl * 100).toFixed(0)}%)` : ""}">${esc(this.text(x.w))}</span>`;
      }).join(" ")}</div>`;
    });
    return html;
  };

  // =====================================================================
  // فيديو مرجعي 6 (لقاء مع عميل):
  //   lowerthird  اسم الشخص ووظيفته في كارت برتقاني تحت (لوار ثيرد)
  //   cardwords   كروت فوق بعض كل واحد فيه كلمة عملاقة (مضغوطة وسيريف) ونسبة
  //   bars        رسم بياني أعمدة أو خطوط بيكبر في كارت غامق
  //   table       جدول صفوفه بتدخل ورا بعض وفيها تاجات ملونة
  //   dayplan     جدول اليوم: مواعيد ملونة بتتحط على الساعات
  //   stutter     الكلمة بتتهته قبل ما تتكتب كاملة «فا فاس فاستر»
  // =====================================================================
  P.k_lowerthird = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const nameN = Math.min(2, it.length);
    const name = it.slice(0, nameN).map((x) => this.text(x.w)).join(" "), role = it.slice(nameN).map((x) => this.text(x.w)).join(" ");
    const sz = mn * 0.045 * this.ts;
    const e = eOut(seg(t, b.t0, b.t0 + 0.35)), e2 = eOut(seg(t, b.t0 + 0.2, b.t0 + 0.55));
    const bx = w * 0.06, by = h * (h > w ? 0.68 : 0.7);
    const nw = measure(name, `600 ${sz}px ${ff}`) + sz * 1.2;
    const rz = sz * 0.6, rw = role ? measure(role, `500 ${rz}px ${ff}`) + sz * 1.2 : 0;
    const side = ar ? "right" : "left";
    let html = `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${side}:${bx.toFixed(0)}px;top:${by.toFixed(0)}px;overflow:hidden;width:${(nw * e).toFixed(1)}px;white-space:nowrap;background:${ORG};color:#fff;font:600 ${sz.toFixed(1)}px ${ff};padding:${(sz * 0.2).toFixed(1)}px 0">
      <span style="padding:0 ${(sz * 0.6).toFixed(1)}px">${esc(name)}</span></div>`;
    if (role) html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;${side}:${bx.toFixed(0)}px;top:${(by + sz * 1.55).toFixed(0)}px;overflow:hidden;width:${(rw * e2).toFixed(1)}px;white-space:nowrap;background:#fff;color:#111;font:500 ${rz.toFixed(1)}px ${ff};padding:${(rz * 0.25).toFixed(1)}px 0">
      <span style="padding:0 ${(sz * 0.6).toFixed(1)}px">${esc(role)}</span></div>`;
    return backdrop(this, th) + html;
  };

  // ---------- cardwords: كروت فوق بعض بكلمات عملاقة
  P.k_cardwords = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const picks = it.slice().sort((a2, c) => c.w.length - a2.w.length).slice(0, 2).sort((a2, c) => a2.t0 - c.t0);
    const cards = [{ bg: "#C9C2FF", ink: "#111", f: (s) => cond(s), up: true, x: 0.08, y: 0.18, r: -2 }, { bg: "#F4C9C0", ink: "#7A1F24", f: (s) => SERIF(s), up: false, x: 0.36, y: 0.46, r: 3 }];
    let html = `<div style="position:absolute;inset:0;background:#EDEBE6"></div>`;
    picks.forEach((x, i) => {
      if (t < x.t0 - 0.1) return;
      const C = cards[i];
      const s = AR.test(x.w) ? x.w : C.up ? this.text(x.w).toUpperCase() : this.text(x.w);
      const cw = w * 0.56, chh = cw * 0.62;
      const p = eOut(seg(t, x.t0 - 0.1, x.t0 + 0.35));
      const z = fitSize(s, `400 {}px ${C.f(s)}`, cw * 1.05, chh * 0.7);
      const pct = 33 + ((bi * 7 + i * 11) % 9);
      html += `<div style="position:absolute;left:${(C.x * w).toFixed(1)}px;top:${(C.y * h).toFixed(1)}px;width:${cw.toFixed(1)}px;height:${chh.toFixed(1)}px;overflow:hidden;background:${C.bg};border-radius:${(mn * 0.015).toFixed(0)}px;
        transform:rotate(${C.r}deg) translateY(${((1 - p) * h * 0.2).toFixed(1)}px);opacity:${p.toFixed(3)};box-shadow:0 ${(mn * 0.015).toFixed(0)}px ${(mn * 0.04).toFixed(0)}px rgba(0,0,0,.18)">
        <div dir="ltr" style="position:absolute;left:${(cw * 0.05).toFixed(0)}px;top:${(chh * 0.06).toFixed(0)}px;font:500 ${(mn * 0.018).toFixed(1)}px 'TY Pixel',monospace;color:${C.ink};opacity:.7">ENGINE · COMPLEXITY · PROGRESS</div>
        <div dir="${this.dir(s)}" style="position:absolute;left:0;right:0;top:${(chh * 0.2).toFixed(0)}px;text-align:center;white-space:nowrap;font:400 ${z.toFixed(1)}px ${C.f(s)};line-height:1;color:${C.ink}">${esc(s)}</div>
        <div dir="ltr" style="position:absolute;right:${(cw * 0.05).toFixed(0)}px;bottom:${(chh * 0.06).toFixed(0)}px;font:600 ${(mn * 0.04).toFixed(1)}px 'TY Outfit';color:${C.ink}">${Math.round(pct * p)}%</div></div>`;
    });
    const rest = it.filter((x) => !picks.includes(x) && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (rest) { const f2 = famOf(rest), z2 = fitSize(rest, `500 {}px ${f2}`, w * 0.84, mn * 0.045 * this.ts);
      html += `<div dir="${this.dir(rest)}" style="position:absolute;left:0;right:0;top:${(h * 0.86).toFixed(0)}px;text-align:center;white-space:nowrap;font:500 ${z2.toFixed(1)}px ${f2};color:#111">${esc(rest)}</div>`; }
    return html;
  };

  // ---------- bars: أعمدة أو خطوط بتكبر
  P.k_bars = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const cw = Math.min(r.w, w * 0.88), chh = Math.min(r.h, cw * 0.75);
    const x = r.x + (r.w - cw) / 2, y = r.y + (r.h - chh) / 2;
    const title = it.map((q) => this.text(q.w)).join(" ");
    const lineMode = bi % 2 === 1;
    const rr = rng(bi * 13 + 2);
    const N = 9, vals = Array.from({ length: N }, () => 0.3 + rr() * 0.65);
    const gx = cw * 0.08, gy = chh * 0.3, gw = cw * 0.84, gh = chh * 0.58;
    const g = eOut(seg(t, b.t0 + 0.2, b.t0 + 1.3));
    let svg = "";
    if (lineMode) {
      ["#7C8CFF", "#FF7AB6", "#5AD1C4"].forEach((c, li) => {
        const pts = Array.from({ length: 30 }, (_, i) => [gx + (i / 29) * gw, gy + gh / 2 - Math.sin(i * 0.5 + li * 1.7 + bi) * gh * 0.35 * (0.6 + li * 0.2)]);
        const L = gw * 2.2;
        svg += `<path d="${pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="${(mn * 0.006).toFixed(1)}" stroke-dasharray="${L.toFixed(0)}" stroke-dashoffset="${(L * (1 - g)).toFixed(1)}"/>`;
      });
    } else {
      const bw = gw / N * 0.6;
      vals.forEach((v, i) => {
        const q = eOut(seg(t, b.t0 + 0.2 + i * 0.06, b.t0 + 0.7 + i * 0.06));
        const bh = gh * v * q;
        svg += `<rect x="${(gx + (i + 0.2) * (gw / N)).toFixed(1)}" y="${(gy + gh - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bw * 0.15).toFixed(1)}" fill="${i % 3 === 2 ? "#7C8CFF" : "#3B4BE8"}"/>`;
      });
    }
    const a = eOut(seg(t, b.t0, b.t0 + 0.3));
    return (onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#0E1020"></div>`) + `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;height:${chh.toFixed(1)}px;border-radius:${(mn * 0.02).toFixed(0)}px;background:#171A2E;opacity:${a.toFixed(3)};box-shadow:0 ${(mn * 0.015).toFixed(0)}px ${(mn * 0.05).toFixed(0)}px rgba(0,0,0,.35)">
      <div style="position:absolute;${ar ? "right" : "left"}:${(cw * 0.06).toFixed(0)}px;top:${(chh * 0.08).toFixed(0)}px;width:${(cw * 0.88).toFixed(0)}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 ${(mn * 0.042).toFixed(1)}px ${ff};color:#E8E9F5">${esc(title)}</div>
      <svg width="${cw.toFixed(0)}" height="${chh.toFixed(0)}" style="position:absolute;inset:0">${[0, 1, 2, 3].map((q) => `<line x1="${gx.toFixed(0)}" x2="${(gx + gw).toFixed(0)}" y1="${(gy + (q / 3) * gh).toFixed(0)}" y2="${(gy + (q / 3) * gh).toFixed(0)}" stroke="#2A2E48"/>`).join("")}${svg}</svg></div>`;
  };

  // ---------- table: جدول بتاجات
  P.k_table = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(5, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const cw = Math.min(r.w, w * 0.9);
    const sz = mn * 0.036 * this.ts, row = sz * 2.1;
    const x = r.x + (r.w - cw) / 2, y = r.y + Math.max(0, (r.h - (cs.length + 1) * row) / 2);
    const heads = ar ? ["المستوى", "الاسم", "التليفون"] : ["Level", "Name", "Phone"];
    const tags = [["L1", "#1F7A3A"], ["L2", "#2E8B4A"], [ar ? "طالب" : "Student", "#0F5C2A"], ["L3", "#3A9A5A"]];
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:${ORG}"></div>`;
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${cw.toFixed(1)}px;box-sizing:border-box;background:#fff;border-radius:${(sz * 0.3).toFixed(1)}px;overflow:hidden;box-shadow:0 ${(sz * 0.3).toFixed(1)}px ${sz.toFixed(1)}px rgba(0,0,0,.2);opacity:${eOut(seg(t, b.t0, b.t0 + 0.3)).toFixed(3)}">
      <div style="display:flex;background:#F3F3F3;font:600 ${(sz * 0.75).toFixed(1)}px ${ff};color:#555;height:${(row * 0.8).toFixed(1)}px;align-items:center">${heads.map((q, i) => `<span style="flex:${i === 1 ? 2 : 1};padding:0 ${(sz * 0.5).toFixed(1)}px;border-${ar ? "left" : "right"}:1px solid #E2E2E2">${q}</span>`).join("")}</div>
      ${cs.map((c, i) => { const a = eOut(seg(t, c.t0, c.t0 + 0.25)); if (t < c.t0) return ""; const [tg, col] = tags[(i + bi) % 4];
        return `<div style="display:flex;align-items:center;height:${row.toFixed(1)}px;border-top:1px solid #EEE;opacity:${a.toFixed(3)};transform:translateX(${((1 - a) * sz * 2 * (ar ? 1 : -1)).toFixed(1)}px)">
          <span style="flex:1;padding:0 ${(sz * 0.5).toFixed(1)}px"><span dir="ltr" style="display:inline-block;background:${col};color:#fff;font:600 ${(sz * 0.7).toFixed(1)}px ${famOf(tg)};padding:${(sz * 0.1).toFixed(1)}px ${(sz * 0.5).toFixed(1)}px;border-radius:${sz.toFixed(0)}px">${tg}</span></span>
          <span style="flex:2;padding:0 ${(sz * 0.5).toFixed(1)}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:500 ${sz.toFixed(1)}px ${ff};color:#111">${esc(this.text(c.w))}</span>
          <span dir="ltr" style="flex:1;padding:0 ${(sz * 0.5).toFixed(1)}px;font:500 ${(sz * 0.8).toFixed(1)}px 'TY Outfit';color:#555">+20 1${i}${(bi % 9)} ${300 + i * 47}</span></div>`; }).join("")}</div>`;
    return html;
  };

  // ---------- dayplan: مواعيد اليوم
  P.k_dayplan = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    const cs = chunks(it, Math.min(4, Math.max(1, Math.ceil(it.length / 2))));
    const ar = isAr(it), ff = famOf(ar ? "ع" : "a");
    const r = this.freeRect(b);
    const cw = Math.min(r.w, w * 0.88), sz = mn * 0.036 * this.ts;
    const hours = 6, hh = Math.min(r.h, h * 0.62) / hours;
    const x = r.x + (r.w - cw) / 2, y = r.y + Math.max(0, (r.h - hh * hours) / 2);
    const cols = ["#5BB8F5", "#F28A3C", "#E58BE0", "#9BD35A"];
    let html = onVideo(this) ? "" : `<div style="position:absolute;inset:0;background:#F7F7F9"></div>`;
    for (let q = 0; q < hours; q++) html += `<div dir="ltr" style="position:absolute;left:${x.toFixed(1)}px;top:${(y + q * hh).toFixed(1)}px;width:${cw.toFixed(1)}px;border-top:1px solid #E3E3E8;font:500 ${(sz * 0.7).toFixed(1)}px 'TY Outfit';color:#999;padding-top:${(sz * 0.2).toFixed(1)}px">${9 + q}:00</div>`;
    cs.forEach((c, i) => {
      if (t < c.t0) return;
      const p = eOut(seg(t, c.t0, c.t0 + 0.3));
      const top = y + (0.3 + i * 1.4) * hh, bh = hh * 1.1;
      if (top + bh > y + hh * hours) return;
      const s = this.text(c.w);
      html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:${(x + cw * 0.16).toFixed(1)}px;top:${top.toFixed(1)}px;width:${(cw * 0.8 * p).toFixed(1)}px;height:${bh.toFixed(1)}px;box-sizing:border-box;overflow:hidden;background:${cols[(i + bi) % 4]};border-radius:${(sz * 0.4).toFixed(1)}px;padding:${(sz * 0.4).toFixed(1)}px ${(sz * 0.6).toFixed(1)}px">
        <div style="white-space:nowrap;font:600 ${sz.toFixed(1)}px ${ff};color:#fff">${esc(s)}</div><div dir="ltr" style="font:500 ${(sz * 0.7).toFixed(1)}px 'TY Outfit';color:rgba(255,255,255,.85)">${9 + Math.round(0.3 + i * 1.4)}:00 – ${10 + Math.round(0.3 + i * 1.4)}:00</div></div>`;
    });
    return html;
  };

  // ---------- stutter: الكلمة بتتهته قبل ما تكمل
  P.k_stutter = function (b, t, k, th, bi) {
    const { w, h } = this.doc;
    const mn = Math.min(w, h);
    const it = this.items(b);
    if (!it.length) return "";
    const fi = focusOf(b, it);
    const word = this.text(it[fi].w), ff = famOf(word);
    const chars = [...word];
    const sz = fitSize(word, `600 {}px ${ff}`, w * 0.6, mn * 0.18);
    const cy = this.blockSolid(b) ? this.belowHead(b, sz) : h * 0.5;
    const ink = inkOf(this, th);
    // تهتهة: حرفين، تلاتة، وبعدين الكلمة كلها، والنسخ اللي قبلها باهتة جنبها
    const steps = [Math.min(2, chars.length), Math.min(3, chars.length), chars.length];
    const dt = 0.14;
    const t0 = it[fi].t0;
    let html = backdrop(this, th);
    const pieces = steps.filter((n, i) => t >= t0 + i * dt).map((n, i, arr) => ({ s: chars.slice(0, n).join(""), last: i === arr.length - 1 }));
    const ar = AR.test(word);
    const line = pieces.map((p, i) => `<span style="display:inline-block;margin:0 ${(sz * 0.12).toFixed(1)}px;opacity:${p.last ? 1 : 0.28 + i * 0.12};${p.last ? "" : `font-size:${(sz * 0.8).toFixed(1)}px;`}letter-spacing:-0.04em">${esc(p.s)}</span>`).join("");
    html += `<div dir="${ar ? "rtl" : "ltr"}" style="position:absolute;left:0;right:0;top:${cy.toFixed(1)}px;transform:translateY(-50%);text-align:center;white-space:nowrap;font:600 ${sz.toFixed(1)}px ${ff};color:${ink};${shadow(this)}">${line}</div>`;
    const rest = it.filter((x, i) => i !== fi && t >= x.t0).map((x) => this.text(x.w)).join(" ");
    if (rest) { const f2 = famOf(rest), z = fitSize(rest, `500 {}px ${f2}`, w * 0.84, mn * 0.05 * this.ts);
      html += `<div dir="${this.dir(rest)}" style="position:absolute;left:0;right:0;top:${(cy - sz * 0.95).toFixed(1)}px;text-align:center;white-space:nowrap;font:500 ${z.toFixed(1)}px ${f2};color:${ink};opacity:.8;${shadow(this)}">${esc(rest)}</div>`; }
    // أرقام صغيرة بتعدّ جنبها (زي المرجع)
    const n1 = Math.round(117 * seg(t, b.t0, b.t1)), n2 = Math.round(346 * seg(t, b.t0, b.t1));
    html += `<div dir="ltr" style="position:absolute;left:${(w * 0.1).toFixed(0)}px;top:${(cy - sz * 1.8).toFixed(0)}px;font:500 ${(mn * 0.05).toFixed(1)}px 'TY Outfit';color:${ink};opacity:.55">${n1}<br>${n2}</div>`;
    return html;
  };
})();
