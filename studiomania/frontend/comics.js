// 🎭 مكتبة الكوميكس: كوميكس موجودة (GIF وصور وفيديوهات بصوت) من مصادر كبيرة، وكل واحد مكتوب له سياقه علشان يتحط في المكان الصح.
// التجميع أوتوماتيك (كلمات كتير بالمصري والخليجي والإنجليزي)، والمخ بيتفرج على كل كوميك ويكتب: الإحساس، الموقف، يتقال إمتى، الجملة اللي فيه.
const ComicsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, st: null, items: [], q: "", kind: "", status: "ready", page: 0, more: false, timer: null, open: null };
  const html = () => `<div class="nb-wrap fs-wrap cm-wrap" id="cmWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const media = (c) => (c.kind === "clip" || /\.mp4/.test(c.url || "") ? `<video src="${c.url}" poster="${c.thumb}" muted loop playsinline preload="none"></video>` : `<img src="${c.url}" alt="" loading="lazy">`);

  function head() {
    const st = S.st, s = st.state || {}, run = !!s.running;
    const src = Object.entries(st.sources).map(([, v]) => `<span class="cm-src ${v.on ? "on" : ""}">${v.on ? "✅" : "⚪"} ${esc(v.name)}${!v.on && v.env ? ` <small dir="ltr">${esc(v.env)}</small>` : ""}</span>`).join("");
    return `<section class="fs-hero">
        <div class="fs-hero-t"><b>مكتبة الكوميكس</b><span class="latin">COMICS LIBRARY</span></div>
        <p>كوميكس حقيقية (GIF وصور وفيديوهات بصوت) بتتجمّع أوتوماتيك، والمخ بيتفرج على كل واحد ويكتب سياقه: الإحساس، الموقف، يتقال إمتى، والجملة اللي فيه. وأي أداة (زي «حكاية») بتختار منها الكوميك المناسب للكلام.</p>
        <div class="cm-stats"><span><b class="num">${st.total}</b> كوميك</span><span><b class="num">${st.ready}</b> جاهز بسياقه</span><span><b class="num">${st.pending}</b> مستني سياق</span><span><b class="num">${st.hidden}</b> مستخبي</span>${st.skipped ? `<span><b class="num">${st.skipped}</b> اتساب (وصفه فشل)</span>` : ""}
          ${Object.entries(st.kinds).map(([k, n]) => `<span>${esc(st.kind_names[k] || k)} <b class="num">${n}</b></span>`).join("")}</div>
        <div class="cm-srcs">${src}</div>
      </section>
      ${st.admin ? `<section class="fs-card"><h3>التجميع <small>${st.seeds} كلمة جاهزة بالمصري والخليجي والإنجليزي، وتقدر تزوّد</small></h3>
        ${run ? `<div class="fs-busy">⏳ ${esc(s.step || "شغال…")} · ${s.progress || 0}% · اتضاف ${s.added || 0} · اتكتب سياق ${s.tagged || 0} · اتصرف تقريبًا $${(s.spent || 0).toFixed(2)} من حد $${st.max_usd} <button class="nb-btn sm danger" data-cmstop>وقّف</button></div>` : ""}
        ${s.last_error ? `<div class="fs-err">⚠️ ${esc(s.last_error)}</div>` : ""}
        <label class="nb-f"><span>كلمات زيادة (كل سطر كلمة): أسماء أفلام، إفيهات، شخصيات، مواقف</span><textarea rows="3" data-cmq placeholder="مثلًا:&#10;اسم فيلم كوميدي&#10;إفيه مشهور"></textarea></label>
        <div class="nb-bar"><label class="hk-big"><input type="checkbox" data-cmseeds checked> استخدم الكلمات الجاهزة كمان</label>
          ${Object.entries(st.kind_names).filter(([k]) => k !== "image").map(([k, t]) => `<label class="hk-big"><input type="checkbox" data-cmkind="${k}" ${k !== "sticker" ? "checked" : ""}> ${esc(t)}</label>`).join("")}
          <select data-cmpages><option value="1">صفحة لكل كلمة</option><option value="2">صفحتين</option><option value="3">3 صفحات</option></select>
          <select data-cmcap><option value="3000">لحد 3000</option><option value="5000" selected>لحد 5000</option><option value="10000">لحد 10000</option><option value="20000">لحد 20000</option></select></div>
        <div class="nb-bar"><button class="nb-btn fs-go" data-cmgo ${run ? "disabled" : ""}>🎭 جمّع كوميكس</button>
          ${st.pending ? `<button class="nb-btn" data-cmtag ${run ? "disabled" : ""}>🧠 اكتب السياق للـ ${st.pending} الباقيين</button>` : ""}</div>
        <details class="cm-imp"><summary>⬆ أو ضيف بنفسك (ملفات أو لينكات)</summary>
          <div class="nb-bar"><label class="nb-btn">📁 ملفات<input type="file" multiple accept="image/*,video/*,.gif" data-cmfiles hidden></label>
            <input type="text" data-cmurls placeholder="لينكات مباشرة لـ gif أو mp4، بينهم مسافة" dir="ltr" class="cm-urls"><button class="nb-btn" data-cmurl>ضيف</button></div></details>
      </section>` : ""}`;
  }
  function card(c) {
    const x = c.ctx || {};
    return `<figure class="cm-item" data-cid="${c.id}">${media(c)}
      <figcaption><b>${esc(x.emotion || c.title || "")}</b>${c.has_audio ? " 🔊" : ""}<small>${esc(x.situation || c.query || "")}</small>${x.phrase ? `<i>«${esc(x.phrase)}»</i>` : ""}</figcaption></figure>`;
  }
  function editor(c) {
    const x = c.ctx || {};
    const f = (k, t, v) => `<label class="nb-f"><span>${t}</span><input type="text" data-cmf="${k}" value="${esc(v)}"></label>`;
    return `<section class="fs-card cm-edit"><div class="cm-edit-m">${media(c).replace("muted loop", "muted loop autoplay")}</div><div class="fs-grid">
      ${f("emotion", "الإحساس", x.emotion)}${f("phrase", "الجملة اللي فيه", x.phrase)}${f("situation", "الموقف", x.situation)}${f("use_when", "يتقال إمتى", x.use_when)}
      ${f("who", "مين/منين", x.who)}${f("tags", "كلمات البحث (بفاصلة)", (x.tags || []).join("، "))}</div>
      <div class="nb-bar"><button class="nb-btn" data-cmsave>💾 احفظ</button><button class="nb-btn" data-cmhide>${c.status === "hidden" ? "👁 أظهره" : "🙈 خبّيه"}</button>
        <button class="nb-btn danger" data-cmdel>🗑 امسحه</button><button class="nb-btn sm" data-cmclose>✕</button>
        <small class="nb-state">${esc(c.source)} · ${esc(c.kind)}${c.dur ? ` · ${c.dur}ث` : ""}</small></div></section>`;
  }
  function render() {
    if (!S.el || !S.st) return;
    const open = S.items.find((c) => c.id === S.open);
    S.el.innerHTML = head() + `<section class="fs-card"><h3>المكتبة</h3>
      <div class="nb-bar"><input type="search" data-cmsearch placeholder="دوّر بالإحساس أو الموقف أو الجملة… مثلًا: صدمة، مفلس، آخر الشهر" value="${esc(S.q)}" class="cm-q">
        <select data-cmfk><option value="">كل الأنواع</option>${Object.entries(S.st.kind_names).map(([k, t]) => `<option value="${k}" ${k === S.kind ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        <select data-cmfs><option value="ready" ${S.status === "ready" ? "selected" : ""}>الجاهز</option><option value="new" ${S.status === "new" ? "selected" : ""}>مستني سياق</option><option value="hidden" ${S.status === "hidden" ? "selected" : ""}>المستخبي</option></select></div>
      ${open && S.st.admin ? editor(open) : ""}
      <div class="cm-grid">${S.items.map(card).join("") || `<div class="nh-empty">${S.st.total ? "مفيش نتايج" : "المكتبة لسه فاضية. دوس «جمّع كوميكس»."}</div>`}</div>
      ${S.more ? `<div class="nb-bar"><button class="nb-btn" data-cmmore>اعرض أكتر</button></div>` : ""}</section>`;
  }
  async function load(more = false) {
    S.page = more ? S.page + 1 : 0;
    const r = await api(`/api/comics?q=${encodeURIComponent(S.q)}&kind=${S.kind}&status=${S.status}&page=${S.page}`);
    S.items = more ? [...S.items, ...r.items] : r.items; S.more = r.more;
  }
  async function refresh() { S.st = await api("/api/comics/status"); }
  function poll() {
    clearTimeout(S.timer);
    if (!S.st?.state?.running) return;
    S.timer = setTimeout(async () => {
      try { await refresh(); if (!S.el.querySelector("[data-cmf]:focus, [data-cmq]:focus")) { if (!S.st.state.running) await load(); render(); } } catch {}
      poll();
    }, 4000);
  }
  function bind(w) {
    let tq;
    w.addEventListener("input", (e) => {
      if (e.target.matches("[data-cmsearch]")) { S.q = e.target.value; clearTimeout(tq); tq = setTimeout(async () => { await load(); render(); const i = w.querySelector("[data-cmsearch]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 350); }
    });
    w.addEventListener("change", async (e) => {
      if (e.target.matches("[data-cmfk]")) { S.kind = e.target.value; await load(); return render(); }
      if (e.target.matches("[data-cmfs]")) { S.status = e.target.value; await load(); return render(); }
      if (e.target.matches("[data-cmfiles]") && e.target.files.length) {
        const fd = new FormData();
        [...e.target.files].forEach((f) => fd.append("files", f));
        toast("⬆ بيرفع…");
        try { const r = await api("/api/comics/import", { method: "POST", body: fd }); toast(`✅ اتضاف ${r.added}`); await refresh(); render(); poll(); } catch (err) { toast(err.message, true); }
      }
    });
    w.addEventListener("mouseover", (e) => { const v = e.target.closest(".cm-item video"); if (v) v.play().catch(() => {}); });
    w.addEventListener("mouseout", (e) => { const v = e.target.closest(".cm-item video"); if (v) v.pause(); });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      try {
        if (q("[data-cmgo]")) {
          const body = { queries: (w.querySelector("[data-cmq]").value || "").split("\n"), use_seeds: w.querySelector("[data-cmseeds]").checked,
            kinds: [...w.querySelectorAll("[data-cmkind]:checked")].map((x) => x.dataset.cmkind), pages: +w.querySelector("[data-cmpages]").value, cap: +w.querySelector("[data-cmcap]").value };
          S.st = await api("/api/comics/harvest", { method: "POST", ...jsonBody(body) }); render(); return poll();
        }
        if (q("[data-cmstop]")) { await api("/api/comics/harvest/stop", { method: "POST" }); return toast("هيقف بعد الخطوة اللي شغالة"); }
        if (q("[data-cmtag]")) { S.st = await api("/api/comics/tag", { method: "POST" }); render(); return poll(); }
        if (q("[data-cmurl]")) {
          const fd = new FormData(); fd.append("urls", w.querySelector("[data-cmurls]").value);
          const r = await api("/api/comics/import", { method: "POST", body: fd }); toast(`✅ اتضاف ${r.added}`); await refresh(); render(); return poll();
        }
        if (q("[data-cmmore]")) { await load(true); return render(); }
        if (q("[data-cmclose]")) { S.open = null; return render(); }
        const it = q(".cm-item");
        if (it && S.st.admin) { S.open = it.dataset.cid; render(); return w.querySelector(".cm-edit")?.scrollIntoView({ block: "center" }); }
        const cur = S.items.find((c) => c.id === S.open);
        if (!cur) return;
        if (q("[data-cmsave]")) {
          const ctx = Object.fromEntries([...w.querySelectorAll("[data-cmf]")].map((x) => [x.dataset.cmf, x.value]));
          ctx.tags = ctx.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean);
          const r = await api(`/api/comics/${cur.id}`, { method: "PATCH", ...jsonBody({ ctx }) });
          S.items = S.items.map((c) => (c.id === r.id ? r : c)); toast("✅ اتحفظ"); return render();
        }
        if (q("[data-cmhide]")) {
          const r = await api(`/api/comics/${cur.id}`, { method: "PATCH", ...jsonBody({ status: cur.status === "hidden" ? "ready" : "hidden" }) });
          S.items = S.items.filter((c) => c.id !== r.id); S.open = null; await refresh(); return render();
        }
        if (q("[data-cmdel]")) {
          if (!confirm("تمسح الكوميك ده؟")) return;
          await api(`/api/comics/${cur.id}`, { method: "DELETE" }); S.items = S.items.filter((c) => c.id !== cur.id); S.open = null; await refresh(); return render();
        }
      } catch (err) { toast(err.message, true); }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#cmWrap");
    if (!w) return;
    S.el = w;
    bind(w);
    try { await refresh(); await load(); render(); poll(); }
    catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => clearTimeout(S.timer) };
})();
