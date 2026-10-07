// StudioMania — محرّك التايبوجرافي: بيرسم الكلام المتحرك فريم فريم.
// كل حاجة على الشاشة دالة في الوقت بس (renderAt(t))، فنفس الملف ده بيعرض المعاينة في الصفحة،
// وبيرسم الفيديو النهائي في المتصفح اللي على السيرفر فريم ورا فريم (من غير ما يفرق بينهم حاجة).
//
// الخطة (doc):
//   { w, h, duration, style: {font, case, grain, light: {bg, ink, accent}, dark: {...}, accent: {...}},
//     transparent: true لو الخلفية صورة أو فيديو (السيرفر بيركّبها تحت)،
//     blocks: [{ t0, t1, kind, theme, text, words: [{w, t0, t1}], focus, icon, icons, letter, side, scribble }] }
//
// أنواع الحركة (kind):
//   pop      كلمة كبيرة لوحدها على كارت ملوّن، وفي الآخر شريط أسود بيشطبها
//   type     سطر بيتكتب حرف حرف على قد الكلام ومعاه مؤشر (وخربشة قلم لو scribble)
//   build    الكلام بيظهر كلمة كلمة وهو بيتقال، وكلمة focus بتنوّر بلون مختلف، وإضاءة بتعدّي ورا السطر
//   icon     كلمة ومعاها أيقونة بتدخل بلفّة، والمؤشر بيرمش جنب الكلمة
//   letters  الكلمة بحروف متباعدة، وحرف منها (letter) بيتبدّل بصور (icons) واحدة ورا التانية
//   scatter  الحروف متبعترة في الشاشة وبتتجمّع لحد ما تبقى الكلمة
//   ring     أيقونات (icons) في دايرة بتلف، وفي النص كلام صغير (اختياري)
// side: صورة/أيقونة كبيرة جنب الكلام في build (زي صورة الشخص في الفيديو المرجع)

