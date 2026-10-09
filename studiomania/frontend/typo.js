// StudioMania — 🔤 التايبوجرافي: الكلام ← حركات (بلوكات) ← معاينة حية بنفس محرّك الرسم ← فيديو.
// وكمان خطوة «🔤 التايبوجرافي» في معمل التفكيك (اللي بتطلّع الستايل والأيقونات من فيديو).

const tyx = { list: [], cur: null, stk: [], styles: [], view: "home", timer: null, eng: null, play: null, t: 0, open: {} };
const TY_KINDS = { track: "⭐ 🎬 كلام كبير على الخطوط", sign: "⭐ ✍️ سطر وإمضا", spot: "⭐ 🌟 نجمة وبقعة نور", pop: "💥 كلمة كبيرة", type: "⌨️ كتابة بمؤشر", build: "✨ كلمة كلمة", icon: "🖼️ كلمة وأيقونة", letters: "🔠 حرف بيتبدل بصورة", scatter: "🌪️ حروف بتتجمع", ring: "⭕ دايرة أيقونات", anchor: "📍 مندمج مع الفيديو",
  behind: "🎬 🧍 كلام عملاق ورا الشخص", arc: "🎬 🌙 كلام متقوّس حوالين الراس", artype: "🎬 ⌨️ كتابة بمؤشر برتقاني", redword: "🎬 🔴 كلمة حمرا واحدة", signature: "🎬 ✒️ إمضا بتتكتب",
  poster: "🎬 🟥 بوستر أحمر", stack: "🎬 📚 كومة كلام مايلة جنب الشخص", push: "🎬 ➡️ كلمة بتزق اللي قبلها", crt: "🎬 📺 شاشة قديمة وجلتش",
  ransom: "🎬 ✂️ حروف مقصوصة", halo: "🎬 ⭕ دايرة حوالين الراس", floor: "🎬 🛣️ كلام على الأرض", hand: "🎬 🖊️ خط إيد بيرتعش", tags: "🎬 🏷️ كلمات على مربعات حمرا",
  space: "🎬 🌌 كلام في فراغ 3D", route: "🎬 ✈️ خريطة ومسار وطيارة", board: "🎬 🧵 لوحة تحقيق", cube: "🎬 🧊 مكعب سلكي حوالين الشخص",
  comments: "🎬 💬 كومنتات على لوحة زجاج", lock: "🎬 🔒 كبسولة بقفل", thermal: "🎬 🌡️ كاميرا حرارية", shapes: "🎬 🎞️ أشكال فيلم بتترعش",
  select: "🎬 🖱️ مربع تحديد وماوس", chat: "🎬 📱 فقاعات شات", counter: "🎬 🔢 رقم بيعدّ",
  fill: "🎬 🖼️ الصورة جوه الحروف", polaroid: "🎬 📸 بولارويد بخط إيد", cards: "🎬 🃏 كروت طايرة 3D", burst: "🎬 💥 انفجار كوميكس",
  dots: "🎬 ✨ الشخص بيتحول لنقط", neon: "🎬 🔴 نيون ورا الشخص",
  outline: "🎬 🩷 كلمة بحدود بينك بتنط", spin: "🎬 🌀 حروف عملاقة بتلف", sweep: "🎬 💨 كلمة بتعدّي ودايرة نسخ", extrude: "🎬 🧱 كلام بينك 3D ومربع أسود",
  stories: "🎬 📲 كروت ستوري 3D", post: "🎬 🖼️ كارت بوست والكلام طالع منه",
  retro: "🎬 📰 بوستر قديم ونجمة حمرا", duotone: "🎬 🟦 فيديو أزرق وكلام ورا الشخص", label: "🎬 🏷️ كلمة حمرا وتاج أزرق", mirror: "🎬 🪞 كلمة وانعكاسها",
  banners: "🎬 🎗️ شرايط مايلة بتتحرك", tiles: "🎬 🔲 كروت صور وكارت أحمر", bubble: "🎬 💬 فقاعة كلام حمرا", band: "🎬 🟦 شريط أزرق ورا كلمة", emerge: "🎬 🗣️ الكلام بيطلع من ورا الراس",
  film: "🎬 🎞️ برواز فيلم", ghost: "🎬 👻 كلمة عملاقة باهتة ورا", notify: "🎬 🔔 إشعارات موبايل", dialog: "🎬 🖥️ رسالة نظام قديمة",
  pills: "🎬 💊 زراير لامعة والماوس", steps: "🎬 🔢 كروت مرقّمة", scribble: "🎬 ⭕ دايرة بالقلم", list: "🎬 📋 لستة بسهم",
  prompt: "🎬 🤖 مربع ذكاء اصطناعي", spread: "🎬 ✨ كلام متفرّق",
  serif: "🎬 🖋️ كلمة بخط سيريف مايل", chalk: "🎬 🧑‍🏫 سبورة طباشير", ticket: "🎬 🎟️ تذكرة سينما", frame: "🎬 🖼️ برواز دهب", toggle: "🎬 🔘 زرار تشغيل",
  years: "🎬 📅 أرقام بتلف", wave: "🎬 〰️ كلام على خط متعرج", spaced: "🎬 ↔️ كلام بمسافات واسعة", search: "🎬 🔎 خانة بحث", digits: "🎬 🔢 أرقام في مربعات",
  torn: "🎬 📜 شرايط ورق مقطوع", emoji: "🎬 😀 إيموجي على قد المعنى", doodle: "🎬 ✏️ خربشة بالقلم", browser: "🎬 🌐 شباك متصفح", split: "🎬 ↔️ قبل وبعد",
  spotlight: "🎬 🔦 كشاف نور", phone: "🎬 📱 موبايل",
  window: "🎬 🪟 الفيديو في برواز", inline: "🎬 🖼️ صورة جوه السطر", bigtype: "🎬 ⌨️ كلمة عملاقة بتتكتب", checks: "🎬 ✅ لستة بتتعلّم", progress: "🎬 📊 شرايط نسب",
  flow: "🎬 🔀 خطوات أوتوميشن", aura: "🎬 🌈 ألوان ناعمة", stairs: "🎬 🪜 كلمات زي السلم", dates: "🎬 📆 شريط أيام", endcard: "🎬 🏁 كارت النهاية", wintitle: "🎬 🪟 كلمة عملاقة على البرواز", corners: "🎬 📐 كلام في الركنين", inbox: "🎬 📥 صندوق رسايل", doc: "🎬 📝 دوكيومنت بهايلايتر", workcards: "🎬 📅 كارت موعد ورسالة وملف", call: "🎬 📞 مكالمة فيديو", canvas: "🎬 🗂️ لوحة كروت والكاميرا بتقرّب", colorcard: "🎬 🟦 كارت لون وكلام صغير", imsg: "🎬 📲 محادثة موبايل", dashboard: "🎬 📈 كارت داشبورد", apps: "🎬 🔌 تطبيقات بتتوصل", bell: "🎬 🔔 جرس والعداد بيزيد", chapter: "🎬 🔢 رقم فصل عملاق", sidepanel: "🎬 🗃️ فيديو وبانل جنبه", clones: "🎬 👯 الشخص متكرر", megapan: "🎬 🔠 كلمة عملاقة والكاميرا ماشية عليها", badge: "🎬 🔴 دايرة بأول حرف بتكبر", leaderboard: "🎬 🏆 لوحة ترتيب", donut: "🎬 🍩 دايرة نسبة", photowords: "🎬 🖼️ كلمات وصور طايرة", titlecard: "🎬 🎬 عنوان سينمائي بيتبني", departures: "🎬 🚆 لوحة مواعيد قطر", loading: "🎬 ⚙️ شاشة بيتعمل دلوقتي", countdown: "🎬 ⏳ عدّاد تنازلي", dragdrop: "🎬 🖐️ صور بتطير لمربع الكتابة", lineup: "🎬 🎤 قايمة أسامي كبيرة", isomap: "🎬 🗺️ خريطة أيزومتريك", stickers: "🎬 🏷️ كلمة عملاقة وتاجات مايلة", promptline: "🎬 ⌨️ سطر كتابة وزرار إرسال", crowd: "🎬 👥 بوستر بسيلويتات", photohero: "🎬 🖼️ صورة وكلمة عملاقة عليها", menu: "🎬 🖱️ قايمة منسدلة", pricing: "🎬 💲 اختيارات بأسعار", pins: "🎬 📍 نقط مرقّمة على صورة", result: "🎬 🔗 نتيجة بحث", calendar: "🎬 🗓️ كاليندر وموعد", mapdots: "🎬 🗺️ خريطة ودواير بتنبض", marker: "🎬 🖍️ عنوان بهايلايتر أصفر", lowerthird: "🎬 🪪 اسم ووظيفة تحت", cardwords: "🎬 🃏 كروت بكلمات عملاقة", bars: "🎬 📊 رسم بياني بيكبر", table: "🎬 🧾 جدول بتاجات", dayplan: "🎬 🕘 جدول اليوم", stutter: "🎬 🔁 كلمة بتتهته", section: "🎬 🔢 فصل كامل برقم ورمز", worklog: "🎬 📋 سجل شغل", toggles: "🎬 🔛 مفاتيح بتتفتح", checkout: "🎬 🛒 فاتورة وزرار الدفع", lockscreen: "🎬 📱 شاشة مقفولة وإشعارات", wizard: "🎬 🪜 خطوات بشريط تقدّم", wordroll: "🎬 🎰 كلمات بتلف رأسي", bignum: "🎬 🔢 رقم عملاق على الحرف", stickynote: "🎬 🗒️ ملاحظات متعلقة", colorpicker: "🎬 🎨 لوحة اختيار لون", uploads: "🎬 📎 ملفات بتترفع", timer: "🎬 ⏱️ تايمر تنازلي", anchorword: "🎬 🅱️ كلمة ضخمة تحت", orders: "🎬 🧾 تذاكر طلبات", stats: "🎬 🔢 دواير أرقام", duo: "🎬 🪟 شاشتين جنب بعض", route: "🎬 🗺️ طريق على الخريطة", flank: "🎬 ▫️ كلمة بين كادرين", flood: "🎬 📆 نتيجة بتتزحم", chips: "🎬 ▪️ شرايح كلمات", wordtiles: "🎬 🧩 بلاطات كلمات", profile: "🎬 👤 كارت بروفايل", bigbutton: "🎬 🔘 زرار عملاق", gauge: "🎬 ⭕ عداد دايري", rule: "🎬 ⚡ جملة أتمتة", iconrow: "🎬 ✳️ صف أيقونات", led: "🎬 🔴 أرقام ديجيتال", drop: "🎬 🚀 عداد إطلاق", report: "🎬 📡 كارت تقرير مباشر", serp: "🎬 🔍 نتيجة بحث", files: "🎬 🗂️ قايمة ملفات بتتحدد", generating: "🎬 🖼️ صور بتتعمل", portfolio: "🎬 📷 صفحة بورتفوليو" };
