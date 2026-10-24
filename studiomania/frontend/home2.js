// StudioMania — الرئيسية الجديدة (#nh): مربعات من غير حدود على شاشة سادة، سنيك حوالين المربع وقت الهوفر،
// مسرح في النص فيه مجسّم زجاج 3D لكل مربع، وكاميرا بتقرّب على المربع لحد ما يبقى الشاشة لما تدوس عليه.
// الأقسام نفسها لسه بشكلها القديم: المربع بيفتحها بنفس showStep اللي في shell.js.

const NH = (() => {
  const root = document.documentElement;
  const host = document.getElementById("nh");
  // كوتشي بيفضل بالرئيسية والتصميم القديم (عشان البرنامجين ميتلخبطوش في بعض)
  if (typeof APP !== "undefined" && APP === "kochi") { host?.remove(); return null; }
  if (!host) return null;
  document.body.classList.add("nh");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const EASE = "cubic-bezier(.65,0,.35,1)";
  const esc = (s) => escapeHtml(String(s ?? ""));
  const KOCHI = typeof APP !== "undefined" && APP === "kochi";

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
    create: KOCHI ? { en: "New Project", ar: "مشروع جديد", icon: "create", go: "0", desc: "الفيديو الخام ← التقطيع ← التوليد ← المونتاج ← النشر، خطوة خطوة." }
      : { en: "Create", ar: "ابدأ مشروعًا جديدًا", icon: "create", page: "create", desc: "كل أنواع العمل من هنا: اختر النوع، والخطوات تسير معك حتى التصدير." },
    brand: { en: "Your Brand", ar: "عقل العلامة", icon: "brand", page: "brand", desc: "كل تفاصيل العلامة وتفضيلاته وستايله. أي عمل يُنشأ يبني عليه." },
    assets: { en: "Assets", ar: "الأصول", icon: "box", page: "assets", desc: "الشخصيات والأصوات والموسيقى الذي تستخدمها في أي عمل." },
    // مكان «الأصول» في الرئيسية (الأصول بقت فرع من عقل العلامة)
    dubhub: { en: "Translate & Dub", ar: "الترجمة والدبلجة", icon: "globe", go: "13", desc: "أي فيديو بلغة أو لهجة أخرى: ترجمة النص، صوت جديد، وتظبيط البُق." },
    settings: { en: "Settings", ar: "الإعدادات", icon: "gear", go: "settings", desc: "المفاتيح والرصيد والعملاء." },
    progress: { en: "In Progress", ar: "قيد العمل", icon: "pulse", page: "progress", desc: "كل خط مشروع، وكل نقطة خطوة. اضغط على أي خط يُكمل من مكان ما وقفت." },
    publish: KOCHI ? { en: "Publish", ar: "النشر", icon: "send", go: "7", desc: "الحسابات المربوطة والجدولة واللي نُشر." }
      : { en: "Publish", ar: "النشر", icon: "send", page: "publish", desc: "انشر وجدول، والتعليقات والرسائل، وإعلاناتك ووصفة الاستهداف، وحملات واتساب." },
    // 📤 جوه «النشر»: كل اللي بيوصّل المحتوى للناس (الإعلانات والاستهداف والواتساب اتنقلوا هنا من العقل)
    pubpost: { en: "Post & Schedule", ar: "انشر وجدول", icon: "send", go: "7", desc: "الحسابات المربوطة، والفيديوهات الجاهزة، والجدولة واللي نُشر." },
    inbox: { en: "Comments & DMs", ar: "التعليقات والرسائل", icon: "mic", go: "15", desc: "رد على التعليقات والرسائل من مكان واحد، وبوتات بترد لوحدها." },
    audience: { en: "Targeting Recipe", ar: "وصفة الاستهداف", icon: "users", page: "audience", desc: "من الجمهور الذي سيشتري، والاستهداف الجاهز لميتا وجوجل وتيك توك." },
    // جوه «اعمل جديد»: كل نوع بيفتح القسم اللي بيعمله النهارده
    reel: { en: "Reel", ar: "شورت / ريل من قالب", icon: "phone", go: "14", desc: "اختر أسلوب، اكتب فكرتك، والقالب يُكمل: نص ← صوت ← مشاهد." },
    raw: { en: "From Footage", ar: "فيديو من تصويرك", icon: "cut", go: "0", desc: "المشروع ← التقطيع ← التوليد ← المونتاج ← النشر." },
    series: { en: "Series", ar: "مسلسل من حلقات", icon: "clapper", go: "9", desc: "حلقات خلف بعض بنفس الشخصيات والعالم." },
    carousel: { en: "Carousel", ar: "كاروسيل", icon: "slides", go: "8", desc: "فكرة ← نص ← تصميم ← سلايدات." },
    ad: { en: "Ad", ar: "إعلان", icon: "megaphone", go: "10", desc: "إعلان من مرجع أو من الصفر على علامة العميل." },
    typo: { en: "Typography", ar: "تايبوجرافي", icon: "type", go: "12", desc: "نص متحرك من صوت أو نص." },
    dub: { en: "Dubbing", ar: "دبلجة فيديو", icon: "globe", go: "13", desc: "نفس الفيديو بلهجة أخرى." },
    edit: { en: "Edit", ar: "مونتاج حر", icon: "film", go: KOCHI ? "6" : "6f", desc: "المحرر الكامل: تراكات ونص وطبقات وصوت." },
    coaches: { en: "Characters", ar: "الشخصيات", icon: "users", page: "coaches", desc: "كل شخصية بصورتها والكاركتر ورقة وصوتها والإنترو والأوترو." },
    voice: { en: "Voices", ar: "التعليق الصوتي", icon: "mic", page: "voice", desc: "مكتبة التعليق." },
    music: { en: "Music", ar: "الموسيقى", icon: "music", page: "music", desc: "مكتبة الموسيقى." },
    viral: { en: "Trends", ar: "ما حسنًا في مجالك", icon: "megaphone", page: "viral", desc: "منشورات المجال مرتّبة بقد ماذا عدّت العادي، وأفكار بنفس الهيكل." },
    plan: { en: "Content Plan", ar: "خطة المحتوى", icon: "megaphone", page: "plan", desc: "استراتيجية حسابك، تُبنى تلقائيًا من كل ما العقل عرفه عنك." },
    rivals: { en: "Your Competitors", ar: "منافسوك", icon: "megaphone", page: "rivals", desc: "البرنامج يقترح منافسين وأنت توافق، ومنهم الذي ينجح لديهم ووصفة الاستهداف." },
    bots: { en: "Message Bots", ar: "بوتات الرسايل", icon: "megaphone", page: "bots", desc: "بوت يرد على التعليقات والرسايل والستوري لوحده، يسأل ويفرز، ويحوّل للفريق لما يلزم." },
    wacamp: { en: "WhatsApp Campaigns", ar: "حملات واتساب", icon: "megaphone", page: "wacamp", desc: "اجمع موافقات الأشخاص، وأنشئ رسائل متوافق عليها، وأرسل حملات وسلاسل متابعة للمشتركين فقط." },
    plans: { en: "My Plan & Credits", ar: "باقتي ونقاطي", icon: "settings", page: "plans", desc: "باقتك ونقاطك، والترقية، والنقاط الزيادة." },
    adsmgr: { en: "Your Ads", ar: "إعلاناتك", icon: "megaphone", page: "adsmgr", desc: "روّج منشور أو أنشئ إعلان جديد بالاستهداف من الوصفة، وتابع أرقامه، وأنشئ جماهير." },
    pilot: { en: "Autopilot", ar: "الأوتوبايلوت", icon: "pulse", page: "pilot", desc: "كم منشور في اليوم، في أحسن أوقات، من القوالب الذي تختارها. يعمل تلقائيًا أو ينتظر موافقتك." },
    auto: { en: "Custom Template", ar: "القالب المخصص", icon: "film", page: "auto", desc: "خطوات ترتّبها بنفسك (اسحب، ضع، قطّع، صدّر) من مكتبة العقل، وكل تشغيل فيديو جديد." },
    brainlib: { en: "Content Library", ar: "مكتبة المحتويات", icon: "film", page: "brainlib", desc: "الخلفيات والأماكن، والتعليقات الصوتية، والموسيقى، والكوميكس، ومجلداتك. كل ملف يمكنك تشير إليه في القالب المخصص." },
    comics: { en: "Comics", ar: "مكتبة الكوميكس", icon: "megaphone", page: "comics", desc: "كوميكس حقيقية بسياق كل واحد، لكي توضع في مكانها الصحيح." },
    ref2p: { en: "Reference → Prompt", ar: "من مرجع لبرومبت", icon: "clapper", page: "ref2p", desc: "فيديو مرجعي ← وصف جاهز بـ 14 جزء ← توليد." },
    motion: { en: "Motion", ar: "مكتبة الموشن", icon: "clapper", page: "motion", desc: "أنيميشنات مكتوبة بالكود، كل واحدة تُضاف للأصول بضغطة." },
  };
  // «فيديو من تصويرك» (المشاريع) بقى برنامج كوتشي لوحده على /kochi، فمش في ستوديومانيا
  const CREATE_ALL = ["reel", "series", "carousel", "ad", "typo", "dub", "edit"];
  const SEC = { series: ["مسلسل", "6s"], ads: ["إعلان", "6a"], free: ["مونتاج حر", "6f"] };
  const STEPS5 = ["المشروع", "التقطيع", "التوليد", "المونتاج", "النشر"];
  const D = { work: [], cats: [], brand: null, folders: [], money: null, publisher: null, posts: [], coaches: [], voices: 0, music: 0 };

  const brandMark = () => {
    const c = clientx?.cur;
    return c?.logo ? `<img src="${esc(c.logo)}" alt="">` : esc((c?.name || "B").trim().slice(0, 1).toUpperCase());
  };
  const GLKEY = { create: "app", brand: "brand", assets: "assets", dubhub: "voices", settings: "settings", progress: "progress", publish: "publish", reel: "reel", raw: "film",
    series: "series", carousel: "carousel", ad: "publish", typo: "create", dub: "voices", edit: "film", coaches: "characters", voice: "voices", music: "music", pilot: "autopilot", pubpost: "publish",
    inbox: "inbox", adsmgr: "adsmgr", audience: "audience", wacamp: "wacamp", bots: "inbox" };
  const iconOf = (k) => (k === "brand" ? `<div class="nh-plate">${brandMark()}</div>` : gi(k));
  const head = (id) => `<div class="nh-head"><div class="nh-name"><span class="latin en-k">${T[id].en}</span><b>${T[id].ar}</b></div>${GLKEY[id] ? `<span class="gi nh-glt">${glImg(GLKEY[id])}</span>` : iconOf(T[id].icon)}</div>`;
  const dots = (n, at) => `<div class="nh-dots">${Array.from({ length: n }, (_, i) => `<i class="${i < at ? "done" : i === at ? "now" : ""}"></i>`).join("")}</div>`;
  function brainPct(b) {
    if (!b) return 0;
    const keys = ["about", "audience", "rules", "palette", "typography", "market", "language", "cta"];
    const have = keys.filter((k) => String(b[k] || "").trim()).length + ((b.logos || []).length ? 1 : 0);
    return Math.round((have / (keys.length + 1)) * 100);
  }
  function lineHTML(f) {
    if (f.section) {   // ستوديومانيا: مشروع مونتاج (مسلسل / إعلان / مونتاج حر)
      return `<div class="nh-line" data-proj="${esc(f.id)}" tabindex="0" role="button"><b>${esc(f.name)}</b><span class="nh-sec">${esc(SEC[f.section]?.[0] || "")}</span><span class="step">${f.render_status === "done" ? "صُدّر" : "مونتاج"}</span></div>`;
    }
    const s = folderStage(f);
    return `<div class="nh-line" data-folder="${esc(f.id)}" tabindex="0" role="button"><b>${esc(f.name)}</b>${dots(5, s.done)}<span class="step">${STEPS5[s.done] || ""}</span></div>`;
  }

  // ---------- الرئيسية (نسخة أ): المجسّم في النص، والأقسام مكتوبة على الجنبين، و«ابدأ مشروع جديد» تحت المجسّم ----------
  // RTL: أول عمود على اليمين · النشر تحت على اليمين، والأوتوبايلوت فوق على الشمال (نفس الأماكن بالعربي والإنجليزي)
  const SIDE_R = KOCHI ? ["brand", "assets"] : ["brand", "publish"], SIDE_L = KOCHI ? ["progress", "publish", "settings"] : ["pilot", "settings"];
  const META = {
    // نفس رقم «العقل فاهمك قد إيه» اللي في العقل (مش رقم تاني)
    brand: () => { const pct = D.brand?.knowledge?.score ?? brainPct(D.brand); return `<span class="nh-mbar"><i style="width:${pct}%"></i></span><span>العقل فاهمك <span class="num">${pct}%</span></span>`; },
    assets: () => `<span>${D.coaches.length} شخصية · ${D.voices} تعليق · ${D.music} موسيقى</span>`,
    dubhub: () => `<span>نفس الفيديو بلغة أو لهجة أخرى</span>`,
    pilot: () => `<span>${D.pilot?.settings?.on ? `يعمل · ${D.pilot.settings.times.length} منشور في اليوم${D.pilot.waiting ? ` · <em>${D.pilot.waiting} ينتظرون منك</em>` : ""}` : "مغلق"}</span>`,
    progress: () => {
      const n = D.work.length, r = D.work.filter((p) => p.render_status === "rendering").length;
      return `<span>${n ? `${n} مشروع${r ? ` · ${r} قيد التصدير الآن` : ""}` : "لا توجد مشاريع بعد"}</span>`;
    },
    publish: () => {
      const up = D.posts.filter((p) => p.status === "scheduled").length, bad = D.posts.filter((p) => p.status === "failed").length;
      return `<span>${up ? `${up} منشور متجدول` : "لا يوجد منشورات متجدولة"}${bad ? ` · <em>${bad} فشل</em>` : ""}</span>`;
    },
    settings: () => `<span>${window.ME && window.ME.role !== "admin" ? `نقاطك · <span class="num">${window.ME.credits.total.toLocaleString("en-US")}</span> نقطة`
      : D.money ? `رصيد Atlas · <span class="num">$${D.money.balance.toFixed(2)}</span>` : "المفاتيح والرصيد والعملاء"}</span>`,
  };
  // الرئيسية بسيطة: كل قسم أيقونة واسمه بس، والشرح والحالة بيظهروا في فقاعة لما تقف بالماوس عليه
  const tipOf = (id, extra = "") => `<span class="nh-tip" role="tooltip"><b>${esc(T[id].ar)}</b><span>${esc(T[id].desc)}</span>${extra ? `<span class="nh-tip-m">${extra}</span>` : ""}</span>`;
  const sideIc = (id) => (GLKEY[id] ? `<span class="nh-glt">${glImg(GLKEY[id])}</span>` : iconOf(T[id].icon));
  const side = (id) => `<div class="nh-tile nh-side" data-id="${id}" tabindex="0" role="button" aria-label="${esc(T[id].ar)}">
      <span class="nh-sic">${sideIc(id)}</span><b class="nh-sname">${esc(T[id].ar)}</b>${tipOf(id, META[id]())}</div>`;
  const cta = () => `<div class="nh-tile nh-cta nh-gen" data-id="create" tabindex="0" role="button" aria-label="ابدأ مشروعًا جديدًا">
      <div class="nh-head"><div class="nh-name"><span class="latin en-k">Create</span><b>ابدأ مشروعًا جديدًا</b></div>${gi("create")}</div>${tipOf("create")}</div>`;
  // «كمّل من مكان ما وقفت» (بقى مكان «شغّال عليه»): الزرار كله بيفتح كل المشاريع، والتشغيل اللي جنبه بيكمّل آخر مشروع على طول
  function contHTML() {
    // آخر حاجة اتلمست: مشروع مونتاج، أو قالب/تايبوجرافي/دبلجة لسه ما خلصوش
    const p = [...D.work, ...(D.drafts || [])].sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))[0];
    if (!p && KOCHI) return "";
    const where = !p ? "" : p.kind ? `${p.sec} · ${p.step}` : p.section ? (p.render_status === "done" ? "صُدّر" : "المونتاج") : STEPS5[folderStage(p).done] || "";
    const attr = !p ? "" : p.kind ? `data-draft="${p.kind}:${esc(p.id)}"` : p.section ? `data-proj="${esc(p.id)}"` : `data-folder="${esc(p.id)}"`;
    const n = D.work.length + (D.drafts || []).length, r = D.work.filter((x) => x.render_status === "rendering").length;
    const count = n ? `${n} مشروع${r ? ` · ${r} يُصدّر` : ""}` : "";
    // «شغّال عليه»: أيقونة واسم، وآخر مشروع وعدد المشاريع في الفقاعة. زرار التشغيل الصغير بيكمّل آخر مشروع على طول
    return `<div class="nh-tile nh-cont nh-cont-ic" data-id="progress" tabindex="0" role="button" aria-label="قيد العمل">
        <span class="nh-sic"><span class="nh-glt">${glImg("progress")}</span></span><b class="nh-sname">قيد العمل</b>
        ${p ? `<span class="nh-cplay" data-cont ${attr} role="button" tabindex="0" aria-label="أكمل آخر مشروع"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg></span>` : ""}
        ${tipOf("progress", p ? `${count ? `${count} · ` : ""}آخر مشروع: ${esc(p.name)} · ${esc(where)}${p ? " · ▶ يكمّله مباشرة" : ""}` : "لا توجد مشاريع بعد")}</div>`;
  }

  // ---------- الهيكل ----------
  host.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <linearGradient id="nhGBody" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--nh-g1)"/><stop offset=".55" style="stop-color:var(--nh-g2)"/><stop offset="1" style="stop-color:var(--nh-g1)"/></linearGradient>
      <filter id="nhGBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1"/></filter></defs></svg>
    <div class="nh-home" id="nhHome">
      <div class="nh-top-ph" aria-hidden="true"></div>
      <main class="nh-bento" id="nhBento"></main>
    </div>
    <section class="nh-page" id="nhPage" hidden role="dialog" aria-modal="true">
      <header class="nh-ptop">
        <div class="nh-prow"><span class="nh-plogo" aria-hidden="true"><img class="nh-lm lm-l" src="/logo-mark-light.png" alt=""><img class="nh-lm lm-d" src="/logo-mark-dark.png" alt="">SIMSIMKIT</span><button class="nh-chip nh-pclient" id="nhPClient" title="العميل الذي قيد العمل"></button></div>
        <div class="nh-phead"><button class="nh-back" id="nhBack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span id="nhBackT">الرئيسية</span></button><div class="nh-ptitle" id="nhPTitle"></div></div>
        <nav class="nh-ptabs" id="nhPTabs" aria-label="الأصول"></nav>
      </header>
      <div class="nh-pgrid" id="nhPGrid"></div>
    </section>`;

  // الشريط اللي فوق: نفس شريط الرئيسية بيفضل ثابت فوق كل الصفحات، وفيه «رجوع» والتسلسل (انت فين)
  const bar = document.createElement("header");
  bar.id = "nhBar";
  bar.className = "nh-top nh-bar";
  bar.innerHTML = `<div class="nh-bar-r">
      <div class="nh-logo" aria-label="SimsimKit"><img class="nh-lm lm-l" src="/logo-mark-light.png" alt=""><img class="nh-lm lm-d" src="/logo-mark-dark.png" alt="">SIMSIMKIT</div>
      <button class="nh-goback" id="nhGoBack" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span>رجوع</span></button>
      <nav class="nh-crumbs" id="nhCrumbs" aria-label="موقعك" hidden></nav>
    </div>
    <div class="nh-tools" id="nhTools">
      <button class="nh-chip nh-bell" id="nhBell" title="الإشعارات" aria-label="الإشعارات"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg><b class="bell-n" hidden></b></button>
      <button class="nh-chip latin nh-langb" id="nhLang">EN</button>
      <button class="nh-chip" id="nhClient" title="العميل الذي قيد العمل"><i id="nhClientAv"></i><span id="nhClientName" data-no-i18n></span></button>
      <button class="nh-chip nh-acct" id="nhAcct" title="حسابك" aria-label="حسابك"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg></button>
      <button class="nh-switch" id="nhTheme" aria-label="Switch theme"><span class="track"><span class="knob"></span></span><span id="nhMode">غامق</span></button>
    </div>`;
  document.body.appendChild(bar);
  // الرصيد والردود والمواعيد (كانوا في راس الصفحات) بقوا في الشريط، وبيبانوا بره الرئيسية بس
  ["stageMoney", "stagePlans", "stageInbox", "stageCal"].forEach((id) => { const el = document.getElementById(id); if (el) { el.classList.add("nh-xtra"); document.getElementById("nhTools").prepend(el); } });
  // عنوان الصفحة المفتوحة: في نفس الركن اللي المربع كان فيه في الرئيسية (الإعدادات تحت شمال ← عنوانها تحت شمال)
  const corner = document.createElement("div");
  corner.id = "nhCorner";
  corner.className = "nh-corner";
  corner.hidden = true;
  corner.innerHTML = `<span class="nh-c-ic"></span><div class="nh-c-name"><span class="latin en-k"></span><b></b><span class="nh-c-ask"></span></div>`;
  document.body.appendChild(corner);
  const cIc = corner.querySelector(".nh-c-ic"), cLatin = corner.querySelector(".latin"), cName = corner.querySelector("b"), cAsk = corner.querySelector(".nh-c-ask");
  let cornerPage = "tr", cornerStage = "tr";
  // الركن من مكان المربع على الشاشة؛ اللي في النص (ابدأ مشروع جديد / كمّل) بيروح فوق يمين
  // عنوان القسم دايمًا فوق تحت الشريط مباشرة، في نفس المكان لكل الأقسام
  function cornerOf() { return "tr"; }
  function updateCorner(mode) {
    if (mode === undefined) mode = stageOpen() ? "stage" : zoom?.page ? "page" : null;
    if (mode === "stage" && $("stage").classList.contains("mt-mode")) mode = null;
    corner.hidden = !mode;
    document.body.classList.toggle("nh-cb", !!mode && (mode === "stage" ? cornerStage : cornerPage)[0] === "b");
    document.body.classList.toggle("nh-cl", !!mode && (mode === "stage" ? cornerStage : cornerPage)[1] === "l");
    if (!mode) return;
    corner.dataset.corner = mode === "stage" ? cornerStage : cornerPage;
    if (mode === "stage") {
      cLatin.textContent = $("stageNum").textContent;
      cName.textContent = $("stageTitle").textContent;
      cIc.innerHTML = $("stageIc").hidden ? "" : $("stageIc").innerHTML;
    } else {
      cLatin.textContent = pTitle.querySelector(".nh-name .latin")?.textContent || "";
      cName.textContent = pTitle.querySelector(".nh-name b")?.textContent || "";
      cIc.innerHTML = pTitle.querySelector(".nh-glt")?.innerHTML || "";
    }
    // 💬 «اشرح لي «الصفحة»» تحت اسمها، بيفتح المساعد ويسأل على طول
    const pk = mode === "page" ? pTitle.dataset.key : "";
    cAsk.innerHTML = pk && pk !== "create" && typeof Help !== "undefined" ? Help.askBtn(pk, cName.textContent) : "";
    cIc.hidden = !cIc.innerHTML;
  }
  const cornerDest = () => ({ latin: cLatin, name: cName, icon: cIc.hidden ? null : cIc });
  const bento = document.getElementById("nhBento"), home = document.getElementById("nhHome");
  const page = document.getElementById("nhPage"), pGrid = document.getElementById("nhPGrid"), pTitle = document.getElementById("nhPTitle");

  // الأقسام بتتبني مرة واحدة، وبعد كده بيتغيّر اللي اتغيّر بس (الأرقام في الفقاعات): مفيش حاجة بتختفي وترجع
  function renderTiles() {
    if (!document.getElementById("nhStage")) {
      bento.innerHTML = `<nav class="nh-col nh-col-r nh-gen" aria-label="الأقسام"></nav><nav class="nh-col nh-col-l nh-gen" aria-label="الأقسام"></nav>`
        + `<div class="nh-cta-wrap nh-gen"></div><div class="nh-cont-wrap nh-gen"></div>`
        + `<section class="nh-stage" id="nhStage" aria-live="polite"><div class="nh-stage-ph" aria-hidden="true"></div><div class="slot" id="nhSlotA"></div><div class="slot out" id="nhSlotB"></div></section>`;
    }
    setHTML(bento.querySelector(".nh-col-r"), SIDE_R.map(side).join(""));
    setHTML(bento.querySelector(".nh-col-l"), SIDE_L.map(side).join(""));
    setHTML(bento.querySelector(".nh-cta-wrap"), cta());
    setHTML(bento.querySelector(".nh-cont-wrap"), contHTML());
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
    svg.setAttribute("data-keep", "");   // التحديث لا يزيلون
    svg.innerHTML = ["s3", "s2", "s1"].map((c) => `<rect class="${c}" pathLength="1000"/>`).join("");
    el.prepend(svg);
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight, r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.querySelectorAll("rect").forEach((x) => { x.setAttribute("x", .8); x.setAttribute("y", .8); x.setAttribute("width", Math.max(0, w - 1.6)); x.setAttribute("height", Math.max(0, h - 1.6)); x.setAttribute("rx", Math.max(0, Math.min(r, h / 2, w / 2) - .8)); x.setAttribute("ry", Math.max(0, Math.min(r, h / 2, w / 2) - .8)); });
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
    if (!key && KOCHI) return `${big("app")}<h1 class="latin">Kochi Studio</h1><div class="ar">فيديوهات مدربين كوتشي</div><p>ابدأ من «مشروع جديد»، أو أكمل مشروع من «قيد العمل».</p>`;
    if (!key) return window.I18N?.lang !== "en" ? homeTitle(big("app")) : `${big("app")}<h1 class="latin">SimsimKit</h1><div class="ar">استوديو المحتوى والفيديو</div>`;
    if (key.startsWith("f:")) {
      const f = D.folders.find((x) => x.id === key.slice(2)), s = folderStage(f);
      return window.I18N?.lang !== "en" ? homeTitle(big("pulse")) : `${big("pulse")}<h1 class="latin">Continue</h1><div class="ar">${esc(f?.name)}</div>`;
    }
    const t = T[key];
    if (window.I18N?.lang !== "en") return homeTitle(big(t.icon));
    return `${big(t.icon)}<h1 class="latin">${t.en}</h1><div class="ar">${esc(t.ar)}</div>`;   // الاسم فقط، والشرح في فقاعة القسم
  }
  // 🏠 عنوان الرئيسية ثابت (مش بيتغير مع القسم اللي الماوس عليه): «ابدأ من هنا» لحد ما العقل يفهمك ٣٠٪، وبعدها اسم العلامة
  function homeTitle(icon) {
    const b = D.brand, pct = b?.knowledge?.score ?? brainPct(b), name = String(b?.name || "").trim();
    return pct < 30 || !name || name === "عميلي"
      ? `${icon}<h1 class="nh-ttl">ابدأ من هنا</h1><div class="ar">عرّف عقل العلامة بنشاطك، ثم اصنع أول فيديو</div>`
      : `${icon}<h1 class="nh-ttl">${esc(name)}</h1><div class="ar">استوديو المحتوى والفيديو</div>`;
  }
  // وقت الزوم وشوية بعد الرجوع: المجسّم بيفضل زي ما هو مهما الماوس واقف فين، وآخر حاجة الماوس وقف عليها بتتطبق بعدها
  let stageLock = false, pendingKey = null;
  function setStage(key) {
    key = key || "";
    if (!key) return;   // لا يوجد «فراغ»: آخر مجسّم يظل
    if (stageLock || zoom) { pendingKey = key; return; }
    if (key === shown) return;
    if (T[key]) storageSet(STAGE_KEY, key);

    shown = key;
    GL?.show(!key ? "app" : key.startsWith("f:") ? "progress" : GLKEY[key] || "app");
    const ph = document.querySelector(".nh-stage-ph:not(.off)");
    if (ph) ph.innerHTML = glImg(!key ? "app" : key.startsWith("f:") ? "progress" : GLKEY[key] || "app");
    const next = slots[1 - live];
    next.innerHTML = stageHTML(key);
    next.classList.remove("out");
    slots[live].classList.add("out");
    live = 1 - live;
  }
  // المسرح بيبدأ بآخر مربع وقفت عليه (أو عقل العلامة أول مرة)، ومبيرجعش لحاجة تانية لما الماوس يطلع في الفراغ
  const STAGE_KEY = "studiomania.stage";
  const firstKey = (() => { const k = storageGet(STAGE_KEY); return T[k] && !KOCHI ? k : "brand"; })();
  shown = firstKey;
  slots[0].innerHTML = stageHTML(firstKey);
  GL?.show(GLKEY[firstKey] || "app");
  // لحد ما المجسّم الـ 3D يجهز (أول تحميل أو ريفرش) نفس الأيقونة بتبان صورة في مكانه، فالنص عمره ما يبقى فاضي
  { const ph = document.querySelector(".nh-stage-ph");
    // الصورة دي أول حاجة بتبان، فبتتحمّل على طول (مش lazy)، والمجسّم بيظهر كامل من غير ما يكبر من الصفر
    if (ph && GL) { ph.innerHTML = glImg(GLKEY[firstKey] || "app").replace(/loading="lazy"/g, 'loading="eager" fetchpriority="high" decoding="sync"'); GL.onReady(() => ph.classList.add("off")); } else ph?.remove(); }
  // الماوس لما يعدّي على مربع في طريقه لمربع تاني مش بيغيّر المجسّم (عشان ميبقاش فيه تقطيع)
  let leaveT, hoverT;
  bento.addEventListener("pointerover", (e) => {
    const line = e.target.closest(".nh-line"), tile = e.target.closest(".nh-tile");
    if (!tile && !line) return;
    clearTimeout(leaveT);
    clearTimeout(hoverT);
    const key = line ? (line.dataset.folder ? "f:" + line.dataset.folder : "") : tile.dataset.id;
    hoverT = setTimeout(() => setStage(key), 110);
  });
  // الماوس طلع في الفراغ: آخر مجسّم بيفضل زي ما هو
  bento.addEventListener("pointerout", (e) => {
    if (e.relatedTarget?.closest?.(".nh-tile, .nh-line")) return;
    clearTimeout(hoverT);
  });
  bento.addEventListener("focusin", (e) => { const l = e.target.closest(".nh-line"), t = e.target.closest(".nh-tile"); if (l || t) setStage(l ? (l.dataset.folder ? "f:" + l.dataset.folder : "") : t.dataset.id); });

  // ---------- اللايت والدارك ----------
  const THEME_KEY = "studiomania.theme";
  const sysDark = matchMedia("(prefers-color-scheme: dark)");
  const mode = () => storageGet(THEME_KEY) || (sysDark.matches ? "dark" : "light");
  const sync = () => {
    root.dataset.nhTheme = mode();
    document.getElementById("nhMode").textContent = window.I18N?.lang === "en" ? (mode() === "dark" ? "Dark" : "Light") : (mode() === "dark" ? "غامق" : "فاتح");
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
  // 👤 الحساب: بيوري الإيميل، ومنه تسجيل الخروج
  document.getElementById("nhAcct").onclick = async () => {
    let who = "";
    try { const r = await fetch("/api/me"); if (r.ok) { const m = await r.json(); who = m.email || ""; } } catch { /* بدون بوابة الحسابات */ }
    if (!(await uiConfirm(who ? `مسجّل الدخول بـ ${who}\nتسجيل الخروج؟` : "تسجيل الخروج؟", { ok: "تسجيل الخروج" }))) return;
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* */ }
    location.href = "/login";
  };

  // ---------- الزوم: المربع بيكبر بنعومة لحد ما يبقى الشاشة، واسمه وأيقونته بيتنقلوا لركن الصفحة زي ما هم ----------
  // الاسم بيتحرك بالـ transform بس (من غير تكبير ولا تغيير في الخط)، فعنوان الصفحة لازم يبقى بنفس مقاس اسم المربع
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const DUR = () => (reduce.matches ? 1 : 950);
  let zoom = null, busy = false;
  const TXT = ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight", "textTransform", "direction"];
  // نسخة طايرة من نص: نفس الخط والمقاس في نفس المكان بالظبط
  function flyText(el) {
    const r = rectOf(el), cs = getComputedStyle(el), f = document.createElement("div");
    f.className = "nh-fly";
    f.textContent = el.textContent;
    TXT.forEach((k) => (f.style[k] = cs[k]));
    Object.assign(f.style, { left: r.x + "px", top: r.y + "px", width: Math.ceil(r.w + 2) + "px", height: r.h + "px", color: cs.color });
    document.body.appendChild(f);
    return { f, r, color: cs.color };
  }
  /* zoomTo: tile = المربع اللي اتداس · key = أيقونته · dest = { latin, name, icon } عناصر العنوان في الصفحة الجديدة
     content = ما يظهر بعد ما المربع يكبر · bg = لون الصفحة الجديدة · parent/z = أين الإطار يُرسم */
  function zoomTo(tile, { key, dest, content, bg, parent, z }) {
    const o = { duration: DUR(), easing: EASE, fill: "both" };
    const r = rectOf(tile), vw = innerWidth, vh = innerHeight;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const frame = document.createElement("div");
    frame.className = "nh-frame";
    frame.style.background = bg;
    frame.style.zIndex = z;
    parent.appendChild(frame);
    home.style.transformOrigin = `${cx}px ${cy}px`;
    const anims = [
      home.animate([{ transform: "none", opacity: 1 }, { opacity: 1, offset: .25 }, { transform: "scale(1.08)", opacity: 0 }], o),
      frame.animate([{ left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px", borderRadius: "24px", opacity: 0 },
        { opacity: 1, offset: .12 }, { left: "0px", top: "0px", width: vw + "px", height: vh + "px", borderRadius: "0px", opacity: 1 }], o),
      ...content.filter(Boolean).map((el) => el.animate([{ opacity: 0, transform: "translateY(18px)" }, { opacity: 0, transform: "translateY(18px)", offset: .55 }, { opacity: 1, transform: "none" }], o)),
    ];
    const flies = [], real = [];
    // الاسم: الإنجليزي والعربي كل واحد لوحده، بيتنقلوا لمكانهم في العنوان
    const src = tile.querySelector(":scope > .nh-head > .nh-name");
    [[src?.querySelector(".latin"), dest.latin], [src?.querySelector("b"), dest.name]].forEach(([from, to]) => {
      if (!from || !to || !from.textContent.trim()) return;
      const t = rectOf(to);
      if (!t.w) return;   // العنوان مستخبي في هذه الصفحة (المونتاج مثلًا)
      const { f, r: fr, color } = flyText(from), toColor = getComputedStyle(to).color;
      anims.push(f.animate([{ transform: "none", color }, { transform: `translate(${t.x - fr.x}px,${t.y - fr.y}px)`, color: toColor }], o));
      flies.push(f); real.push(from, to);
    });
    // الأيقونة: من المجسّم اللي في النص لحد جنب العنوان
    // الأيقونة: صورة طبق الأصل من المجسّم الحي في نفس مكانه ومقاسه، فمفيش أي نطة لما تبدأ تطير.
    // وهي واصلة للركن بتدوب في أيقونة العنوان
    const glEl = document.querySelector("#nhStage .gl"), ti = dest.icon && rectOf(dest.icon);
    if (key && GL) GL.hold(key);
    const shot = key && GL && ti?.w ? GL.snap() : null;
    if (shot) {
      const r0 = shot.rect, s = Math.min(ti.w / r0.w, ti.h / r0.h);
      const tx = ti.x + ti.w / 2 - s * r0.w / 2 - r0.x, ty = ti.y + ti.h / 2 - s * r0.h / 2 - r0.y;
      const f = document.createElement("div");
      f.className = "nh-fly nh-fly-ic";
      f.innerHTML = `<img src="${shot.url}" alt="">`;
      Object.assign(f.style, { left: r0.x + "px", top: r0.y + "px", width: r0.w + "px", height: r0.h + "px" });
      document.body.appendChild(f);
      anims.push(f.animate([{ transform: "none", opacity: 1 }, { opacity: 1, offset: .8 }, { transform: `translate(${tx}px,${ty}px) scale(${s})`, opacity: 0 }], o),
        dest.icon.animate([{ opacity: 0 }, { opacity: 0, offset: .8 }, { opacity: 1 }], o));
      if (glEl) anims.push(glEl.animate([{ opacity: 0 }, { opacity: 0 }], o));   // المجسّم الحي يختفي من أول فريم (الصورة مكانه بالضبط)
      flies.push(f);
    } else if (ti?.w) real.push(dest.icon);
    real.forEach((e) => (e.style.opacity = 0));
    stageLock = true;
    zoom = { anims, frame, flies, real, cleanup: [], key, glEl };
    return anims[0].finished.then(() => {
      // حركة التحويل المتبقية على المحتوى تجعل الأدراج الثابتة محبوسة داخله، فنكتفي بالشفافية بعد الوصول
      anims.slice(2, 2 + content.filter(Boolean).length).forEach((x) => x.effect?.setKeyframes?.([{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1 }]));
      home.style.visibility = "hidden";
      flies.forEach((f) => (f.style.opacity = 0));
      real.forEach((e) => (e.style.opacity = ""));
    });
  }
  function zoomBack() {
    if (!zoom) return Promise.resolve();
    const z = zoom;
    zoom = null;
    home.style.visibility = "";
    z.flies.forEach((f) => (f.style.opacity = ""));
    z.real.forEach((e) => (e.style.opacity = 0));
    z.anims.forEach((a) => a.reverse());
    return z.anims[0].finished.then(() => {
      // نفس المجسّم اللي راجعين منه بيرجع حي في مكانه وبنفس وضعه (من لحظة اللقطة)، والصورة بتدوب فيه بهدوء
      GL?.rewind?.();
      if (z.key && GL) GL.hold(z.key);
      const ic = z.flies.find((f) => f.classList.contains("nh-fly-ic"));
      z.anims.forEach((a) => a.cancel());
      z.frame.remove();
      z.flies.forEach((f) => f !== ic && f.remove());
      if (ic) {
        const d = reduce.matches ? 1 : 260;
        z.glEl?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: "ease-out" });
        ic.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: "ease-out", fill: "forwards" }).finished.then(() => ic.remove(), () => ic.remove());
      }
      z.real.forEach((e) => (e.style.opacity = ""));
      z.cleanup.forEach((f) => f());
      // المجسّم بيفضل ثابت شوية قبل ما يتبع الماوس تاني
      setTimeout(() => {
        if (zoom) return;
        stageLock = false;
        if (pendingKey !== null) { const k = pendingKey; pendingKey = null; setStage(k); }
      }, reduce.matches ? 0 : 1300);
    });
  }
  const zooming = (on) => document.body.classList.toggle("nh-zooming", on);

  // صفحة جوه الرئيسية (اعمل جديد / الأصول / شغّال عليه): الأيقونة والاسم بيطيروا لحد ما يبقوا عنوان الصفحة
  function glImg(key) { return `<img class="ic-l" src="/icons3d/${key}.webp?v=10" alt="" loading="lazy"><img class="ic-d" src="/icons3d/${key}_d.webp?v=10" alt="" loading="lazy">`; }
  const panel = (c, r, inner, attrs = "") => `<div class="nh-tile nh-panel" ${attrs} style="grid-column:span ${c};grid-row:span ${r}">${inner}</div>`;
  const PAGES = {
    // كل نوع كارت فيه أيقونته الزجاج الـ 3D (فاتحة وغامقة)، واسمه، وسطر بيشرح هيعمل إيه
    // زي البروتوتايب: تختار نوع الشغل الأول (كارت باختيار)، وبعدين «التالي» يفتحه. دبل كليك على الكارت بيفتحه على طول
    // 🎬 معرض القوالب: كل قالب ستايل بفيديو بيعبّر عنه (بيشتغل لما تقف عليه)، متقسّمين بالستايل
    create: () => `<div class="nh-gal" id="nhGal"><div class="nh-gal-grid"><div class="nh-empty">يُحمّل القوالب…</div></div></div>