(function () {
  const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
  const ZWJ = "‍";
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
  const easeInOut = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  const back = (k) => { k = clamp(k); const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // عشوائي بس ثابت: نفس البلوك بيطلع نفس الشكل في المعاينة وفي الفيديو
  function rng(seed) {
    let s = (seed * 9301 + 49297) % 233280 || 1;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  // خربشة قلم: منحنيات بتلف على نفسها زي إمضا (بالبكسل في مساحة الشاشة)
  function scribblePath(r, cx, cy, wd, ht, loops) {
    const step = wd / loops;
    let x = cx - wd / 2, y = cy + (r() - 0.5) * ht * 0.3;
    let d = `M${x.toFixed(1)},${y.toFixed(1)}`;
    for (let j = 0; j < loops; j++) {
      const nx = x + step * (0.7 + r() * 0.6), ny = cy + (r() - 0.5) * ht * 0.5;
      const up = (r() > 0.5 ? -1 : 1) * ht * (0.6 + r() * 0.6);
      d += ` C${(x + step * 1.3).toFixed(1)},${(y + up).toFixed(1)} ${(nx - step * 1.2).toFixed(1)},${(ny + up).toFixed(1)} ${nx.toFixed(1)},${ny.toFixed(1)}`;
      x = nx; y = ny;
    }
    return d;
  }
  function scribbleSvg(doc, d, color, width, prog, opacity = 0.85) {
    const len = 6000;
    return `<svg viewBox="0 0 ${doc.w} ${doc.h}" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">
      <path d="${d}" fill="none" stroke="${color}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"
        pathLength="${len}" stroke-dasharray="${len}" stroke-dashoffset="${(len * (1 - clamp(prog))).toFixed(1)}" opacity="${opacity}"/></svg>`;
  }

  const DEFAULT_STYLE = {
    font: "SM Tajawal", case: "none", grain: 0.12, weight: 700,
    light: { bg: "#ECEBE8", ink: "#141414", accent: "#E5322D" },
    dark: { bg: "#0E0E0F", ink: "#F4F4F2", accent: "#E5322D" },
    accent: { bg: "#E9B21C", ink: "#2A1A08", accent: "#141414" },
  };

  // الحروف لوحدها: العربي بيفضل متوصّل بشكله حتى وكل حرف في span لوحده
  function glyphs(word) {
    const chars = [...word];
    if (!AR.test(word)) return chars;
    return chars.map((c, i) => (i ? ZWJ : "") + c + (i < chars.length - 1 ? ZWJ : ""));
  }

  class TypoEngine {
    constructor(stage, doc) {
      this.stage = stage;
      this.set(doc);
    }

    set(doc) {
      this.doc = doc;
      this.style = { ...DEFAULT_STYLE, ...(doc.style || {}) };
      for (const k of ["light", "dark", "accent"]) this.style[k] = { ...DEFAULT_STYLE[k], ...((doc.style || {})[k] || {}) };
      const { w, h } = doc;
      this.u = Math.min(w, h) / 100;   // وحدة المقاسات: 1% من الضلع الصغير
      this.ts = h > w * 1.2 ? 1.5 : 1;  // الكلام الصغير بيكبر في الطولي (الموبايل)
      Object.assign(this.stage.style, {
        width: `${w}px`, height: `${h}px`, position: "relative", overflow: "hidden", direction: "ltr",
        fontFamily: `"${this.style.font}", "SM Tajawal", sans-serif`, fontWeight: this.style.weight,
      });
      this.stage.classList.add("typo-stage");
    }

    // الصور لازم تكون اتحملت قبل أول فريم (السيرفر بيستنى ده قبل ما يصوّر)
    ready() {
      const urls = new Set();
      for (const b of this.doc.blocks || []) for (const u of [b.icon, b.side, ...(b.icons || [])]) if (u) urls.add(u);
      const imgs = [...urls].map((u) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = u; }));
      return Promise.all([TypoEngine.font(this.style.font), TypoEngine.font("SM Tajawal"), ...imgs]);
    }

    theme(b) {
      return this.style[b?.theme] || this.style.light;
    }

    text(s) {
      const c = this.style.case;
      return c === "upper" ? s.toUpperCase() : c === "lower" ? s.toLowerCase() : s;
    }

    words(b) {
      if (b.words?.length) return b.words;
      const ws = String(b.text || "").split(/\s+/).filter(Boolean);
      const span = (b.t1 - b.t0) * 0.7 / Math.max(1, ws.length);
      return ws.map((w, i) => ({ w, t0: b.t0 + i * span, t1: b.t0 + (i + 1) * span }));
    }

    renderAt(t) {
      const blocks = this.doc.blocks || [];
      const i = blocks.findIndex((b) => t >= b.t0 && t < b.t1);
      const b = blocks[i];
      const th = this.theme(b);
      const bg = this.doc.transparent ? "transparent" : th.bg;
      let html = "";
      if (b) {
        const k = (t - b.t0) / Math.max(0.01, b.t1 - b.t0);
        const fn = this[`k_${b.kind}`] || this.k_build;
        const zoom = 1 + 0.035 * easeInOut(k);    // الكاميرا مش واقفة أبدًا: زووم خفيف طول البلوك
        html = `<div class="ty-cam" style="position:absolute;inset:0;transform:scale(${zoom.toFixed(4)})">${fn.call(this, b, t, k, th, i)}</div>`;
        // أول لحظة في البلوك: فلاش صغير (القطع بيبان مقصود)
        const flash = 1 - clamp((t - b.t0) / 0.08);
        if (flash > 0 && i > 0) html += `<div style="position:absolute;inset:0;background:${th.ink};opacity:${(flash * 0.12).toFixed(3)}"></div>`;
      }
      if (!this.doc.transparent) html += this.vignette(th);
      if (this.style.grain > 0 && !this.doc.transparent) html += this.grain(t);   // فوق صورة/فيديو: الحبيبات بتتحط في FFmpeg
      this.stage.style.background = bg;
      this.stage.style.color = th.ink;
      this.stage.innerHTML = html;
    }

    vignette(th) {
      return `<div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center, transparent 55%, ${th.ink === "#F4F4F2" ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.10)"} 100%)"></div>`;
    }

    grain(t) {
      const tiles = TypoEngine.noise();
      const f = Math.floor(t * 12) % tiles.length;   // الحبيبات بتتغير 12 مرة في الثانية زي الفيلم
      return `<div style="position:absolute;inset:0;pointer-events:none;opacity:${this.style.grain};mix-blend-mode:overlay;
        background-image:url(${tiles[f]});background-size:${Math.round(this.u * 40)}px"></div>`;
    }

    cursor(t, th, size) {
      const on = Math.floor(t * 2.2) % 2 === 0;
      return `<span style="display:inline-block;width:${(size * 0.09).toFixed(1)}px;height:${(size * 0.95).toFixed(1)}px;background:${th.ink};
        margin-inline-start:${(size * 0.35).toFixed(1)}px;vertical-align:-0.12em;opacity:${on ? 1 : 0}"></span>`;
    }

    dir(s) {
      return AR.test(s) ? "rtl" : "ltr";
    }

    center(inner, extra = "") {
      return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;${extra}">${inner}</div>`;
    }

    // ---- pop: كلمة كبيرة على كارت ملون وبتتشطب في الآخر
    k_pop(b, t, k, th) {
      const u = this.u, size = u * 22;
      const inK = easeOut((t - b.t0) / 0.18);
      const strike = easeInOut((k - 0.72) / 0.2);
      const txt = this.text(b.text || "");
      const dash = `repeating-linear-gradient(90deg, ${th.ink} 0 ${u * 2}px, transparent ${u * 2}px ${u * 3.4}px)`;
      return `<div style="position:absolute;inset:0;background:${th.bg}"></div>
        <div style="position:absolute;left:0;right:0;top:${u * 8}px;height:${u * 0.35}px;background:${dash};opacity:.55"></div>
        <div style="position:absolute;left:0;right:0;bottom:${u * 8}px;height:${u * 0.35}px;background:${dash};opacity:.55"></div>`
        + this.center(`<div dir="${this.dir(txt)}" style="position:relative;font-size:${size}px;line-height:1;letter-spacing:-0.03em;color:${th.ink};
            transform:scale(${lerp(1.18, 1, inK).toFixed(3)});opacity:${inK.toFixed(3)}">${esc(txt)}
            <div style="position:absolute;left:-6%;top:22%;height:56%;width:${(strike * 112).toFixed(1)}%;background:${th.accent}"></div></div>`);
    }

    // ---- type: سطر بيتكتب حرف حرف على قد الكلام
    k_type(b, t, k, th, i) {
      const u = this.u, size = u * 4.6 * this.ts;
      const ws = this.words(b);
      let shown = "";
      for (const w of ws) {
        if (t < w.t0) break;
        const chars = [...this.text(w.w)];
        const n = Math.ceil(chars.length * clamp((t - w.t0) / Math.max(0.12, Math.min(0.35, w.t1 - w.t0))));
        shown += (shown ? " " : "") + chars.slice(0, n).join("");
      }
      const full = ws.map((w) => this.text(w.w)).join(" ");
      let scrib = "";
      if (b.scribble !== false) {
        const r = rng(i + 7);
        scrib = scribbleSvg(this.doc, scribblePath(r, this.doc.w * 0.5, this.doc.h * 0.5 + u * 14, u * 26, u * 6, 5), th.ink, u * 0.45, easeOut(k * 1.4));
      }
      return scrib + this.center(`<div dir="${this.dir(full)}" style="font-size:${size}px;color:${th.ink};max-width:84%;text-align:center;line-height:1.3">
        ${esc(shown)}${this.cursor(t, th, size)}</div>`);
    }

    // ---- build: الكلام كلمة كلمة، وكلمة بتنوّر، وإضاءة بتعدّي
    k_build(b, t, k, th, i) {
      const u = this.u, size = u * (b.side ? 5.2 : 4.8) * this.ts;
      const ws = this.words(b);
      const parts = ws.map((w, j) => {
        const a = clamp((t - w.t0) / 0.18);
        const hot = j === b.focus;
        const col = hot ? th.accent : th.ink;
        return `<span style="display:inline-block;margin:0 ${(size * 0.13).toFixed(1)}px;opacity:${a.toFixed(3)};filter:blur(${((1 - a) * 6).toFixed(1)}px);
          transform:translateY(${((1 - easeOut(a)) * size * 0.35).toFixed(1)}px);color:${col};${hot && a > 0 ? `text-shadow:0 0 ${size * 0.6}px ${th.accent}` : ""}">${esc(this.text(w.w))}</span>`;
      }).join("");
      const full = ws.map((w) => w.w).join(" ");
      const flare = b.flare === false ? "" : (() => {
        const x = lerp(-30, 130, easeInOut(k)), c = th.accent;
        return `<div style="position:absolute;inset:-20%;background:radial-gradient(circle at ${x.toFixed(1)}% 50%, ${c}55 0, transparent 34%);mix-blend-mode:${this.doc.transparent ? "normal" : "screen"}"></div>`;
      })();
      if (b.side) {
        const a = easeOut((t - b.t0) / 0.5);
        const tall = this.doc.h > this.doc.w * 1.2;
        return flare + `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-around;
            flex-direction:${tall ? "column-reverse" : this.dir(full) === "rtl" ? "row-reverse" : "row"}">
          <div dir="${this.dir(full)}" style="font-size:${size}px;max-width:${tall ? 86 : 48}%;text-align:center;line-height:1.35">${parts}</div>
          <img src="${esc(b.side)}" style="height:${(this.doc.h * (tall ? 0.42 : 0.62)).toFixed(0)}px;max-width:${tall ? 86 : 46}%;object-fit:contain;opacity:${a.toFixed(3)};
            transform:translateX(${((1 - a) * u * 6).toFixed(1)}px) scale(${lerp(1.06, 1, a).toFixed(3)})"></div>`;
      }
      return flare + this.center(`<div dir="${this.dir(full)}" style="font-size:${size}px;text-align:center;max-width:86%;line-height:1.35">${parts}</div>`);
    }

    // ---- icon: أيقونة بتدخل بلفّة وجنبها الكلمة بمؤشر
    k_icon(b, t, k, th, i) {
      const u = this.u, size = u * 7.5;
      const a = back((t - b.t0) / 0.35);
      const txt = this.text(b.text || "");
      const word = this.words(b);
      const tk = clamp((t - (word[0]?.t0 ?? b.t0)) / 0.3);
      const shown = [...txt].slice(0, Math.ceil([...txt].length * tk)).join("");
      const swoosh = `<div style="position:absolute;left:-10%;top:${(lerp(70, 40, easeOut(k))).toFixed(1)}%;width:70%;height:${u * 2.2}px;background:${th.accent};
        transform:rotate(-24deg);transform-origin:left;opacity:${(1 - k * 0.6).toFixed(2)};clip-path:inset(0 ${((1 - easeOut(k * 2)) * 100).toFixed(1)}% 0 0)"></div>`;
      const img = b.icon ? `<img src="${esc(b.icon)}" style="height:${(u * (this.doc.h > this.doc.w * 1.2 ? 44 : 26)).toFixed(0)}px;max-width:${(this.doc.w * (this.doc.h > this.doc.w * 1.2 ? 0.8 : 0.4)).toFixed(0)}px;object-fit:contain;
        transform:scale(${a.toFixed(3)}) rotate(${((1 - clamp((t - b.t0) / 0.35)) * -35).toFixed(1)}deg);filter:drop-shadow(0 ${u}px ${u * 2}px rgba(0,0,0,.25))">` : "";
      // نجمة لمعة بلون الأكسنت ورا الأيقونة (بتكبر وتصغر مع الدخول)
      const sk = clamp((t - b.t0) / 0.5), ss = u * 30 * (sk < 0.4 ? back(sk / 0.4) : lerp(1, 0.75, (sk - 0.4) / 0.6));
      const spark = b.icon && b.sparkle !== false ? `<svg viewBox="-50 -50 100 100" style="position:absolute;width:${ss.toFixed(0)}px;height:${ss.toFixed(0)}px;
          left:50%;top:50%;transform:translate(-62%,-60%) rotate(${(12 + sk * 20).toFixed(1)}deg);opacity:${(1 - clamp((k - 0.7) / 0.3)).toFixed(2)}">
          <path d="M0,-50 C4,-8 8,-4 50,0 C8,4 4,8 0,50 C-4,8 -8,4 -50,0 C-8,-4 -4,-8 0,-50Z" fill="${th.accent}"/></svg>` : "";
      const iconBox = img ? `<div style="position:relative;display:flex;align-items:center;justify-content:center">${spark}<div style="position:relative">${img}</div></div>` : "";
      const tall = this.doc.h > this.doc.w * 1.2;   // الطولي: الأيقونة فوق والكلمة تحتها
      return swoosh + `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:${(u * 7).toFixed(0)}px;
          flex-direction:${tall ? "column" : this.dir(txt) === "rtl" ? "row-reverse" : "row"}">${iconBox}
        <div dir="${this.dir(txt)}" style="font-size:${size}px;white-space:nowrap">${esc(shown)}${this.cursor(t, th, size)}</div></div>`;
    }

    // ---- letters: حروف متباعدة وحرف بيتبدل بصور
    k_letters(b, t, k, th, i) {
      const u = this.u, size = u * 8;
      const txt = this.text(b.text || "");
      const gs = glyphs(txt.replace(/\s+/g, ""));
      const icons = b.icons?.length ? b.icons : b.icon ? [b.icon] : [];
      const li = Number.isInteger(b.letter) ? b.letter : Math.min(1, gs.length - 1);
      const per = (b.t1 - b.t0) / Math.max(1, icons.length);
      const cur = icons[Math.min(icons.length - 1, Math.floor((t - b.t0) / per))];
      const sub = ((t - b.t0) % per) / per;
      if (AR.test(txt)) {
        // العربي متوصّل: الحروف المتفرقة ما تتقريش، فالكلمة بتفضل كاملة والصور بتتبدل جنبها
        const a = clamp((t - b.t0) / 0.3);
        const ic = cur ? `<img src="${esc(cur)}" style="height:${(size * 1.6).toFixed(0)}px;transform:scale(${back(sub * 3).toFixed(3)}) rotate(${((1 - clamp(sub * 3)) * 25).toFixed(1)}deg)">` : "";
        return this.center(`<div dir="rtl" style="font-size:${(size * 1.25).toFixed(0)}px;display:flex;align-items:center;gap:${(size * 0.5).toFixed(0)}px;
          opacity:${a.toFixed(2)};letter-spacing:${lerp(0.25, 0, easeOut(a)).toFixed(3)}em">${esc(txt)}${ic}</div>`);
      }
      const cells = gs.map((g, j) => {
        const a = clamp((t - b.t0 - j * 0.12) / 0.2);
        if (j === li && cur) {
          return `<span style="display:inline-flex;width:${size * 1.4}px;justify-content:center"><img src="${esc(cur)}" style="height:${(size * 1.5).toFixed(0)}px;
            transform:scale(${back(sub * 3).toFixed(3)}) rotate(${((1 - clamp(sub * 3)) * 25).toFixed(1)}deg)"></span>`;
        }
        return `<span style="display:inline-block;width:${size * 1.4}px;text-align:center;opacity:${a.toFixed(2)}">${esc(g)}</span>`;
      }).join(`<span style="display:inline-block;width:${(size * 0.9).toFixed(0)}px"></span>`);
      return this.center(`<div dir="${this.dir(txt)}" style="font-size:${size}px;display:flex;align-items:center;white-space:nowrap">${cells}</div>`);
    }

    // ---- scatter: الحروف متبعترة وبتتجمع
    k_scatter(b, t, k, th, i) {
      const u = this.u, size = u * 11;
      const txt = this.text(b.text || "");
      const gs = glyphs(txt);
      const r = rng(i * 31 + 3);
      const gather = easeInOut((k - 0.15) / 0.6);
      const cells = gs.map((g) => {
        const dx = (r() - 0.5) * this.doc.w * 0.8, dy = (r() - 0.5) * this.doc.h * 0.7, rot = (r() - 0.5) * 120;
        const m = 1 - gather;
        return `<span style="display:inline-block;white-space:pre;transform:translate(${(dx * m).toFixed(1)}px, ${(dy * m).toFixed(1)}px) rotate(${(rot * m).toFixed(1)}deg)
          scale(${lerp(0.55, 1, gather).toFixed(3)});${m > 0.02 ? `color:${r() > 0.5 ? th.accent : th.ink}` : ""}">${esc(g)}</span>`;
      }).join("");
      let lines = "";
      if (b.scribble !== false && gather < 0.98) {
        const rr = rng(i * 17 + 1);
        lines = [0, 1, 2].map((j) => scribbleSvg(this.doc, scribblePath(rr, this.doc.w * (0.3 + 0.2 * j), this.doc.h * (0.35 + rr() * 0.3), u * 22, u * 7, 3),
          j === 1 ? th.accent : th.ink, u * (j === 1 ? 0.5 : 1.4), easeOut(k * 2.2), 0.55 * (1 - gather))).join("");
      }
      return lines + this.center(`<div dir="${this.dir(txt)}" style="font-size:${size}px;white-space:nowrap;letter-spacing:${(lerp(0.4, 0.02, gather)).toFixed(3)}em">${cells}</div>`);
    }

    // ---- ring: أيقونات في دايرة بتلف
    k_ring(b, t, k, th, i) {
      const u = this.u;
      const icons = b.icons?.length ? b.icons : b.icon ? [b.icon] : [];
      const tall = this.doc.h > this.doc.w * 1.2;
      const R = u * (tall ? 38 : 30), rot = (t - b.t0) * 18;
      const cx = this.doc.w / 2, cy = this.doc.h / 2;
      const items = icons.map((src, j) => {
        const ang = ((j / icons.length) * 360 + rot) * Math.PI / 180;
        const a = back((t - b.t0 - j * 0.07) / 0.35);
        const s = u * (tall ? 21 : 15);
        return `<img src="${esc(src)}" style="position:absolute;left:${(cx + Math.cos(ang) * R - s / 2).toFixed(1)}px;top:${(cy + Math.sin(ang) * R - s / 2).toFixed(1)}px;
          width:${s.toFixed(0)}px;height:${s.toFixed(0)}px;object-fit:contain;transform:scale(${a.toFixed(3)})">`;
      }).join("");
      const txt = this.text(b.text || "");
      const label = txt ? this.center(`<div dir="${this.dir(txt)}" style="font-size:${(u * 4.4 * this.ts).toFixed(1)}px;opacity:${clamp((t - b.t0) / 0.3).toFixed(2)}">${esc(txt)}</div>`) : "";
      return items + label;
    }
  }

  // حبيبات الفيلم: 4 صور صغيرة بتترسم مرة واحدة وبتتكرر (أسرع بكتير من فلتر بيتحسب كل فريم)
  let noiseTiles = null;
  TypoEngine.noise = () => {
    if (noiseTiles) return noiseTiles;
    noiseTiles = [0, 1, 2, 3].map((k) => {
      const c = document.createElement("canvas");
      c.width = c.height = 160;
      const g = c.getContext("2d"), img = g.createImageData(160, 160), r = rng(k + 11);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(r() * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return c.toDataURL("image/png");
    });
    return noiseTiles;
  };

  // خطوط البرنامج (فولدر fonts): «SM Cairo» ← /fonts/SM-Cairo.ttf
  const loaded = {};
  TypoEngine.font = (family) => {
    if (!/^SM /.test(family || "")) return Promise.resolve();
    if (!loaded[family]) {
      const face = new FontFace(family, `url(/fonts/${family.replace(/ /g, "-")}.ttf)`);
      loaded[family] = face.load().then((f) => document.fonts.add(f)).catch(() => {});
    }
    return loaded[family];
  };
  TypoEngine.KINDS = ["pop", "type", "build", "icon", "letters", "scatter", "ring"];
  TypoEngine.DEFAULT_STYLE = DEFAULT_STYLE;
  window.TypoEngine = TypoEngine;
})();