// العناصر اللي ليها «الكلمة اللي عليها الضغط»
const TY_FOCUS = ["sign", "spot", "arc", "artype", "stack", "halo", "space", "cube", "lock", "outline", "label", "tiles", "bubble", "film", "ghost", "scribble", "spread",
  "serif", "toggle", "emoji", "doodle", "spotlight", "frame", "years", "digits", "spaced", "phone", "browser", "inline", "endcard", "wintitle", "megapan", "badge", "photohero", "result", "marker", "stutter", "anchorword"];
const TY_TRANS = { "": "من غير ترانزيشن", whip: "💨 سحبة سريعة", zoom: "🔍 زووم داخل", glitch: "📺 جلتش", flash: "⚡ فلاش", iris: "⭕ دايرة بتفتح",
  leak: "🌅 تسريب نور", burn: "🔥 حرق فيلم", rise: "⬆️ طالع من تحت", wipe: "🟧 مسحة لون", blur: "🌫️ بلير", pop: "🫧 نطة من جوه" };
const TY_INTRO = { track: { "": "من غير افتتاح", flash: "⚡ افتتاح بفلاشات" }, spot: { "": "من غير فلاش", burst: "💛 فلاش أصفر قبلها" } };
const TY_OUTRO = { track: { "": "من غير قفلة", pixel: "▦ تتكسّر بكسلات" }, spot: { "": "من غير قفلة", red: "🔴 فلاش أحمر في الآخر" } };
const TY_PLACES = { auto: "📍 مكان الكلام: البرنامج يختار", left: "⬅️ شمالها", right: "➡️ يمينها", above: "⬆️ فوقها", below: "⬇️ تحتها", on: "📝 عليها" };
const TY_AKINDS = { photo: "🖼️ صورة", paper: "📄 ورقة", screen: "📱 شاشة", object: "📦 حاجة", product: "🛍️ منتج", face: "🙂 وش", person: "🧍 شخص", sign: "🪧 يافطة", space: "⬜ مساحة فاضية" };
const TY_THEMES = { light: "☀️ فاتح", dark: "🌙 غامق", accent: "🟨 ملوّن" };
const TY_BG = { theme: "🎨 ألوان الستايل", solid: "🟦 لون سادة", image: "🖼️ صورة", video: "🎬 فيديو", source: "🎥 الفيديو المرفوع" };
const TY_ST = { new: "", ready: "📝 الكلام جاهز", planned: "🧠 الحركات جاهزة", done: "✅ الفيديو جاهز", failed: "⚠️ فشل",
  transcribing: "🎧 بيسمع", analyzing: "👁️ بيحلل الفيديو", planning: "🧠 بيوزّع", drawing: "🎨 بيرسم الأيقونات", rendering: "🎬 بيعمل الفيديو" };
const tye = (v) => escapeHtml(v == null ? "" : String(v));
const tyT = (t) => `${Math.floor((t || 0) / 60)}:${((t || 0) % 60).toFixed(1).padStart(4, "0")}`;
const TY = (p) => `/api/typo${p}`;

viewHooks["12"] = initTypo;

async function initTypo() {
  try {
    [tyx.list, tyx.stk, tyx.styles, tyx.sfx] = await Promise.all([api(TY("")), api(TY("/stickers")), api(TY("/styles")), api(TY("/sfx")).catch(() => null)]);
  } catch (err) { return toast(err.message, true); }
  const last = storageGet("studiomania.typo");
  if (!tyx.cur && last && tyx.list.some((p) => p.id === last)) await tyOpen(last);
  tyRender();
}

async function tyOpen(id) {
  tyStop();
  tyx.cur = await api(TY(`/${id}`));
  tyx.view = "proj";
  storageSet("studiomania.typo", id);
  tyRender();
  tyPoll();
}

function tyRender() {
  $("tyStkCount").textContent = tyx.stk.length ? `(${tyx.stk.length})` : "";
  $("tyList").innerHTML = tyx.list.map((p) => `<li class="${tyx.cur?.id === p.id && tyx.view === "proj" ? "active" : ""}" data-tyopen="${p.id}">
    <b data-no-i18n>${tye(p.name)}</b><small class="muted">${p.ratio} · ${TY_ST[p.status] || ""}</small></li>`).join("") || `<li class="muted">لسه مفيش</li>`;
  $("tyMain").hidden = tyx.view !== "proj" || !tyx.cur;
  $("tyStk").hidden = tyx.view !== "stk";
  $("tySfx").hidden = tyx.view !== "sfx";
  if (tyx.sfx) $("tySfxCount").textContent = `(${Object.values(tyx.sfx).flat().length})`;
  $("tyEmpty").hidden = !(tyx.view === "home" || (tyx.view === "proj" && !tyx.cur));
  if (tyx.view === "stk") tyRenderStk();
  if (tyx.view === "sfx") tyRenderSfx();
  if (tyx.view === "proj" && tyx.cur) tyRenderProj();
}

// ---------- المشروع

function tyStickerUrl(name) {
  const s = tyx.stk.find((x) => x.id === name) || tyx.stk.find((x) => x.name === name);
  return s?.url || null;
}

function tyIconChip(name, attr) {
  const url = tyStickerUrl(name);
  return `<span class="ty-chip ${url ? "" : "miss"}" ${attr || ""} title="${tye(name)}">${url ? `<img src="${url}" alt="">` : "❔"}<small data-no-i18n>${tye(url ? (tyx.stk.find((x) => x.id === name || x.name === name)?.name) : name)}</small></span>`;
}

