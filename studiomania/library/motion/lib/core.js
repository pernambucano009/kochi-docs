// Shared toolkit for the motion reels. Every reel page sets window.W/H/DUR, builds its DOM once in init(),
// and draws a frame purely from time in seek(t). Nothing here keeps state between frames.
(function () {
  const M = {};
  M.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  M.seg = (t, a, b) => M.clamp((t - a) / (b - a));
  M.lerp = (a, b, k) => a + (b - a) * k;
  M.mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  M.expo = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
  M.expoIn = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, 10 * k - 10));
  M.expoIO = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k < .5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2);
  M.cubic = (k) => 1 - Math.pow(1 - M.clamp(k), 3);
  M.cubicIO = (k) => { k = M.clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  M.quint = (k) => 1 - Math.pow(1 - M.clamp(k), 5);
  M.sine = (k) => -(Math.cos(Math.PI * M.clamp(k)) - 1) / 2;
  M.smooth = (k) => { k = M.clamp(k); return k * k * (3 - 2 * k); };
  // critically damped spring (no overshoot); s = seconds since start
  M.spring = (s, w = 16) => (s <= 0 ? 0 : 1 - (1 + w * s) * Math.exp(-w * s));
  // under-damped spring with a small overshoot (z ~ .7 → ~5%)
  M.springO = (s, w = 14, z = .7) => { if (s <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s)); };
  M.rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  M.hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  M.noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return M.lerp(M.hash(i), M.hash(i + 1), u) * 2 - 1; };
  M.noise2 = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h = (a, b) => M.hash(a * 57 + b * 131); return (M.lerp(M.lerp(h(i, j), h(i + 1, j), u), M.lerp(h(i, j + 1), h(i + 1, j + 1), u), v)) * 2 - 1; };
  M.beatIn = (t, B) => ({ n: Math.floor(t / B), f: (t / B) % 1 });

  // ---------- DOM
  M.stage = null;
  M.el = (tag, cls, css, html, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; (parent || M.stage).appendChild(e); return e; };
  M.svg = (tag, attrs = {}, parent) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  M.X = (e, x, y, sx = 1, sy = sx, r = 0) => { e.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})`; };
  M.show = (e, on) => { e.style.display = on ? "" : "none"; };
  M.op = (e, a) => { e.style.opacity = a; };
  // 🎨 لون الدايرة/الكارت اللي ورا الشعار: الأبعد عن متوسط ألوان الشعار (شعار أخضر على دايرة خضرا كان بيختفي). colors = الاختيارات بالترتيب
  M.contrastFor = (img, colors) => {
    if (!img) return colors[0];
    try {
      const cv = document.createElement("canvas"); cv.width = cv.height = 48; const g = cv.getContext("2d"); g.drawImage(img, 0, 0, 48, 48);
      const px = g.getImageData(0, 0, 48, 48).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++; }
      if (!n) return colors[0];
      const hx = (h) => { const v = parseInt(String(h).replace("#", "").slice(0, 6), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
      const d = (h) => { const [a1, b1, c1] = hx(h); return Math.hypot(a1 - r / n, b1 - gg / n, c1 - b / n); };
      const first = colors[0];
      return d(first) > 110 ? first : colors.slice().sort((p, q) => d(q) - d(p))[0];   // لو اللون الأصلي باين كفاية بيفضل هو
    } catch (e) { return colors[0]; }
  };
  M.canvas = (w, h, css = "", parent) => { const c = M.el("canvas", "", `position:absolute;left:0;top:0;${css}`, null, parent); c.width = w; c.height = h; return c; };

  // ---------- params: كل عنصر بيعلن الحاجات اللي بتتعدّل فيه (كلام، ألوان، لوجو...) وقيمها الأصلية.
  // القيم الجديدة بتيجي في اللينك (#p=JSON) أو window.PARAMS. لازم M.params تتنادى في أول الصفحة قبل أي حاجة بتستخدمها.
  const AR_RANGE = "U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F";
  let given = {};
  try { const h = location.hash.match(/[#&]p=([^&]*)/); if (h) given = JSON.parse(decodeURIComponent(h[1])); } catch (e) { given = {}; }
  // ⚙️ صيغة القالب (v1) — كل خانة ممكن تزوّد عليها (كلهم اختياري):
  //   group: اسم المشهد اللي الخانة فيه (المحرر بيقسّم الخانات عليه وبيقفز للمشهد ده)
  //   hint: نصيحة للعميل يحط إيه بالظبط علشان يطلع أحسن نتيجة · max: أقصى عدد حروف مقترح
  //   img: { ratio: "1:1", cut: true (من غير خلفية), tip: "..." } للصور
  //   kind: text | lines | image | color | font | select | look | number | toggle
  //   font: script = "ar" | "lat" | "any" · select: options = [[القيمة، الاسم]] · number: min, max, step, unit
  //   look: اختيار بالصور، options = [[القيمة، الاسم، صورة جنب القالب، {خانة: قيمة}]]: الاختيار بيحط قيمه في الخانات اللي ماتحددتش
  M.params = (schema) => {
    window.PARAM_SCHEMA = schema;
    const extra = window.PARAMS || {}, out = {};
    for (const k in schema) {
      const f = schema[k], v = k in extra ? extra[k] : given[k];
      out[k] = v === undefined || v === null ? f.def : v;   // فاضي = فاضي (مش القيمة الأصلية)
      if (f.kind === "color" && !/^#[0-9a-f]{3,8}$/i.test(String(out[k]))) out[k] = f.def;
      if (f.kind === "font" && !M.FONTS[out[k]]) out[k] = f.def;
      if ((f.kind === "select" || f.kind === "look") && !(f.options || []).some((o) => String(o[0]) === String(out[k]))) out[k] = f.def;
      if (f.kind === "number") { const n = parseFloat(out[k]); out[k] = isNaN(n) ? f.def : Math.min(f.max ?? n, Math.max(f.min ?? n, n)); }
      if (f.kind === "toggle") out[k] = out[k] === true || out[k] === "true" || out[k] === 1 || out[k] === "1";
      if (Array.isArray(f.def) && !Array.isArray(out[k])) out[k] = String(out[k]).split("\n").map((x) => x.trim()).filter(Boolean);
    }
    for (const k in schema) {
      if (schema[k].kind !== "look") continue;
      const set = (schema[k].options.find((o) => String(o[0]) === String(out[k])) || [])[3] || {};
      for (const pk in set) if (pk in schema && !(pk in extra) && given[pk] === undefined) out[pk] = set[pk];
    }
    M.P = out;
    return out;
  };
  // قصة القالب ومشاهده: المحرر بيعرضها فوق الخانات، والتايم لاين بيتقسم عليها
  //   M.meta({ story: "...", scenes: [{ name: "البداية", t0: 0, t1: 3.2, about: "..." }], tips: ["..."] })
  M.meta = (m) => { window.TEMPLATE_META = m; return m; };
  // 🔤 الخطوط اللي العميل يقدر يختار منها (kind: "font"). script: ar = عربي، lat = لاتيني، any = الاتنين
  M.FONTS = {
    alexandria: { file: "TY-Alexandria-800.ttf", weight: "800", label: "الإسكندرية (عريض)", script: "ar" },
    alexandria5: { file: "TY-Alexandria-500.ttf", weight: "500", label: "الإسكندرية (عادي)", script: "ar" },
    plex: { file: "TY-PlexArabic-700.ttf", weight: "700", label: "بلكس عربي", script: "ar" },
    plex4: { file: "TY-PlexArabic-400.ttf", weight: "400", label: "بلكس عربي (رفيع)", script: "ar" },
    changa: { file: "SM-Changa.ttf", weight: "400", label: "شنقا", script: "ar" },
    lalezar: { file: "SM-Lalezar.ttf", weight: "400", label: "لاله‌زار (إعلاني)", script: "ar" },
    tajawal: { file: "SM-Tajawal.ttf", weight: "400", label: "تجوّل", script: "ar" },
    amiri: { file: "TY-Amiri-700.ttf", weight: "700", label: "أميري (كلاسيك)", script: "ar" },
    ruqaa: { file: "TY-ArefRuqaa-700.ttf", weight: "700", label: "رقعة", script: "ar" },
    outfit: { file: "TY-Outfit-800.ttf", weight: "800", label: "Outfit", script: "lat" },
    inter: { file: "inter600.ttf", weight: "600", label: "Inter", script: "lat" },
    gabarito: { file: "TY-Gabarito-800.ttf", weight: "800", label: "Gabarito", script: "lat" },
    archivo: { file: "archivoblack.ttf", weight: "400", label: "Archivo Black", script: "lat" },
    anton: { file: "anton.ttf", weight: "400", label: "Anton", script: "lat" },
    bebas: { file: "bebas.ttf", weight: "400", label: "Bebas", script: "lat" },
    serif: { file: "Instrument_Serif.ttf", weight: "400", label: "Instrument Serif", script: "lat" },
    caveat: { file: "Caveat_wght_500.ttf", weight: "500", label: "Caveat (خط إيد)", script: "lat" },
    jost: { file: "Jost.ttf", weight: "400", label: "Jost", script: "lat" },
  };
  // بيحمّل الخط اللي اتختار باسم عيلة ثابت (fam) يتكتب بيه في الكانفاس: `${M.FONTS[k].weight} 80px ${fam}`
  // الخط العربي بيتحط زي ما هو، واللاتيني بياخد الحروف العربي من Alexandria زي M.fonts
  M.font = async (fam, key) => {
    const f = M.FONTS[key] || M.FONTS.alexandria, faces = [new FontFace(fam, `url(../../fonts/${f.file})`, { weight: f.weight })];
    if (f.script === "lat") faces.push(new FontFace(fam, `url(../../fonts/${+f.weight >= 600 ? "TY-Alexandria-800.ttf" : "TY-Alexandria-500.ttf"})`, { weight: f.weight, unicodeRange: AR_RANGE }));
    faces.forEach((x) => document.fonts.add(x));
    await Promise.all(faces.map((x) => x.load().catch(() => {})));
    return f.weight;
  };
  M.img = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

  // ---------- 🧩 عناصر مكتبة المجال (خانة els في القالب): تحميل، وتوقيت الدور، وستايلات بالكود
  // M.els(PR.els, max) ← صور العناصر المتحملة (الفاضي بيتشال)
  //   الفراغ الشفاف حوالين العنصر بيتقص، فكل العناصر بتبان بحجمها الحقيقي
  M.trim = (im) => {
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, W0 = c.width, H0 = c.height, rows = new Uint32Array(H0), cols = new Uint32Array(W0);
    for (let y = 0; y < H0; y += 2) for (let x = 0; x < W0; x += 2) if (d[(y * W0 + x) * 4 + 3] > 100) { rows[y]++; cols[x]++; }
    // صفوف وعواميد فيها العنصر فعلًا (مش نقط متفرقة على الأطراف)
    const rmin = Math.max(2, W0 * .006), cmin = Math.max(2, H0 * .006); let x0 = 0, x1 = W0 - 1, y0 = 0, y1 = H0 - 1;
    while (y0 < H0 && rows[y0] < rmin) y0++; while (y1 > y0 && rows[y1] < rmin) y1--; while (x0 < W0 && cols[x0] < cmin) x0++; while (x1 > x0 && cols[x1] < cmin) x1--;
    if (y0 >= H0 || x0 >= W0) return im; const p = 6; x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(c.width - 1, x1 + p); y1 = Math.min(c.height - 1, y1 + p);
    const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext("2d").drawImage(c, -x0, -y0); return o;
  };
  // ⏱️ window.ELS_AT = ثانية بداية الجملة بتاعة كل عنصر في الفيديو النهائي (من توقيت التعليق الصوتي). لو موجودة كل عنصر
  //   بيظهر مع كلمته بالظبط (M.turns / M.elsWin)، والقوالب اللي بتعرض عنصر ورا التاني (max = Infinity) بتاخد كل العناصر.
  M._elsAt = null;
  M.els = async (list, max = 8) => {
    const at = Array.isArray(window.ELS_AT) ? window.ELS_AT : null;
    const src = (list || []).map((u, i) => [u, at ? +at[i] : NaN]).filter((p) => p[0]).slice(0, Number.isFinite(max) ? max : 40);
    const got = (await Promise.all(src.map(async ([u, s]) => [await M.img(u), s]))).filter((p) => p[0]);
    const tt = M._at || ((x) => x);
    M._elsAt = at && got.length && got.every((p) => Number.isFinite(p[1])) ? got.map((p) => tt(p[1])) : null;
    return got.map((p) => M.trim(p[0]));
  };
  // نافذة العنصر k من n (بوقت القالب): مع كلمته لو التوقيت معروف، وإلا بالتساوي بين t0 وt1. الأخير بيفضل لآخر الفيديو.
  M.elsWin = (k, n, t0, t1, hold = 1.25, outS = .5) => {
    const A = M._elsAt && M._elsAt.length === n ? M._elsAt : null;
    if (!A) { const D = (t1 - t0) / Math.max(1, n), s0 = t0 + k * D; return [s0, k === n - 1 ? t1 + 9 : s0 + D * hold]; }
    const st = (i) => Math.max(t0, A[i]);
    return [st(k), k === n - 1 ? t1 + 9 : Math.max(st(k) + .3, st(k + 1) + outS * .6)];
  };
  // M.turns(t, n, t0, t1, hold) ← العناصر اللي ظاهرة دلوقتي: [{k, s0, s1, u (٠←١ عمره), in (دخول ٠←١), out (خروج ٠←١)}]
  //   كل عنصر ليه دور D، وبيفضل hold×D (أكبر من ١ = تداخل)، والأخير بيفضل لحد t1
  M.turns = (t, n, t0, t1, hold = 1.25, inS = .6, outS = .5) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const [s0, s1] = M.elsWin(k, n, t0, t1, hold, outS);
      if (t < s0 || t > s1) continue;
      out.push({ k, s0, s1, u: M.clamp((t - s0) / (s1 - s0)), in: M.clamp((t - s0) / inS), out: k === n - 1 ? 0 : M.clamp((t - (s1 - outS)) / outS) });
    }
    return out;
  };
  // كانفس بمقاس معيّن والصورة جواه مظبوطة (contain)
  const fitCv = (im, w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); const sc = Math.min(w / im.width, h / im.height); g.drawImage(im, (w - im.width * sc) / 2, (h - im.height * sc) / 2, im.width * sc, im.height * sc); return c; };
  M.fx = {
    fit: fitCv,
    // ظل بلون واحد (خيال الظل، القص، الهالات)
    silhouette(im, color, w = 600, h = 600) { const c = fitCv(im, w, h), g = c.getContext("2d"); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, w, h); return c; },
    // خطوط الحدود بلون واحد (مخطط هندسي، آرت ديكو، رسومات بالخط)
    edges(im, color, w = 600, h = 600, thr = 38, thick = 1) {
      const c = fitCv(im, w, h), g = c.getContext("2d"), d = g.getImageData(0, 0, w, h), p = d.data, L = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) L[i] = p[i * 4 + 3] < 40 ? 255 : (.3 * p[i * 4] + .59 * p[i * 4 + 1] + .11 * p[i * 4 + 2]) * .6 + 60;
      const o = g.createImageData(w, h), q = o.data, [r, gg, b] = M.rgbOf(color);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, gx = L[i + 1] - L[i - 1] + (L[i + 1 - w] - L[i - 1 - w] + L[i + 1 + w] - L[i - 1 + w]) / 2, gy = L[i + w] - L[i - w] + (L[i + w + 1] - L[i - w + 1] + L[i + w - 1] - L[i - w - 1]) / 2;
        const m = Math.hypot(gx, gy); if (m < thr) continue;
        for (let a = 0; a < thick; a++) for (let bb = 0; bb < thick; bb++) { const j = ((y + a) * w + x + bb) * 4; q[j] = r; q[j + 1] = gg; q[j + 2] = b; q[j + 3] = Math.min(255, m * 2.2); }
      }
      g.clearRect(0, 0, w, h); g.putImageData(o, 0, 0); return c;
    },
    // نقط طباعة (halftone) بلون واحد: الحتة الأغمق نقطتها أكبر
    halftone(im, color, w = 600, h = 600, step = 9) {
      const src = fitCv(im, w, h), d = src.getContext("2d").getImageData(0, 0, w, h).data, c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = color;
      for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) { const i = (Math.floor(y) * w + Math.floor(x)) * 4; if (d[i + 3] < 60) continue; const l = (.3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2]) / 255, rr = step * .62 * Math.sqrt(Math.max(.08, 1 - l)); g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); }
      return c;
    },
    // بكسل: الصورة بتتصغّر وترجع كبيرة من غير تنعيم، بألوان محدودة (palette = مصفوفة ألوان hex اختيارية)
    pixelate(im, px, w = 600, h = 600, palette) {
      const s = document.createElement("canvas"); s.width = Math.ceil(w / px); s.height = Math.ceil(h / px); const sg = s.getContext("2d"); sg.drawImage(fitCv(im, w, h), 0, 0, s.width, s.height);
      const d = sg.getImageData(0, 0, s.width, s.height), p = d.data, pal = (palette || []).map(M.rgbOf);
      for (let i = 0; i < p.length; i += 4) { p[i + 3] = p[i + 3] > 110 ? 255 : 0; if (pal.length && p[i + 3]) { let best = pal[0], bd = 1e9; for (const c of pal) { const dd = (c[0] - p[i]) ** 2 + (c[1] - p[i + 1]) ** 2 + (c[2] - p[i + 2]) ** 2; if (dd < bd) { bd = dd; best = c; } } p[i] = best[0]; p[i + 1] = best[1]; p[i + 2] = best[2]; } }
      sg.putImageData(d, 0, 0); const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(s, 0, 0, w, h); return c;
    },
    // ألوان قليلة (بوستر/طباعة حريرية): كل بكسل بياخد أقرب لون من palette، والنتيجة طبقات بعدد الألوان (ترتيب palette)
    posterize(im, palette, w = 600, h = 600) {
      const src = fitCv(im, w, h), d = src.getContext("2d").getImageData(0, 0, w, h).data, pal = palette.map(M.rgbOf), layers = pal.map(() => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; });
      const datas = layers.map((c) => c.getContext("2d").createImageData(w, h));
      for (let i = 0; i < w * h; i++) { if (d[i * 4 + 3] < 90) continue; const l = (.3 * d[i * 4] + .59 * d[i * 4 + 1] + .11 * d[i * 4 + 2]); let bi = 0, bd = 1e9; pal.forEach((c, k) => { const dd = (c[0] - d[i * 4]) ** 2 + (c[1] - d[i * 4 + 1]) ** 2 + (c[2] - d[i * 4 + 2]) ** 2 + ((.3 * c[0] + .59 * c[1] + .11 * c[2]) - l) ** 2 * 2; if (dd < bd) { bd = dd; bi = k; } }); const q = datas[bi].data; q[i * 4] = pal[bi][0]; q[i * 4 + 1] = pal[bi][1]; q[i * 4 + 2] = pal[bi][2]; q[i * 4 + 3] = 255; }
      layers.forEach((c, k) => c.getContext("2d").putImageData(datas[k], 0, 0)); return layers;
    },
    // حفر خشب: خطوط أفقية متموجة بيتغير سمكها مع النور (الحتة المنورة خطها أتخن)، بلون واحد
    engrave(im, color, w = 600, h = 600, gap = 7) {
      const src = fitCv(im, w, h), d = src.getContext("2d").getImageData(0, 0, w, h).data, c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = color;
      for (let y = 0; y < h; y += gap) for (let x = 0; x < w; x += 2) { const yy = Math.min(h - 1, Math.round(y + Math.sin(x * .05) * 2)), i = (yy * w + x) * 4; if (d[i + 3] < 70) continue; const l = (.3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2]) / 255, th = gap * (.18 + .75 * l); g.fillRect(x, yy - th / 2, 2, th); }
      return c;
    },
  };
  M.rgbOf = (h) => { const m = String(h).match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/); if (m) return [+m[1], +m[2], +m[3]]; const n = parseInt(String(h).replace("#", "").slice(0, 6).replace(/^(.)(.)(.)$/, "$1$1$2$2$3$3"), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  M.isAr = (s) => /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(String(s || ""));
  // أكبر مقاس يخلّي الكلام في العرض ده (بين min و max)
  M.fit = (text, fam, maxW, max, min = 12, weight = "") => { let s = max; while (s > min && M.measure(text, `${weight} ${s}px ${fam}`.trim()) > maxW) s -= 2; return s; };

  // ---------- fonts (files live in pm/fonts; pages are pm/r/NNN/reel.html)
  // كل خط بياخد الحروف العربي من Alexandria (unicode-range)، فأي كلام عربي بيظهر صح في أي عنصر
  M.fonts = async (map) => {
    const all = Object.entries(map).flatMap(([fam, spec]) => {
      const [file, weight = "400", style = "normal"] = Array.isArray(spec) ? spec : [spec];
      const f = new FontFace(fam, `url(../../fonts/${file})`, { weight, style });
      const ar = new FontFace(fam, `url(../../fonts/${+weight >= 600 ? "TY-Alexandria-800.ttf" : "TY-Alexandria-500.ttf"})`, { weight, style, unicodeRange: AR_RANGE });
      document.fonts.add(f);
      document.fonts.add(ar);
      return [f.load().catch((e) => console.error('font failed: ' + file + ' ' + e)), ar.load().catch(() => {})];
    });
    await Promise.all(all);
    await document.fonts.ready;
  };
  const mc = document.createElement("canvas").getContext("2d");
  M.measure = (text, font, spacing = 0) => { mc.font = font; return mc.measureText(text).width + spacing * Math.max(0, [...text].length - 1); };

  // split text into absolutely positioned glyph spans inside a container; returns [{s, x, w, ch}]
  // العربي مينفعش يتقطع حروف (الحروف بتتشبك)، فبيتقطع كلمات ويتحط من اليمين للشمال
  M.glyphs = (parent, text, font, opts = {}) => {
    const sp = opts.spacing || 0, out = [];
    let x = 0;
    if (M.isAr(text)) {
      const words = String(text).split(/(\s+)/).filter((w) => w.length);
      const ws = words.map((w) => M.measure(w, font));
      const total = ws.reduce((a, b) => a + b, 0);
      let r = total;
      words.forEach((w, i) => {
        r -= ws[i];
        if (/^\s+$/.test(w)) return;
        const s = M.el("span", "", `position:absolute;left:0;top:0;font:${font};white-space:pre;direction:rtl;${opts.css || ""}`, null, parent);
        s.textContent = w;
        out.push({ s, x: r, w: ws[i], ch: w });
      });
      out.width = total;
      return out;
    }
    for (const ch of [...text]) {
      const w = M.measure(ch, font);
      const s = M.el("span", "", `position:absolute;left:0;top:0;font:${font};white-space:pre;${opts.css || ""}`, null, parent);
      s.textContent = ch;
      out.push({ s, x, w, ch });
      x += w + sp;
    }
    out.width = x - sp;
    return out;
  };

  // ---------- sound: synthesise a track offline and return a base64 WAV
  M.track = async (dur, build) => {
    const sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const noise = ctx.createBuffer(1, sr * 2, sr), nd = noise.getChannelData(0);
    let s = 9; for (let i = 0; i < nd.length; i++) { s = (s * 16807) % 2147483647; nd[i] = (s / 2147483647) * 2 - 1; }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.connect(ctx.destination);
    const out = ctx.createGain(); out.gain.value = .9; out.connect(comp);
    const A = {
      ctx, out, noise,
      kick(t0, g0 = .9) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + .13); g.gain.setValueAtTime(g0, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .32); o.connect(g).connect(out); o.start(t0); o.stop(t0 + .35); },
      nz(t0, d, type = "highpass", f = 7000, g0 = .15, q = .7, pan = 0) { const b = ctx.createBufferSource(); b.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(g0, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + d); const p = ctx.createStereoPanner(); p.pan.value = pan; b.connect(fl).connect(g).connect(p).connect(out); b.start(t0, Math.random() * .5); b.stop(t0 + d + .02); },
      hat(t0, g0 = .12) { A.nz(t0, .05, "highpass", 8000, g0); },
      snare(t0, g0 = .35) { A.nz(t0, .18, "bandpass", 1800, g0, .8); A.tone(t0, 190, .08, "triangle", g0 * .6); },
      clap(t0, g0 = .3) { for (let i = 0; i < 3; i++) A.nz(t0 + i * .012, .12, "bandpass", 1300, g0, 1.2); },
      hit(t0, g0 = .55) { A.nz(t0, .45, "lowpass", 2600, g0); A.tone(t0, 52, .7, "sine", g0 * 1.2); },
      tone(t0, f, d, type = "sine", g0 = .2, a = .005, pan = 0) { const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(g0, t0 + a); g.gain.exponentialRampToValueAtTime(.0001, t0 + d); p.pan.value = pan; o.connect(g).connect(p).connect(out); o.start(t0); o.stop(t0 + d + .05); return o; },
      pluck(t0, f, g0 = .16, d = .4) { A.tone(t0, f, d, "triangle", g0); A.tone(t0, f * 2, d * .5, "sine", g0 * .3); },
      bass(t0, f, d = .4, g0 = .3) { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = "sawtooth"; o.frequency.value = f; fl.type = "lowpass"; fl.frequency.setValueAtTime(900, t0); fl.frequency.exponentialRampToValueAtTime(160, t0 + d); g.gain.setValueAtTime(g0, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + d); o.connect(fl).connect(g).connect(out); o.start(t0); o.stop(t0 + d + .05); },
      pad(t0, freqs, d, g0 = .05) { freqs.forEach((f, i) => { for (const det of [-6, 6]) { const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det; fl.type = "lowpass"; fl.frequency.value = 1400; g.gain.setValueAtTime(.0001, t0); g.gain.linearRampToValueAtTime(g0, t0 + Math.min(1, d / 3)); g.gain.setValueAtTime(g0, t0 + d * .7); g.gain.linearRampToValueAtTime(.0001, t0 + d); o.connect(fl).connect(g).connect(out); o.start(t0); o.stop(t0 + d + .05); } }); },
      riser(t0, t1, g0 = .4) { const b = ctx.createBufferSource(); b.buffer = noise; b.loop = true; const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 2; fl.frequency.setValueAtTime(300, t0); fl.frequency.exponentialRampToValueAtTime(7000, t1); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(g0, t1 - .02); g.gain.setValueAtTime(0, t1); b.connect(fl).connect(g).connect(out); b.start(t0); b.stop(t1 + .02); },
      whoosh(t0, d = .4, g0 = .25) { const b = ctx.createBufferSource(); b.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 1.5; fl.frequency.setValueAtTime(400, t0); fl.frequency.exponentialRampToValueAtTime(3500, t0 + d * .6); fl.frequency.exponentialRampToValueAtTime(800, t0 + d); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(g0, t0 + d * .5); g.gain.exponentialRampToValueAtTime(.0001, t0 + d); b.connect(fl).connect(g).connect(out); b.start(t0); b.stop(t0 + d + .02); },
      click(t0, g0 = .2) { A.nz(t0, .02, "highpass", 3000, g0); },
      // 🔊 أصوات الحركات (sfx.js): ظهور صغير، خبطة، انزلاق على قد طول الحركة. pan = يمين/شمال حسب مكانها في الشاشة
      pop(t0, g0 = .1, pan = 0) { const o = A.tone(t0, 1150, .09, "sine", g0, .002, pan); o.frequency.setValueAtTime(1150, t0); o.frequency.exponentialRampToValueAtTime(560, t0 + .07); A.nz(t0, .015, "highpass", 5000, g0 * .5, .7, pan); },
      thud(t0, g0 = .25, pan = 0) { const o = A.tone(t0, 95, .3, "sine", g0 * 1.4, .003, pan); o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + .25); A.nz(t0, .14, "lowpass", 900, g0 * .7, .7, pan); },
      swish(t0, d = .35, g0 = .14, pan = 0) { const b = ctx.createBufferSource(); b.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = 1.2; fl.frequency.setValueAtTime(600, t0); fl.frequency.exponentialRampToValueAtTime(4200, t0 + d * .45); fl.frequency.exponentialRampToValueAtTime(1100, t0 + d); const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(g0, t0 + d * .4); g.gain.exponentialRampToValueAtTime(.0001, t0 + d); const p = ctx.createStereoPanner(); p.pan.setValueAtTime(pan - .25 * Math.sign(pan || 1), t0); p.pan.linearRampToValueAtTime(pan, t0 + d); b.connect(fl).connect(g).connect(p).connect(out); b.start(t0, Math.random() * .5); b.stop(t0 + d + .02); },
      // a steady groove: kick each beat, hat on the off-beat, optional snare on 2/4
      groove(bpm, t0, t1, o = {}) { const B = 60 / bpm; for (let t = t0, k = 0; t < t1 - .01; t += B, k++) { if (o.kick !== false) A.kick(t, o.kg || .85); if (o.hat !== false) A.hat(t + B / 2, o.hg || .1); if (o.snare && k % 2 === 1) A.snare(t, o.sg || .3); } },
    };
    A.midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    await build(A);
    const buf = await ctx.startRendering();
    const n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)], wav = new DataView(new ArrayBuffer(44 + n * 4));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); wav.setUint32(4, 36 + n * 4, true); ws(8, "WAVEfmt "); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true); wav.setUint32(24, sr, true); wav.setUint32(28, sr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); ws(36, "data"); wav.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) wav.setInt16(44 + (i * 2 + c) * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
    let bin = ""; const u8 = new Uint8Array(wav.buffer); for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return btoa(bin);
  };

  // ---------- ⏱️ منظّم الوقت: كل مشهد (من M.meta) بياخد طول جملة الفويس أوفر بتاعته
  //   window.TIMING (أو #tm=[...] في اللينك) = طول كل مشهد بالثواني بنفس ترتيب M.meta.scenes (0 أو فاضي = زي ما هو).
  //   لحد ١.٥ مرة أسرع/أبطأ المشهد بيتمط أو يتضغط كله؛ لو الجملة أطول من كده المشهد بيتمط ١.٥ ويقف ثابت قبل آخره
  //   (آخر ١٥٪ فيه الخروج للمشهد اللي بعده) لحد ما الجملة تخلص. المزيكا والمؤثرات بتتنقل معاه.
  const MAXS = 1.5;
  function timeMap(dur) {
    let tm = window.TIMING;
    try { const h = location.hash.match(/[#&]tm=([^&]*)/); if (h) tm = JSON.parse(decodeURIComponent(h[1])); } catch (e) { /* لينك بايظ = من غير تنظيم */ }
    const sc = ((window.TEMPLATE_META || {}).scenes || []).map((x, i) => ({ a: +x.t0, b: Math.min(+x.t1, dur), d: +(tm || [])[i] || 0 }));
    if (!Array.isArray(tm) || !sc.length || !sc.some((x) => x.d > 0)) return null;
    // أجزاء متصلة من ٠ لآخر القالب: المشاهد، والفراغات بينها بتفضل زي ما هي
    const parts = []; let cur = 0;
    sc.filter((x) => x.b > x.a).sort((p, q) => p.a - q.a).forEach((x) => {
      const a = Math.max(x.a, cur); if (a > cur) parts.push({ a: cur, b: a, d: a - cur });
      if (x.b > a) parts.push({ a, b: x.b, d: x.d > 0 ? x.d : x.b - a }); cur = Math.max(cur, x.b);
    });
    if (cur < dur) parts.push({ a: cur, b: dur, d: dur - cur });
    // كل جزء بيتحول لقطع (طول حقيقي ← من/لحد في وقت القالب)؛ القطعة الثابتة من = لحد
    const segs = []; let r = 0;
    parts.forEach(({ a, b, d }) => {
      const L = b - a;
      if (d <= L * MAXS + 1e-6) segs.push({ r0: r, r1: r + d, a, b });
      else { const m = a + L * .85, hold = d - L * MAXS; segs.push({ r0: r, r1: r + (m - a) * MAXS, a, b: m }, { r0: r + (m - a) * MAXS, r1: r + (m - a) * MAXS + hold, a: m, b: m }, { r0: r + (m - a) * MAXS + hold, r1: r + d, a: m, b }); }
      r += d;
    });
    const real = (t) => { const s = segs.find((x) => t < x.r1) || segs[segs.length - 1]; return s.a + (s.b - s.a) * Math.min(1, Math.max(0, (t - s.r0) / ((s.r1 - s.r0) || 1))); };
    const fwd = (o) => { const s = segs.find((x) => o < x.b && x.b > x.a) || segs[segs.length - 1]; return s.b > s.a ? s.r0 + (s.r1 - s.r0) * Math.min(1, Math.max(0, (o - s.a) / (s.b - s.a))) : s.r0; };
    return { dur: r, real, fwd };
  }
  // الصوت بالوقت الجديد: كل دالة في A أول رقم فيها وقت بدايتها (والريزر كمان وقت نهايته)
  const warpA = (A, fwd) => {
    const B = Object.create(A);
    ["kick", "nz", "hat", "snare", "clap", "hit", "tone", "pluck", "bass", "pad", "whoosh", "click", "pop", "thud", "swish"].forEach((k) => { if (A[k]) B[k] = (t0, ...rest) => A[k](fwd(t0), ...rest); });
    if (A.riser) B.riser = (t0, t1, ...rest) => A.riser(fwd(t0), Math.max(fwd(t0) + .05, fwd(t1)), ...rest);
    if (A.groove) B.groove = (bpm, t0, t1, ...rest) => A.groove(bpm, fwd(t0), fwd(t1), ...rest);
    return B;
  };

  // 🔊 أصوات الحركات: sfx.js جنب القالب (tools/motionsfx/make.py) فيه لحظات الحركة، وبتتحط تحت صوت القالب نفسه.
  //   أي لحظة القالب حاطط عليها مؤثر بإيده (whoosh/hit/click/nz/riser) مابيتحطش عليها تاني. window.SFX_OFF = true يقفلها.
  const loadSfx = () => window.SFX !== undefined || window.SFX_OFF ? Promise.resolve() : new Promise((res) => {
    const s = document.createElement("script"); s.src = "sfx.js"; s.onload = s.onerror = () => res(); document.head.appendChild(s);
  });
  const withSfx = async (A, sound) => {
    const hand = [], B = Object.create(A);
    ["whoosh", "hit", "click", "nz"].forEach((k) => { B[k] = (t0, ...r) => { hand.push(t0); return A[k](t0, ...r); }; });
    B.riser = (t0, t1, ...r) => { hand.push(t1); return A.riser(t0, t1, ...r); };
    await sound(B);
    const cues = Array.isArray(window.SFX) && !window.SFX_OFF ? window.SFX : [];
    const k = (M.SFX_GAIN ?? .45) * (hand.length >= 12 ? .6 : 1);   // قالب صوته متصمم بالكامل: أصوات الحركات أهدى
    cues.forEach(([t, kind, g, pan = 0, d = 0]) => {
      if (hand.some((h) => Math.abs(h - t) < .15)) return;
      if (kind === "swish") A.swish(t, d || .35, g * k, pan); else if (kind === "thud") A.thud(t, g * k, pan); else A.pop(t, g * k, pan);
    });
  };

  // ---------- boot: a reel calls M.reel({W,H,DUR,fonts,init,seek,sound})
  M.reel = (o) => {
    const W = o.W || 1920, H = o.H || 1080;
    const TM = timeMap(o.DUR), DUR = TM ? TM.dur : o.DUR, at = TM ? TM.real : (t) => t;
    M._at = at;   // وقت الفيديو النهائي ← وقت القالب (لتوقيت العناصر)
    if (TM && window.TEMPLATE_META) window.TEMPLATE_META = { ...window.TEMPLATE_META, scenes: window.TEMPLATE_META.scenes.map((x) => ({ ...x, t0: TM.fwd(+x.t0), t1: TM.fwd(+x.t1 - 1e-4) })) };
    window.W = W; window.H = H; window.DUR = DUR; window.SUB = o.SUB || 2;
    document.documentElement.style.cssText = `margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${o.bg || "#000"}`;
    document.body.style.cssText = `margin:0;width:${W}px;height:${H}px;overflow:hidden;`;
    M.stage = document.createElement("div");
    M.stage.id = "v";
    M.stage.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:hidden;background:${o.bg || "#000"};`;
    document.body.appendChild(M.stage);
    let ctx = null;
    window.ready = (async () => { if (o.fonts) await M.fonts(o.fonts); ctx = await o.init(M); o.seek(0, ctx, M); })();
    window.seek = (t) => { if (ctx) o.seek(Math.min(at(t), o.DUR - 1e-4), ctx, M); };
    window.soundtrack = async () => { await loadSfx(); return M.track(DUR, (A) => withSfx(TM ? warpA(A, TM.fwd) : A, (B) => o.sound(B, M))); };
  };
  window.M = M;
})();
