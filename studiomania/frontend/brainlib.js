// 📚 مكتبة محتويات البراند: تابات (صور، فيديوهات، تعليقات صوتية، موسيقى، كوميكس). كل تاب من الأربعة الأولانيين فولدر أساسي،
// وجواه فولدرات جوه فولدرات زي ما تحب، والمخ بيكتب على كل ملف هو إيه (وصف وتاجات).
// ده الأساس اللي «القالب المخصص» بيشتغل عليه: منشن لفولدر («@صور/أسنان/قبل») أو لملف بعينه، أو بحث بالمعنى.
// التعليقات الصوتية والموسيقى هنا هي نفسها اللي المونتاج والقوالب بيختاروا منها.
const BrainLibPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, body: null, tab: "images", mod: null, lib: null, root: null, cur: null, q: "", hits: null, open: null, timer: null, share: null };
  const TABS = [["ideas", "💡 الأفكار"], ["images", "🖼️ الصور"], ["videos", "🎬 الفيديوهات"], ["voice", "🎙️ التعليقات الصوتية"], ["music", "🎵 الموسيقى"], ["comics", "🎭 الكوميكس"], ["chars", "🧑‍🎤 الشخصيات والأفاتار"], ["exports", "📤 الفيديوهات الجاهزة"]];
  const TAB = {
    images: { kind: "image", accept: "image/*", t: "الصور", en: "IMAGES", hint: "صور البراند في فولدرات جوه فولدرات زي ما تحب (مثلًا: صور ← أسنان ← قبل)." },
    videos: { kind: "video", accept: "video/*", t: "الفيديوهات", en: "VIDEOS", hint: "فيديوهاتك الخام واللقطات في فولدرات جوه فولدرات." },
    voice: { kind: "audio", accept: "audio/*,video/*", t: "التعليقات الصوتية", en: "VOICE-OVERS", hint: "تسجيلات التعليق الصوتي. بتظهر برضو في المونتاج والقوالب." },
    music: { kind: "audio", accept: "audio/*,video/*", t: "الموسيقى", en: "MUSIC", hint: "الموسيقى اللي بتتحط تحت الفيديوهات. بتظهر برضو في المونتاج والقوالب." },
  };
  const html = () => `<div class="nb-wrap fs-wrap bl-wrap" id="blWrap"><nav class="bl-tabs" role="tablist"></nav><div class="bl-share"></div><div class="bl-tabbody" id="blBody"><div class="nh-empty">بيحمّل…</div></div></div>`;
  const IC = { image: "🖼️", video: "🎬", audio: "🎙️" };
  const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
  const folder = (id) => S.lib.folders.find((f) => f.id === id);
  const kidsOf = (id) => S.lib.folders.filter((f) => (f.parent || null) === (id || null)).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const T = () => TAB[S.tab];

  function crumbs() {
    const path = [];
    for (let f = folder(S.cur); f && f.id !== S.root; f = folder(f.parent)) path.unshift(f);
    return `<nav class="bl-crumbs"><button type="button" data-blgo="${S.root}">${IC[T().kind]} ${esc(T().t)}</button>${path.map((f) => `<span>›</span><button type="button" data-blgo="${f.id}">${esc(f.name)}</button>`).join("")}</nav>`;
  }
  function tree(parent, depth = 0) {
    return kidsOf(parent).map((f) => `<button type="button" class="bl-tf${f.id === S.cur ? " on" : ""}" data-blgo="${f.id}" style="padding-inline-start:${10 + depth * 14}px"
        data-bldrop="${f.id}">📁 ${esc(f.name)} <small class="num">${f.count || ""}</small></button>${tree(f.id, depth + 1)}`).join("");
  }
  function card(f) {
    const media = f.kind === "image" ? `<img src="${esc(f.thumb)}" alt="" loading="lazy">` : f.kind === "video"
      ? (f.thumb ? `<img src="${esc(f.thumb)}" alt="" loading="lazy">` : `<span class="bl-ph">🎬</span>`) : `<span class="bl-ph">${S.tab === "music" ? "🎵" : "🎙️"}</span>`;
    return `<figure class="bl-item${S.open === f.id ? " on" : ""}" data-blfile="${f.id}" draggable="true">${media}
      <figcaption><b>${esc(f.name)}</b>${f.dur ? ` <small class="num">${dur(f.dur)}</small>` : ""}
        ${f.status === "tagging" ? `<small class="muted">⏳ المخ بيشوفه…</small>` : f.desc ? `<small>${esc(f.desc)}</small>` : ""}
        ${(f.tags || []).length ? `<span class="bl-tags">${f.tags.slice(0, 4).map((t) => `<i>${esc(t)}</i>`).join("")}</span>` : ""}</figcaption></figure>`;
  }
  function editor(f) {
    const opts = (id, depth = 0) => kidsOf(id).map((x) => `<option value="${x.id}" ${x.id === f.folder ? "selected" : ""}>${"— ".repeat(depth + 1)}${esc(x.name)}</option>${opts(x.id, depth + 1)}`).join("");
    const roots = f.kind === "audio" ? ["voice", "music"] : [S.tab];
    return `<section class="fs-card bl-edit"><div class="bl-eh"><b>${IC[f.kind]} ${esc(f.name)}</b><button type="button" class="nb-btn sm" data-blclose>✕</button></div>
      <div class="bl-eb">${f.kind === "image" ? `<img src="${esc(f.url)}" alt="">` : f.kind === "video" ? `<video src="${esc(f.url)}" controls playsinline preload="metadata"></video>` : `<audio src="${esc(f.url)}" controls preload="metadata"></audio>`}
        <div class="bl-ef">
          <label class="nb-f"><span>الاسم</span><input data-blf="name" value="${esc(f.name)}"></label>
          <label class="nb-f"><span>الوصف (المخ كتبه، وتقدر تعدّله)</span><textarea rows="2" data-blf="desc">${esc(f.desc || "")}</textarea></label>
          <label class="nb-f"><span>التاجات (بينهم فاصلة)</span><input data-blf="tags" value="${esc((f.tags || []).join("، "))}"></label>
          <label class="nb-f"><span>الفولدر</span><select data-blf="folder">${roots.map((k) => { const r = S.lib.roots[k]; return `<option value="${r}" ${r === f.folder ? "selected" : ""}>📁 ${esc(TAB[k].t)}</option>${opts(r)}`; }).join("")}</select></label>
          <p class="muted bl-ref">للمنشن في الأوتوميشن: <code dir="auto">@${esc([f.path, f.name].filter(Boolean).join("/"))}</code></p>
          ${f.error ? `<p class="fs-err">⚠️ ${esc(f.error)}</p>` : ""}
          <div class="nb-bar"><button type="button" class="nb-btn fs-go" data-blsave>✓ احفظ</button><button type="button" class="nb-btn" data-blretag>🧠 خلّي المخ يشوفه تاني</button>
            <button type="button" class="nb-btn danger" data-bldel>🗑 امسح</button></div></div></div></section>`;
  }
  function render() {
    if (!S.el || !S.lib || !TAB[S.tab]) return;
    const L = S.lib, t = T();
    S.root = L.roots?.[S.tab] || null;
    if (!S.cur || !folder(S.cur)) S.cur = S.root;
    const inRoot = new Set([S.root, ...L.folders.filter((f) => { for (let x = f; x; x = folder(x.parent)) if (x.id === S.root) return true; return false; }).map((f) => f.id)]);
    const all = L.files.filter((f) => inRoot.has(f.folder)), inHere = L.files.filter((f) => f.folder === S.cur), sub = kidsOf(S.cur);
    const shown = S.hits ?? inHere;
    const cur = L.files.find((f) => f.id === S.open);
    S.body.innerHTML = `<section class="fs-hero">
        <div class="fs-hero-t"><b>${esc(t.t)}</b><span class="latin">${t.en}</span></div>
        <p>${t.hint} تقدر ترفع فولدر كامل بفولدراته، والمخ بيتفرج على كل ملف ويكتب هو إيه، فبعدين تلاقيه بالبحث أو تمنشنه («@») في الأوتوميشن.</p>
        <div class="cm-stats"><span><b class="num">${all.length}</b> ملف</span><span><b class="num">${inRoot.size - 1}</b> فولدر</span>${L.tagging ? `<span>⏳ <b class="num">${L.tagging}</b> المخ بيشوفهم</span>` : ""}</div>
      </section>
      <div class="bl-main"><aside class="bl-tree"><button type="button" class="bl-tf${S.cur === S.root ? " on" : ""}" data-blgo="${S.root}" data-bldrop="${S.root}">📁 ${esc(t.t)} <small class="num">${all.length || ""}</small></button>${tree(S.root)}</aside>
        <div class="bl-body">${crumbs()}
          <div class="nb-bar"><input type="search" class="bl-q" data-blq placeholder="🔎 دوّر بالاسم أو المعنى…" value="${esc(S.q)}"></div>
          <div class="nb-bar"><button type="button" class="nb-btn" data-blnew>＋ فولدر${S.cur !== S.root ? " جوه ده" : ""}</button>
            <label class="nb-btn">⬆ ملفات<input type="file" multiple accept="${t.accept}" data-blup hidden></label>
            <label class="nb-btn">📂 فولدر كامل<input type="file" webkitdirectory directory multiple data-blup hidden></label>
            ${S.cur !== S.root ? `<button type="button" class="nb-btn" data-blren>✏️ غيّر اسم الفولدر</button><button type="button" class="nb-btn danger" data-blrm>🗑 شيل الفولدر</button>` : ""}</div>
          ${cur ? editor(cur) : ""}
          ${S.hits ? `<p class="muted">${S.hits.length} نتيجة${S.cur !== S.root ? " في الفولدر ده واللي جواه" : ""}</p>` : ""}
          ${!S.hits && sub.length ? `<div class="bl-folders">${sub.map((f) => `<button type="button" class="bl-fold" data-blgo="${f.id}" data-bldrop="${f.id}"><span>📁</span><b>${esc(f.name)}</b><small class="num">${f.count || 0}</small></button>`).join("")}</div>` : ""}
          <div class="bl-grid" data-bldrop="${S.cur}">${shown.map(card).join("") || (sub.length ? "" : `<div class="nh-empty">الفولدر فاضي. ارفع ملفات أو اسحبها هنا.</div>`)}</div>
          <p class="muted">💡 اسحب أي ملف على فولدر عشان تنقله.</p></div></div>`;
  }
  async function refresh() { S.lib = await api("/api/library"); }
  async function runSearch() {
    if (!S.q.trim()) { S.hits = null; return render(); }
    const r = await api(`/api/library/search?q=${encodeURIComponent(S.q)}&kind=${encodeURIComponent(T().kind)}&ref=${encodeURIComponent(folder(S.cur)?.path || "")}`);
    S.hits = r.files || [];
    render();
  }
  function poll() {
    clearTimeout(S.timer);
    if (!S.lib?.tagging) return;
    S.timer = setTimeout(async () => { try { await refresh(); if (!S.hits) render(); } catch { /* السيرفر بيعيد التشغيل */ } poll(); }, 3000);
  }
  async function upload(files) {
    const list = [...files];
    if (!list.length) return;
    const fd = new FormData();
    fd.append("folder", S.cur || "");
    fd.append("paths", list.map((f) => f.webkitRelativePath || "").join("\n"));
    list.forEach((f) => fd.append("files", f));
    toast(`⏳ بيرفع ${list.length} ملف…`);
    S.lib = await api("/api/library/files", { method: "POST", body: fd });
    render(); poll();
    toast("✅ اترفعوا، والمخ بيكتب على كل واحد هو إيه");
  }
  function bind(w) {
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      try {
        let b;
        if ((b = q("[data-bltab]"))) return showTab(b.dataset.bltab);
        if ((b = q("[data-blnav]"))) return b.dataset.blnav === "twin" ? showStep("16") : window.NHNav?.(b.dataset.blnav);
        if (!TAB[S.tab]) return;
        if ((b = q("[data-blgo]"))) { S.cur = b.dataset.blgo || S.root; S.open = null; S.hits = null; S.q = ""; return render(); }
        if (q("[data-blnew]")) {
          const name = (await uiPrompt("اسم الفولدر الجديد:")); if (!name?.trim()) return;
          S.lib = await api("/api/library/folders", { method: "POST", ...jsonBody({ name, parent: S.cur }) }); return render();
        }
        if (q("[data-blren]")) {
          const name = (await uiPrompt("الاسم الجديد:", folder(S.cur)?.name || "")); if (!name?.trim()) return;
          S.lib = await api(`/api/library/folders/${S.cur}`, { method: "PATCH", ...jsonBody({ name }) }); return render();
        }
        if (q("[data-blrm]")) {
          if (!(await uiConfirm("تشيل الفولدر ده؟ اللي جواه هيطلع للفولدر اللي فوقه، ومفيش ملف هيتمسح."))) return;
          const up = folder(S.cur)?.parent || S.root;
          S.lib = await api(`/api/library/folders/${S.cur}`, { method: "DELETE" }); S.cur = up; return render();
        }
        if ((b = q("[data-blfile]"))) { S.open = S.open === b.dataset.blfile ? null : b.dataset.blfile; render(); return w.querySelector(".bl-edit")?.scrollIntoView({ block: "nearest" }); }
        if (q("[data-blclose]")) { S.open = null; return render(); }
        const f = S.lib?.files.find((x) => x.id === S.open);
        if (!f) return;
        if (q("[data-blsave]")) {
          const v = (k) => w.querySelector(`[data-blf="${k}"]`).value;
          S.lib = await api(`/api/library/files/${f.id}`, { method: "PATCH", ...jsonBody({ name: v("name"), desc: v("desc"), tags: v("tags").split(/[،,]/).map((t) => t.trim()).filter(Boolean), folder: v("folder") || null, move: true }) });
          toast("✅ اتحفظ"); return render();
        }
        if (q("[data-blretag]")) { S.lib = await api(`/api/library/files/${f.id}/retag`, { method: "POST" }); render(); return poll(); }
        if (q("[data-bldel]")) {
          if (!(await uiConfirm(`تمسح «${f.name}»؟ المسح نهائي.`))) return;
          S.lib = await api(`/api/library/files/${f.id}`, { method: "DELETE" }); S.open = null; return render();
        }
      } catch (err) { toast(err.message, true); }
    });
    w.addEventListener("change", async (e) => {
      try {
        if (e.target.matches("[data-blshare]")) return toggleShare(e.target);
        if (e.target.matches("[data-blup]")) { const fs = e.target.files; await upload(fs); e.target.value = ""; }
      } catch (err) { toast(err.message, true); }
    });
    let qt = 0;
    w.addEventListener("input", (e) => {
      if (!e.target.matches("[data-blq]")) return;
      S.q = e.target.value; clearTimeout(qt);
      qt = setTimeout(async () => { try { await runSearch(); const el = w.querySelector("[data-blq]"); el?.focus(); el?.setSelectionRange(S.q.length, S.q.length); } catch (err) { toast(err.message, true); } }, 350);
    });
    // سحب ملف على فولدر = نقل، وسحب ملفات من الكمبيوتر على المكتبة = رفع
    w.addEventListener("dragstart", (e) => { const it = e.target.closest("[data-blfile]"); if (it) e.dataTransfer.setData("text/bl-file", it.dataset.blfile); });
    w.addEventListener("dragover", (e) => { if (e.target.closest("[data-bldrop]")) { e.preventDefault(); e.target.closest("[data-bldrop]").classList.add("over"); } });
    w.addEventListener("dragleave", (e) => e.target.closest?.("[data-bldrop]")?.classList.remove("over"));
    w.addEventListener("drop", async (e) => {
      const t = e.target.closest("[data-bldrop]"); if (!t) return;
      e.preventDefault(); t.classList.remove("over");
      try {
        const id = e.dataTransfer.getData("text/bl-file");
        if (id) { S.lib = await api(`/api/library/files/${id}`, { method: "PATCH", ...jsonBody({ folder: t.dataset.bldrop || S.root, move: true }) }); return render(); }
        if (e.dataTransfer.files?.length) { S.cur = t.dataset.bldrop || S.cur; await upload(e.dataTransfer.files); }
      } catch (err) { toast(err.message, true); }
    });
  }
  // 📦 اللي في حساب البراند: الشخصيات والأفاتار والفيديوهات الجاهزة (بتظهر هنا لوحدها، وتقدر تمنشنها في الأوتوميشن)
  async function renderAccount(tab) {
    S.body.innerHTML = `<div class="nh-empty">بيحمّل…</div>`;
    const A = await api("/api/content/account");
    if (S.tab !== tab) return;
    const au = (u) => (u ? `<audio src="${esc(u)}" controls preload="none"></audio>` : "");
    if (tab === "chars") {
      const ch = A.characters.map((c) => `<figure class="bl-item bl-acc"><img src="${esc(c.image_url)}" alt="" loading="lazy"><figcaption><b>${esc(c.name)}</b>
          <small class="muted">🧑‍🎤 شخصية${(c.sheet || []).length ? ` · ${(c.sheet || []).length} صورة` : ""}</small>${au(c.voice_url)}</figcaption></figure>`).join("");
      const tw = A.twins.map((t) => `${(t.photos || []).map((p) => `<figure class="bl-item bl-acc"><img src="${esc(p.url)}" alt="" loading="lazy"><figcaption><b>${esc(t.name)}</b><small class="muted">🪞 أفاتار</small></figcaption></figure>`).join("")}
          ${t.voice_url ? `<figure class="bl-item bl-acc"><span class="bl-ph">🎙️</span><figcaption><b>صوت ${esc(t.name)}</b>${au(t.voice_url)}</figcaption></figure>` : ""}
          ${(t.backgrounds || []).map((b) => `<figure class="bl-item bl-acc"><img src="${esc(b.url)}" alt="" loading="lazy"><figcaption><b>${esc(b.name || "مكان تصوير")}</b><small class="muted">🏠 مكان من «الأفاتار»</small></figcaption></figure>`).join("")}`).join("");
      S.body.innerHTML = `<section class="fs-hero"><div class="fs-hero-t"><b>الشخصيات والأفاتار</b><span class="latin">CHARACTERS</span></div>
          <p>كل الشخصيات اللي عملتها، والأفاتار (الصور والصوت وأماكن التصوير). بيتضافوا هنا لوحدهم، وتقدر تمنشن أي واحد («@») في الأوتوميشن كصورة مرجع أو كصوت.</p>
          <div class="nb-bar"><button type="button" class="nb-btn" data-blnav="coaches">🧑‍🎤 افتح الشخصيات</button><button type="button" class="nb-btn" data-blnav="twin">🪞 افتح الأفاتار</button></div></section>
        <h4 class="bl-h">🧑‍🎤 الشخصيات</h4><div class="bl-grid">${ch || `<div class="nh-empty">لسه مفيش شخصيات.</div>`}</div>
        <h4 class="bl-h">🪞 الأفاتار</h4><div class="bl-grid">${tw || `<div class="nh-empty">لسه ماعملتش أفاتار.</div>`}</div>`;
      return;
    }
    S.body.innerHTML = `<section class="fs-hero"><div class="fs-hero-t"><b>الفيديوهات الجاهزة</b><span class="latin">EXPORTS</span></div>
        <p>كل فيديو اتصدّر من الحساب ده بيتحط هنا لوحده. تقدر تمنشنه («@») في الأوتوميشن كمرجع.</p><div class="cm-stats"><span><b class="num">${A.exports.length}</b> فيديو</span></div></section>
      <div class="bl-grid">${A.exports.map((e) => `<figure class="bl-item bl-acc"><video src="${esc(e.url)}#t=0.5" preload="metadata" muted playsinline controls></video>
        <figcaption><b>${esc(e.name)}</b><small class="muted num">${e.duration ? `${Math.round(e.duration)} ث · ` : ""}${esc(String(e.created_at || "").slice(0, 10))}</small></figcaption></figure>`).join("") || `<div class="nh-empty">لسه مفيش فيديوهات اتصدّرت.</div>`}</div>`;
  }
  // 🔗 مشاركة الفولدر الأساسي ده مع باقي البراندات اللي في نفس الأكاونت
  function shareBar() {
    const el = S.el.querySelector(".bl-share");
    if (!el) return;
    if (S.tab === "comics") { el.innerHTML = `<span class="bl-sh muted">🔗 الكوميكس متشاركة بين كل البراندات دايمًا</span>`; return; }
    const on = !!S.share?.keys.includes(S.tab), n = S.share?.brands || 1;
    el.innerHTML = `<label class="bl-sh${on ? " on" : ""}"><input type="checkbox" data-blshare ${on ? "checked" : ""}>
        <span>🔗 مشاركة محتويات الفولدر ده مع باقي البراندات في نفس الأكاونت</span></label>
      <small class="muted">${on ? "متشارك: كل البراندات بتشوف نفس الحاجات هنا، واللي تضيفه في أي براند بيظهر في الباقي." : n < 2 ? "عندك براند واحد بس دلوقتي، المشاركة هتفرق لما تعمل براند تاني." : "مش متشارك: الحاجات دي للبراند ده بس."}</small>`;
  }
  async function toggleShare(box) {
    const on = box.checked, name = TABS.find(([k]) => k === S.tab)?.[1] || "";
    const move = ["ideas", "images", "videos", "voice", "music"].includes(S.tab);
    const ok = await uiConfirm(on
      ? `تشارك «${name}» مع كل البراندات اللي في الأكاونت؟ ${move ? "اللي في الفولدر ده في كل براند هيتجمع في مكان واحد، وكل البراندات هتشوفه." : "كل البراندات هتشوف اللي هنا."}`
      : `تلغي مشاركة «${name}»؟ ${move ? "كل حاجة هترجع للبراند اللي اتضافت منه." : "كل براند هيشوف بتاعه بس تاني."}`);
    if (!ok) { box.checked = !on; return; }
    box.disabled = true;
    try {
      S.share = await api("/api/library/share", { method: "PUT", ...jsonBody({ key: S.tab, on }) });
      toast(on ? "🔗 اتشارك مع كل البراندات" : "اتلغت المشاركة، وكل حاجة رجعت لبراندها");
      S.cur = null; S.open = null; S.hits = null;
      await showTab(S.tab);
    } catch (err) { box.checked = !on; box.disabled = false; toast(err.message, true); }
  }
  function closeSub() { try { S.mod?.close?.(); } catch { /* */ } S.mod = null; clearTimeout(S.timer); }
  async function showTab(tab) {
    closeSub();
    if (tab !== S.tab) { S.cur = null; S.open = null; S.hits = null; S.q = ""; }
    S.tab = TABS.some(([k]) => k === tab) ? tab : "images";
    S.el.querySelector(".bl-tabs").innerHTML = TABS.map(([k, t]) => `<button type="button" role="tab" class="bl-tab${k === S.tab ? " on" : ""}" data-bltab="${k}" aria-selected="${k === S.tab}">${t}</button>`).join("");
    try { S.share = S.share || await api("/api/library/share"); } catch { /* الزرار مش هيظهر صح بس المكتبة تشتغل */ }
    shareBar();
    try {
      if (S.tab === "comics") { S.mod = ComicsPage; S.body.innerHTML = ComicsPage.html(); return await ComicsPage.mount(S.body); }
      if (S.tab === "chars" || S.tab === "exports") return await renderAccount(S.tab);
      if (S.tab === "ideas") { S.mod = IdeasPage; S.body.innerHTML = IdeasPage.html(); return await IdeasPage.mount(S.body); }
      S.body.innerHTML = `<div class="nh-empty">بيحمّل…</div>`;
      await refresh(); render(); poll();
    } catch (err) { S.body.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  async function mount(root) {
    const w = root.querySelector("#blWrap");
    if (!w) return;
    S.el = w; S.body = w.querySelector("#blBody"); S.share = null;
    bind(w);
    const tab = window.BL_TAB || S.tab || "images";
    window.BL_TAB = null;
    await showTab(tab);
  }
  return { html, mount, close: closeSub };
})();
