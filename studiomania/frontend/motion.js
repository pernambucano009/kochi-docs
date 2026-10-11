// 🎞️ مكتبة الموشن: عناصر متحركة مكتوبة بالكود، كل واحدة بتتعدّل (الكلام، الألوان، اللوجو) وبتتملا لوحدها من عقل البراند.
// المعاينة شغّالة بالصوت، و«ضيفه للأصول» بيرسمها فيديو بتعديلاتك (ببلاش، على السيرفر) وتلاقيها في المونتاج.

const MotionPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const CATS = { all: "الكل", motion_graphics: "موشن جرافيك", character: "شخصيات", text: "كلام", effect: "مؤثرات", product: "منتجات" };
  const RATIO = { "9:16": "طولي", "1:1": "مربع", "16:9": "عرضي" };
  const S = { list: [], cat: "all", el: null, poll: null, view: null, brand: null, schema: {} };

  const html = () => `<div class="nb-wrap" id="mlWrap"><div class="nh-empty">بيحمّل…</div></div>`;

  function card(m) {
    const job = m.job, pct = job?.status === "working" ? Math.round((job.progress || 0) * 100) : null;
    return `<div class="ml-card" data-mid="${esc(m.id)}" tabindex="0" role="button" aria-label="${esc(m.name)}">
      <div class="ml-art">${m.poster_url ? `<img src="${esc(m.poster_url)}" alt="" loading="lazy">` : ""}<span class="ml-play">✎</span>
        ${m.ratio ? `<span class="ml-ratio">${esc(RATIO[m.ratio] || m.ratio)}</span>` : ""}</div>
      <div class="ml-meta"><b>${esc(m.name)}</b><small>${esc(m.use || "")}</small></div>
      <div class="ml-act">${pct !== null ? `<span class="ml-busy"><i style="width:${pct}%"></i><b class="num">${pct}%</b></span>`
        : job?.status === "error" ? `<small class="ml-err" title="${esc(job.error)}">فشل، جرّب تاني</small>`
        : m.assets ? `<span class="ml-ok">✓ ${m.assets} في الأصول</span>` : `<small class="ml-hint">دوس عشان تعدّله</small>`}</div></div>`;
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
      <p class="nb-hint ml-hint">عناصر متحركة جاهزة: دوس على أي واحد، هيتملا لوحده بكلام وألوان ولوجو البراند، وتقدر تغيّر أي حاجة وتشوفها على طول. «ضيفه للأصول» بيعمله فيديو (ببلاش) وتلاقيه في المونتاج.</p>
      <div class="ml-grid">${list.map(card).join("") || `<div class="nh-empty">مفيش حاجة هنا.</div>`}</div>`;
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
      if (now < was) toast(S.list.some((m) => m.job?.status === "error") ? "⚠️ فيه عنصر فشل، جرّب تاني" : "✅ اتضاف للأصول، تلاقيه في المونتاج");
      if (!now) clearInterval(S.poll);
    }, 2500);
  }

  // ---------- قيم البراند: كل خانة ليها «دور» (اسم، دعوة، لوجو، لون...) بيتملا من عقل البراند
  async function brandValues() {
    if (!S.brand) {
      try { S.brand = await api(`/api/ad-brains/${clientx?.active}`); } catch { S.brand = {}; }
    }
    const b = S.brand || {}, hexes = [...String(b.palette || "").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
    const about = String(b.about || "").split(/[.\n،,]/)[0].trim().slice(0, 70);
    const handle = (String(b.link || "").match(/instagram\.com\/([A-Za-z0-9_.]+)/) || [])[1];
    return { brand: b.name, product: b.name, tagline: about, about, cta: b.cta, handle: handle ? `@${handle}` : b.name,
      logo: b.logos?.[0]?.url, accent: hexes[0], accent2: hexes[1] };
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
    clearTimeout(v.reloadT);
    v.box.remove();
    document.removeEventListener("keydown", v.key);
  }
  function srcOf(m, vals, n) {
    return `${m.preview_url}?v=${n}#p=${encodeURIComponent(JSON.stringify(vals || {}))}`;
  }
  function fieldHTML(k, f, v) {
    const lab = `<span>${esc(f.label || k)}</span>`;
    if (f.kind === "color") return `<label class="ml-f ml-fc">${lab}<input type="color" data-pk="${k}" value="${esc(/^#[0-9a-f]{6}$/i.test(v) ? v : f.def)}"></label>`;
    if (f.kind === "lines") return `<label class="ml-f">${lab}<textarea rows="${Math.min(8, Math.max(3, (v || []).length + 1))}" data-pk="${k}" data-lines>${esc((Array.isArray(v) ? v : String(v || "").split("\n")).join("\n"))}</textarea></label>`;
    if (f.kind === "image") {
      const b = S.brand || {}, imgs = [...(b.logos || []), ...(b.products || [])].slice(0, 12);
      return `<div class="ml-f">${lab}<div class="ml-imgs"><button type="button" class="ml-img ${!v ? "on" : ""}" data-pimg="${k}" data-src="">بدون</button>${imgs.map((x) => `<button type="button" class="ml-img ${v === x.url ? "on" : ""}" data-pimg="${k}" data-src="${esc(x.url)}"><img src="${esc(x.url)}" alt=""></button>`).join("")}</div>
        ${imgs.length ? "" : `<small class="ml-hint">ارفع لوجو في عقل البراند عشان يظهر هنا.</small>`}</div>`;
    }
    return `<label class="ml-f">${lab}<input type="text" data-pk="${k}" value="${esc(v)}"></label>`;
  }
  async function openView(m) {
    closeView();
    const box = document.createElement("div");
    box.className = "ml-view";
    box.innerHTML = `<div class="ml-vin">
      <div class="ml-vtop"><b>${esc(m.name)}</b><span class="nb-state" data-vs>بيحمّل…</span>
        <button class="nb-btn sm" data-mute title="الصوت">🔊</button><button class="nb-btn sm" data-x title="قفل">✕</button></div>
      <div class="ml-vbody"><div class="ml-stage"><iframe title="${esc(m.name)}"></iframe></div>
        <aside class="ml-side"><div class="ml-fields"><div class="nh-empty">بيحمّل الخانات…</div></div>
          <div class="ml-sact"><button class="nb-btn sm" data-brand>🎨 من البراند</button><button class="nb-btn sm" data-reset>↺ الأصلي</button>
            <button class="nb-btn ml-add" data-add>＋ ضيفه للأصول</button></div></aside></div></div>`;
    document.body.appendChild(box);
    const v = { m, box, raf: 0, audio: null, vals: {}, n: 0, muted: false, key: (e) => e.key === "Escape" && closeView() };
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
      const fit = () => { const s = Math.min(stage.clientWidth / W, stage.clientHeight / H); Object.assign(fr.style, { width: W + "px", height: H + "px", transform: `scale(${s})` }); };
      fit();
      if (!v.ro) { v.ro = new ResizeObserver(() => S.view === v && v.fit?.()); v.ro.observe(stage); }
      v.fit = fit;
      if (!v.schema) {   // أول مرة: نقرا الخانات ونملاها من البراند
        v.schema = win.PARAM_SCHEMA || {};
        S.schema[m.id] = v.schema;
        await brandValues();
        if (S.view !== v) return;
        const vals = applyBrand(v.schema, {}, await brandValues());
        renderFields();
        if (Object.keys(vals).length) { v.vals = vals; renderFields(); return reload(0); }
      }
      try {
        v.audio = new Audio("data:audio/wav;base64," + (await win.soundtrack()));
        v.audio.loop = true; v.audio.muted = v.muted;
        await v.audio.play().catch(() => {});
      } catch { v.audio = null; }
      box.querySelector("[data-vs]").textContent = `${Math.round(D)} ثانية`;
      const t0 = performance.now();
      const tick = () => {
        if (S.view !== v) return;
        const t = v.audio && !v.audio.paused ? v.audio.currentTime % D : ((performance.now() - t0) / 1000) % D;
        win.seek(t);
        v.raf = requestAnimationFrame(tick);
      };
      tick();
    });
    const reload = (delay = 500) => {
      clearTimeout(v.reloadT);
      v.reloadT = setTimeout(() => { if (S.view !== v) return; box.querySelector("[data-vs]").textContent = "بيحدّث…"; fr.src = srcOf(m, v.vals, ++v.n); }, delay);
    };
    function renderFields() {
      const sch = v.schema || {}, el = box.querySelector(".ml-fields");
      const val = (k) => (k in v.vals ? v.vals[k] : sch[k].def);
      const keys = Object.keys(sch), texts = keys.filter((k) => sch[k].kind !== "color"), colors = keys.filter((k) => sch[k].kind === "color");
      el.innerHTML = keys.length ? texts.map((k) => fieldHTML(k, sch[k], val(k))).join("")
        + (colors.length ? `<div class="ml-colors">${colors.map((k) => fieldHTML(k, sch[k], val(k))).join("")}</div>` : "")
        : `<div class="nh-empty">العنصر ده مفيهوش حاجة تتعدّل.</div>`;
    }
    const setVal = (k, raw, lines) => { v.vals[k] = lines ? String(raw).split("\n").map((z) => z.trim()).filter(Boolean) : raw; reload(); };
    box.addEventListener("input", (e) => { const k = e.target.dataset.pk; if (k) setVal(k, e.target.value, e.target.hasAttribute("data-lines")); });
    box.addEventListener("click", async (e) => {
      const t = e.target;
      if (t === box || t.closest("[data-x]")) return closeView();
      if (t.closest("[data-mute]")) { v.muted = !v.muted; if (v.audio) v.audio.muted = v.muted; t.closest("[data-mute]").textContent = v.muted ? "🔇" : "🔊"; return; }
      const im = t.closest("[data-pimg]");
      if (im) { v.vals[im.dataset.pimg] = im.dataset.src; renderFields(); return reload(0); }
      if (t.closest("[data-brand]")) { v.vals = applyBrand(v.schema || {}, { ...v.vals }, await brandValues()); renderFields(); return reload(0); }
      if (t.closest("[data-reset]")) { v.vals = {}; renderFields(); return reload(0); }
      const add = t.closest("[data-add]");
      if (add) {
        add.disabled = true; add.textContent = "⏳";
        try {
          const name = [m.name, S.brand?.name].filter(Boolean).join(" · ");
          await api(`/api/motion-library/${m.id}/import`, { method: "POST", ...jsonBody({ params: v.vals, name }) });
          toast("🎞️ بيتعمل فيديو بتعديلاتك… دقيقة أو اتنين، وتلاقيه في الأصول");
          closeView();
          await load();
        } catch (err) { toast(err.message, true); add.disabled = false; add.textContent = "＋ ضيفه للأصول"; }
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
  return { html, mount, close: closeView };
})();