function tyRenderProj() {
  const v = tyx.cur, busy = v.busy, el = $("tyMain");
  const keep = el.contains(document.activeElement) && document.activeElement.matches("input, textarea, select");
  if (keep && !tyx.force) return tyStatusOnly();
  tyx.force = false;
  const kindTxt = v.source?.kind === "video" ? `🎬 ${tye(v.source.name || "فيديو")}` : v.source?.kind === "audio" ? `🎙️ ${tye(v.source.name || "صوت")}` : "";
  const bg = v.bg || { kind: "theme" };
  const stOpts = tyx.styles.map((s) => `<option value="${s.id}" ${s.id === v.style ? "selected" : ""}>${tye(s.name)}</option>`).join("");
  el.innerHTML = `<div class="car-head"><input class="ad-title" data-tyname value="${tye(v.name)}" data-no-i18n>
      <div class="row wrap">${v.final_url ? `<a class="btn sm" href="${v.final_url}" download="${tye(v.name)}.mp4">⬇️ نزّل</a>
        <button type="button" class="btn sm primary" data-tyedit>🎞️ انقل للمونتاج</button>` : ""}
        <button type="button" class="btn sm danger" data-tydel ${busy ? "disabled" : ""}>🗑️</button></div></div>
    <div class="fm-status" id="tyStatus"></div>
    <div class="row wrap tv-opts">
      <label>المقاس <select data-tyopt="ratio">${v.ratios.map((r) => `<option ${r === v.ratio ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      <label>الستايل <select data-tyopt="style">${stOpts}</select></label>
      <label title="من غير ذكاء اصطناعي: الحركات بالقواعد، والأيقونات من القاموس بس، والكلام بيتفرّغ على السيرفر لو متفعّل">الذكاء <select data-tyopt="ai">
        <option value="smart" ${v.ai !== "off" ? "selected" : ""}>🤖 ذكي</option><option value="off" ${v.ai === "off" ? "selected" : ""}>⚙️ من غير ذكاء اصطناعي</option></select></label>
      <label title="0 = مفيش كليكات خالص، 100 = كليك على كل كلمة، وما بينهم الكليكات بتقل أو تكتر">🔊 الكليكات
        <input type="range" min="0" max="100" step="5" data-tysfx value="${v.sound?.sfx_level ?? (v.sfx === "off" ? 0 : 100)}">
        <b data-tysfxval>${v.sound?.sfx_level ?? (v.sfx === "off" ? 0 : 100)}</b></label>
      ${tyx.styles.find((x) => x.id === v.style)?.pro && TypoEngine.MOMENT_FONTS ? `
        <label>خط الإنجليزي <select data-tyfont="sans">${TypoEngine.MOMENT_FONTS.latin.map(([f, l]) => `<option value="${f}" ${f === (v.fonts?.sans || "TY Outfit") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>خط العربي <select data-tyfont="sansAr">${TypoEngine.MOMENT_FONTS.arabic.map(([f, l]) => `<option value="${f}" ${f === (v.fonts?.sansAr || "TY Alexandria") ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
      <label>الخلفية <select data-tybg="kind">${Object.entries(TY_BG).filter(([k]) => k !== "source" || v.source?.kind === "video")
        .map(([k, l]) => `<option value="${k}" ${k === bg.kind ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${bg.kind === "solid" ? `<label>اللون <input type="color" data-tybg="color" value="${tye(bg.color || "#101010")}"></label>` : ""}
      ${bg.kind === "image" || bg.kind === "video" ? `<label class="btn sm">⬆ ${bg.file ? "غيّر" : "ارفع"} ${bg.kind === "image" ? "الصورة" : "الفيديو"}
        <input type="file" data-tybgfile accept="${bg.kind === "image" ? "image/*" : "video/*"}" hidden></label>` : ""}
      ${["image", "video", "source"].includes(bg.kind) ? `<label>تغميق <input type="range" min="0" max="0.8" step="0.05" data-tybg="dim" value="${bg.dim || 0}"></label>` : ""}
    </div>
    <details class="panel tv-step" ${tyx.open.s1 ?? !v.words?.length ? "open" : ""} data-tydk="s1"><summary>١. 🗣️ الكلام <small class="muted">${v.words?.length ? `${v.words.length} كلمة · ${tyT(v.duration)}` : ""} ${kindTxt}</small></summary>
      <p class="hint">اكتب الكلام (وكل كلمة بتاخد وقت تقريبي)، أو ارفع صوت أو فيديو والكلام بيتكتب بتوقيته. لو رفعت فيديو، التايبوجرافي بيتركب فوقه.</p>
      ${v.source?.kind === "audio" || v.source?.kind === "video" ? `<p class="ty-words" dir="auto" data-no-i18n>${(v.words || []).map((w) => tye(w.w)).join(" ")}</p>`
        : `<textarea rows="4" dir="auto" data-tytext placeholder="الكلام اللي هيتحوّل لتايبوجرافي" data-no-i18n>${tye(v.script || "")}</textarea>
           <button type="button" class="btn sm" data-tysavetext ${busy ? "disabled" : ""}>✍️ استخدم الكلام ده</button>`}
      <label class="btn sm">⬆ ارفع صوت أو فيديو<input type="file" data-tysrc accept="audio/*,video/*,.mp3,.m4a,.wav,.mp4,.mov" hidden></label>
      ${v.source_url && v.source?.kind !== "text" ? (v.source.kind === "video" ? `<video src="${v.source_url}" controls playsinline preload="metadata" class="ty-src"></video>`
        : `<audio src="${v.source_url}" controls preload="metadata"></audio>`) : ""}
    </details>
    ${v.source?.kind === "video" ? tySceneView(v, busy) : ""}
    <details class="panel tv-step" ${tyx.open.s2 ?? !!v.words?.length ? "open" : ""} data-tydk="s2"><summary>٢. 🧠 الحركات <small class="muted">${v.blocks?.length ? `${v.blocks.length} لقطة` : ""}</small></summary>
      <div class="row wrap"><input type="text" data-tybrief placeholder="عن الفيديو (اختياري): مين بيتكلم ولمين وإيه الإحساس" value="${tye(v.brief || "")}" data-no-i18n>
        <button type="button" class="btn primary" data-typlan ${busy || !v.words?.length ? "disabled" : ""}>🧠 ${v.blocks?.length ? "وزّعه من جديد" : "وزّع الكلام على الحركات"}</button></div>
      ${v.missing_icons?.length ? `<div class="ty-miss"><span>أيقونات مش في المكتبة: ${v.missing_icons.map((n) => tyIconChip(n)).join("")}</span>
        <button type="button" class="btn sm primary" data-tyicons ${busy ? "disabled" : ""}>🎨 ارسمهم (~${v.draw_cost}$)</button></div>` : ""}
      <div class="ty-blocks">${(v.blocks || []).map((b, i) => tyBlockRow(v, b, i)).join("")}</div>
    </details>
    ${v.blocks?.length ? `<section class="panel ty-preview">
      <div class="ty-screen" id="tyScreen"><div class="ty-box" id="tyBox" style="touch-action:none;cursor:grab"><div class="ty-bg" id="tyBg"></div><div id="tyStage"></div></div></div>
      <p class="hint">✋ اسحب الكلام في المعاينة عشان تغيّر مكانه، وحجمه من «حجم الكلام» في اللقطة نفسها</p>
      <div class="ty-ctrl"><button type="button" class="btn sm" data-typlay>▶️</button>
        <input type="range" min="0" max="${v.duration}" step="0.01" value="${tyx.t}" data-tyscrub><small class="muted" id="tyTime"></small></div>
      <div class="row wrap"><select data-tyq><option value="high">جودة كاملة (1080)</option><option value="fast">أسرع (720)</option></select>
        <button type="button" class="btn primary" data-tyrender ${busy ? "disabled" : ""}>🎬 ${v.final_url ? "اعمل الفيديو تاني" : "اعمل الفيديو"}</button>
        <small class="muted">المعاينة هنا بنفس الرسم اللي هيطلع في الفيديو. الفيديو بيترسم على السيرفر فريم فريم (دقيقة تقريبًا لكل 15 ثانية).</small></div>
      ${tySoundLine(v.sound)}
      ${v.final_url ? `<video src="${v.final_url}" controls playsinline preload="metadata" class="ty-final"></video>` : ""}
    </section>` : ""}`;
  tyStatusOnly();
  tyMountPreview();
}

function tySceneView(v, busy) {
  const an = v.scene?.anchors;
  return `<details class="panel tv-step" ${tyx.open.s15 ?? true ? "open" : ""} data-tydk="s15"><summary>👁️ اللي في الفيديو <small class="muted">${an ? `${an.length} حاجة` : "لسه ما اتحللش"}</small></summary>
    <p class="hint">البرنامج بيشوف الحاجات اللي في الكادر (صورة، ورقة، شاشة، وش...) وأماكنها وهي بتتحرك، عشان الكلام يتكتب جنبها أو عليها، والكلمة اللي بتشاور على حاجة (زي «me» وفيه صورتك) ما تتكتبش والحاجة نفسها تبقى مكانها. بيتعمل لوحده مع «🧠 وزّع».</p>
    <div class="row wrap"><button type="button" class="btn sm" data-tyscene ${busy ? "disabled" : ""}>👁️ ${an ? "حلّله من جديد" : "حلّل الفيديو"}</button>
      <label class="ty-check"><input type="checkbox" data-tyguides ${tyx.guides ? "checked" : ""}> اعرض أماكنها على المعاينة</label></div>
    ${v.scene ? `<p class="hint">${!v.scene.person?.present ? "🧍 مفيش شخص ظاهر بوضوح في الفيديو"
      : v.scene.person.model === "video" ? "🧍 الشخص اتقرا بموديل الفيديو ✓"
      : "🧍 الشخص اتقرا بالموديل القديم (حلّل الفيديو تاني بعد تحديث السيرفر)"}</p>` : ""}
    ${an?.length ? `<div class="ty-anchors">${an.map((a) => `<figure class="ty-anchor" data-tyseek="${a.t0}">${a.thumb_url ? `<img src="${a.thumb_url}" alt="">` : ""}
      <figcaption><b>${a.id}</b> ${TY_AKINDS[a.kind] || a.kind}<small dir="ltr" data-no-i18n>${tye(a.label)}</small><small class="muted">${tyT(a.t0)} ← ${tyT(a.t1)}</small></figcaption></figure>`).join("")}</div>` : ""}
  </details>`;
}

function tyBlockRow(v, b, i) {
  const icons = b.kind === "letters" || b.kind === "ring" || b.kind === "spot" ? b.icons || [] : b.kind === "icon" ? [b.icon].filter(Boolean) : [];
  const side = b.kind === "build" ? [b.side].filter(Boolean) : [];
  const stkOpts = `<option value="">＋ ستيكر</option>` + tyx.stk.map((s) => `<option value="${s.id}">${tye(s.name)}</option>`).join("");
  return `<article class="ty-block" data-tyb="${i}">
    <header><button type="button" class="btn sm" data-tyseek="${b.t0}">▶️ ${tyT(b.t0)}</button>
      <select data-tbf="kind">${Object.entries(TY_KINDS).map(([k, l]) => `<option value="${k}" ${k === b.kind ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select data-tbf="theme">${Object.entries(TY_THEMES).map(([k, l]) => `<option value="${k}" ${k === b.theme ? "selected" : ""}>${l}</option>`).join("")}</select>
      <small class="muted" dir="auto" data-no-i18n>«${tye((b.words || []).map((w) => w.w).join(" "))}»</small>
      ${i < v.blocks.length - 1 ? `<button type="button" class="btn sm" data-tymerge="${i}" title="يضم اللقطة دي مع اللي بعدها">⤵ ضم</button>` : ""}
      ${(b.to - b.from) >= 1 ? `<button type="button" class="btn sm" data-tysplit="${i}" title="يقسم اللقطة نصين">✂️ قسّم</button>` : ""}</header>
    ${v.scene?.anchors?.length && v.bg?.kind === "source" ? `<div class="row wrap">
      <select data-tbf="anchor"><option value="">📍 من غير مرساة (نص الشاشة)</option>${v.scene.anchors.map((a) => `<option value="${a.id}" ${a.id === b.anchor ? "selected" : ""}>📍 ${a.id} · ${TY_AKINDS[a.kind] || a.kind} · ${tye(a.label)}</option>`).join("")}</select>
      ${b.anchor ? `<select data-tbf="place">${Object.entries(TY_PLACES).map(([k, l]) => `<option value="${k}" ${k === (b.place || "auto") ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
      ${b.anchor && b.kind === "anchor" ? `<label>الكلمة اللي الحاجة نفسها مكانها <select data-tbf="skip"><option value="-1">—</option>${(b.words || []).map((w, j) => `<option value="${j}" ${j === b.skip ? "selected" : ""}>${tye(w.w)}</option>`).join("")}</select></label>` : ""}
    </div>` : ""}
    ${TY_INTRO[b.kind] || b.kind === "sign" || b.kind === "signature" || TY_FOCUS.includes(b.kind) ? `<div class="row wrap">
      ${TY_INTRO[b.kind] ? `<select data-tbf="intro">${Object.entries(TY_INTRO[b.kind]).map(([k, l]) => `<option value="${k}" ${k === (b.intro || "") ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select data-tbf="outro">${Object.entries(TY_OUTRO[b.kind]).map(([k, l]) => `<option value="${k}" ${k === (b.outro || "") ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
      ${TY_FOCUS.includes(b.kind) ? `<label>الكلمة اللي عليها الضغط <select data-tbf="focus"><option value="-1">—</option>${(b.words || []).map((w, j) => `<option value="${j}" ${j === b.focus ? "selected" : ""}>${tye(w.w)}</option>`).join("")}</select></label>` : ""}
      ${b.kind === "sign" || b.kind === "signature" ? `<label>الإمضا <input data-tbf="sign" value="${tye(b.sign || "")}" dir="auto" data-no-i18n></label>` : ""}
    </div>` : ""}
    <div class="row wrap"><label>📐 حجم الكلام <input type="range" min="0.3" max="2.5" step="0.05" data-tbf="ms" value="${b.ms ?? 1}"></label>
      ${window.TypoEngine?.STUDIO?.has(b.kind) ? `<label>🎞️ الدخول <select data-tbf="trans">${Object.entries(TY_TRANS).map(([k, l]) => `<option value="${k}" ${k === (b.trans || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
      ${(b.mx || b.my || (b.ms ?? 1) !== 1) ? `<button type="button" class="btn sm" data-tyreset="${i}">↺ رجّع المكان والحجم</button>` : ""}</div>
    <div class="row wrap"><label>المكتوب <input data-tbf="text" value="${tye(b.text)}" dir="auto" data-no-i18n></label>
      ${b.kind === "build" ? `<label>الكلمة اللي تنوّر <select data-tbf="focus"><option value="-1">—</option>${(b.words || []).map((w, j) => `<option value="${j}" ${j === b.focus ? "selected" : ""}>${tye(w.w)}</option>`).join("")}</select></label>` : ""}
      ${b.kind === "letters" ? `<label>الحرف اللي يتبدل <input type="number" min="0" max="20" data-tbf="letter" value="${b.letter ?? 1}"></label>` : ""}
      ${["icon", "letters", "ring", "spot"].includes(b.kind) ? `<span class="ty-icons">${icons.map((n, j) => tyIconChip(n, `data-tyrm="${j}"`)).join("")}
        <select data-tyadd>${stkOpts}</select></span>` : ""}
      ${b.kind === "build" ? `<span class="ty-icons">${side.map((n) => tyIconChip(n, 'data-tyrmside="1"')).join("")}${side.length ? "" : `<select data-tyside>${stkOpts.replace("＋ ستيكر", "＋ صورة جنب الكلام")}</select>`}</span>` : ""}
    </div></article>`;
}

function tyStatusOnly() {
  const v = tyx.cur, el = $("tyStatus");
  if (!el) return;
  el.innerHTML = `<span class="lab-st ${v.busy ? "working" : v.status}">${v.busy ? `<span class="spin-inline"></span>` : ""} ${TY_ST[v.status] || ""}</span>
    ${v.step ? `<small class="muted">${tye(v.step)}</small>` : ""}${v.error ? `<small class="err">${tye(v.error)}</small>` : ""}`;
}

// ⬆ رفع ملف بشريط تقدم ونسبة (الفيديو الطويل بياخد وقت، فلازم يبان إنه شغال)، والغلط بيظهر برسالة
function tyUpload(url, file) {
  return new Promise((resolve, reject) => {
    const el = $("tyStatus");
    const mb = (file.size / 1048576).toFixed(1);
    const show = (pct) => {
      if (el) el.innerHTML = `<span class="lab-st working"><span class="spin-inline"></span> ⬆ بيرفع ${tye(file.name)} (${mb} ميجا): ${pct}%</span>
        <span class="bar" style="display:inline-block;width:160px;height:6px;border-radius:3px;background:rgba(127,127,127,.25);vertical-align:middle;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:var(--accent,#3b82f6)"></i></span>`;
    };
    show(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) show(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* مش JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) { toast("✅ اترفع"); resolve(data); }
      else reject(new Error(typeof data.detail === "string" ? data.detail : `الرفع فشل (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("الرفع وقف: اتأكد من النت وجرب تاني"));
    xhr.ontimeout = () => reject(new Error("الرفع خد وقت طويل جدًا: جرب فيديو أصغر"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

// 🔊 الصوت اللي هيبقى في الفيديو النهائي (عشان لو حاجة ناقصة تبان قبل ما تعمل الفيديو)
function tySoundLine(sd) {
  if (!sd) return "";
  const n = (sd.sfx?.click || 0) + (sd.sfx?.key || 0) + (sd.sfx?.typing || 0);
  const voice = sd.voice === "source" ? "🎙️ صوت الفيديو" : sd.voice === "bg" ? "🎙️ صوت فيديو الخلفية"
    : sd.voice === "silent" ? "⚠️ الفيديو اللي رفعته مفيهوش صوت (لو ده «الصورة بس» من المعمل، ارفع الفيديو الأصلي)" : "🔇 مفيش صوت كلام (الكلام مكتوب)";
  const fx = !sd.sfx_on ? "🔇 من غير كليكات" : n ? `🔊 الكليكات ${sd.sfx_level ?? 100}٪ (${n} صوت في المكتبة)` : "⚠️ مكتبة الأصوات فاضية على السيرفر: ارفعها تاني من «🔊 الأصوات»";
  return `<p class="hint">${voice} · ${fx}</p>`;
}

// ---------- المعاينة الحية (نفس المحرك اللي بيرسم الفيديو)

async function tyMountPreview() {
  const v = tyx.cur, stage = $("tyStage");
  if (!stage) return;
  const doc = await api(TY(`/${v.id}/doc`));
  tyx.eng = new TypoEngine(stage, doc);
  Object.assign(stage.style, { position: "absolute", left: "0", top: "0" });
  tyx.eng.showAnchors = !!tyx.guides;   // الصفحة عربي (RTL): المسرح يفضل من الشمال
  tyx.doc = doc;
  const screen = $("tyScreen");
  const fit = () => {
    const k = Math.min(screen.clientWidth / doc.w, 560 / doc.h);
    stage.style.transform = `scale(${k})`;
    stage.style.transformOrigin = "top left";
    Object.assign($("tyBox").style, { width: `${doc.w * k}px`, height: `${doc.h * k}px` });
  };
  fit();
  const bg = v.bg || {}, bgEl = $("tyBg");
  bgEl.innerHTML = !doc.transparent ? "" : bg.kind === "solid" ? `<div style="position:absolute;inset:0;background:${tye(bg.color)}"></div>`
    : bg.kind === "image" && v.bg_url ? `<img src="${v.bg_url}">` : (bg.kind === "video" && v.bg_url) || (bg.kind === "source" && v.source_url)
      ? `<video src="${bg.kind === "source" ? v.source_url : v.bg_url}" muted playsinline preload="auto"></video>` : `<div style="position:absolute;inset:0;background:#111"></div>`;
  if (bg.dim && doc.transparent) bgEl.insertAdjacentHTML("beforeend", `<div style="position:absolute;inset:0;background:#000;opacity:${bg.dim}"></div>`);
  await tyx.eng.ready();
  tySeek(tyx.t);
  tyDrag($("tyBox"), doc);
}

// ✋ سحب الكلام في المعاينة: بيحرك كلام اللقطة اللي ظاهرة دلوقتي، وبيتحفظ أول ما تسيب
function tyDrag(box, doc) {
  if (!box || box.dataset.drag) return;
  box.dataset.drag = "1";
  let d = null;
  box.addEventListener("pointerdown", (e) => {
    const i = (doc.blocks || []).findIndex((b) => tyx.t >= b.t0 && tyx.t < b.t1);
    if (i < 0) return;
    tyStop();
    const r = box.getBoundingClientRect();
    d = { i, x: e.clientX, y: e.clientY, mx: Number(doc.blocks[i].mx) || 0, my: Number(doc.blocks[i].my) || 0, kw: r.width, kh: r.height };
    box.setPointerCapture(e.pointerId);
    box.style.cursor = "grabbing";
  });
  box.addEventListener("pointermove", (e) => {
    if (!d) return;
    const b = doc.blocks[d.i];
    b.mx = Math.max(-0.6, Math.min(0.6, d.mx + (e.clientX - d.x) / d.kw));
    b.my = Math.max(-0.6, Math.min(0.6, d.my + (e.clientY - d.y) / d.kh));
    tyx.eng.renderAt(tyx.t);
  });
  const end = () => {
    if (!d) return;
    const { i } = d, b = doc.blocks[i];
    d = null;
    box.style.cursor = "grab";
    const blocks = JSON.parse(JSON.stringify(tyx.cur.blocks));
    if (!blocks[i] || (Math.abs((blocks[i].mx || 0) - b.mx) < 0.002 && Math.abs((blocks[i].my || 0) - b.my) < 0.002)) return;
    Object.assign(blocks[i], { mx: Math.round(b.mx * 1000) / 1000, my: Math.round(b.my * 1000) / 1000 });
    tySaveBlocks(blocks, "✋ مكان الكلام اتحفظ");
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", end);
}

function tySeek(t) {
  if (!tyx.eng) return;
  tyx.t = Math.max(0, Math.min(t, tyx.doc.duration));
  tyx.eng.renderAt(tyx.t);
  const s = document.querySelector("[data-tyscrub]");
  if (s) s.value = tyx.t;
  const tm = $("tyTime");
  if (tm) tm.textContent = `${tyT(tyx.t)} / ${tyT(tyx.doc.duration)}`;
  const bv = $("tyBg")?.querySelector("video");
  if (bv && !tyx.play) { try { bv.currentTime = tyx.t % (bv.duration || 1e9); } catch { /* لسه بيحمّل */ } }
}

function tyStop() {
  if (tyx.play) cancelAnimationFrame(tyx.play.raf);
  tyx.play?.audio?.pause();
  $("tyBg")?.querySelector("video")?.pause();
  tyx.play = null;
  const b = document.querySelector("[data-typlay]");
  if (b) b.textContent = "▶️";
}

function tyStart() {
  if (!tyx.eng) return;
  if (tyx.t >= tyx.doc.duration - 0.05) tyx.t = 0;
  const v = tyx.cur;
  let audio = null;
  if (v.source_url && v.source?.kind !== "text") {
    audio = new Audio(v.source_url);
    audio.currentTime = tyx.t;
    audio.play().catch(() => {});
  }
  const bv = $("tyBg")?.querySelector("video");
  if (bv) { bv.currentTime = tyx.t; bv.play().catch(() => {}); }
  const t0 = performance.now() - tyx.t * 1000;
  tyx.play = { audio };
  const tick = (now) => {
    if (!tyx.play) return;
    const t = audio && !audio.paused ? audio.currentTime : (now - t0) / 1000;
    tySeek(t);
    if (t >= tyx.doc.duration) return tyStop();
    tyx.play.raf = requestAnimationFrame(tick);
  };
  tyx.play.raf = requestAnimationFrame(tick);
  document.querySelector("[data-typlay]").textContent = "⏸";
}

// ---------- تعديل البلوكات

function tyBlocksFromDom() {
  const blocks = JSON.parse(JSON.stringify(tyx.cur.blocks));
  document.querySelectorAll("#tyMain [data-tyb]").forEach((card) => {
    const b = blocks[Number(card.dataset.tyb)];
    card.querySelectorAll("[data-tbf]").forEach((x) => {
      const k = x.dataset.tbf;
      b[k] = ["focus", "letter", "skip", "ms"].includes(k) ? Number(x.value) : x.value;
    });
  });
  return blocks;
}

async function tySaveBlocks(blocks, msg) {
  try {
    tyStop();
    tyx.cur = await api(TY(`/${tyx.cur.id}`), { method: "PATCH", ...jsonBody({ blocks }) });
    tyx.force = true;
    tyRender();
    if (msg) toast(msg);
  } catch (err) { toast(err.message, true); }
}

async function tyPatch(body) {
  tyStop();
  tyx.cur = await api(TY(`/${tyx.cur.id}`), { method: "PATCH", ...jsonBody(body) });
  tyx.force = true;
  tyRender();
}

function tyPoll() {
  clearTimeout(tyx.timer);
  if (!tyx.cur?.busy || document.querySelector('.view[data-view="12"]').hidden) return;
  tyx.timer = setTimeout(async () => {
    try {
      const was = tyx.cur.status;
      tyx.cur = await api(TY(`/${tyx.cur.id}`));
      if (!tyx.cur.busy) {
        [tyx.list, tyx.stk] = await Promise.all([api(TY("")), api(TY("/stickers"))]);
        tyx.force = true;
        tyRender();
        if (tyx.cur.status === "failed") toast(tyx.cur.error || "فشل", true);
        else if (was === "rendering") toast("🎬 الفيديو جاهز");
      } else tyStatusOnly();
    } catch { /* السيرفر بيعيد التشغيل */ }
    tyPoll();
  }, 1500);
}

$("tyNew").onclick = async () => {
  const name = prompt("اسم الفيديو:", "تايبوجرافي");
  if (name === null) return;
  try {
    const v = await api(TY(""), { method: "POST", ...jsonBody({ name, ratio: "9:16", style: tyx.styles[0]?.id || "mono-red" }) });
    tyx.list = await api(TY(""));
    await tyOpen(v.id);
  } catch (err) { toast(err.message, true); }
};

// ---------- 🔊 الأصوات الرسمية
const TY_SFX = { click: ["🖱️ كليكات", "على كل كلمة أو حرف أو عنصر بيظهر أو بيختفي (البرنامج بيبدّل بينهم)"],
  key: ["⌨️ ضغطات كيبورد", "على كتابة الرسايل بس (حرف حرف)"], typing: ["💬 تايبينج", "صوت كتابة رسالة كامل (احتياطي لو مفيش ضغطات)"] };
function tyRenderSfx() {
  const lib = tyx.sfx || {};
  $("tySfx").innerHTML = `<div class="car-head"><h2>🔊 الأصوات الرسمية <small class="muted">${Object.values(lib).flat().length}</small></h2>
      <label class="btn sm primary">⬆ ارفع wav أو zip<input type="file" data-sfxup accept=".wav,.zip,audio/wav" multiple hidden></label></div>
    <p class="hint">اسم الملف بيحدد هو بيتحط فين: <b>click_</b>… كليك ظهور واختفاء · <b>key_</b>… ضغطة كيبورد · <b>typing_</b>… كتابة رسالة. الأصوات بتتحط لوحدها لما تعمل الفيديو، وتقدر تقفلها من «الأصوات» في المشروع.</p>
    ${Object.entries(TY_SFX).map(([k, [l, h]]) => `<section class="ty-sfx"><h3>${l} <small class="muted">${(lib[k] || []).length} · ${h}</small></h3>
      <div class="ty-sfx-list">${(lib[k] || []).map((f) => `<div class="ty-sfx-row"><button type="button" class="btn sm" data-sfxplay="${f.url}">▶️</button>
        <span data-no-i18n>${tye(f.name)}</span><button type="button" class="btn sm danger" data-sfxdel="${tye(f.name)}">🗑️</button></div>`).join("") || `<p class="muted">لسه مفيش.</p>`}</div></section>`).join("")}`;
}
$("tySfxBtn").onclick = async () => {
  tyStop();
  tyx.view = "sfx";
  tyx.sfx = await api(TY("/sfx"));
  tyRender();
};
$("tySfx").addEventListener("click", async (e) => {
  const pl = e.target.closest("[data-sfxplay]");
  if (pl) { new Audio(pl.dataset.sfxplay).play().catch(() => {}); return; }
  const del = e.target.closest("[data-sfxdel]");
  if (del && confirm(`تمسح ${del.dataset.sfxdel}؟`)) {
    try { tyx.sfx = await api(TY(`/sfx/${encodeURIComponent(del.dataset.sfxdel)}`), { method: "DELETE" }); tyRender(); } catch (err) { toast(err.message, true); }
  }
});
$("tySfx").addEventListener("change", async (e) => {
  if (!e.target.matches("[data-sfxup]") || !e.target.files.length) return;
  const fd = new FormData();
  for (const f of e.target.files) fd.append("files", f);
  e.target.value = "";
  try {
    const r = await api(TY("/sfx"), { method: "POST", body: fd });
    tyx.sfx = r; toast(`🔊 اتضاف ${r.added.length} صوت`); tyRender();
  } catch (err) { toast(err.message, true); }
});

$("tyStkBtn").onclick = async () => {
  tyStop();
  tyx.view = "stk";
  [tyx.stk, tyx.dict] = await Promise.all([api(TY("/stickers")), api(TY("/concepts"))]);
  tyRender();
};

$("tyList").addEventListener("click", (e) => {
  const li = e.target.closest("[data-tyopen]");
  if (li) tyOpen(li.dataset.tyopen).catch((err) => toast(err.message, true));
});

$("tyMain").addEventListener("toggle", (e) => {
  const d = e.target.closest?.("[data-tydk]");
  if (d) tyx.open[d.dataset.tydk] = d.open;
}, true);

$("tyMain").addEventListener("click", async (e) => {
  const t = e.target, v = tyx.cur;
  const wrap = (btn, fn) => busyButton(btn, "⏳", async () => { try { await fn(); } catch (err) { toast(err.message, true); } });
  const play = t.closest("[data-typlay]");
  if (play) return tyx.play ? tyStop() : tyStart();
  const rs = t.closest("[data-tyreset]");
  if (rs) {
    const blocks = JSON.parse(JSON.stringify(v.blocks));
    Object.assign(blocks[Number(rs.dataset.tyreset)], { mx: 0, my: 0, ms: 1 });
    return tySaveBlocks(blocks, "↺ رجع مكانه");
  }
  const seek = t.closest("[data-tyseek]");
  if (seek) { tyStop(); tySeek(Number(seek.dataset.tyseek)); return $("tyScreen")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
  const sc = t.closest("[data-tyscene]");
  if (sc) return wrap(sc, async () => { tyx.cur = await api(TY(`/${v.id}/scene`), { method: "POST" }); tyRender(); tyPoll(); });
  const st = t.closest("[data-tysavetext]");
  if (st) return wrap(st, () => tyPatch({ text: document.querySelector("[data-tytext]").value }));
  const plan = t.closest("[data-typlan]");
  if (plan) {
    if (v.blocks?.length && !confirm("توزّع الكلام من جديد؟ التعديلات اللي عملتها على اللقطات هتتبدل.")) return;
    return wrap(plan, async () => {
      tyx.cur = await api(TY(`/${v.id}/plan`), { method: "POST", ...jsonBody({ brief: document.querySelector("[data-tybrief]").value }) });
      tyRender(); tyPoll();
    });
  }
  const ic = t.closest("[data-tyicons]");
  if (ic) {
    if (!confirm(`يرسم ${v.missing_icons.length} أيقونة ناقصة بالستايل ده؟ حوالي ${v.draw_cost}$`)) return;
    return wrap(ic, async () => { tyx.cur = await api(TY(`/${v.id}/icons`), { method: "POST" }); tyRender(); tyPoll(); });
  }
  const ren = t.closest("[data-tyrender]");
  if (ren) {
    return wrap(ren, async () => {
      tyStop();
      tyx.cur = await api(TY(`/${v.id}/render`), { method: "POST", ...jsonBody({ quality: document.querySelector("[data-tyq]").value }) });
      tyStatusOnly(); tyPoll();
      ren.disabled = true;
    });
  }
  const ed = t.closest("[data-tyedit]");
  if (ed) {
    return wrap(ed, async () => {
      const r = await api(TY(`/${v.id}/to-editor`), { method: "POST" });
      storageSet("studiomania.projectId.ads", r.project_id);
      if (typeof mt !== "undefined") mt.project = null;
      toast("🎞️ اتفتح في مونتاج الإعلانات");
      showStep("6a");
    });
  }
  const del = t.closest("[data-tydel]");
  if (del) {
    if (!confirm(`تمسح «${v.name}»؟`)) return;
    return wrap(del, async () => {
      await api(TY(`/${v.id}`), { method: "DELETE" });
      tyx.cur = null; tyx.view = "home";
      tyx.list = await api(TY(""));
      tyRender();
    });
  }
  const merge = t.closest("[data-tymerge]");
  if (merge) {
    const i = Number(merge.dataset.tymerge), bl = tyBlocksFromDom();
    bl[i].to = bl[i + 1].to;
    bl[i].text = "";
    bl.splice(i + 1, 1);
    return tySaveBlocks(bl, "⤵ اتضمّوا");
  }
  const split = t.closest("[data-tysplit]");
  if (split) {
    const i = Number(split.dataset.tysplit), bl = tyBlocksFromDom(), b = bl[i];
    const mid = b.from + Math.floor((b.to - b.from + 1) / 2) - 1;
    bl.splice(i + 1, 0, { ...b, from: mid + 1, text: "", kind: b.kind === "pop" ? "build" : b.kind });
    b.to = mid;
    b.text = "";
    return tySaveBlocks(bl, "✂️ اتقسمت");
  }
  const rm = t.closest("[data-tyrm]");
  if (rm) {
    const bl = tyBlocksFromDom(), b = bl[Number(rm.closest("[data-tyb]").dataset.tyb)];
    if (b.kind === "icon") b.icon = ""; else b.icons.splice(Number(rm.dataset.tyrm), 1);
    return tySaveBlocks(bl);
  }
  const rms = t.closest("[data-tyrmside]");
  if (rms) {
    const bl = tyBlocksFromDom();
    bl[Number(rms.closest("[data-tyb]").dataset.tyb)].side = "";
    return tySaveBlocks(bl);
  }
});

$("tyMain").addEventListener("input", (e) => {
  if (e.target.matches("[data-tysfx]")) { const b = document.querySelector("[data-tysfxval]"); if (b) b.textContent = e.target.value; }
});

$("tyMain").addEventListener("change", async (e) => {
  const t = e.target, v = tyx.cur;
  try {
    if (t.matches("[data-tyname]")) { tyx.cur = await api(TY(`/${v.id}`), { method: "PATCH", ...jsonBody({ name: t.value }) }); tyx.list = await api(TY("")); return tyRender(); }
    if (t.matches("[data-tyopt]")) return tyPatch({ [t.dataset.tyopt]: t.value });
    if (t.matches("[data-tysfx]")) { await tyPatch({ sfx_level: Number(t.value) }); return toast(Number(t.value) ? `🔊 الكليكات: ${t.value}` : "🔇 من غير كليكات"); }
    if (t.matches("[data-tyfont]")) return tyPatch({ fonts: { ...(v.fonts || {}), [t.dataset.tyfont]: t.value } });
    if (t.matches("[data-tybg]")) return tyPatch({ bg: { ...(v.bg || {}), [t.dataset.tybg]: t.dataset.tybg === "dim" ? Number(t.value) : t.value } });
    if (t.matches("[data-tybgfile]") && t.files[0]) {
      tyx.cur = await tyUpload(TY(`/${v.id}/bg`), t.files[0]);
      tyx.force = true;
      return tyRender();
    }
    if (t.matches("[data-tysrc]") && t.files[0]) {
      if (v.blocks?.length && !confirm("ترفع ملف جديد؟ الكلام والحركات الحالية هيتبدلوا.")) return;
      tyx.cur = await tyUpload(TY(`/${v.id}/source`), t.files[0]);
      tyx.force = true;
      tyRender();
      return tyPoll();
    }
    if (t.matches("[data-tyguides]")) { tyx.guides = t.checked; if (tyx.eng) { tyx.eng.showAnchors = tyx.guides; tySeek(tyx.t); } return; }
    if (t.matches("[data-tyscrub]")) return;
    if (t.matches("[data-tyadd]") && t.value) {
      const bl = tyBlocksFromDom(), b = bl[Number(t.closest("[data-tyb]").dataset.tyb)];
      if (b.kind === "icon") b.icon = t.value; else b.icons = [...(b.icons || []), t.value];
      return tySaveBlocks(bl);
    }
    if (t.matches("[data-tyside]") && t.value) {
      const bl = tyBlocksFromDom();
      bl[Number(t.closest("[data-tyb]").dataset.tyb)].side = t.value;
      return tySaveBlocks(bl);
    }
    if (t.matches("[data-tbf]")) return tySaveBlocks(tyBlocksFromDom(), "✅ اتحفظ");
    if (t.matches("[data-tybrief]")) { tyx.cur = await api(TY(`/${v.id}`), { method: "PATCH", ...jsonBody({ brief: t.value }) }); }
  } catch (err) { toast(err.message, true); }
});

$("tyMain").addEventListener("input", (e) => {
  if (e.target.matches("[data-tyscrub]")) { tyStop(); tySeek(Number(e.target.value)); }
});

// ---------- 🧩 مكتبة الستيكرات

function tyRenderStk() {
  $("tyStk").innerHTML = `<div class="car-head"><h2>🧩 مكتبة الستيكرات <small class="muted">${tyx.stk.length}</small></h2>
      <div class="row wrap"><label class="btn sm primary">⬆ ارفع صور<input type="file" data-stkup accept="image/*" multiple hidden></label>
        <label class="ty-check"><input type="checkbox" data-stkkey checked> شيل الخلفية السادة</label></div></div>
    <div class="row wrap"><input type="text" data-stkdesc placeholder="وصف أيقونة جديدة (مثلًا: pixel art dumbbell)" data-no-i18n>
      <select data-stkstyle>${tyx.styles.map((s) => `<option value="${s.id}">${tye(s.name)}</option>`).join("")}</select>
      <button type="button" class="btn sm" data-stkdraw>🎨 ارسمها (~0.03$)</button></div>
    <p class="hint">الستيكرات اللي اتقصت من فيديو ممكن يبقى فيها حتت من حاجات جنبها: «✨ نضّفها» بيرسمها لوحدها بنفس شكلها (حوالي 0.03$).</p>
    ${tyDictView()}
    <div class="ty-stk">${tyx.stk.map((s) => `<figure data-stk="${s.id}"><div class="ty-checker"><img src="${s.url}" alt=""></div>
      <input value="${tye(s.name)}" data-stkname data-no-i18n>
      <label class="ty-concept" title="معنى الأيقونة في القاموس: الكلام اللي بيدل عليه بيجيب الأيقونة دي">📖 <input value="${tye(s.concept || "")}" data-stkconcept placeholder="المعنى" data-no-i18n></label>
      <small class="muted">${s.source.startsWith("lab:") ? "🔬 من المعمل" : s.source === "drawn" ? "🎨 مترسومة" : "⬆ مرفوعة"}${s.style ? ` · ${tye(tyx.styles.find((x) => x.id === s.style)?.name || s.style)}` : ""}</small>
      <div class="row">${s.source.startsWith("lab:") ? `<button type="button" class="btn sm" data-stkclean title="يرسمها لوحدها نضيفة بنفس شكلها">✨ نضّفها</button>` : ""}
        <button type="button" class="btn sm danger" data-stkdel>🗑️</button></div></figure>`).join("") || `<p class="muted">لسه مفيش ستيكرات</p>`}</div>`;
}

$("tyStk").addEventListener("click", async (e) => {
  const t = e.target;
  const wrap = (btn, fn) => busyButton(btn, "⏳", async () => { try { await fn(); } catch (err) { toast(err.message, true); } });
  const draw = t.closest("[data-stkdraw]");
  if (draw) {
    const desc = document.querySelector("[data-stkdesc]").value.trim();
    if (!desc) return toast("اكتب وصف الأيقونة", true);
    return wrap(draw, async () => {
      await api(TY("/stickers/draw"), { method: "POST", ...jsonBody({ desc, style: document.querySelector("[data-stkstyle]").value }) });
      tyx.stk = await api(TY("/stickers")); tyRender(); toast("🎨 اتضافت");
    });
  }
  const fig = t.closest("[data-stk]");
  if (!fig) return;
  const id = fig.dataset.stk;
  const clean = t.closest("[data-stkclean]");
  if (clean) return wrap(clean, async () => { await api(TY(`/stickers/${id}/clean`), { method: "POST" }); tyx.stk = await api(TY("/stickers")); tyRender(); toast("✨ اتضافت نسخة نضيفة"); });
  const del = t.closest("[data-stkdel]");
  if (del) {
    if (!confirm("تمسح الستيكر ده؟")) return;
    return wrap(del, async () => { await api(TY(`/stickers/${id}`), { method: "DELETE" }); tyx.stk = await api(TY("/stickers")); tyRender(); });
  }
});

$("tyStk").addEventListener("change", async (e) => {
  const t = e.target;
  try {
    if (t.matches("[data-stkup]") && t.files.length) {
      const fd = new FormData();
      [...t.files].forEach((f) => fd.append("files", f));
      fd.append("key", document.querySelector("[data-stkkey]").checked ? "1" : "0");
      toast("⬆ بيرفع...");
      await api(TY("/stickers"), { method: "POST", body: fd });
      tyx.stk = await api(TY("/stickers"));
      return tyRender();
    }
    if (t.matches("[data-stkconcept]")) {
      tyx.stk = await api(TY(`/stickers/${t.closest("[data-stk]").dataset.stk}`), { method: "PATCH", ...jsonBody({ concept: t.value }) });
      tyx.dict = await api(TY("/concepts"));
      tyRender();
      return toast("📖 اتحفظ في القاموس");
    }
    if (t.matches("[data-stkname]")) {
      tyx.stk = await api(TY(`/stickers/${t.closest("[data-stk]").dataset.stk}`), { method: "PATCH", ...jsonBody({ name: t.value }) });
      return toast("✅ اتحفظ");
    }
  } catch (err) { toast(err.message, true); }
});

// ---------- 📖 القاموس: كلمة ← معنى ← أيقونة بروح الستايل

function tyDictView() {
  const d = tyx.dict;
  if (!d) return "";
  return `<details class="panel ty-dict" ${tyx.open.dict ? "open" : ""} data-tydictdk><summary>📖 القاموس <small class="muted">${d.concepts.length} معنى · ${d.learned} كلمة اتعلّمت</small></summary>
    <p class="hint">بيتملي لوحده: كل أيقونة بتتطلّع من فيديو في المعمل (أو بتترسم) بتدخل بمعناها وكلماتها عربي وإنجليزي. الكلمة اللي ميعرفهاش بيسأل عليها موديل صغير مرة واحدة ويحفظ الإجابة.
      ونفس المعنى ممكن يبقى ليه أيقونة مختلفة في كل ستايل: المشروع بياخد أيقونة الستايل بتاعه الأول.</p>
    ${d.untagged ? `<button type="button" class="btn sm" data-dicttag>🏷️ دخّل ${d.untagged} أيقونة قديمة للقاموس</button>` : ""}
    <div class="row wrap"><input type="text" data-dictc placeholder="المعنى (مثلًا dumbbell)" data-no-i18n><input type="text" data-dictar placeholder="كلمات عربي: حديد، دمبل، جيم" data-no-i18n>
      <input type="text" data-dicten placeholder="English words: weights, gym" data-no-i18n><button type="button" class="btn sm" data-dictadd>＋ ضيف</button></div>
    <div class="ty-dict-list">${d.concepts.map((c) => `<div><b data-no-i18n>${tye(c.concept)}</b> <small class="muted">${c.stickers.length ? `🧩 ${c.stickers.length}` : "❔ مفيش أيقونة"}</small>
      <small dir="auto" data-no-i18n>${tye([...c.ar, ...c.en].slice(0, 14).join("، "))}</small></div>`).join("")}</div></details>`;
}

$("tyStk").addEventListener("toggle", (e) => { if (e.target.matches("[data-tydictdk]")) tyx.open.dict = e.target.open; }, true);

$("tyStk").addEventListener("click", async (e) => {
  const t = e.target;
  const wrap = (btn, fn) => busyButton(btn, "⏳", async () => { try { await fn(); } catch (err) { toast(err.message, true); } });
  const tag = t.closest("[data-dicttag]");
  if (tag) return wrap(tag, async () => { tyx.dict = await api(TY("/concepts/tag"), { method: "POST" }); tyx.stk = await api(TY("/stickers")); tyRender(); toast("🏷️ اتضافوا للقاموس"); });
  const add = t.closest("[data-dictadd]");
  if (add) {
    const val = (k) => document.querySelector(`[data-dict${k}]`).value.trim();
    const split = (x) => x.split(/[,،]/).map((w) => w.trim()).filter(Boolean);
    if (!val("c")) return toast("اكتب المعنى", true);
    return wrap(add, async () => {
      tyx.dict = await api(TY("/concepts"), { method: "POST", ...jsonBody({ concept: val("c"), ar: split(val("ar")), en: split(val("en")) }) });
      tyx.open.dict = true; tyRender(); toast("📖 اتضاف");
    });
  }
});

// ---------- 🔬 المعمل: خطوة «🔤 التايبوجرافي»

function renderLabTypo(d) {
  const ty = d.typo, el = $("labTypo"), data = ty?.data;
  if (!ty) { el.innerHTML = ""; el.hidden = true; return; }
  if (el.contains(document.activeElement) && document.activeElement.matches("input, textarea, select")) return;
  el.hidden = false;
  const sw = (th) => `<span class="ty-sw" style="background:${th.bg};color:${th.ink}">Aa<i style="background:${th.accent}"></i></span>`;
  el.innerHTML = `<details class="sch" open><summary><b>🔤 التايبوجرافي</b>
      ${ty.status === "working" ? `<span class="lab-st working"><span class="spin-inline"></span> ${tye(ty.step || "بيتفرج على الفيديو")}</span>
        <button type="button" class="btn sm" data-ltstop>⏹ وقّف</button>` : ""}
      ${ty.status !== "working" && (data || ty.error) ? `<button type="button" class="btn sm danger" data-ltdel title="الستايل والستيكرات اللي اتحفظوا بيفضلوا">🗑️ امسح النتيجة</button>` : ""}
      ${ty.error ? `<small class="err">${tye(ty.error)}</small>` : ""}
      ${data ? `<small class="muted">${data.moments.length} لحظة · ${data.moments.reduce((a, m) => a + m.icons.filter((i) => i.url).length, 0)} ستيكر</small>` : ""}</summary>
    ${data ? `<div class="ty-labstyle"><b data-no-i18n>${tye(data.style.name)}</b> ${sw(data.style.light)}${sw(data.style.dark)}${sw(data.style.accent)}
        <small class="muted" dir="ltr" data-no-i18n>${tye(data.style.font_look)} ${data.style.icon_style ? `· ${tye(data.style.icon_style)}` : ""}</small>
        <button type="button" class="btn sm primary" data-ltuse>🔤 اعمل فيديو بالستايل ده</button></div>
      ${data.style.rules?.length ? `<ul class="ty-rules" data-no-i18n>${data.style.rules.map((r) => `<li>${tye(r)}</li>`).join("")}</ul>` : ""}
      <div class="ty-moments">${data.moments.map((m) => `<article class="ty-moment">
        <button type="button" class="btn sm" data-schplay="${m.t0}" data-to="${m.t1}">▶️ ${lt(m.t0)}</button>
        <b>${TY_KINDS[m.kind] || "❓ " + tye(m.kind)}</b> <span class="ty-sw sm" style="background:${data.style[m.theme]?.bg}"></span>
        <span dir="auto" data-no-i18n>«${tye(m.text)}»</span>
        <small class="muted" data-no-i18n>${tye(m.how)}</small>
        ${m.icons.length ? `<span class="ty-icons">${m.icons.map((i) => i.url ? `<span class="ty-chip"><img src="${i.url}" alt=""><small data-no-i18n>${tye(i.name)}</small></span>`
          : `<span class="ty-chip miss" title="${tye(i.desc)}">❔<small data-no-i18n>${tye(i.name)}</small></span>`).join("")}</span>` : ""}
      </article>`).join("")}</div>` : ""}
  </details>`;
}

$("labTypoBtn").onclick = () => {
  const has = labx.cur?.typo?.data;
  if (!confirm(has ? `تطلّع تايبوجرافي «${labx.cur.name}» من جديد؟ (الستايل والستيكرات القديمة بيفضلوا في المكتبة)`
    : `يطلّع التايبوجرافي من «${labx.cur.name}»: الستايل، وكل لحظة الكلام اتحوّل فيها لشكل، والأيقونات كستيكرات شفافة؟`)) return;
  busyButton($("labTypoBtn"), "⏳", async () => {
    try {
      labx.cur = await api(`/api/lab/${labx.cur.id}/typo`, { method: "POST" });
      renderLab(); scheduleLabPoll();
    } catch (err) { toast(err.message, true); }
  });
};

$("labTypo").addEventListener("click", async (e) => {
  const t = e.target;
  const pl = t.closest("[data-schplay]");
  if (pl) { e.preventDefault(); return schPlay(Number(pl.dataset.schplay), Number(pl.dataset.to)); }
  const stop = t.closest("[data-ltstop]");
  if (stop) { e.preventDefault(); labx.cur = await api(`/api/lab/${labx.cur.id}/typo/stop`, { method: "POST" }); renderLab(); return toast("⏹ اتوقف"); }
  const del = t.closest("[data-ltdel]");
  if (del) {
    e.preventDefault();
    if (!confirm("تمسح نتيجة التايبوجرافي؟ (الستايل والستيكرات بيفضلوا في المكتبة)")) return;
    labx.cur = await api(`/api/lab/${labx.cur.id}/typo`, { method: "DELETE" });
    return renderLab();
  }
  const use = t.closest("[data-ltuse]");
  if (use) {
    const name = prompt("اسم الفيديو:", "تايبوجرافي");
    if (name === null) return;
    try {
      const v = await api(TY(""), { method: "POST", ...jsonBody({ name, ratio: "9:16", style: labx.cur.typo.style_id }) });
      storageSet("studiomania.typo", v.id);
      tyx.cur = null;
      showStep("12");
    } catch (err) { toast(err.message, true); }
  }
});
