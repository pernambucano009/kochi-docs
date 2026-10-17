// 🧠 عقل البراند: خريطة. المخ في النص، وطالع منه فروع (الهوية، الشكل، القواعد، التسليم، صور البراند)،
// وكل حاجة في البراند نقطة على فرعها. النقطة الفاضية لسه ناقصة. تدوس على أي نقطة يفتح جنبها كارت تكتب فيه على طول،
// وأي تعديل بيتحفظ لوحده. مفيش فورم ولا مربعات: كل الشغل جوه الخريطة.

const BrandPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { id: null, brains: [], cats: null, el: null, poll: null, open: null, raf: 0, nodes: [], t0: performance.now() };
  const cur = () => S.brains.find((b) => b.id === S.id) || null;
  const bAPI = (path, opts) => api(`/api/ad-brains/${S.id}${path}`, opts);
  const styleIds = (b) => String(b?.styles || "").split(",").map((x) => x.trim()).filter((x) => S.cats?.some((c) => c.id === x));
  const hexes = (txt) => [...String(txt || "").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]).slice(0, 8);
  const rulesOf = (b) => String(b?.rules || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  // أيقونات الفروع (خط رفيع زي باقي البرنامج)
  const IC = {
    identity: "M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8z M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5",
    look: "M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.3-1-1.6-1-2.7 0-1 .8-1.6 1.8-1.6h2.3a3 3 0 0 0 2.9-3C20.5 6.8 16.7 3.5 12 3.5z M7.8 11a1.2 1.2 0 1 1 0 .1z M10.5 7.4a1.2 1.2 0 1 1 0 .1z M15 7.6a1.2 1.2 0 1 1 0 .1z",
    rules: "M9 6.5h10.5 M9 12h10.5 M9 17.5h10.5 M4.5 6.5l1 1 2-2 M4.5 12l1 1 2-2 M4.5 17.5l1 1 2-2",
    delivery: "M20.5 3.5 10 14 M20.5 3.5 14 20.5l-4-6.5-6.5-4z",
    knowledge: "M4 5.5c2.7-1 5.3-1 8 .8 2.7-1.8 5.3-1.8 8-.8v13c-2.7-1-5.3-1-8 .8-2.7-1.8-5.3-1.8-8-.8z M12 6.3v13.3",
    assets: "M4.5 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3.5 15.5l4.5-4.5 4 4 3-3 5 5 M15.5 8.5a1.3 1.3 0 1 1 0 .1z",
    pulse: "M7 4.5h10v4a5 5 0 0 1-10 0z M7 6H4.5a2.5 2.5 0 0 0 2.8 3.4 M17 6h2.5a2.5 2.5 0 0 1-2.8 3.4 M12 13.5v3.5 M8.5 20h7l-.8-3h-5.4z",
    library: "M9 4.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6z M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6 M16 7.5v6.2 M16 13.7a1.8 1.8 0 1 1-1.8-1.8 M16 7.5l3.5-1.2",
  };
  const svg = (d, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // الخريطة: كل فرع وكل نقطة فيه. النوع بيحدد الكارت اللي بيفتح
  function branches(b) {
    const kinds = [["products", "صور المنتج"], ["screens", "شاشات التطبيق"], ["characters", "شخصيات البراند"], ["sets", "الأماكن والخلفيات"], ["props", "الأدوات"]]
      .filter(([k]) => k !== "screens" || b?.type === "app");
    return [
      { k: "identity", t: "الهوية", en: "Identity", leaves: [
        { f: "@name", t: "الاسم", type: "text", ph: "اسم البراند" },
        { f: "type", t: "نوع المنتج", type: "pick", opts: [["app", "تطبيق"], ["physical", "منتج ملموس"], ["service", "خدمة"]] },
        { f: "domain", t: "المجال", type: "text", ph: "لياقة، مطاعم، عقارات…" },
        { f: "about", t: "عن البراند", type: "text", ph: "البراند بيعمل إيه، وبيفرق في إيه عن غيره" },
        { f: "audience", t: "الجمهور", type: "text", ph: "مين اللي بنكلمه؟ سنه، اهتماماته، بيدوّر على إيه" },
        { f: "market", t: "السوق", type: "text", ph: "مثلًا: السعودية والخليج" },
        { f: "language", t: "اللغة واللهجة", type: "text", ph: "مثلًا: اللهجة السعودية البيضاء" },
      ] },
      { k: "look", t: "الشكل", en: "Look", leaves: [
        { f: "logos", t: "اللوجو", type: "imgs" },
        { f: "palette", t: "الألوان", type: "palette" },
        { f: "typography", t: "الخطوط", type: "text", ph: "مثلًا: Cairo للعناوين و IBM Plex للكلام" },
        { f: "styles", t: "الستايل", type: "styles" },
        { f: "derived", t: "اللي البرنامج استنبطه", type: "multi", fields: [["theme", "الثيم"], ["style", "ستايل الرسم (بالإنجليزي أحسن)"], ["logo_rule", "مكان اللوجو"], ["logo_description", "وصف اللوجو"], ["ui_style", "شكل الواجهة"]] },
        { f: "analyze", t: "استنبط الهوية من الصور", type: "action" },
      ] },
      { k: "rules", t: "القواعد", en: "Rules", leaves: [
        ...rulesOf(b).map((r, i) => ({ f: "rule", i, t: r, type: "rule" })),
        { f: "rule+", t: "قاعدة جديدة", type: "rule-new" },
      ] },
      { k: "delivery", t: "التسليم", en: "Delivery", leaves: [
        { f: "logo_on", t: "اللوجو على الفيديو", type: "pick", opts: [["", "أيوه"], ["0", "لأ"]] },
        { f: "intro", t: "الإنترو", type: "video" },
        { f: "outro", t: "الأوترو", type: "video" },
        { f: "cta", t: "الدعوة (CTA)", type: "text", ph: "مثلًا: حمّل التطبيق دلوقتي" },
        { f: "link", t: "اللينك", type: "text", ph: "https://…", ltr: true },
        { f: "caption", t: "الكابشن الافتراضي", type: "text", ph: "{caption}\n\n{cta} 👇\n{link}\n#هاشتاج", hint: "{caption} كابشن الفيديو · {cta} الدعوة · {link} اللينك. بيتحطوا لوحدهم وقت النشر." },
      ] },
      { k: "assets", t: "صور البراند", en: "Assets", leaves: kinds.map(([k, t]) => ({ f: k, t, type: "imgs" })) },
      // الشخصيات (والأفاتار) والتعليق الصوتي والموسيقى: من أساسيات البراند، فبقوا فرع من العقل (كل نقطة بتفتح صفحتها)
      { k: "library", t: "الشخصيات والأصوات", en: "Library", leaves: [
        { f: "pg", i: "coaches", page: "coaches", t: "الشخصيات والأفاتار", type: "page" },
        { f: "pg", i: "voice", page: "voice", t: "التعليق الصوتي", type: "page" },
        { f: "pg", i: "music", page: "music", t: "الموسيقى", type: "page" },
        { f: "pg", i: "stylecl", page: "stylecl", t: "🎨 استنساخ الستايل", type: "page" },
        { f: "pg", i: "fstudio", page: "fstudio", t: "🎞️ فريم فريم", type: "page" },
        { f: "pg", i: "hekaya", page: "hekaya", t: "📖 حكاية", type: "page" },
        { f: "pg", i: "comics", page: "comics", t: "🎭 مكتبة الكوميكس", type: "page" },
        { f: "pg", i: "ref2p", page: "ref2p", t: "🎥 من مرجع لبرومبت", type: "page" },
      ] },
      // نبض المجال: المنافسين (أعلى 5 في المجال والسوق) واللي بينجح عندهم والترند وتحليل بوستات بنفسك، كله في فرع واحد
      { k: "pulse", t: "نبض المجال", en: "Niche Pulse", leaves: [
        ...(b?.rivals || []).map((r) => ({ f: "pg", i: `rv${r.id}`, page: "rivals", t: `@${r.handle}`, type: "page" })),
        ...((b?.rivals || []).length ? [] : [{ f: "pg", i: "rv:rivals", page: "rivals", t: "🏆 هات منافسينك", type: "page" }]),
        { f: "pg", i: "rv:works", page: "rivals", t: "🧠 اللي بينجح عندهم", type: "page" },
        { f: "pg", i: "rv:trend", page: "rivals", t: "📈 الترند آخر ٣٠ يوم", type: "page" },
        { f: "pg", i: "rv:mine", page: "rivals", t: "🔥 حلّل بوستات بنفسك", type: "page" },
      ] },
      // المعرفة: اللي اتقرا من الملفات واللينكات واتوافق عليه
      { k: "knowledge", t: "المعرفة", en: "Knowledge", leaves: (b?.notes || []).map((x) => ({ f: "n", i: x.id, t: x.title, type: "note", note: x })) },
    ].map((br) => {
      // الاقتراحات اللي مستنية موافقتك بتظهر نقط منوّرة على الفرع بتاعها
      const mine = (b?.pending || []).filter((p) => pendBranch(p) === br.k);
      return { ...br, leaves: [...br.leaves, ...mine.map((p) => ({ f: "p", i: p.id, t: pendLabel(p), type: "pending", p }))] };
    });
  }
  const FIELD_BR = { about: "identity", audience: "identity", market: "identity", language: "identity", domain: "identity",
    typography: "look", palette: "look", cta: "delivery", link: "delivery", caption: "delivery" };
  const FIELD_T = { about: "عن البراند", audience: "الجمهور", market: "السوق", language: "اللغة واللهجة", domain: "المجال", typography: "الخطوط",
    palette: "الألوان", cta: "الدعوة (CTA)", link: "اللينك", caption: "الكابشن الافتراضي" };
  const pendBranch = (p) => (p.kind === "field" ? FIELD_BR[p.field] || "identity" : p.kind === "rule" ? "rules" : "knowledge");
  const pendLabel = (p) => (p.kind === "field" ? `اقتراح: ${FIELD_T[p.field] || p.field}` : p.kind === "rule" ? "قاعدة مقترحة" : p.kind === "question" ? "سؤال" : p.title);
  const srcName = (id) => (id === "feedback" ? "تقييماتك" : cur()?.sources?.find((s) => s.id === id)?.name || "");
  // النقطة مليانة ولا لسه ناقصة
  function filled(b, l) {
    if (!b) return false;
    switch (l.type) {
      case "text": return !!String(l.f === "@name" ? b.name : b[l.f] || "").trim();
      case "pick": return l.f === "type" ? !!b.type : true;
      case "imgs": return (b[l.f] || []).length > 0;
      case "palette": return hexes(b.palette).length > 0;
      case "styles": return styleIds(b).length > 0;
      case "multi": return l.fields.some(([k]) => String(b[k] || "").trim());
      case "video": return !!b[`${l.f}_url`];
      case "rule": case "note": case "page": return true;
      default: return false;
    }
  }
  const leafValue = (b, l) => {
    if (l.type === "text") return String(l.f === "@name" ? b?.name : b?.[l.f] || "").trim();
    if (l.type === "pick") return l.opts.find(([v]) => v === String(b?.[l.f] || ""))?.[1] || "";
    if (l.type === "imgs") return (b?.[l.f] || []).length ? `${(b[l.f]).length} صورة` : "";
    if (l.type === "palette") return hexes(b?.palette).join(" ");
    if (l.type === "styles") return styleIds(b).map((id) => S.cats?.find((c) => c.id === id)?.ar).filter(Boolean).join("، ");
    if (l.type === "video") return b?.[`${l.f}_url`] ? (b[`${l.f}_on`] ? "شغّال" : "موجود ومقفول") : "";
    return "";
  };

  function html() {
    return `<div class="bm" id="nbWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  }

  // ---------- الرسم ----------
  function skeleton() {
    return `<svg class="bm-lines" aria-hidden="true"></svg>
      <div class="bm-nodes"></div>
      <div class="bm-card" hidden role="dialog"></div>
      <p class="bm-hint">دوس على أي نقطة تكتب فيها · النقط المفرّغة لسه ناقصة · دوس على المخ تبدّل البراند</p>`;
  }
  function layout() {
    const w = S.el, b = cur();
    if (!w) return;
    const W = w.clientWidth, H = w.clientHeight;
    if (!W || !H) return;
    const cx = W / 2, cy = H / 2 + 6, R1 = Math.min(W * .42, H * .5) * .58, R2 = Math.max(70, R1 * .5);
    const list = branches(b), nodes = [{ id: "c", kind: "center", x: cx, y: cy }];
    // «+» تحت المخ: ترمي فيه ملف أو لينك أو تكتب، والبرنامج يقراه
    nodes.push({ id: "add", kind: "add", x: cx, y: cy + R1 * .78, from: "c" });
    list.forEach((br, i) => {
      const a = -Math.PI / 2 + Math.PI / list.length + (i / list.length) * Math.PI * 2;
      const bx = cx + Math.cos(a) * R1 * 1.25, by = cy + Math.sin(a) * R1;
      const real = br.leaves.filter((l) => !l.type.startsWith("rule-") && l.type !== "action" && l.type !== "pending");
      const done = real.filter((l) => filled(b, l)).length, total = real.length, waiting = br.leaves.length - br.leaves.filter((l) => l.type !== "pending").length;
      nodes.push({ id: br.k, kind: "branch", br, x: bx, y: by, from: "c", done, total, waiting });
      const n = br.leaves.length, spread = Math.min(Math.PI * 1.15, .42 * Math.max(1, n - 1));
      br.leaves.forEach((l, j) => {
        const la = a + (n === 1 ? 0 : -spread / 2 + (j / (n - 1)) * spread);
        const rr = R2 * (n > 6 ? (j % 2 ? 1.18 : .9) : 1);
        nodes.push({ id: `${br.k}:${l.f}:${l.i ?? ""}`, kind: "leaf", br, l, x: bx + Math.cos(la) * rr * 1.2, y: by + Math.sin(la) * rr, from: br.k, on: filled(b, l) });
      });
    });
    // كل نقطة ليها مكانها الأصلي (x, y) ومكانها الحالي (px, py) وسرعتها؛ لو الخريطة اتعادت بتكمّل من مكانها
    const old = Object.fromEntries((S.nodes || []).map((n) => [n.id, n]));
    S.nodes = nodes.map((n, i) => {
      const o = old[n.id];
      return { ...n, ph: i * 1.7, px: o ? o.px + (n.x - o.x) : n.x, py: o ? o.py + (n.y - o.y) : n.y, vx: o?.vx || 0, vy: o?.vy || 0 };
    });
    S.byId = Object.fromEntries(S.nodes.map((n) => [n.id, n]));
    draw();
  }
  function nodeHTML(n, b) {
    if (n.kind === "center") {
      const reading = (b?.sources || []).filter((s) => s.status === "working").length, waiting = (b?.pending || []).length;
      const st = b?.status === "working" ? `<small class="bm-st">بيستنبط الهوية من الصور…</small>` : b?.status === "failed" ? `<small class="bm-st bad">${esc(b.error || "الاستنباط فشل")}</small>`
        : reading ? `<small class="bm-st">بيقرا ${reading === 1 ? "مصدر" : `${reading} مصادر`}…</small>` : waiting ? `<small class="bm-st">${waiting} اقتراح مستني موافقتك</small>` : "";
      return `<button class="bm-n bm-center" data-n="c" title="بدّل البراند أو اعمل واحد جديد">
        <span class="bm-brain"><img class="ic-l" src="/icons3d/brand.webp?v=9" alt=""><img class="ic-d" src="/icons3d/brand_d.webp?v=9" alt=""></span>
        <b>${esc(b?.name || "براند جديد")}</b>${st}
        ${b?.knowledge ? `<small class="bm-kn" title="${esc((b.knowledge.tips || []).join(" · "))}">المخ يعرفك <span class="num">${b.knowledge.score}٪</span> · ${esc(b.knowledge.level)}</small>` : ""}</button>`;
    }
    if (n.kind === "add") {
      const reading = (b?.sources || []).some((s) => s.status === "working");
      return `<button class="bm-n bm-add${reading ? " busy" : ""}" data-n="add" title="ضيف للعقل: ملف أو لينك أو كلام"><i>+</i><b>ضيف للعقل</b></button>`;
    }
    if (n.kind === "branch") {
      return `<button class="bm-n bm-branch${S.open?.br === n.br.k ? " on" : ""}" data-n="${n.id}" title="${esc(n.br.t)}">
        <span class="bm-bic">${svg(IC[n.br.k])}${n.waiting ? `<em class="num">${n.waiting}</em>` : ""}</span><b>${esc(n.br.t)}</b><small class="num">${n.br.k === "knowledge" ? n.total : `${n.done}/${n.total}`}</small></button>`;
    }
    const l = n.l, val = leafValue(b, l);
    if (l.type === "pending") {
      const p = l.p, sub = p.kind === "field" || p.kind === "rule" ? p.value : p.kind === "question" ? p.title : p.summary;
      return `<button class="bm-n bm-leaf pend${p.kind === "question" ? " ask" : ""}${S.open?.id === n.id ? " on" : ""}" data-n="${esc(n.id)}" aria-label="${esc(l.t)}">
        <i>${p.kind === "question" ? "؟" : ""}</i><span class="bm-tip"><b>${esc(l.t)}</b><small>${esc(String(sub || "").slice(0, 60))}</small><small class="miss">مستني موافقتك</small></span></button>`;
    }
    const cls = l.type === "action" ? "act" : l.type === "rule-new" ? "add" : n.on ? "full" : "empty";
    return `<button class="bm-n bm-leaf ${cls}${S.open?.id === n.id ? " on" : ""}" data-n="${esc(n.id)}" aria-label="${esc(l.t)}">
      <i>${l.type === "action" ? "✲" : l.type === "rule-new" ? "+" : ""}</i>
      <span class="bm-tip"><b>${esc(l.type === "rule" ? "قاعدة" : l.t)}</b>${l.type === "rule" || l.type === "note" ? `<small>${esc(l.type === "note" ? l.note.summary || "" : l.t)}</small>` : val ? `<small>${esc(val.slice(0, 60))}</small>` : l.type === "action" || l.type === "rule-new" ? "" : `<small class="miss">لسه ناقصة</small>`}</span></button>`;
  }
  function draw() {
    const w = S.el, b = cur();
    w.querySelector(".bm-nodes").innerHTML = S.nodes.map((n) => nodeHTML(n, b)).join("");
    S.nodes.forEach((n) => { n.el = w.querySelector(`[data-n="${CSS.escape(n.id)}"]`); });
    w.querySelector(".bm-lines").innerHTML = S.nodes.filter((n) => n.from).map((n) => `<line data-l="${esc(n.id)}" class="${n.kind}${n.on === false ? " empty" : ""}"/>`).join("");
    S.nodes.forEach((n) => { n.line = n.from ? w.querySelector(`.bm-lines [data-l="${CSS.escape(n.id)}"]`) : null; });
    S.rc = (w.querySelector(".bm-brain")?.offsetWidth || 150) * .5;
    tick(performance.now());
  }
  // النقط بتعوم بهدوء حوالين مكانها، والخطوط ماشية معاها
  // فيزيا بسيطة: كل نقطة مربوطة بزنبرك لمكانها، واللي متعلّق بيها بيمشي وراها.
  // لما تمسك نقطة وتسحبها، اللي طالع منها بيتشد معاها، ولما تسيبها بترجع مكانها وبتهتز شوية
  const FOLLOW = { branch: .55, leaf: .9, add: .6 };
  function step(dt) {
    const k = 140, c = 15;
    for (const n of S.nodes) {
      if (S.drag?.n === n && S.drag.moved) { n.vx = n.vy = 0; n.px = S.drag.x; n.py = S.drag.y; continue; }
      const p = n.from && S.byId[n.from], f = FOLLOW[n.kind] || 0;
      const tx = n.x + (p ? (p.px - p.x) * f : 0), ty = n.y + (p ? (p.py - p.y) * f : 0);
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
      if (n.el) n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    for (const n of S.nodes) {
      if (!n.line) continue;
      // الخط بيبدأ وبيخلص عند حافة الدايرة (مش من جوّه المخ أو الأيقونة)
      const [ax, ay] = pos[n.from], [bx, by] = pos[n.id], d = Math.hypot(bx - ax, by - ay) || 1;
      const r1 = n.from === "c" ? S.rc : 34, r2 = n.kind === "branch" ? 34 : n.kind === "add" ? 24 : 10;
      const ux = (bx - ax) / d, uy = (by - ay) / d;
      n.line.setAttribute("x1", ax + ux * r1); n.line.setAttribute("y1", ay + uy * r1);
      n.line.setAttribute("x2", bx - ux * r2); n.line.setAttribute("y2", by - uy * r2);
    }
    if (S.open?.n) placeCard(pos[S.open.n.id]);
  }
  function loop(now) {
    if (!S.el?.isConnected) { S.raf = 0; return; }
    tick(now);
    S.raf = requestAnimationFrame(loop);
  }

  // ---------- الكارت اللي بيفتح جنب النقطة ----------
  const editable = (k, val, ph, ltr) => `<div class="bm-write" contenteditable="plaintext-only" data-k="${k}" data-ph="${esc(ph || "اكتب هنا…")}"${ltr ? ' dir="ltr"' : ""}>${esc(val)}</div>`;
  function cardHTML(n) {
    const b = cur();
    if (n.kind === "center") {
      return `<div class="bm-ch"><span class="latin">BRANDS</span><b>البراندات</b></div>
        <div class="bm-pills">${S.brains.map((x) => `<button class="bm-pill${x.id === S.id ? " on" : ""}" data-brain="${x.id}">${esc(x.name)}</button>`).join("")}</div>
        <div class="bm-new">${editable("@new", "", "اكتب اسم براند جديد واضغط Enter")}</div>
        ${S.brains.length > 1 ? `<button class="bm-link bad" data-del>احذف «${esc(b?.name || "")}» بكل صوره</button>` : ""}`;
    }
    if (n.kind === "add") {
      const tab = S.addTab || "file", srcs = [...(b?.sources || [])].reverse();
      return `<div class="bm-ch"><span class="latin">ADD TO BRAIN</span><b>ضيف للعقل</b></div>
        <p class="bm-note">ارمي أي حاجة عن البراند، والبرنامج يقراها ويطلّع منها اقتراحات تظهر نقط منوّرة على الخريطة، وانت توافق عليها.</p>
        <div class="bm-pills bm-tabs">${[["file", "ارفع ملف"], ["url", "من موقع"], ["text", "اكتب"]].map(([k, t]) => `<button class="bm-pill${tab === k ? " on" : ""}" data-tab="${k}">${t}</button>`).join("")}</div>
        ${tab === "file" ? `<label class="bm-up wide bm-drop">+<small>ارمي الملف هنا أو دوس تختار</small><small class="bm-types">PDF · Word · صور · نص</small><input type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm,image/*" data-src hidden></label>`
          : tab === "url" ? editable("@url", "", "kochi.fit · واضغط Enter", true)
          : editable("@text", "", "اكتب أي حاجة عن البراند: الجمهور، النبرة، العروض، اللي ممنوع… واضغط Enter")}
        ${srcs.length ? `<ul class="bm-srcs">${srcs.map((s) => `<li class="${s.status}"><span class="bm-dot ${s.status === "done" ? "full" : s.status === "failed" ? "bad" : "busy"}"></span>
          <span><b>${esc(s.name)}</b><small>${s.status === "working" ? "بيتقرا…" : s.status === "failed" ? esc(s.error || "فشل") : s.count ? `خلص · ${s.count} اقتراح` : "خلص · مفيش جديد"}</small></span>
          <button data-sdel="${s.id}" title="شيله">✕</button></li>`).join("")}</ul>` : ""}`;
    }
    if (n.kind === "branch") {
      return `<div class="bm-ch"><span class="latin">${n.br.en}</span><b>${esc(n.br.t)}</b></div>${n.br.k === "knowledge" && !n.br.leaves.length ? `<p class="bm-note">لسه فاضية. ارمي ملف أو لينك من «ضيف للعقل» والمعرفة هتطلع هنا.</p>` : ""}
        <ul class="bm-list">${n.br.leaves.map((l) => `<li><button data-go="${esc(`${n.br.k}:${l.f}:${l.i ?? ""}`)}"><span class="bm-dot ${l.type === "action" || l.type === "rule-new" ? "add" : filled(b, l) ? "full" : "empty"}"></span><b>${esc(l.type === "rule" ? l.t : l.t)}</b></button></li>`).join("")}</ul>`;
    }
    const l = n.l, head = `<div class="bm-ch"><span class="latin">${n.br.en}</span><b>${esc(l.type === "rule" ? "قاعدة" : l.t)}</b></div>`;
    switch (l.type) {
      case "text": return head + editable(l.f, l.f === "@name" ? b?.name : b?.[l.f], l.ph, l.ltr) + (l.hint ? `<p class="bm-note">${esc(l.hint)}</p>` : "");
      case "rule": return head + editable(`rule:${l.i}`, l.t, "القاعدة") + `<button class="bm-link bad" data-rdel="${l.i}">شيل القاعدة دي</button>`;
      case "rule-new": return head + `<p class="bm-note">أي حاجة لازم تتراعى في كل شغل للبراند: السكريبت والصور والفيديو والصوت.</p>` + editable("rule:new", "", "مثلًا: من غير مزيكا · واضغط Enter");
      case "pick": return head + `<div class="bm-pills">${l.opts.map(([v, t]) => `<button class="bm-pill${String(b?.[l.f] || "") === v ? " on" : ""}" data-pick="${l.f}" data-v="${v}">${t}</button>`).join("")}</div>`;
      case "palette": {
        const hs = hexes(b?.palette);
        return head + `<div class="bm-sw">${hs.map((h) => `<button style="background:${h}" data-hdel="${h}" title="${h} · دوس تشيله"></button>`).join("")}
          <label class="bm-swadd" title="ضيف لون">+<input type="color" data-hadd hidden></label></div>` + editable("palette", b?.palette, "#E5613E برتقالي، #111111 أسود", true);
      }
      case "styles": {
        const ids = styleIds(b);
        return head + `<p class="bm-note">اللي عليه ★ هو الافتراضي، و«ابدأ مشروع جديد» بيبدأ بيه.</p><div class="bm-cats">${(S.cats || []).map((c) => {
          const on = ids.includes(c.id), def = ids[0] === c.id, cover = c.templates.find((t) => t.cover_url);
          return `<button class="bm-cat${on ? " on" : ""}" data-cat="${c.id}">${cover ? `<img src="${esc(cover.cover_url)}" alt="" loading="lazy">` : `<span>${c.icon}</span>`}<b>${esc(c.ar)}</b>${on ? `<i data-star title="خليه الافتراضي">${def ? "★" : "☆"}</i>` : ""}</button>`;
        }).join("")}</div>`;
      }
      case "imgs": {
        const xs = b?.[l.f] || [];
        return head + `<div class="bm-imgs">${xs.map((x) => `<figure data-file="${esc(x.file)}"><img src="${esc(x.url)}" alt="" loading="lazy" title="${esc(x.description || x.name)}"><button data-adel title="احذف">✕</button></figure>`).join("")}
          <label class="bm-up">+<small>ارفع</small><input type="file" accept="image/*" multiple data-up="${l.f}" hidden></label></div>
          <p class="bm-note">${l.f === "logos" ? "اللوجو بنسخه (فاتح، غامق، أيقونة)." : "صور حقيقية من البراند. البرنامج بيوصفها ويستخدمها بالظبط بدل ما يخترع."} تقدر تسحب الصور وترميها هنا.</p>`;
      }
      case "video": {
        const url = b?.[`${l.f}_url`];
        return head + (url ? `<video src="${esc(url)}" controls preload="metadata" playsinline></video>
          <div class="bm-pills"><button class="bm-pill${b[`${l.f}_on`] ? " on" : ""}" data-von="${l.f}" data-v="1">شغّال</button><button class="bm-pill${b[`${l.f}_on`] ? "" : " on"}" data-von="${l.f}" data-v="">مقفول</button></div>
          <button class="bm-link bad" data-vdel="${l.f}">شيل الفيديو</button>` : `<label class="bm-up wide">+<small>ارفع فيديو</small><input type="file" accept="video/*" data-vup="${l.f}" hidden></label>`);
      }
      case "multi": return head + `<p class="bm-note">بيتكتب لوحده من اللوجو والصور، وتقدر تعدّله.</p>` + l.fields.map(([k, t]) => `<div class="bm-sub"><small>${t}</small>${editable(k, b?.[k], "…", /logo_description|ui_style|style/.test(k))}</div>`).join("");
      case "pending": {
        const p = l.p, from = srcName(p.source);
        const now = p.kind === "field" ? String(b?.[p.field] || "").trim() : "";
        const top = `<div class="bm-ch"><span class="latin">SUGGESTION</span><b>${esc(p.kind === "question" ? "سؤال" : p.kind === "note" ? "معلومة جديدة" : l.t)}</b></div>${from ? `<p class="bm-note">من «${esc(from)}»</p>` : ""}`;
        const body = p.kind === "question" ? `<p class="bm-q">${esc(p.title)}</p>` + editable("@ans", "", "اكتب الإجابة…")
          : p.kind === "note" ? editable("@ttl", p.title, "العنوان") + (p.summary ? `<p class="bm-note">${esc(p.summary)}</p>` : "") + editable("@val", p.value, "التفاصيل")
          : (now ? `<div class="bm-sub"><small>دلوقتي</small><p class="bm-now">${esc(now)}</p></div><div class="bm-sub"><small>المقترح</small>` : "<div>") + editable("@val", p.value, "…", p.field === "link" || p.field === "palette") + "</div>";
        return top + (p.why ? `<p class="bm-note bm-why">${esc(p.why)}</p>` : "") + body + `<div class="bm-acts"><button class="bm-go" data-ok="${p.id}">${p.kind === "question" ? "احفظ الإجابة" : "موافق"}</button><button class="bm-pill" data-no="${p.id}">لأ</button></div>`;
      }
      case "note": return head.replace(esc(l.t), "معلومة") + editable(`note:t:${l.i}`, l.note.title, "العنوان") + (l.note.summary ? `<p class="bm-note">${esc(l.note.summary)}</p>` : "")
        + editable(`note:b:${l.i}`, l.note.body, "التفاصيل") + (srcName(l.note.source) ? `<p class="bm-note">من «${esc(srcName(l.note.source))}»</p>` : "") + `<button class="bm-link bad" data-ndel="${l.i}">شيل المعلومة دي</button>`;
      case "action": return head + `<p class="bm-note">البرنامج بيبص على اللوجو وصور البراند ويكتب الثيم والستايل وشكل اللوجو لوحده.</p>
        <button class="bm-go" data-analyze ${b?.status === "working" ? "disabled" : ""}>${b?.status === "working" ? "بيستنبط…" : "ابدأ الاستنباط"}</button>`;
    }
    return head;
  }
  function openCard(n) {
    if (n?.l?.type === "page") { window.RV_FOCUS = n.l.page === "rivals" ? n.l.i : null; return window.NHNav?.(n.l.page); }   // الشخصيات / التعليق / الموسيقى: صفحتها بتفتح جوه العقل («رجوع» بيرجّعك هنا)
    const card = S.el.querySelector(".bm-card");
    if (!n) { S.open = null; card.hidden = true; S.el.classList.remove("has-card"); markOpen(); return; }
    S.open = { id: n.id, br: n.br?.k, n };
    card.innerHTML = `<button class="bm-x" data-close aria-label="اقفل">✕</button>` + cardHTML(n);
    card.hidden = false;
    S.el.classList.add("has-card");
    markOpen();
    // يتحط في مكانه جنب النقطة الأول، وبعدين يظهر (الأنيميشن على الشفافية والحجم بس، مش على المكان)
    placeCard([n.px, n.py]);
    card.animate([{ opacity: 0, scale: .96 }, { opacity: 1, scale: 1 }], { duration: reduce.matches ? 1 : 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    const ed = card.querySelector(".bm-write");
    if (ed && n.kind === "leaf") { ed.focus(); placeCaret(ed); }
  }
  function markOpen() { S.el.querySelectorAll(".bm-n.on").forEach((x) => x.classList.remove("on")); if (S.open?.n?.el) S.open.n.el.classList.add("on"); }
  const placeCaret = (el) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  // الكارت جنب النقطة من الناحية البعيدة عن المخ، ومبيطلعش برّه الخريطة
  function placeCard(p) {
    const card = S.el.querySelector(".bm-card");
    if (!p || card.hidden) return;
    const W = S.el.clientWidth, H = S.el.clientHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    const right = p[0] >= W / 2;
    let x = right ? p[0] + 34 : p[0] - 34 - cw, y = p[1] - ch / 2;
    if (x + cw > W - 8) x = p[0] - 34 - cw;
    if (x < 8) x = Math.min(W - cw - 8, p[0] + 34);
    y = Math.max(8, Math.min(H - ch - 8, y));
    card.style.transform = `translate(${x}px, ${y}px)`;
  }
  const refreshCard = () => { if (S.open) { const n = S.nodes.find((x) => x.id === S.open.id) || (S.open.id === "c" ? S.nodes[0] : null); if (n) openCard(n); else openCard(null); } };

  // ---------- الحفظ ----------
  async function save(fn, { card = true } = {}) {
    try {
      const b = await fn();
      S.brains = S.brains.map((x) => (x.id === b.id ? b : x));
      const keep = S.open && S.el.querySelector(".bm-card").contains(document.activeElement) && document.activeElement.matches(".bm-write");
      layout();
      if (S.open) {
        const n = S.nodes.find((x) => x.id === S.open.id);
        if (n) { S.open.n = n; markOpen(); if (card && !keep) refreshCard(); }
      }
      if (busy(b)) watch();
      loadClients();
    } catch (err) { toast(err.message, true); }
  }
  // مصدر جديد (ملف / لينك / كلام): بيتقرا في الخلفية والاقتراحات بتظهر لوحدها
  function addSource(form) {
    toast("⏳ بيقرا… الاقتراحات هتظهر على الخريطة");
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
        if (!busy(b)) { clearInterval(S.poll); loadClients(); layout(); if (S.open && !S.el.querySelector(".bm-card").contains(document.activeElement)) refreshCard(); return; }
        layout();
        if (S.open?.id === "add") refreshCard();
      } catch { clearInterval(S.poll); }
    }, 3000);
  }
  const patch = (fields, name, opts) => save(() => bAPI("", { method: "PATCH", ...jsonBody(name != null ? { name, fields } : { fields }) }), opts);
  // الكتابة بتتحفظ لوحدها بعد ما تقف شوية
  let typeT = null;
  function commit(el) {
    clearTimeout(typeT);
    const k = el.dataset.k, v = el.innerText.replace(/ /g, " ").trim();
    const b = cur();
    if (!b || k.startsWith("@") && k !== "@name" || k === "rule:new") return;
    if (k.startsWith("note:")) {
      const [, part, id] = k.split(":"), n = (b.notes || []).find((x) => x.id === id);
      if (!n || (part === "t" ? n.title : n.body || "") === v || (part === "t" && !v)) return;
      return save(() => bAPI(`/notes/${id}`, { method: "PATCH", ...jsonBody(part === "t" ? { title: v } : { body: v }) }), { card: false });
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
    if (!imgs.length) return toast("مفيش صور (PNG / JPG / WEBP)", true);
    const form = new FormData();
    form.append("kind", kind);
    imgs.slice(0, 120).forEach((f) => form.append("files", f));
    toast(`⏳ بيرفع ${imgs.length} صورة…`);
    return save(() => bAPI("/assets", { method: "POST", body: form }));
  };

  function bind(w) {
    // مسك وسحب أي نقطة أو فرع أو المخ نفسه
    w.addEventListener("pointerdown", (e) => {
      const el = e.target.closest(".bm-n");
      if (!el || e.button !== 0) return;
      const n = S.byId[el.dataset.n];
      if (!n) return;
      const r = w.getBoundingClientRect();
      S.drag = { n, el, sx: e.clientX, sy: e.clientY, ox: n.px - (e.clientX - r.left), oy: n.py - (e.clientY - r.top), x: n.px, y: n.py, moved: false, id: e.pointerId };
    });
    w.addEventListener("pointermove", (e) => {
      const d = S.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      if (!d.moved) { d.moved = true; w.setPointerCapture(e.pointerId); w.classList.add("dragging"); d.el.classList.add("held"); }
      const r = w.getBoundingClientRect();
      d.x = Math.max(10, Math.min(r.width - 10, e.clientX - r.left + d.ox));
      d.y = Math.max(10, Math.min(r.height - 10, e.clientY - r.top + d.oy));
    });
    const drop = (e) => {
      const d = S.drag;
      if (!d || (e.pointerId != null && e.pointerId !== d.id)) return;
      S.drag = null;
      if (d.moved) { S.noClick = true; setTimeout(() => (S.noClick = false), 0); w.classList.remove("dragging"); d.el.classList.remove("held"); }
    };
    w.addEventListener("pointerup", drop);
    w.addEventListener("pointercancel", drop);
    w.addEventListener("click", async (e) => {
      const t = e.target;
      if (S.noClick) { S.noClick = false; return; }
      const node = t.closest(".bm-n");
      if (node) {
        const n = S.nodes.find((x) => x.id === node.dataset.n);
        if (!n) return;
        if (S.open?.id === n.id) return openCard(null);
        if (n.kind === "leaf" && n.l.type === "action") return openCard(n);
        return openCard(n);
      }
      if (t.closest("[data-close]")) return openCard(null);
      const go = t.closest("[data-go]");
      if (go) return openCard(S.nodes.find((x) => x.id === go.dataset.go));
      const br = t.closest("[data-brain]");
      if (br) { S.id = br.dataset.brain; openCard(null); layout(); return; }
      if (t.closest("[data-del]")) {
        const b = cur();
        if (!b || !confirm(`تحذف «${b.name}» بكل صوره؟`)) return;
        try { await api(`/api/ad-brains/${b.id}`, { method: "DELETE" }); openCard(null); await load(); loadClients(); } catch (err) { toast(err.message, true); }
        return;
      }
      const tab = t.closest("[data-tab]");
      if (tab) { S.addTab = tab.dataset.tab; refreshCard(); S.el.querySelector(".bm-card .bm-write")?.focus(); return; }
      const ok = t.closest("[data-ok]");
      if (ok) {
        const card = S.el.querySelector(".bm-card"), val = card.querySelector('[data-k="@val"], [data-k="@ans"]')?.innerText.trim(), ttl = card.querySelector('[data-k="@ttl"]')?.innerText.trim();
        openCard(null);
        return save(() => bAPI(`/pending/${ok.dataset.ok}/approve`, { method: "POST", ...jsonBody({ value: val ?? null, title: ttl ?? null }) }));
      }
      const no = t.closest("[data-no]");
      if (no) { openCard(null); return save(() => bAPI(`/pending/${no.dataset.no}`, { method: "DELETE" })); }
      const sdel = t.closest("[data-sdel]");
      if (sdel) { if (confirm("تشيل المصدر ده واقتراحاته اللي لسه مستنية؟")) save(() => bAPI(`/sources/${sdel.dataset.sdel}`, { method: "DELETE" })); return; }
      const ndel = t.closest("[data-ndel]");
      if (ndel) { if (confirm("تشيل المعلومة دي من العقل؟")) { openCard(null); save(() => bAPI(`/notes/${ndel.dataset.ndel}`, { method: "DELETE" })); } return; }
      const pick = t.closest("[data-pick]");
      if (pick) return patch({ [pick.dataset.pick]: pick.dataset.v });
      const von = t.closest("[data-von]");
      if (von) return patch({ [`${von.dataset.von}_on`]: von.dataset.v });
      const vdel = t.closest("[data-vdel]");
      if (vdel) { if (confirm("تشيل الفيديو ده؟")) save(() => bAPI(`/brand-video/${vdel.dataset.vdel}`, { method: "DELETE" })); return; }
      const rdel = t.closest("[data-rdel]");
      if (rdel) { const rs = rulesOf(cur()); rs.splice(+rdel.dataset.rdel, 1); openCard(null); return patch({ rules: rs.join("\n") }); }
      const hdel = t.closest("[data-hdel]");
      if (hdel) return patch({ palette: String(cur()?.palette || "").replace(new RegExp(`${hdel.dataset.hdel}[^,\\n]*[,\\n]?\\s*`, "i"), "").trim() });
      if (t.closest("[data-analyze]")) return save(() => bAPI("/analyze", { method: "POST" }));
      const fig = t.closest("[data-file]");
      if (fig && t.closest("[data-adel]")) { if (confirm("تحذف الصورة دي؟")) save(() => bAPI(`/assets/${encodeURIComponent(fig.dataset.file)}`, { method: "DELETE" })); return; }
      const cat = t.closest("[data-cat]");
      if (cat) {
        const ids = styleIds(cur()), id = cat.dataset.cat;
        const next = t.closest("[data-star]") ? [id, ...ids.filter((x) => x !== id)] : ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
        return patch({ styles: next.join(",") });
      }
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
          S.brains.push(b); S.id = b.id; openCard(null); layout(); loadClients();
        } catch (err) { toast(err.message, true); }
        return;
      }
      if (k === "@url" || k === "@text") {
        e.preventDefault();
        if (!v) return;
        const form = new FormData();
        form.append(k === "@url" ? "url" : "text", v);
        el.textContent = "";
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
    });
    // سحب صور ورميها على كارت الصور
    w.addEventListener("dragover", (e) => { if (e.target.closest(".bm-card") && (S.open?.n?.l?.type === "imgs" || S.open?.id === "add")) { e.preventDefault(); S.el.querySelector(".bm-card").classList.add("drop"); } });
    w.addEventListener("dragleave", (e) => { if (!e.relatedTarget || !S.el.querySelector(".bm-card").contains(e.relatedTarget)) S.el.querySelector(".bm-card").classList.remove("drop"); });
    w.addEventListener("drop", (e) => {
      const card = S.el.querySelector(".bm-card");
      card.classList.remove("drop");
      if (!e.target.closest(".bm-card")) return;
      if (S.open?.id === "add") { e.preventDefault(); const form = new FormData(); [...e.dataTransfer.files].forEach((f) => form.append("files", f)); return addSource(form); }
      if (S.open?.n?.l?.type !== "imgs") return;
      e.preventDefault();
      upload(S.open.n.l.f, e.dataTransfer.files);
    });
    new ResizeObserver(() => layout()).observe(w);
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

  async function mount(root, id) {
    const w = root.querySelector("#nbWrap");
    if (!w) return;
    S.el = w;
    S.open = null;
    S.id = id || clientx?.active || S.id;
    w.innerHTML = skeleton();
    bind(w);
    try { await load(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; return; }
    if (!S.raf) S.raf = requestAnimationFrame(loop);
    // أول ما الخريطة تفتح: النقط بتطلع من المخ لبرّه
    if (!reduce.matches) S.nodes.forEach((n, i) => n.el?.animate([{ opacity: 0, translate: `${S.nodes[0].x - n.x}px ${S.nodes[0].y - n.y}px`, scale: .3 }, { opacity: 1, translate: "0 0", scale: 1 }],
      { duration: 700, delay: n.kind === "center" ? 0 : n.kind === "branch" ? 120 : 260 + (i % 9) * 25, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
  }
  return { html, mount, styleIds: (b) => styleIds(b), cats: () => S.cats };
})();

// ⭐ تقييم أي نتيجة (سكريبت، فيديو…): «ممتاز» بيبقى مثال في عقل البراند، والملاحظة اللي بتتكرر بتتحول لقاعدة مقترحة.
// كل ده بيظهر نقط منوّرة على خريطة العقل ومحتاج موافقتك.
const BrainRate = (() => {
  const KEY = "studiomania.rated";
  const seen = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const mark = (ref, v) => { try { const s = seen(); s[ref] = v; localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const thumb = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function html({ kind = "", what = "", ref = "", text = "", compact = false }) {
    const v = ref ? seen()[ref] : "";
    return `<div class="br-rate${compact ? " compact" : ""}" data-kind="${escapeHtml(kind)}" data-what="${escapeHtml(what)}" data-ref="${escapeHtml(ref)}" data-text="${escapeHtml(text)}">
      ${compact ? "" : `<span class="br-q">النتيجة دي؟</span>`}
      <button type="button" data-rv="great" class="${v === "great" ? "on" : ""}" title="ممتاز (يتعلم منها)">★${compact ? "" : " ممتاز"}</button>
      <button type="button" data-rv="bad" class="${v === "bad" ? "on" : ""}" title="مش عاجبني (قول ليه)">${thumb}${compact ? "" : " مش عاجبني"}</button>
      <div class="br-why" hidden><div class="br-write" contenteditable="plaintext-only" data-ph="إيه اللي مش عاجبك؟ مثلًا: الجمل طويلة"></div><button type="button" data-rsend>ابعت</button></div>
    </div>`;
  }
  async function send(box, rating, note = "") {
    try {
      const r = await api("/api/feedback", { method: "POST", ...jsonBody({ rating, note, what: box.dataset.what, text: box.dataset.text, kind: box.dataset.kind, ref: box.dataset.ref }) });
      if (box.dataset.ref) mark(box.dataset.ref, rating);
      box.querySelectorAll("[data-rv]").forEach((b) => b.classList.toggle("on", b.dataset.rv === rating));
      box.querySelector(".br-why").hidden = true;
      toast(r.suggested ? "✓ اتسجّل، وفيه اقتراح جديد مستنيك في عقل البراند" : "✓ اتسجّل. العقل بيتعلم من تقييماتك");
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
