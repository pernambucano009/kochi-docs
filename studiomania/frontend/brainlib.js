// 📁 مكتبة العقل: صور وفيديوهات وأصوات العميل في فولدرات جوه فولدرات، والمخ بيكتب على كل ملف هو إيه (وصف وتاجات).
// ده الأساس اللي «الموديل المخصص» بيشتغل عليه: منشن لفولدر («@صور/أسنان/قبل») أو لملف بعينه، أو بحث بالمعنى.
const BrainLibPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, lib: null, cur: null, q: "", kind: "", hits: null, open: null, timer: null };
  const html = () => `<div class="nb-wrap fs-wrap bl-wrap" id="blWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const IC = { image: "🖼️", video: "🎬", audio: "🎙️" };
  const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
  const folder = (id) => S.lib.folders.find((f) => f.id === id);
  const kidsOf = (id) => S.lib.folders.filter((f) => (f.parent || null) === (id || null)).sort((a, b) => a.name.localeCompare(b.name, "ar"));

  function crumbs() {
    const path = [];
    for (let f = folder(S.cur); f; f = folder(f.parent)) path.unshift(f);
    return `<nav class="bl-crumbs"><button type="button" data-blgo="">📁 المكتبة</button>${path.map((f) => `<span>›</span><button type="button" data-blgo="${f.id}">${esc(f.name)}</button>`).join("")}</nav>`;
  }
  function tree(parent, depth = 0) {
    return kidsOf(parent).map((f) => `<button type="button" class="bl-tf${f.id === S.cur ? " on" : ""}" data-blgo="${f.id}" style="padding-inline-start:${10 + depth * 14}px"
        data-bldrop="${f.id}">📁 ${esc(f.name)} <small class="num">${f.count || ""}</small></button>${tree(f.id, depth + 1)}`).join("");
  }
  function card(f) {
    const media = f.kind === "image" ? `<img src="${esc(f.thumb)}" alt="" loading="lazy">` : f.kind === "video"
      ? (f.thumb ? `<img src="${esc(f.thumb)}" alt="" loading="lazy">` : `<span class="bl-ph">🎬</span>`) : `<span class="bl-ph">🎙️</span>`;
    return `<figure class="bl-item${S.open === f.id ? " on" : ""}" data-blfile="${f.id}" draggable="true">${media}
      <figcaption><b>${IC[f.kind]} ${esc(f.name)}</b>${f.dur ? ` <small class="num">${dur(f.dur)}</small>` : ""}
        ${f.status === "tagging" ? `<small class="muted">⏳ المخ بيشوفه…</small>` : f.desc ? `<small>${esc(f.desc)}</small>` : ""}
        ${(f.tags || []).length ? `<span class="bl-tags">${f.tags.slice(0, 4).map((t) => `<i>${esc(t)}</i>`).join("")}</span>` : ""}</figcaption></figure>`;
  }
  function editor(f) {
    const opts = (id, depth = 0) => kidsOf(id).map((x) => `<option value="${x.id}" ${x.id === f.folder ? "selected" : ""}>${"— ".repeat(depth)}${esc(x.name)}</option>${opts(x.id, depth + 1)}`).join("");
    return `<section class="fs-card bl-edit"><div class="bl-eh"><b>${IC[f.kind]} ${esc(f.name)}</b><button type="button" class="nb-btn sm" data-blclose>✕</button></div>
      <div class="bl-eb">${f.kind === "image" ? `<img src="${esc(f.url)}" alt="">` : f.kind === "video" ? `<video src="${esc(f.url)}" controls playsinline preload="metadata"></video>` : `<audio src="${esc(f.url)}" controls preload="metadata"></audio>`}
        <div class="bl-ef">
          <label class="nb-f"><span>الاسم</span><input data-blf="name" value="${esc(f.name)}"></label>
          <label class="nb-f"><span>الوصف (المخ كتبه، وتقدر تعدّله)</span><textarea rows="2" data-blf="desc">${esc(f.desc || "")}</textarea></label>
          <label class="nb-f"><span>التاجات (بينهم فاصلة)</span><input data-blf="tags" value="${esc((f.tags || []).join("، "))}"></label>
          <label class="nb-f"><span>الفولدر</span><select data-blf="folder"><option value="">📁 المكتبة (برّه أي فولدر)</option>${opts(null)}</select></label>
          <p class="muted bl-ref">للمنشن: <code dir="auto">@${esc([f.path, f.name].filter(Boolean).join("/"))}</code></p>
          ${f.error ? `<p class="fs-err">⚠️ ${esc(f.error)}</p>` : ""}
          <div class="nb-bar"><button type="button" class="nb-btn fs-go" data-blsave>✓ احفظ</button><button type="button" class="nb-btn" data-blretag>🧠 خلّي المخ يشوفه تاني</button>
            <button type="button" class="nb-btn danger" data-bldel>🗑 امسح</button></div></div></div></section>`;
  }
  function render() {
    if (!S.el || !S.lib) return;
    const L = S.lib, inHere = L.files.filter((f) => (f.folder || null) === (S.cur || null)), sub = kidsOf(S.cur);
    const shown = S.hits ?? inHere;
    const cur = L.files.find((f) => f.id === S.open);
    S.el.innerHTML = `<section class="fs-hero">
        <div class="fs-hero-t"><b>مكتبة العقل</b><span class="latin">BRAND LIBRARY</span></div>
        <p>صورك وفيديوهاتك وأصواتك في فولدرات جوه فولدرات زي ما تحب. ارفع فولدر كامل بفولدراته، والمخ بيتفرج على كل ملف ويكتب هو إيه، فبعدين تلاقيه بالبحث أو تمنشنه («@صور/أسنان/قبل») في الأوتوميشن.</p>
        <div class="cm-stats"><span><b class="num">${L.total}</b> ملف</span><span><b class="num">${L.folders.length}</b> فولدر</span>${L.tagging ? `<span>⏳ <b class="num">${L.tagging}</b> المخ بيشوفهم</span>` : ""}</div>
      </section>
      <div class="bl-main"><aside class="bl-tree"><button type="button" class="bl-tf${!S.cur ? " on" : ""}" data-blgo="" data-bldrop="">📁 المكتبة <small class="num">${L.total || ""}</small></button>${tree(null)}</aside>
        <div class="bl-body">${crumbs()}
          <div class="nb-bar"><input type="search" class="bl-q" data-blq placeholder="🔎 دوّر بالمعنى: ابتسامة، قبل التبييض، العيادة من برا…" value="${esc(S.q)}">
            <select data-blkind><option value="">الكل</option>${Object.entries(L.kinds).map(([k, t]) => `<option value="${k}" ${S.kind === k ? "selected" : ""}>${IC[k]} ${esc(t)}</option>`).join("")}</select></div>
          <div class="nb-bar"><button type="button" class="nb-btn" data-blnew>＋ فولدر${S.cur ? " جوه ده" : ""}</button>
            <label class="nb-btn">⬆ ملفات<input type="file" multiple accept="image/*,video/*,audio/*" data-blup hidden></label>
            <label class="nb-btn">📂 فولدر كامل<input type="file" webkitdirectory directory multiple data-blup hidden></label>
            ${S.cur ? `<button type="button" class="nb-btn" data-blren>✏️ غيّر اسم الفولدر</button><button type="button" class="nb-btn danger" data-blrm>🗑 شيل الفولدر</button>` : ""}</div>
          ${cur ? editor(cur) : ""}
          ${S.hits ? `<p class="muted">${S.hits.length} نتيجة${S.cur ? " في الفولدر ده واللي جواه" : ""}</p>` : ""}
          ${!S.hits && sub.length ? `<div class="bl-folders">${sub.map((f) => `<button type="button" class="bl-fold" data-blgo="${f.id}" data-bldrop="${f.id}"><span>📁</span><b>${esc(f.name)}</b><small class="num">${f.count || 0}</small></button>`).join("")}</div>` : ""}
          <div class="bl-grid" data-bldrop="${S.cur || ""}">${shown.map(card).join("") || (sub.length ? "" : `<div class="nh-empty">الفولدر فاضي. ارفع ملفات أو اسحبها هنا.</div>`)}</div>
          <p class="muted">💡 اسحب أي ملف على فولدر عشان تنقله.</p></div></div>`;
  }
  async function refresh() { S.lib = await api("/api/library"); }
  async function runSearch() {
    if (!S.q.trim() && !S.kind) { S.hits = null; return render(); }
    const r = await api(`/api/library/search?q=${encodeURIComponent(S.q)}&kind=${encodeURIComponent(S.kind)}${S.cur ? `&ref=${encodeURIComponent(folder(S.cur)?.path || "")}` : ""}`);
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
    if (S.cur) fd.append("folder", S.cur);
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
        if ((b = q("[data-blgo]"))) { S.cur = b.dataset.blgo || null; S.open = null; S.hits = null; S.q = ""; return render(); }
        if (q("[data-blnew]")) {
          const name = prompt("اسم الفولدر الجديد:"); if (!name?.trim()) return;
          S.lib = await api("/api/library/folders", { method: "POST", ...jsonBody({ name, parent: S.cur }) }); return render();
        }
        if (q("[data-blren]")) {
          const name = prompt("الاسم الجديد:", folder(S.cur)?.name || ""); if (!name?.trim()) return;
          S.lib = await api(`/api/library/folders/${S.cur}`, { method: "PATCH", ...jsonBody({ name }) }); return render();
        }
        if (q("[data-blrm]")) {
          if (!confirm("تشيل الفولدر ده؟ اللي جواه هيطلع للفولدر اللي فوقه، ومفيش ملف هيتمسح.")) return;
          const up = folder(S.cur)?.parent || null;
          S.lib = await api(`/api/library/folders/${S.cur}`, { method: "DELETE" }); S.cur = up; return render();
        }
        if ((b = q("[data-blfile]"))) { S.open = S.open === b.dataset.blfile ? null : b.dataset.blfile; render(); return w.querySelector(".bl-edit")?.scrollIntoView({ block: "nearest" }); }
        if (q("[data-blclose]")) { S.open = null; return render(); }
        const f = S.lib.files.find((x) => x.id === S.open);
        if (!f) return;
        if (q("[data-blsave]")) {
          const v = (k) => w.querySelector(`[data-blf="${k}"]`).value;
          S.lib = await api(`/api/library/files/${f.id}`, { method: "PATCH", ...jsonBody({ name: v("name"), desc: v("desc"), tags: v("tags").split(/[،,]/).map((t) => t.trim()).filter(Boolean), folder: v("folder") || null, move: true }) });
          toast("✅ اتحفظ"); return render();
        }
        if (q("[data-blretag]")) { S.lib = await api(`/api/library/files/${f.id}/retag`, { method: "POST" }); render(); return poll(); }
        if (q("[data-bldel]")) {
          if (!confirm(`تمسح «${f.name}»؟ المسح نهائي.`)) return;
          S.lib = await api(`/api/library/files/${f.id}`, { method: "DELETE" }); S.open = null; return render();
        }
      } catch (err) { toast(err.message, true); }
    });
    w.addEventListener("change", async (e) => {
      try {
        if (e.target.matches("[data-blup]")) { const fs = e.target.files; await upload(fs); e.target.value = ""; return; }
        if (e.target.matches("[data-blkind]")) { S.kind = e.target.value; return runSearch(); }
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
        if (id) { S.lib = await api(`/api/library/files/${id}`, { method: "PATCH", ...jsonBody({ folder: t.dataset.bldrop || null, move: true }) }); return render(); }
        if (e.dataTransfer.files?.length) await upload(e.dataTransfer.files);
      } catch (err) { toast(err.message, true); }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#blWrap");
    if (!w) return;
    S.el = w; S.hits = null; S.q = "";
    bind(w);
    try { await refresh(); render(); poll(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => clearTimeout(S.timer) };
})();
