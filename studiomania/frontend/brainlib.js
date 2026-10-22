// 📚 مكتبة محتويات البراند: تابات (صور، فيديوهات، تعليقات صوتية، موسيقى، كوميكس). كل تاب من الأربعة الأولانيين فولدر أساسي،
// وجواه فولدرات جوه فولدرات زي ما تحب، والمخ بيكتب على كل ملف هو إيه (وصف وتاجات).
// ده الأساس اللي «القالب المخصص» بيشتغل عليه: منشن لفولدر («@صور/أسنان/قبل») أو لملف بعينه، أو بحث بالمعنى.
// التعليقات الصوتية والموسيقى هنا هي نفسها اللي المونتاج والقوالب بيختاروا منها.
const BrainLibPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  // من البروتوتايب: أول ما تدخل بتشوف الفولدرات بس (المحور)، وكل فولدر بيفتح لوحده، والتسلسل فوق: مكتبة المحتويات › الصور
  const S = { el: null, body: null, tab: null, mod: null, lib: null, root: null, cur: null, q: "", hits: null, open: null, timer: null, share: null, menu: false, searchOn: false, counts: {}, play: null };
  const TABS = [["ideas", "الأفكار"], ["images", "الصور"], ["videos", "الفيديوهات"], ["voice", "التعليقات الصوتية"], ["music", "الموسيقى"], ["comics", "الكوميكس"], ["chars", "الشخصيات والأفاتار"], ["exports", "الفيديوهات الجاهزة"]];
  const FIC = {
    ideas: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
    images: "M4.5 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 15.5l4.5-4.5 4 4 3-3 5 5 M15.5 8.5a1.3 1.3 0 1 1 0 .1z",
    videos: "M3.5 6.5h12v11h-12z M15.5 10l5-3v10l-5-3",
    voice: "M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z M6 11a6 6 0 0 0 12 0 M12 17v3.5",
    music: "M9 17.5V6l10-2v11.5 M9 17.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 17.5z M19 15.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 19 15.5z",
    comics: "M4 5h16v11H9l-5 4z M8 9.5h8 M8 12.5h5",
    chars: "M12 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z M5 20a7 7 0 0 1 14 0",
    exports: "M12 15V3.5 M7.5 8 12 3.5 16.5 8 M4.5 14v5.5h15V14",
  };
  const fic = (k, s = 30) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${FIC[k]}"/></svg>`;
  const UNIT = { ideas: "فكرة", images: "صورة", videos: "فيديو", voice: "تسجيل", music: "مقطوعة", comics: "مقطع", chars: "عنصر", exports: "فيديو" };
  const TAB = {
    images: { kind: "image", accept: "image/*", t: "الصور" },
    videos: { kind: "video", accept: "video/*", t: "الفيديوهات" },
    voice: { kind: "audio", accept: "audio/*,video/*", t: "التعليقات الصوتية" },
    music: { kind: "audio", accept: "audio/*,video/*", t: "الموسيقى" },
  };
  const html = () => `<div class="nb-wrap fs-wrap bl-wrap" id="blWrap"><div class="bl-tabbody" id="blBody"><div class="nh-empty">جارٍ التحميل…</div></div></div>`;
  const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
  const folder = (id) => S.lib.folders.find((f) => f.id === id);
  const kidsOf = (id) => S.lib.folders.filter((f) => (f.parent || null) === (id || null)).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const T = () => TAB[S.tab];
  const tabName = (k) => TABS.find(([x]) => x === k)?.[1] || "";

  // 🗂 المحور: الفولدرات الثمانية بعدد اللي جواها
  async function hub() {
    closeSub();
    S.tab = null; window.NHBar?.();
    const draw = () => { if (S.tab) return; S.body.innerHTML = `<div class="bl-hub"><p class="pk-note">كل ما يخص علامتك في مكان واحد، وكل ملف يمكنك الإشارة إليه («@») في القالب المخصص.</p>
      <div class="bl-folds">${TABS.map(([k, t]) => `<button type="button" class="bl-fd" data-bltab="${k}"><span class="bl-fi">${fic(k)}</span><b>${esc(t)}</b><small>${S.counts[k] != null ? `${S.counts[k]} ${UNIT[k]}` : "…"}</small></button>`).join("")}</div></div>`; };
    draw();
    const [lib, ideas, cm, acc] = await Promise.allSettled([api("/api/library"), api("/api/my-ideas"), api("/api/comics/status"), api("/api/content/account")]);
    if (lib.value) { S.lib = lib.value; const L = lib.value; Object.entries(L.roots || {}).forEach(([k, r]) => { const ids = new Set([r, ...L.folders.filter((f) => { for (let x = f; x; x = L.folders.find((y) => y.id === x.parent)) if (x.id === r) return true; return false; }).map((f) => f.id)]); S.counts[k] = L.files.filter((f) => ids.has(f.folder)).length; }); }
    if (ideas.value) S.counts.ideas = (ideas.value || []).length;
    if (cm.value) S.counts.comics = cm.value.total || 0;
    if (acc.value) { S.counts.exports = (acc.value.exports || []).length; S.counts.chars = (acc.value.characters || []).length + (acc.value.twins || []).length; }
    draw();
  }
  // المسار جوه الفولدر (لما تدخل فولدر جوه فولدر)
  function path() {
    const p = [];
    for (let f = folder(S.cur); f && f.id !== S.root; f = folder(f.parent)) p.unshift(f);
    return p.length ? `<nav class="bl-path"><button type="button" data-blgo="${S.root}">${esc(T().t)}</button>${p.map((f) => `<span>›</span><button type="button" data-blgo="${f.id}">${esc(f.name)}</button>`).join("")}</nav>` : "";
  }
  function card(f) {
    if (f.kind === "audio") return `<div class="bl-au${S.open === f.id ? " on" : ""}" data-blfile="${f.id}" draggable="true"><button type="button" class="bl-play" data-blplay="${esc(f.url)}" aria-label="تشغيل">${pkIc(S.play === f.url ? "close" : "play", 14)}</button>
        <div><b>${esc(f.name)}</b>${f.status === "tagging" ? `<small>⏳ يتعرّف عليه العقل…</small>` : f.desc ? `<small>${esc(f.desc)}</small>` : ""}</div><small class="num" dir="ltr">${dur(f.dur)}</small></div>`;
    const media = f.kind === "image" ? `<img src="${esc(f.thumb)}" alt="" loading="lazy">` : f.thumb ? `<img src="${esc(f.thumb)}" alt="" loading="lazy">` : `<span class="bl-ph">${pkIc("play", 22)}</span>`;
    return `<figure class="bl-tile${S.open === f.id ? " on" : ""}${f.status === "tagging" ? " waiting" : ""}" data-blfile="${f.id}" draggable="true">${media}<figcaption>${esc(f.desc || f.name)}${f.dur ? ` · ${dur(f.dur)}` : ""}</figcaption></figure>`;
  }
  function editor(f) {
    const opts = (id, depth = 0) => kidsOf(id).map((x) => `<option value="${x.id}" ${x.id === f.folder ? "selected" : ""}>${"— ".repeat(depth + 1)}${esc(x.name)}</option>${opts(x.id, depth + 1)}`).join("");
    const roots = f.kind === "audio" ? ["voice", "music"] : [S.tab];
    return `<aside class="pk-drawer" aria-label="${esc(f.name)}"><div class="pk-dh"><h2>${esc(f.name)}</h2>${pkIb("close", "إغلاق", "data-blclose", "sm")}</div>
      <div class="bl-em">${f.kind === "image" ? `<img src="${esc(f.url)}" alt="">` : f.kind === "video" ? `<video src="${esc(f.url)}" controls playsinline preload="metadata"></video>` : `<audio src="${esc(f.url)}" controls preload="metadata"></audio>`}</div>
      <label class="pk-f">الاسم<input data-blf="name" value="${esc(f.name)}"></label>
      <label class="pk-f">الوصف (كتبه العقل، ويمكنك تعديله)<textarea rows="2" data-blf="desc">${esc(f.desc || "")}</textarea></label>
      <label class="pk-f">الوسوم (بينها فاصلة)<input data-blf="tags" value="${esc((f.tags || []).join("، "))}"></label>
      <label class="pk-f">المجلد<select data-blf="folder">${roots.map((k) => { const r = S.lib.roots[k]; return `<option value="${r}" ${r === f.folder ? "selected" : ""}>${esc(TAB[k].t)}</option>${opts(r)}`; }).join("")}</select></label>
      <p class="pk-note">للإشارة إليه في القالب المخصص: <code dir="auto">@${esc([f.path, f.name].filter(Boolean).join("/"))}</code></p>
      ${f.error ? `<p class="pk-err">⚠️ ${esc(f.error)}</p>` : ""}
      <div class="pk-dacts"><button type="button" class="nb-btn fs-go" data-blsave>احفظ</button>${pkIb("refresh", "دع العقل يراه مرة أخرى", "data-blretag", "sm")}${pkIb("trash", "احذف", "data-bldel", "sm")}</div></aside>`;
  }
  function menu() {
    if (!S.menu) return "";
    const on = !!S.share?.keys.includes(S.tab), sub = S.cur !== S.root;
    return `<div class="pk-menu" role="menu"><button data-blnew>مجلد جديد${sub ? " داخل هذا" : ""}</button>
      <label class="pk-mi">ارفع مجلدًا كاملًا<input type="file" webkitdirectory directory multiple data-blup hidden></label>
      ${sub ? `<button data-blren>غيّر اسم المجلد</button><button class="bad" data-blrm>احذف المجلد</button>` : ""}
      <button data-blsharet>${on ? "ألغِ المشاركة مع علاماتك الأخرى" : "شارك هذا المجلد مع علاماتك الأخرى"}</button></div>`;
  }
  function render() {
    if (!S.el || !S.lib || !TAB[S.tab]) return;
    const L = S.lib, t = T();
    S.root = L.roots?.[S.tab] || null;
    if (!S.cur || !folder(S.cur)) S.cur = S.root;
    const inRoot = new Set([S.root, ...L.folders.filter((f) => { for (let x = f; x; x = folder(x.parent)) if (x.id === S.root) return true; return false; }).map((f) => f.id)]);
    const all = L.files.filter((f) => inRoot.has(f.folder)), inHere = L.files.filter((f) => f.folder === S.cur), sub = kidsOf(S.cur);
    const shown = S.hits ?? inHere, cur = L.files.find((f) => f.id === S.open), audio = t.kind === "audio";
    S.body.innerHTML = `<div class="pk"><div class="pk-top"><div class="pk-sub"><span><b class="num">${all.length}</b> ${UNIT[S.tab]}</span>${inRoot.size > 1 ? `<span><b class="num">${inRoot.size - 1}</b> مجلد</span>` : ""}
          ${L.tagging ? `<span class="pk-busy">⏳ يتعرّف العقل على ${L.tagging}</span>` : ""}${S.share?.keys.includes(S.tab) ? `<span>مشترك مع علاماتك الأخرى</span>` : ""}${S.hits ? `<span>${S.hits.length} نتيجة</span>` : ""}</div>
        <div class="pk-acts">${S.searchOn || S.q ? `<input type="search" class="pk-q" data-blq placeholder="ابحث بالاسم أو المعنى" value="${esc(S.q)}" aria-label="بحث">` : pkIb("search", "ابحث بالمعنى", "data-blsearchon")}
          <span class="pk-wrapm">${pkIb("more", "خيارات المجلد", "data-blmenu")}${menu()}</span>
          <label class="pk-ib blk" data-tip="ارفع ملفات" aria-label="ارفع ملفات">${pkIc("upload")}<input type="file" multiple accept="${t.accept}" data-blup hidden></label></div></div>
      ${path()}
      ${!S.hits && sub.length ? `<div class="bl-subs">${sub.map((f) => `<button type="button" class="bl-sub" data-blgo="${f.id}" data-bldrop="${f.id}">${pkIc("folder", 18)}<b>${esc(f.name)}</b><small class="num">${f.count || 0}</small></button>`).join("")}</div>` : ""}
      <div class="${audio ? "bl-aus" : "bl-tiles"}" data-bldrop="${S.cur}">${shown.map(card).join("") || (sub.length ? "" : `<div class="pk-empty">المجلد فارغ. ارفع ملفات أو اسحبها إلى هنا.</div>`)}</div>
      ${cur ? editor(cur) : ""}</div>`;
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
    S.timer = setTimeout(async () => { try { await refresh(); if (!S.hits) render(); } catch { /* الخادم يعيد التشغيل */ } poll(); }, 3000);
  }
  async function upload(files) {
    const list = [...files];
    if (!list.length) return;
    const fd = new FormData();
    fd.append("folder", S.cur || "");
    fd.append("paths", list.map((f) => f.webkitRelativePath || "").join("\n"));
    list.forEach((f) => fd.append("files", f));
    toast(`⏳ جارٍ رفع ${list.length} ملف…`);
    S.lib = await api("/api/library/files", { method: "POST", body: fd });
    render(); poll();
    toast("✓ رُفعت، وسيكتب العقل وصف كل ملف");
  }
  function bind(w) {
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      try {
        let b;
        if ((b = q("[data-bltab]"))) return showTab(b.dataset.bltab);
        if ((b = q("[data-blplay]"))) { e.stopPropagation(); return playAudio(b.dataset.blplay); }
        if (q("[data-blsearchon]")) { S.searchOn = true; render(); return w.querySelector("[data-blq]")?.focus(); }
        if (q("[data-blmenu]")) { S.menu = !S.menu; return render(); }
        if (q("[data-blsharet]")) { S.menu = false; return toggleShare(); }
        if (S.menu && !q(".pk-menu")) { S.menu = false; render(); }
        if ((b = q("[data-blnav]"))) return b.dataset.blnav === "twin" ? showStep("16") : window.NHNav?.(b.dataset.blnav);
        if (!TAB[S.tab]) return;
        if ((b = q("[data-blgo]"))) { S.cur = b.dataset.blgo || S.root; S.open = null; S.hits = null; S.q = ""; return render(); }
        if (q("[data-blnew]")) {
          const name = (await uiPrompt("اسم المجلد الجديد:")); if (!name?.trim()) return;
          S.lib = await api("/api/library/folders", { method: "POST", ...jsonBody({ name, parent: S.cur }) }); return render();
        }
        if (q("[data-blren]")) {
          const name = (await uiPrompt("الاسم الجديد:", folder(S.cur)?.name || "")); if (!name?.trim()) return;
          S.lib = await api(`/api/library/folders/${S.cur}`, { method: "PATCH", ...jsonBody({ name }) }); return render();
        }
        if (q("[data-blrm]")) {
          if (!(await uiConfirm("هل تحذف هذا المجلد؟ ينتقل ما بداخله إلى المجلد الأعلى، ولا يُحذف أي ملف."))) return;
          const up = folder(S.cur)?.parent || S.root;
          S.lib = await api(`/api/library/folders/${S.cur}`, { method: "DELETE" }); S.cur = up; return render();
        }
        if ((b = q("[data-blfile]")) && !q(".pk-drawer")) { S.open = S.open === b.dataset.blfile ? null : b.dataset.blfile; return render(); }
        if (q("[data-blclose]")) { S.open = null; return render(); }
        const f = S.lib?.files.find((x) => x.id === S.open);
        if (!f) return;
        if (q("[data-blsave]")) {
          const v = (k) => w.querySelector(`[data-blf="${k}"]`).value;
          S.lib = await api(`/api/library/files/${f.id}`, { method: "PATCH", ...jsonBody({ name: v("name"), desc: v("desc"), tags: v("tags").split(/[،,]/).map((t) => t.trim()).filter(Boolean), folder: v("folder") || null, move: true }) });
          toast("✓ تم الحفظ"); return render();
        }
        if (q("[data-blretag]")) { S.lib = await api(`/api/library/files/${f.id}/retag`, { method: "POST" }); render(); return poll(); }
        if (q("[data-bldel]")) {
          if (!(await uiConfirm(`هل تحذف «${f.name}»؟ الحذف نهائي.`))) return;
          S.lib = await api(`/api/library/files/${f.id}`, { method: "DELETE" }); S.open = null; return render();
        }
      } catch (err) { toast(err.message, true); }
    });
    w.addEventListener("change", async (e) => {
      try {
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
  function playAudio(url) {
    if (!S.audio) { S.audio = new Audio(); S.audio.onended = () => { S.play = null; render(); }; }
    if (S.play === url) { S.audio.pause(); S.play = null; }
    else { S.audio.src = url; S.audio.play().catch(() => {}); S.play = url; }
    render();
  }
  // 📦 ما في حساب العلامة: الشخصيات والأفاتار والفيديوهات الجاهزة (تظهر هنا تلقائيًا)
  async function renderAccount(tab) {
    S.body.innerHTML = `<div class="nh-empty">جارٍ التحميل…</div>`;
    const A = await api("/api/content/account");
    if (S.tab !== tab) return;
    const tile = (img, cap, extra = "") => `<figure class="bl-tile bl-acc">${img}<figcaption>${esc(cap)}</figcaption>${extra}</figure>`;
    if (tab === "chars") {
      const items = [...A.characters.map((c) => tile(`<img src="${esc(c.image_url)}" alt="" loading="lazy">`, c.name)),
        ...A.twins.flatMap((t) => [...(t.photos || []).map((p) => tile(`<img src="${esc(p.url)}" alt="" loading="lazy">`, `${t.name} · أفاتار`)),
          ...(t.backgrounds || []).map((b) => tile(`<img src="${esc(b.url)}" alt="" loading="lazy">`, b.name || "مكان تصوير"))])];
      S.body.innerHTML = `<div class="pk"><div class="pk-top"><div class="pk-sub"><span>تُضاف الشخصيات والأفاتار هنا تلقائيًا</span></div>
          <div class="pk-acts">${pkIb("users", "افتح الشخصيات", 'data-blnav="coaches"')}${pkIb("eye", "افتح الأفاتار", 'data-blnav="twin"')}</div></div>
        <div class="bl-tiles">${items.join("") || `<div class="pk-empty">لا توجد شخصيات أو أفاتار بعد.</div>`}</div></div>`;
      return;
    }
    S.body.innerHTML = `<div class="pk"><div class="pk-top"><div class="pk-sub"><span><b class="num">${A.exports.length}</b> فيديو صُدّر من هذا الحساب</span></div></div>
      <div class="bl-tiles">${A.exports.map((e) => `<figure class="bl-tile bl-acc"><video src="${esc(e.url)}#t=0.5" preload="metadata" muted playsinline controls></video>
        <figcaption>${esc(e.name)}${e.duration ? ` · ${Math.round(e.duration)} ث` : ""}</figcaption></figure>`).join("") || `<div class="pk-empty">لا توجد فيديوهات مُصدّرة بعد.</div>`}</div></div>`;
  }
  // 🔗 مشاركة المجلد الأساسي مع باقي العلامات في الحساب نفسه
  async function toggleShare() {
    const on = !S.share?.keys.includes(S.tab), name = tabName(S.tab), move = ["ideas", "images", "videos", "voice", "music"].includes(S.tab);
    if ((S.share?.brands || 1) < 2 && on) return toast("لديك علامة واحدة فقط الآن، وتفيد المشاركة عند إنشاء علامة أخرى.", true);
    const ok = await uiConfirm(on
      ? `هل تشارك «${name}» مع كل العلامات في الحساب؟ ${move ? "سيُجمع ما في هذا المجلد من كل علامة في مكان واحد تراه كل العلامات." : "ستراه كل العلامات."}`
      : `هل تلغي مشاركة «${name}»؟ ${move ? "يعود كل ملف إلى العلامة التي أُضيف منها." : "سترى كل علامة ما يخصها فقط."}`);
    if (!ok) return render();
    try {
      S.share = await api("/api/library/share", { method: "PUT", ...jsonBody({ key: S.tab, on }) });
      toast(on ? "✓ شُورك مع كل العلامات" : "أُلغيت المشاركة، وعاد كل ملف إلى علامته");
      S.cur = null; S.open = null; S.hits = null;
      await showTab(S.tab);
    } catch (err) { toast(err.message, true); }
  }
  function closeSub() { try { S.mod?.close?.(); } catch { /* */ } S.mod = null; clearTimeout(S.timer); S.audio?.pause(); S.play = null; }
  async function showTab(tab) {
    closeSub();
    if (!TABS.some(([k]) => k === tab)) return hub();
    if (tab !== S.tab) { S.cur = null; S.open = null; S.hits = null; S.q = ""; S.searchOn = false; S.menu = false; }
    S.tab = tab;
    window.NHBar?.();
    try { S.share = S.share || await api("/api/library/share"); } catch { /* المكتبة تعمل بدونها */ }
    try {
      if (S.tab === "comics") { S.mod = ComicsPage; S.body.innerHTML = ComicsPage.html(); return await ComicsPage.mount(S.body); }
      if (S.tab === "chars" || S.tab === "exports") return await renderAccount(S.tab);
      if (S.tab === "ideas") { S.mod = IdeasPage; S.body.innerHTML = IdeasPage.html(); return await IdeasPage.mount(S.body); }
      S.body.innerHTML = `<div class="nh-empty">جارٍ التحميل…</div>`;
      await refresh(); render(); poll();
    } catch (err) { S.body.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  async function mount(root) {
    const w = root.querySelector("#blWrap");
    if (!w) return;
    S.el = w; S.body = w.querySelector("#blBody"); S.share = null; S.tab = null;
    bind(w);
    const tab = window.BL_TAB;
    window.BL_TAB = null;
    await showTab(tab);
  }
  // التسلسل فوق: «مكتبة المحتويات › الصور»، و«رجوع» من جوه فولدر بيرجّعك للمحور
  const sub = () => (S.tab ? tabName(S.tab) : "");
  const back = () => { if (S.open) { S.open = null; render(); return true; } if (!S.tab) return false; hub(); return true; };
  return { html, mount, close: closeSub, sub, back };
})();
