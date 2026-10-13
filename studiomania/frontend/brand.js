// 🧠 عقل البراند: صفحة واحدة بشكل الرئيسية الجديدة فيها كل حاجة عن البراند
// (الهوية، اللوجو والألوان، الستايل، قواعد المحتوى، التسليم، صور البراند). أي تعديل بيتحفظ لوحده.

const BrandPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { id: null, brains: [], cats: null, el: null, poll: null };
  const cur = () => S.brains.find((b) => b.id === S.id) || null;
  const bAPI = (path, opts) => api(`/api/ad-brains/${S.id}${path}`, opts);
  const KINDS = [["logos", "اللوجو"], ["products", "صور المنتج / الخدمة"], ["screens", "شاشات التطبيق"], ["characters", "شخصيات البراند"], ["sets", "الأماكن والخلفيات"], ["props", "الأدوات"]];
  const styleIds = (b) => String(b?.styles || "").split(",").map((x) => x.trim()).filter((x) => S.cats?.some((c) => c.id === x));
  const hexes = (txt) => [...String(txt || "").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]).slice(0, 8);

  const card = (span, title, en, inner, cls = "") => `<section class="nh-tile nh-panel nb-card ${cls}" style="grid-column:span ${span}">
    <div class="nb-h"><div class="nh-name"><span class="latin">${en}</span><b>${title}</b></div></div>${inner}</section>`;
  const field = (label, k, { area = 0, ph = "", ltr = false } = {}) => `<label class="nb-f"><span>${label}</span>${area
    ? `<textarea rows="${area}" data-k="${k}" placeholder="${esc(ph)}"${ltr ? ' dir="ltr"' : ""}></textarea>`
    : `<input type="text" data-k="${k}" placeholder="${esc(ph)}"${ltr ? ' dir="ltr"' : ""}>`}</label>`;
  const sel = (label, k, opts) => `<label class="nb-f"><span>${label}</span><select data-k="${k}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>`;

  function html() {
    return `<div class="nb-wrap" id="nbWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  }

  function skeleton() {
    return `
    <div class="nb-bar">
      <label class="nb-pick"><span>البراند</span><select id="nbPick"></select></label>
      <button class="nb-btn" id="nbNew">＋ براند جديد</button>
      <button class="nb-btn danger" id="nbDel">احذف</button>
      <span class="nb-state" id="nbState"></span>
    </div>
    <div class="nb-grid">
      ${card(7, "الهوية", "Identity", `
        <div class="nb-row">${field("الاسم", "@name")}${sel("نوع المنتج", "type", [["app", "📱 تطبيق"], ["physical", "📦 منتج ملموس"], ["service", "🤝 خدمة"]])}${field("المجال (النيش)", "domain", { ph: "لياقة، مطاعم، عقارات…" })}</div>
        ${field("عن البراند", "about", { area: 2 })}
        ${field("الجمهور", "audience", { area: 2 })}
        <div class="nb-row">${field("السوق", "market", { ph: "مثلًا: السعودية والخليج" })}${field("اللغة واللهجة", "language", { ph: "مثلًا: اللهجة السعودية البيضاء" })}</div>`)}
      ${card(5, "اللوجو والألوان", "Logo & Colors", `
        <div class="nb-logo" id="nbLogo"></div>
        <div class="nb-sw" id="nbSw"></div>
        ${field("الألوان", "palette", { area: 2, ltr: true, ph: "#E5613E orange, #111111 black" })}
        ${field("الخطوط", "typography")}
        <div class="nb-row nb-end"><button class="nb-btn" id="nbAnalyze">🔍 استنبط الهوية من الصور</button></div>`)}
      ${card(12, "الستايل", "Style", `
        <p class="nb-hint">اختار الستايلات اللي البراند بيشتغل بيها (واحد أو أكتر). اللي عليه ⭐ هو الافتراضي، وصفحة «ابدأ مشروع جديد» بتبدأ بيه.</p>
        <div class="nb-cats" id="nbCats"></div>`)}
      ${card(6, "قواعد المحتوى", "Content Rules", `
        <p class="nb-hint">اكتب بكلامك أي قاعدة لازم تتراعى في كل حاجة بتتعمل للبراند: السكريبت والصور والفيديو والصوت.</p>
        <textarea class="nb-rules" rows="9" data-k="rules" placeholder="مثلًا:&#10;البنات محجبات ولبسهم واسع&#10;من غير مزيكا&#10;من غير وعود مبالغ فيها"></textarea>`)}
      ${card(6, "التسليم", "Delivery", `
        ${sel("اللوجو على الفيديو", "logo_on", [["", "أيوه"], ["0", "لأ"]])}
        <div class="nb-vids">${["intro", "outro"].map((k) => `<div class="nb-vid" data-vid="${k}">
          <div class="nb-vh"><b>${k === "intro" ? "إنترو البراند" : "أوترو البراند"}</b><label class="nb-tog"><input type="checkbox" data-on="${k}"><span></span></label></div>
          <div class="nb-vbox"></div>
          <div class="nb-row"><label class="nb-btn">⬆ ارفع فيديو<input type="file" accept="video/*" data-vup="${k}" hidden></label><button class="nb-btn danger" data-vdel="${k}">شيله</button></div></div>`).join("")}</div>
        ${field("الـ CTA الافتراضي", "cta", { ph: "مثلًا: حمّل التطبيق دلوقتي" })}
        ${field("اللينك", "link", { ltr: true, ph: "https://..." })}
        ${field("الكابشن الافتراضي", "caption", { area: 3, ph: "{caption}\n\n{cta} 👇\n{link}\n#هاشتاج" })}
        <p class="nb-hint">{caption} كابشن الفيديو · {cta} الدعوة · {link} اللينك. بيتحط لوحده وقت النشر.</p>`)}
      ${card(12, "صور البراند", "Brand Assets", `
        <p class="nb-hint">صور حقيقية من البراند. البرنامج بيوصفها ويستخدمها بالظبط بدل ما يخترع.</p>
        <div id="nbAssets"></div>`)}
      ${card(12, "الهوية المستنبطة", "Derived", `
        <p class="nb-hint">بتتكتب لوحدها من اللوجو والصور، وتقدر تعدّلها.</p>
        <div class="nb-row">${field("الثيم", "theme", { area: 2 })}${field("ستايل الرسم (بالإنجليزي أحسن)", "style", { area: 2 })}</div>
        <div class="nb-row">${field("مكان اللوجو", "logo_rule")}${field("وصف اللوجو", "logo_description", { area: 2, ltr: true })}</div>
        ${field("شكل الواجهة (للبرومبتات)", "ui_style", { area: 2, ltr: true })}`)}
    </div>`;
  }

  const editing = () => S.el?.contains(document.activeElement) && document.activeElement.matches("input[type=text], textarea");

  function fill() {
    const b = cur();
    const w = S.el;
    if (!w) return;
    w.querySelector("#nbPick").innerHTML = S.brains.map((x) => `<option value="${x.id}" ${x.id === S.id ? "selected" : ""}>${esc(x.name)}</option>`).join("");
    w.querySelector("#nbDel").disabled = S.brains.length < 2;
    w.querySelector("#nbState").innerHTML = b?.status === "working" ? "🔍 بيشوف الصور ويستنبط الهوية…" : b?.status === "failed" ? `✕ ${esc(b.error || "الاستنباط فشل")}` : "";
    w.querySelector("#nbAnalyze").disabled = b?.status === "working";
    if (!b) return;
    if (!editing()) w.querySelectorAll("[data-k]").forEach((el) => (el.value = el.dataset.k === "@name" ? b.name : b[el.dataset.k] || ""));
    const logo = b.logos?.[0];
    w.querySelector("#nbLogo").innerHTML = logo ? `<img src="${esc(logo.url)}" alt="">` : `<span>${esc((b.name || "B").trim().slice(0, 1).toUpperCase())}</span>`;
    w.querySelector("#nbSw").innerHTML = hexes(b.palette).map((h) => `<i style="background:${h}" title="${h}"></i>`).join("");
    // الستايل
    const ids = styleIds(b);
    w.querySelector("#nbCats").innerHTML = (S.cats || []).map((c) => {
      const on = ids.includes(c.id), def = ids[0] === c.id;
      const covers = c.templates.filter((t) => t.cover_url).slice(0, 3);
      return `<div class="nb-cat ${on ? "on" : ""} ${def ? "def" : ""}" data-cat="${c.id}" role="button" tabindex="0">
        <div class="nb-cat-art">${covers.length ? covers.map((t) => `<img src="${esc(t.cover_url)}" alt="" loading="lazy">`).join("") : `<span>${c.icon}</span>`}</div>
        <div class="nb-cat-t"><b>${c.icon} ${esc(c.ar)}</b><span class="latin">${esc(c.en)}</span></div>
        <small>${c.templates.length ? `${c.templates.length} قالب` : "قريب"}</small>
        ${on ? `<button class="nb-star" data-star title="خليه الافتراضي">${def ? "⭐" : "☆"}</button>` : ""}</div>`;
    }).join("");
    // التسليم
    for (const k of ["intro", "outro"]) {
      const box = w.querySelector(`[data-vid="${k}"]`), url = b[`${k}_url`];
      box.querySelector(".nb-vbox").innerHTML = url ? `<video src="${esc(url)}" controls preload="metadata" playsinline></video>` : `<div class="nb-none">لسه مفيش فيديو</div>`;
      box.querySelector("[data-vdel]").hidden = !url;
      const tg = box.querySelector("[data-on]");
      tg.checked = !!url && !!b[`${k}_on`];
      tg.disabled = !url;
    }
    // صور البراند
    w.querySelector("#nbAssets").innerHTML = KINDS.filter(([k]) => k !== "screens" || b.type === "app").map(([k, t]) => `
      <div class="nb-kind"><div class="nb-kh"><b>${t}</b><span class="num">${(b[k] || []).length}</span>
        <label class="nb-btn sm">⬆ ارفع<input type="file" accept="image/*" multiple data-up="${k}" hidden></label>
        ${k === "screens" ? `<label class="nb-btn sm">📁 فولدر<input type="file" webkitdirectory directory multiple data-up="${k}" hidden></label>` : ""}</div>
        <div class="nb-imgs">${(b[k] || []).map((x) => `<figure data-file="${esc(x.file)}"><img src="${esc(x.url)}" alt="" loading="lazy" title="${esc(x.description || x.name)}"><figcaption>${esc(x.name)}</figcaption><button class="nb-x" data-adel title="احذف">✕</button></figure>`).join("") || `<div class="nb-none">مفيش</div>`}</div></div>`).join("");
  }

  async function save(fn) {
    try {
      const b = await fn();
      S.brains = S.brains.map((x) => (x.id === b.id ? b : x));
      fill();
      if (b.status === "working") watch();
      loadClients();
    } catch (err) { toast(err.message, true); }
  }
  function watch() {
    clearInterval(S.poll);
    S.poll = setInterval(async () => {
      if (!S.el?.isConnected) return clearInterval(S.poll);
      try {
        const b = await bAPI("");
        S.brains = S.brains.map((x) => (x.id === b.id ? b : x));
        if (b.status !== "working") { clearInterval(S.poll); loadClients(); }
        fill();
      } catch { clearInterval(S.poll); }
    }, 3000);
  }
  const patch = (fields, name) => save(() => bAPI("", { method: "PATCH", ...jsonBody(name != null ? { name, fields } : { fields }) }));

  function bind(w) {
    w.addEventListener("change", async (e) => {
      const el = e.target;
      if (el.id === "nbPick") { S.id = el.value; fill(); return; }
      if (el.dataset.k) return el.dataset.k === "@name" ? patch({}, el.value) : patch({ [el.dataset.k]: el.value });
      if (el.dataset.on) return patch({ [`${el.dataset.on}_on`]: el.checked ? "1" : "" });
      if (el.dataset.vup) {
        const f = el.files[0];
        el.value = "";
        if (!f) return;
        const form = new FormData();
        form.append("kind", el.dataset.vup);
        form.append("file", f);
        toast("⏳ بيرفع الفيديو…");
        return save(() => bAPI("/brand-video", { method: "POST", body: form }));
      }
      if (el.dataset.up) {
        const files = [...el.files].filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
        el.value = "";
        if (!files.length) return toast("مفيش صور (PNG / JPG / WEBP) في اللي اخترته", true);
        const form = new FormData();
        form.append("kind", el.dataset.up);
        files.slice(0, 120).forEach((f) => form.append("files", f));
        toast(`⏳ بيرفع ${files.length} صورة…`);
        return save(() => bAPI("/assets", { method: "POST", body: form }));
      }
    });
    w.addEventListener("click", async (e) => {
      const t = e.target;
      if (t.closest("#nbNew")) {
        const name = prompt("اسم البراند؟");
        if (!name?.trim()) return;
        try {
          const b = await api("/api/ad-brains", { method: "POST", ...jsonBody({ name, fields: {} }) });
          S.brains.push(b);
          S.id = b.id;
          fill();
          loadClients();
        } catch (err) { toast(err.message, true); }
        return;
      }
      if (t.closest("#nbDel")) {
        const b = cur();
        if (!b || !confirm(`تحذف «${b.name}» بكل صوره؟`)) return;
        try { await api(`/api/ad-brains/${b.id}`, { method: "DELETE" }); await load(); loadClients(); } catch (err) { toast(err.message, true); }
        return;
      }
      if (t.closest("#nbAnalyze")) return save(() => bAPI("/analyze", { method: "POST" }));
      const vdel = t.closest("[data-vdel]");
      if (vdel) { if (confirm("تشيل الفيديو ده؟")) save(() => bAPI(`/brand-video/${vdel.dataset.vdel}`, { method: "DELETE" })); return; }
      const fig = t.closest("[data-file]");
      if (fig && t.closest("[data-adel]")) { if (confirm("تحذف الصورة دي؟")) save(() => bAPI(`/assets/${encodeURIComponent(fig.dataset.file)}`, { method: "DELETE" })); return; }
      const cat = t.closest("[data-cat]");
      if (cat) {
        const ids = styleIds(cur()), id = cat.dataset.cat;
        const next = t.closest("[data-star]") ? [id, ...ids.filter((x) => x !== id)] : ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
        return patch({ styles: next.join(",") });
      }
    });
    w.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-cat]")) { e.preventDefault(); e.target.click(); }
    });
  }

  async function load() {
    const [brains, cats] = await Promise.all([api("/api/ad-brains"), S.cats ? S.cats : api("/api/style-cats").catch(() => [])]);
    S.brains = brains;
    S.cats = cats;
    if (!S.brains.some((b) => b.id === S.id)) S.id = clientx?.active || S.brains[0]?.id || null;
    fill();
    if (cur()?.status === "working") watch();
  }

  async function mount(root, id) {
    const w = root.querySelector("#nbWrap");
    if (!w) return;
    S.el = w;
    S.id = id || clientx?.active || S.id;
    w.innerHTML = skeleton();
    bind(w);
    try { await load(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, styleIds: (b) => styleIds(b), cats: () => S.cats };
})();