`,
    // (مكتبة الموشن اتشالت من الأصول، ومكانها هيبقى في «اعمل جديد»)
    assets: () => panel(4, 6, `${head("coaches")}<div class="nh-body">${D.coaches.length} شخصية</div><div class="nh-avs">${D.coaches.slice(0, 12).map((c) => `<img src="${esc(c.image_url)}" alt="">`).join("")}</div>`, `data-id="coaches" tabindex="0" role="button"`)
      + panel(4, 6, `${head("voice")}<div class="nh-body">${D.voices} تسجيل</div>`, `data-id="voice" tabindex="0" role="button"`)
      + panel(4, 6, `${head("music")}<div class="nh-body">${D.music} تراك</div>`, `data-id="music" tabindex="0" role="button"`),
    publish: () => [["pubpost", 4, META.publish()], ["inbox", 4], ["adsmgr", 4], ["audience", 6], ["wacamp", 6]]
      .map(([id, c, m]) => panel(c, 3, `${head(id)}<div class="nh-body">${m || esc(T[id].desc)}</div>`, `data-id="${id}" tabindex="0" role="button"`)).join(""),
    progress: () => KOCHI ? panel(12, 6, `${head("progress")}<div class="nh-lines" style="align-content:start">${D.work.map(lineHTML).join("") || `<div class="nh-empty">لا توجد مشاريع بعد.</div>`}</div>`) : projectsBoard(),
  };
  // شغّال عليه (من البروتوتايب): دوّر، وفلتر بالحالة، وكل مشروع كارت بأيقونة قسمه وحالته
  const PJ_ICON = { series: "series", ads: "publish", free: "film" };
  const PJ_AV = { series: "س", ads: "إ", free: "م" };   // دائرة صغيرة بأول حرف من القسم (مسلسل / إعلان / مونتاج حر)
  const PJ_ART = ["linear-gradient(160deg, #4A4542, #24211F)", "linear-gradient(160deg, #57514C, #2B2724)", "linear-gradient(160deg, #46403C, #1E1B19)", "linear-gradient(160deg, #3A3836, #181718)", "linear-gradient(160deg, #4F5A63, #22282D)", "linear-gradient(160deg, #5A4F48, #2A2420)"];
  const pjState = (p) => p.render_status === "rendering" ? ["run", `يُصدّر${p.render_progress != null ? ` · ${Math.round(p.render_progress)}%` : ""}`]
    : p.render_status === "done" ? ["done", "صُدّر"] : p.render_status === "failed" ? ["fail", "التصدير توقف"] : ["run", "في المونتاج"];
  function projectsBoard() {
    const drafts = D.drafts || [];
    const n = (k) => D.work.filter((p) => pjState(p)[0] === k).length + (k === "run" ? drafts.length : 0);
    const dcards = drafts.map((x, i) => {
      const when = x.updated_at ? new Date(x.updated_at).toLocaleDateString(UI_LOCALE(), { day: "numeric", month: "short" }) : "";
      return `<article class="nh-line nh-pj-card" data-draft="${x.kind}:${esc(x.id)}" data-st="run" data-q="${esc(String(x.name).toLowerCase())}" tabindex="0" role="button">
        <div class="nh-pj-art" style="background:${x.thumb ? `center/cover no-repeat url('${esc(x.thumb)}'), ` : ""}${PJ_ART[i % PJ_ART.length]}"></div>
        <div class="nh-pj-name"><span class="nh-pj-av s-tpl">ق</span><b>${esc(x.name)}</b></div>
        <small class="st-run">${esc(x.sec)} · ${esc(x.step)}${when ? ` · ${when}` : ""}</small></article>`;
    }).join("");
    const cards = dcards + D.work.map((p) => {
      const [k, label] = pjState(p);
      const when = p.updated_at ? new Date(p.updated_at).toLocaleDateString(UI_LOCALE(), { day: "numeric", month: "short" }) : "";
      const pct = p.render_status === "rendering" && p.render_progress != null ? Math.round(p.render_progress) : null;
      return `<article class="nh-line nh-pj-card" data-proj="${esc(p.id)}" data-st="${k}" data-q="${esc(p.name.toLowerCase())}" tabindex="0" role="button">
        <div class="nh-pj-art" style="background:${p.cover_url ? `center/cover no-repeat url('${esc(p.cover_url)}'), ` : ""}${PJ_ART[(p.id.charCodeAt(0) + p.id.charCodeAt(1)) % PJ_ART.length]}">${pct != null ? `<span class="nh-pj-bar"><i style="width:${pct}%"></i></span>` : ""}</div>
        <div class="nh-pj-name"><span class="nh-pj-av s-${esc(p.section)}">${PJ_AV[p.section] || "م"}</span><b>${esc(p.name)}</b></div>
        <small class="st-${k}">${esc(SEC[p.section]?.[0] || "")} · ${label}${when ? ` · ${when}` : ""}</small></article>`;
    }).join("");
    return `<div class="nh-pj">
      <div class="nh-pj-bar">
        <label class="nh-pj-q"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><input type="search" placeholder="ابحث عن مشروع" aria-label="ابحث عن مشروع"></label>
        <button type="button" class="on" data-pjf="">الكل · <span class="num">${D.work.length + drafts.length}</span></button>
        <button type="button" data-pjf="run">تعمل · <span class="num">${n("run")}</span></button>
        <button type="button" data-pjf="done">صُدّرت · <span class="num">${n("done")}</span></button>
        ${n("fail") ? `<button type="button" data-pjf="fail">وقفت · <span class="num">${n("fail")}</span></button>` : ""}
      </div>
      <div class="nh-pj-grid">${cards}<button type="button" class="nh-tile nh-pj-add" data-id="create"><span>＋</span>ابدأ مشروعًا جديدًا</button></div>
    </div>`;
  }
  function pjFilter() {
    const q = pGrid.querySelector(".nh-pj-q input")?.value.trim().toLowerCase() || "";
    const f = pGrid.querySelector("[data-pjf].on")?.dataset.pjf || "";
    pGrid.querySelectorAll(".nh-pj-card").forEach((c) => (c.hidden = (f && c.dataset.st !== f) || (q && !c.dataset.q.includes(q))));
  }
  pGrid.addEventListener("input", (e) => { if (e.target.closest(".nh-pj-q")) pjFilter(); });
  pGrid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pjf]");
    if (!b) return;
    pGrid.querySelectorAll("[data-pjf]").forEach((x) => x.classList.toggle("on", x === b));
    pjFilter();
  });
  // صفحات كاملة بتنزل لتحت (عقل العلامة، مكتبة الموشن): كل واحدة ليها موديول بيرسمها
  const MODS = { brand: BrandPage, motion: MotionPage, coaches: CharactersPage, voice: VoicesPage, music: MusicPage, viral: ViralPage, ref2p: Ref2PromptPage, rivals: RivalsPage, plan: RivalsPage, audience: RivalsPage, adsmgr: AdsMgrPage, wacamp: WaCampPage, bots: BotsPage, plans: PlansPage, comics: ComicsPage, brainlib: BrainLibPage, auto: AutoPage, pilot: PilotPage };
  const stopMedia = () => { MotionPage.close(); VoicesPage.close(); MusicPage.close(); CharactersPage.close?.(); Ref2PromptPage.close(); RivalsPage.close(); ComicsPage.close(); BrainLibPage.close(); AutoPage.close(); };
  let pageArg = null, pStack = [];
  // عنوان الصفحة (من البروتوتايب): الأيقونة الزجاج كبيرة، وفوق الاسم اسم القسم بالإنجليزي بالبرتقالي
  const titleHTML = (t, key) => `<div class="nh-name"><span class="latin en-k">${t.en}</span><b>${esc(t.ar)}</b></div><span class="gi nh-glt">${glImg(GLKEY[key] || GLKEY[t.icon] || "create")}</span>`;
  const backLabel = () => { document.getElementById("nhBackT").textContent = pStack.length ? "رجوع" : "الرئيسية"; };
  // الأصول: تابات بالأيقونات الزجاج بين الشخصيات والتعليق الصوتي والموسيقى، والشخصيات أول واحدة
  const AS_TABS = [["coaches", "characters", "الشخصيات"], ["voice", "voices", "التعليق الصوتي"], ["music", "music", "الموسيقى"]];
  const asTabs = (cur) => `<nav class="nh-astabs" aria-label="الأصول">${AS_TABS.map(([k, ic, ar]) =>
    `<button type="button" data-astab="${k}"${k === cur ? ' class="on" aria-current="page"' : ""}>${glImg(ic)}<span>${ar}</span></button>`).join("")}</nav>`;
  function fillPage(key) {
    stopMedia();
    if (key === "assets") key = "coaches";
    const tabs = !KOCHI && pTitle.dataset.key === "assets" && AS_TABS.some((x) => x[0] === key);
    pGrid.dataset.key = key;
    page.classList.toggle("nh-full", key === "create");   // 🎡 عجلة القوالب مالية الشاشة بدون عنوان
    pGrid.classList.toggle("nh-scroll", !!MODS[key]);
    // شغّال عليه: «＋ مشروع جديد» فوق جنب العنوان (زي البروتوتايب)
    document.getElementById("nhPTabs").innerHTML = tabs ? asTabs(key)
      : key === "progress" && !KOCHI ? `<button type="button" class="nh-pj-new nh-tile" data-id="create"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>ابدأ مشروعًا جديدًا</button>` : "";
    document.getElementById("nhPClient").innerHTML = document.getElementById("nhClient").innerHTML;
    pGrid.innerHTML = MODS[key] ? MODS[key].html() : PAGES[key]();
    if (MODS[key]) MODS[key].mount(pGrid, pageArg);
    else pGrid.querySelectorAll(".nh-tile").forEach(addSnake);
    if (key === "create") Gallery.mount(pGrid);
    pageArg = null;
  }
  document.getElementById("nhPClient").onclick = () => document.getElementById("nhClient").click();
  // ابدأ مشروع جديد: اختيار النوع بيغيّر وجهة «التالي»، ورجوع بيقفل الصفحة
  pGrid.addEventListener("click", (e) => {
    const t = e.target.closest("[data-pick]");
    if (t) {
      pGrid.querySelectorAll("[data-pick]").forEach((x) => { x.classList.toggle("on", x === t); x.setAttribute("aria-checked", x === t); });
      const next = pGrid.querySelector(".nh-cr-next");
      if (next) next.dataset.id = t.dataset.pick;
      return;
    }
    if (e.target.closest("[data-crback]")) closePage();
  });
  pGrid.addEventListener("dblclick", (e) => { if (e.target.closest("[data-pick]")) pGrid.querySelector(".nh-cr-next")?.click(); });
  page.addEventListener("click", (e) => {
    const b = e.target.closest("[data-astab]");
    if (!b || b.classList.contains("on")) return;
    fillPage(b.dataset.astab);
    pGrid.animate([{ opacity: .4 }, { opacity: 1 }], { duration: reduce.matches ? 1 : 300, easing: EASE });
  });
  // صفحة جوه صفحة (زي مكتبة الموشن من جوه الأصول): بتتبدّل مكانها، و«رجوع» بيرجّع اللي قبلها
  function swapPage(key, back = false) {
    const prev = pGrid.dataset.key;
    if (back) { const s = pStack.pop(); pTitle.replaceChildren(...s.title); pTitle.dataset.key = s.tkey; }
    else { pStack.push({ key: prev, title: [...pTitle.childNodes], tkey: pTitle.dataset.key }); pTitle.innerHTML = titleHTML(T[key], key); pTitle.dataset.key = key; }
    backLabel();
    fillPage(key);
    renderBar();
    pGrid.animate([{ opacity: 0, transform: `translateX(${back ? -24 : 24}px)` }, { opacity: 1, transform: "none" }], { duration: reduce.matches ? 1 : 450, easing: EASE });
    pTitle.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce.matches ? 1 : 450, easing: EASE });
    if (!MODS[key]) pGrid.querySelectorAll(":scope > .nh-tile").forEach((p, i) => setTimeout(() => { p.classList.add("nh-sweep"); setTimeout(() => p.classList.add("done"), 1100); }, i * 70));
  }
  // صفحة واحدة لكل مدخل: لو الصفحة دي موجودة قبل كده في التسلسل بنرجع لها بدل ما التسلسل يطول (أ ← ب ← أ ← ب…)
  window.NHNav = (key) => {
    if (!T[key] || !zoom?.page) return;
    if (pGrid.dataset.key === key && pTitle.dataset.key === key) return;
    const i = pStack.findIndex((s) => s.key === key && s.tkey === key);
    if (i >= 0) { pStack.length = i + 1; swapPage(key, true); return renderBar(); }
    swapPage(key);
  };
  function openPage(tile, key) {
    if (busy || zoom) return;
    busy = true;
    pStack = [];
    setStage(tile.dataset.id || key);
    pTitle.innerHTML = titleHTML(T[key], key);
    pTitle.dataset.key = key;
    page.hidden = false;
    cornerPage = cornerOf(tile);
    updateCorner("page");
    fillPage(key);
    const bg = getComputedStyle(page).backgroundColor;
    zooming(true);
    zoomTo(tile, { key: GLKEY[key] || GLKEY[T[key].icon], bg, parent: host, z: 4, dest: cornerDest(),
      content: [pGrid, document.getElementById("nhPTabs")] }).then(() => {
      zooming(false);
      busy = false;
      renderBar();
      if (!MODS[key]) pGrid.querySelectorAll(":scope > .nh-tile").forEach((p, i) => setTimeout(() => { p.classList.add("nh-sweep"); setTimeout(() => p.classList.add("done"), 1100); }, i * 70));
    });
    zoom.page = true;
    zoom.cleanup.push(() => { page.hidden = true; pGrid.innerHTML = ""; });
    renderBar();
  }
  function closePage(all = false) {
    if (busy || !zoom?.page) return Promise.resolve();
    if (pStack.length && !all) { swapPage(pStack[pStack.length - 1].key, true); renderBar(); return Promise.resolve(); }
    // راجع للرئيسية على طول: العنوان الأصلي بيرجع الأول عشان يطير لمكان المربع
    if (pStack.length) { const s0 = pStack[0]; pTitle.replaceChildren(...s0.title); pTitle.dataset.key = s0.tkey; pStack = []; }
    stopMedia();
    busy = true;
    zooming(true);
    return zoomBack().then(() => { zooming(false); busy = false; renderBar(); refresh(); });
  }
  document.getElementById("nhBack").onclick = () => closePage();

  // قسم من البرنامج: نفس الزوم، والقسم بيفتح تحت الإطار وبيظهر لما المربع يملا الشاشة
  let sectionZoom = false;
  function openSection(tile, run) {
    if (busy) return;
    if (zoom?.page || !tile.closest("#nhBento")) { run(); return; }
    busy = true;
    sectionZoom = true;
    setStage(tile.dataset.id || (tile.closest(".nh-cont") ? "progress" : ""));
    run();
    cornerStage = cornerOf(tile);
    updateCorner("stage");
    const card = $("stageCard"), head = card.querySelector(".stage-head");
    const bg = getComputedStyle(card).backgroundColor;
    zooming(true);
    zoomTo(tile, { key: GLKEY[tile.dataset.id] || (tile.closest(".nh-cont") ? "progress" : null), bg, parent: document.body, z: 30, dest: cornerDest(),
      content: [$("stageBody"), ...head.querySelectorAll(":scope > :not(.stage-title, .stage-ic, .stage-logo, .stage-back, .stage-bell, .stage-client)")] }).then(() => {
      zooming(false);
      busy = false;
    });
    zoom.section = true;
  }
  // القسم بيتقفل بنفس الزوم بالعكس (لو اتفتح من مربع في الرئيسية)، أو بيختفي بهدوء لو اتفتح من جوه صفحة
  function closeSection(close) {
    if (sectionZoom && zoom?.section) {
      sectionZoom = false;
      busy = true;
      zooming(true);
      return zoomBack().then(() => { close(); requestAnimationFrame(() => zooming(false)); busy = false; refresh(); });
    }
    sectionZoom = false;
    const st = $("stage");
    if (st.hidden || reduce.matches) { close(); refresh(); return Promise.resolve(); }
    return st.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.985)" }], { duration: 260, easing: EASE, fill: "forwards" }).finished
      .then((a) => { close(); requestAnimationFrame(() => st.getAnimations().forEach((x) => x.cancel())); refresh(); });
  }

  // ---------- انت فين: التسلسل في الشريط اللي فوق، و«رجوع» ثابت ----------
  // الأقسام اللي بتتفتح ورا بعض (النشر ← المواعيد مثلًا) بتتسجّل هنا، والصفحات جوه الرئيسية في pStack
  let stageTrail = [];
  const stageOpen = () => typeof shell !== "undefined" && shell.step != null && !$("stage").hidden;
  const _showStep = showStep;
  showStep = function (step, opts = {}) {
    step = String(step);
    navReady = true;   // أول مرة = الرابط اللي الصفحة اتفتحت عليه، ومن بعدها الرابط بيتبع التنقل
    if (isPageHash(step)) return goHash("#" + step);   // رابط صفحة (#brand، #publish/audience)
    if (step === "home") return closeStage();
    if (!popping && location.hash !== `#${step}`) history.pushState(null, "", `#${step}`);   // كل قسم خطوة في تاريخ المتصفح
    const was = stageOpen();
    if (!was && !sectionZoom) cornerStage = "tr";
    if (!was) stageTrail = [step];
    else { const i = stageTrail.indexOf(step); stageTrail = i >= 0 ? stageTrail.slice(0, i + 1) : [...stageTrail, step]; }
    _showStep(step);
    // قسم بيتفتح فوق صفحة (من «ابدأ مشروع جديد» مثلًا): بيظهر بهدوء
    if (!was && !sectionZoom && !opts.instant && !reduce.matches) $("stage").animate([{ opacity: 0, transform: "scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: EASE });
    else if (was && !reduce.matches) $("stageBody").animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: EASE });
    renderBar();
  };
  function crumbs() {
    const out = [{ label: "الرئيسية", lv: "home" }];
    if (zoom?.page) {
      pStack.forEach((s, i) => out.push({ label: T[s.tkey]?.ar || "", lv: "page", i }));
      out.push({ label: T[pTitle.dataset.key]?.ar || "", lv: "page", i: pStack.length });
      const sub = MODS[pGrid.dataset.key]?.sub?.();
      if (sub) out.push({ label: sub, lv: "sub" });
    }
    if (stageOpen()) stageTrail.forEach((st, i) => out.push({ label: STEP_INFO[st]?.title || "", lv: "stage", i }));
    return out;
  }
  function renderBar() {
    updateCorner();
    const list = crumbs(), nav = document.getElementById("nhCrumbs");
    const deep = list.length > 1;
    bar.classList.toggle("deep", deep);
    // في الرئيسية التسلسل مابيختفيش: «الرئيسية» زي ما هي وجنبها مربع فاضي (الكلام اللي جواه بس هو اللي بيمشي)، و«رجوع» مكانه محجوز
    const back = document.getElementById("nhGoBack");
    back.hidden = false;
    back.classList.toggle("off", !deep);
    back.tabIndex = deep ? 0 : -1;
    nav.hidden = false;
    nav.innerHTML = list.map((c, k) => k === list.length - 1 && deep ? `<b class="nh-cb" aria-current="page">${esc(c.label)}</b>`
      : `<button type="button" class="nh-cb" data-crumb="${k}" ${deep ? "" : 'aria-current="page"'}>${esc(c.label)}</button><i aria-hidden="true">›</i>`).join("")
      + (deep ? "" : `<span class="nh-cb nh-cb-empty" aria-hidden="true"></span>`);
    nav._list = list;
    syncHash();
  }
  // 🔗 رابط لكل قسم وصفحة: #brand، #publish/audience، #7 … ورجوع المتصفح بيرجّع خطوة، والرابط لما يتفتح بيفتح نفس المكان
  let popping = false, navReady = false;
  function navHash() {
    if (stageOpen() && stageTrail.length) return "#" + stageTrail[stageTrail.length - 1];
    if (zoom?.page && pGrid.dataset.key) return "#" + [...pStack.map((x) => x.key), pGrid.dataset.key].join("/");
    return "#home";
  }
  function syncHash() {
    if (popping || busy || !navReady) return;
    const h = navHash();
    if (location.hash !== h) history[location.hash ? "pushState" : "replaceState"](null, "", h);
  }
  const pageTile = (key) => Object.keys(T).map((id) => T[id].page === key && bento.querySelector(`.nh-tile[data-id="${id}"]`)).find(Boolean);
  function isPageHash(h) { const k = String(h || "").replace(/^#/, "").split("/")[0]; return !!k && !!pageTile(k); }
  const idle = async () => { for (let i = 0; i < 60 && (busy || zoom?.anims?.some?.((a) => a.playState === "running")); i++) await new Promise((r) => setTimeout(r, 60)); };
  async function goHash(h) {
    const parts = String(h || "").replace(/^#/, "").split("/").filter(Boolean), first = parts[0] || "home";
    popping = true;
    try {
      await idle();
      if (first === "home") { if (stageOpen()) await closeStage(); await idle(); if (zoom?.page) await closePage(true); return; }
      const tile = pageTile(first);
      if (tile) {
        if (stageOpen()) { await closeStage(); await idle(); }
        if (!zoom?.page) { openPage(tile, first); await idle(); }
        else window.NHNav(first);
        for (const k of parts.slice(1)) if (T[k]) { window.NHNav(k); await idle(); }
        return;
      }
      if (document.querySelector(`.view[data-view="${VIEW_OF[first] || first}"]`)) showStep(first);
    } finally {
      popping = false;
      await idle();
      renderBar();
    }
  }
  window.addEventListener("popstate", () => { if (location.hash !== navHash()) goHash(location.hash); });
  // رجوع خطوة واحدة: القسم اللي قبله، أو تقفل القسم، أو الصفحة اللي قبلها، أو الرئيسية
  function goBack() {
    if (busy) return;
    if (stageOpen()) {
      if (stageTrail.length > 1) return showStep(stageTrail[stageTrail.length - 2]);
      return closeStage();
    }
    if (zoom?.page) {
      // صفحة جوه الصفحة (الشخصية اللي فتحتها مثلًا): رجوع بيقفلها الأول
      if (MODS[pGrid.dataset.key]?.back?.()) return renderBar();
      closePage();
    }
  }
  window.NHBar = () => renderBar();
  setTimeout(renderBar, 0);   // من أول فتحة: «الرئيسية» والمربع الفاضي جنبها
  // تدوس على أي حتة في التسلسل: ترجع لها بالظبط
  async function goCrumb(k) {
    if (busy) return;
    const c = document.getElementById("nhCrumbs")._list?.[k];
    if (!c) return;
    if (c.lv === "stage") return showStep(stageTrail[c.i]);
    if (stageOpen()) await closeStage();
    if (c.lv === "home") { if (zoom?.page) await closePage(true); return; }
    if (c.lv === "page" && c.i === pStack.length) { MODS[pGrid.dataset.key]?.back?.(); return renderBar(); }
    if (c.lv === "page" && c.i < pStack.length) { pStack.length = c.i + 1; swapPage(pStack[c.i].key, true); renderBar(); }
  }
  document.getElementById("nhGoBack").onclick = goBack;
  document.getElementById("nhCrumbs").addEventListener("click", (e) => { const b = e.target.closest("[data-crumb]"); if (b) goCrumb(+b.dataset.crumb); });
  bar.querySelector(".nh-logo").addEventListener("click", () => { if (bar.classList.contains("deep")) goCrumb(0); });
  function act(id) {
    const t = T[id];
    if (t.fn) return t.fn;
    if (t.go) return () => showStep(t.go);
    return null;
  }
  function onActivate(e) {
    const line = e.target.closest(".nh-line, [data-cont]");
    if (line?.dataset.draft) {   // عمل قالب لم ينتهِ بعد: يُكمل من مكان ما توقف
      const [kind, id] = line.dataset.draft.split(":");
      if (kind === "flow") return Flow.open(id);
      // التايبوجرافي والدبلجة بيفتحوا آخر مشروع متسجّل، فنسجّل ده ونفضّي المفتوح عشان يفتحه هو
      if (kind === "typo") return openSection(line, () => { storageSet("studiomania.typo", id); tyx.cur = null; showStep("12"); });
      if (kind === "dub") return openSection(line, () => { storageSet("studiomania.dub", id); dbx.cur = null; showStep("13"); });
      if (kind === "scene") {   // استوديو المشهد داخل عجلة «ابدأ مشروعًا جديدًا»: تفتح على هذا المشهد
        try { localStorage.setItem("studiomania.scene", id); } catch { /* */ }
        window.GAL_CAT = "scene";
        if (zoom?.page) return window.NHNav("create");
        return host.querySelector('.nh-tile[data-id="create"]')?.click();
      }
      return openSection(line, async () => { try { tplx.cur = await api(`/api/tvideos/${id}`); } catch { tplx.cur = null; } showStep("14"); });
    }
    if (line?.dataset.proj) {   // مشروع مونتاج في ستوديومانيا: يفتح في المونتاج الخاص بـ قسمه
      const p = D.work.find((x) => x.id === line.dataset.proj);
      if (!p) return;
      return openSection(line, () => { storageSet(projectKey(p.section), p.id); showStep(SEC[p.section]?.[1] || "6f"); });
    }
    if (line) {
      const f = D.folders.find((x) => x.id === line.dataset.folder);
      if (!f) return;
      return openSection(line, () => { setFlowFolder(f.id); fol.current = f; showStep(folderStage(f).next); });
    }
    const tile = e.target.closest(".nh-tile[data-id]");
    if (!tile) return;
    const id = tile.dataset.id, t = T[id];
    if (t.page) return zoom?.page ? (busy || pGrid.dataset.key === t.page ? null : swapPage(t.page)) : openPage(tile, t.page);
    const a = act(id);
    if (a) openSection(tile, a);
  }
  host.addEventListener("click", onActivate);
  host.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".nh-tile[data-id], .nh-line, [data-cont]")) { e.preventDefault(); onActivate(e); }
  });
  // Esc بيقفل النافذة المفتوحة بس (كل نافذة بتقفل نفسها)، ومبيرجّعش من الصفحة عشان ما يضيّعش الشغل

  // ---------- الداتا الحقيقية ----------
  async function refresh() {
    const [folders, publisher, posts, coaches, voices, music, brains, cats, projects, flows, tvs, typos, dubs, scenes] = await Promise.all([
      KOCHI ? shellFolders(true) : [], api("/api/publisher").catch(() => null), api("/api/posts").catch(() => []), api("/api/coaches").catch(() => []),
      api("/api/audio?kind=voice").catch(() => []), api("/api/audio?kind=music").catch(() => []), api("/api/ad-brains").catch(() => []),
      D.cats.length ? D.cats : api("/api/style-cats").catch(() => []),
      KOCHI ? [] : api("/api/projects").catch(() => []),
      KOCHI ? [] : api("/api/flows").catch(() => []), KOCHI ? [] : api("/api/tvideos").catch(() => []),
      KOCHI ? [] : api("/api/typo").catch(() => []), KOCHI ? { items: [] } : api("/api/dub").catch(() => ({ items: [] })),
      KOCHI ? [] : api("/api/scenes").catch(() => []),
    ]);
    if (!KOCHI) D.pilot = await api("/api/pilot").catch(() => null);
    // 🧭 شغل لسه ما خلصش في القوالب (مسار القالب واقف عند الفكرة/السيناريو…، أو فيديو قالب لسه بيتعمل): بيظهر في «شغّال عليه»
    const FLOW_ST = { idea: "الفكرة", format: "نوع المنشور", scenario: "السيناريو", cast: "الأبطال", assets: "الملفات", generate: "التوليد", voice: "الصوت", panel: "لوحة التحكم", shoot: "التصوير", review: "المراجعة", montage: "المونتاج", output: "التصدير", story: "القصة", scenes: "المشاهد" };
    D.drafts = [
      ...flows.filter((f) => f.stage !== "done").map((f) => ({ kind: "flow", id: f.id, name: f.title || f.template?.name || "فكرة جديدة",
        sec: `قالب «${f.template?.name || ""}»`, step: `واقف عند ${FLOW_ST[f.stage] || "خطوة لم تكتمل"}`, updated_at: f.updated_at,
        // كفر الفكرة اللي لسه شغّالة: غلاف القالب نفسه من المعرض
        thumb: (typeof Gallery !== "undefined" && Gallery.list().find((x) => x.id === f.template?.id)?.cover_url) || (f.template?.id ? `/gallery/${encodeURIComponent(f.template.id)}.jpg` : "") })),
      ...tvs.filter((v) => v.section === "templates" && v.status !== "done").map((v) => ({ kind: "tv", id: v.id, name: v.name || v.template_name || "فيديو قالب",
        sec: `قالب «${v.template_name || ""}»`, step: v.status === "failed" ? "توقف" : "ما زال يُنشأ", updated_at: v.updated_at, thumb: v.thumb })),
      // تايبوجرافي لسه ما اتصدّرش، ودبلجة لسه مفيهاش ولا لغة جاهزة
      ...typos.filter((t) => !t.done).map((t) => ({ kind: "typo", id: t.id, name: t.name || "تايبوجرافي", sec: "تايبوجرافي",
        step: t.busy ? "يشتغل الآن" : t.status === "failed" ? "توقف" : "لم يُصدّر بعد", updated_at: t.updated_at })),
      ...(dubs.items || []).filter((x) => !x.done).map((x) => ({ kind: "dub", id: x.id, name: x.name || "دبلجة", sec: "ترجمة ودبلجة",
        step: x.busy ? "يشتغل الآن" : "لا يوجد بعد لغة جاهزة", updated_at: x.updated_at })),
      ...scenes.filter((x) => x.busy || !x.takes).map((x) => ({ kind: "scene", id: x.id, name: x.name || "مشهد", sec: "استوديو المشهد",
        step: x.busy ? "يُولّد الآن" : "لم يُولّد بعد", updated_at: x.updated_at })),
    ].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
    D.work = KOCHI ? folders : projects.filter((p) => SEC[p.section]);
    Object.assign(D, { cats, folders, publisher, posts, coaches, voices: voices.length, music: music.length, money: window.money?.last || D.money,
      brand: brains.find((b) => b.id === clientx?.active) || brains[0] || null });
    renderTiles();
    if (window.I18N?.lang !== "en" && !KOCHI) slots[live].innerHTML = stageHTML(shown);   // العنوان بيتحدّث لما العقل يتحمّل
    GL?.brand?.();
  }
  refresh();
  setInterval(() => { if (!document.hidden && window.money?.last) { D.money = money.last; if (!zoom) renderTiles(); } }, 60000);

  // لما القسم يتقفل: الكاميرا بترجع لورا للرئيسية
  return {
    refresh,
    // عقل العلامة من أي مكان في البرنامج: لو فيه قسم مفتوح بيتقفل الأول، والصفحة بتفتح من مربع البراند
    // 💳 باقتي ونقاطي من أيقونة الشريط: الصفحة بتطلع من الأيقونة نفسها (زي ما المربع بيكبر في الرئيسية)
    openPlans(btn) {
      const go = () => {
        if (zoom?.page) return pGrid.dataset.key === "plans" ? null : swapPage("plans");
        openPage(btn, "plans");
      };
      if (!$("stage").hidden) { closeStage(); setTimeout(go, 1100); } else go();
    },
    // 📤 صفحة «النشر» من أي مكان (ولو فيه صفحة جوّاها: إعلاناتك/الاستهداف/الواتساب بتتفتح بعدها)
    openPublish(sub) {
      const go = () => {
        if (zoom?.page) { if (pGrid.dataset.key !== "publish") swapPage("publish"); if (sub) setTimeout(() => swapPage(sub), 500); return; }
        const tile = bento.querySelector('.nh-tile[data-id="publish"]');
        if (tile) openPage(tile, "publish");
        if (sub) setTimeout(() => window.NHNav?.(sub), 1500);
      };
      if (!$("stage").hidden) { closeStage(); setTimeout(go, 1100); } else go();
    },
    openBrand(id) {
      const go = () => {
        if (zoom?.page) {
          if (pGrid.dataset.key === "brand") return BrandPage.mount(pGrid, id);
          closePage();
          return setTimeout(go, 1100);
        }
        pageArg = id || null;
        const tile = bento.querySelector('.nh-tile[data-id="brand"]');
        if (tile) openPage(tile, "brand");
      };
      if (!$("stage").hidden) { closeStage(); setTimeout(go, 1100); } else go();
    },
    // القسم بيتقفل: بالزوم بالعكس أو بيختفي بهدوء، والتسلسل اللي فوق بيتمسح
    closeSection(close) {
      return closeSection(() => { close(); stageTrail = []; renderBar(); });
    },
    renderBar,
  };
})();

if (NH) {
  // الأقسام بتفتح من غير أنيميشن التكبير القديم (الزوم بقى من الرئيسية الجديدة)
  tileFor = () => null;
  const _closeStage = closeStage;
  closeStage = function () { return NH.closeSection(_closeStage); };
  const _loadClients = loadClients;
  loadClients = async function () { await _loadClients(); NH.refresh(); };
}
