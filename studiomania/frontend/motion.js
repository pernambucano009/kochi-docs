// 🎞️ مكتبة الموشن: عناصر متحركة مكتوبة بالكود، كل واحدة بتتعدّل (الكلام، الألوان، اللوجو) وبتتملا لوحدها من عقل العلامة.
// المعاينة شغّالة بالصوت، و«ضيفه للأصول» بيرسمها فيديو بتعديلاتك (ببلاش، على السيرفر) وتلاقيها في المونتاج.

const MotionPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const CATS = { all: "الكل", motion_graphics: "موشن جرافيك", character: "شخصيات", text: "نص", effect: "مؤثرات", product: "منتجات" };
  const RATIO = { "9:16": "طولي", "1:1": "مربع", "16:9": "عرضي" };
  const S = { list: [], cat: "all", el: null, poll: null, view: null, brand: null, schema: {} };

  const html = () => `<div class="nb-wrap" id="mlWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;

  function card(m) {
    const job = m.job, pct = job?.status === "working" ? Math.round((job.progress || 0) * 100) : null;
    return `<div class="ml-card" data-mid="${esc(m.id)}" tabindex="0" role="button" aria-label="${esc(m.name)}">
      <div class="ml-art">${m.poster_url ? `<img src="${esc(m.poster_url)}" alt="" loading="lazy">` : ""}<span class="ml-play">✎</span>
        ${m.ratio ? `<span class="ml-ratio">${esc(RATIO[m.ratio] || m.ratio)}</span>` : ""}</div>
      <div class="ml-meta"><b>${esc(m.name)}</b><small>${esc(m.use || "")}</small></div>
      <div class="ml-act">${pct !== null ? `<span class="ml-busy"><i style="width:${pct}%"></i><b class="num">${pct}%</b></span>`
        : job?.status === "error" ? `<small class="ml-err" title="${esc(job.error)}">فشل، جرّب مرة أخرى</small>`
        : m.assets ? `<span class="ml-ok">✓ ${m.assets} في الأصول</span>` : `<small class="ml-hint">اضغط لتعديله</small>`}</div></div>`;
  }

  function render() {
    const w = S.el;
    if (!w) return;
    const have = new Set(S.list.map((m) => m.category));
    const cats = Object.keys(CATS).filter((k) => k === "all" || have.has(k));
    const list = S.list.filter((m) => S.cat === "all" || m.category === S.cat);
    const added = S.list.reduce((a, m) => a + (m.assets || 0), 0);
    w.innerHTML = `
      <div class="nb-bar ml-bar">
        <div class="ml-chips">${cats.map((k) => `<button class="ml-chip ${k === S.cat ? "on" : ""}" data-cat="${k}">${CATS[k]}<span class="num">${k === "all" ? S.list.length : S.list.filter((m) => m.category === k).length}</span></button>`).join("")}</div>
        <span class="nb-state">${added ? `${added} نسخة في الأصول <button class="nb-btn sm" data-lib>افتح مكتبة الأصول</button>` : ""}</span>
      </div>
      <p class="nb-hint ml-hint">عناصر متحركة جاهزة: اضغط على أي عنصر وسيُملأ تلقائيًا بكلام العلامة وألوانها وشعارها، ويمكنك تغيير أي شيء ورؤيته مباشرة. «أضفه للأصول» يحوّله إلى فيديو (مجانًا) تجده في المونتاج.</p>
      <div class="ml-grid">${list.map(card).join("") || `<div class="nh-empty">لا شيء هنا.</div>`}</div>`;
  }

  async function load() {
    S.list = await api("/api/motion-library");
    render();
    watchJobs();
  }
  function watchJobs() {
    clearInterval(S.poll);
    if (!S.list.some((m) => m.job?.status === "working")) return;
    S.poll = setInterval(async () => {
      if (!S.el?.isConnected) return clearInterval(S.poll);
      const was = S.list.filter((m) => m.job?.status === "working").length;
      S.list = await api("/api/motion-library").catch(() => S.list);
      render();
      const now = S.list.filter((m) => m.job?.status === "working").length;
      if (now < was) toast(S.list.some((m) => m.job?.status === "error") ? "⚠️ فشل أحد العناصر، جرّب مرة أخرى" : "✅ أُضيف إلى الأصول، وتجده في المونتاج");
      if (!now) clearInterval(S.poll);
    }, 2500);
  }

  // ---------- قيم البراند: كل خانة ليها «دور» (اسم، دعوة، لوجو، لون...) بيتملا من عقل العلامة
  async function brandValues() {
    if (!S.brand) {
      try { S.brand = await api(`/api/ad-brains/${clientx?.active}`); } catch { S.brand = {}; }
    }
    const b = S.brand || {}, hexes = [...String(b.palette || "").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
    const about = String(b.about || "").split(/[.\n،,]/)[0].trim().slice(0, 70);
    const handle = (String(b.link || "").match(/instagram\.com\/([A-Za-z0-9_.]+)/) || [])[1];
    return { brand: b.name, product: b.name, tagline: about, about, cta: b.cta, handle: handle ? `@${handle}` : b.name,
      logo: b.logos?.[0]?.url, accent: hexes[0], accent2: hexes[1],
      ...Object.fromEntries([...(b.products || []), ...(b.screens || [])].slice(0, 3).map((a, i) => [`product_img${i + 1}`, a.url])) };
  }
  const applyBrand = (schema, vals, bv) => {
    for (const [k, f] of Object.entries(schema)) if (f.role && bv[f.role]) vals[k] = bv[f.role];
    return vals;
  };

  // ---------- المحرر: المعاينة شغّالة بالصوت، والخانات جنبها
  function closeView() {
    const v = S.view;
    if (!v) return;
    S.view = null;
    cancelAnimationFrame(v.raf);
    v.audio?.pause();
    v.voa?.pause();
    clearTimeout(v.reloadT);
    v.box.remove();
    document.removeEventListener("keydown", v.key);
  }
  // tm = طول كل مشهد على قد الفويس أوفر (منظّم الوقت في core.js)
  function srcOf(m, vals, n) {
    return `${m.preview_url}?v=${n}#p=${encodeURIComponent(JSON.stringify(vals || {}))}${m.timing ? `&tm=${encodeURIComponent(JSON.stringify(m.timing))}` : ""}`;
  }
  // ---------- صيغة القالب: كل خانة بنصيحتها وحدودها (core.js · M.params / M.meta)
  const GS = "الشكل العام";
  const FONT_LIST = () => S.fonts || {};
  function counter(f, v) {
    if (!f.max || typeof v !== "string") return "";
    const n = [...v].length;
    return `<small class="ml-cnt ${n > f.max ? "over" : ""}">${n}/${f.max}${n > f.max ? " · أطول من المقترح، وسيُصغَّر" : ""}</small>`;
  }
  function fieldHTML(k, f, v) {
    const hint = f.hint ? `<small class="ml-hint2">${esc(f.hint)}</small>` : "";
    const lab = `<span class="ml-lab">${esc(f.label || k)}</span>`;
    if (f.kind === "color") return `<label class="ml-f ml-fc" title="${esc(f.hint || "")}">${lab}<input type="color" data-pk="${k}" value="${esc(/^#[0-9a-f]{6}$/i.test(v) ? v : f.def)}"></label>`;
    if (f.kind === "toggle") return `<label class="ml-f ml-ft">${lab}<input type="checkbox" data-pk="${k}" data-tog ${v ? "checked" : ""}>${hint}</label>`;
    if (f.kind === "font") {
      const fonts = Object.entries(FONT_LIST()).filter(([, x]) => !f.script || f.script === "any" || x.script === f.script || x.script === "any");
      return `<label class="ml-f">${lab}<select data-pk="${k}">${fonts.map(([id, x]) => `<option value="${id}" ${id === v ? "selected" : ""}>${esc(x.label)}${x.script === "lat" ? " · لاتيني" : ""}</option>`).join("")}</select>${hint}</label>`;
    }
    if (f.kind === "select") return `<label class="ml-f">${lab}<select data-pk="${k}">${(f.options || []).map(([o, t]) => `<option value="${esc(o)}" ${String(o) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>${hint}</label>`;
    // اختيار بالصور: كل صورة شكل جاهز، ولما تختاره بيحط ألوانه في الخانات (وتقدر تظبطها بعدها)
    if (f.kind === "look") {
      const base = (S.view?.m.preview_url || "").replace(/[^/]*$/, "");
      return `<div class="ml-f">${lab}<div class="ml-looks">${(f.options || []).map(([o, t, img]) => `<button type="button" class="ml-look ${String(o) === String(v) ? "on" : ""}" data-plook="${k}" data-val="${esc(o)}">
        ${img ? `<img src="${esc(base + img)}" alt="" loading="lazy">` : ""}<span>${esc(t)}</span></button>`).join("")}</div>${hint}</div>`;
    }
    if (f.kind === "number") return `<label class="ml-f">${lab}<span class="ml-num"><input type="range" data-pk="${k}" min="${f.min ?? 0}" max="${f.max ?? 100}" step="${f.step ?? 1}" value="${esc(v)}"><b class="num">${esc(v)}${esc(f.unit || "")}</b></span>${hint}</label>`;
    if (f.kind === "lines") return `<label class="ml-f">${lab}<textarea rows="${Math.min(8, Math.max(3, (v || []).length + 1))}" data-pk="${k}" data-lines>${esc((Array.isArray(v) ? v : String(v || "").split("\n")).join("\n"))}</textarea>${hint}</label>`;
    if (f.kind === "image") {
      const b = S.brand || {}, imgs = [...(b.products || []), ...(b.logos || []), ...(b.screens || [])].slice(0, 14), im = f.img || {};
      const own = v && !imgs.some((x) => x.url === v);
      const tip = [im.ratio ? `مقاس ${im.ratio}` : "", im.cut ? "بدون خلفية" : ""].filter(Boolean).join(" · ");
      return `<div class="ml-f">${lab}${tip ? `<small class="ml-badge">${esc(tip)}</small>` : ""}
        <div class="ml-imgs"><button type="button" class="ml-img ${!v ? "on" : ""}" data-pimg="${k}" data-src="">بدون</button>
          ${own ? `<button type="button" class="ml-img on" data-pimg="${k}" data-src="${esc(v)}"><img src="${esc(v)}" alt=""></button>` : ""}
          ${imgs.map((x) => `<button type="button" class="ml-img ${v === x.url ? "on" : ""}" data-pimg="${k}" data-src="${esc(x.url)}"><img src="${esc(x.url)}" alt=""></button>`).join("")}
          <label class="ml-img ml-up" title="ارفع صورة">＋<input type="file" accept="image/*" data-pup="${k}" hidden></label></div>
        ${im.tip ? `<small class="ml-hint2">💡 ${esc(im.tip)}</small>` : ""}${hint}</div>`;
    }
    return `<label class="ml-f">${lab}<input type="text" data-pk="${k}" value="${esc(v)}">${counter(f, v)}${hint}</label>`;
  }
  // المحرر بيشتغل مع أي قالب كود: عناصر الموشن (المكتبة) أو قوالب المعرض (t-*)
  async function openView(m) {
    closeView();
    if (!S.fonts) S.fonts = await api("/api/motion-fonts").catch(() => ({}));
    const box = document.createElement("div");
    box.className = "ml-view";
    box.innerHTML = `<div class="ml-vin">
      <div class="ml-vtop"><b>${esc(m.name)}</b><span class="nb-state" data-vs>جارٍ التحميل…</span>
        <button class="nb-btn sm" data-mute title="الصوت">🔊</button><button class="nb-btn sm" data-x title="قفل">✕</button></div>
      <div class="ml-vbody"><div class="ml-left"><div class="ml-stage"><iframe title="${esc(m.name)}"></iframe></div>
          <div class="ml-tl"><button class="nb-btn sm" data-play title="تشغيل/إيقاف">⏸</button><div class="ml-tlbar" data-tlbar><i class="ml-ph"></i></div><span class="num" data-tt>0.0</span></div></div>
        <aside class="ml-side"><div class="ml-fields"><div class="nh-empty">جارٍ تحميل الخانات…</div></div>
          <div class="ml-sact"><button class="nb-btn sm" data-brand>🎨 من العلامة</button><button class="nb-btn sm" data-reset>↺ الأصلي</button>
            <button class="nb-btn ml-add" data-add>${m.template ? "🎬 صدّر الفيديو" : "＋ أضفه للأصول"}</button></div></aside></div></div>`;
    document.body.appendChild(box);
    const v = { m, box, raf: 0, audio: null, vals: {}, n: 0, muted: false, open: null, range: null, paused: false, t: 0, key: (e) => e.key === "Escape" && closeView() };
    S.view = v;
    document.addEventListener("keydown", v.key);
    const fr = box.querySelector("iframe"), stage = box.querySelector(".ml-stage");

    // كل ما المعاينة تتحمّل: نقيس المقاس، نشغّل الصوت، ونمشّي الوقت
    fr.addEventListener("load", async () => {
      const win = fr.contentWindow;
      try { await win.ready; } catch { return; }
      if (S.view !== v) return;
      cancelAnimationFrame(v.raf);
      v.audio?.pause();
      const W = win.W, H = win.H, D = win.DUR;
      v.D = D;
      const fit = () => { const s = Math.min(stage.clientWidth / W, stage.clientHeight / H); Object.assign(fr.style, { width: W + "px", height: H + "px", transform: `scale(${s})` }); };
      fit();
      if (!v.ro) { v.ro = new ResizeObserver(() => S.view === v && v.fit?.()); v.ro.observe(stage); }
      v.fit = fit;
      if (!v.schema) {   // أول مرة: نقرا الخانات وقصة القالب ونملاها من العلامة
        v.schema = win.PARAM_SCHEMA || {};
        v.meta = win.TEMPLATE_META || null;
        S.schema[m.id] = v.schema;
        await brandValues();
        if (S.view !== v) return;
        const vals = m.vals ? { ...m.vals } : applyBrand(v.schema, {}, await brandValues());   // قادم من المسار: نص النص وألوان العلامة جاهزين
        renderFields();
        renderTl();
        if (Object.keys(vals).length) { v.vals = vals; renderFields(); return reload(0); }
      }
      try {
        v.audio = new Audio("data:audio/wav;base64," + (await win.soundtrack()));
        v.audio.loop = true; v.audio.muted = v.muted;
        // الفويس أوفر: ملف لوحده ماشي مع المزيكا (اللي بتوطى تحته)
        if (m.vo) { v.voa ??= new Audio(m.vo); v.voa.muted = v.muted; v.audio.volume = .35; }
        if (!v.paused) await v.audio.play().catch(() => {});
        v.audio.currentTime = v.t || 0;
      } catch { v.audio = null; }
      box.querySelector("[data-vs]").textContent = `${Math.round(D)} ثانية`;
      let last = performance.now();
      const tick = () => {
        if (S.view !== v) return;
        const now = performance.now();
        if (!v.paused) {
          if (v.audio && !v.audio.paused) v.t = v.audio.currentTime;
          else v.t += (now - last) / 1000;
          const [a, b] = v.range || [0, D];
          if (v.t >= b || v.t < a) { v.t = a; if (v.audio) v.audio.currentTime = a; }
        }
        if (v.voa) {
          if (v.paused || v.t >= v.voa.duration) { if (!v.voa.paused) v.voa.pause(); }
          else { if (v.voa.paused) v.voa.play().catch(() => {}); if (Math.abs(v.voa.currentTime - v.t) > .25) v.voa.currentTime = v.t; }
        }
        last = now;
        try { win.seek(v.t % D); } catch { return; }   // المعاينة تُحمّل من جديد (تعديل)
        const ph = box.querySelector(".ml-ph"); if (ph) ph.style.insetInlineStart = `${(v.t / D) * 100}%`;
        box.querySelector("[data-tt]").textContent = v.t.toFixed(1);
        v.raf = requestAnimationFrame(tick);
      };
      tick();
    });
    const reload = (delay = 500) => {
      clearTimeout(v.reloadT);
      v.reloadT = setTimeout(() => { if (S.view !== v) return; box.querySelector("[data-vs]").textContent = "جارٍ التحديث…"; fr.src = srcOf(m, v.vals, ++v.n); }, delay);
    };
    // التايم لاين: المشاهد كأجزاء ملوّنة، الدوسة على مشهد بتشغّله لوحده
    function renderTl() {
      const bar = box.querySelector("[data-tlbar]"), sc = v.meta?.scenes || [], D = v.D || 1;
      bar.innerHTML = sc.map((s, i) => `<button type="button" class="ml-sc ${v.open === s.name ? "on" : ""}" data-scene="${i}" style="inset-inline-start:${(s.t0 / D) * 100}%;width:${((s.t1 - s.t0) / D) * 100}%" title="${esc(s.about || "")}">${esc(s.name)}</button>`).join("") + `<i class="ml-ph"></i>`;
    }
    function renderFields() {
      const sch = v.schema || {}, el = box.querySelector(".ml-fields"), meta = v.meta;
      const val = (k) => (k in v.vals ? v.vals[k] : sch[k].def);
      const keys = Object.keys(sch);
      if (!keys.length) { el.innerHTML = `<div class="nh-empty">لا يحتوي هذا العنصر على ما يُعدَّل.</div>`; return; }
      // الخانات متقسمة على المشاهد بترتيبها، وبعدها الشكل العام (ألوان وخطوط)
      const order = [...(meta?.scenes || []).map((s) => s.name)];
      keys.forEach((k) => { const g = sch[k].group || (["color", "font"].includes(sch[k].kind) ? GS : "الخانات"); if (!order.includes(g)) order.push(g); });
      const groups = order.map((g) => [g, keys.filter((k) => (sch[k].group || (["color", "font"].includes(sch[k].kind) ? GS : "الخانات")) === g)]).filter(([, ks]) => ks.length);
      const scene = (g) => (meta?.scenes || []).find((s) => s.name === g);
      const story = meta?.story ? `<div class="ml-story"><b>📖 قصة القالب</b><p>${esc(meta.story)}</p>${(meta.tips || []).length ? `<ul>${meta.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>` : "";
      el.innerHTML = story + groups.map(([g, ks]) => {
        const sc = scene(g), on = v.open === null ? groups.length < 3 || g === groups[0][0] : v.open === g;
        const colors = ks.filter((k) => sch[k].kind === "color"), rest = ks.filter((k) => sch[k].kind !== "color");
        return `<section class="ml-grp ${on ? "on" : ""}"><button type="button" class="ml-gh" data-grp="${esc(g)}"><b>${esc(g)}</b>${sc ? `<small class="num">${(+sc.t0).toFixed(1)}–${(+sc.t1).toFixed(1)} ث</small>` : ""}<i>${on ? "−" : "+"}</i></button>
          ${on ? `<div class="ml-gb">${sc?.about ? `<small class="ml-hint2">🎬 ${esc(sc.about)}</small>` : ""}${rest.map((k) => fieldHTML(k, sch[k], val(k))).join("")}
            ${colors.length ? `<div class="ml-colors">${colors.map((k) => fieldHTML(k, sch[k], val(k))).join("")}</div>${colors.map((k) => sch[k].hint ? `<small class="ml-hint2">🎨 ${esc(sch[k].label)}: ${esc(sch[k].hint)}</small>` : "").join("")}` : ""}</div>` : ""}</section>`;
      }).join("");
    }
    const setVal = (k, raw, lines) => {
      v.vals[k] = lines ? String(raw).split("\n").map((z) => z.trim()).filter(Boolean) : raw;
      const f = v.schema?.[k], inp = box.querySelector(`[data-pk="${k}"]`);
      if (f?.max && inp) { const c = inp.parentElement.querySelector(".ml-cnt"); if (c) c.outerHTML = counter(f, raw); }
      if (f?.kind === "number" && inp) inp.parentElement.querySelector("b").textContent = raw + (f.unit || "");
      reload();
    };
    const playScene = (g) => {
      const sc = (v.meta?.scenes || []).find((s) => s.name === g);
      v.range = sc ? [sc.t0, sc.t1] : null;
      if (sc) { v.t = sc.t0; if (v.audio) v.audio.currentTime = sc.t0; }
    };
    box.addEventListener("input", (e) => {
      const k = e.target.dataset.pk;
      if (!k || e.target.type === "file") return;
      setVal(k, e.target.hasAttribute("data-tog") ? e.target.checked : e.target.value, e.target.hasAttribute("data-lines"));
    });
    box.addEventListener("change", (e) => {
      const up = e.target.dataset?.pup;
      if (!up || !e.target.files?.[0]) return;
      const fl = e.target.files[0];
      if (fl.size > 8 * 1024 * 1024) return toast("الصورة كبيرة جدًا (الحد الأقصى ٨ ميجا)", true);
      const rd = new FileReader();
      rd.onload = () => { v.vals[up] = rd.result; renderFields(); reload(0); };
      rd.readAsDataURL(fl);
    });
    box.addEventListener("click", async (e) => {
      const t = e.target;
      if (t === box || t.closest("[data-x]")) return closeView();
      if (t.closest("[data-mute]")) { v.muted = !v.muted; if (v.audio) v.audio.muted = v.muted; if (v.voa) v.voa.muted = v.muted; t.closest("[data-mute]").textContent = v.muted ? "🔇" : "🔊"; return; }
      if (t.closest("[data-play]")) { v.paused = !v.paused; if (v.audio) v.paused ? v.audio.pause() : v.audio.play().catch(() => {}); t.closest("[data-play]").textContent = v.paused ? "▶" : "⏸"; return; }
      const scb = t.closest("[data-scene]");
      if (scb) { const s = v.meta.scenes[+scb.dataset.scene]; v.open = v.open === s.name && v.range ? null : s.name; if (v.open) playScene(s.name); else v.range = null; renderFields(); renderTl(); return; }
      const bar = t.closest("[data-tlbar]");
      if (bar) { const r = bar.getBoundingClientRect(), f = (e.clientX - r.left) / r.width, rtl = getComputedStyle(bar).direction === "rtl"; v.range = null; v.t = (rtl ? 1 - f : f) * (v.D || 0); if (v.audio) v.audio.currentTime = v.t; return; }
      const gh = t.closest("[data-grp]");
      if (gh) { const g = gh.dataset.grp; v.open = v.open === g ? "" : g; playScene(v.open); renderFields(); renderTl(); return; }
      const lk = t.closest("[data-plook]");
      if (lk) {
        const k = lk.dataset.plook, opt = (v.schema?.[k]?.options || []).find((o) => String(o[0]) === lk.dataset.val);
        v.vals = { ...v.vals, [k]: lk.dataset.val, ...(opt?.[3] || {}) };
        renderFields(); return reload(0);
      }
      const im = t.closest("[data-pimg]");
      if (im) { v.vals[im.dataset.pimg] = im.dataset.src; renderFields(); return reload(0); }
      if (t.closest("[data-brand]")) { v.vals = applyBrand(v.schema || {}, { ...v.vals }, await brandValues()); renderFields(); return reload(0); }
      if (t.closest("[data-reset]")) { v.vals = {}; renderFields(); return reload(0); }
      const add = t.closest("[data-add]");
      if (add) {
        add.disabled = true; add.textContent = "⏳";
        if (m.onExport) {   // من المسار: التصدير يعود للمسار بالخانات (والمشاهد على قدر الصوت)
          try { await m.onExport(v.vals); closeView(); } catch (err) { toast(err.message, true); add.disabled = false; add.textContent = "🎬 صدّر الفيديو"; }
          return;
        }
        try {
          const name = [m.name, S.brand?.name].filter(Boolean).join(" · ");
          await api(`/api/motion-library/${m.id}/import`, { method: "POST", ...jsonBody({ params: v.vals, name }) });
          toast("🎞️ يُنشأ فيديو بتعديلاتك… دقيقة أو دقيقتان، وتجده في الأصول");
          closeView();
          if (!m.template) await load();
        } catch (err) { toast(err.message, true); add.disabled = false; add.textContent = m.template ? "🎬 صدّر الفيديو" : "＋ أضفه للأصول"; }
      }
    });
    fr.src = srcOf(m, {}, ++v.n);
  }

  function bind(w) {
    w.addEventListener("click", (e) => {
      if (e.target.closest("[data-lib]")) { showStep("11"); openLib(); return; }
      const chip = e.target.closest("[data-cat]");
      if (chip) { S.cat = chip.dataset.cat; return render(); }
      const c = e.target.closest("[data-mid]");
      if (c) openView(S.list.find((m) => m.id === c.dataset.mid));
    });
    w.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-mid]")) { e.preventDefault(); e.target.click(); }
    });
  }

  async function mount(root) {
    const w = root.querySelector("#mlWrap");
    if (!w) return;
    S.el = w;
    S.brand = null;
    bind(w);
    try { await load(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  // قالب من المعرض (t-*): بيتفتح في نفس المحرر
  // opts (من مسار القالب): vals = الخانات، timing = طول كل مشهد، vo = لينك الفويس أوفر، onExport = بيتنادى بالخانات بدل الإضافة للأصول
  const openTemplate = (id, name, opts = {}) => openView({ id, name, template: true, preview_url: `/media/motion/r/${id}/reel.html`, ...opts });
  return { html, mount, close: closeView, openTemplate };
})();
