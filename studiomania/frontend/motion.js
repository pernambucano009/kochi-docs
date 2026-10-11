// 🎞️ مكتبة الموشن: أنيميشنات مكتوبة بالكود. تتفرج عليها بالصوت، ودوسة «ضيفه للأصول» بتعملها فيديو (ببلاش، على السيرفر)
// وبتدخل مكتبة الأصول عشان تستخدمها في المونتاج. صفحة بشكل الرئيسية الجديدة.

const MotionPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const CATS = { all: "الكل", motion_graphics: "موشن جرافيك", character: "شخصيات", text: "كلام", screen: "شاشات",
    effect: "مؤثرات", background: "خلفيات", product: "منتجات" };
  const S = { list: [], cat: "all", el: null, poll: null, view: null };

  const html = () => `<div class="nb-wrap" id="mlWrap"><div class="nh-empty">بيحمّل…</div></div>`;

  function card(m) {
    const job = m.job, pct = job?.status === "working" ? Math.round((job.progress || 0) * 100) : null;
    const state = m.asset ? `<span class="ml-ok">✓ في الأصول</span>`
      : pct !== null ? `<span class="ml-busy"><i style="width:${pct}%"></i><b class="num">${pct}%</b></span>`
      : `<button class="nb-btn sm" data-add="${esc(m.id)}">＋ ضيفه للأصول</button>`;
    return `<div class="ml-card" data-mid="${esc(m.id)}" tabindex="0" role="button" aria-label="${esc(m.name)}">
      <div class="ml-art">${m.poster_url ? `<img src="${esc(m.poster_url)}" alt="" loading="lazy">` : ""}<span class="ml-play">▶</span></div>
      <div class="ml-meta"><b>${esc(m.name)}</b><small>${esc(CATS[m.category] || "")}</small></div>
      <div class="ml-act">${job?.status === "error" ? `<small class="ml-err" title="${esc(job.error)}">فشل، جرّب تاني</small>` : ""}${state}</div></div>`;
  }

  function render() {
    const w = S.el;
    if (!w) return;
    const have = new Set(S.list.map((m) => m.category));
    const cats = Object.keys(CATS).filter((k) => k === "all" || have.has(k));
    const list = S.list.filter((m) => S.cat === "all" || m.category === S.cat);
    const added = S.list.filter((m) => m.asset).length;
    w.innerHTML = `
      <div class="nb-bar ml-bar">
        <div class="ml-chips">${cats.map((k) => `<button class="ml-chip ${k === S.cat ? "on" : ""}" data-cat="${k}">${CATS[k]}<span class="num">${k === "all" ? S.list.length : S.list.filter((m) => m.category === k).length}</span></button>`).join("")}</div>
        <span class="nb-state">${added} من ${S.list.length} في الأصول ${added ? `<button class="nb-btn sm" data-lib>افتح مكتبة الأصول</button>` : ""}</span>
      </div>
      <p class="nb-hint ml-hint">دوس على أي أنيميشن تتفرج عليه بالصوت. «ضيفه للأصول» بيعمله فيديو على السيرفر (ببلاش، من غير ذكاء اصطناعي)، وبعدها تلاقيه في المونتاج.</p>
      <div class="ml-grid">${list.map(card).join("") || `<div class="nh-empty">مفيش حاجة هنا.</div>`}</div>`;
  }

  async function load() {
    S.list = await api("/api/motion-library");
    render();
    clearInterval(S.poll);
    if (S.list.some((m) => m.job?.status === "working")) S.poll = setInterval(async () => {
      if (!S.el?.isConnected) return clearInterval(S.poll);
      S.list = await api("/api/motion-library").catch(() => S.list);
      render();
      if (!S.list.some((m) => m.job?.status === "working")) { clearInterval(S.poll); toast("✅ اتضاف للأصول"); }
    }, 2500);
  }

  // ---------- المعاينة: الأنيميشن نفسه شغّال (seek كل فريم) مع الصوت اللي مكتوب بالكود ----------
  function closeView() {
    const v = S.view;
    if (!v) return;
    S.view = null;
    cancelAnimationFrame(v.raf);
    v.audio?.pause();
    v.box.remove();
    document.removeEventListener("keydown", v.key);
  }
  function openView(m) {
    closeView();
    const box = document.createElement("div");
    box.className = "ml-view";
    box.innerHTML = `<div class="ml-vin">
      <div class="ml-vtop"><b>${esc(m.name)}</b><span class="nb-state" data-vs>بيحمّل…</span>
        ${m.asset ? `<span class="ml-ok">✓ في الأصول</span>` : `<button class="nb-btn sm" data-add="${esc(m.id)}">＋ ضيفه للأصول</button>`}
        <button class="nb-btn sm" data-mute>🔊</button><button class="nb-btn sm" data-x>✕</button></div>
      <div class="ml-stage"><iframe src="${esc(m.preview_url)}" title="${esc(m.name)}"></iframe></div></div>`;
    document.body.appendChild(box);
    const v = { box, raf: 0, audio: null, key: (e) => e.key === "Escape" && closeView() };
    S.view = v;
    document.addEventListener("keydown", v.key);
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.closest("[data-x]")) return closeView();
      if (e.target.closest("[data-mute]") && v.audio) { v.audio.muted = !v.audio.muted; e.target.closest("[data-mute]").textContent = v.audio.muted ? "🔇" : "🔊"; }
      const add = e.target.closest("[data-add]");
      if (add) addAsset(add.dataset.add, add);
    });
    const fr = box.querySelector("iframe"), stage = box.querySelector(".ml-stage");
    fr.addEventListener("load", async () => {
      const win = fr.contentWindow;
      try { await win.ready; } catch { return; }
      if (S.view !== v) return;
      const W = win.W, H = win.H, D = win.DUR;
      const fit = () => {
        const s = Math.min(stage.clientWidth / W, stage.clientHeight / H);
        Object.assign(fr.style, { width: W + "px", height: H + "px", transform: `scale(${s})` });
      };
      fit();
      new ResizeObserver(fit).observe(stage);
      try {
        v.audio = new Audio("data:audio/wav;base64," + win.soundtrack());
        v.audio.loop = true;
        await v.audio.play().catch(() => {});
      } catch { v.audio = null; }
      box.querySelector("[data-vs]").textContent = `${D.toFixed(0)} ثانية`;
      const t0 = performance.now();
      const tick = () => {
        if (S.view !== v) return;
        const t = v.audio && !v.audio.paused ? v.audio.currentTime % D : ((performance.now() - t0) / 1000) % D;
        win.seek(t);
        v.raf = requestAnimationFrame(tick);
      };
      tick();
    });
  }

  async function addAsset(id, btn) {
    try {
      if (btn) { btn.disabled = true; btn.textContent = "⏳"; }
      await api(`/api/motion-library/${id}/import`, { method: "POST" });
      toast("🎞️ بيتعمل فيديو… دقيقة أو اتنين");
      await load();
    } catch (err) { toast(err.message, true); if (btn) { btn.disabled = false; btn.textContent = "＋ ضيفه للأصول"; } }
  }

  function bind(w) {
    w.addEventListener("click", (e) => {
      if (e.target.closest("[data-lib]")) { showStep("11"); openLib(); return; }
      const chip = e.target.closest("[data-cat]");
      if (chip) { S.cat = chip.dataset.cat; return render(); }
      const add = e.target.closest("[data-add]");
      if (add) return addAsset(add.dataset.add, add);
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
    bind(w);
    try { await load(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: closeView };
})();
