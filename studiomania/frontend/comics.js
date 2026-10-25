// 🎭 مكتبة الكوميكس: كوميكس موجودة (GIF وصور وفيديوهات بصوت) من مصادر كبيرة، وكل واحد مكتوب له سياقه علشان يتحط في المكان الصح.
// التجميع أوتوماتيك (كلمات كتير بالمصري والخليجي والإنجليزي)، والمخ بيتفرج على كل كوميك ويكتب: الإحساس، الموقف، يتقال إمتى، الجملة اللي فيه.
const ComicsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { react: true, el: null, st: null, items: [], q: "", kind: "", status: "ready", lang: "", appr: "", page: 0, more: false, total: 0, timer: null, open: null, sel: null };
  const html = () => `<div class="nb-wrap fs-wrap cm-wrap" id="cmWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const media = (c) => (c.kind === "clip" || /\.mp4/.test(c.url || "") ? `<video src="${c.url}" poster="${c.thumb}" muted loop playsinline preload="none"></video>` : `<img src="${c.url}" alt="" loading="lazy">`);

  // 🎭 من البروتوتايب: شبكة الكوميكس بس، والفلاتر كلمات صغيرة، والتجميع والتعديل في درج على الجنب
  function drawer() {
    const st = S.st, s = st.state || {}, run = !!s.running, open = S.items.find((c) => c.id === S.open);
    if (open && st.admin && !S.sel) return editor(open);
    if (!S.drawer || !st.admin) return "";
    return `<aside class="pk-drawer" aria-label="اجمع قصصًا مصوّرة"><div class="pk-dh"><h2>اجمع قصصًا مصوّرة</h2>${pkIb("close", "إغلاق", "data-cmdx", "sm")}</div>
      ${run ? `<div class="pk-busy">⏳ ${esc(s.step || "جارٍ العمل…")} · ${s.progress || 0}% · أُضيف ${s.added || 0} ${pkIb("close", "أوقف", "data-cmstop", "sm")}</div>` : ""}
      ${s.last_error ? `<p class="pk-err">⚠️ ${esc(s.last_error)}</p>` : ""}
      <label class="pk-f">كلمات إضافية (كلمة في كل سطر)<textarea rows="4" data-cmq placeholder="اسم فيلم كوميدي&#10;عبارة مشهورة"></textarea></label>
      <label class="pk-tg">ردود فعل فقط، بدون نص على الشاشة<input type="checkbox" data-cmreact ${S.react ? "checked" : ""}></label>
      <label class="pk-tg">استخدم الكلمات الجاهزة (${st.seeds})<input type="checkbox" data-cmseeds checked></label>
      ${Object.entries(st.kind_names).filter(([k]) => k !== "image").map(([k, t]) => { const off = S.react && !["gif", "clip"].includes(k); return `<label class="pk-tg${off ? " dim" : ""}">${esc(t)}<input type="checkbox" data-cmkind="${k}" ${off ? "disabled" : (k !== "sticker" ? "checked" : "")}></label>`; }).join("")}
      <label class="pk-f">عدد الصفحات لكل كلمة<select data-cmpages><option value="1">صفحة</option><option value="2">صفحتان</option><option value="3">3 صفحات</option></select></label>
      <label class="pk-f">الحد الأقصى<select data-cmcap><option value="3000">3000</option><option value="5000" selected>5000</option><option value="10000">10000</option><option value="20000">20000</option></select></label>
      <div class="pk-dacts"><button class="nb-btn fs-go" data-cmgo ${run ? "disabled" : ""}>اجمع</button>
        ${st.pending ? `<button class="nb-btn" data-cmtag ${run ? "disabled" : ""}>اكتب السياق لـ ${st.pending}</button>` : ""}</div></aside>`;
  }
  const LANG_IC = { ar: "ع", en: "EN", both: "ع+EN" };
  function card(c) {
    const x = c.ctx || {}, on = S.sel?.has(c.id), lock = S.sel && c.approved;
    return `<figure class="cm-item${S.sel ? " picking" : ""}${on ? " picked" : ""}${c.approved ? " approved" : ""}${lock ? " locked" : ""}${c.status === "new" ? " waiting" : ""}" data-cid="${c.id}">${media(c)}
      ${S.sel ? `<span class="cm-check">${lock ? "🔒" : on ? "✓" : ""}</span>` : `<span class="cm-lang">${LANG_IC[c.lang] || ""}</span>`}
      ${S.st.admin && !S.sel ? `<label class="cm-appr${c.approved ? " on" : ""}" data-tip="${c.approved ? "معتمد" : "اعتمد"}"><input type="checkbox" data-cmappr ${c.approved ? "checked" : ""}>✓</label>` : ""}
      <figcaption><b>${esc(x.emotion || c.title || "")}</b>${c.has_audio ? " 🔊" : ""}<small>${esc(x.situation || c.query || "")}</small></figcaption></figure>`;
  }
  function editor(c) {
    const x = c.ctx || {};
    const f = (k, t, v) => `<label class="pk-f">${t}<input type="text" data-cmf="${k}" value="${esc(v)}"></label>`;
    return `<aside class="pk-drawer cm-edit" aria-label="الكوميك"><div class="pk-dh"><h2>${esc(x.emotion || "الكوميك")}</h2>${pkIb("close", "إغلاق", "data-cmclose", "sm")}</div>
      <div class="cm-edit-m">${media(c).replace("muted loop", "muted loop autoplay")}</div>
      ${f("emotion", "الإحساس", x.emotion)}${f("phrase", "العبارة", x.phrase)}${f("situation", "الموقف", x.situation)}${f("use_when", "متى يُستخدم", x.use_when)}
      ${f("who", "المصدر", x.who)}${f("tags", "كلمات البحث (بفاصلة)", (x.tags || []).join("، "))}
      <label class="pk-f">اللغة<select data-cmlang>${Object.entries(S.st.lang_names).map(([k, t]) => `<option value="${k}" ${k === c.lang ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
      <small class="pk-sub">${esc(c.source)} · ${esc(c.kind)}${c.dur ? ` · ${c.dur} ث` : ""}</small>
      <div class="pk-dacts"><button class="nb-btn fs-go" data-cmsave>احفظ</button><button class="nb-btn" data-cmhide>${c.status === "hidden" ? "أظهره" : "أخفِه"}</button>
        ${c.approved ? "" : `<button class="nb-btn danger" data-cmdel>احذف</button>`}</div></aside>`;
  }
  function menu() {
    if (!S.menu || !S.st.admin) return "";
    return `<div class="pk-menu" role="menu">
      <button data-cmapprvis ${S.total ? "" : "disabled"}>اعتمد الظاهر (${S.total})</button>
      <button data-cmapprall ${S.st.total ? "" : "disabled"}>اعتمد الكل (${S.st.total})</button>
      ${S.st.approved ? `<button data-cmunapprvis>ألغِ اعتماد الظاهر</button>` : ""}
      <button data-cmsel>حدّد كوميكس للحذف</button>
      ${S.total ? `<button class="bad" data-cmdelall>احذف الظاهر عدا المعتمد</button>` : ""}
      ${S.st.total ? `<button class="bad" data-cmdelevery>احذف الكل عدا المعتمد</button>` : ""}</div>`;
  }
  function render() {
    if (!S.el || !S.st) return;
    const st = S.st, run = !!st.state?.running;
    const stc = (k, t, n) => `<button class="pk-chip${S.status === k ? " on" : ""}" data-cmst="${k}">${t}${n != null ? `<span class="num">${n}</span>` : ""}</button>`;
    const grp = [["", "الكل", st.total], ...Object.entries(st.groups || {}).map(([k, g]) => [k, g.t, g.n])].map(([k, t, n]) =>
      `<button class="pk-chip${S.kind === k ? " on" : ""}" data-cmgk="${k}">${esc(t)}<span class="num">${n ?? 0}</span></button>`).join("");
    const langs = [["", "كل اللغات"], ...Object.entries(st.lang_names)].map(([k, t]) => `<button class="pk-chip${S.lang === k ? " on" : ""}" data-cmlt="${k}">${esc(t)}</button>`).join("");
    S.el.innerHTML = `<div class="pk">
      <div class="pk-top">
        <div class="pk-sub"><span><b class="num">${st.total}</b> مقطعًا</span><span><b class="num">${st.pending}</b> تنتظر السياق</span><span>✓ <b class="num">${st.approved || 0}</b> معتمد</span>${run ? `<span class="pk-busy">⏳ ${esc(st.state.step || "جارٍ الجمع…")} · ${st.state.progress || 0}%</span>` : ""}</div>
        <div class="pk-acts">
          ${S.searchOn || S.q ? `<input type="search" class="pk-q" data-cmsearch placeholder="ابحث بالإحساس أو الموقف أو العبارة" value="${esc(S.q)}" aria-label="بحث">` : pkIb("search", "ابحث بالإحساس أو الموقف", "data-cmsearchon")}
          ${st.admin ? `<label class="pk-ib" data-tip="أضف ملفات" aria-label="أضف ملفات">${pkIc("upload")}<input type="file" multiple accept="image/*,video/*,.gif" data-cmfiles hidden></label>` : ""}
          ${st.admin ? `<span class="pk-wrapm">${pkIb("more", "خيارات", "data-cmmenu")}${menu()}</span>` : ""}
          ${st.admin ? pkIb("plus", "اجمع قصصًا مصوّرة تلقائيًا", "data-cmdo", "blk") : ""}
        </div>
      </div>
      <div class="pk-chips">${grp}<span class="pk-sep"></span>${stc("ready", "الجاهز", st.ready)}${stc("new", "تنتظر السياق", st.pending)}${stc("hidden", "المخفي", st.hidden)}<span class="pk-sep"></span>${langs}</div>
      ${S.sel ? `<div class="pk-sub"><b>اضغط الكوميكس التي تريد حذفها</b> · <span class="num">${S.sel.size}</span> محدد
          <button class="pk-chip" data-cmselall>حدّد الظاهر</button><button class="pk-chip" data-cmseldel ${S.sel.size ? "" : "disabled"}>احذف المحدد</button><button class="pk-chip" data-cmselx>إلغاء</button></div>` : ""}
      <div class="cm-grid">${S.items.map(card).join("") || `<div class="pk-empty">${st.total ? "لا توجد نتائج" : "المكتبة فارغة. اضغط «＋» لجمع الكوميكس."}</div>`}</div>
      ${S.more ? `<button class="pk-more" data-cmmore>اعرض المزيد</button>` : ""}
      ${drawer()}</div>`;
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
        toast("⬆ جارٍ الرفع…");
        try { const r = await api("/api/comics/import", { method: "POST", body: fd }); toast(`✅ أُضيف ${r.added}`); await refresh(); render(); poll(); } catch (err) { toast(err.message, true); }
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
        if (q("[data-cmsearchon]")) { S.searchOn = true; render(); return w.querySelector("[data-cmsearch]")?.focus(); }
        if (q("[data-cmmenu]")) { S.menu = !S.menu; return render(); }
        if (q("[data-cmdo]")) { S.drawer = true; S.open = null; return render(); }
        if (q("[data-cmdx]")) { S.drawer = false; return render(); }
        if (q("[data-cmst]")) { S.status = q("[data-cmst]").dataset.cmst; S.open = null; await load(); return render(); }
        if (S.menu && !q(".pk-menu")) { S.menu = false; render(); }
        if (q("[data-cmstop]")) { await api("/api/comics/harvest/stop", { method: "POST" }); return toast("سيتوقف بعد الخطوة الجارية"); }
        if (q("[data-cmtag]")) { S.st = await api("/api/comics/tag", { method: "POST" }); render(); return poll(); }
        if (q("[data-cmurl]")) {
          const fd = new FormData(); fd.append("urls", w.querySelector("[data-cmurls]").value);
          const r = await api("/api/comics/import", { method: "POST", body: fd }); toast(`✅ أُضيف ${r.added}`); await refresh(); render(); return poll();
        }
        if (q("[data-cmmore]")) { await load(true); return render(); }
        if (q("[data-cmgk]")) { S.kind = q("[data-cmgk]").dataset.cmgk; S.open = null; await load(); return render(); }
        if (q("[data-cmlt]")) { S.lang = q("[data-cmlt]").dataset.cmlt; S.open = null; await load(); return render(); }
        if (q("[data-cmsel]")) { S.sel = new Set(); S.open = null; return render(); }
        if (q("[data-cmselx]")) { S.sel = null; return render(); }
        if (q("[data-cmselall]")) { S.items.forEach((c) => { if (!c.approved) S.sel.add(c.id); }); return render(); }
        if (q("[data-cmappr]") || q(".cm-appr")) return;   // التشيك بوكس يتعامل معه في change
        const flt = { q: S.q, kind: S.kind, status: S.status, lang: S.lang };
        if (q("[data-cmapprvis]") || q("[data-cmunapprvis]") || q("[data-cmapprall]")) {
          const all = !!q("[data-cmapprall]"), value = !q("[data-cmunapprvis]");
          const r = await api("/api/comics/approve", { method: "POST", ...jsonBody(all ? { all: true, value } : { all: true, value, ...flt }) });
          toast(value ? `✅ اعتُمد ${r.changed}` : `أُزيل الاعتماد من ${r.changed}`); S.st = r; await load(); return render();
        }
        if (q("[data-cmseldel]")) {
          if (!(await uiConfirm(`أتحذف ${S.sel.size} كوميك؟ الحذف نهائي.`))) return;
          const r = await api("/api/comics/delete", { method: "POST", ...jsonBody({ ids: [...S.sel] }) });
          toast(`🗑 حُذف ${r.deleted}`); S.sel = null; S.st = r; await load(); return render();
        }
        if (q("[data-cmdelall]") || q("[data-cmdelevery]")) {
          const every = !!q("[data-cmdelevery]");
          if (!(await uiConfirm(every ? "أتحذف المكتبة كلها عدا المعتمد؟ الحذف نهائي." : `أتحذف الظاهر (${S.total}) عدا المعتمد؟ الحذف نهائي.`))) return;
          const r = await api("/api/comics/delete", { method: "POST", ...jsonBody(every ? { all: true } : { all: true, ...flt }) });
          toast(`🗑 حُذف ${r.deleted}${r.kept_approved ? ` · بقي ${r.kept_approved} معتمد` : ""}`); S.st = r; await load(); return render();
        }
        if (q("[data-cmclose]")) { S.open = null; return render(); }
        const it = q(".cm-item");
        if (it && S.sel) {
          const id = it.dataset.cid;
          if (S.items.find((c) => c.id === id)?.approved) return toast("هذا معتمد: أزل الاعتماد أولًا لتتمكن من تحديده للحذف", true);
          S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); return render();
        }
        if (it && S.st.admin) { S.open = it.dataset.cid; S.drawer = false; return render(); }
        const cur = S.items.find((c) => c.id === S.open);
        if (!cur) return;
        if (q("[data-cmsave]")) {
          const ctx = Object.fromEntries([...w.querySelectorAll("[data-cmf]")].map((x) => [x.dataset.cmf, x.value]));
          ctx.tags = ctx.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean);
          const r = await api(`/api/comics/${cur.id}`, { method: "PATCH", ...jsonBody({ ctx, lang: w.querySelector("[data-cmlang]")?.value }) });
          S.items = S.items.map((c) => (c.id === r.id ? r : c)); toast("✅ حُفظ"); return render();
        }
        if (q("[data-cmhide]")) {
          const r = await api(`/api/comics/${cur.id}`, { method: "PATCH", ...jsonBody({ status: cur.status === "hidden" ? "ready" : "hidden" }) });
          S.items = S.items.filter((c) => c.id !== r.id); S.open = null; await refresh(); return render();
        }
        if (q("[data-cmdel]")) {
          if (!(await uiConfirm("أتحذف هذا الكوميك؟"))) return;
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
