// 🎬 معرض القوالب («ابدأ مشروع جديد»): كل قالب ستايل كارت طولي بفيديو بيعبّر عنه.
// الفيديو بيشتغل لما تقف على الكارت، والدوسة بتفتحه كبير. (اللي بيحصل بعد كده هنتفق عليه بعدين)
const Gallery = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { items: [], cats: [], cat: "all", root: null };
  // التايبوجرافي قالب زي الباقي: فيديو العرض بتاعه مترسوم بمحرك الكلام المتحرك نفسه
  const EXTRA = [{ id: "typo", name: "تايبوجرافي", icon: "🔤", sample_url: "/gallery/typo.mp4", cover_url: "/gallery/typo.jpg", cat: "motion",
    desc: "كلام بيتحرك على الإيقاع من صوتك أو سكريبتك، بأكتر من 300 حركة جاهزة." }];
  // سطر بيعرّف كل قالب (بيبان في المعاينة الكبيرة)
  const DESC = {
    "sk-diorama": "عالم ورق مجسّم بالطبقات زي الديوراما، بإضاءة دافية وحكاية وثائقية.",
    "sk-vox": "كولاج تحريري: صور مقصوصة وأسهم وورق قديم، زي فيديوهات Vox الشارحة.",
    "sk-glitch": "أشكال بيضا نضيفة وتشويش رقمي سريع، لإحساس تقني وحديث.",
    "sk-glass": "أجسام زجاج ثلاثية الأبعاد بتلمع وبتتحرك بنعومة.",
    "sk-engraved": "رسم محفور بالخطوط زي الكتب القديمة، بحركة تحريرية هادية.",
    "sk-archive": "صور أرشيف بالأبيض والأسود بتتحرك وبتتركّب فوق بعض.",
    "sk-paper": "ورق عتيق وطوابع وقصاصات، تكريم بإحساس الزمن الجميل.",
    "sk-clay": "شخصيات وعالم من الصلصال، ستوب موشن ببصمات الإيد.",
    "sk-papercut": "عالم كامل من الورق المقصوص بيتحرك ستوب موشن.",
    "sk-ugc": "شخص بيتكلم للكاميرا بالموبايل ويراجع المنتج بشكل طبيعي.",
    "sk-cinema-ad": "إعلان سينمائي باللقطات: إضاءة درامية وكاميرا وقصة قصيرة.",
    "sk-song": "إعلان على شكل أغنية وميوزك فيديو.",
    "sk-talking": "المنتج نفسه شخصية بتتكلم بأنيميشن.",
    "sk-skeleton": "«إيه اللي يحصل لو…؟» بهيكل عظمي ثلاثي الأبعاد بيشرح.",
    "sk-studio-shot": "صور استوديو احترافية للمنتج بإضاءة نضيفة.",
    "sk-product-scene": "المنتج جوه مشهد حقيقي يناسبه.",
    "sk-static-ads": "إعلانات ثابتة جاهزة للنشر من أكتر من 40 تصميم.",
  };
  const CAT_EN = { cartoon2d: "2D Cartoon", anim3d: "3D Animation", paper: "Paper", clay: "Clay", collage: "Collage", motion: "Motion", ugc: "UGC", cinematic: "Cinematic", product: "Product", other: "My Templates" };

  // فيديوهات عرض جاهزة للقوالب (متعمولة مرة واحدة ومحفوظة في frontend/gallery)
  const SHOW = ["sk-clay", "sk-papercut", "sk-ugc", "sk-cinema-ad", "sk-skeleton", "sk-talking", "sk-song",
    "sk-studio-shot", "sk-product-scene", "sk-static-ads"];
  async function load() {
    const [tpls, cats] = await Promise.all([api("/api/templates"), api("/api/style-cats").catch(() => [])]);
    const catOf = {};
    cats.forEach((c) => (c.templates || []).forEach((t) => (catOf[t.id] = c.id)));
    S.cats = cats;
    // القوالب اللي اتحفظت من المعمل ومعندهاش فيديو عرض: نعرض الفيديو الأصلي اللي اتعملت منه
    S.items = [...tpls.map((t) => ({ ...t, sample_url: t.sample_url || t.source_url,
      ...(SHOW.includes(t.id) ? { sample_url: `/gallery/${t.id}.mp4`, cover_url: `/gallery/${t.id}.jpg` } : {}),
      cat: catOf[t.id] || "other" })), ...EXTRA];
  }
  const catName = (id) => S.cats.find((c) => c.id === id)?.ar || "تانية";
  function chips() {
    const used = new Set(S.items.map((x) => x.cat));
    const list = [["all", "الكل"], ...S.cats.filter((c) => used.has(c.id)).map((c) => [c.id, c.ar])];
    return list.map(([k, t]) => `<button type="button" class="nh-gal-chip${S.cat === k ? " on" : ""}" data-gcat="${k}">${esc(t)}<span class="num">${k === "all" ? S.items.length : S.items.filter((x) => x.cat === k).length}</span></button>`).join("");
  }
  function card(x, i) {
    const vid = x.sample_url ? `<video muted loop playsinline preload="none" ${x.cover_url ? `poster="${esc(x.cover_url)}"` : ""} data-src="${esc(x.sample_url)}"></video>` : "";
    return `<button type="button" class="nh-gal-card${x.sample_url ? "" : " soon"}" data-gi="${i}" data-cat="${x.cat}" style="--d:${(i % 12) * 45}ms">
      <span class="nh-gal-art">${vid || `<span class="nh-gal-ph"><i>${x.icon || "✦"}</i><small>فيديو العرض جاي قريب</small></span>`}</span>
      <span class="nh-gal-meta"><span class="latin">${esc(CAT_EN[x.cat] || x.cat)}</span><b>${esc(x.name)}</b></span></button>`;
  }
  function grid() {
    const list = S.items.map((x, i) => [x, i]).filter(([x]) => S.cat === "all" || x.cat === S.cat);
    // اللي ليه فيديو الأول
    list.sort((a, b) => (!!b[0].sample_url - !!a[0].sample_url));
    return list.map(([x, i]) => card(x, i)).join("");
  }
  function render() {
    const g = S.root.querySelector("#nhGal");
    g.querySelector(".nh-gal-chips").innerHTML = chips();
    g.querySelector(".nh-gal-grid").innerHTML = grid();
  }
  // الفيديو بيتحمّل ويشتغل لما تقف على الكارت بس (عشان الصفحة تفضل خفيفة)
  function play(cardEl, on) {
    const v = cardEl.querySelector("video");
    if (!v) return;
    if (on) {
      if (!v.src) v.src = v.dataset.src;
      v.play().catch(() => {});
      cardEl.classList.add("playing");
    } else { v.pause(); cardEl.classList.remove("playing"); }
  }
  // المعاينة فوق الشاشة كلها (برّه الصفحة نفسها)
  function pvEl() {
    if (!S.pv) {
      S.pv = Object.assign(document.createElement("div"), { className: "nh-gal-pv", hidden: true });
      S.pv.setAttribute("role", "dialog");
      S.pv.addEventListener("click", (e) => { if (e.target === S.pv || e.target.closest("[data-gclose]")) closePv(); });
      document.body.appendChild(S.pv);
    }
    return S.pv;
  }
  function preview(x) {
    const pv = pvEl();
    pv.innerHTML = `<div class="nh-gal-pvbox">
      <button type="button" class="nh-gal-x" data-gclose aria-label="اقفل">✕</button>
      <div class="nh-gal-pvart">${x.sample_url ? `<video src="${esc(x.sample_url)}" ${x.cover_url ? `poster="${esc(x.cover_url)}"` : ""} autoplay loop playsinline controls></video>` : `<span class="nh-gal-ph big"><i>${x.icon || "✦"}</i><small>فيديو العرض جاي قريب</small></span>`}</div>
      <div class="nh-gal-pvt"><span class="latin">${esc(CAT_EN[x.cat] || x.cat)}</span><b>${esc(x.name)}</b>
        <p>${esc(DESC[x.id] || x.desc || x.description || "")}</p><small class="muted">${esc(catName(x.cat))}</small></div></div>`;
    pv.hidden = false;
    pv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    pv.querySelector(".nh-gal-pvbox").animate([{ opacity: 0, scale: .96 }, { opacity: 1, scale: 1 }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  function closePv() {
    const pv = S.pv;
    if (!pv || pv.hidden) return false;
    pv.querySelector("video")?.pause();
    pv.hidden = true;
    pv.innerHTML = "";
    return true;
  }
  function bind(root) {
    root.addEventListener("click", (e) => {
      const c = e.target.closest("[data-gcat]");
      if (c) { S.cat = c.dataset.gcat; render(); return; }
      const k = e.target.closest("[data-gi]");
      if (k) preview(S.items[+k.dataset.gi]);
    });
    root.addEventListener("pointerover", (e) => { const k = e.target.closest(".nh-gal-card"); if (k && !k.contains(e.relatedTarget)) play(k, true); });
    root.addEventListener("pointerout", (e) => { const k = e.target.closest(".nh-gal-card"); if (k && !k.contains(e.relatedTarget)) play(k, false); });
    root.addEventListener("focusin", (e) => { const k = e.target.closest(".nh-gal-card"); if (k) play(k, true); });
    root.addEventListener("focusout", (e) => { const k = e.target.closest(".nh-gal-card"); if (k) play(k, false); });
  }
  // Esc بيقفل المعاينة الأول (قبل ما يرجع من الصفحة)
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && closePv()) e.preventDefault(); }, true);

  async function mount(root) {
    S.root = root;
    S.cat = "all";
    if (!root._gal) { root._gal = true; bind(root); }   // نفس العنصر بيتعاد استخدامه لكل الصفحات: الأحداث مرة واحدة بس
    try { await load(); render(); } catch (err) { root.querySelector(".nh-gal-grid").innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { mount };
})();
