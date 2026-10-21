// 🎭 مكتبة الكوميكس: كوميكس موجودة (GIF وصور وفيديوهات بصوت) من مصادر كبيرة، وكل واحد مكتوب له سياقه علشان يتحط في المكان الصح.
// التجميع أوتوماتيك (كلمات كتير بالمصري والخليجي والإنجليزي)، والمخ بيتفرج على كل كوميك ويكتب: الإحساس، الموقف، يتقال إمتى، الجملة اللي فيه.
const ComicsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { react: true, el: null, st: null, items: [], q: "", kind: "", status: "ready", lang: "", appr: "", page: 0, more: false, total: 0, timer: null, open: null, sel: null };
  const html = () => `<div class="nb-wrap fs-wrap cm-wrap" id="cmWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const media = (c) => (c.kind === "clip" || /\.mp4/.test(c.url || "") ? `<video src="${c.url}" poster="${c.thumb}" muted loop playsinline preload="none"></video>` : `<img src="${c.url}" alt="" loading="lazy">`);

  function head() {
    const st = S.st, s = st.state || {}, run = !!s.running;
    const src = Object.entries(st.sources).map(([, v]) => `<span class="cm-src ${v.on ? "on" : ""}">${v.on ? "✅" : "⚪"} ${esc(v.name)}${!v.on && v.env ? ` <small dir="ltr">${esc(v.env)}</small>` : ""}</span>`).join("");
    return `<section class="fs-hero">
        <div class="fs-hero-t"><b>مكتبة الكوميكس</b><span class="latin">COMICS LIBRARY</span></div>
        <p>كوميكس حقيقية (GIF وصور وفيديوهات بصوت) بتتجمّع أوتوماتيك، والمخ بيتفرج على كل واحد ويكتب سياقه: الإحساس، الموقف، يتقال إمتى، والجملة اللي فيه. وأي أداة (زي التصوير بالموبايل) بتختار منها الكوميك المناسب للكلام.</p>
        <div class="cm-stats"><span><b class="num">${st.total}</b> كوميك</span><span><b class="num">${st.ready}</b> جاهز بسياقه</span><span><b class="num">${st.pending}</b> مستني سياق</span><span><b class="num">${st.hidden}</b> مستخبي</span><span>✅ <b class="num">${st.approved || 0}</b> معتمد</span>${st.skipped ? `<span><b class="num">${st.skipped}</b> اتساب (وصفه فشل)</span>` : ""}
          ${Object.entries(st.kinds).map(([k, n]) => `<span>${esc(st.kind_names[k] || k)} <b class="num">${n}</b></span>`).join("")}</div>
        <div class="cm-srcs">${src}</div>
      </section>
      ${st.admin ? `<section class="fs-card"><h3>التجميع <small>${st.seeds} كلمة جاهزة بالمصري والخليجي والإنجليزي، وتقدر تزوّد</small></h3>
        ${run ? `<div class="fs-busy">⏳ ${esc(s.step || "شغال…")} · ${s.progress || 0}% · اتضاف ${s.added || 0} · اتكتب سياق ${s.tagged || 0}${s.reactions ? ` · اتشال ${s.rejected || 0} (عليه كلام أو مش رد فعل)` : ""} · اتصرف تقريبًا $${(s.spent || 0).toFixed(2)} من حد $${st.max_usd} <button class="nb-btn sm danger" data-cmstop>وقّف</button></div>` : ""}
        ${s.last_error ? `<div class="fs-err">⚠️ ${esc(s.last_error)}</div>` : ""}
        <label class="nb-f"><span>كلمات زيادة (كل سطر كلمة): أسماء أفلام، إفيهات، شخصيات، مواقف</span><textarea rows="3" data-cmq placeholder="مثلًا:&#10;اسم فيلم كوميدي&#10;إفيه مشهور"></textarea></label>
        <label class="hk-big cm-react"><input type="checkbox" data-cmreact ${S.react ? "checked" : ""}> 😮 ردود فعل كوميدي بس (${Object.values(st.reaction_names || {}).join("، ")}): GIF وفيديو بس، ومن غير أي كلام مكتوب على الشاشة. اللي يطلع عليه كلام بيتشال لوحده</label>
        <div class="nb-bar"><label class="hk-big"><input type="checkbox" data-cmseeds checked> استخدم الكلمات الجاهزة كمان</label>
          ${Object.entries(st.kind_names).filter(([k]) => k !== "image").map(([k, t]) => { const off = S.react && !["gif", "clip"].includes(k); return `<label class="hk-big${off ? " dim" : ""}"><input type="checkbox" data-cmkind="${k}" ${off ? "disabled" : (k !== "sticker" ? "checked" : "")}> ${esc(t)}</label>`; }).join("")}
          <select data-cmpages><option value="1">صفحة لكل كلمة</option><option value="2">صفحتين</option><option value="3">3 صفحات</option></select>
          <select data-cmcap><option value="3000">لحد 3000</option><option value="5000" selected>لحد 5000</option><option value="10000">لحد 10000</option><option value="20000">لحد 20000</option></select></div>
        <div class="nb-bar"><button class="nb-btn fs-go" data-cmgo ${run ? "disabled" : ""}>🎭 جمّع كوميكس</button>
          ${st.pending ? `<button class="nb-btn" data-cmtag ${run ? "disabled" : ""}>🧠 اكتب السياق للـ ${st.pending} الباقيين</button>` : ""}</div>
        <details class="cm-imp"><summary>⬆ أو ضيف بنفسك (ملفات أو لينكات)</summary>
          <div class="nb-bar"><label class="nb-btn">📁 ملفات<input type="file" multiple accept="image/*,video/*,.gif" data-cmfiles hidden></label>
            <input type="text" data-cmurls placeholder="لينكات مباشرة لـ gif أو mp4، بينهم مسافة" dir="ltr" class="cm-urls"><button class="nb-btn" data-cmurl>ضيف</button></div></details>
      </section>` : ""}`;
  }
  const LANG_IC = { ar: "ع", en: "EN", both: "ع+EN" };
  function card(c) {
    const x = c.ctx || {}, on = S.sel?.has(c.id), lock = S.sel && c.approved;
    return `<figure class="cm-item${S.sel ? " picking" : ""}${on ? " picked" : ""}${c.approved ? " approved" : ""}${lock ? " locked" : ""}" data-cid="${c.id}">${media(c)}
      ${S.sel ? `<span class="cm-check" title="${lock ? "معتمد: شيل الاعتماد الأول علشان تقدر تمسحه" : ""}">${lock ? "🔒" : on ? "✓" : ""}</span>` : `<span class="cm-lang" title="${esc(S.st.lang_names[c.lang] || "")}">${LANG_IC[c.lang] || ""}</span>`}
      ${S.st.admin ? `<label class="cm-appr${c.approved ? " on" : ""}"><input type="checkbox" data-cmappr ${c.approved ? "checked" : ""}> اعتمد الكوميك</label>` : ""}
      <figcaption><b>${esc(x.emotion || c.title || "")}</b>${x.reaction && S.st.reaction_names?.[x.reaction] ? ` <span class="cm-rx">${esc(S.st.reaction_names[x.reaction])}</span>` : ""}${c.has_audio ? " 🔊" : ""}<small>${esc(x.situation || c.query || "")}</small>${x.phrase ? `<i>«${esc(x.phrase)}»</i>` : ""}</figcaption></figure>`;
  }
  function editor(c) {
    const x = c.ctx || {};
    const f = (k, t, v) => `<label class="nb-f"><span>${t}</span><input type="text" data-cmf="${k}" value="${esc(v)}"></label>`;
    return `<section class="fs-card cm-edit"><div class="cm-edit-m">${media(c).replace("muted loop", "muted loop autoplay")}</div><div class="fs-grid">
      ${f("emotion", "الإحساس", x.emotion)}${f("phrase", "الجملة اللي فيه", x.phrase)}${f("situation", "الموقف", x.situation)}${f("use_when", "يتقال إمتى", x.use_when)}
      ${f("who", "مين/منين", x.who)}${f("tags", "كلمات البحث (بفاصلة)", (x.tags || []).join("، "))}
      <label class="nb-f"><span>عربي ولا أجنبي</span><select data-cmlang>${Object.entries(S.st.lang_names).map(([k, t]) => `<option value="${k}" ${k === c.lang ? "selected" : ""}>${LANG_IC[k]} ${esc(t)}</option>`).join("")}</select></label></div>
      <div class="nb-bar"><button class="nb-btn" data-cmsave>💾 احفظ</button><button class="nb-btn" data-cmhide>${c.status === "hidden" ? "👁 أظهره" : "🙈 خبّيه"}</button>
        ${c.approved ? `<button class="nb-btn" disabled title="شيل الاعتماد الأول">🔒 معتمد (مايتمسحش)</button>` : `<button class="nb-btn danger" data-cmdel>🗑 امسحه</button>`}<button class="nb-btn sm" data-cmclose>✕</button>
        <small class="nb-state">${esc(c.source)} · ${esc(c.kind)}${c.dur ? ` · ${c.dur}ث` : ""}</small></div></section>`;
  }
  function render() {
    if (!S.el || !S.st) return;
    const open = S.items.find((c) => c.id === S.open);
    S.el.innerHTML = head() + `<section class="fs-card"><h3>المكتبة</h3>
      <div class="nb-bar"><input type="search" data-cmsearch placeholder="دوّر بالإحساس أو الموقف أو الجملة… مثلًا: صدمة، مفلس، آخر الشهر" value="${esc(S.q)}" class="cm-q">
        <select data-cmfs><option value="ready" ${S.status === "ready" ? "selected" : ""}>الجاهز</option><option value="new" ${S.status === "new" ? "selected" : ""}>مستني سياق</option><option value="hidden" ${S.status === "hidden" ? "selected" : ""}>المستخبي</option><option value="skip" ${S.status === "skip" ? "selected" : ""}>اللي اتساب</option></select>
        <select data-cmfa><option value="">معتمد وغير معتمد</option><option value="1" ${S.appr === "1" ? "selected" : ""}>✅ المعتمد بس</option><option value="0" ${S.appr === "0" ? "selected" : ""}>اللي لسه مااتعتمدش</option></select></div>
      <div class="cm-tabs cm-groups">${[["", "كل الأنواع", S.st.total], ...Object.entries(S.st.groups || {}).map(([k, g]) => [k, g.t, g.n])].map(([k, t, n]) =>
          `<button class="cm-tab${S.kind === k ? " on" : ""}" data-cmgk="${k}">${{ images: "🖼️ ", gifs: "🎞️ ", videos: "🎬 " }[k] || ""}${esc(t)} <span class="num">${n ?? 0}</span></button>`).join("")}</div>
      <div class="cm-tabs">${[["", "الكل"], ...Object.entries(S.st.lang_names)].map(([k, t]) => `<button class="cm-tab${S.lang === k ? " on" : ""}" data-cmlt="${k}">${k ? LANG_IC[k] + " " : ""}${esc(t)}${k && S.st.langs?.[k] != null ? ` <span class="num">${S.st.langs[k]}</span>` : ""}</button>`).join("")}
        <small class="cm-n">${S.total} نتيجة</small></div>
      ${S.st.admin && !S.sel ? `<div class="nb-bar cm-apprbar"><button class="nb-btn sm" data-cmapprvis ${S.total ? "" : "disabled"}>✅ اعتمد كل الظاهر (${S.total})</button>
          <button class="nb-btn sm" data-cmapprall ${S.st.total ? "" : "disabled"}>✅ اعتمد الكل (${S.st.total})</button>
          ${S.st.approved ? `<button class="nb-btn sm" data-cmunapprvis>شيل الاعتماد من الظاهر</button>` : ""}
          <small class="nb-state">المعتمد مابيتمسحش، ولا بيتعلّم عليه للمسح، غير لما تشيل اعتماده</small></div>` : ""}
      ${S.st.admin ? (S.sel ? `<div class="nb-bar cm-selbar"><b>اختار اللي عايز تمسحه (دوس عليه)</b><span class="num">${S.sel.size}</span> مختار
          <button class="nb-btn sm" data-cmselall>اختار كل اللي ظاهر</button>
          <button class="nb-btn sm danger" data-cmseldel ${S.sel.size ? "" : "disabled"}>🗑 امسح المختار</button>
          <button class="nb-btn sm" data-cmselx>إلغاء</button></div>`
        : `<div class="nb-bar"><button class="nb-btn sm" data-cmsel>☑ اختار كوميكس وامسحها</button>
          ${S.total ? `<button class="nb-btn sm danger" data-cmdelall>🗑 امسح الظاهر (${S.total}) ما عدا المعتمد</button>` : ""}
          ${S.st.total ? `<button class="nb-btn sm danger" data-cmdelevery>🗑 امسح الكل ما عدا المعتمد</button>` : ""}</div>`) : ""}
      ${open && S.st.admin && !S.sel ? editor(open) : ""}
      <div class="cm-grid">${S.items.map(card).join("") || `<div class="nh-empty">${S.st.total ? "مفيش نتايج" : "المكتبة لسه فاضية. دوس «جمّع كوميكس»."}</div>`}</div>
      ${S.more ? `<div class="nb-bar"><button class="nb-btn" data-cmmore>اعرض أكتر</button></div>` : ""}</section>`;
  }
  async function load(more = false) {
    S.page = more ? S.page + 1 : 0;
    const r = await api(`/api/comics?q=${encodeURIComponent(S.q)}&kind=${S.kind}&status=${S.status}&lang=${S.lang}&approved=${S.appr}&page=${S.page}`);
    S.items = more ? [...S.items, ...r.items] : r.items; S.more = r.more; S.total = r.total ?? S.items.length;
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
      if (e.target.matches("[data-cmfa]")) { S.appr = e.target.value; await load(); return render(); }
      if (e.target.matches("[data-cmreact]")) { S.react = e.target.checked; return render(); }
      if (e.target.matches("[data-cmappr]")) {
        const id = e.target.closest(".cm-item").dataset.cid;
        try {
          const r = await api(`/api/comics/${id}`, { method: "PATCH", ...jsonBody({ approved: e.target.checked }) });
          S.items = S.items.map((c) => (c.id === r.id ? r : c)); await refresh();
        } catch (err) { toast(err.message, true); }
        return render();
      }
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
            kinds: [...w.querySelectorAll("[data-cmkind]:checked")].map((x) => x.dataset.cmkind), pages: +w.querySelector("[data-cmpages]").value, cap: +w.querySelector("[data-cmcap]").value,
            reactions: !!S.react };
          S.st = await api("/api/comics/harvest", { method: "POST", ...jsonBody(body) }); render(); return poll();
        }
        if (q("[data-cmstop]")) { await api("/api/comics/harvest/stop", { method: "POST" }); return toast("هيقف بعد الخطوة اللي شغالة"); }
        if (q("[data-cmtag]")) { S.st = await api("/api/comics/tag", { method: "POST" }); render(); return poll(); }
        if (q("[data-cmurl]")) {
          const fd = new FormData(); fd.append("urls", w.querySelector("[data-cmurls]").value);
          const r = await api("/api/comics/import", { method: "POST", body: fd }); toast(`✅ اتضاف ${r.added}`); await refresh(); render(); return poll();
        }
        if (q("[data-cmmore]")) { await load(true); return render(); }
        if (q("[data-cmgk]")) { S.kind = q("[data-cmgk]").dataset.cmgk; S.open = null; await load(); return render(); }
        if (q("[data-cmlt]")) { S.lang = q("[data-cmlt]").dataset.cmlt; S.open = null; await load(); return render(); }
        if (q("[data-cmsel]")) { S.sel = new Set(); S.open = null; return render(); }
        if (q("[data-cmselx]")) { S.sel = null; return render(); }
        if (q("[data-cmselall]")) { S.items.forEach((c) => { if (!c.approved) S.sel.add(c.id); }); return render(); }
        if (q("[data-cmappr]") || q(".cm-appr")) return;   // التشيك بوكس بيتعامل معاه في change
        const flt = { q: S.q, kind: S.kind, status: S.status, lang: S.lang };
        if (q("[data-cmapprvis]") || q("[data-cmunapprvis]") || q("[data-cmapprall]")) {
          const all = !!q("[data-cmapprall]"), value = !q("[data-cmunapprvis]");
          const r = await api("/api/comics/approve", { method: "POST", ...jsonBody(all ? { all: true, value } : { all: true, value, ...flt }) });
          toast(value ? `✅ اتعتمد ${r.changed}` : `اتشال الاعتماد من ${r.changed}`); S.st = r; await load(); return render();
        }
        if (q("[data-cmseldel]")) {
          if (!(await uiConfirm(`تمسح ${S.sel.size} كوميك؟ المسح نهائي.`))) return;
          const r = await api("/api/comics/delete", { method: "POST", ...jsonBody({ ids: [...S.sel] }) });
          toast(`🗑 اتمسح ${r.deleted}`); S.sel = null; S.st = r; await load(); return render();
        }
        if (q("[data-cmdelall]") || q("[data-cmdelevery]")) {
          const every = !!q("[data-cmdelevery]");
          if (!(await uiConfirm(every ? "تمسح كل المكتبة ما عدا المعتمد؟ المسح نهائي." : `تمسح الظاهر (${S.total}) ما عدا المعتمد؟ المسح نهائي.`))) return;
          const r = await api("/api/comics/delete", { method: "POST", ...jsonBody(every ? { all: true } : { all: true, ...flt }) });
          toast(`🗑 اتمسح ${r.deleted}${r.kept_approved ? ` · فضل ${r.kept_approved} معتمد` : ""}`); S.st = r; await load(); return render();
        }
        if (q("[data-cmclose]")) { S.open = null; return render(); }
        const it = q(".cm-item");
        if (it && S.sel) {
          const id = it.dataset.cid;
          if (S.items.find((c) => c.id === id)?.approved) return toast("ده معتمد: شيل الاعتماد الأول علشان تقدر تعلّم عليه للمسح", true);
          S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); return render();
        }
        if (it && S.st.admin) { S.open = it.dataset.cid; render(); return w.querySelector(".cm-edit")?.scrollIntoView({ block: "center" }); }
        const cur = S.items.find((c) => c.id === S.open);
        if (!cur) return;
        if (q("[data-cmsave]")) {
          const ctx = Object.fromEntries([...w.querySelectorAll("[data-cmf]")].map((x) => [x.dataset.cmf, x.value]));
          ctx.tags = ctx.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean);
          const r = await api(`/api/comics/${cur.id}`, { method: "PATCH", ...jsonBody({ ctx, lang: w.querySelector("[data-cmlang]")?.value }) });
          S.items = S.items.map((c) => (c.id === r.id ? r : c)); toast("✅ اتحفظ"); return render();
        }
        if (q("[data-cmhide]")) {
          const r = await api(`/api/comics/${cur.id}`, { method: "PATCH", ...jsonBody({ status: cur.status === "hidden" ? "ready" : "hidden" }) });
          S.items = S.items.filter((c) => c.id !== r.id); S.open = null; await refresh(); return render();
        }
        if (q("[data-cmdel]")) {
          if (!(await uiConfirm("تمسح الكوميك ده؟"))) return;
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
