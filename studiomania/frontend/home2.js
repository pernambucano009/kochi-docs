// StudioMania — الرئيسية الجديدة (#nh): مربعات من غير حدود على شاشة سادة، سنيك حوالين المربع وقت الهوفر،
// مسرح في النص فيه مجسّم زجاج 3D لكل مربع، وكاميرا بتقرّب على المربع لحد ما يبقى الشاشة لما تدوس عليه.
// الأقسام نفسها لسه بشكلها القديم: المربع بيفتحها بنفس showStep اللي في shell.js.

const NH = (() => {
  const root = document.documentElement;
  const host = document.getElementById("nh");
  if (!host) return null;
  document.body.classList.add("nh");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const EASE = "cubic-bezier(.65,0,.35,1)";
  const esc = (s) => escapeHtml(String(s ?? ""));

  // ---------- أيقونات زجاج صغيرة (SVG) ----------
  const ICON = {
    app: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z M10 8.5v7l6-3.5z",
    create: "M12 4v16 M4 12h16 M12 4a8 8 0 0 1 0 16 M12 4a8 8 0 0 0 0 16",
    send: "M20.5 3.5 10 14 M20.5 3.5 14 20.5l-4-6.5-6.5-4z",
    box: "M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z M4 7.5l8 3.5 8-3.5 M12 11v9",
    gear: "M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    pulse: "M3 12h4l2.5-6 4 12 2.5-6h5",
    film: "M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z M8 4.5v15 M16 4.5v15 M3.5 9.5H8 M3.5 14.5H8 M16 9.5h4.5 M16 14.5h4.5",
    clapper: "M4 10h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z M4 10l1-4.5 15 3.2 M8.5 6.4l2 3.4 M13.5 7.5l2 2.6",
    phone: "M8.5 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M10.5 18h3 M10 9.5v5l4.5-2.5z",
    slides: "M9 3.5h6a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z M4 6v12 M20 6v12",
    users: "M9 5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5 M16 5.2a3.4 3.4 0 0 1 0 6.6 M18.5 14.8c1.7.7 2.8 2.4 3 5.2",
    music: "M9 18V5.5l11-2V16 M6.5 15.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z M17.5 13.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z",
    mic: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z M5.5 11a6.5 6.5 0 0 0 13 0 M12 17.5V21",
    megaphone: "M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z M15.5 8.8a4.5 4.5 0 0 1 0 6.4 M18 6.3a8 8 0 0 1 0 11.4",
    type: "M5 6.5V5h14v1.5 M12 5v14 M9 19h6",
    globe: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18",
    cut: "M6.5 4a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z M6.5 15a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z M8.6 8 20 18 M8.6 16 20 6",
  };
  const gi = (k) => `<svg class="gi" viewBox="-2 -2 28 28" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path class="glow" d="${ICON[k]}" stroke-width="3.4" filter="url(#nhGBlur)" transform="translate(0 .9)"/>
    <path class="body" d="${ICON[k]}" stroke-width="2.6"/>
    <path class="spec" d="${ICON[k]}" stroke-width=".5" transform="translate(-.45 -.55)"/></g></svg>`;

  // ---------- المربعات وإيه اللي بيفتح ----------
  // go = خطوة في البرنامج (showStep) · page = صفحة جوه الرئيسية · fn = حاجة خاصة
  const T = {
    create: { en: "Create", ar: "اعمل جديد", icon: "create", page: "create", desc: "كل أنواع الشغل من هنا: اختار النوع، والخطوات بتمشي معاك لحد التصدير." },
    brand: { en: "Your Brand", ar: "عقل البراند", icon: "brand", fn: () => openClientProfile(), desc: "كل تفاصيل البراند وتفضيلاته وستايله. أي شغل بيتعمل بيبني عليه." },
    assets: { en: "Assets", ar: "الأصول", icon: "box", page: "assets", desc: "المدربين والأصوات والموسيقى اللي بتستخدمها في أي شغل." },
    settings: { en: "Settings", ar: "الحساب والإعدادات", icon: "gear", go: "settings", desc: "المفاتيح والرصيد والعملاء." },
    progress: { en: "In Progress", ar: "شغّال عليه", icon: "pulse", page: "progress", desc: "كل خط مشروع، وكل نقطة خطوة. دوس على أي خط يكمّل من مكان ما وقفت." },
    publish: { en: "Publish", ar: "النشر", icon: "send", go: "7", desc: "الحسابات المربوطة والجدولة واللي اتنشر." },
    // جوه «اعمل جديد»: كل نوع بيفتح القسم اللي بيعمله النهارده
    reel: { en: "Reel", ar: "شورت / ريل من قالب", icon: "phone", go: "14", desc: "اختار ستايل، اكتب فكرتك، والقالب بيكمّل: سكريبت ← صوت ← مشاهد." },
    raw: { en: "From Footage", ar: "فيديو من تصويرك", icon: "cut", go: "0", desc: "المشروع ← التقطيع ← التوليد ← المونتاج ← النشر." },
    series: { en: "Series", ar: "مسلسل من حلقات", icon: "clapper", go: "9", desc: "حلقات ورا بعض بنفس الشخصيات والعالم." },
    carousel: { en: "Carousel", ar: "كاروسيل", icon: "slides", go: "8", desc: "فكرة ← نص ← تصميم ← سلايدات." },
    ad: { en: "Ad", ar: "إعلان", icon: "megaphone", go: "10", desc: "إعلان من مرجع أو من الصفر على براند العميل." },
    typo: { en: "Typography", ar: "تايبوجرافي", icon: "type", go: "12", desc: "كلام متحرك من صوت أو سكريبت." },
    dub: { en: "Dubbing", ar: "دبلجة فيديو", icon: "globe", go: "13", desc: "نفس الفيديو بلهجة تانية." },
    edit: { en: "Edit", ar: "مونتاج حر", icon: "film", go: "6", desc: "المحرر الكامل: تراكات ونص وطبقات وصوت." },
    coaches: { en: "Coaches", ar: "المدربين", icon: "users", go: "4", desc: "صور المدربين والأوترو." },
    voice: { en: "Voices", ar: "التعليق الصوتي", icon: "mic", go: "3", desc: "مكتبة التعليق." },
    music: { en: "Music", ar: "الموسيقى", icon: "music", go: "5", desc: "مكتبة الموسيقى." },
  };
  const CREATE_KIDS = ["reel", "raw", "series", "carousel"];
  const CREATE_ALL = ["reel", "raw", "series", "carousel", "ad", "typo", "dub", "edit"];
  const STEPS5 = ["المشروع", "التقطيع", "التوليد", "المونتاج", "النشر"];
  const D = { brand: null, folders: [], money: null, publisher: null, posts: [], coaches: [], voices: 0, music: 0 };

  const brandMark = () => {
    const c = clientx?.cur;
    return c?.logo ? `<img src="${esc(c.logo)}" alt="">` : esc((c?.name || "B").trim().slice(0, 1).toUpperCase());
  };
  const iconOf = (k) => (k === "brand" ? `<div class="nh-plate">${brandMark()}</div>` : gi(k));
  const head = (id) => `<div class="nh-head"><div class="nh-name"><span class="latin">${T[id].en}</span><b>${T[id].ar}</b></div>${iconOf(T[id].icon)}</div>`;
  const kid = (id) => `<div class="nh-tile" data-id="${id}" tabindex="0" role="button" aria-label="${esc(T[id].ar)}">${head(id)}</div>`;
  const dots = (n, at) => `<div class="nh-dots">${Array.from({ length: n }, (_, i) => `<i class="${i < at ? "done" : i === at ? "now" : ""}"></i>`).join("")}</div>`;
  const hexes = (txt) => [...String(txt || "").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]).slice(0, 5);
  function brainPct(b) {
    if (!b) return 0;
    const keys = ["about", "audience", "rules", "palette", "theme", "typography", "style", "market", "language"];
    const have = keys.filter((k) => String(b[k] || "").trim()).length + ((b.logos || []).length ? 1 : 0);
    return Math.round((have / (keys.length + 1)) * 100);
  }
  function lineHTML(f) {
    const s = folderStage(f);
    return `<div class="nh-line" data-folder="${esc(f.id)}" tabindex="0" role="button"><b>${esc(f.name)}</b>${dots(5, s.done)}<span class="step">${STEPS5[s.done] || ""}</span></div>`;
  }

  const TILE = {
    create: () => `${head("create")}<p class="nh-lead">اختار نوع الشغل وكمّل خطوة خطوة.</p><div class="nh-kids">${CREATE_KIDS.map(kid).join("")}</div>`,
    brand: () => {
      const b = D.brand, c = clientx?.cur, pct = brainPct(b);
      return `${head("brand")}<div class="nh-brandrow"><div><b>${esc(c?.name || "اختار عميل")}</b><div class="nh-sw">${hexes(b?.palette).map((h) => `<i style="background:${h}"></i>`).join("")}</div></div></div>
        <div class="nh-lines-txt">${b?.audience ? `<span><b>الجمهور:</b> ${esc(b.audience)}</span>` : ""}${b?.style ? `<span><b>الستايل:</b> ${esc(b.style)}</span>` : ""}${b?.theme ? `<span><b>الثيم:</b> ${esc(b.theme)}</span>` : ""}</div>
        <div class="nh-meter"><small><span>العقل مكتمل</span><span class="num">${pct}%</span></small><div class="bar"><i style="width:${pct}%"></i></div></div>`;
    },
    assets: () => `${head("assets")}<div class="nh-kids mini" style="grid-template-rows:repeat(3,minmax(0,1fr))">${["coaches", "voice", "music"].map(kid).join("")}</div>`,
    settings: () => `${head("settings")}<div class="nh-credit">${D.money ? `<span class="num">$${D.money.balance.toFixed(2)}</span><small>رصيد Atlas</small>` : `<small>الرصيد بيظهر لما مفتاح Atlas يتسجّل</small>`}</div>`,
    progress: () => `${head("progress")}<div class="nh-lines">${D.folders.length ? D.folders.slice(0, 4).map(lineHTML).join("") : `<div class="nh-empty">مفيش مشاريع لسه. ابدأ من «اعمل جديد».</div>`}</div>`,
    publish: () => {
      const P = D.publisher, acc = P?.accounts || {};
      const up = D.posts.filter((p) => p.status === "scheduled").length;
      return `${head("publish")}<div class="nh-plats">${Object.entries(P?.platforms || {}).slice(0, 4).map(([k, label]) =>
        `<div class="nh-plat ${acc[k] ? "on" : ""}"><span class="dot"></span>${esc(label)}<span class="pages">${acc[k] ? esc(acc[k].name || "مربوط") : "مش مربوط"}</span></div>`).join("")}</div>
        <div class="nh-body">${up ? `${up} بوست متجدول` : "مفيش بوستات متجدولة"}</div>`;
    },
  };
  const AREA = { create: "c", brand: "b", assets: "a", settings: "g", progress: "w", publish: "u" };

  // ---------- الهيكل ----------
  host.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <linearGradient id="nhGBody" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--nh-g1)"/><stop offset=".55" style="stop-color:var(--nh-g2)"/><stop offset="1" style="stop-color:var(--nh-g1)"/></linearGradient>
      <filter id="nhGBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1"/></filter></defs></svg>
    <div class="nh-home" id="nhHome">
      <header class="nh-top">
        <div class="nh-tools">
          <button class="nh-switch" id="nhTheme" aria-label="Switch theme"><span class="track"><span class="knob"></span></span><span class="latin" id="nhMode">Dark Mode</span></button>
          <button class="nh-chip" id="nhClient" title="العميل اللي شغال عليه"><i id="nhClientAv"></i><span id="nhClientName" data-no-i18n></span></button>
          <button class="nh-chip latin" id="nhLang" style="padding:6px 10px;letter-spacing:.2em">EN</button>
        </div>
        <div class="nh-logo" aria-label="StudioMania">STUDI<span class="o" aria-hidden="true"><svg viewBox="0 0 100 100"><circle class="ring" cx="50" cy="50" r="44"/><circle class="orbit" cx="50" cy="50" r="70" pathLength="100"/></svg></span>MANIA</div>
      </header>
      <main class="nh-bento" id="nhBento"></main>
    </div>
    <section class="nh-page" id="nhPage" hidden role="dialog" aria-modal="true">
      <header class="nh-ptop"><button class="nh-back" id="nhBack"><span aria-hidden="true">→</span><span class="latin">Back</span></button><div class="nh-ptitle" id="nhPTitle"></div></header>
      <div class="nh-pgrid" id="nhPGrid"></div>
    </section>`;
  const bento = document.getElementById("nhBento"), home = document.getElementById("nhHome");
  const page = document.getElementById("nhPage"), pGrid = document.getElementById("nhPGrid"), pTitle = document.getElementById("nhPTitle");

  function renderTiles() {
    const stageEl = document.getElementById("nhStage");
    const html = Object.keys(TILE).map((id) => `<div class="nh-tile ${id === "create" ? "nh-create" : ""}" data-id="${id}" tabindex="0" role="button" aria-label="${esc(T[id].ar)}" style="grid-area:${AREA[id]}">${TILE[id]()}</div>`).join("");
    if (stageEl) { bento.querySelectorAll(":scope > .nh-tile").forEach((t) => t.remove()); bento.insertAdjacentHTML("afterbegin", html); }
    else bento.innerHTML = html + `<section class="nh-stage" id="nhStage" aria-live="polite" style="grid-area:s"><div class="slot" id="nhSlotA"></div><div class="slot out" id="nhSlotB"></div></section>`;
    bento.querySelectorAll(".nh-tile").forEach(addSnake);
    const c = clientx?.cur;
    document.getElementById("nhClientAv").innerHTML = brandMark();
    document.getElementById("nhClientName").textContent = c?.name || "العميل";
  }

  // ---------- السنيك ----------
  function addSnake(el) {
    if (el.querySelector(":scope > .nh-snake")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "nh-snake");
    svg.innerHTML = ["s3", "s2", "s1"].map((c) => `<rect class="${c}" pathLength="1000"/>`).join("");
    el.prepend(svg);
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight, r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.querySelectorAll("rect").forEach((x) => { x.setAttribute("x", .8); x.setAttribute("y", .8); x.setAttribute("width", Math.max(0, w - 1.6)); x.setAttribute("height", Math.max(0, h - 1.6)); x.setAttribute("rx", Math.max(0, r - .8)); });
    };
    new ResizeObserver(fit).observe(el);
    fit();
  }

  // ---------- المسرح ----------
  renderTiles();
  const GL = window.NHGL ? window.NHGL(document.getElementById("nhStage"), () => clientx?.cur) : null;
  const slots = [document.getElementById("nhSlotA"), document.getElementById("nhSlotB")];
  let live = 0, shown = null;
  function stageHTML(key) {
    const big = (k) => (GL ? "" : `<div class="big">${iconOf(k)}</div>`);
    if (!key) return `${big("app")}<h1 class="latin">StudioMania</h1><div class="ar">استوديو المحتوى والفيديو</div><p>ابدأ من «اعمل جديد»، أو كمّل مشروع من اللي تحت.</p>`;
    if (key.startsWith("f:")) {
      const f = D.folders.find((x) => x.id === key.slice(2)), s = folderStage(f);
      return `${big("pulse")}<h1 class="latin">Continue</h1><div class="ar">${esc(f?.name)}</div><p>الخطوة ${s.done + 1} من 5: ${STEPS5[s.done] || ""}. دوس عشان تكمّل.</p>`;
    }
    const t = T[key];
    return `${big(t.icon)}<h1 class="latin">${t.en}</h1><div class="ar">${esc(t.ar)}</div><p>${esc(t.desc)}</p>`;
  }
  const GLKEY = { create: "create", brand: "brand", assets: "assets", settings: "settings", progress: "progress", publish: "publish", reel: "reel", raw: "film",
    series: "series", carousel: "carousel", ad: "publish", typo: "create", dub: "voices", edit: "film", coaches: "characters", voice: "voices", music: "music" };
  function setStage(key) {
    key = key || "";
    if (key === shown) return;
    shown = key;
    GL?.show(!key ? "app" : key.startsWith("f:") ? "progress" : GLKEY[key] || "app");
    const next = slots[1 - live];
    next.innerHTML = stageHTML(key);
    next.classList.remove("out");
    slots[live].classList.add("out");
    live = 1 - live;
  }
  slots[0].innerHTML = stageHTML("");
  GL?.show("app");
  let leaveT;
  bento.addEventListener("pointerover", (e) => {
    const line = e.target.closest(".nh-line"), tile = e.target.closest(".nh-tile");
    if (!tile && !line) return;
    clearTimeout(leaveT);
    setStage(line ? "f:" + line.dataset.folder : tile.dataset.id);
  });
  bento.addEventListener("pointerout", (e) => { if (!e.relatedTarget?.closest?.(".nh-tile, .nh-line")) leaveT = setTimeout(() => setStage(""), 260); });
  bento.addEventListener("focusin", (e) => { const l = e.target.closest(".nh-line"), t = e.target.closest(".nh-tile"); if (l || t) setStage(l ? "f:" + l.dataset.folder : t.dataset.id); });

  // ---------- اللايت والدارك ----------
  const THEME_KEY = "studiomania.theme";
  const sysDark = matchMedia("(prefers-color-scheme: dark)");
  const mode = () => storageGet(THEME_KEY) || (sysDark.matches ? "dark" : "light");
  const sync = () => {
    root.dataset.nhTheme = mode();
    document.getElementById("nhMode").textContent = mode() === "dark" ? "Dark Mode" : "Light Mode";
    GL?.theme(mode() === "dark");
  };
  sync();
  sysDark.addEventListener("change", sync);
  document.getElementById("nhTheme").addEventListener("click", () => {
    const flip = () => { storageSet(THEME_KEY, mode() === "dark" ? "light" : "dark"); sync(); };
    if (!document.startViewTransition || reduce.matches) return flip();
    root.classList.add("nh-wipe");
    document.startViewTransition(flip).finished.finally(() => root.classList.remove("nh-wipe"));
  });
  document.getElementById("nhClient").onclick = () => document.getElementById("clientBtn").click();
  document.getElementById("nhLang").textContent = I18N.lang === "en" ? "ع" : "EN";
  document.getElementById("nhLang").onclick = () => document.getElementById("langToggle").click();

  // ---------- الزوم: الكاميرا بتقرّب على المربع لحد ما يبقى الشاشة ----------
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  let zoom = null, busy = false;
  function zoomIn(tile, after) {   // الرئيسية بتتكبر وتختفي، وحد المربع بيكبر لحد حدود الشاشة
    const D_ = reduce.matches ? 1 : 1000;
    const r = tile.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    const radius = parseFloat(getComputedStyle(tile).borderTopLeftRadius) || 24;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const s = Math.min(2, Math.max(vw / r.width, vh / r.height));   // أكتر من ٢× بيبقى أكبر من اللي كارت الشاشة بيرسمه
    home.style.transformOrigin = `${cx}px ${cy}px`;
    const frame = document.createElement("div");
    frame.className = "nh-frame";
    document.body.appendChild(frame);
    const o = { duration: D_, easing: EASE, fill: "both" };
    const anims = [
      home.animate([{ transform: "none", opacity: 1 }, { opacity: .45, offset: .55 }, { transform: `translate(${vw / 2 - cx}px,${vh / 2 - cy}px) scale(${s})`, opacity: 0 }], o),
      frame.animate([{ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", borderRadius: radius + "px", opacity: 1 },
        { opacity: 1, offset: .75 }, { left: "0px", top: "0px", width: vw + "px", height: vh + "px", borderRadius: "0px", opacity: 0 }], o),
    ];
    zoom = { tile, anims, frame, r, radius, extra: [] };
    return { o, r, vw, vh, radius, done: anims[0].finished.then(() => { home.style.visibility = "hidden"; after?.(); }) };
  }
  function zoomOut() {
    if (!zoom) return Promise.resolve();
    const z = zoom;
    zoom = null;
    home.style.visibility = "";
    z.anims.concat(z.extra).forEach((a) => a.reverse());
    return z.anims[0].finished.then(() => {
      z.anims.concat(z.extra).forEach((a) => a.cancel());
      z.frame.remove();
      (z.cleanup || []).forEach((f) => f());
    });
  }

  // صفحة جوه الرئيسية (اعمل جديد / الأصول / شغّال عليه): الأيقونة والاسم بيطيروا لحد ما يبقوا عنوان الصفحة
  const panel = (c, r, inner, attrs = "") => `<div class="nh-tile nh-panel" ${attrs} style="grid-column:span ${c};grid-row:span ${r}">${inner}</div>`;
  const PAGES = {
    create: () => CREATE_ALL.map((k) => panel(3, 3, `${head(k)}<div class="nh-body">${esc(T[k].desc)}</div>`, `data-id="${k}" tabindex="0" role="button"`)).join(""),
    assets: () => panel(4, 6, `${head("coaches")}<div class="nh-body">${D.coaches.length} مدرب</div><div class="nh-avs">${D.coaches.slice(0, 12).map((c) => `<img src="${esc(c.image_url)}" alt="">`).join("")}</div>`, `data-id="coaches" tabindex="0" role="button"`)
      + panel(4, 6, `${head("voice")}<div class="nh-body">${D.voices} تسجيل</div>`, `data-id="voice" tabindex="0" role="button"`)
      + panel(4, 6, `${head("music")}<div class="nh-body">${D.music} تراك</div>`, `data-id="music" tabindex="0" role="button"`),
    progress: () => panel(8, 6, `${head("progress")}<div class="nh-lines" style="align-content:start">${D.folders.map(lineHTML).join("") || `<div class="nh-empty">مفيش مشاريع لسه.</div>`}</div>`)
      + panel(4, 3, `${head("create")}<div class="nh-body">ابدأ شغل جديد من أي نوع.</div>`, `data-id="create" tabindex="0" role="button"`)
      + panel(4, 3, `${head("publish")}<div class="nh-body">${D.posts.filter((p) => p.status === "scheduled").length} بوست متجدول</div>`, `data-id="publish" tabindex="0" role="button"`),
  };
  function openPage(tile, key) {
    if (busy || zoom) return;
    busy = true;
    const t = T[key];
    pTitle.innerHTML = `<div class="nh-name"><span class="latin">${t.en}</span><b>${esc(t.ar)}</b></div>${iconOf(t.icon)}`;
    pGrid.innerHTML = PAGES[key]();
    page.hidden = false;
    pGrid.querySelectorAll(".nh-tile").forEach(addSnake);
    const z = zoomIn(tile);
    const sIcon = tile.querySelector(":scope > .nh-head > .gi, :scope > .nh-head > .nh-plate"), sName = tile.querySelector(":scope > .nh-head > .nh-name");
    const tIcon = pTitle.querySelector(".gi, .nh-plate"), tName = pTitle.querySelector(".nh-name");
    const fi = rectOf(sIcon), ti = rectOf(tIcon), fn = rectOf(sName), tn = rectOf(tName);
    const fly = (el, from) => {
      const f = document.createElement("div");
      f.className = "nh-fly";
      f.innerHTML = el.outerHTML;
      Object.assign(f.style, { left: from.x + "px", top: from.y + "px", width: from.w + "px", height: from.h + "px" });
      document.body.appendChild(f);
      return f;
    };
    const fIcon = fly(sIcon, fi), fName = fly(sName, fn);
    fIcon.firstElementChild.style.cssText = "width:100%;height:100%";
    [sIcon, sName, tIcon, tName].forEach((e) => (e.style.opacity = 0));
    zoom.extra.push(
      page.animate([{ clipPath: `inset(${z.r.top}px ${z.vw - z.r.right}px ${z.vh - z.r.bottom}px ${z.r.left}px round ${z.radius}px)` }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], z.o),
      pGrid.animate([{ opacity: 0, transform: "scale(.86)" }, { opacity: 0, offset: .3 }, { opacity: 1, transform: "scale(1)" }], z.o),
      fIcon.animate([{ transform: "none" }, { transform: `translate(${ti.x - fi.x}px,${ti.y - fi.y}px) scale(${ti.w / fi.w},${ti.h / fi.h})` }], z.o),
      fName.animate([{ transform: "none" }, { transform: `translate(${tn.x - fn.x}px,${tn.y - fn.y}px) scale(${tn.h / fn.h})` }], z.o));
    zoom.page = { fIcon, fName, parts: [sIcon, sName, tIcon, tName] };
    zoom.cleanup = [() => { fIcon.remove(); fName.remove(); [sIcon, sName, tIcon, tName].forEach((e) => (e.style.opacity = "")); page.hidden = true; pGrid.innerHTML = ""; }];
    z.done.then(() => {
      fIcon.style.opacity = fName.style.opacity = 0;
      tIcon.style.opacity = tName.style.opacity = 1;
      busy = false;
      document.getElementById("nhBack").focus({ preventScroll: true });
      pGrid.querySelectorAll(":scope > .nh-tile").forEach((p, i) => setTimeout(() => { p.classList.add("nh-sweep"); setTimeout(() => p.classList.add("done"), 1100); }, i * 70));
    });
  }
  function closePage() {
    if (busy || !zoom?.page) return;
    busy = true;
    const p = zoom.page;
    p.fIcon.style.opacity = p.fName.style.opacity = 1;
    p.parts[2].style.opacity = p.parts[3].style.opacity = 0;
    zoomOut().then(() => { busy = false; });
  }
  document.getElementById("nhBack").onclick = closePage;

  // قسم من البرنامج: الكاميرا بتقرّب على المربع، وبعدين القسم بيفتح مكانه
  let sectionZoom = false;
  function openSection(tile, act) {
    if (busy) return;
    const fromPage = !!zoom?.page;   // من جوه صفحة: القسم بيفتح فوقها على طول
    if (fromPage || !tile.closest("#nhBento")) return act();
    busy = true;
    sectionZoom = true;
    zoomIn(tile, () => { busy = false; act(); });
  }
  function act(id) {
    const t = T[id];
    if (t.fn) return t.fn;
    if (t.go) return () => showStep(t.go);
    return null;
  }
  function onActivate(e) {
    const line = e.target.closest(".nh-line");
    if (line) {
      const f = D.folders.find((x) => x.id === line.dataset.folder);
      if (!f) return;
      return openSection(line, () => { setFlowFolder(f.id); fol.current = f; showStep(folderStage(f).next); });
    }
    const tile = e.target.closest(".nh-tile[data-id]");
    if (!tile) return;
    const id = tile.dataset.id, t = T[id];
    if (t.page) return zoom?.page ? null : openPage(tile, t.page);
    const a = act(id);
    if (a) openSection(tile, a);
  }
  host.addEventListener("click", onActivate);
  host.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".nh-tile[data-id], .nh-line")) { e.preventDefault(); onActivate(e); }
    if (e.key === "Escape" && zoom?.page && $("stage").hidden) closePage();
  });

  // ---------- الداتا الحقيقية ----------
  async function refresh() {
    const [folders, publisher, posts, coaches, voices, music, brains] = await Promise.all([
      shellFolders(true), api("/api/publisher").catch(() => null), api("/api/posts").catch(() => []), api("/api/coaches").catch(() => []),
      api("/api/audio?kind=voice").catch(() => []), api("/api/audio?kind=music").catch(() => []), api("/api/ad-brains").catch(() => []),
    ]);
    Object.assign(D, { folders, publisher, posts, coaches, voices: voices.length, music: music.length, money: window.money?.last || D.money,
      brand: brains.find((b) => b.id === clientx?.active) || brains[0] || null });
    renderTiles();
    GL?.brand?.();
  }
  refresh();
  setInterval(() => { if (!document.hidden && window.money?.last) { D.money = money.last; if (!zoom) renderTiles(); } }, 60000);

  // لما القسم يتقفل: الكاميرا بترجع لورا للرئيسية
  return {
    refresh,
    sectionClosed() {
      if (sectionZoom) { sectionZoom = false; zoomOut(); }
      refresh();
    },
  };
})();

if (NH) {
  // الأقسام بتفتح من غير أنيميشن التكبير القديم (الزوم بقى من الرئيسية الجديدة)
  tileFor = () => null;
  const _closeStage = closeStage;
  closeStage = function () { _closeStage(); NH.sectionClosed(); };
  const _loadClients = loadClients;
  loadClients = async function () { await _loadClients(); NH.refresh(); };
}
