// 🧠 عقل العلامة: خريطة. المخ في النص، وطالع منه فروع (الهوية، الشكل، القواعد، التسليم، صور البراند)،
// وكل حاجة في البراند نقطة على فرعها. النقطة الفاضية لسه ناقصة. تدوس على أي نقطة يفتح جنبها كارت تكتب فيه على طول،
// وأي تعديل بيتحفظ لوحده. مفيش فورم ولا مربعات: كل الشغل جوه الخريطة.

const BrandPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { id: null, brains: [], cats: null, el: null, poll: null, open: null, raf: 0, nodes: [], t0: performance.now() };
  // 💳 تكلفة الأزرار اللي بتصرف بتتكتب عليها قبل الضغط (الترند والمواسم والخطة مابيشتغلوش لوحدهم)
  let COST = null;
  api("/api/auto-costs").then((c) => { COST = c; }).catch(() => {});
  const ct = (k) => (COST?.[k] ? ` · نحو ${COST[k]} نقطة` : "");
  const cur = () => S.brains.find((b) => b.id === S.id) || null;
  const bAPI = (path, opts) => api(`/api/ad-brains/${S.id}${path}`, opts);
  // الستايلات: الجاهزة (من السيرفر) + ستايلات البراند اللي المخ استنبطها («+ إضافة ستايل»)
  const allStyles = (b) => [...(b?.custom_styles || []).filter((c) => c.status === "done"), ...(S.cats || [])];
  const styleIds = (b) => String(b?.styles || "").split(",").map((x) => x.trim()).filter((x) => allStyles(b).some((c) => c.id === x));
  const hexes = (txt) => [...String(txt || "").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]).slice(0, 8);
  const rulesOf = (b) => String(b?.rules || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // أيقونات الفروع (خط رفيع زي باقي البرنامج)
  const IC = {
    identity: "M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8z M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5",
    look: "M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.3-1-1.6-1-2.7 0-1 .8-1.6 1.8-1.6h2.3a3 3 0 0 0 2.9-3C20.5 6.8 16.7 3.5 12 3.5z M7.8 11a1.2 1.2 0 1 1 0 .1z M10.5 7.4a1.2 1.2 0 1 1 0 .1z M15 7.6a1.2 1.2 0 1 1 0 .1z",
    rules: "M9 6.5h10.5 M9 12h10.5 M9 17.5h10.5 M4.5 6.5l1 1 2-2 M4.5 12l1 1 2-2 M4.5 17.5l1 1 2-2",
    delivery: "M20.5 3.5 10 14 M20.5 3.5 14 20.5l-4-6.5-6.5-4z",
    improve: "M4 19h16 M6 15l4-4 3 3 5-6 M15 8h3v3",
    knowledge: "M4 5.5c2.7-1 5.3-1 8 .8 2.7-1.8 5.3-1.8 8-.8v13c-2.7-1-5.3-1-8 .8-2.7-1.8-5.3-1.8-8-.8z M12 6.3v13.3",
    assets: "M4.5 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 15.5l4.5-4.5 4 4 3-3 5 5 M15.5 8.5a1.3 1.3 0 1 1 0 .1z",
    pulse: "M7 4.5h10v4a5 5 0 0 1-10 0z M7 6H4.5a2.5 2.5 0 0 0 2.8 3.4 M17 6h2.5a2.5 2.5 0 0 1-2.8 3.4 M12 13.5v3.5 M8.5 20h7l-.8-3h-5.4z",
    algo: "M4 18.5h16 M6.5 18.5V12 M11 18.5V8 M15.5 18.5V5 M19.5 9.5l-3-3-3 3",
    trends: "M3.5 17l5.5-5.5 4 4 7.5-7.5 M15 8h5.5v5.5",
    chars: "M12 4a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z M5 20c.7-3.7 3.4-5.8 7-5.8s6.3 2.1 7 5.8 M17.5 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z",
    content: "M3.5 6.5a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z M8 15.5l2.5-2.5 2 2 2-2 2.5 2.5",
    tools: "M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z",
    library: "M9 4.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6z M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6 M16 7.5v6.2 M16 13.7a1.8 1.8 0 1 1-1.8-1.8 M16 7.5l3.5-1.2",
  };
  const svg = (d, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const ALGO_G = { strategy: "الاستراتيجية والتوزيع", ideas: "الأفكار", hook: "الخطاف", script: "النص والسرد", edit: "المونتاج والشكل",
    publish: "النشر والتعليق النصي", analysis: "التحليل", ads: "الإعلانات", aivideo: "فيديو الذكاء الاصطناعي" };
  // الخريطة: كل فرع وكل نقطة فيه. النوع بيحدد الكارت اللي بيفتح
  function branches(b) {
    return [
      { k: "identity", t: "الهوية", en: "Identity", leaves: [
        { f: "@name", t: "الاسم", type: "text", ph: "اسم العلامة" },
        { f: "type", t: "نوع المنتج", type: "pick", opts: [["app", "تطبيق"], ["physical", "منتج ملموس"], ["service", "خدمة"]] },
        { f: "domain", t: "المجال", type: "text", ph: "مطاعم، تجميل، تعليم، عقارات…" },
        { f: "niche", t: "النيتش", type: "text", ph: "المجال + الجمهور + الزاوية بدقة", hint: "يُكتب تلقائيًا عند تحليل حساب التواصل الاجتماعي، ويمكنك تعديله." },
        { f: "about", t: "عن العلامة", type: "text", ph: "ماذا تقدّم العلامة، وبماذا تختلف عن غيرها" },
        { f: "audience", t: "الجمهور", type: "text", ph: "من نخاطب؟ عمره، اهتماماته، وعمّ يبحث" },
        { f: "audiences", t: "الجماهير المستهدفة", type: "auds" },
        { f: "market", t: "السوق", type: "text", ph: "مثلًا: السعودية والخليج" },
        { f: "language", t: "اللغة واللهجة", type: "text", ph: "مثلًا: اللهجة السعودية البيضاء" },
      ] },
      { k: "look", t: "الشكل", en: "Look", leaves: [
        { f: "logos", t: "الشعار", type: "imgs" },
        { f: "palette", t: "الألوان", type: "palette" },
        { f: "typography", t: "الخطوط", type: "text", ph: "مثلًا: Cairo للعناوين و IBM Plex للنص" },
        { f: "derived", t: "ما استنبطه البرنامج", type: "multi", fields: [["theme", "الثيم"], ["logo_rule", "مكان الشعار"], ["logo_description", "وصف الشعار"], ["ui_style", "شكل الواجهة"]] },
        { f: "analyze", t: "استنبط الهوية من الصور", type: "action" },
      ] },
      { k: "rules", t: "القواعد", en: "Rules", leaves: [
        ...rulesOf(b).map((r, i) => ({ f: "rule", i, t: r, type: "rule" })),
        { f: "rule+", t: "قاعدة جديدة", type: "rule-new" },
      ] },
      { k: "delivery", t: "التسليم", en: "Delivery", leaves: [
        { f: "logo_on", t: "الشعار على الفيديو", type: "pick", opts: [["1", "نعم"], ["0", "لا"]] },
        { f: "intro", t: "الإنترو", type: "video" },
        { f: "outro", t: "الأوترو", type: "video" },
        { f: "cta", t: "الدعوة لاتخاذ إجراء", type: "text", ph: "مثلًا: حمّل التطبيق الآن" },
        { f: "link", t: "الرابط", type: "text", ph: "https://…", ltr: true },
        { f: "caption", t: "التعليق النصي الافتراضي", type: "text", ph: "{caption}\n\n{cta} 👇\n{link}\n#وسم", hint: "{caption} تعليق الفيديو النصي · {cta} الدعوة · {link} الرابط. توضع تلقائيًا وقت النشر." },
      ] },
      // 🧑‍🎤 الشخصيات والأفاتار: دراع لوحده من المخ، فيه بندين: الشخصيات لوحدها والأفاتار لوحده
      { k: "chars", t: "الشخصيات والأفاتار", en: "Characters", leaves: [
        { f: "pg", i: "coaches", page: "coaches", t: "🧑‍🎤 الشخصيات", type: "page" },
        { f: "pg", i: "twin", page: "twin", t: "🪞 الأفاتار", type: "page" },
      ] },
      // 📚 مكتبة محتويات البراند: صور، فيديوهات، تعليقات صوتية، موسيقى (كل واحد فولدرات جوه فولدرات)، والكوميكس. صفحة واحدة بتابات
      { k: "content", t: "مكتبة المحتويات", en: "Content Library", leaves: [
        { f: "pg", i: "bl:ideas", page: "brainlib", t: "💡 الأفكار", type: "page" },
        { f: "pg", i: "bl:images", page: "brainlib", t: "🖼️ الصور", type: "page" },
        { f: "pg", i: "bl:videos", page: "brainlib", t: "🎬 الفيديوهات", type: "page" },
        { f: "pg", i: "bl:voice", page: "brainlib", t: "🎙️ التعليقات الصوتية", type: "page" },
        { f: "pg", i: "bl:music", page: "brainlib", t: "🎵 الموسيقى", type: "page" },
        { f: "pg", i: "bl:comics", page: "brainlib", t: "🎭 القصص المصوّرة", type: "page" },
        { f: "pg", i: "bl:exports", page: "brainlib", t: "📤 الفيديوهات الجاهزة", type: "page" },
      ] },
      // 🏆 منافسينك: أعلى 5 في المجال والسوق، واللي بينجح عندهم، وتحليل آخر ١٠ فيديوهات ليك، وخطة المحتوى (كلهم صفحة واحدة بتابات)
      { k: "pulse", t: "منافسوك", en: "Competitors", leaves: [
        ...(b?.rivals || []).map((r) => ({ f: "pg", i: `rv${r.id}`, page: "rivals", t: `@${r.handle}`, type: "page" })),
        ...((b?.rivals || []).length && !b?.rivals_pending ? [] : [{ f: "pg", i: "rv:rivals", page: "rivals", t: b?.rivals_pending ? `🆕 ${b.rivals_pending} بانتظار موافقتك` : "🏆 منافسوك", type: "page" }]),
        { f: "pg", i: "rv:works", page: "rivals", t: "🧠 ما ينجح لديهم", type: "page" },
        { f: "pg", i: "rv:batch", page: "rivals", t: "📊 حلّل آخر ١٠ فيديوهات لك", type: "page" },
      ] },
      // 📡 قواعد الخوارزميات: القواعد الأساسية اللي كل الأدوات بتمشي عليها (تتعدّل وتتقفل وترجع للأصل)
      { k: "algo", t: "قواعد الخوارزميات", en: "Algorithm Rules", leaves: Object.entries(ALGO_G).map(([g, t]) => ({ f: "ag", i: g, t, type: "algo" })) },
      // 📱 نقاط لازم تتشتغل: من تحليل حساب السوشيال (البوستات والمشاهدات والفيديوهات)
      { k: "improve", t: "نقاط للتحسين", en: "To improve", leaves: (b?.todos || []).length
        ? b.todos.map((x) => ({ f: "td", i: x.id, t: x.title, type: "todo", todo: x }))
        : [{ f: "social", t: "حلّل حساب التواصل الاجتماعي", type: "social-go" }] },
      // المعرفة: اللي اتقرا من الملفات واللينكات واتوافق عليه
      { k: "knowledge", t: "المعرفة", en: "Knowledge", leaves: (b?.notes || []).map((x) => ({ f: "n", i: x.id, t: x.title, type: "note", note: x })) },
    ].map((br) => {
      // الاقتراحات اللي مستنية موافقتك بتظهر نقط منوّرة على الفرع بتاعها
      // صور المنتج وشخصيات البراند اتشالوا: الاقتراحات القديمة بتاعتهم مابتظهرش
      const mine = (b?.pending || []).filter((p) => (p.kind !== "image" || p.target === "logos") && pendBranch(p) === br.k);
      // اقتراح لخانة موجودة (زي «اقتراح: الخطوط») بيتحط جوه كارت الخانة نفسها، مش نقطة لوحده
      const host = (p) => p.kind === "field" && br.leaves.find((l) => l.f === p.field || (l.fields || []).some(([f]) => f === p.field));
      const leaves = br.leaves.map((l) => { const sg = mine.filter((p) => host(p) === l); return sg.length ? { ...l, sugg: sg } : l; });
      return { ...br, leaves: [...leaves, ...mine.filter((p) => !host(p)).map((p) => ({ f: "p", i: p.id, t: pendLabel(p), type: "pending", p }))] };
    });
  }
  const FIELD_BR = { niche: "identity", about: "identity", audience: "identity", market: "identity", language: "identity", domain: "identity",
    typography: "look", palette: "look", cta: "delivery", link: "delivery", caption: "delivery" };
  const FIELD_T = { niche: "النيتش", about: "عن العلامة", audience: "الجمهور", market: "السوق", language: "اللغة واللهجة", domain: "المجال", typography: "الخطوط",
    palette: "الألوان", cta: "الدعوة لاتخاذ إجراء", link: "الرابط", caption: "التعليق النصي الافتراضي" };
  const pendBranch = (p) => (p.kind === "field" ? FIELD_BR[p.field] || "identity" : p.kind === "rule" ? "rules" : p.kind === "image" ? "look" : "knowledge");
  const pendLabel = (p) => (p.kind === "field" ? `اقتراح: ${FIELD_T[p.field] || p.field}` : p.kind === "rule" ? "قاعدة مقترحة" : p.kind === "question" ? "سؤال" : p.kind === "image" ? `صورة: ${p.title}` : p.title);
  const srcName = (id) => (id === "feedback" ? "تقييماتك" : cur()?.sources?.find((s) => s.id === id)?.name || "");
  // النقطة مليانة ولا لسه ناقصة: القيم اللي البرنامج حاطها لوحده (الاسم الافتراضي، النوع الافتراضي) مش بتتحسب مليانة
  const DEFAULT_NAMES = new Set(["عميل جديد", "عميلي", "علامة جديدة", "My Brand", "New client"]);
  function filled(b, l) {
    if (!b) return false;
    switch (l.type) {
      case "text": return l.f === "@name" ? !!String(b.name || "").trim() && !DEFAULT_NAMES.has(String(b.name).trim()) : !!String(b[l.f] || "").trim();
      case "pick": return l.f === "type" ? !!b.type && !!(b.type_set || String(b.about || "").trim() || String(b.domain || "").trim()) : true;
      case "imgs": return (b[l.f] || []).length > 0;
      case "palette": return hexes(b.palette).length > 0;
      case "multi": return l.fields.some(([k]) => String(b[k] || "").trim());
      case "video": return !!b[`${l.f}_url`];
      case "auds": return (b.audiences || []).length > 0;
      case "rule": case "note": case "algo": return true;
      case "page": return false;   // رابط لصفحة، غير خانة تُملأ
      case "todo": return !!l.todo.done;
      default: return false;
    }
  }
  // 🌱 العقل بيتبني قدام العميل: الفرع مايطلعش غير لما يبقى فيه معلومة منه هو (مش اللي البرنامج ملاه لوحده وقت التسجيل).
  // قبلها بيبقى نقطة صغيرة جنب العقل تدوس عليها وتملاها بإيدك. والثابت (المنافسون، الترند، خطة المحتوى، الخوارزميات، المكتبة،
  // الشخصيات) بييجي في الآخر: لما العقل يفهمه (٦٠٪) أو المساعدة تخلّص كلامها معاه، والمنافسون أول ما يتلاقوا
  const SEED = new Set(["identity", "look", "rules", "delivery", "knowledge", "improve"]);
  const lateOn = (b) => (b?.knowledge?.score || 0) >= 60 || !!b?.assistant_done;
  function branchOn(b, br) {
    if (!b) return false;
    const pre = b.prefilled || {}, own = (f) => String(b[f] ?? "").trim() !== String(pre[f] ?? "").trim();
    if (br.leaves.some((l) => l.type === "pending")) return true;
    switch (br.k) {
      case "identity": case "look": case "delivery":
        return br.leaves.some((l) => !["pick", "action", "page", "rule-new", "pending"].includes(l.type) && l.f !== "@name" && filled(b, l) && (l.type !== "text" || own(l.f)));
      case "rules": return rulesOf(b).length > 0 && own("rules");
      case "knowledge": return (b.notes || []).some((x) => x.source !== "field");
      case "improve": return (b.todos || []).length > 0;
      case "pulse": return (b.rivals || []).length > 0 || !!b.rivals_pending || lateOn(b);
      default: return lateOn(b);   // algo, content, chars
    }
  }
  // الشعار على الفيديو شغّال من الأول (أي قيمة غير «0» معناها نعم)، فمايظهرش كأنه خانة فاضية
  const pickRaw = (b, l) => (l.f === "logo_on" ? (String(b?.logo_on ?? "") === "0" ? "0" : "1") : String(b?.[l.f] || ""));
  const leafValue = (b, l) => {
    if (l.type === "text") return filled(b, l) ? String(l.f === "@name" ? b?.name : b?.[l.f] || "").trim() : "";
    if (l.type === "pick") return l.opts.find(([v]) => v === pickRaw(b, l))?.[1] || "";
    if (l.type === "imgs") return (b?.[l.f] || []).length ? `${(b[l.f]).length} صورة` : "";
    if (l.type === "palette") return hexes(b?.palette).join(" ");
    if (l.type === "video") return b?.[`${l.f}_url`] ? (b[`${l.f}_on`] ? "يعمل" : "موجود ومطفأ") : "";
    if (l.type === "todo") return l.todo.done ? "أُنشئت ✓" : l.todo.why;
    if (l.type === "auds") return (b?.audiences || []).map((a) => a.name).join("، ");
    return "";
  };

  // ➕ «ضيف للعقل» (الدايرة السودا تحت المخ): ملف (أي نوع: صوت وفيديو كمان) أو حساب سوشيال أو كلام أو لينك أو تسجيل صوتك،
  // والمخ بيقراها ويطلّع منها اقتراحات بتظهر نقط منوّرة على الخريطة في الفرع بتاعها
  const SRC_ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json,.html,.htm,image/*,audio/*,video/*,.mp3,.wav,.m4a,.ogg,.webm,.mp4,.mov";
  async function toggleRec() {
    if (S.rec) { S.rec.mr.stop(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast("المتصفح لا يسمح بالميكروفون. اسمح به من جانب شريط العنوان وجرّب مرة أخرى", true); }
    const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : {}), parts = [], t0 = Date.now();
    S.rec = { mr, timer: setInterval(() => { const n = Math.round((Date.now() - t0) / 1000), el = S.el?.querySelector("[data-rect]"); if (el) el.textContent = `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; if (n >= 600) mr.stop(); }, 500) };
    refreshCard();
    mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
    mr.onstop = () => {
      clearInterval(S.rec.timer); S.rec = null; stream.getTracks().forEach((t) => t.stop()); refreshCard();
      const mt = mr.mimeType || type || "audio/webm", ext = /mp4/.test(mt) ? "m4a" : /ogg/.test(mt) ? "ogg" : "webm";
      if (Date.now() - t0 < 1200 || !parts.length) return toast("التسجيل قصير جدًا", true);
      const form = new FormData();
      form.append("files", new File(parts, `تسجيل صوتي ${new Date().toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" })}.${ext}`, { type: mt }));
      form.append("note", "تسجيل صوتي من صاحب العلامة");
      addSource(form);
    };
    mr.start(1000);
  }
  function html() {
    return `<div class="bm" id="nbWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  }

  // ---------- الرسم ----------
  function skeleton() {
    return `<canvas class="bm-dots" aria-hidden="true"></canvas>
      <div class="bm-world"><svg class="bm-lines" aria-hidden="true"></svg><div class="bm-nodes"></div></div>
      <div class="bm-zoom"><button data-zoom="1" aria-label="قرّب">+</button><button data-zoom="0" aria-label="الخريطة كلها">⤢</button><button data-zoom="-1" aria-label="بعّد">−</button></div>
      <div class="bm-card" hidden role="dialog"></div>
      <div class="bm-dropall" aria-hidden="true"><b>أفلت هنا</b><small>سيقرأ العقل الملف ويضع كل معلومة في مكانها</small></div>
      <p class="bm-hint"><i class="bm-lg o"></i> ممتلئة · <i class="bm-lg e"></i> لم تُملأ بعد · <i class="bm-lg b"></i> معلومات وقواعد ثابتة · <i class="bm-lg g"></i> اقتراحات وأسئلة بانتظارك · اضغط على العقل لتبديل العلامة</p>`;
  }
  // الخريطة ليها عالم خاص بيها بمسافات واسعة ثابتة (المخ في 0,0)، والشاشة بتتفرّج عليه بزوم وسحب.
  // كده الفروع عمرها ما تدخل في بعض مهما الشاشة صغرت: الخريطة بتبعد شوية، وتقدر تقرّب بالعجلة أو الأزرار
  function layout() {
    const w = S.el, b = cur();
    if (!w) return;
    const W = w.clientWidth, H = w.clientHeight;
    if (!W || !H) return;
    // الشاشة بالعرض (16:9): الفروع بتتمد يمين وشمال أكتر من فوق وتحت، فالمخ يكبر ويملا الشاشة
    const ex = Math.max(1.2, Math.min(2.1, (W / H) * 1.15)), ey = .78;
    S.ex = ex;
    const list = branches(b), nodes = [{ id: "c", kind: "center", x: 0, y: 0 }];
    // «+» تحت المخ (ترمي فيه أي حاجة)، و«ضيف للعقل بكويز» البرتقاني فوقه
    nodes.push({ id: "add", kind: "add", x: 0, y: 214, from: "c" }, { id: "quiz", kind: "quiz", x: 0, y: -206, from: "c" });
    list.forEach((br, i) => {
      // نص الفروع يمين ونصها شمال، وفوق المخ وتحته فاضيين دايمًا للكويز و«+» (حتى لو عدد الفروع فردي)
      const nr = Math.ceil(list.length / 2), nl = list.length - nr;
      const a = i < nr ? -Math.PI / 2 + Math.PI * (i + .5) / nr : Math.PI / 2 + Math.PI * (i - nr + .5) / nl;
      // الفرع بيطول مع كل حاجة بتتضاف فيه: العميل يشوف العقل بيكبر
      const g = growth(b, br), D = 250 + 140 * (1 - Math.exp(-g / 8));
      const on = branchOn(b, br);
      if (!on && !SEED.has(br.k)) return;   // الثابت بييجي في الآخر
      const DD = on ? D : 185, bx = Math.cos(a) * DD * ex, by = Math.sin(a) * DD * ey;
      const real = br.leaves.filter((l) => !l.type.startsWith("rule-") && !["action", "pending", "page"].includes(l.type));
      const done = real.filter((l) => filled(b, l)).length, total = real.length, waiting = br.leaves.length - br.leaves.filter((l) => l.type !== "pending").length;
      nodes.push({ id: br.k, kind: "branch", br, x: bx, y: by, from: "c", done, total, waiting, g: on ? g : -1, seed: !on });
      // ورق الفرع على قوس برّه، ولو كتير بيبقى على صفين؛ بين كل نقطة والتانية مسافة كفاية
      const n = br.leaves.length, two = n > 7, RL = 92 + Math.min(36, n * 2.5);
      const spread = Math.min(Math.PI * .95, Math.max(0, n - 1) * (two ? 24 : 40) / RL);
      br.leaves.forEach((l, j) => {
        const la = a + (n === 1 ? 0 : -spread / 2 + (j / (n - 1)) * spread);
        const rr = RL * (two && j % 2 ? 1.42 : 1);
        // فرع لسه نقطة: ورقه موجود (عشان كارته يفتح) بس مستخبي جوه النقطة لحد ما الفرع يطلع
        nodes.push({ id: `${br.k}:${l.f}:${l.i ?? ""}`, kind: "leaf", br, l, x: on ? bx + Math.cos(la) * rr : bx, y: on ? by + Math.sin(la) * rr : by, from: br.k, on: filled(b, l), hidden: !on });
      });
    });
    // 📈 الترند: دراع طويل طالع لفوق في الزاوية الشمال، ومربع أحمر بعدد الترندات الجديدة
    // الترند بعد المنافسين، وخطة المحتوى بعد الترند وفي الآخر
    { const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y), X = Math.max(320, ...xs.map(Math.abs)), Y = Math.min(-260, ...ys);
      if (branchOn(b, { k: "pulse", leaves: [] })) nodes.push({ id: "trends", kind: "trends", x: -X * .9, y: Y - 70, from: "c" });
      // 🧭 خطة المحتوى: نقطة لوحدها فوق يمين، عدّادها بيزيد مع كل معلومة العقل بيعرفها والخطة بتتبني لوحدها
      if (lateOn(b)) nodes.push({ id: "plan", kind: "plan", x: X * .9, y: Y - 70, from: "c" }); }
    // كل نقطة ليها مكانها الأصلي (x, y) ومكانها الحالي (px, py) وسرعتها؛ لو الخريطة اتعادت بتكمّل من مكانها
    const old = Object.fromEntries((S.nodes || []).map((n) => [n.id, n])), again = !!S.nodes?.length && !reduce.matches;
    S.nodes = nodes.map((n, i) => {
      const o = old[n.id];
      // الفرع لما يطول (أو يطلع من نقطته) بيتمد لمكانه الجديد بالزنبرك (مش بينط)، وورقه بيطلع منه
      const grew = o && n.kind !== "center" && (o.g !== n.g || (o.hidden && !n.hidden)) && !reduce.matches;
      // جديد خالص وإحنا شغالين: بيطلع من أبوه (الورقة من فرعها، والفرع من العقل)
      const par = !o && again && (old[n.from] || (n.from === "c" ? { px: 0, py: 0 } : null));
      return { ...n, ph: i * 1.7, px: o ? (grew ? o.px : o.px + (n.x - o.x)) : par ? par.px : n.x, py: o ? (grew ? o.py : o.py + (n.y - o.y)) : par ? par.py : n.y,
        vx: o?.vx || 0, vy: o?.vy || 0, born: !!par || (grew && o.hidden) };
    });
    S.byId = Object.fromEntries(S.nodes.map((n) => [n.id, n]));
    fit();
    draw();
  }
  // ---------- الزوم والسحب ----------
  function fit(force, ms = 0) {
    const w = S.el, W = w.clientWidth, H = w.clientHeight;
    if (S.view?.user && !force) return applyView();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    // وقت المكالمة: الخريطة ثابتة على مساحة العقل كله وهو مليان، فالفروع بتطلع في مكانها من غير ما الشاشة تتحرك أو تصغر
    if (S.docked) { const X = 330 * (S.ex || 1.6) + 140, Y = 330 * .78; x0 = -X; x1 = X; y0 = -Y - 210; y1 = Y + 150; }
    else for (const n of S.nodes) {
      const m = n.kind === "leaf" ? 26 : n.kind === "center" ? 130 : 80;
      // الشرح بيطلع فوق النقطة دايمًا: مساحة فوق النقط اللي فوق علشان مايدخلش تحت الشريط
      x0 = Math.min(x0, n.x - m); x1 = Math.max(x1, n.x + m); y0 = Math.min(y0, n.y - m - (n.kind === "leaf" ? 46 : 0)); y1 = Math.max(y1, n.y + m + (n.kind === "branch" ? 30 : 0));
    }
    // الشريط اللي فوق ثابت وطاير فوق الصفحة: الخريطة بتتحط تحته مش وراه
    const top = topInset(), hh = H - top - 40;
    // المساعدة مفتوحة على اليمين: الخريطة بتتحط في الباقي من الشاشة
    const R = S.reserve || 0, s = Math.max(.35, Math.min(1.05, (W - R - 32) / (x1 - x0), hh / (y1 - y0)));
    const to = { s, x: (W - R) / 2 - (x0 + x1) / 2 * s, y: top + hh / 2 - (y0 + y1) / 2 * s, user: false };
    cancelAnimationFrame(S.tw);
    if (!ms || !S.view || reduce.matches) { S.view = to; return applyView(); }
    // انتقال ناعم (ease-in-out): الحجم والمكان مع بعض، والنقط اللي في الخلفية ماشية معاه
    const from = { ...S.view }, t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), k = p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      S.view = { s: from.s + (to.s - from.s) * k, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, user: false };
      applyView();
      if (p < 1) S.tw = requestAnimationFrame(step);
    };
    S.tw = requestAnimationFrame(step);
  }
  // الخريطة مالية الصفحة كلها، والشريط اللي فوق وعنوان الصفحة طايرين فوقها: المحتوى بيتحط تحتهم
  function topInset() {
    const r = S.el.getBoundingClientRect();
    let y = 8;
    for (const id of ["nhBar", "nhPTitle"]) {
      const e = document.getElementById(id);
      if (e && e.offsetHeight && S.el.closest("#nh")?.contains(S.el)) y = Math.max(y, e.getBoundingClientRect().bottom - r.top + 12);
    }
    S.headY = y;   // حتى هنا الخريطة تختفي أسفل الشريط (mask)
    return y;
  }
  function applyView() {
    const v = S.view, world = S.el?.querySelector(".bm-world");
    if (!v || !world) return;
    world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
    S.topY = topInset();
    S.el.style.setProperty("--bm-top", `${S.headY}px`);
    S.el.style.setProperty("--bm-s", v.s);
    if (S.dv) S.dv.dirty = true;
  }
  function zoomAt(f, sx, sy) {
    const v = S.view;
    if (!v) return;
    const s = Math.max(.35, Math.min(2, v.s * f));
    v.x = sx - (sx - v.x) * (s / v.s); v.y = sy - (sy - v.y) * (s / v.s); v.s = s; v.user = true;
    applyView();
  }
  const toWorld = (sx, sy) => [(sx - S.view.x) / S.view.s, (sy - S.view.y) / S.view.s];
  const toScreen = (p) => p && [p[0] * S.view.s + S.view.x, p[1] * S.view.s + S.view.y];
  // وزن الفرع: كل حاجة اتملت أو اتضافت (صورة، لون، قاعدة، معرفة، منافس) بتزوّد نقطة في الدراع
  function growth(b, br) {
    if (!b) return 0;
    let g = 0;
    for (const l of br.leaves) {
      if (l.type === "imgs") g += Math.min(4, (b[l.f] || []).length);
      else if (l.type === "palette") g += Math.min(3, hexes(b.palette).length);
      else if (l.type === "page") g += /^rv\d/.test(String(l.i)) ? 1 : 0;
      else if (l.type === "pick") g += l.f === "type" && b.type ? 1 : 0;
      else if (!["action", "rule-new", "pending"].includes(l.type) && filled(b, l)) g += 1;
    }
    return g;
  }
  const beadsOf = (n) => (n.seed ? 0 : Math.min(30, 2 + n.g));
  function nodeHTML(n, b) {
    if (n.kind === "center") {
      const reading = (b?.sources || []).filter((s) => s.status === "working").length, waiting = (b?.pending || []).length;
      const st = b?.status === "working" ? `<small class="bm-st">جارٍ استنباط الهوية من الصور…</small>` : b?.status === "failed" ? `<small class="bm-st bad">${esc(b.error || "الاستنباط فشل")}</small>`
        : reading ? `<small class="bm-st">جارٍ قراءة ${reading === 1 ? "مصدر" : `${reading} مصادر`}…</small>` : waiting ? `<small class="bm-st">${waiting} اقتراح بانتظار موافقتك</small>` : "";
      return `<button class="bm-n bm-center" data-n="c" title="بدّل العلامة أو أنشئ علامة جديدة">
        <span class="bm-brain"><img class="ic-l" src="/icons3d/brand.webp?v=9" alt=""><img class="ic-d" src="/icons3d/brand_d.webp?v=9" alt=""></span>
        <b>${esc(b?.name || "علامة جديدة")}</b>${st}
        ${b?.knowledge ? `<small class="bm-kn" data-know title="اضغط لرؤية الشروط">نسبة فهم العقل <span class="num">${b.knowledge.score}٪</span> · ${esc(b.knowledge.level)}</small>` : ""}</button>`;
    }
    if (n.kind === "quiz") {
      if (b && S.tqFor !== b.id && S.tqLoading !== b.id) loadTasks(b);
      const tq = S.tqFor === b?.id ? S.tq : null;
      const qd = Math.min((b?.quiz_done || []).length, S.quiz?.length || 17), done = qd + (tq?.done || 0), total = (S.quiz?.length || 17) + (tq?.total || 0);
      return `<button class="bm-n bm-quiz${S.agent ? " bm-agent" : ""}${tq && done >= total ? " full" : ""}" data-n="quiz" title="كل ما يحتاجه العقل: أسئلة قصيرة + مهام (رفع صور، فيديو، صوتك…)"><i>?</i><b>${esc(S.agent || "أكمل العقل")}</b><small class="num">${done}/${total}</small></button>`;
    }
    if (n.kind === "trends") {
      if (b && S.trFor !== b.id && S.trLoading !== b.id) loadTrends(b);
      const tr = S.trFor === b?.id ? S.tr : null, nw = tr?.new || 0;
      return `<button class="bm-n bm-trends${nw ? " has" : ""}${tr?.status === "working" ? " busy" : ""}" data-n="trends" title="الترند الرائج الآن في سوقك (حدّثه بضغطة)">
        <span class="bm-trbox">${svg(IC.trends, 18)}<b>الترند</b>${nw ? `<em class="num">${nw}</em>` : ""}</span>
        <small>${tr?.status === "working" ? "جارٍ البحث…" : tr ? `${(tr.items || []).length} ترند${tr.market ? ` · ${esc(tr.market)}` : ""}` : ""}</small></button>`;
    }
    if (n.kind === "plan") {
      if (b && S.plFor !== b.id && S.plLoading !== b.id) loadPlan(b);
      const pl = S.plFor === b?.id ? S.pl : null, fresh = pl ? Math.max(0, pl.count - pl.built_from) : 0;
      return `<button class="bm-n bm-plan${pl?.status === "working" ? " busy" : ""}" data-n="plan" title="تُبنى خطة المحتوى بضغطة من كل ما عرفه العقل عنك">
        <span class="bm-trbox">🧭<b>خطة المحتوى</b>${fresh && pl?.has ? `<em class="num">+${fresh}</em>` : ""}</span>
        <small>${!pl ? "" : pl.status === "working" ? "تُبنى الآن…" : !pl.has ? (pl.count < pl.min || !pl.ready ? `تحتاج معلومات أكثر (${pl.count}/${pl.min})` : "جاهزة للبناء")
          : fresh ? `+${fresh} معلومة جديدة: حدّثها` : `مبنية من ${pl.built_from} معلومة`}</small></button>`;
    }
    if (n.kind === "add") {
      const reading = (b?.sources || []).some((s) => s.status === "working");
      return `<button class="bm-n bm-add${reading ? " busy" : ""}" data-n="add" title="أضف للعقل: ملف أو رابط أو نص"><i>+</i><b>أضف للعقل</b></button>`;
    }
    if (n.kind === "branch") {
      return `<button class="bm-n bm-branch${n.seed ? " bm-seed" : ""}${S.open?.br === n.br.k ? " on" : ""}" data-n="${n.id}" title="${esc(n.seed ? `${n.br.t}: اضغط لتملأه` : n.br.t)}">
        <span class="bm-bic">${svg(IC[n.br.k])}${n.waiting ? `<em class="num">${n.waiting}</em>` : ""}</span><b>${esc(n.br.t)}</b>${n.total ? `<small class="num">${n.br.k === "knowledge" ? n.total : `${n.done}/${n.total}`}</small>` : ""}</button>`;
    }
    const l = n.l, val = leafValue(b, l);
    if (l.type === "pending") {
      const p = l.p, sub = p.kind === "field" || p.kind === "rule" ? p.value : p.kind === "question" ? p.title : p.summary;
      return `<button class="bm-n bm-leaf pend${p.kind === "question" ? " ask" : ""}${S.open?.id === n.id ? " on" : ""}" data-n="${esc(n.id)}" aria-label="${esc(l.t)}">
        <i>${p.kind === "question" ? "؟" : ""}</i><span class="bm-tip"><b>${esc(l.t)}</b><small>${esc(String(sub || "").slice(0, 60))}</small><small class="miss">بانتظار موافقتك</small></span></button>`;
    }
    // المعلومات الثابتة (قواعد الخوارزميات، القواعد، المعرفة) لونها لوحدها
    const cls = (l.type === "action" ? "act" : l.type === "rule-new" ? "add" : l.type === "page" ? "go" : ["algo", "rule", "note"].includes(l.type) ? "full info" : n.on ? "full" : "empty") + (l.sugg ? " sugg" : "");
    // 🏷️ اللي اتكتب في النقطة باين جنبها على طول (أول كام كلمة…)، من غير ما تفتحها
    const lab = l.type === "page" ? l.t.replace(/^\S+\s/, "") : l.type === "rule" ? l.t : l.type === "note" ? l.note.title || "" : n.on ? val : "";
    const side = (S.byId?.[n.from]?.x ?? 0) + 0 > n.x ? "l" : "r";
    return `<button class="bm-n bm-leaf ${cls}${S.open?.id === n.id ? " on" : ""}" data-n="${esc(n.id)}" aria-label="${esc(l.t)}">
      <i>${l.type === "action" ? "✲" : l.type === "rule-new" ? "+" : ""}</i>${lab ? `<span class="bm-lab ${side}">${esc(short(lab))}</span>` : ""}
      <span class="bm-tip"><b>${esc(l.type === "rule" ? "قاعدة" : l.t)}</b>${l.sugg ? `<small class="miss">💡 يوجد اقتراح بالداخل</small>` : ""}${l.type === "rule" || l.type === "note" ? `<small${l.type === "note" && l.note.source === "ai" ? "" : " data-no-i18n"}>${esc(l.type === "note" ? l.note.summary || "" : l.t)}</small>` : val ? `<small data-no-i18n>${esc(val.slice(0, 60))}</small>` : l.type === "action" || l.type === "rule-new" ? "" : `<small class="miss">لم تُملأ بعد</small>`}</span></button>`;
  }
  // أول ٣ كلمات (بحد أقصى ٢٢ حرف) وبعدين «…»
  function short(t) {
    const w = String(t).replace(/\s+/g, " ").trim().split(" ");
    let s = w.slice(0, 3).join(" ");
    if (s.length > 22) s = s.slice(0, 21).trim();
    return s.length < String(t).trim().length ? s + "…" : s;
  }
  function draw() {
    const w = S.el, b = cur();
    w.querySelector(".bm-nodes").innerHTML = S.nodes.filter((n) => !n.hidden).map((n) => nodeHTML(n, b)).join("");
    S.nodes.forEach((n) => { n.el = w.querySelector(`[data-n="${CSS.escape(n.id)}"]`); });
    // 🌱 اللي لسه طالع (فرع طلع من نقطته، أو ورقة جديدة): بيظهر بالتدريج وهو بيتمد، والورق ورا بعض
    let bi = 0;
    for (const n of S.nodes) {
      if (!n.born || !n.el) continue;
      n.born = false;
      n.el.animate([{ opacity: 0, scale: .35 }, { opacity: 1, scale: 1 }], { duration: 650, delay: n.kind === "leaf" ? 180 + (bi++ % 12) * 110 : 0, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    }
    if (S.hovNode) { const h = S.nodes.find((x) => x.id === S.hovNode.id); S.hovNode = h || null; h?.el?.classList.add("hot"); }
    w.querySelector(".bm-lines").innerHTML = S.nodes.filter((n) => n.from && !n.hidden).map((n) => `<path data-l="${esc(n.id)}" class="${n.kind}${n.on === false ? " empty" : ""}${n.seed ? " seed" : ""}"/>`).join("");
    S.nodes.forEach((n) => { n.line = n.from && !n.hidden ? w.querySelector(`.bm-lines [data-l="${CSS.escape(n.id)}"]`) : null; });
    // نقط الدراع: النقط الجديدة بتطلع بنبضة
    const prev = S.beads || null;
    S.beads = {};
    const svgEl = w.querySelector(".bm-lines");
    for (const n of S.nodes) {
      if (n.kind !== "branch") continue;
      const k = beadsOf(n), was = prev ? prev[n.id] ?? k : k;
      svgEl.insertAdjacentHTML("beforeend", `<g class="bm-beads" data-b="${esc(n.id)}">${Array.from({ length: k }, (_, i) => `<circle r="2.4" class="${i >= was ? "new" : ""}" style="--d:${(i - was) * 90}ms"/>`).join("")}</g>`);
      n.beadG = svgEl.lastElementChild;
      n.bead = [...n.beadG.children];
      n.bead.forEach((c, i) => c.style.setProperty("--i", i));
      S.beads[n.id] = k;
    }
    S.rc = (w.querySelector(".bm-brain")?.offsetWidth || 150) * .5;
    tick(performance.now());
  }
  // النقط بتعوم بهدوء حوالين مكانها، والخطوط ماشية معاها
  // فيزيا بسيطة: كل نقطة مربوطة بزنبرك لمكانها، واللي متعلّق بيها بيمشي وراها.
  // لما تمسك نقطة وتسحبها، اللي طالع منها بيتشد معاها، ولما تسيبها بترجع مكانها وبتهتز شوية
  const FOLLOW = { branch: .55, leaf: .9, add: .6, trends: .5, plan: .5 };
  function step(dt) {
    const k = 140, c = 15;
    for (const n of S.nodes) {
      if (S.drag?.n === n && S.drag.moved) { n.vx = n.vy = 0; n.px = S.drag.x; n.py = S.drag.y; continue; }
      const p = n.from && S.byId[n.from], f = FOLLOW[n.kind] || 0;
      // الماوس واقف على الفرع: الورق بتاعه بيفرد لبرّه شوية
      const open = S.hov && n.kind === "leaf" && n.br.k === S.hov ? .14 : 0;
      let tx = n.x + (p ? (p.px - p.x) * f + (n.x - p.x) * open : 0), ty = n.y + (p ? (p.py - p.y) * f + (n.y - p.y) * open : 0);
      // الدايرة اللي الماوس عليها بتتشد ناحيته زي المغناطيس، واللي جنبها بتوسّعله
      if (S.mw && !S.drag && (n.kind === "leaf" || n.kind === "branch")) {
        const mx = S.mw[0] - n.x, my = S.mw[1] - n.y, md = Math.hypot(mx, my) || 1;
        if (S.hovNode === n) { const pull = Math.min(n.kind === "leaf" ? 16 : 12, md * .4); tx += mx / md * pull; ty += my / md * pull; }
        else if (md < 110) { const push = (1 - md / 110) * 14; tx -= mx / md * push; ty -= my / md * push; }
      }
      n.vx += (k * (tx - n.px) - c * n.vx) * dt;
      n.vy += (k * (ty - n.py) - c * n.vy) * dt;
      n.px += n.vx * dt; n.py += n.vy * dt;
    }
  }
  function tick(now) {
    const t = (now - S.t0) / 1000, still = reduce.matches;
    const dt = Math.min(.033, Math.max(0, (now - (S.last || now)) / 1000));
    S.last = now;
    if (still) S.nodes.forEach((n) => { if (!(S.drag?.n === n && S.drag.moved)) { n.px = n.x; n.py = n.y; } else { n.px = S.drag.x; n.py = S.drag.y; } });
    else for (let i = 0; i < 2; i++) step(dt / 2);
    const pos = {};
    for (const n of S.nodes) {
      const amp = S.drag?.n === n ? 0 : n.kind === "center" ? 2 : n.kind === "branch" ? 4 : 5;
      const x = n.px + (still ? 0 : Math.sin(t * .55 + n.ph) * amp), y = n.py + (still ? 0 : Math.cos(t * .48 + n.ph * 1.3) * amp);
      pos[n.id] = [x, y];
      if (n.el) {
        n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        // الشريط اللي فوق طاير فوق الخريطة: لو النقطة قريبة منه اسمها بيظهر تحتها

      }
    }
    // الأذرع خطوط منحنية: الدراع بيلف شوية وهو طالع من المخ، والورق بيكمّل في نفس اتجاه الدراع وبعدين يميل لمكانه
    const c = pos.c;
    for (const n of S.nodes) {
      if (!n.line) continue;
      const A = pos[n.from], B = pos[n.id], d = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const ux = (B[0] - A[0]) / d, uy = (B[1] - A[1]) / d;
      let c1, c2;
      if (n.from === "c") {
        const sw = n.kind === "add" || n.kind === "quiz" ? 0 : .5, cs = Math.cos(sw), sn = Math.sin(sw);
        c1 = [A[0] + (ux * cs - uy * sn) * d * .45, A[1] + (ux * sn + uy * cs) * d * .45];
        c2 = [B[0] - ux * d * .35, B[1] - uy * d * .35];
      } else {
        const od = Math.hypot(A[0] - c[0], A[1] - c[1]) || 1, ox = (A[0] - c[0]) / od, oy = (A[1] - c[1]) / od;
        c1 = [A[0] + ox * d * .42, A[1] + oy * d * .42];
        c2 = [B[0] - (ox * .15 + ux * .35) * d, B[1] - (oy * .15 + uy * .35) * d];
      }
      // الخط بيبدأ وبيخلص عند حافة الدايرة (مش من جوّه المخ أو الأيقونة)
      const r1 = n.from === "c" ? S.rc : 34, r2 = n.kind === "branch" ? 34 : n.kind === "add" || n.kind === "quiz" ? 24 : n.kind === "trends" || n.kind === "plan" ? 30 : 10;
      const dir = (p, q) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
      const s1 = dir(A, c1), s2 = dir(c2, B);
      const P0 = [A[0] + s1[0] * r1, A[1] + s1[1] * r1], P3 = [B[0] - s2[0] * r2, B[1] - s2[1] * r2];
      n.line.setAttribute("d", `M${P0[0].toFixed(1)} ${P0[1].toFixed(1)}C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${P3[0].toFixed(1)} ${P3[1].toFixed(1)}`);
      if (n.bead) {
        const k = n.bead.length;
        n.bead.forEach((el, i) => {
          const t = .07 + .86 * (k === 1 ? .5 : i / (k - 1)), m = 1 - t;
          const a = m * m * m, b2 = 3 * m * m * t, c3 = 3 * m * t * t, d4 = t * t * t;
          el.setAttribute("cx", a * P0[0] + b2 * c1[0] + c3 * c2[0] + d4 * P3[0]);
          el.setAttribute("cy", a * P0[1] + b2 * c1[1] + c3 * c2[1] + d4 * P3[1]);
        });
      }
    }
    dots(now);
    // الكارت بيتبع مكان النقطة الثابت (من غير تمايلها) عشان مايترعشش، وبيتحرك بس لو الخريطة اتحركت أو النقطة اتسحبت
    if (S.open?.n) placeCard(toScreen([S.open.n.px, S.open.n.py]));
  }
  // الخلفية نقط هادية، والماوس بينوّر اللي تحته (زي كشاف صغير ماشي معاك)
  const GAP = 22, GLOW = 170;
  function dotsSize() {
    const w = S.el, cv = w?.querySelector(".bm-dots");
    if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = w.clientWidth, H = w.clientHeight;
    const cs = getComputedStyle(w), ink = cs.getPropertyValue("--nh-ink").trim() || "#181718", acc = cs.getPropertyValue("--nh-accent").trim() || "#E5613E";
    const key = `${W}x${H}@${dpr}${ink}`;
    S.dv = S.dv || { mx: -999, my: -999, tx: -999, ty: -999, a: 0, ta: 0, dirty: true };
    S.dv.ink = ink; S.dv.acc = acc;
    if (S.dv.key === key) return;
    S.dv.key = key; S.dv.dirty = true;
    cv.width = W * dpr; cv.height = H * dpr;
    // الشبكة الأساسية بتترسم مرة واحدة وتتنسخ كل فريم
    const base = S.dv.base = document.createElement("canvas");
    base.width = (W + GAP) * dpr; base.height = (H + GAP) * dpr;
    const g = base.getContext("2d");
    g.scale(dpr, dpr); g.fillStyle = ink; g.globalAlpha = .16;
    for (let y = GAP / 2; y <= H + GAP; y += GAP) for (let x = GAP / 2; x <= W + GAP; x += GAP) { g.beginPath(); g.arc(x, y, 1, 0, 6.2832); g.fill(); }
    S.dv.dpr = dpr; S.dv.W = W; S.dv.H = H;
  }
  function dots() {
    const v = S.dv, cv = S.el?.querySelector(".bm-dots");
    if (!v?.base || !cv) return;
    const e = reduce.matches ? 1 : .18;
    v.mx += (v.tx - v.mx) * e; v.my += (v.ty - v.my) * e; v.a += (v.ta - v.a) * (reduce.matches ? 1 : .12);
    const moving = Math.abs(v.tx - v.mx) > .3 || Math.abs(v.ty - v.my) > .3 || Math.abs(v.ta - v.a) > .004;
    if (!moving && !v.dirty) return;
    v.dirty = moving;
    const c = cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    // النقط ماشية مع الخريطة لما تسحبها
    const m = (a) => ((a % GAP) + GAP) % GAP;
    v.ox = m(S.view?.x || 0); v.oy = m(S.view?.y || 0);
    c.drawImage(v.base, (m(v.ox - GAP / 2) - GAP) * v.dpr, (m(v.oy - GAP / 2) - GAP) * v.dpr);
    if (v.a < .01) return;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.fillStyle = v.acc;
    const x0 = v.ox + Math.ceil((Math.max(0, v.mx - GLOW) - v.ox) / GAP) * GAP, y0 = v.oy + Math.ceil((Math.max(0, v.my - GLOW) - v.oy) / GAP) * GAP;
    for (let y = y0; y <= Math.min(v.H, v.my + GLOW); y += GAP) for (let x = x0; x <= Math.min(v.W, v.mx + GLOW); x += GAP) {
      const d = Math.hypot(x - v.mx, y - v.my) / GLOW;
      if (d >= 1) continue;
      const f = (1 - d * d) ** 2 * v.a;
      c.globalAlpha = .16 + .7 * f;
      c.beginPath(); c.arc(x, y, 1 + 1.3 * f, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }
  function loop(now) {
    if (!S.el?.isConnected) { S.raf = 0; return; }
    tick(now);
    S.raf = requestAnimationFrame(loop);
  }

  // ---------- الكارت اللي بيفتح جنب النقطة ----------
  const editable = (k, val, ph, ltr) => `<div class="bm-write" contenteditable="plaintext-only" data-k="${k}" data-ph="${esc(ph || "اكتب هنا…")}"${ltr ? ' dir="ltr"' : ""}>${esc(val)}</div>`;
  // 🧩 الكويز: سؤال واحد كل مرة، والإجابة بتتحفظ في خانتها أول ما تدوس «التالي». تقدر تخرج وتكمّل بعدين.
  const QLANG = () => (window.I18N?.lang === "en" ? "en" : "ar");
  async function loadQA(b) {
    try {
      const [qs, qa] = await Promise.all([S.quiz ? S.quiz : api(`/api/brain-quiz?lang=${QLANG()}`), api(`/api/ad-brains/${b.id}/quiz-answers`)]);
      S.quiz = qs; S.qa = qa; S.qaFor = b.id;
    } catch (err) { S.qaFor = b.id; S.qa = {}; toast(err.message, true); }
    if (S.open?.id === "quiz") refreshCard();
  }
  // 📈 الترند: القايمة بتتحدّث لوحدها، والجديد بيتعدّ في المربع الأحمر لحد ما تفتحها
  async function loadTrends(b) {
    S.trLoading = b.id;
    try { S.tr = await bAPI("/trends"); S.trFor = b.id; } catch { S.tr = null; S.trFor = b.id; }
    S.trLoading = null;
    redrawNode("trends");
    if (S.open?.id === "trends") refreshCard();
    clearTimeout(S.trT);   // وهو يبحث نرى كل قليلًا، وبعدها كل ١٠ دقايق (الخادم يحدّث تلقائيًا كل ١٢ ساعة)
    S.trT = setTimeout(() => { if (S.el?.isConnected && cur()?.id === b.id) { S.trFor = null; loadTrends(b); } }, S.tr?.status === "working" ? 4000 : 600000);
  }
  async function loadPlan(b) {
    S.plLoading = b.id;
    try { S.pl = await bAPI("/plan"); S.plFor = b.id; } catch { S.pl = null; S.plFor = b.id; }
    S.plLoading = null;
    redrawNode("plan");
    clearTimeout(S.plT);   // وهي تُبنى نرى كل قليلًا حتى ما تنتهي
    if (S.pl?.status === "working") S.plT = setTimeout(() => { if (S.el?.isConnected && cur()?.id === b.id) { S.plFor = null; loadPlan(b); } }, 4000);
  }
  function redrawNode(id) {
    const n = S.byId?.[id];
    if (n?.el && cur()) { n.el.outerHTML = nodeHTML(n, cur()); n.el = S.el.querySelector(`[data-n="${CSS.escape(id)}"]`); if (S.open?.id === id) n.el?.classList.add("on"); }
  }
  function trendsHTML(b) {
    const tr = S.trFor === b?.id ? S.tr : null;
    const head = `<div class="bm-ch"><span class="latin en-k">TRENDS</span><b>📈 الترند</b></div>`;
    if (!tr) { if (b && S.trLoading !== b.id) loadTrends(b); return head + `<p class="bm-note">جارٍ جلب الترند…</p>`; }
    if (tr.new && !S.trSeenBusy) { S.trSeenBusy = true; bAPI("/trends/seen", { method: "POST" }).then((x) => { S.tr = x; redrawNode("trends"); }).catch(() => {}).finally(() => (S.trSeenBusy = false)); }
    const ago = tr.checked_at ? Math.round((Date.now() / 1000 - tr.checked_at) / 3600) : null;
    const row = (x) => `<li class="bm-tr${x.seen ? "" : " new"}"><div><b>${x.seen ? "" : "🔴 "}${esc(x.title)}</b>${x.what ? `<small>${esc(x.what)}</small>` : ""}
        ${x.angle ? `<p class="bm-note">💡 لك: ${esc(x.angle)}</p>` : ""}
        ${(x.posts || []).length ? `<small class="bm-trsrc">${x.posts.slice(0, 3).map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" dir="ltr">@${esc(p.handle)}</a>`).join(" · ")}</small>` : ""}</div>
      <div class="bm-acts"><button class="bm-go" data-trnow="${esc(x.id)}">✨ استخدمه في منشور الآن</button>
        <button class="bm-pill" data-trsave="${esc(x.id)}" ${x.saved ? "disabled" : ""}>${x.saved ? "🔖 محفوظ" : "🔖 احفظه لاحقًا"}</button>
        <button class="bm-pill" data-trdel="${esc(x.id)}" title="احذفه من القائمة">✕</button></div></li>`;
    return head + `<p class="bm-note">الرائج الآن في ${esc(tr.market || "سوقك")} ومجالك. حدّثه بزر «ابحث الآن»، ويبقى الترند هنا حتى تحذفه.${tr.live ? "" : " (وضع تجريبي: ترندات تجريبية حتى يُضبط مفتاح مصدر البيانات)"}</p>
      <div class="bm-acts"><button class="bm-pill" data-trref ${tr.status === "working" ? "disabled" : ""}>${tr.status === "working" ? "⏳ جارٍ البحث…" : `🔄 ابحث الآن${ct("trends")}`}</button>
        ${ago != null ? `<small class="bm-note">آخر تحديث منذ ${ago < 1 ? "أقل من ساعة" : `${ago} ساعة`}</small>` : ""}</div>
      ${tr.error ? `<p class="bm-note bad">⚠️ ${esc(tr.error)}</p>` : ""}
      ${(tr.items || []).length ? `<ul class="bm-trs">${tr.items.map(row).join("")}</ul>` : `<p class="bm-note">لا توجد ترندات بعد.${tr.market ? "" : " اكتب «السوق» و«المجال» في الهوية ليبدأ البحث."}</p>`}`;
  }
  // 📡 قواعد الخوارزميات: كل مجموعة نقطة، وجوّاها الفريمويركس وقواعدها (تشغيل/قفل، تعديل، زيادة، مسح، رجوع للأصل)
  async function loadAlgo(b) {
    S.arLoading = b.id;
    try { S.ar = await bAPI("/algo-rules"); S.arFor = b.id; } catch (err) { toast(err.message, true); }
    S.arLoading = null;
    if (S.open?.n?.l?.type === "algo") refreshCard();
  }
  function algoHTML(b, l) {
    const head = `<div class="bm-ch"><span class="latin en-k">ALGORITHM RULES</span><b>${esc(l.t)}</b></div>`;
    const ar = S.arFor === b?.id ? S.ar : null;
    if (!ar) { if (b && S.arLoading !== b.id) loadAlgo(b); return head + `<p class="bm-note">جارٍ جلب القواعد…</p>`; }
    const parts = ar.parts.filter((p) => p.group === l.i);
    return head + `<p class="bm-warn">⚠️ ${esc(ar.warn)}</p>
      <p class="bm-note">هذه هي القواعد الأساسية التي تلتزم بها كل أدوات البرنامج عند كتابة الأفكار والخطافات والنصوص والتعليق النصي. علامة ✓ تعني أن القاعدة مفعّلة.</p>
      ${parts.map((p) => `<div class="bm-ar"><div class="bm-arh"><b>${esc(p.title)}</b>${p.changed ? `<button class="bm-pill" data-arreset="${p.id}" title="يعيد القواعد الأصلية">↺ استعد الأصل</button>` : ""}</div>
        <ul>${p.rules.map((r, i) => `<li class="${r.on ? "" : "off"}${r.custom ? " custom" : ""}"><input type="checkbox" data-aron="${p.id}:${i}" ${r.on ? "checked" : ""} title="مفعّل / مطفأ">
          ${editable(`ar:${p.id}:${i}`, r.t, "القاعدة")}<button class="bm-x2" data-ardel="${p.id}:${i}" title="احذف القاعدة">✕</button></li>`).join("")}</ul>
        <button class="bm-link" data-aradd="${p.id}">＋ قاعدة جديدة</button></div>`).join("")}
      ${ar.changed ? `<div class="bm-acts"><button class="bm-pill" data-arreset="all">↺ أعد كل القواعد إلى الأصل</button></div>` : ""}`;
  }
  async function algoSave(fid, rows, reset) {
    try { S.ar = await bAPI("/algo-rules", { method: "PUT", ...jsonBody(reset ? { reset: [fid] } : { parts: { [fid]: rows } }) }); S.arFor = cur()?.id; refreshCard(); savedPill(reset ? "✅ أُعيدت القواعد إلى الأصل" : "✅ حُدّثت قواعد الخوارزميات"); }
    catch (err) { toast(err.message, true); }
  }
  const arRows = (fid) => (S.ar?.parts.find((p) => p.id === fid)?.rules || []).map((r) => ({ t: r.t, on: r.on }));

  // ✅ مهام العقل (مش أسئلة): رفع اللوجو، صور الأفاتار، الفيديو، صوتك… كل واحدة بتتعلّم لوحدها لما تتعمل
  async function loadTasks(b) {
    S.tqLoading = b.id;
    try { S.tq = await bAPI("/tasks"); S.tqFor = b.id; } catch { S.tq = null; S.tqFor = b.id; }
    S.tqLoading = null;
    const n = S.byId?.quiz;
    if (n?.el && cur()?.id === b.id) { n.el.outerHTML = nodeHTML(n, cur()); n.el = S.el.querySelector('[data-n="quiz"]'); }
    if (S.open?.id === "quiz") refreshCard();
  }
  function tasksHTML(b) {
    const tq = S.tqFor === b?.id ? S.tq : null;
    if (!tq) { if (b && S.tqLoading !== b.id) loadTasks(b); return `<p class="bm-note">جارٍ معرفة الناقص…</p>`; }
    const left = tq.items.filter((x) => !x.done);
    return `<div class="bm-qbar"><i style="width:${Math.round(100 * tq.done / Math.max(1, tq.total))}%"></i></div>
      <p class="bm-note">${left.length ? `بقي ${left.length} من ${tq.total}. تُعلَّم كل مهمة تلقائيًا فور إنجازها.` : "انتهت كل المهام 🎉"}</p>
      <ul class="bm-tasks">${[...left, ...tq.items.filter((x) => x.done)].map((x) => `<li class="${x.done ? "ok" : ""}"><span class="bm-tck">${x.done ? "✓" : ""}</span>
        <span class="bm-ttx"><b>${esc(x.t)}</b><small>${esc(x.why)}</small></span>${x.done ? "" : `<button class="bm-pill" data-tgo="${esc(JSON.stringify(x.go))}">أنشئها →</button>`}</li>`).join("")}</ul>`;
  }
  function startHTML(b) {
    return `<div class="bm-qstart"><p class="bm-q">لنبدأ بعلامتك</p>
      <p class="bm-note">اكتب اسم العلامة، أو ضع رابط حسابها على إنستغرام أو تيك توك وسيحلّله العقل: يستنبط الاسم والمجال والجمهور والمنتجات والأسلوب، فتجد أغلب الإجابات جاهزة لتعدّلها فقط. أو اكتب الاثنين.</p>
      <label class="bm-lbl">اسم العلامة</label>${editable("@bname", DEFAULT_NAMES.has(String(b.name || "").trim()) ? "" : b.name, "مثلًا: مطبخ ستّي")}
      <label class="bm-lbl">رابط الحساب (اختياري)</label>${editable("@blink", "", "instagram.com/… أو @اسم_الحساب", true)}
      <p class="bm-note bm-cost">💳 تحليل الحساب يُخصم من نقاطك بقدر العمل المنجز فعلًا (عادةً بين ١٠ و٦٠ نقطة).</p>
      <div class="bm-acts"><span></span><button class="bm-go" data-bstart>ابدأ →</button></div></div>`;
  }
  async function brandStart() {
    const b = cur();
    if (!b) return;
    const name = S.el.querySelector('[data-k="@bname"]')?.innerText.trim() || "", link = S.el.querySelector('[data-k="@blink"]')?.innerText.trim() || "";
    if (!name && !link) return toast("اكتب اسم العلامة أو رابط حسابها", true);
    if (name && !(await save(() => bAPI("", { method: "PATCH", ...jsonBody({ name, fields: {} }) }), { card: false }))) return;
    S.started = { ...(S.started || {}), [b.id]: true };
    S.qaFor = null;
    if (link) { const form = new FormData(); form.append("social", link); addSource(form); }
    refreshCard();
  }
  function quizHTML(b) {
    const tq = S.tqFor === b?.id ? S.tq : null, qn = S.quiz?.length || 0, qd = Math.min((b?.quiz_done || []).length, qn || 99);
    const tabs = `<div class="bm-pills bm-qtabs"><button class="bm-pill${S.qtab !== "t" ? " on" : ""}" data-qtab="q">🧩 الأسئلة <span class="num">${qd}/${qn || "…"}</span></button>
      <button class="bm-pill${S.qtab === "t" ? " on" : ""}" data-qtab="t">✅ المهام <span class="num">${tq ? `${tq.done}/${tq.total}` : "…"}</span></button></div>`;
    const head = `<div class="bm-ch"><span class="latin en-k">COMPLETE THE BRAIN</span><b>أكمل العقل</b></div>
      <p class="bm-note">عند انتهاء الأسئلة والمهام يصبح لدى العقل كل ما يحتاجه ليعرفك.</p>${tabs}`;
    if (S.qtab === "t") return head + tasksHTML(b);
    // 🏷️ علامة من غير اسم: أول خطوة اسمها أو رابط حسابها (والعقل يستنبط الاسم والإجابات من الحساب)
    if (b && DEFAULT_NAMES.has(String(b.name || "").trim()) && !(S.started || {})[b.id] && S.qtab !== "t") return head + startHTML(b);
    const anal = (b?.sources || []).find((x) => x.kind === "social" && x.status === "working");
    if (anal) S.qaWait = true;
    if (!S.quiz || S.qaFor !== b?.id) { if (b && S.qaLoading !== b.id) { S.qaLoading = b.id; loadQA(b).finally(() => (S.qaLoading = null)); } return head + `<p class="bm-note">جارٍ تجهيز الأسئلة…</p>`; }
    const qs = S.quiz, total = qs.length, done = new Set(b.quiz_done || []);
    if (S.qi == null) { const i = qs.findIndex((q) => !done.has(q.id)); S.qi = i < 0 ? total : i; }
    const bar = `<div class="bm-qbar"><i style="width:${Math.round(100 * Math.min(done.size, total) / total)}%"></i></div>`;
    if (S.qi >= total) {
      return head + bar + `<p class="bm-q">${done.size >= total ? "انتهت كل الأسئلة 🎉" : "وصلت إلى آخر سؤال"}</p>
        <p class="bm-note">${done.size >= total ? "وُضعت كل إجابة في خانتها في العقل. يمكنك العودة لتعديل أي إجابة في أي وقت." : `أجبت عن ${done.size} من ${total}. يمكنك العودة إلى الأسئلة التي تخطّيتها في أي وقت.`}</p>
        <div class="bm-acts">${tq && tq.done < tq.total ? `<button class="bm-go" data-qtab="t">✅ أكمل المهام (بقي ${tq.total - tq.done})</button>` : ""}<button class="${tq && tq.done < tq.total ? "bm-pill" : "bm-go"}" data-qgo="0">راجع الإجابات</button>${done.size < total ? `<button class="bm-pill" data-qgo="first">أكمل الناقص</button>` : ""}</div>`;
    }
    const q = qs[S.qi], sugg = !S.qa?.[q.id] && S.qa?._sugg?.[q.id], val = S.qa?.[q.id] || sugg || "";
    const field = q.opts ? `<div class="bm-pills">${q.opts.map(([v, t]) => `<button class="bm-pill${val === v ? " on" : ""}" data-qpick="${esc(v)}">${esc(t)}</button>`).join("")}</div>`
      : `<div class="bm-write bm-qans${q.multi ? " multi" : ""}" contenteditable="plaintext-only" data-k="@quiz" data-ph="${esc(q.ph || "اكتب إجابتك…")}"${q.ltr ? ' dir="ltr"' : ""}>${esc(val)}</div>`;
    const wait = anal ? `<div class="bm-note bm-qwait"><p>⏳ نحلّل حساب <span dir="ltr">@${esc(anal.handle || "")}</span> الآن${anal.step ? ` · ${esc(anal.step)}` : ""}. عند الانتهاء تظهر الإجابات المقترحة في أسئلتها لتعدّلها أو تعتمدها، وتمتلئ «نقاط للتحسين».</p><i class="bm-qwbar"></i></div>` : "";
    return head + wait + `<div class="bm-qtop"><span>سؤال <b class="num">${S.qi + 1}</b> من <b class="num">${total}</b></span>${done.has(q.id) ? `<small>✓ مُجاب</small>` : sugg ? `<small>✨ مقترحة من حسابك</small>` : ""}</div>` + bar
      + `<p class="bm-q">${esc(q.q)}</p>` + field
      + (sugg ? `<p class="bm-note">استنبطها العقل من حسابك. عدّلها كما تريد، أو اضغط «التالي» لتعتمدها.</p>` : "")
      + (q.id === "link" && !(b.sources || []).some((x) => x.kind === "social") ? `<p class="bm-note">📱 إذا كتبت رابط حسابك على إنستغرام أو تيك توك، يحلّله العقل تلقائيًا بعد «التالي» ويملأ الإجابات ونقاط التحسين (💳 عادةً بين ١٠ و٦٠ نقطة).</p>` : "")
      + (q.multi ? `<p class="bm-note">كل عنصر في سطر (Enter لسطر جديد).</p>` : "")
      + `<div class="bm-acts bm-qacts">${S.qi > 0 ? `<button class="bm-pill" data-qprev>← السابق</button>` : ""}<span></span><button class="bm-pill" data-qskip>تخطَّ</button><button class="bm-go" data-qnext>${S.qi + 1 === total ? "انتهيت" : "التالي →"}</button></div>
      <p class="bm-note bm-qsave">تُحفظ إجابتك في العقل فور ضغط «التالي». يمكنك الخروج والإكمال في أي وقت.</p>`;
  }
  async function quizStep(step, pick) {
    const b = cur(), q = S.quiz?.[S.qi];
    if (!b || !q) return;
    const ed = S.el.querySelector('.bm-card [data-k="@quiz"]');
    const ans = (pick ?? (ed ? ed.innerText.replace(/\u00a0/g, " ").trim() : "")) || "";
    const move = () => { S.qi = Math.max(0, S.qi + step); refreshCard(); S.el.querySelector('.bm-card [data-k="@quiz"]')?.focus(); };
    if (step > 0 && pick == null && !ans && !(b.quiz_done || []).includes(q.id)) return toast("اكتب الإجابة، أو اضغط «تخطَّ»", true);
    if (ans && ans !== (S.qa?.[q.id] || "")) {
      S.qa = { ...S.qa, [q.id]: ans };
      if (await save(() => bAPI("/quiz", { method: "POST", ...jsonBody({ qid: q.id, answer: ans, lang: QLANG() }) }), { card: false }) && ans) savedPill("✅ حُفظت الإجابة في العقل");
    }
    move();
  }

  function cardHTML(n) {
    const b = cur();
    if (n.kind === "center") {
      return `<div class="bm-ch"><span class="latin en-k">BRANDS</span><b>العلامات</b></div>
        <div class="bm-pills">${S.brains.map((x) => `<button class="bm-pill${x.id === S.id ? " on" : ""}" data-brain="${x.id}">${esc(x.name)}</button>`).join("")}</div>
        <div class="bm-new">${editable("@new", "", "اكتب اسم علامة جديدة واضغط Enter")}</div>
        ${S.brains.length > 1 ? `<button class="bm-link bad" data-del>احذف «${esc(b?.name || "")}» بكل صوره</button>` : ""}`;
    }
    if (n.kind === "add") {
      const tab = S.addTab || "file", srcs = [...(b?.sources || [])].reverse(), rec = S.rec;
      const TABS = [["file", "📎 ملف"], ["social", "📱 حساب تواصل"], ["text", "✍️ اكتب"], ["rec", "🎙️ سجّل"], ["url", "🔗 موقع"]];
      return `<div class="bm-ch"><span class="latin en-k">ADD TO BRAIN</span><b>أضف للعقل</b></div>
        <p class="bm-note">أضف أي شيء عن العلامة، وسيقرؤه العقل ويحلّله: تظهر كل معلومة نقطةً مضيئة في فرعها لتوافق عليها.</p>
        <div class="bm-pills bm-tabs">${TABS.map(([k, t]) => `<button class="bm-pill${tab === k ? " on" : ""}" data-tab="${k}">${t}</button>`).join("")}</div>
        ${tab === "file" ? `<label class="bm-up wide bm-drop">+<small>أفلت الملف هنا أو اضغط للاختيار (أو أفلته في أي مكان على الخريطة)</small><small class="bm-types">PDF · Word · صور · نص · صوت · فيديو</small><input type="file" multiple accept="${SRC_ACCEPT}" data-src hidden></label>`
          : tab === "social" ? `${editable("@social", "", "رابط الحساب أو @اسم_المستخدم · واضغط Enter", true)}
            <p class="bm-note">إنستغرام أو تيك توك. يأخذ العقل النبذة والمعلومات والتخصص، وينزّل الصور ويضع كلًّا منها في مكانه، ويحلل المنشورات والمشاهدات وأفضل الفيديوهات وأضعفها، وتُسجَّل الأخطاء والنواقص في «نقاط للتحسين».</p>
            <p class="bm-note bm-cost">💳 يُخصم من نقاطك بقدر العمل المنجز فعلًا (عادةً بين ١٠ و٦٠ نقطة).</p>`
          : tab === "text" ? editable("@text", "", "اكتب أي شيء عن العلامة: الجمهور، النبرة، العروض، الممنوعات… واضغط Enter")
          : tab === "rec" ? `<div class="bm-rec"><button class="bm-recb${rec ? " on" : ""}" data-ibrec>${rec ? "⏹" : "🎙️"}</button>
            <div><b>${rec ? `جارٍ التسجيل <span class="num" data-rect>0:00</span>` : "سجّل وتحدّث عن العلامة بصوتك"}</b><small class="muted">${rec ? "اضغط مرة أخرى عند الانتهاء، وسيُرسل التسجيل إلى العقل تلقائيًا" : "تحدّث براحتك: ماذا تقدّم، ولمن، وما الذي يميزك. حتى ١٠ دقائق."}</small></div></div>`
          : editable("@url", "", "example.com · واضغط Enter", true)}
        ${srcs.length ? `<ul class="bm-srcs">${srcs.map((s) => `<li class="${s.status}"><span class="bm-dot ${s.status === "done" ? "full" : s.status === "failed" ? "bad" : "busy"}"></span>
          <span><b>${esc(s.name)}</b><small>${s.status === "working" ? esc(s.step || "جارٍ القراءة…") : s.status === "failed" ? esc(s.error || "فشل") : `${s.count ? `انتهى · ${s.count} اقتراح` : "انتهى · لا جديد"}${s.credits ? ` · ${s.credits} نقطة` : ""}`}</small></span>
          <button data-sdel="${s.id}" title="أزله">✕</button></li>`).join("")}</ul>` : ""}`;
    }
    if (n.kind === "quiz") return quizHTML(b);
    if (n.kind === "trends") return trendsHTML(b);
    if (n.kind === "branch") {
      return `<div class="bm-ch"><span class="latin en-k">${n.br.en}</span><b>${esc(n.br.t)}</b></div>${n.br.k === "knowledge" && !n.br.leaves.length ? `<p class="bm-note">ما زالت فارغة. أضف ملفًا أو رابطًا من «أضف للعقل» وستظهر المعرفة هنا.</p>` : ""}
        <ul class="bm-list">${n.br.leaves.map((l) => `<li><button data-go="${esc(`${n.br.k}:${l.f}:${l.i ?? ""}`)}"><span class="bm-dot ${l.type === "action" || l.type === "rule-new" ? "add" : filled(b, l) ? "full" : "empty"}"></span><b>${esc(l.type === "rule" ? l.t : l.t)}</b></button></li>`).join("")}</ul>`;
    }
    const l = n.l, head = `<div class="bm-ch"><span class="latin en-k">${n.br.en}</span><b>${esc(l.type === "rule" ? "قاعدة" : l.t)}</b></div>`;
    switch (l.type) {
      case "text": return head + editable(l.f, l.f === "@name" ? b?.name : b?.[l.f], l.ph, l.ltr) + (l.hint ? `<p class="bm-note">${esc(l.hint)}</p>` : "") + suggBox(b, l);
      case "rule": return head + editable(`rule:${l.i}`, l.t, "القاعدة") + `<button class="bm-link bad" data-rdel="${l.i}">أزل هذه القاعدة</button>`;
      case "auds": {   // 👥 أكثر من جمهور: العقل يستخلصهم من الوصف، وكل فكرة وإعلان يتوجّه لواحد منهم
        const A = b?.audiences || [];
        return head + `<p class="bm-note">${b?.audiences_busy ? "⏳ يستخلص العقل الجماهير من وصف العلامة…" : "يستخلصها العقل تلقائيًا من «عن العلامة» و«الجمهور»، وتتوجّه كل فكرة وإعلان إلى واحد منها."}</p>
          <div class="bm-auds">${A.map((a, i) => `<div class="bm-aud" data-audi="${i}">
            <input class="bm-in" data-audk="name" value="${esc(a.name)}" placeholder="اسم الجمهور" aria-label="اسم الجمهور">
            <input class="bm-in sm" data-audk="share" value="${esc(a.share || "")}" placeholder="٪" aria-label="النسبة" inputmode="numeric">
            <input class="bm-in wide" data-audk="who" value="${esc(a.who)}" placeholder="من هو" aria-label="من هو">
            <input class="bm-in wide" data-audk="pain" value="${esc(a.pain)}" placeholder="ما الذي يزعجه" aria-label="ما الذي يزعجه">
            <input class="bm-in wide" data-audk="want" value="${esc(a.want)}" placeholder="ماذا يريد" aria-label="ماذا يريد">
            <button class="bm-x2" data-auddel="${i}" title="أزل هذا الجمهور">✕</button></div>`).join("")}</div>
          <div class="bm-acts"><button class="bm-pill" data-audadd>＋ جمهور</button>${A.length ? `<button class="bm-go" data-audsave>احفظ</button>` : ""}<button class="bm-pill" data-audx ${b?.audiences_busy ? "disabled" : ""}>✨ استخلصها من الوصف</button></div>`;
      }
      case "rule-new": return head + `<p class="bm-note">أي شيء يجب مراعاته في كل عمل للعلامة: النص والصور والفيديو والصوت.</p>` + editable("rule:new", "", "مثلًا: بدون موسيقى · واضغط Enter");
      case "pick": return head + `<div class="bm-pills">${l.opts.map(([v, t]) => `<button class="bm-pill${pickRaw(b, l) === v ? " on" : ""}" data-pick="${l.f}" data-v="${v}">${t}</button>`).join("")}</div>`;
      case "palette": {
        const hs = hexes(b?.palette);
        return head + `<div class="bm-sw">${hs.map((h) => `<button style="background:${h}" data-hdel="${h}" title="${h} · اضغط لإزالته"></button>`).join("")}
          <label class="bm-swadd" title="أضف لونًا">+<input type="color" data-hadd hidden></label></div>` + editable("palette", b?.palette, "#E5613E برتقالي، #111111 أسود", true) + suggBox(b, l);
      }
      case "imgs": {
        const xs = b?.[l.f] || [];
        return head + `<div class="bm-imgs">${xs.map((x) => `<figure data-file="${esc(x.file)}"><img src="${esc(x.url)}" alt="" loading="lazy" title="${esc(x.description || x.name)}"><button data-adel title="احذف">✕</button></figure>`).join("")}
          <label class="bm-up">+<small>ارفع</small><input type="file" accept="image/*" multiple data-up="${l.f}" hidden></label></div>
          <p class="bm-note">${l.f === "logos" ? "الشعار بنسخه (فاتح، غامق، أيقونة)." : "صور حقيقية من العلامة. يصفها البرنامج ويستخدمها كما هي بدلًا من الاختراع."} يمكنك سحب الصور وإفلاتها هنا.</p>`;
      }
      case "video": {
        const url = b?.[`${l.f}_url`];
        return head + (url ? `<video src="${esc(url)}" controls preload="metadata" playsinline></video>
          <div class="bm-pills"><button class="bm-pill${b[`${l.f}_on`] ? " on" : ""}" data-von="${l.f}" data-v="1">يعمل</button><button class="bm-pill${b[`${l.f}_on`] ? "" : " on"}" data-von="${l.f}" data-v="">مغلق</button></div>
          <button class="bm-link bad" data-vdel="${l.f}">أزل الفيديو</button>` : `<label class="bm-up wide">+<small>ارفع فيديو</small><input type="file" accept="video/*" data-vup="${l.f}" hidden></label>`)
          + makerHTML(b, l.f);
      }
      case "multi": return head + `<p class="bm-note">يُكتب تلقائيًا من الشعار والصور، ويمكنك تعديله.</p>` + l.fields.map(([k, t]) => `<div class="bm-sub"><small>${t}</small>${editable(k, b?.[k], "…", /logo_description|ui_style|style/.test(k))}</div>`).join("") + suggBox(b, l);
      case "todo": {
        const x = l.todo;
        return head + (x.why ? `<div class="bm-sub"><small>له</small><p class="bm-now">${esc(x.why)}</p></div>` : "") + (x.how ? `<div class="bm-sub"><small>كيف تُصلَح</small><p class="bm-now">${esc(x.how)}</p></div>` : "")
          + `<div class="bm-acts"><button class="bm-go" data-tdone="${x.id}" data-v="${x.done ? "" : "1"}">${x.done ? "↩︎ لم تُنجز بعد" : "✓ أُنجزت"}</button><button class="bm-pill" data-tdel="${x.id}">أزلها</button></div>`
          + (srcName(x.source) ? `<p class="bm-note">من تحليل «${esc(srcName(x.source))}»</p>` : "");
      }
      case "social-go": return head + `<p class="bm-note">ضع رابط حساب العلامة على إنستغرام أو تيك توك، وسيحلل العقل المنشورات والفيديوهات ويكتب هنا النقاط التي يجب العمل عليها.</p>
        <button class="bm-go" data-socialgo>📱 حلّل حسابًا</button>`;
      case "pending": {
        const p = l.p, from = srcName(p.source);
        if (p.kind === "image") {
          const KN = { products: "صور المنتج", characters: "شخصيات العلامة", sets: "الأماكن والخلفيات", props: "الأدوات", logos: "الشعار" };
          S.imgTarget = S.imgTarget?.id === p.id ? S.imgTarget : { id: p.id, t: p.target };
          return `<div class="bm-ch"><span class="latin en-k">SUGGESTION</span><b>صورة من الحساب</b></div>${from ? `<p class="bm-note">من «${esc(from)}»</p>` : ""}
            <img class="bm-pimg" src="/media/ads/brains/${esc(b.id)}/src/${esc(p.file)}" alt="">${p.summary ? `<p class="bm-note" data-no-i18n>${esc(p.summary)}</p>` : ""}
            <div class="bm-sub"><small>توضع في</small><div class="bm-pills">${Object.entries(KN).map(([k, t]) => `<button class="bm-pill${S.imgTarget.t === k ? " on" : ""}" data-itgt="${k}">${t}</button>`).join("")}</div></div>
            <div class="bm-acts"><button class="bm-go" data-ok="${p.id}">ضعها</button><button class="bm-pill" data-no="${p.id}">لا</button></div>`;
        }
        const now = p.kind === "field" ? String(b?.[p.field] || "").trim() : "";
        const top = `<div class="bm-ch"><span class="latin en-k">SUGGESTION</span><b>${esc(p.kind === "question" ? "سؤال" : p.kind === "note" ? "معلومة جديدة" : l.t)}</b></div>${from ? `<p class="bm-note">من «${esc(from)}»</p>` : ""}`;
        const body = p.kind === "question" ? `<p class="bm-q">${esc(p.title)}</p>` + editable("@ans", "", "اكتب الإجابة…")
          : p.kind === "note" ? editable("@ttl", p.title, "العنوان") + (p.summary ? `<p class="bm-note">${esc(p.summary)}</p>` : "") + editable("@val", p.value, "التفاصيل")
          : (now ? `<div class="bm-sub"><small>المكتوب في العقل الآن (سيُزال)</small><p class="bm-now">${esc(now)}</p></div><div class="bm-sub"><small>يقترح العقل كتابة هذا بدلًا منه (يمكنك تعديله)</small>` : "<div>") + editable("@val", p.value, "…", p.field === "link" || p.field === "palette") + "</div>";
        // بنقول بوضوح «موافق» هتعمل إيه بالظبط
        const what = p.kind === "field" ? [`إن وافقت: ستُكتب في خانة «${esc(String(l.t).replace(/^اقتراح:\s*/, ""))}» في العقل${now ? " بدّل المكتوب الآن" : ""}، وسيلتزم بها كل نص وفيديو جديد.`, "اكتبها في الخانة"]
          : p.kind === "rule" ? ["إن وافقت: ستُضاف إلى القواعد، وسيلتزم بها كل عمل جديد للعلامة.", "أضف القاعدة"]
          : p.kind === "question" ? ["ستُحفظ إجابتك في «المعرفة»، وسيرجع إليها العقل عند الكتابة.", "احفظ الإجابة"]
          : ["هذه معلومة عن العلامة، وليست مهمة مطلوبة منك. إن وافقت: ستُحفظ في «المعرفة»، وسيقرؤها العقل عند كتابة أي نص أو فكرة جديدة. يمكنك تعديل النص قبل الموافقة.", "احفظها في المعرفة"];
        return top + (p.why ? `<p class="bm-note bm-why">${esc(p.why)}</p>` : "") + body + `<p class="bm-note bm-what">${what[0]}</p>`
          + `<div class="bm-acts"><button class="bm-go" data-ok="${p.id}">${what[1]}</button><button class="bm-pill" data-no="${p.id}">لا، لا حاجة إليها</button></div>`;
      }
      // معلومة في «المعرفة»: حاجة المخ عرفها عن البراند وبيرجع لها وهو بيكتب (مش مهمة مطلوب منك تعملها)
      case "algo": return algoHTML(b, l);
      case "note": return head.replace(esc(l.t), "معلومة")
        + `<p class="bm-note">هذه معلومة عرفها العقل عن العلامة${srcName(l.note.source) ? ` من «${esc(srcName(l.note.source))}»` : l.note.source === "quiz" ? " من إجابتك في الاختبار" : ""}، ويرجع إليها عند كتابة النصوص والأفكار والتعليق النصي. إن كان فيها خطأ فعدّلها هنا، وأي تعديل يُحفظ تلقائيًا.</p>`
        + `<div class="bm-sub"><small>العنوان</small>${editable(`note:t:${l.i}`, l.note.title, "العنوان")}</div>`
        + `<div class="bm-sub"><small>الملخص (سطر واحد يظهر عند الوقوف على النقطة)</small>${editable(`note:s:${l.i}`, l.note.summary || "", "سطر واحد")}</div>`
        + `<div class="bm-sub"><small>التفاصيل (النص الذي يقرؤه العقل)</small>${editable(`note:b:${l.i}`, l.note.body, "التفاصيل")}</div>`
        + (l.note.quiz === "seasons_ai" ? `<p class="bm-note">جلب العقل هذه المواسم تلقائيًا من «السوق» و«الجمهور» في الهوية (الأعياد الرسمية والإسلامية ورمضان والمواسم المحلية)، ويمكنك جلبها من جديد عند تغييرهما.</p>
          <div class="bm-acts"><button class="bm-pill" data-seasons>🔄 اجلب المواسم من جديد${ct("seasons")}</button></div>` : "")
        + `<button class="bm-link bad" data-ndel="${l.i}">🗑 احذف هذه المعلومة من العقل (إن كانت خاطئة أو لا حاجة إليها)</button>`;
      case "action": return head + `<p class="bm-note">ينظر البرنامج إلى الشعار وصور العلامة ويكتب السمة والأسلوب وشكل الشعار تلقائيًا.</p>
        <button class="bm-go" data-analyze ${b?.status === "working" ? "disabled" : ""}>${b?.status === "working" ? "جارٍ الاستنباط…" : "ابدأ الاستنباط"}</button>`;
    }
    return head;
  }
  // 🎬 صانع الإنترو والأوترو: حركة بالكود بلوجو العلامة وألوانها واسمها، بمعاينة حية، وزرار يرسمها فيديو ويحطها هنا (من غير نقط)
  const MK_OPTS = {
    intro: { style: [["assemble", "تجميع الشعار"], ["shine", "لمعة فاخرة"], ["letters", "كتابة الاسم"], ["wipe", "ستارة لونية"], ["pulse", "نبضة على الإيقاع"], ["glitch", "تشويش رقمي"], ["flip", "قلبة ثلاثية الأبعاد"]],
      textk: [["name", "الاسم"], ["tag", "الاسم والشعار"], ["none", "بدون نص"]] },
    outro: { style: [["cta", "دعوة لاتخاذ إجراء"], ["handles", "الحسابات"], ["follow", "تابعنا"], ["tagline", "الشعار والختام"]] },
  };
  const MK_BG = [["dark", "غامق"], ["light", "فاتح"], ["brand", "لون العلامة"]], MK_RATIO = [["9:16", "٩:١٦"], ["1:1", "١:١"], ["16:9", "١٦:٩"]];
  const MK_TXT = { intro: [["tag", "الشعار"]], outro: [["cta", "الدعوة"], ["handle", "الحساب"], ["link", "الموقع أو الرقم"], ["tag", "الشعار"]] };
  S.mk = S.mk || {};
  function mkState(b, kind) {
    const key = `${b.id}:${kind}`;
    if (!S.mk[key]) {
      S.mk[key] = { loading: true, opts: { kind, style: MK_OPTS[kind].style[0][0], bgk: "dark", ratio: "9:16", textk: "name" }, info: null };
      api(`/api/brand-reel-params/${b.id}?kind=${kind}`).then((r) => { const m = S.mk[key]; m.info = r; m.loading = false; Object.assign(m.opts, r.made || {}, { kind }); refreshCard(); if (r.job?.status === "working") mkPoll(b.id, kind); })
        .catch(() => { S.mk[key].loading = false; });
    }
    return S.mk[key];
  }
  function makerHTML(b, kind) {
    if (!b?.id || !MK_OPTS[kind]) return "";
    const m = mkState(b, kind), o = m.opts, T = kind === "intro" ? "الإنترو" : "الأوترو";
    const row = (k, xs) => `<div class="bm-pills">${xs.map(([v, t]) => `<button class="bm-pill${String(o[k]) === v ? " on" : ""}" data-mk="${kind}" data-mkk="${k}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}</div>`;
    if (m.loading || !m.info) return `<div class="bm-mk"><p class="bm-note">جارٍ تجهيز صانع ${T}…</p></div>`;
    const P = { ...m.info.params, ...Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== "kind" && v !== "")) };
    const [W, H] = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080] }[o.ratio] || [1080, 1920], bw = o.ratio === "16:9" ? 260 : o.ratio === "1:1" ? 210 : 170, sc = bw / W;
    const job = m.info.job, busy = job?.status === "working";
    const txt = (MK_TXT[kind] || []).map(([k, t]) => `<label class="bm-mkf"><small>${t}</small><input type="text" data-mkt="${kind}" data-mkk="${k}" value="${esc(o[k] ?? m.info.params[k] ?? "")}" placeholder="${esc(m.info.params[k] || "")}"></label>`).join("");
    return `<div class="bm-mk"><p class="bm-mkh">🎬 أو اصنع ${T} هنا بشعار العلامة وألوانها</p>
      <div class="bm-mkrow"><div class="bm-mkprev" style="width:${bw}px;height:${Math.round(H * sc)}px"><iframe title="معاينة ${T}" data-mkprev="${esc(b.id)}:${kind}" src="${esc(m.info.reel)}#p=${encodeURIComponent(JSON.stringify(P))}" style="width:${W}px;height:${H}px;transform:scale(${sc})" tabindex="-1"></iframe></div>
      <div class="bm-mkopts"><small>الحركة</small>${row("style", MK_OPTS[kind].style)}<small>الخلفية</small>${row("bgk", MK_BG)}${MK_OPTS[kind].textk ? `<small>النص</small>${row("textk", MK_OPTS[kind].textk)}` : ""}<small>المقاس</small>${row("ratio", MK_RATIO)}${txt}</div></div>
      ${busy ? `<p class="bm-note">⏳ جارٍ رسم الفيديو… ${Math.round((job.progress || 0) * 100)}٪</p>` : job?.status === "error" ? `<p class="bm-note bad">لم يكتمل: ${esc(job.error || "")}</p>` : ""}
      <button class="bm-go" data-mkgo="${kind}" ${busy ? "disabled" : ""}>🎬 اصنع ${T} وضعه هنا</button>
      <p class="bm-note">يُرسم بالكود دون ذكاء اصطناعي، فلا تُخصم نقاط. الاسم والألوان والشعار من العقل${kind === "outro" ? "، والدعوة والحساب من «التسليم»" : ""}. ${b[`${kind}_url`] ? "سيحلّ الفيديو الجديد محل الحالي." : ""}</p></div>`;
  }
  function mkPoll(bid, kind) {
    const key = `${bid}:${kind}`, m = S.mk[key];
    if (!m || m.polling) return;
    m.polling = true;
    const tick = async () => {
      try {
        const r = await api(`/api/brand-reel-params/${bid}?kind=${kind}`);
        m.info.job = r.job;
        if (r.job?.status === "working") { refreshCard(); return setTimeout(tick, 1500); }
        m.polling = false;
        if (r.job?.status === "error") { refreshCard(); return toast(r.job.error || "لم يكتمل", true); }
        toast(`✓ صُنع ${kind === "intro" ? "الإنترو" : "الأوترو"} ووُضع في العقل`);
        if (S.id === bid) save(() => bAPI(""));
      } catch (err) { m.polling = false; toast(err.message, true); }
    };
    setTimeout(tick, 1200);
  }
  // المعاينة: الصفحة نفسها بتترسم بالوقت (seek) في لوب
  (function mkLoop() {
    const t0 = performance.now();
    const step = () => {
      document.querySelectorAll("iframe[data-mkprev]").forEach((f) => { try { const w = f.contentWindow; if (w?.seek && w.DUR) w.seek(((performance.now() - t0) / 1000) % (w.DUR + .6)); } catch { /* لسه بيحمّل */ } });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  })();
  // 💡 الاقتراح جوه كارت الخانة: «استخدم الاقتراح» أو «تجاهل»، و«✨ اقترح» للخانات اللي المخ يقدر يقترحها (الخطوط)
  const SUGGEST = { typography: "✨ اقترح خطوطًا" };
  function suggBox(b, l) {
    const ps = l.sugg || [], from = (p) => (p.source === "suggest" ? "" : srcName(p.source));
    return ps.map((p) => `<div class="bm-sugg"><small>💡 اقتراح البرنامج${from(p) ? ` (من «${esc(from(p))}»)` : ""}</small><p>${esc(p.value)}</p>${p.why ? `<p class="bm-note">${esc(p.why)}</p>` : ""}
        <div class="bm-acts"><button class="bm-go" data-sugok="${esc(p.id)}">استخدم الاقتراح</button><button class="bm-pill" data-no="${esc(p.id)}">تجاهل</button></div></div>`).join("")
      + (SUGGEST[l.f] && !ps.length ? `<div class="bm-acts"><button class="bm-pill" data-suggest="${esc(l.f)}" ${S.suggBusy ? "disabled" : ""}>${S.suggBusy ? "⏳ جارٍ التفكير…" : SUGGEST[l.f]}</button></div>` : "");
  }
  function openCard(n) {
    if (n?.kind === "plan") { window.RV_FOCUS = "plan-only"; return window.NHNav?.("plan"); }
    if (n?.l?.type === "page" && n.l.page === "twin") return showStep("16");   // قسم تلقائيًا (غير صفحة داخل العقل)
    if (n?.l?.type === "page") { window.RV_FOCUS = n.l.page === "rivals" ? n.l.i : null; window.BL_TAB = n.l.page === "brainlib" ? String(n.l.i).split(":")[1] : null; return window.NHNav?.(n.l.page); }   // الشخصيات / التعليق / الموسيقى: صفحتها تفتح داخل العقل («رجوع» يرجّعك هنا)
    const card = S.el.querySelector(".bm-card");
    // 🧭 لحد ما العقل يفهمك ٣٠٪: «أكمل العقل» هو الشاشة الأساسية (كارت كبير في النص)، والخريطة خلفه
    S.el.classList.toggle("bm-wiz", n?.kind === "quiz" && (cur()?.knowledge?.score ?? 100) < 30);
    if (!n) { S.open = null; card.hidden = true; S.el.classList.remove("has-card"); markOpen(); return; }
    // رجوع: للكارت اللي كنت فيه قبل كده، ولو فتحت النقطة من الخريطة على طول فلفرعها
    if (S.open && S.open.id !== n.id && !S.backing) S.hist = [...(S.hist || []), S.open.id].slice(-12);
    if (!S.open) S.hist = [];
    S.backing = false;
    const same = S.open?.id === n.id;
    if (!same) { S.cardSide = null; S.cardAt = null; }
    S.open = { id: n.id, br: n.br?.k, n };
    const back = S.hist.length ? S.nodes.find((x) => x.id === S.hist[S.hist.length - 1]) : n.kind === "leaf" ? S.byId[n.br.k] : null;
    card.innerHTML = `<button class="bm-x" data-close aria-label="أغلق">✕</button>`
      + (back ? `<button class="bm-back" data-back="${esc(back.id)}">→ ${esc(back.kind === "branch" ? back.br.t : back.kind === "leaf" ? back.l.t : back.kind === "center" ? "العلامات" : "رجوع")}</button>` : "") + cardHTML(n);
    card.hidden = false;
    S.el.classList.add("has-card");
    markOpen();
    // يتحط في مكانه جنب النقطة الأول، وبعدين يظهر (الأنيميشن على الشفافية والحجم بس، مش على المكان)
    placeCard(toScreen([n.px, n.py]));
    // نفس الكارت بيتحدّث (السؤال اللي بعده مثلًا): من غير ما يختفي ويظهر تاني، المحتوى الجديد بس بيظهر بهدوء
    if (!same) card.animate([{ opacity: 0, scale: .96 }, { opacity: 1, scale: 1 }], { duration: reduce.matches ? 1 : 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    else if (n.kind === "quiz" && !reduce.matches) card.querySelectorAll(".bm-q, .bm-qans, .bm-q + .bm-pills, .bm-qstart").forEach((x) => x.animate([{ opacity: .35, translate: "0 6px" }, { opacity: 1, translate: "0 0" }], { duration: 220, easing: "ease-out" }));
    const ed = card.querySelector(".bm-write");
    if (ed && n.kind === "leaf") { ed.focus(); placeCaret(ed); }
  }
  function markOpen() { S.el.querySelectorAll(".bm-n.on").forEach((x) => x.classList.remove("on")); if (S.open?.n?.el) S.open.n.el.classList.add("on"); }
  const placeCaret = (el) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  // الكارت جنب النقطة من الناحية البعيدة عن المخ، ومبيطلعش برّه الخريطة
  function placeCard(p) {
    const card = S.el.querySelector(".bm-card");
    if (!p || card.hidden) return;
    if (S.el.classList.contains("bm-wiz")) { card.style.transform = ""; S.cardAt = null; return; }   // في النص بالـ CSS
    const W = S.el.clientWidth, H = S.el.clientHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    // الناحية (يمين/شمال النقطة) بتتحدد مرة واحدة لما الكارت يفتح، فمش بيقفز من ناحية للتانية
    if (S.cardSide == null) {
      let r = p[0] >= W / 2;
      if (r && p[0] + 34 + cw > W - 8) r = false;
      if (!r && p[0] - 34 - cw < 8) r = true;
      S.cardSide = r;
    }
    let x = S.cardSide ? p[0] + 34 : p[0] - 34 - cw;
    x = Math.max(8, Math.min(W - cw - 8, x));
    const top = topInset();
    const y = Math.max(top, Math.min(H - ch - 8, p[1] - ch / 2));
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (S.cardAt === k) return;
    S.cardAt = k;
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  const refreshCard = () => { if (S.open) { const n = S.nodes.find((x) => x.id === S.open.id) || (S.open.id === "c" ? S.nodes[0] : null); S.backing = true; if (n) openCard(n); else openCard(null); } };

  // ---------- الحفظ ----------
  async function save(fn, { card = true } = {}) {
    try {
      const b = await fn();
      S.brains = S.brains.map((x) => (x.id === b.id ? b : x));
      if (S.tqFor === b.id) S.tqFor = null;   // المهام تُحسب مرة أخرى (يمكن تكون واحدة أُنشئت)
      if (S.plFor === b.id) S.plFor = null;   // وعدّاد خطة المحتوى (ويمكن تُبنى تلقائيًا)
      const keep = S.open && S.el.querySelector(".bm-card").contains(document.activeElement) && document.activeElement.matches(".bm-write");
      layout();
      if (S.open) {
        const n = S.nodes.find((x) => x.id === S.open.id);
        if (n) { S.open.n = n; markOpen(); if (card && !keep) refreshCard(); }
      }
      if (busy(b)) watch();
      loadClients();
      return true;
    } catch (err) { toast(err.message, true); return false; }
  }
  // مصدر جديد (ملف / لينك / كلام): بيتقرا في الخلفية والاقتراحات بتظهر لوحدها
  function addSource(form) {
    toast("⏳ جارٍ القراءة… ستظهر الاقتراحات على الخريطة");
    return save(() => bAPI("/sources", { method: "POST", body: form }));
  }
  const busy = (b) => b?.status === "working" || (b?.sources || []).some((s) => s.status === "working");
  function watch() {
    clearInterval(S.poll);
    S.poll = setInterval(async () => {
      if (!S.el?.isConnected) return clearInterval(S.poll);
      try {
        const b = await bAPI("");
        S.brains = S.brains.map((x) => (x.id === b.id ? b : x));
        if (!busy(b)) { clearInterval(S.poll); S.qaFor = null; loadClients(); layout(); if (S.open && !S.el.querySelector(".bm-card").contains(document.activeElement)) refreshCard(); return; }
        layout();
        if (S.open?.id === "add" || (S.open?.id === "quiz" && !S.el.querySelector(".bm-card").contains(document.activeElement))) refreshCard();   // خطوة التحليل الحالية
      } catch { clearInterval(S.poll); }
    }, 3000);
  }
  // ✅ أي تعديل في العقل بيطلع فوقه رسالة صغيرة إنه اتحفظ (ومن إيه لإيه لو الكلام قصير)، وبتختفي لوحدها
  function fieldLabel(k) {
    if (k === "rules") return "القواعد";
    if (k === "styles" || k === "style") return "الأسلوب";
    for (const br of branches(cur())) for (const l of br.leaves) {
      if (l.f === k) return l.t;
      const m = (l.fields || []).find(([f]) => f === k);
      if (m) return m[1].replace(/\s*\(.*\)$/, "");
    }
    return FIELD_T[k] || "المعلومة";
  }
  const shortV = (k, v, b) => { if (k === "styles") return styleIds({ ...b, styles: v }).map((id) => allStyles(b).find((c) => c.id === id)?.ar).filter(Boolean).join("، ");
    const l = branches(b).flatMap((br) => br.leaves).find((x) => x.f === k && x.type === "pick"); return l ? l.opts.find(([o]) => o === String(v))?.[1] || "" : String(v ?? "").trim(); };
  function savedMsg(fields, name, before) {
    if (name != null) return `✅ حُدّث اسم العلامة إلى «${name}»`;
    const ks = Object.keys(fields || {});
    if (!ks.length) return "";
    if (ks.length > 1) return `✅ حُفظ: ${ks.map(fieldLabel).join("، ")}`;
    const k = ks[0], t = fieldLabel(k);
    if (k === "rules") return "✅ حُدّثت القواعد";
    const a = shortV(k, before?.[k], before), z = shortV(k, fields[k], before);
    if (!z) return `✅ حُذف «${t}»`;
    if (a && a.length <= 40 && z.length <= 40) return `✅ حُدّث «${t}» من «${a}» إلى «${z}»`;
    return `✅ حُدّث «${t}»`;
  }
  function savedPill(msg) {
    if (!msg || !S.el) return;
    let el = document.querySelector("body > .bm-saved");   // على الـ body لكي لا يُغطّى أسفل عنوان الصفحة
    if (!el) { el = document.createElement("div"); el.className = "bm-saved"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    clearTimeout(S.savedT); S.savedT = setTimeout(() => el.classList.remove("show"), 2600);
  }
  const patch = async (fields, name, opts) => {
    const before = cur() ? { ...cur() } : null;
    const ok = await save(() => bAPI("", { method: "PATCH", ...jsonBody(name != null ? { name, fields } : { fields }) }), opts);
    if (ok) savedPill(savedMsg(fields, name, before));
    return ok;
  };
  // الكتابة بتتحفظ لوحدها بعد ما تقف شوية
  let typeT = null;
  function commit(el) {
    clearTimeout(typeT);
    const k = el.dataset.k, v = el.innerText.replace(/ /g, " ").trim();
    const b = cur();
    if (!b || k.startsWith("@") && k !== "@name" || k === "rule:new") return;
    if (k.startsWith("ar:")) {
      const [, fid, i] = k.split(":"), rows = arRows(fid);
      if (!rows[+i] || rows[+i].t === v || !v) return;
      rows[+i].t = v;
      return algoSave(fid, rows);
    }
    if (k.startsWith("note:")) {
      const [, part, id] = k.split(":"), n = (b.notes || []).find((x) => x.id === id);
      const key = { t: "title", s: "summary", b: "body" }[part];
      if (!n || (n[key] || "") === v || (part === "t" && !v)) return;
      return save(() => bAPI(`/notes/${id}`, { method: "PATCH", ...jsonBody({ [key]: v }) }), { card: false }).then((ok) => ok && savedPill(`✅ حُدّثت «${n.title || "المعلومة"}»`));
    }
    if (k.startsWith("rule:")) {
      const rs = rulesOf(b), i = +k.slice(5);
      if (rs[i] === v) return;
      if (v) rs[i] = v; else rs.splice(i, 1);
      return patch({ rules: rs.join("\n") }, null, { card: !v });
    }
    if (k === "@name") return v && v !== b.name ? patch({}, v, { card: false }) : null;
    if (String(b[k] || "").trim() === v) return;
    return patch({ [k]: v }, null, { card: false });
  }
  const upload = (kind, files) => {
    const imgs = [...files].filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
    if (!imgs.length) return toast("لا توجد صور (PNG / JPG / WEBP)", true);
    const form = new FormData();
    form.append("kind", kind);
    imgs.slice(0, 120).forEach((f) => form.append("files", f));
    toast(`⏳ جارٍ رفع ${imgs.length} صورة…`);
    return save(() => bAPI("/assets", { method: "POST", body: form }));
  };

  function hover(k, leaf) {
    if (S.hov === k && S.hovLeaf === leaf) return;
    S.hov = k; S.hovLeaf = leaf;
    S.el.classList.toggle("hovering", !!k);
    for (const n of S.nodes) {
      const mine = !!k && (n.id === k || n.br?.k === k || n.id === "c");
      n.el?.classList.toggle("hl", mine);
      n.line?.classList.toggle("hl", mine && (n.kind === "branch" || !leaf || n.id === leaf));
      n.beadG?.classList.toggle("hl", n.id === k);
    }
  }
  // الماوس على نقطة أو فرع: الدراع كله بينوّر واللي حواليه يهدى.
  // بالمسافة مش بـ :hover: النقطة بتتحرك ناحية الماوس وبتعوم، فلو اعتمدنا على اللي تحت الماوس بالظبط كانت بتطلع وتدخل كل فريم (رعشة).
  // النقطة اللي اتمسكت بتفضل ماسكة لحد ما الماوس يبعد عنها ضعف المسافة تقريبًا.
  const HOT_R = { leaf: 20, branch: 46 };
  function pickHover(target) {
    if (target?.closest?.(".bm-card, .bm-zoom")) return setHot(null);
    const m = S.mw, d = (n) => Math.hypot(m[0] - n.px, m[1] - n.py);
    const cur = S.hovNode;
    if (cur && d(cur) < HOT_R[cur.kind] * 1.9) return;
    let best = null, bd = 1e9;
    for (const n of S.nodes) {
      if (n.kind !== "leaf" && n.kind !== "branch") continue;
      const k = d(n);
      if (k < HOT_R[n.kind] && k < bd) { best = n; bd = k; }
    }
    setHot(best);
  }
  function setHot(n) {
    if (S.hovNode === n) return;
    S.hovNode?.el?.classList.remove("hot");
    S.hovNode = n;
    n?.el?.classList.add("hot");
    S.el.classList.toggle("hotting", !!n);
    hover(n?.kind === "branch" ? n.id : n?.kind === "leaf" ? n.br.k : null, n?.kind === "leaf" ? n.id : null);
  }
  function bind(w) {
    // مسك وسحب أي نقطة أو فرع أو المخ نفسه
    w.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const el = e.target.closest(".bm-n"), r = w.getBoundingClientRect();
      // سحب الخلفية بيحرّك الخريطة كلها
      if (!el) {
        if (!S.view || e.target.closest(".bm-card, .bm-zoom")) return;
        S.pan = { sx: e.clientX, sy: e.clientY, x: S.view.x, y: S.view.y, id: e.pointerId, moved: false };
        return;
      }
      const n = S.byId[el.dataset.n];
      if (!n) return;
      const [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
      S.drag = { n, el, sx: e.clientX, sy: e.clientY, ox: n.px - wx, oy: n.py - wy, x: n.px, y: n.py, moved: false, id: e.pointerId };
    });
    w.addEventListener("wheel", (e) => {
      if (e.target.closest(".bm-card")) return;
      e.preventDefault();
      const r = w.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    w.querySelector(".bm-zoom").addEventListener("click", (e) => {
      const z = e.target.closest("[data-zoom]");
      if (!z) return;
      e.stopPropagation();
      if (z.dataset.zoom === "0") { fit(true); return; }
      zoomAt(z.dataset.zoom === "1" ? 1.25 : .8, w.clientWidth / 2, w.clientHeight / 2);
    });
    w.addEventListener("pointermove", (e) => {
      if (S.view && e.pointerType !== "touch") { const r = w.getBoundingClientRect(); S.mw = toWorld(e.clientX - r.left, e.clientY - r.top); if (!S.pan?.moved && !S.drag?.moved) pickHover(e.target); }
      if (S.dv && e.pointerType !== "touch") { const r = w.getBoundingClientRect(); S.dv.tx = e.clientX - r.left; S.dv.ty = e.clientY - r.top; if (S.dv.a < .01) { S.dv.mx = S.dv.tx; S.dv.my = S.dv.ty; } S.dv.ta = 1; }
      const pn = S.pan;
      if (pn && e.pointerId === pn.id) {
        if (!pn.moved && Math.hypot(e.clientX - pn.sx, e.clientY - pn.sy) < 4) return;
        if (!pn.moved) { pn.moved = true; w.setPointerCapture(e.pointerId); w.classList.add("panning"); }
        S.view.x = pn.x + e.clientX - pn.sx; S.view.y = pn.y + e.clientY - pn.sy; S.view.user = true;
        applyView();
        return;
      }
      const d = S.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      if (!d.moved) { d.moved = true; w.setPointerCapture(e.pointerId); w.classList.add("dragging"); d.el.classList.add("held"); }
      const r = w.getBoundingClientRect(), [wx, wy] = toWorld(e.clientX - r.left, e.clientY - r.top);
      d.x = wx + d.ox; d.y = wy + d.oy;
    });
    const drop = (e) => {
      if (S.pan && (e.pointerId == null || e.pointerId === S.pan.id)) {
        if (S.pan.moved) { S.noClick = true; setTimeout(() => (S.noClick = false), 0); w.classList.remove("panning"); }
        S.pan = null;
      }
      const d = S.drag;
      if (!d || (e.pointerId != null && e.pointerId !== d.id)) return;
      S.drag = null;
      if (d.moved) { S.noClick = true; setTimeout(() => (S.noClick = false), 0); w.classList.remove("dragging"); d.el.classList.remove("held"); }
    };
    w.addEventListener("pointerleave", () => { if (S.dv) S.dv.ta = 0; S.mw = null; setHot(null); });
    w.addEventListener("pointerup", drop);
    w.addEventListener("pointercancel", drop);
    w.addEventListener("click", async (e) => {
      const t = e.target;
      if (S.noClick) { S.noClick = false; return; }
      if (t.closest("[data-know]")) { e.stopPropagation(); return window.uiKnow?.(cur()?.knowledge); }
      const node = t.closest(".bm-n") || (S.hovNode && !t.closest(".bm-card, .bm-zoom") ? S.hovNode.el : null);
      if (node) {
        const n = S.nodes.find((x) => x.id === node.dataset.n);
        if (!n) return;
        if (S.open?.id === n.id) return openCard(null);
        // 🎙️ دايرة «؟» هي المساعد نفسه: بيسأل أسئلة العقل وبيطلب الرفع (الشعار والصور) بالصوت أو بالكتابة
        if (n.kind === "quiz" && typeof Assistant !== "undefined") { openCard(null); return Assistant.open(node).then((ok) => { if (!ok) { S.qi = null; openCard(n); } }); }
        if (n.kind === "quiz") S.qi = null;
        if (n.kind === "add" && !S.open) S.addTab = S.addTab || "file";
        if (n.kind === "leaf" && n.l.type === "action") return openCard(n);
        return openCard(n);
      }
      if (t.closest("[data-close]")) return openCard(null);
      if (t.closest("[data-ibrec]")) return toggleRec();
      if (t.closest("[data-bstart]")) return brandStart();
      if (t.closest("[data-qnext]")) return quizStep(1);
      const trb = t.closest("[data-trnow], [data-trsave]");
      if (trb) {
        const now = !!trb.dataset.trnow, id = trb.dataset.trnow || trb.dataset.trsave;
        try { S.tr = await bAPI(`/trends/${id}/save`, { method: "POST", ...jsonBody({ now }) }); redrawNode("trends"); } catch (err) { return toast(err.message, true); }
        if (!now) { toast("🔖 حُفظ. سيظهر لك عند اختيار الفكرة في أي قالب"); return refreshCard(); }
        toast("✨ اختر القالب، وستُبنى الفكرة على هذا الترند");
        openCard(null);
        return window.NHNav?.("create");
      }
      const trd = t.closest("[data-trdel]");
      if (trd) { if (!(await uiConfirm("أتحذف هذا الترند من القائمة؟"))) return; try { S.tr = await bAPI(`/trends/${trd.dataset.trdel}`, { method: "DELETE" }); redrawNode("trends"); refreshCard(); } catch (err) { toast(err.message, true); } return; }
      if (t.closest("[data-trref]")) { try { S.tr = await bAPI("/trends/refresh", { method: "POST" }); redrawNode("trends"); refreshCard(); S.trFor = null; loadTrends(cur()); } catch (err) { toast(err.message, true); } return; }
      const aro = t.closest("[data-aron]");
      if (aro) { const [fid, i] = aro.dataset.aron.split(":"), rows = arRows(fid); rows[+i].on = aro.checked; return algoSave(fid, rows); }
      const ard = t.closest("[data-ardel]");
      if (ard) { if (!(await uiConfirm("أتحذف هذه القاعدة؟ (يمكنك إرجاعها بـ «استعد الأصل»)"))) return; const [fid, i] = ard.dataset.ardel.split(":"), rows = arRows(fid); rows.splice(+i, 1); return algoSave(fid, rows); }
      const ara = t.closest("[data-aradd]");
      if (ara) { const v = (await uiPrompt("القاعدة الجديدة:")); if (!v?.trim()) return; const rows = arRows(ara.dataset.aradd); rows.push({ t: v.trim(), on: true }); return algoSave(ara.dataset.aradd, rows); }
      const arr = t.closest("[data-arreset]");
      if (arr) { if (!(await uiConfirm(arr.dataset.arreset === "all" ? "أتعيد كل قواعد الخوارزميات إلى الأصل؟ سيُحذف أي تعديل أجريته." : "أتعيد هذه القواعد إلى الأصل؟"))) return; return algoSave(arr.dataset.arreset, null, true); }
      const qt = t.closest("[data-qtab]");
      if (qt) { S.qtab = qt.dataset.qtab; if (S.qtab === "t") { const b = cur(); if (b) { S.tqFor = null; loadTasks(b); } } return refreshCard(); }
      const tg = t.closest("[data-tgo]");
      if (tg) {
        const go = JSON.parse(tg.dataset.tgo);
        if (go.page) { S.tqFor = null; window.BL_TAB = go.tab || null; return window.NHNav?.(go.page); }
        const ln = S.nodes.find((x) => x.id === go.leaf);
        S.tqFor = null;
        return ln ? openCard(ln) : toast("لم أجد هذه النقطة في الخريطة", true);
      }
      if (t.closest("[data-qskip]")) { S.qi += 1; return refreshCard(); }
      if (t.closest("[data-qprev]")) return quizStep(-1);
      const qp = t.closest("[data-qpick]");
      if (qp) return quizStep(1, qp.dataset.qpick);
      const qg = t.closest("[data-qgo]");
      if (qg) { const done = new Set(cur()?.quiz_done || []); S.qi = qg.dataset.qgo === "first" ? Math.max(0, S.quiz.findIndex((q) => !done.has(q.id))) : +qg.dataset.qgo; return refreshCard(); }
      const td = t.closest("[data-tdone]");
      if (td) return save(() => bAPI(`/todos/${td.dataset.tdone}`, { method: "PATCH", ...jsonBody({ done: !!td.dataset.v }) }));
      const tdl = t.closest("[data-tdel]");
      if (tdl) { if ((await uiConfirm("أتزيل هذه النقطة؟"))) { openCard(null); save(() => bAPI(`/todos/${tdl.dataset.tdel}`, { method: "DELETE" })); } return; }
      if (t.closest("[data-socialgo]")) { S.addTab = "social"; const a = S.nodes.find((x) => x.id === "add"); if (a) { openCard(a); S.el.querySelector('.bm-card [data-k="@social"]')?.focus(); } return; }
      const itg = t.closest("[data-itgt]");
      if (itg) { if (S.imgTarget) S.imgTarget.t = itg.dataset.itgt; S.el.querySelectorAll(".bm-card [data-itgt]").forEach((x) => x.classList.toggle("on", x === itg)); return; }
      const bk = t.closest("[data-back]");
      if (bk) {
        const to = S.nodes.find((x) => x.id === bk.dataset.back);
        if (S.hist?.[S.hist.length - 1] === bk.dataset.back) S.hist.pop();
        S.backing = true;
        return openCard(to || null);
      }
      const go = t.closest("[data-go]");
      if (go) return openCard(S.nodes.find((x) => x.id === go.dataset.go));
      const br = t.closest("[data-brain]");
      if (br) { S.id = br.dataset.brain; openCard(null); layout(); return; }
      if (t.closest("[data-del]")) {
        const b = cur();
        if (!b || !(await uiConfirm(`أتحذف «${b.name}» بكل صوره؟`))) return;
        try { await api(`/api/ad-brains/${b.id}`, { method: "DELETE" }); openCard(null); await load(); loadClients(); } catch (err) { toast(err.message, true); }
        return;
      }
      const tab = t.closest("[data-tab]");
      if (tab) { S.addTab = tab.dataset.tab; refreshCard(); S.el.querySelector(".bm-card .bm-write")?.focus(); return; }
      const ok = t.closest("[data-ok]");
      if (ok) {
        const card = S.el.querySelector(".bm-card"), val = card.querySelector('[data-k="@val"], [data-k="@ans"]')?.innerText.trim(), ttl = card.querySelector('[data-k="@ttl"]')?.innerText.trim();
        openCard(null);
        return save(() => bAPI(`/pending/${ok.dataset.ok}/approve`, { method: "POST", ...jsonBody({ value: val ?? null, title: ttl ?? null, target: S.imgTarget?.id === ok.dataset.ok ? S.imgTarget.t : null }) }));
      }
      const sok = t.closest("[data-sugok]");
      if (sok) {
        const p = (cur()?.pending || []).find((x) => x.id === sok.dataset.sugok), before = cur() ? { ...cur() } : null;
        if (await save(() => bAPI(`/pending/${sok.dataset.sugok}/approve`, { method: "POST", ...jsonBody({ value: p?.value ?? null, title: null, target: null }) }), { card: true }) && p)
          savedPill(savedMsg({ [p.field]: p.value }, null, before));
        return;
      }
      const sgg = t.closest("[data-suggest]");
      if (sgg) { S.suggBusy = true; refreshCard(); try { await save(() => bAPI(`/suggest/${sgg.dataset.suggest}`, { method: "POST" })); } finally { S.suggBusy = false; refreshCard(); } return; }
      const no = t.closest("[data-no]");
      if (no) { if (!no.closest(".bm-sugg")) openCard(null); return save(() => bAPI(`/pending/${no.dataset.no}`, { method: "DELETE" })); }
      const sdel = t.closest("[data-sdel]");
      if (sdel) { if ((await uiConfirm("أتزيل هذا المصدر واقتراحاته التي ما زالت بانتظارك؟"))) save(() => bAPI(`/sources/${sdel.dataset.sdel}`, { method: "DELETE" })); return; }
      if (t.closest("[data-seasons]")) {
        try { await bAPI("/seasons", { method: "POST" }); toast("🗓️ يجلب العقل المواسم… ستُحدَّث هنا بعد قليل"); } catch (err) { return toast(err.message, true); }
        const id = S.id; setTimeout(() => { if (S.id === id) save(() => bAPI("")); }, 15000);
        return;
      }
      const ndel = t.closest("[data-ndel]");
      if (ndel) { if ((await uiConfirm("أتحذف هذه المعلومة؟ لن يعرفها العقل بعد الآن ولن يستخدمها في أي كتابة جديدة. (ما أُنشئ سابقًا لن يتغير)"))) { openCard(null); save(() => bAPI(`/notes/${ndel.dataset.ndel}`, { method: "DELETE" })); } return; }
      const pick = t.closest("[data-pick]");
      if (pick) return patch({ [pick.dataset.pick]: pick.dataset.v });
      const mk = t.closest("[data-mk]");
      if (mk) { const m = S.mk[`${cur()?.id}:${mk.dataset.mk}`]; if (m) { m.opts[mk.dataset.mkk] = mk.dataset.v; refreshCard(); } return; }
      const mkgo = t.closest("[data-mkgo]");
      if (mkgo) {
        const b = cur(), kind = mkgo.dataset.mkgo, m = S.mk[`${b?.id}:${kind}`];
        if (!m) return;
        S.el.querySelectorAll(`[data-mkt="${kind}"]`).forEach((x) => { m.opts[x.dataset.mkk] = x.value.trim(); });
        try { const r = await api(`/api/ad-brains/${b.id}/brand-video/make`, { method: "POST", ...jsonBody(m.opts) }); m.info.job = r.job; refreshCard(); mkPoll(b.id, kind); }
        catch (err) { toast(err.message, true); }
        return;
      }
      const von = t.closest("[data-von]");
      if (von) return patch({ [`${von.dataset.von}_on`]: von.dataset.v });
      const vdel = t.closest("[data-vdel]");
      if (vdel) { if ((await uiConfirm("أتزيل هذا الفيديو؟"))) save(() => bAPI(`/brand-video/${vdel.dataset.vdel}`, { method: "DELETE" })); return; }
      const audRows = () => [...S.el.querySelectorAll(".bm-aud")].map((r) => Object.fromEntries([...r.querySelectorAll("[data-audk]")].map((x) => [x.dataset.audk, x.value.trim()])));
      if (t.closest("[data-audx]")) { toast("⏳ يستخلص العقل الجماهير…"); return save(() => bAPI("/audiences/extract", { method: "POST" })); }
      if (t.closest("[data-audsave]")) return save(() => bAPI("/audiences", { method: "PUT", ...jsonBody({ items: audRows().filter((a) => a.name) }) })).then((ok) => ok && toast("✓ حُفظت الجماهير"));
      if (t.closest("[data-audadd]")) { const rows = audRows(); rows.push({ name: "جمهور جديد", who: "", pain: "", want: "", share: "" }); return save(() => bAPI("/audiences", { method: "PUT", ...jsonBody({ items: rows }) })); }
      const audd = t.closest("[data-auddel]");
      if (audd) { const rows = audRows(); rows.splice(+audd.dataset.auddel, 1); return save(() => bAPI("/audiences", { method: "PUT", ...jsonBody({ items: rows }) })); }
      const rdel = t.closest("[data-rdel]");
      if (rdel) { const rs = rulesOf(cur()); rs.splice(+rdel.dataset.rdel, 1); openCard(null); return patch({ rules: rs.join("\n") }); }
      const hdel = t.closest("[data-hdel]");
      if (hdel) return patch({ palette: String(cur()?.palette || "").replace(new RegExp(`${hdel.dataset.hdel}[^,\\n]*[,\\n]?\\s*`, "i"), "").trim() });
      if (t.closest("[data-analyze]")) return save(() => bAPI("/analyze", { method: "POST" }));
      const fig = t.closest("[data-file]");
      if (fig && t.closest("[data-adel]")) { if ((await uiConfirm("تحذف هذه الصورة؟"))) save(() => bAPI(`/assets/${encodeURIComponent(fig.dataset.file)}`, { method: "DELETE" })); return; }
      // دوسة في الفاضي بتقفل الكارت
      if (!t.closest(".bm-card")) openCard(null);
    });
    w.addEventListener("input", (e) => {
      const el = e.target.closest(".bm-write");
      if (!el || (el.dataset.k.startsWith("@") && el.dataset.k !== "@name") || el.dataset.k === "rule:new") return;
      clearTimeout(typeT);
      typeT = setTimeout(() => commit(el), 900);
    });
    w.addEventListener("focusout", (e) => { const el = e.target.closest?.(".bm-write"); if (el) commit(el); });
    w.addEventListener("keydown", async (e) => {
      const el = e.target.closest?.(".bm-write");
      if (!el || e.key !== "Enter" || e.shiftKey) return;
      const k = el.dataset.k, v = el.innerText.trim();
      if (k === "@new") {
        e.preventDefault();
        if (!v) return;
        try {
          const b = await api("/api/ad-brains", { method: "POST", ...jsonBody({ name: v, fields: {} }) });
          S.brains.push(b); S.id = b.id; await api("/api/clients/active", { method: "PUT", ...jsonBody({ id: b.id }) }).catch(() => {});
          openCard(null); layout(); loadClients(); if (S.byId?.quiz) openCard(S.byId.quiz);
        } catch (err) { toast(err.message, true); }
        return;
      }
      if (k === "@bname" || k === "@blink") { e.preventDefault(); return brandStart(); }
      if (k === "@quiz") { if (!el.classList.contains("multi")) { e.preventDefault(); quizStep(1); } return; }
      if (k === "@url" || k === "@text" || k === "@social") {
        e.preventDefault();
        if (!v) return;
        const form = new FormData();
        form.append(k === "@url" ? "url" : k === "@social" ? "social" : "text", v);
        el.textContent = "";
        el.blur();
        return addSource(form);
      }
      if (k === "@ans") { e.preventDefault(); return S.el.querySelector("[data-ok]")?.click(); }
      if (k === "rule:new") {
        e.preventDefault();
        if (!v) return;
        const rs = rulesOf(cur());
        rs.push(v);
        el.textContent = "";
        return patch({ rules: rs.join("\n") }, null, { card: false });
      }
      // الخانات القصيرة: Enter بيحفظ ويقفل
      if (!/about|audience|caption|palette|rules|theme|style|description/.test(k)) { e.preventDefault(); commit(el); openCard(null); }
    });
    w.addEventListener("change", (e) => {
      const el = e.target;
      if (el.dataset.up) { const f = el.files; upload(el.dataset.up, f); el.value = ""; return; }
      if (el.matches("[data-src]")) { const form = new FormData(); [...el.files].forEach((f) => form.append("files", f)); el.value = ""; return addSource(form); }
      if (el.dataset.hadd != null && el.matches("[data-hadd]")) {
        const b = cur(), p = String(b?.palette || "").trim();
        return patch({ palette: p ? `${p}, ${el.value.toUpperCase()}` : el.value.toUpperCase() });
      }
      if (el.dataset.mkt) { const m = S.mk[`${cur()?.id}:${el.dataset.mkt}`]; if (m) { m.opts[el.dataset.mkk] = el.value.trim(); refreshCard(); } return; }
      if (el.dataset.vup) {
        const f = el.files[0];
        el.value = "";
        if (!f) return;
        const form = new FormData();
        form.append("kind", el.dataset.vup);
        form.append("file", f);
        toast("⏳ جارٍ رفع الفيديو…");
        return save(() => bAPI("/brand-video", { method: "POST", body: form }));
      }
    });
    // سحب صور ورميها على كارت الصور
    // سحب ملفات ورميها: على كارت الصور بتروح للصور، وفي أي حتة تانية في الخريطة بتروح للمخ يقراها
    const files = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    const toImgs = (e) => e.target.closest(".bm-card") && S.open?.n?.l?.type === "imgs";
    w.addEventListener("dragover", (e) => {
      if (!files(e)) return;
      e.preventDefault();
      const img = toImgs(e);
      S.el.querySelector(".bm-card").classList.toggle("drop", !!img);
      S.el.classList.toggle("dropping", !img);
    });
    w.addEventListener("dragleave", (e) => { if (!e.relatedTarget || !w.contains(e.relatedTarget)) { S.el.classList.remove("dropping"); S.el.querySelector(".bm-card").classList.remove("drop"); } });
    w.addEventListener("drop", (e) => {
      S.el.classList.remove("dropping");
      S.el.querySelector(".bm-card").classList.remove("drop");
      if (!files(e)) return;
      e.preventDefault();
      if (toImgs(e)) return upload(S.open.n.l.f, e.dataTransfer.files);
      const form = new FormData(); [...e.dataTransfer.files].slice(0, 10).forEach((f) => form.append("files", f));
      return addSource(form);
    });
    new ResizeObserver(() => { dotsSize(); layout(); }).observe(w);
    // لو الثيم اتغيّر (فاتح/غامق) النقط بتترسم من جديد بلونه
    if (!S.mo) (S.mo = new MutationObserver(() => { if (S.dv) S.dv.key = ""; dotsSize(); })).observe(document.documentElement, { attributes: true, attributeFilter: ["data-nh-theme"] });
  }
  // Esc بيقفل الكارت الأول (قبل ما يرجع من الصفحة)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && S.open && S.el?.isConnected) { e.preventDefault(); openCard(null); }
  }, true);

  async function load() {
    const [brains, cats] = await Promise.all([api("/api/ad-brains"), S.cats ? S.cats : api("/api/style-cats").catch(() => [])]);
    S.brains = brains;
    S.cats = cats;
    if (!S.brains.some((b) => b.id === S.id)) S.id = clientx?.active || S.brains[0]?.id || null;
    layout();
    if (busy(cur())) watch();
  }

  // 🎙️ وقت المكالمة: كل ما العقل يتغيّر الخريطة تتحدث لوحدها (والفرع الجديد يطلع بالحركة)، والكرة على اليمين بتاخد مكانها
  let reT = 0;
  window.addEventListener("brain:changed", () => {
    clearTimeout(reT);
    reT = setTimeout(async () => {
      if (!S.el?.isConnected || !S.id) return;
      try { const b = await bAPI(""); S.brains = S.brains.map((x) => (x.id === b.id ? b : x)); layout(); if (busy(b)) watch(); } catch { /* الخريطة هتتحدث المرة الجاية */ }
    }, 400);
  });
  // 🎙️ المساعدة بتفتح/تقفل على اليمين: الخريطة بتتزحلق وتصغر/تكبر على مهلها مع الكرة (مش نطّة واحدة)
  window.addEventListener("assistant:dock", (e) => { S.reserve = e.detail?.w || 0; S.docked = !!e.detail?.on; if (S.el?.isConnected && S.nodes) fit(true, 1100); });
  async function mount(root, id) {
    const w = root.querySelector("#nbWrap");
    if (!w) return;
    S.el = w;
    S.open = null;
    S.id = id || clientx?.active || S.id;
    w.innerHTML = skeleton();
    S.dv = null; S.beads = null; S.view = null; S.hov = null;
    bind(w);
    dotsSize();
    try { await load(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; return; }
    if (!S.raf) S.raf = requestAnimationFrame(loop);
    // 🎙️ دايرة «؟» باسم المساعدة (سعاد في المصري…) لو المساعدة الصوتية شغالة
    if (typeof Assistant !== "undefined" && !S.agent) api("/api/assistant").then((a) => { if (a?.ready && a.agents?.[0]) { S.agent = a.agents[0]; layout(); } }).catch(() => {});
    // من غير المساعدة الصوتية: «أكمل العقل» بيفتح لوحده في الأول. معاها، الخريطة تفضل فاضية قدامه ودايرة «؟» هي المساعدة
    if (typeof Assistant === "undefined" && (cur()?.knowledge?.score ?? 100) < 30 && S.byId?.quiz) openCard(S.byId.quiz);
    // أول ما الخريطة تفتح: النقط بتطلع من المخ لبرّه
    if (!reduce.matches) S.nodes.forEach((n, i) => n.el?.animate([{ opacity: 0, translate: `${S.nodes[0].x - n.x}px ${S.nodes[0].y - n.y}px`, scale: .3 }, { opacity: 1, translate: "0 0", scale: 1 }],
      { duration: 700, delay: n.kind === "center" ? 0 : n.kind === "branch" ? 120 : 260 + (i % 9) * 25, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
  }
  return { html, mount, styleIds: (b) => styleIds(b), cats: () => S.cats };
})();

// ⭐ تقييم أي نتيجة (سكريبت، فيديو…): «ممتاز» بيبقى مثال في عقل العلامة، والملاحظة اللي بتتكرر بتتحول لقاعدة مقترحة.
// كل ده بيظهر نقط منوّرة على خريطة العقل ومحتاج موافقتك.
const BrainRate = (() => {
  const KEY = "studiomania.rated";
  const seen = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const mark = (ref, v) => { try { const s = seen(); s[ref] = v; localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const thumb = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function html({ kind = "", what = "", ref = "", text = "", compact = false }) {
    const v = ref ? seen()[ref] : "";
    return `<div class="br-rate${compact ? " compact" : ""}" data-kind="${escapeHtml(kind)}" data-what="${escapeHtml(what)}" data-ref="${escapeHtml(ref)}" data-text="${escapeHtml(text)}">
      ${compact ? "" : `<span class="br-q">ما رأيك في هذه النتيجة؟</span>`}
      <button type="button" data-rv="great" class="${v === "great" ? "on" : ""}" title="ممتاز (سيتعلم منها)">★${compact ? "" : " ممتاز"}</button>
      <button type="button" data-rv="bad" class="${v === "bad" ? "on" : ""}" title="لم تعجبني (أخبره)">${thumb}${compact ? "" : " لم تعجبني"}</button>
      <div class="br-why" hidden><div class="br-write" contenteditable="plaintext-only" data-ph="ماذا الذي لم يعجبك؟ مثلًا: الجمل طويلة"></div><button type="button" data-rsend>أرسل</button></div>
    </div>`;
  }
  async function send(box, rating, note = "") {
    try {
      const r = await api("/api/feedback", { method: "POST", ...jsonBody({ rating, note, what: box.dataset.what, text: box.dataset.text, kind: box.dataset.kind, ref: box.dataset.ref }) });
      if (box.dataset.ref) mark(box.dataset.ref, rating);
      box.querySelectorAll("[data-rv]").forEach((b) => b.classList.toggle("on", b.dataset.rv === rating));
      box.querySelector(".br-why").hidden = true;
      toast(r.suggested ? "✓ سُجّل، ويوجد اقتراح جديد بانتظارك في عقل العلامة" : "✓ سُجّل. يتعلم العقل من تقييماتك");
    } catch (err) { toast(err.message, true); }
  }
  // بيشتغل قبل أي دوسة تانية على الكارت (عشان التقييم ميختارش الفيديو مثلًا)
  document.addEventListener("click", (e) => {
    const box = e.target.closest?.(".br-rate");
    if (!box) return;
    e.stopPropagation();
    e.preventDefault();
    const rv = e.target.closest("[data-rv]");
    if (rv?.dataset.rv === "great") return send(box, "great");
    if (rv?.dataset.rv === "bad") { const w = box.querySelector(".br-why"); w.hidden = !w.hidden; if (!w.hidden) w.querySelector(".br-write").focus(); return; }
    if (e.target.closest("[data-rsend]")) return send(box, "bad", box.querySelector(".br-write").innerText.trim());
    if (e.target.closest(".br-write")) box.querySelector(".br-write").focus();
  }, true);
  document.addEventListener("keydown", (e) => {
    const w = e.target.closest?.(".br-write");
    if (w && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); w.closest(".br-rate").querySelector("[data-rsend]").click(); }
  }, true);
  return { html };
})();
