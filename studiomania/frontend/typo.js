// StudioMania — 🔤 التايبوجرافي: الكلام ← حركات (بلوكات) ← معاينة حية بنفس محرّك الرسم ← فيديو.
// وكمان خطوة «🔤 التايبوجرافي» في معمل التفكيك (اللي بتطلّع الستايل والأيقونات من فيديو).

const tyx = { list: [], cur: null, stk: [], styles: [], view: "home", timer: null, eng: null, play: null, t: 0, open: {} };
const TY_KINDS = { track: "⭐ 🎬 نص كبير على الخطوط", sign: "⭐ ✍️ سطر وإمضا", spot: "⭐ 🌟 نجمة وبقعة ضوء", pop: "💥 كلمة كبيرة", type: "⌨️ كتابة بمؤشر", build: "✨ كلمة كلمة", icon: "🖼️ كلمة وأيقونة", letters: "🔠 حرف يُستبدل بصورة", scatter: "🌪️ حروف تُجمع", ring: "⭕ دائرة أيقونات", anchor: "📍 مندمج مع الفيديو",
  behind: "🎬 🧍 نص عملاق خلف الشخص", arc: "🎬 🌙 نص متقوّس حوالين الرأس", artype: "🎬 ⌨️ كتابة بمؤشر برتقالي", redword: "🎬 🔴 كلمة حمراء واحدة", signature: "🎬 ✒️ إمضا تُكتب",
  poster: "🎬 🟥 بوستر أحمر", stack: "🎬 📚 كومة نص مائلة بجانب الشخص", push: "🎬 ➡️ كلمة تدفع ما قبلها", crt: "🎬 📺 شاشة قديمة وجلتش",
  ransom: "🎬 ✂️ حروف مقصوصة", halo: "🎬 ⭕ دائرة حوالين الرأس", floor: "🎬 🛣️ نص على الأرض", hand: "🎬 🖊️ خط يد يرتجف", tags: "🎬 🏷️ كلمات على مربعات حمراء",
  space: "🎬 🌌 نص في فراغ 3D", route: "🎬 ✈️ خريطة ومسار وطيارة", board: "🎬 🧵 لوحة تحقيق", cube: "🎬 🧊 مكعب سلكي حوالين الشخص",
  comments: "🎬 💬 تعليقات على لوحة زجاج", lock: "🎬 🔒 كبسولة بقفل", thermal: "🎬 🌡️ كاميرا حرارية", shapes: "🎬 🎞️ أشكال فيلم ترتجف",
  select: "🎬 🖱️ مربع تحديد وماوس", chat: "🎬 📱 فقاعات شات", counter: "🎬 🔢 رقم يعدّ",
  fill: "🎬 🖼️ الصورة داخل الحروف", polaroid: "🎬 📸 بولارويد بخط يد", cards: "🎬 🃏 بطاقات طايرة 3D", burst: "🎬 💥 انفجار كوميكس",
  dots: "🎬 ✨ الشخص يتحول لنقط", neon: "🎬 🔴 نيون خلف الشخص",
  outline: "🎬 🩷 كلمة بحدود بينك تقفز", spin: "🎬 🌀 حروف عملاقة تدور", sweep: "🎬 💨 كلمة تعدّي ودائرة نسخ", extrude: "🎬 🧱 نص بينك 3D ومربع أسود",
  stories: "🎬 📲 بطاقات ستوري 3D", post: "🎬 🖼️ بطاقة منشور والنص صاعد منه",
  retro: "🎬 📰 بوستر قديم ونجمة حمراء", duotone: "🎬 🟦 فيديو أزرق ونص خلف الشخص", label: "🎬 🏷️ كلمة حمراء وتاج أزرق", mirror: "🎬 🪞 كلمة وانعكاسها",
  banners: "🎬 🎗️ شرائط مائلة تتحرك", tiles: "🎬 🔲 بطاقات صور وبطاقة أحمر", bubble: "🎬 💬 فقاعة نص حمراء", band: "🎬 🟦 شريط أزرق خلف كلمة", emerge: "🎬 🗣️ النص يظهر من خلف الرأس",
  film: "🎬 🎞️ برواز فيلم", ghost: "🎬 👻 كلمة عملاقة باهتة خلف", notify: "🎬 🔔 إشعارات جوال", dialog: "🎬 🖥️ رسالة نظام قديمة",
  pills: "🎬 💊 أزرار لامعة والماوس", steps: "🎬 🔢 بطاقات مرقّمة", scribble: "🎬 ⭕ دائرة بالقلم", list: "🎬 📋 لستة بسهم",
  prompt: "🎬 🤖 مربع ذكاء اصطناعي", spread: "🎬 ✨ نص متفرّق",
  serif: "🎬 🖋️ كلمة بخط سيريف مايل", chalk: "🎬 🧑‍🏫 سبورة طباشير", ticket: "🎬 🎟️ تذكرة سينما", frame: "🎬 🖼️ برواز دهب", toggle: "🎬 🔘 زر تشغيل",
  years: "🎬 📅 أرقام تدور", wave: "🎬 〰️ نص على خط متعرج", spaced: "🎬 ↔️ نص بمسافات واسعة", search: "🎬 🔎 خانة بحث", digits: "🎬 🔢 أرقام في مربعات",
  torn: "🎬 📜 شرايط ورق مقطوع", emoji: "🎬 😀 إيموجي على قدر المعنى", doodle: "🎬 ✏️ خربشة بالقلم", browser: "🎬 🌐 نافذة متصفح", split: "🎬 ↔️ قبل وبعد",
  spotlight: "🎬 🔦 كشاف ضوء", phone: "🎬 📱 جوال",
  window: "🎬 🪟 الفيديو في برواز", inline: "🎬 🖼️ صورة داخل السطر", bigtype: "🎬 ⌨️ كلمة عملاقة تُكتب", checks: "🎬 ✅ لستة تتعلّم", progress: "🎬 📊 شرايط نسب",
  flow: "🎬 🔀 خطوات قالب مخصص", aura: "🎬 🌈 ألوان ناعمة", stairs: "🎬 🪜 كلمات مثل السلم", dates: "🎬 📆 شريط أيام", endcard: "🎬 🏁 بطاقة النهاية", wintitle: "🎬 🪟 كلمة عملاقة على البرواز", corners: "🎬 📐 نص في الركنين", inbox: "🎬 📥 صندوق رسائل", doc: "🎬 📝 دوكيومنت بهايلايتر", workcards: "🎬 📅 بطاقة موعد ورسالة وملف", call: "🎬 📞 مكالمة فيديو", canvas: "🎬 🗂️ لوحة بطاقات والكاميرا تقرّب", colorcard: "🎬 🟦 بطاقة لون ونص صغير", imsg: "🎬 📲 محادثة جوال", dashboard: "🎬 📈 بطاقة داشبورد", apps: "🎬 🔌 تطبيقات تتوصل", bell: "🎬 🔔 جرس والعداد يزيد", chapter: "🎬 🔢 رقم فصل عملاق", sidepanel: "🎬 🗃️ فيديو وبانل جنبه", clones: "🎬 👯 الشخص متكرر", megapan: "🎬 🔠 كلمة عملاقة والكاميرا ماشية عليها", badge: "🎬 🔴 دائرة بأول حرف تكبر", leaderboard: "🎬 🏆 لوحة ترتيب", donut: "🎬 🍩 دائرة نسبة", photowords: "🎬 🖼️ كلمات وصور طايرة", titlecard: "🎬 🎬 عنوان سينمائي يُبنى", departures: "🎬 🚆 لوحة مواعيد قطر", loading: "🎬 ⚙️ شاشة يُنشأ الآن", countdown: "🎬 ⏳ عدّاد تنازلي", dragdrop: "🎬 🖐️ صور تطير لمربع الكتابة", lineup: "🎬 🎤 قائمة أسامي كبيرة", isomap: "🎬 🗺️ خريطة أيزومتريك", stickers: "🎬 🏷️ كلمة عملاقة ووسوم مائلة", promptline: "🎬 ⌨️ سطر كتابة وزر إرسال", crowd: "🎬 👥 بوستر بسيلويتات", photohero: "🎬 🖼️ صورة وكلمة عملاقة عليها", menu: "🎬 🖱️ قائمة منسدلة", pricing: "🎬 💲 اختيارات بأسعار", pins: "🎬 📍 نقاط مرقّمة على صورة", result: "🎬 🔗 نتيجة بحث", calendar: "🎬 🗓️ كاليندر وموعد", mapdots: "🎬 🗺️ خريطة ودوائر تنبض", marker: "🎬 🖍️ عنوان بهايلايتر أصفر", lowerthird: "🎬 🪪 اسم ووظيفة أسفل", cardwords: "🎬 🃏 بطاقات بكلمات عملاقة", bars: "🎬 📊 رسم بياني يكبر", table: "🎬 🧾 جدول بتاجات", dayplan: "🎬 🕘 جدول اليوم", stutter: "🎬 🔁 كلمة تتهته", section: "🎬 🔢 فصل كامل برقم ورمز", worklog: "🎬 📋 سجل عمل", toggles: "🎬 🔛 مفاتيح تُفتح", checkout: "🎬 🛒 فاتورة وزر الدفع", lockscreen: "🎬 📱 شاشة مغلقة وإشعارات", wizard: "🎬 🪜 خطوات بشريط تقدّم", wordroll: "🎬 🎰 كلمات تدور رأسي", bignum: "🎬 🔢 رقم عملاق على الحرف", stickynote: "🎬 🗒️ ملاحظات متعلقة", colorpicker: "🎬 🎨 لوحة اختيار لون", uploads: "🎬 📎 ملفات تُرفع", timer: "🎬 ⏱️ تايمر تنازلي", anchorword: "🎬 🅱️ كلمة ضخمة أسفل", orders: "🎬 🧾 تذاكر طلبات", stats: "🎬 🔢 دوائر أرقام", duo: "🎬 🪟 شاشتين بجانب بعض", route: "🎬 🗺️ طريق على الخريطة", flank: "🎬 ▫️ كلمة بين كادرين", flood: "🎬 📆 نتيجة تتزحم", chips: "🎬 ▪️ شرايح كلمات", wordtiles: "🎬 🧩 بلاطات كلمات", profile: "🎬 👤 بطاقة بروفايل", bigbutton: "🎬 🔘 زر عملاق", gauge: "🎬 ⭕ عداد دايري", rule: "🎬 ⚡ جملة أتمتة", iconrow: "🎬 ✳️ صف أيقونات", led: "🎬 🔴 أرقام ديجيتال", drop: "🎬 🚀 عداد إطلاق", report: "🎬 📡 بطاقة تقرير مباشر", serp: "🎬 🔍 نتيجة بحث", files: "🎬 🗂️ قائمة ملفات تتحدد", generating: "🎬 🖼️ صور تُنشأ", portfolio: "🎬 📷 صفحة بورتفوليو", letterorb: "🎬 🟠 كلمة بكورة متدرجة", connect: "🎬 🔗 زرارين يتوصلون", assistant: "🎬 ✨ بطاقة مساعد ذكي", themeswap: "🎬 🎨 ألوان الصفحة تُستبدل", slider: "🎬 🎚️ سلايدر وقت", weather: "🎬 🌤️ ويدجت طقس", post: "🎬 📝 منشور بكلام متظلل", highlightpan: "🎬 🖍️ نص عملاق متظلل", blocklines: "🎬 🟧 سطور على بلوكات", reactions: "🎬 👍 تفاعلات منشور", qr: "🎬 🔳 ورقة QR", codetag: "🎬 ‹› نص بين أقواس كود", toolbar: "🎬 🧰 شريط أدوات", terminal: "🎬 ⌨️ تيرمينال", scan: "🎬 🛡️ فحص أمان", toasts: "🎬 🔔 إشعارات تتراكم", footer: "🎬 🦶 فوتر موقع", marquee: "🎬 〰️ سطرين ماشيين", datestrip: "🎬 🗓️ شريط أيام", fileicon: "🎬 📄 أيقونة ملف", chaos: "🎬 🌀 سطح مكتب زحمة", gradword: "🎬 🌈 جملة وكلمة متدرّجة", meshprompt: "🎬 🫧 كتابة على خلفية ضبابية", orbsplit: "🎬 🟠 كلمتين وكورة بينهم", bento: "🎬 🍱 شبكة بطاقات", figdays: "📅 شبكة أيام", figcurve: "📈 منحنى نمو", figplay: "▶️ إطار تشغيل", figequal: "≠ ليسا متماثلين", figwords: "🔠 نص بأحجام", figphone: "📱 جوال مرسوم", figdrop: "📉 هبوط", figcount: "⏺ عداد REC", figgears: "⚙️ تروس", figbar: "▮▮ شريط مجهود", figcheck: "☑️ بنود وتسجيل", figcta: "💬 علّق بالكلمة", goldcap: "✨ عنوان ذهبي", iconbelt: "⚗️ شريط رموز", glowsweep: "🌟 ضوء ولوح زجاج", namepill: "💊 كبسولة اسم", kashida: "ـــ كشيدة", molecule: "🧬 جزيء", weightstack: "☰ سطور ثقيلة/رفيعة", stretch: "↔ كلمة تتمدد", desatpop: "⚫ خفوت وكلمة", arcs: "◯ دوائر رفيعة", chrome: "💎 كلمة معدنية", inkverse: "🖋️ نسخ بالحبر", poemfade: "🌫️ شعر يظهر", hashend: "#️⃣ وسم النهاية", flipverb: "🔁 فعل يتبدّل", strobe: "⚡ وميض كلمات", duoline: "▤ سطران مضغوطان", capstack: "❓ سؤال مضغوط", pillword: "🟨 كبسولة خلف الكلمة", blurduo: "🟢 سطران بدائرة", tagstack: "🏷️ سطور بوسم", underbars: "▁ خطوط تحت النص", contactcard: "📇 بطاقة تواصل", iconorbit: "🪐 أيقونات في قوس", blurstrobe: "💥 كلمة بسحبة", kinstack: "⇋ نص متدرّج", incall: "📞 مكالمة واردة", cineband: "🎞️ شريط سينما", scriptover: "✍️ خط يد فوق الفيديو", tricolor: "🟪 ثلاثة ألوان", drumpicker: "🎡 عجلة اختيار", redmix: "🔴 كبير أحمر وصغير", headbubble: "⚪ دائرة مكان الرأس", pincard: "📌 بطاقة بدبوس", emojifloat: "🤡 إيموجي عائم", slotreel: "🎰 آلة خدمات", posterwall: "🖼️ جدار ملصقات", quoteline: "💬 سطر اقتباس", medallion: "🏅 ملصق ميدالية", clockhand: "🕰️ عقرب ساعة", roadtext: "🛣️ طريق متعرج", markpan: "🖍️ قلم تحديد ودائرة", objectquote: "⏳ رمز وحكمة", racechart: "📈 خطان يتسابقان", calflip: "📆 تقويم يتقلّب", glosscards: "🃏 بطاقات لامعة", dropword: "💧 قطرة وتحول", tasklens: "🔍 مهام تحت عدسة", monostack: "⚫ سرد أحادي اللون", dashbox: "⬚ مربع متقطع وفأرة", sparklist: "✦ قائمة بنجوم", followbtn: "👆 زر متابعة", silhouette: "🕴️ رجل ببدلة", petalstack: "🌸 بتلات وعنوان", followcount: "👤 عداد متابعين", twopillars: "🏛️ عمودان وفجوة", cutmat: "🟩 لوح قص", labelbox: "🏷️ تذكرة سوداء", stampcard: "✉️ طابع بريد", lcdtype: "📟 شاشة جوال قديم", genpanel: "🪟 لوح توليد طائر", holopulse: "💚 حلقات وهولوجرام", coverflow: "💿 دوّارة بطاقات", featuretag: "🟢 عنوان ميزة", luxmix: "✨ سيريف فاخر", goldframes: "🔶 إطارات ذهبية", goldrows: "📜 صفوف ذهبية", tilegrid: "🔲 موقع بشبكة", goldpill: "🟡 كبسولة ذهبية", holoclock: "🕚 ساعة ومجلدات", curvewall: "🎞️ جدار مقوّس", newsscan: "📰 جريدة وقلم تحديد", neonvenn: "⭕ حلقات ضوء", wavebelt: "〰️ موجة تزيل أشياء", cardarc: "🌙 قوس بطاقات", shadowquote: "🪟 ملصق بظل نافذة", haloring: "💫 حلقة ضوء تكبر", noirtitle: "🕵️ عنوان نوار", stickerstack: "🏴 ملصقات سوداء", graphhop: "📈 دوائر على رسم بياني", podium: "🥇 منصة وميدالية", hudcallout: "📐 إطار تقني", termbar: "⌨️ شريط طرفية", glowtoggle: "🌈 مفتاح ألوان", pinkdoodle: "✳️ نجمة ودوائر وردية", lensfind: "🔎 عدسة تدور", echostack: "🔁 صدى سطور", dofwords: "🎥 نص بعمق", portalchat: "🫧 محادثة في دائرة", cardframe: "🎴 الفيديو في بطاقة", wordvoid: "🌌 فضاء كلمات", facecam: "🔥 دائرة الشارح", spreadcaps: "🏛️ سيريف فخم وكابيتال", tinysub: "▁ ترجمة صغيرة فخمة", ringword: "⭕ كلمة بحلقة يد", handcap: "✍️ تعليق نصي بخط اليد", blobcam: "🥚 فيديو في بقعة", brushbar: "🖌️ ضربة فرشة زرقاء", beforeafter: "🆚 قبل وبعد", pillcarousel: "💊 معرض كبسولات", namescript: "🌟 اسم أصفر ونص", stackrepeat: "🔂 كلمة متكررة في عمود", vertword: "🏙️ كلمة طولية", serifsolo: "📜 كلمة سيريف وحيدة", selectword: "🔵 كلمة تتحدد", tornlabel: "📄 ورقة مقطوعة", radartags: "📡 رادار ووسوم" };
// العناصر اللي ليها «الكلمة اللي عليها الضغط»
const TY_FOCUS = ["sign", "spot", "arc", "artype", "stack", "halo", "space", "cube", "lock", "outline", "label", "tiles", "bubble", "film", "ghost", "scribble", "spread",
  "serif", "toggle", "emoji", "doodle", "spotlight", "frame", "years", "digits", "spaced", "phone", "browser", "inline", "endcard", "wintitle", "megapan", "badge", "photohero", "result", "marker", "stutter", "anchorword", "letterorb", "themeswap", "post", "highlightpan", "gradword"];
const TY_TRANS = { "": "بدون انتقال", whip: "💨 سحبة سريعة", zoom: "🔍 زووم داخل", glitch: "📺 جلتش", flash: "⚡ فلاش", iris: "⭕ دائرة تنفتح",
  leak: "🌅 تسريب ضوء", burn: "🔥 حرق فيلم", rise: "⬆️ صاعد من أسفل", wipe: "🟧 مسحة لون", blur: "🌫️ بلير", pop: "🫧 نطة من داخل", slab: "🚪 لوح عابر", bars: "▥ شرائح ألوان", orb: "🟢 دائرة تكبر" };
const TY_INTRO = { track: { "": "بدون افتتاح", flash: "⚡ افتتاح بفلاشات" }, spot: { "": "بدون فلاش", burst: "💛 فلاش أصفر قبلها" } };
const TY_OUTRO = { track: { "": "بدون قفلة", pixel: "▦ تتكسّر بكسلات" }, spot: { "": "بدون قفلة", red: "🔴 فلاش أحمر في الآخر" } };
const TY_PLACES = { auto: "📍 مكان النص: البرنامج يختار", left: "⬅️ شمالها", right: "➡️ يمينها", above: "⬆️ فوقها", below: "⬇️ تحتها", on: "📝 عليها" };
const TY_AKINDS = { photo: "🖼️ صورة", paper: "📄 ورقة", screen: "📱 شاشة", object: "📦 شيء", product: "🛍️ منتج", face: "🙂 وجه", person: "🧍 شخص", sign: "🪧 يافطة", space: "⬜ مساحة فارغة" };
const TY_THEMES = { light: "☀️ فاتح", dark: "🌙 غامق", accent: "🟨 ملوّن" };
const TY_BG = { theme: "🎨 ألوان الأسلوب", solid: "🟦 لون سادة", image: "🖼️ صورة", video: "🎬 فيديو", source: "🎥 الفيديو المرفوع" };
const TY_ST = { new: "", bgauto: "🎬 جارٍ جلب خلفيات بحسب النص", ready: "📝 النص جاهز", planned: "🧠 الحركات جاهزة", done: "✅ الفيديو جاهز", failed: "⚠️ فشل",
  transcribing: "🎧 يسمع", analyzing: "👁️ يحلل الفيديو", planning: "🧠 يوزّع", drawing: "🎨 يرسم الأيقونات", rendering: "🎬 يعمل الفيديو", tracking: "🎯 جارٍ التتبع" };
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
    <b data-no-i18n>${tye(p.name)}</b><small class="muted">${p.ratio} · ${TY_ST[p.status] || ""}</small></li>`).join("") || `<li class="muted">لا يوجد بعد</li>`;
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
      <label>الأسلوب <select data-tyopt="style">${stOpts}</select></label>
      <label title="بدون ذكاء اصطناعي: الحركات بالقواعد، والأيقونات من القاموس فقط، والنص يتفرّغ على الخادم إذا متفعّل">الذكاء <select data-tyopt="ai">
        <option value="smart" ${v.ai !== "off" ? "selected" : ""}>🤖 ذكي</option><option value="off" ${v.ai === "off" ? "selected" : ""}>⚙️ بدون ذكاء اصطناعي</option></select></label>
      <label title="0 = لا يوجد كليكات تمامًا، 100 = كليك على كل كلمة، وما بينهم الكليكات تقل أو تكتر">🔊 الكليكات
        <input type="range" min="0" max="100" step="5" data-tysfx value="${v.sound?.sfx_level ?? (v.sfx === "off" ? 0 : 100)}">
        <b data-tysfxval>${v.sound?.sfx_level ?? (v.sfx === "off" ? 0 : 100)}</b></label>
      ${tyx.styles.find((x) => x.id === v.style)?.pro && TypoEngine.MOMENT_FONTS ? `
        <label>خط الإنجليزية <select data-tyfont="sans">${TypoEngine.MOMENT_FONTS.latin.map(([f, l]) => `<option value="${f}" ${f === (v.fonts?.sans || "TY Outfit") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>خط العربية <select data-tyfont="sansAr">${TypoEngine.MOMENT_FONTS.arabic.map(([f, l]) => `<option value="${f}" ${f === (v.fonts?.sansAr || "TY Alexandria") ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
      <label>الخلفية <select data-tybg="kind">${Object.entries(TY_BG).filter(([k]) => k !== "source" || v.source?.kind === "video")
        .map(([k, l]) => `<option value="${k}" ${k === bg.kind ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${bg.kind === "solid" ? `<label>اللون <input type="color" data-tybg="color" value="${tye(bg.color || "#101010")}"></label>` : ""}
      ${bg.kind === "image" || bg.kind === "video" ? `<label class="btn sm">⬆ ${bg.file ? "غيّر" : "ارفع"} ${bg.kind === "image" ? "الصورة" : "الفيديو"}
        <input type="file" data-tybgfile accept="${bg.kind === "image" ? "image/*" : "video/*"}" hidden></label>
        <button type="button" class="btn sm" data-tystock="${bg.kind}">🔎 من المكتبة</button>
        <button type="button" class="btn sm primary" data-tybgauto="${bg.kind}" ${v.busy || !v.words?.length ? "disabled" : ""} title="يقسّم البرنامج النص إلى مقاطع ويختار لكل مقطع ${bg.kind === "image" ? "صورة" : "فيديو"} حقيقيًا يعبّر عنه">✨ بحسب النص</button>` : ""}
      ${bg.auto?.length && bg.kind === "video" ? `<small class="muted ty-credit" data-no-i18n data-brand-keep title="${tye(bg.auto.map((a) => `${tyT(a.t0)} ${a.q}`).join("\n"))}">🎬 ${bg.auto.length} مقاطع من <a href="https://www.pexels.com" target="_blank" rel="noopener">Pexels</a>${bg.credit?.by ? ` · ${tye(bg.credit.by)}` : ""}</small>`
        : bg.credit && ["image", "video"].includes(bg.kind) ? `<small class="muted ty-credit" data-no-i18n data-brand-keep>${bg.kind === "video" ? "🎬" : "📷"} ${bg.credit.by_url ? `<a href="${tye(bg.credit.by_url)}" target="_blank" rel="noopener">${tye(bg.credit.by)}</a>` : tye(bg.credit.by)} · <a href="https://www.pexels.com" target="_blank" rel="noopener">Pexels</a></small>` : ""}
      ${["image", "video", "source"].includes(bg.kind) ? `<label>تغميق <input type="range" min="0" max="0.8" step="0.05" data-tybg="dim" value="${bg.dim || 0}"></label>` : ""}
    </div>
    <details class="panel tv-step" ${tyx.open.s1 ?? !v.words?.length ? "open" : ""} data-tydk="s1"><summary>١. 🗣️ النص <small class="muted">${v.words?.length ? `${v.words.length} كلمة · ${tyT(v.duration)}` : ""} ${kindTxt}</small></summary>
      <p class="hint">اكتب النص (وكل كلمة تأخذ وقت تقريبي)، أو ارفع صوت أو فيديو والنص يُكتب بتوقيته. إذا رفعت فيديو، التايبوجرافي يتركب فوقه.</p>
      ${v.source?.kind === "audio" || v.source?.kind === "video" ? `<p class="ty-words" dir="auto" data-no-i18n>${(v.words || []).map((w) => tye(w.w)).join(" ")}</p>`
        : `<textarea rows="4" dir="auto" data-tytext placeholder="النص الذي سيتحوّل لتايبوجرافي" data-no-i18n>${tye(v.script || "")}</textarea>
           <button type="button" class="btn sm" data-tysavetext ${busy ? "disabled" : ""}>✍️ استخدم هذا النص</button>`}
      <div class="row wrap"><label class="btn sm">⬆ ارفع صوت أو فيديو<input type="file" data-tysrc accept="audio/*,video/*,.mp3,.m4a,.wav,.mp4,.mov" hidden></label>
        <button type="button" class="btn sm ${tyx.rec ? "danger" : ""}" data-tyrec ${busy ? "disabled" : ""}>${tyx.rec ? "⏹ أوقف واستخدم التسجيل" : "🎙️ سجّل صوتك"}</button>
        ${tyx.rec ? `<b class="num" data-tyrect>0:00</b>` : ""}</div>
      ${tyx.styles.find((x) => x.id === v.style)?.audio_only ? `<p class="hint">✏️ هذا الأسلوب يأخذ الصوت فقط: إن رفعت فيديو فلن تظهر صورته، ويكون النص والرسومات بخط رفيع على خلفية سوداء.</p>` : ""}
      ${v.source_url && v.source?.kind !== "text" ? (v.source.kind === "video" ? `<video src="${v.source_url}" controls playsinline preload="metadata" class="ty-src"></video>`
        : `<audio src="${v.source_url}" controls preload="metadata"></audio>`) : ""}
    </details>
    ${v.source?.kind === "video" ? tySceneView(v, busy) : ""}
    <details class="panel tv-step" ${tyx.open.s2 ?? !!v.words?.length ? "open" : ""} data-tydk="s2"><summary>٢. 🧠 الحركات <small class="muted">${v.blocks?.length ? `${v.blocks.length} لقطة` : ""}</small></summary>
      <div class="row wrap"><input type="text" data-tybrief placeholder="عن الفيديو (اختياري): من يتكلم ولمين وماذا الإحساس" value="${tye(v.brief || "")}" data-no-i18n>
        <button type="button" class="btn primary" data-typlan ${busy || !v.words?.length ? "disabled" : ""}>🧠 ${v.blocks?.length ? "وزّعه من جديد" : "وزّع النص على الحركات"}</button></div>
      ${v.missing_icons?.length ? `<div class="ty-miss"><span>أيقونات غير في المكتبة: ${v.missing_icons.map((n) => tyIconChip(n)).join("")}</span>
        <button type="button" class="btn sm primary" data-tyicons ${busy ? "disabled" : ""}>🎨 ارسمهم (~${v.draw_cost}$)</button></div>` : ""}
      <div class="ty-blocks">${(v.blocks || []).map((b, i) => tyBlockRow(v, b, i)).join("")}</div>
    </details>
    ${v.blocks?.length ? `<section class="panel ty-preview">
      <div class="ty-screen" id="tyScreen"><div class="ty-wrap"><div class="ty-box" id="tyBox" style="touch-action:none"><div class="ty-bg" id="tyBg"></div><div id="tyStage"></div></div>
        <svg class="ty-giz" id="tyGiz"></svg></div></div>
      <div class="ty-gbar" id="tyGbar"></div>
      <p class="hint">✋ اسحب الكتلة من نصها لتحريكها، ومن الأركان لتكبيرها أو تصغيرها، والدوائر الثلاث تدوّرها: 🔵 الأزرق تدوير عادي، 🔴 الأحمر للأمام والخلف، 🟢 الأخضر يمينًا ويسارًا. «🔲 أركان» يتيح لك لصق كل ركن تلقائيًا على ورقة أو شاشة في الفيديو.</p>
      <div class="ty-ctrl"><button type="button" class="btn sm" data-typlay>▶️</button>
        <input type="range" min="0" max="${v.duration}" step="0.01" value="${tyx.t}" data-tyscrub><small class="muted" id="tyTime"></small></div>
      <div class="row wrap"><select data-tyq><option value="high">جودة كاملة (1080)</option><option value="fast">أسرع (720)</option></select>
        <button type="button" class="btn primary" data-tyrender ${busy ? "disabled" : ""}>🎬 ${v.final_url ? "أنشئ الفيديو مرة أخرى" : "أنشئ الفيديو"}</button>
        <small class="muted">المعاينة هنا بنفس الرسم الذي سيظهر في الفيديو. الفيديو يُرسم على الخادم فريم فريم (دقيقة تقريبًا لكل 15 ثانية).</small></div>
      ${tySoundLine(v.sound)}
      ${v.final_url ? `<video src="${v.final_url}" controls playsinline preload="metadata" class="ty-final"></video>` : ""}
    </section>` : ""}`;
  tyStatusOnly();
  tyMountPreview();
}

function tySceneView(v, busy) {
  const an = v.scene?.anchors;
  return `<details class="panel tv-step" ${tyx.open.s15 ?? true ? "open" : ""} data-tydk="s15"><summary>👁️ ما في الفيديو <small class="muted">${an ? `${an.length} شيء` : "لم يُحلّل بعد"}</small></summary>
    <p class="hint">البرنامج يرى الأشياء التي في الكادر (صورة، ورقة، شاشة، وجه...) وأماكنها وهي تتحرك، لكي النص يُكتب جنبها أو عليها، والكلمة التي تشاور على شيء (مثل «me» وفيه صورتك) ما لا تُكتب والشيء نفسها تصبح مكانها. يُنشأ تلقائيًا مع «🧠 وزّع».</p>
    <div class="row wrap"><button type="button" class="btn sm" data-tyscene ${busy ? "disabled" : ""}>👁️ ${an ? "حلّله من جديد" : "حلّل الفيديو"}</button>
      <label class="ty-check"><input type="checkbox" data-tyguides ${tyx.guides ? "checked" : ""}> اعرض أماكنها على المعاينة</label></div>
    ${v.scene ? `<p class="hint">${!v.scene.person?.present ? "🧍 لا يوجد شخص ظاهر بوضوح في الفيديو"
      : v.scene.person.model === "video" ? "🧍 الشخص قُرئ بموديل الفيديو ✓"
      : "🧍 الشخص قُرئ بالنموذج القديم (حلّل الفيديو مرة أخرى بعد تحديث الخادم)"}</p>` : ""}
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
      ${i < v.blocks.length - 1 ? `<button type="button" class="btn sm" data-tymerge="${i}" title="يضم هذه اللقطة مع ما بعدها">⤵ ضم</button>` : ""}
      ${(b.to - b.from) >= 1 ? `<button type="button" class="btn sm" data-tysplit="${i}" title="يقسم اللقطة نصين">✂️ قسّم</button>` : ""}</header>
    ${v.scene?.anchors?.length && v.bg?.kind === "source" ? `<div class="row wrap">
      <select data-tbf="anchor"><option value="">📍 بدون مرساة (نص الشاشة)</option>${v.scene.anchors.map((a) => `<option value="${a.id}" ${a.id === b.anchor ? "selected" : ""}>📍 ${a.id} · ${TY_AKINDS[a.kind] || a.kind} · ${tye(a.label)}</option>`).join("")}</select>
      ${b.anchor ? `<select data-tbf="place">${Object.entries(TY_PLACES).map(([k, l]) => `<option value="${k}" ${k === (b.place || "auto") ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
      ${b.anchor && b.kind === "anchor" ? `<label>الكلمة التي الشيء نفسها مكانها <select data-tbf="skip"><option value="-1">—</option>${(b.words || []).map((w, j) => `<option value="${j}" ${j === b.skip ? "selected" : ""}>${tye(w.w)}</option>`).join("")}</select></label>` : ""}
    </div>` : ""}
    ${TY_INTRO[b.kind] || b.kind === "sign" || b.kind === "signature" || TY_FOCUS.includes(b.kind) ? `<div class="row wrap">
      ${TY_INTRO[b.kind] ? `<select data-tbf="intro">${Object.entries(TY_INTRO[b.kind]).map(([k, l]) => `<option value="${k}" ${k === (b.intro || "") ? "selected" : ""}>${l}</option>`).join("")}</select>
        <select data-tbf="outro">${Object.entries(TY_OUTRO[b.kind]).map(([k, l]) => `<option value="${k}" ${k === (b.outro || "") ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
      ${TY_FOCUS.includes(b.kind) ? `<label>الكلمة التي عليها الضغط <select data-tbf="focus"><option value="-1">—</option>${(b.words || []).map((w, j) => `<option value="${j}" ${j === b.focus ? "selected" : ""}>${tye(w.w)}</option>`).join("")}</select></label>` : ""}
      ${b.kind === "sign" || b.kind === "signature" ? `<label>الإمضا <input data-tbf="sign" value="${tye(b.sign || "")}" dir="auto" data-no-i18n></label>` : ""}
    </div>` : ""}
    <div class="row wrap"><label>📐 حجم النص <input type="range" min="0.3" max="2.5" step="0.05" data-tbf="ms" value="${b.ms ?? 1}"></label>
      ${window.TypoEngine?.STUDIO?.has(b.kind) ? `<label>🎞️ الدخول <select data-tbf="trans">${Object.entries(TY_TRANS).map(([k, l]) => `<option value="${k}" ${k === (b.trans || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
      ${(b.mx || b.my || (b.ms ?? 1) !== 1) ? `<button type="button" class="btn sm" data-tyreset="${i}">↺ استعد المكان والحجم</button>` : ""}</div>
    ${v.words?.length && b.to >= b.from ? `<div class="wd-row" dir="auto" title="اضغط على أي كلمة وصحّحها إن سُمعت خطأً">✏️ ${v.words.slice(b.from, b.to + 1).map((w, j) => `<input class="wd" data-tyword="${b.from + j}" value="${tye(w.w)}" size="${Math.max(2, [...w.w].length + 1)}" dir="auto" spellcheck="false" data-no-i18n>`).join("")}</div>` : ""}
    <div class="row wrap"><label>المكتوب <input data-tbf="text" value="${tye(b.text)}" dir="auto" data-no-i18n></label>
      ${b.kind === "build" ? `<label>الكلمة التي تضيء <select data-tbf="focus"><option value="-1">—</option>${(b.words || []).map((w, j) => `<option value="${j}" ${j === b.focus ? "selected" : ""}>${tye(w.w)}</option>`).join("")}</select></label>` : ""}
      ${b.kind === "letters" ? `<label>الحرف الذي يُستبدل <input type="number" min="0" max="20" data-tbf="letter" value="${b.letter ?? 1}"></label>` : ""}
      ${["icon", "letters", "ring", "spot"].includes(b.kind) ? `<span class="ty-icons">${icons.map((n, j) => tyIconChip(n, `data-tyrm="${j}"`)).join("")}
        <select data-tyadd>${stkOpts}</select></span>` : ""}
      ${b.kind === "build" ? `<span class="ty-icons">${side.map((n) => tyIconChip(n, 'data-tyrmside="1"')).join("")}${side.length ? "" : `<select data-tyside>${stkOpts.replace("＋ ستيكر", "＋ صورة بجانب النص")}</select>`}</span>` : ""}
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
      if (el) el.innerHTML = `<span class="lab-st working"><span class="spin-inline"></span> ⬆ جارٍ رفع ${tye(file.name)} (${mb} ميجا): ${pct}%</span>
        <span class="bar" style="display:inline-block;width:160px;height:6px;border-radius:3px;background:rgba(127,127,127,.25);vertical-align:middle;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:var(--accent,#3b82f6)"></i></span>`;
    };
    show(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) show(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* غير JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) { toast("✅ رُفع"); resolve(data); }
      else reject(new Error(typeof data.detail === "string" ? data.detail : `فشل الرفع (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("الرفع توقف: تأكد من النت وجرب مرة أخرى"));
    xhr.ontimeout = () => reject(new Error("الرفع خذ وقت طويل جدًا: جرب فيديو أصغر"));
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
    : sd.voice === "silent" ? "⚠️ الفيديو الذي رفعته لا يحتوي صوت (إذا هذا «الصورة فقط» من المعمل، ارفع الفيديو الأصلي)" : "🔇 لا يوجد صوت نص (النص مكتوب)";
  const fx = !sd.sfx_on ? "🔇 بدون كليكات" : n ? `🔊 النقرات ${sd.sfx_level ?? 100}٪ (${n} صوت في المكتبة)` : "⚠️ مكتبة الأصوات فارغة على الخادم: ارفعها مرة أخرى من «🔊 الأصوات»";
  return `<p class="hint">${voice} · ${fx}</p>`;
}

// ---------- المعاينة الحية (نفس المحرك اللي بيرسم الفيديو)

async function tyMountPreview() {
  const v = tyx.cur, stage = $("tyStage");
  if (!stage) return;
  const doc = await api(TY(`/${v.id}/doc`));
  tyx.eng = new TypoEngine(stage, doc);
  Object.assign(stage.style, { position: "absolute", left: "0", top: "0" });
  tyx.eng.showAnchors = !!tyx.guides;   // الصفحة عربي (RTL): المسرح يظل من الشمال
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
  tyx.eng.editing = true;
  tyGizBind(GZ_TYPO);
  tySeek(tyx.t);
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
    tySaveBlocks(blocks, "✋ مكان النص حُفظ");
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", end);
}

function tySeek(t) {
  if (!tyx.eng) return;
  tyx.t = Math.max(0, Math.min(t, tyx.doc.duration));
  tyx.eng.renderAt(tyx.t);
  GZ = GZ_TYPO;
  tyGizDraw();
  const s = document.querySelector("[data-tyscrub]");
  if (s) s.value = tyx.t;
  const tm = $("tyTime");
  if (tm) tm.textContent = `${tyT(tyx.t)} / ${tyT(tyx.doc.duration)}`;
  const bv = $("tyBg")?.querySelector("video");
  if (bv && !tyx.play) { try { bv.currentTime = tyx.t % (bv.duration || 1e9); } catch { /* ما زال يُحمّل */ } }
}

function tyStop() {
  if (tyx.play) cancelAnimationFrame(tyx.play.raf);
  if (tyx.play?.vfc && tyx.play.video?.cancelVideoFrameCallback) tyx.play.video.cancelVideoFrameCallback(tyx.play.vfc);
  if (tyx.play?.video) tyx.play.video.muted = true;
  tyx.play?.audio?.pause();
  $("tyBg")?.querySelector("video")?.pause();
  tyx.play = null;
  const b = document.querySelector("[data-typlay]");
  if (b) b.textContent = "▶️";
  GZ = GZ_TYPO;
  tyGizDraw();   // أدوات التحكم تختفي وقت التشغيل وتعود أول ما يقف
}

function tyStart() {
  if (!tyx.eng) return;
  if (tyx.t >= tyx.doc.duration - 0.05) tyx.t = 0;
  const v = tyx.cur;
  let audio = null;
  const sync = v.bg?.kind === "source" && !!$("tyBg")?.querySelector("video")?.requestVideoFrameCallback;
  if (!sync && v.source_url && v.source?.kind !== "text") {
    audio = new Audio(v.source_url);
    audio.currentTime = tyx.t;
    audio.play().catch(() => {});
  }
  const bv = $("tyBg")?.querySelector("video");
  // الخلفية هي الفيديو نفسه: الفيديو هو الساعة (وصوته هو الصوت)، والكلام بيترسم على نفس الفريم اللي ظاهر بالظبط
  // (من غير كده الفيديو والكلام كانوا بيمشوا بساعتين، فقص الشخص من الكلمة ييجي على فريم تاني والكلمة ترعش)
  if (bv && sync) {
    bv.muted = false;
    bv.currentTime = tyx.t;
    tyx.play = { video: bv };
    const onFrame = (now, meta) => {
      if (!tyx.play) return;
      tySeek(meta.mediaTime);
      if (meta.mediaTime >= tyx.doc.duration - 0.04 || bv.ended) return tyStop();
      tyx.play.vfc = bv.requestVideoFrameCallback(onFrame);
    };
    tyx.play.vfc = bv.requestVideoFrameCallback(onFrame);
    bv.play().catch(() => { bv.muted = true; bv.play().catch(() => {}); });
    document.querySelector("[data-typlay]").textContent = "⏸";
    return;
  }
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

// 🎙️ تسجيل الصوت من المتصفح: لما يوقف، التسجيل بيترفع كأنه ملف صوت (والكلام بيتكتب بتوقيته)
async function tyRecord(v) {
  if (tyx.rec) { tyx.rec.mr.stop(); return; }
  if (v.blocks?.length && !(await uiConfirm("أتسجّل من جديد؟ سيُستبدل النص والحركات الحالية."))) return;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast("تعذّر فتح الميكروفون. اسمح للمتصفح يستخدمه", true); }
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((x) => window.MediaRecorder?.isTypeSupported?.(x)) || "";
  const mr = new MediaRecorder(stream, type ? { mimeType: type } : {}), parts = [], t0 = Date.now();
  mr.ondataavailable = (e) => e.data.size && parts.push(e.data);
  mr.onstop = async () => {
    stream.getTracks().forEach((x) => x.stop());
    clearInterval(tyx.rec?.tick);
    tyx.rec = null;
    tyRender();
    if ((Date.now() - t0) < 1500 || !parts.length) return toast("التسجيل قصير جدًا", true);
    const ext = (mr.mimeType || type).includes("mp4") ? "m4a" : "weba";   // weba غير webm: لكي يتعامل كصوت (يتحوّل m4a) غير فيديو
    const file = new File(parts, `تسجيل.${ext}`, { type: mr.mimeType || type || "audio/webm" });
    try { tyx.cur = await tyUpload(TY(`/${v.id}/source`), file); tyx.force = true; tyRender(); tyPoll(); } catch (err) { toast(err.message, true); }
  };
  mr.start(500);
  tyx.rec = { mr, tick: setInterval(() => { const el = document.querySelector("[data-tyrect]"); if (el) { const s = Math.floor((Date.now() - t0) / 1000); el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; } }, 500) };
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
        morphing(tyRender);
        if (tyx.cur.status === "failed") toast(tyx.cur.error || "فشل", true);
        else if (was === "rendering") toast("🎬 الفيديو جاهز");
      } else morphing(tyStatusOnly);
    } catch { /* الخادم يعيد التشغيل */ }
    tyPoll();
  }, 1500);
}

$("tyNew").onclick = async () => {
  const name = (await uiPrompt("اسم الفيديو:", "تايبوجرافي"));
  if (name === null) return;
  try {
    const v = await api(TY(""), { method: "POST", ...jsonBody({ name, ratio: "9:16", style: tyx.styles[0]?.id || "mono-red" }) });
    tyx.list = await api(TY(""));
    await tyOpen(v.id);
  } catch (err) { toast(err.message, true); }
};

// ---------- 🔊 الأصوات الرسمية
const TY_SFX = { click: ["🖱️ نقرات", "على كل كلمة أو حرف أو عنصر يظهر أو يختفي (البرنامج يبدّل بينهم)"],
  key: ["⌨️ ضغطات لوحة المفاتيح", "على كتابة الرسائل فقط (حرف حرف)"], typing: ["💬 كتابة", "صوت كتابة رسالة كامل (احتياطي إذا لا يوجد ضغطات)"] };
function tyRenderSfx() {
  const lib = tyx.sfx || {};
  $("tySfx").innerHTML = `<div class="car-head"><h2>🔊 الأصوات الرسمية <small class="muted">${Object.values(lib).flat().length}</small></h2>
      <label class="btn sm primary">⬆ ارفع wav أو zip<input type="file" data-sfxup accept=".wav,.zip,audio/wav" multiple hidden></label></div>
    <p class="hint">اسم الملف يحدد مكان وضعه: <b>click_</b>… نقرة ظهور واختفاء · <b>key_</b>… ضغطة لوحة مفاتيح · <b>typing_</b>… كتابة رسالة. توضع الأصوات تلقائيًا عند صنع الفيديو، ويمكنك إطفاؤها من «الأصوات» في المشروع.</p>
    ${Object.entries(TY_SFX).map(([k, [l, h]]) => `<section class="ty-sfx"><h3>${l} <small class="muted">${(lib[k] || []).length} · ${h}</small></h3>
      <div class="ty-sfx-list">${(lib[k] || []).map((f) => `<div class="ty-sfx-row"><button type="button" class="btn sm" data-sfxplay="${f.url}">▶️</button>
        <span data-no-i18n>${tye(f.name)}</span><button type="button" class="btn sm danger" data-sfxdel="${tye(f.name)}">🗑️</button></div>`).join("") || `<p class="muted">لا يوجد شيء بعد.</p>`}</div></section>`).join("")}`;
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
  if (del && (await uiConfirm(`أتحذف ${del.dataset.sfxdel}؟`))) {
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
    tyx.sfx = r; toast(`🔊 أُضيف ${r.added.length} صوت`); tyRender();
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

// 📚 مكتبة الخلفيات: صور وفيديوهات حقيقية متصوّرة من Pexels (مش متولّدة). البحث بالعربي بيتترجم لوحده.
const TY_STOCK = { q: "", kind: "video", items: [], page: 1, next: false, busy: false };
function tyStockOpen(v, kind) {
  TY_STOCK.kind = kind === "image" ? "photo" : "video";
  let el = document.getElementById("tyStock");
  if (!el) {
    el = Object.assign(document.createElement("div"), { id: "tyStock", className: "ty-stock" });
    document.body.appendChild(el);
    el.addEventListener("click", tyStockClick);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-stq]")) { e.preventDefault(); tyStockSearch(e.target.value, 1); } });
    el.addEventListener("mouseover", (e) => { const vd = e.target.closest("[data-stv]")?.querySelector("video"); if (vd) vd.play().catch(() => {}); });
    el.addEventListener("mouseout", (e) => { const vd = e.target.closest("[data-stv]")?.querySelector("video"); if (vd) vd.pause(); });
  }
  el.hidden = false;
  tyStockDraw();
  el.querySelector("[data-stq]")?.focus();
}
const tyStockOrient = () => ({ "9:16": "portrait", "4:5": "portrait", "16:9": "landscape", "1:1": "square" })[tyx.cur?.ratio] || "portrait";
function tyStockDraw() {
  const el = document.getElementById("tyStock"), st = TY_STOCK;
  el.innerHTML = `<div class="ty-stock-box" role="dialog" aria-label="مكتبة الخلفيات">
    <div class="ty-stock-top"><b>📚 مكتبة الخلفيات</b><small class="muted">صور وفيديوهات حقيقية مصوَّرة، غير مولَّدة</small><button type="button" class="btn sm" data-stclose>✕</button></div>
    <div class="ty-stock-bar"><input type="search" data-stq dir="auto" placeholder="ابحث بأي كلمة: قهوة، مدينة ليلًا، بحر، مكتب…" value="${tye(st.q)}">
      <div class="seg"><button type="button" class="btn sm ${st.kind === "video" ? "primary" : ""}" data-stkind="video">🎬 فيديو</button><button type="button" class="btn sm ${st.kind === "photo" ? "primary" : ""}" data-stkind="photo">🖼️ صورة</button></div>
      <button type="button" class="btn primary sm" data-stgo>ابحث</button></div>
    ${st.q_en && st.q_en !== st.q ? `<small class="muted">يبحث عن: <span data-no-i18n dir="ltr">${tye(st.q_en)}</span></small>` : ""}
    <div class="ty-stock-grid">${st.busy && !st.items.length ? `<p class="muted">⏳ جارٍ البحث…</p>` : st.items.length ? st.items.map((it, i) => `<button type="button" class="ty-stock-it" data-stpick="${i}" ${it.kind === "video" ? "data-stv" : ""} title="${tye(it.author)}">
        <img src="${tye(it.thumb)}" alt="" loading="lazy">${it.kind === "video" ? `<video src="${tye(it.preview)}" muted loop playsinline preload="none"></video><em class="num">${Math.round(it.dur || 0)}ث</em>` : ""}
        <small data-no-i18n>${tye(it.author)}</small></button>`).join("") : st.q ? `<p class="muted">لا توجد نتائج. جرّب كلمة أخرى.</p>` : `<p class="muted">اكتب كلمة واضغط Enter.</p>`}</div>
    <div class="ty-stock-foot">${st.next ? `<button type="button" class="btn sm" data-stmore ${st.busy ? "disabled" : ""}>نتائج أكثر</button>` : "<span></span>"}
      <a href="https://www.pexels.com" target="_blank" rel="noopener" class="muted" data-no-i18n data-brand-keep>Photos & videos provided by Pexels</a></div></div>`;
}
async function tyStockSearch(q, page) {
  const st = TY_STOCK;
  st.q = String(q ?? st.q).trim();
  if (!st.q) return;
  st.busy = true; st.page = page;
  if (page === 1) st.items = [];
  tyStockDraw();
  try {
    const r = await api(`/api/stock/search?${new URLSearchParams({ q: st.q, kind: st.kind, orient: tyStockOrient(), page })}`);
    st.items = page === 1 ? r.items : [...st.items, ...r.items];
    st.next = r.next; st.q_en = r.q_en;
  } catch (err) { toast(err.message, true); }
  st.busy = false;
  tyStockDraw();
}
async function tyStockClick(e) {
  const t = e.target, st = TY_STOCK, el = document.getElementById("tyStock");
  if (t === el || t.closest("[data-stclose]")) { el.hidden = true; return; }
  const k = t.closest("[data-stkind]");
  if (k) { st.kind = k.dataset.stkind; if (st.q) return tyStockSearch(st.q, 1); return tyStockDraw(); }
  if (t.closest("[data-stgo]")) return tyStockSearch(el.querySelector("[data-stq]").value, 1);
  if (t.closest("[data-stmore]")) return tyStockSearch(st.q, st.page + 1);
  const pk = t.closest("[data-stpick]");
  if (pk) {
    const it = st.items[Number(pk.dataset.stpick)], v = tyx.cur;
    if (!it || !v) return;
    pk.classList.add("busy");
    toast(it.kind === "video" ? "⏳ جارٍ تنزيل الفيديو…" : "⏳ جارٍ تنزيل الصورة…");
    try {
      tyx.cur = await api(TY(`/${v.id}/bg-stock`), { method: "POST", ...jsonBody({ kind: it.kind, file: it.file, author: it.author, author_url: it.author_url, page: it.page }) });
      el.hidden = true;
      tyx.force = true;
      tyRender();
      toast("✓ وُضعت الخلفية");
    } catch (err) { pk.classList.remove("busy"); toast(err.message, true); }
  }
}
document.addEventListener("keydown", (e) => { const el = document.getElementById("tyStock"); if (e.key === "Escape" && el && !el.hidden) el.hidden = true; });

$("tyMain").addEventListener("click", async (e) => {
  const t = e.target, v = tyx.cur;
  const wrap = (btn, fn) => busyButton(btn, "⏳", async () => { try { await fn(); } catch (err) { toast(err.message, true); } });
  const stk = t.closest("[data-tystock]");
  if (stk) return tyStockOpen(v, stk.dataset.tystock);
  const bga = t.closest("[data-tybgauto]");
  if (bga) {
    if ((v.bg?.file) && !(await uiConfirm("ستُستبدل الخلفية الحالية بخلفيات يختارها البرنامج بحسب النص. أتُكمل؟"))) return;
    return wrap(bga, async () => { tyx.cur = await api(TY(`/${v.id}/bg-auto`), { method: "POST", ...jsonBody({ kind: bga.dataset.tybgauto === "image" ? "photo" : "video" }) }); tyRender(); tyPoll(); });
  }
  const play = t.closest("[data-typlay]");
  if (play) return tyx.play ? tyStop() : tyStart();
  const rs = t.closest("[data-tyreset]");
  if (rs) {
    const blocks = JSON.parse(JSON.stringify(v.blocks));
    Object.assign(blocks[Number(rs.dataset.tyreset)], { mx: 0, my: 0, ms: 1 });
    return tySaveBlocks(blocks, "↺ أعد مكانه");
  }
  const seek = t.closest("[data-tyseek]");
  if (seek) { tyStop(); tySeek(Number(seek.dataset.tyseek)); return $("tyScreen")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
  const sc = t.closest("[data-tyscene]");
  if (sc) return wrap(sc, async () => { tyx.cur = await api(TY(`/${v.id}/scene`), { method: "POST" }); tyRender(); tyPoll(); });
  if (t.closest("[data-tyrec]")) return tyRecord(v);
  const st = t.closest("[data-tysavetext]");
  if (st) return wrap(st, () => tyPatch({ text: document.querySelector("[data-tytext]").value }));
  const plan = t.closest("[data-typlan]");
  if (plan) {
    if (v.blocks?.length && !(await uiConfirm("توزّع النص من جديد؟ التعديلات التي عملتها على اللقطات ستُستبدل."))) return;
    return wrap(plan, async () => {
      tyx.cur = await api(TY(`/${v.id}/plan`), { method: "POST", ...jsonBody({ brief: document.querySelector("[data-tybrief]").value }) });
      tyRender(); tyPoll();
    });
  }
  const ic = t.closest("[data-tyicons]");
  if (ic) {
    if (!(await uiConfirm(`يرسم ${v.missing_icons.length} أيقونة ناقصة هذا بالستايل؟ نحو ${v.draw_cost}$`))) return;
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
      toast("🎞️ فُتح في مونتاج الإعلانات");
      showStep("6a");
    });
  }
  const del = t.closest("[data-tydel]");
  if (del) {
    if (!(await uiConfirm(`أتحذف «${v.name}»؟`))) return;
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
    return tySaveBlocks(bl, "⤵ ضُمّوا");
  }
  const split = t.closest("[data-tysplit]");
  if (split) {
    const i = Number(split.dataset.tysplit), bl = tyBlocksFromDom(), b = bl[i];
    const mid = b.from + Math.floor((b.to - b.from + 1) / 2) - 1;
    bl.splice(i + 1, 0, { ...b, from: mid + 1, text: "", kind: b.kind === "pop" ? "build" : b.kind });
    b.to = mid;
    b.text = "";
    return tySaveBlocks(bl, "✂️ قُسّمت");
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
    if (t.matches("[data-tyword]")) {   // تصليح كلمة سُمعت خطأ: نفس التوقيت
      const val = t.value.trim(), i = Number(t.dataset.tyword);
      if (!val) { t.value = v.words[i].w; return; }
      const words = v.words.map((w) => w.w);
      words[i] = val;
      await tyPatch({ words });
      return toast("✏️ صُحّحت الكلمة");
    }
    if (t.matches("[data-tyname]")) { tyx.cur = await api(TY(`/${v.id}`), { method: "PATCH", ...jsonBody({ name: t.value }) }); tyx.list = await api(TY("")); return tyRender(); }
    if (t.matches("[data-tyopt]")) return tyPatch({ [t.dataset.tyopt]: t.value });
    if (t.matches("[data-tysfx]")) { await tyPatch({ sfx_level: Number(t.value) }); return toast(Number(t.value) ? `🔊 النقرات: ${t.value}` : "🔇 بدون كليكات"); }
    if (t.matches("[data-tyfont]")) return tyPatch({ fonts: { ...(v.fonts || {}), [t.dataset.tyfont]: t.value } });
    if (t.matches("[data-tybg]")) return tyPatch({ bg: { ...(v.bg || {}), [t.dataset.tybg]: t.dataset.tybg === "dim" ? Number(t.value) : t.value } });
    if (t.matches("[data-tybgfile]") && t.files[0]) {
      tyx.cur = await tyUpload(TY(`/${v.id}/bg`), t.files[0]);
      tyx.force = true;
      return tyRender();
    }
    if (t.matches("[data-tysrc]") && t.files[0]) {
      if (v.blocks?.length && !(await uiConfirm("ترفع ملف جديد؟ النص والحركات الحالية سيتبدلون."))) return;
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
    if (t.matches("[data-tbf]")) return tySaveBlocks(tyBlocksFromDom(), "✅ حُفظ");
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
        <label class="ty-check"><input type="checkbox" data-stkkey checked> أزل الخلفية السادة</label></div></div>
    <div class="row wrap"><input type="text" data-stkdesc placeholder="وصف أيقونة جديدة (مثلًا: pixel art dumbbell)" data-no-i18n>
      <select data-stkstyle>${tyx.styles.map((s) => `<option value="${s.id}">${tye(s.name)}</option>`).join("")}</select>
      <button type="button" class="btn sm" data-stkdraw>🎨 ارسمها (~0.03$)</button></div>
    <p class="hint">الستيكرات التي قُصّت من فيديو يمكن يصبح فيها حتت من أشياء جنبها: «✨ نضّفها» يرسمها تلقائيًا بنفس شكلها (نحو 0.03$).</p>
    ${tyDictView()}
    <div class="ty-stk">${tyx.stk.map((s) => `<figure data-stk="${s.id}"><div class="ty-checker"><img src="${s.url}" alt=""></div>
      <input value="${tye(s.name)}" data-stkname data-no-i18n>
      <label class="ty-concept" title="معنى الأيقونة في القاموس: النص الذي يدل عليه يجلب هذه الأيقونة">📖 <input value="${tye(s.concept || "")}" data-stkconcept placeholder="المعنى" data-no-i18n></label>
      <small class="muted">${s.source.startsWith("lab:") ? "🔬 من المعمل" : s.source === "drawn" ? "🎨 مترسومة" : "⬆ مرفوعة"}${s.style ? ` · ${tye(tyx.styles.find((x) => x.id === s.style)?.name || s.style)}` : ""}</small>
      <div class="row">${s.source.startsWith("lab:") ? `<button type="button" class="btn sm" data-stkclean title="يرسمها تلقائيًا نضيفة بنفس شكلها">✨ نضّفها</button>` : ""}
        <button type="button" class="btn sm danger" data-stkdel>🗑️</button></div></figure>`).join("") || `<p class="muted">لا يوجد بعد ستيكرات</p>`}</div>`;
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
      tyx.stk = await api(TY("/stickers")); tyRender(); toast("🎨 أُضيفت");
    });
  }
  const fig = t.closest("[data-stk]");
  if (!fig) return;
  const id = fig.dataset.stk;
  const clean = t.closest("[data-stkclean]");
  if (clean) return wrap(clean, async () => { await api(TY(`/stickers/${id}/clean`), { method: "POST" }); tyx.stk = await api(TY("/stickers")); tyRender(); toast("✨ أُضيفت نسخة نضيفة"); });
  const del = t.closest("[data-stkdel]");
  if (del) {
    if (!(await uiConfirm("أتحذف هذا الملصق؟"))) return;
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
      toast("⬆ يرفع...");
      await api(TY("/stickers"), { method: "POST", body: fd });
      tyx.stk = await api(TY("/stickers"));
      return tyRender();
    }
    if (t.matches("[data-stkconcept]")) {
      tyx.stk = await api(TY(`/stickers/${t.closest("[data-stk]").dataset.stk}`), { method: "PATCH", ...jsonBody({ concept: t.value }) });
      tyx.dict = await api(TY("/concepts"));
      tyRender();
      return toast("📖 حُفظ في القاموس");
    }
    if (t.matches("[data-stkname]")) {
      tyx.stk = await api(TY(`/stickers/${t.closest("[data-stk]").dataset.stk}`), { method: "PATCH", ...jsonBody({ name: t.value }) });
      return toast("✅ حُفظ");
    }
  } catch (err) { toast(err.message, true); }
});

// ---------- 📖 القاموس: كلمة ← معنى ← أيقونة بروح الستايل

function tyDictView() {
  const d = tyx.dict;
  if (!d) return "";
  return `<details class="panel ty-dict" ${tyx.open.dict ? "open" : ""} data-tydictdk><summary>📖 القاموس <small class="muted">${d.concepts.length} معنى · ${d.learned} كلمة تعلّمت</small></summary>
    <p class="hint">يُملأ تلقائيًا: كل أيقونة تُستخرج من فيديو في المعمل (أو تُرسم) تدخل بمعناها وكلماتها عربي وإنجليزي. الكلمة التي لا يعرفها يسأل عليها نموذج صغير مرة واحدة ويحفظ الإجابة.
      ونفس المعنى يمكن يصبح له أيقونة مختلفة في كل أسلوب: المشروع يأخذ أيقونة الأسلوب الخاص به أولًا.</p>
    ${d.untagged ? `<button type="button" class="btn sm" data-dicttag>🏷️ دخّل ${d.untagged} أيقونة قديمة للقاموس</button>` : ""}
    <div class="row wrap"><input type="text" data-dictc placeholder="المعنى (مثلًا dumbbell)" data-no-i18n><input type="text" data-dictar placeholder="كلمات عربي: حديد، دمبل، جيم" data-no-i18n>
      <input type="text" data-dicten placeholder="English words: weights, gym" data-no-i18n><button type="button" class="btn sm" data-dictadd>＋ أضف</button></div>
    <div class="ty-dict-list">${d.concepts.map((c) => `<div><b data-no-i18n>${tye(c.concept)}</b> <small class="muted">${c.stickers.length ? `🧩 ${c.stickers.length}` : "❔ لا يوجد أيقونة"}</small>
      <small dir="auto" data-no-i18n>${tye([...c.ar, ...c.en].slice(0, 14).join("، "))}</small></div>`).join("")}</div></details>`;
}

$("tyStk").addEventListener("toggle", (e) => { if (e.target.matches("[data-tydictdk]")) tyx.open.dict = e.target.open; }, true);

$("tyStk").addEventListener("click", async (e) => {
  const t = e.target;
  const wrap = (btn, fn) => busyButton(btn, "⏳", async () => { try { await fn(); } catch (err) { toast(err.message, true); } });
  const tag = t.closest("[data-dicttag]");
  if (tag) return wrap(tag, async () => { tyx.dict = await api(TY("/concepts/tag"), { method: "POST" }); tyx.stk = await api(TY("/stickers")); tyRender(); toast("🏷️ أُضيفوا للقاموس"); });
  const add = t.closest("[data-dictadd]");
  if (add) {
    const val = (k) => document.querySelector(`[data-dict${k}]`).value.trim();
    const split = (x) => x.split(/[,،]/).map((w) => w.trim()).filter(Boolean);
    if (!val("c")) return toast("اكتب المعنى", true);
    return wrap(add, async () => {
      tyx.dict = await api(TY("/concepts"), { method: "POST", ...jsonBody({ concept: val("c"), ar: split(val("ar")), en: split(val("en")) }) });
      tyx.open.dict = true; tyRender(); toast("📖 أُضيف");
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
      ${ty.status === "working" ? `<span class="lab-st working"><span class="spin-inline"></span> ${tye(ty.step || "يشاهد الفيديو")}</span>
        <button type="button" class="btn sm" data-ltstop>⏹ أوقف</button>` : ""}
      ${ty.status !== "working" && (data || ty.error) ? `<button type="button" class="btn sm danger" data-ltdel title="الأسلوب والستيكرات التي حُفظت يظلون">🗑️ احذف النتيجة</button>` : ""}
      ${ty.error ? `<small class="err">${tye(ty.error)}</small>` : ""}
      ${data ? `<small class="muted">${data.moments.length} لحظة · ${data.moments.reduce((a, m) => a + m.icons.filter((i) => i.url).length, 0)} ستيكر</small>` : ""}</summary>
    ${data ? `<div class="ty-labstyle"><b data-no-i18n>${tye(data.style.name)}</b> ${sw(data.style.light)}${sw(data.style.dark)}${sw(data.style.accent)}
        <small class="muted" dir="ltr" data-no-i18n>${tye(data.style.font_look)} ${data.style.icon_style ? `· ${tye(data.style.icon_style)}` : ""}</small>
        <button type="button" class="btn sm primary" data-ltuse>🔤 أنشئ فيديو هذا بالستايل</button></div>
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

$("labTypoBtn").onclick = async () => {
  const has = labx.cur?.typo?.data;
  if (!(await uiConfirm(has ? `تُخرج تايبوجرافي «${labx.cur.name}» من جديد؟ (الأسلوب والستيكرات القديمة يظلون في المكتبة)`
    : `يُخرج التايبوجرافي من «${labx.cur.name}»: الأسلوب، وكل لحظة النص تحوّل فيها لشكل، والأيقونات كستيكرات شفافة؟`))) return;
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
  if (stop) { e.preventDefault(); labx.cur = await api(`/api/lab/${labx.cur.id}/typo/stop`, { method: "POST" }); renderLab(); return toast("⏹ توقف"); }
  const del = t.closest("[data-ltdel]");
  if (del) {
    e.preventDefault();
    if (!(await uiConfirm("أتحذف نتيجة التايبوجرافي؟ (يبقى الأسلوب والملصقات في المكتبة)"))) return;
    labx.cur = await api(`/api/lab/${labx.cur.id}/typo`, { method: "DELETE" });
    return renderLab();
  }
  const use = t.closest("[data-ltuse]");
  if (use) {
    const name = (await uiPrompt("اسم الفيديو:", "تايبوجرافي"));
    if (name === null) return;
    try {
      const v = await api(TY(""), { method: "POST", ...jsonBody({ name, ratio: "9:16", style: labx.cur.typo.style_id }) });
      storageSet("studiomania.typo", v.id);
      tyx.cur = null;
      showStep("12");
    } catch (err) { toast(err.message, true); }
  }
});


// ---------- 🎛️ التحكم في البلوك على المعاينة نفسها: سحب، أركان، 3 دواير لفّ، أركان حرة، قدام/ورا الشخص، مفاتيح حركة، تراك
// المحرر (صفحة التايبوجرافي أو المونتاج) بيدّي الأدوات المكان والوقت والحفظ، ونفس الأدوات بتشتغل في الاتنين
const GZ_TYPO = {
  st: {},
  get doc() { return tyx.doc; }, get eng() { return tyx.eng; }, get t() { return tyx.t; }, get playing() { return !!tyx.play; },
  get cur() { return tyx.cur; }, set cur(v) { tyx.cur = v; },
  box: () => $("tyBox"), stage: () => $("tyStage"), svg: () => $("tyGiz"), bar: () => $("tyGbar"),
  stop: () => tyStop(), save: (blocks, msg) => tySaveBlocks(blocks, msg), redraw: () => tyx.eng.renderAt(tyx.t), after: () => { tyRender(); tyPoll(); },
};
let GZ = GZ_TYPO;

const TYG_RING = { z: "#3B82F6", x: "#EF4444", y: "#22C55E" };

function tyGizBlock() {
  const blocks = GZ.doc?.blocks || [];
  const want = GZ.selIndex?.();   // اللقطة المختارة إذا تغطي هذا الوقت (العناصر الحرة يمكن تتراكب)
  if (want != null && blocks[want] && GZ.t >= blocks[want].t0 && GZ.t < blocks[want].t1) return { i: want, b: blocks[want] };
  const i = blocks.findIndex((b) => GZ.t >= b.t0 && GZ.t < b.t1);
  return i < 0 ? null : { i, b: blocks[i] };
}

// مكان العلامات اللي المحرك حاططها على أركان المحتوى (بعد اللف والتراك) بالبكسل جوه المعاينة
function tyGizPts() {
  const box = GZ.box(), r0 = box?.getBoundingClientRect();
  if (!r0) return null;
  const pts = [];
  for (let k = 0; k < 5; k++) {
    const m = GZ.stage().querySelector(`[data-xfm="${k}"]`);
    if (!m) return null;
    const r = m.getBoundingClientRect();
    pts.push([r.left - r0.left, r.top - r0.top]);
  }
  return { pts, W: r0.width, H: r0.height };
}

const GZI = {   // أيقونات خطوط بسيطة (24×24)
  move: '<path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/>',
  pin: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="m12 9 3 3-3 3-3-3z"/>',
  track: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5"/>',
  person: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c.9-4.6 3.6-7 7-7s6.1 2.4 7 7"/>',
  keys: '<path d="m7 12 5-5 5 5-5 5z"/><path d="M2 12h3M19 12h3"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.34-5.66"/><path d="M4 4v4.5h4.5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  paper: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
};
const gzIcon = (n) => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${GZI[n]}</svg>`;
const GZ_MODES = [["move", "تحريك وتدوير", "اسحب من منتصف النص لتحريكه، ومن الأركان لتكبيره، والدوائر تدوّره: الأزرق تدوير عادي (Shift = كل 15°)، الأحمر للأمام والخلف، الأخضر يمينًا ويسارًا"],
  ["track", "تراك", ""]];

function tyGizDraw() {
  const svg = GZ.svg(), bar = GZ.bar();
  if (!svg) return;
  const g = tyGizBlock(), P = g && tyGizPts();
  const box = GZ.box();
  svg.setAttribute("width", box.offsetWidth + 160); svg.setAttribute("height", box.offsetHeight + 160);
  const mode = GZ.st.mode === "track" ? "track" : "move";
  const f = g?.b.xf || {};
  // وقت التشغيل: في وضع التراك حدود الحاجة بتفضل ظاهرة ماشية معاها (عشان تشوف هو متعرف عليها في كل الفريمات ولا لا)
  if (!g || !P || (GZ.playing && !(mode === "track" && f.tr))) { svg.innerHTML = ""; if (bar && !g) { bar.innerHTML = ""; bar.dataset.sig = ""; } return; }
  const o = 80, pin = !!TypoEngine.xfAt(g.b, GZ.t).pin;
  const pts = P.pts.map(([x, y]) => [x + o, y + o]);
  const [cx, cy] = pts[4];
  const poly = pts.slice(0, 4).map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");
  const span = Math.max(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), Math.hypot(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]));
  const R = Math.max(30, Math.min(74, span * 0.32));
  let h = `<defs><filter id="gzSh" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="#000" flood-opacity=".55"/></filter></defs>`;
  const tq = f.tr && GZ.eng.trackQuad(f.tr, GZ.t);
  if (mode === "move") {
    h += `<polygon points="${poly}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="3"/>
      <polygon data-g="move" points="${poly}" fill="rgba(91,140,255,.07)" stroke="#fff" stroke-width="1.2" style="cursor:move"/>`;
    if (!pin) {   // الدوائر: لفّة عادية (Z) وأمام/خلف (X) ويمين/شمال (Y)
      const ring = (role, el, col, lx, ly, lab) => `${el.replace("/>", ` fill="none" stroke="${col}" stroke-width="2.2" opacity=".95" filter="url(#gzSh)" style="pointer-events:none"/>`)}
        ${el.replace("/>", ` data-g="${role}" fill="none" stroke="transparent" stroke-width="14" style="cursor:${role === "rx" ? "ns-resize" : role === "ry" ? "ew-resize" : "grab"}"/>`)}
        <g filter="url(#gzSh)" style="pointer-events:none"><rect x="${lx - 8}" y="${ly - 8}" width="16" height="16" rx="5" fill="${col}"/><text x="${lx}" y="${ly + 3.6}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="system-ui">${lab}</text></g>`;
      h += ring("rz", `<circle cx="${cx}" cy="${cy}" r="${R * 1.2}"/>`, "#5B8CFF", cx, cy - R * 1.2, "Z")
        + ring("rx", `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R * 0.3}"/>`, "#FF5A6E", cx + R, cy, "X")
        + ring("ry", `<ellipse cx="${cx}" cy="${cy}" rx="${R * 0.3}" ry="${R}"/>`, "#2FD48A", cx, cy + R, "Y");
    }
    h += `<g filter="url(#gzSh)"><circle data-g="move" cx="${cx}" cy="${cy}" r="5" fill="#fff" stroke="#5B8CFF" stroke-width="2" style="cursor:move"/></g>`
      + pts.slice(0, 4).map((p, j) => `<g filter="url(#gzSh)"><circle data-g="c${j}" cx="${p[0]}" cy="${p[1]}" r="6.5" fill="#fff" stroke="#5B8CFF" stroke-width="2.2" style="cursor:nwse-resize"/></g>`).join("");
  } else {
    const acc = "#FACC15";
    h += `<polygon points="${poly}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1" stroke-dasharray="3 4" style="pointer-events:none"/>`;
    if (tq) {   // حدود الشيء الذي البرنامج متعرف عليها في هذا الفريم، وأركانها تتسحب إذا خطأ
      const k = P.W / GZ.doc.w, q = tq.map(([x, y]) => [x * k + o, y * k + o]);
      h += `<polygon points="${q.map((p) => p.join(",")).join(" ")}" fill="rgba(250,204,21,.10)" stroke="${acc}" stroke-width="2" filter="url(#gzSh)" style="pointer-events:none"/>`;
      if (!GZ.playing) h += q.map((p, j) => `<g filter="url(#gzSh)"><rect data-g="t${j}" x="${p[0] - 6.5}" y="${p[1] - 6.5}" width="13" height="13" rx="2.5" transform="rotate(45 ${p[0]} ${p[1]})" fill="${acc}" stroke="#1a1a1a" stroke-width="1.4" style="cursor:crosshair"/></g>`).join("");
    }
    if (GZ.st.pick || !tq) {
      GZ.st.hover = null;
      h += `<rect data-g="pick" x="${o}" y="${o}" width="${P.W}" height="${P.H}" fill="rgba(250,204,21,.03)" stroke="${acc}" stroke-width="1" stroke-dasharray="2 4" style="cursor:crosshair"/><g id="gzHover" style="pointer-events:none"></g>`;
      if (!GZ.playing) tyGizRegions();
    }
  }
  svg.innerHTML = h;
  if (!GZ.playing) tyGizBar(g, pin);
}

function tyGizBar(g, pin) {
  const bar = GZ.bar();
  if (!bar) return;
  const f = g.b.xf || {}, keys = g.b.xk?.length || 0, mode = GZ.st.mode === "track" ? "track" : "move";
  const person = !!GZ.doc.person;
  const canTrack = GZ.cur?.bg?.kind === "source" && GZ.cur?.source?.kind === "video";
  const busy = !!GZ.cur?.busy;
  const sig = `${g.i}|${pin}|${f.z}|${keys}|${GZ.st.keymode}|${f.tr}|${person}|${canTrack}|${GZ.st.pick || ""}|${mode}|${busy}|${GZ.st.reg?.loading ? 1 : 0}`;
  if (bar.dataset.sig === sig) return;
  bar.dataset.sig = sig;
  const btn = (act, icon, label, on, extra = "") => `<button type="button" class="gz-btn ${on ? "on" : ""}" data-tyg="${act}" ${extra}>${gzIcon(icon)}<span>${label}</span></button>`;
  let sub = "", hint = "";
  if (mode === "move") {
    hint = GZ_MODES[0][2];
    if (pin) { hint = "النص ملصق على الشيء: اسحبه من النص أو كبّره من الأركان"; sub = `<button type="button" class="gz-pill" data-tyg="unpin">${gzIcon("x")}فك اللصق</button>`; }
    else sub = `<button type="button" class="gz-pill" data-tyg="zrot">${gzIcon("reset")}صفّر التدوير</button>`;
  } else if (busy) hint = `⏳ ${GZ.cur.step || "جارٍ تتبع الشيء…"}`;
  else if (!f.tr || GZ.st.pick) {
    const rg = GZ.st.reg;
    hint = rg?.loading ? "⏳ جارٍ التعرف على الأشياء في هذا الإطار…" : "مرّر الفأرة على الشيء في الفيديو فتضيء حدوده. اضغط عليه وسيتتبعه البرنامج إطارًا إطارًا";
    sub = `<button type="button" class="gz-pill ${GZ.st.keymode || keys ? "on" : ""}" data-tyg="keys">${gzIcon("keys")}حركة بالوقت (دون تتبع)</button>`;
  } else {
    hint = "شغّل الفيديو وانظر إلى الحدود الصفراء وهي تتحرك مع الشيء. إن أخطأت في إطار: أوقف عنده واسحب أركانها إلى مكانها الصحيح";
    sub = `<button type="button" class="gz-pill" data-tyg="stick">${gzIcon("pin")}${pin ? "فك اللصق" : "الصق النص عليه"}</button>
      <button type="button" class="gz-pill" data-tyg="repick">${gzIcon("track")}شيء آخر</button>
      <button type="button" class="gz-pill" data-tyg="notrack">${gzIcon("x")}أزل التتبع</button>
      <button type="button" class="gz-pill ${GZ.st.keymode || keys ? "on" : ""}" data-tyg="keys">${gzIcon("keys")}حركة بالوقت</button>`;
  }
  if (keys) sub += `<span class="gz-chip">${gzIcon("keys")}${keys} نقاط حركة</span><button type="button" class="gz-pill" data-tyg="nokeys">${gzIcon("trash")}احذفها</button>`;
  else if (GZ.st.keymode) hint = "⏱️ حركة بالوقت: انتقل إلى ثانية أخرى وحرّك النص أو دوّره من «تحريك وتدوير»: سيحرّكه البرنامج تلقائيًا من مكانه هنا إلى مكانه هناك";
  bar.innerHTML = `<div class="gz-bar" role="toolbar">
      <div class="gz-seg">${btn("mode:move", "move", "تحريك وتدوير", mode === "move")}${canTrack ? btn("mode:track", "track", "تراك", mode === "track") : ""}</div>
      <i class="gz-sep"></i>
      ${btn("z", "person", f.z === "behind" ? "خلف الشخص" : "أمام الشخص", f.z === "behind", person ? 'title="يظهر النص خلف الشخص أم أمامه"' : 'disabled title="حلّل الفيديو أولًا ليعرف البرنامج مكان الشخص"')}
      <i class="gz-sep"></i>
      ${btn("reset", "reset", "استعد", false, 'title="يعيد اللقطة كما كانت"')}
    </div>
    <div class="gz-sub"><small class="gz-hint">لقطة ${g.i + 1} · ${hint}</small>${sub}</div>`;
}

// القيم الحالية بتتغير: لو المفاتيح شغالة بتتحفظ مفتاح في الثانية دي، غير كده بتتحفظ للبلوك كله
function tyXfPatch(b, patch) {
  if (b.xk?.length || GZ.st.keymode) {
    const cur = TypoEngine.xfAt(b, GZ.t);
    const t = Math.round(GZ.t * 100) / 100;
    const ks = (b.xk || []).filter((q) => Math.abs(q.t - t) > 0.04);
    const k = { t, x: cur.x, y: cur.y, s: cur.s, rx: cur.rx, ry: cur.ry, rz: cur.rz, ...(cur.pin ? { pin: cur.pin } : {}), ...patch };
    if (k.pin === null) delete k.pin;
    ks.push(k);
    ks.sort((a, c) => a.t - c.t);
    b.xk = ks;
  } else {
    b.xf = { ...(b.xf || {}), ...patch };
    if (b.xf.pin === null) delete b.xf.pin;
  }
}

function tyGizSave(i, msg) {
  const blocks = JSON.parse(JSON.stringify(GZ.cur.blocks));
  if (!blocks[i]) return;
  blocks[i].xf = GZ.doc.blocks[i].xf || {};
  blocks[i].xk = GZ.doc.blocks[i].xk || [];
  GZ.save(blocks, msg);
}

function tyGizBind(ctx = GZ) {
  GZ = ctx;
  const svg = ctx.svg(), bar = ctx.bar();
  if (!svg) return;
  svg._gz = ctx;   // نفس المكان يمكن يخدم أكثر من طبقة (النص والعناصر الحرة في المونتاج)
  if (svg.dataset.bound) return;
  svg.dataset.bound = "1";
  const use = () => { GZ = svg._gz; };
  svg.addEventListener("pointerdown", use, true); svg.addEventListener("pointermove", use, true); bar.addEventListener("click", use, true);
  let d = null;
  const at = (e) => { const r = GZ.box().getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.width, r.height]; };
  svg.addEventListener("pointerdown", (e) => {
    const g = tyGizBlock();
    if (!g) return;
    const [x, y, W, H] = at(e);
    GZ.stop();
    if (e.target.dataset?.g === "pick" || e.target.closest?.("#gzHover")) {   // التراك: ضغطة على الشيء (أو مربع حواليها)
      d = { pick: true, x0: x, y0: y, W, H, i: g.i };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    const role = e.target.dataset?.g;
    if (!role) return;
    const P = tyGizPts();
    const b = g.b, v = TypoEngine.xfAt(b, GZ.t);
    d = { role, i: g.i, x, y, W, H, v: JSON.parse(JSON.stringify(v)), c: P.pts[4], q: P.pts.slice(0, 4) };
    if (role[0] === "t") d.tq = GZ.eng.trackQuad(b.xf.tr, GZ.t);
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!d && (e.target.dataset?.g === "pick" || e.target.closest?.("#gzHover"))) { const [hx, hy, HW, HH] = at(e); tyGizHover(hx / HW, hy / HH, hx, hy); return; }
    if (!d) return;
    const [x, y] = at(e), b = GZ.doc.blocks[d.i], v = d.v;
    const dx = x - d.x, dy = y - d.y;
    if (d.pick) {
      svg.innerHTML = `<rect x="${Math.min(d.x0, x) + 80}" y="${Math.min(d.y0, y) + 80}" width="${Math.abs(x - d.x0)}" height="${Math.abs(y - d.y0)}" fill="rgba(250,204,21,.15)" stroke="#FACC15" stroke-width="2"/>`;
      d.x1 = x; d.y1 = y;
      return;
    }
    if (d.role === "move") {
      if (v.pin) tyXfPatch(b, { pin: v.pin.map(([px, py]) => [px + dx / d.W, py + dy / d.H]) });
      else tyXfPatch(b, { x: v.x + dx / d.W, y: v.y + dy / d.H });
    } else if (d.role[0] === "c") {
      const j = Number(d.role[1]);
      if (v.pin && (GZ.st.mode || "move") === "pin") { const pin = v.pin.map((p) => [...p]); pin[j] = [v.pin[j][0] + dx / d.W, v.pin[j][1] + dy / d.H]; tyXfPatch(b, { pin }); }
      else if (v.pin) {   // الأركان متلزقة ووضع التحريك: الركن يكبّر/يصغّر الشكل كله حوالين نصه
        const c0 = v.pin.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]), C = [c0[0] * d.W, c0[1] * d.H];
        const k = Math.hypot(x - C[0], y - C[1]) / Math.max(1, Math.hypot(d.q[j][0] - C[0], d.q[j][1] - C[1]));
        tyXfPatch(b, { pin: v.pin.map(([px, py]) => [c0[0] + (px - c0[0]) * k, c0[1] + (py - c0[1]) * k]) });
      } else {
        const r0 = Math.hypot(d.q[j][0] - d.c[0], d.q[j][1] - d.c[1]), r1 = Math.hypot(x - d.c[0], y - d.c[1]);
        tyXfPatch(b, { s: Math.max(0.05, Math.min(8, v.s * (r1 / Math.max(1, r0)))) });
      }
    } else if (d.role === "rz") {
      const a0 = Math.atan2(d.y - d.c[1], d.x - d.c[0]), a1 = Math.atan2(y - d.c[1], x - d.c[0]);
      let rz = v.rz + (a1 - a0) * 180 / Math.PI;
      if (e.shiftKey) rz = Math.round(rz / 15) * 15;
      tyXfPatch(b, { rz });
    } else if (d.role === "rx") tyXfPatch(b, { rx: Math.max(-85, Math.min(85, v.rx - dy * 0.45)) });
    else if (d.role === "ry") tyXfPatch(b, { ry: Math.max(-85, Math.min(85, v.ry + dx * 0.45)) });
    else if (d.role[0] === "t") {   // تصليح التراك بالإيد في هذا الفريم (والفريمات التي جنبه تُضبط معه بالراحة)
      const j = Number(d.role[1]), tr = GZ.doc.tracks[b.xf.tr], k = GZ.doc.w / d.W;
      tyTrackNudge(tr, GZ.t, j, (dx * k) / GZ.doc.w, (dy * k) / GZ.doc.h, d);
    }
    GZ.redraw();
    tyGizDraw();
  });
  const end = async () => {
    if (!d) return;
    const dd = d;
    d = null;
    if (dd.pick) {
      GZ.st.pick = null;
      const drag = dd.x1 != null && Math.abs(dd.x1 - dd.x0) > 8 && Math.abs(dd.y1 - dd.y0) > 8;
      tyGizDraw();
      if (drag) return tyTrackRun(dd.i, { box: [Math.min(dd.x0, dd.x1) / dd.W, Math.min(dd.y0, dd.y1) / dd.H, Math.max(dd.x0, dd.x1) / dd.W, Math.max(dd.y0, dd.y1) / dd.H] });
      const reg = tyGizRegionAt(dd.x0 / dd.W, dd.y0 / dd.H);   // الشيء الذي كانت منوّرة أسفل الماوس
      if (reg) return tyTrackRun(dd.i, { quad: reg.quad, mode: reg.kind });
      return tyTrackRun(dd.i, { point: [dd.x0 / dd.W, dd.y0 / dd.H] });
    }
    if (dd.role[0] === "t") return tyTrackSave(GZ.doc.blocks[dd.i].xf.tr);
    tyGizSave(dd.i);
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  bar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tyg]");
    if (!btn) return;
    e.preventDefault();
    const g = tyGizBlock();
    if (!g) return;
    const b = g.b, act = btn.dataset.tyg;
    if (act.startsWith("mode:")) { GZ.st.mode = act.slice(5); GZ.st.pick = null; return tyGizDraw(); }
    if (act === "repick") { GZ.st.pick = true; return tyGizDraw(); }
    if (act === "stick") {   // النص يُلصق على حدود الشيء (في الفريم الذي أُنشئ فيه التراك) ويتميّل معها
      if (TypoEngine.xfAt(b, GZ.t).pin) { tyXfPatch(b, { pin: null }); return tyGizSave(g.i, "فُكّ من الشيء"); }
      const q = GZ.eng.trackQuad(b.xf.tr, b.xf.tref || 0);
      if (!q) return;
      tyXfPatch(b, { pin: q.map(([x, y]) => [x / GZ.doc.w, y / GZ.doc.h]) });
      return tyGizSave(g.i, "📌 لُصق النص على الشيء");
    }
    if (act.startsWith("pick:")) { const m = act.slice(5); GZ.st.pick = GZ.st.pick === m ? null : m; return tyGizDraw(); }
    if (act === "unpin") { tyXfPatch(b, { pin: null }); return tyGizSave(g.i, "فُكّ من الشيء"); }
    if (act === "zrot") { tyXfPatch(b, { rx: 0, ry: 0, rz: 0 }); return tyGizSave(g.i); }
    if (act === "pin") {
      const v = TypoEngine.xfAt(b, GZ.t);
      if (v.pin) tyXfPatch(b, { pin: null });
      else { const P = tyGizPts(); tyXfPatch(b, { pin: P.pts.slice(0, 4).map(([x, y]) => [x / P.W, y / P.H]) }); }
      return tyGizSave(g.i, v.pin ? "🔲 أعدها كتلة عادية" : "🔲 اسحب كل ركن إلى مكانه");
    }
    if (act === "z") { b.xf = { ...(b.xf || {}), z: b.xf?.z === "behind" ? "" : "behind" }; return tyGizSave(g.i); }
    if (act === "keys") {
      if (b.xk?.length) { GZ.st.keymode = !GZ.st.keymode; return tyGizDraw(); }
      GZ.st.keymode = true;
      const v = TypoEngine.xfAt(b, GZ.t);
      b.xk = [{ t: b.t0, x: v.x, y: v.y, s: v.s, rx: v.rx, ry: v.ry, rz: v.rz, ...(v.pin ? { pin: v.pin } : {}) }];
      toast("⏱️ سُجّل مكانه هنا. انتقل إلى ثانية أخرى وحرّكه: سيتحرك تلقائيًا من هنا إلى هناك");
      return tyGizSave(g.i);
    }
    if (act === "nokeys") { b.xk = []; GZ.st.keymode = false; return tyGizSave(g.i, "🗑️ حُذفت النقاط المفتاحية"); }
    if (act === "reset") { b.xf = b.xf?.tr ? { tr: b.xf.tr, tref: b.xf.tref } : {}; b.xk = []; GZ.st.keymode = false; GZ.st.mode = "move"; return tyGizSave(g.i, "↺ أعد كما كان"); }
    if (act === "track") { GZ.st.pick = GZ.st.pick ? null : "follow"; return tyGizDraw(); }
    if (act === "pickmode") { GZ.st.pick = GZ.st.pick === "surface" ? "follow" : "surface"; return tyGizDraw(); }
    if (act === "notrack") { const { tr, tref, ...rest } = b.xf; b.xf = rest; return tyGizSave(g.i, "✖ أُزيل التتبع"); }
  });
}

// 🎯 التراك: المربع اللي اترسم بيروح للسيرفر، وبيتابع الحاجة فريم فريم
async function tyTrackRun(i, sel) {
  try {
    // الكلام بينقل على الحاجة اللي اتحددت (نصه على مكان الدوسة أو نص المربع)، وبعدين بيمشي معاها
    const b = GZ.doc.blocks[i], P = tyGizPts(), v = TypoEngine.xfAt(b, GZ.t);
    if (P && !v.pin) {
      const [tx, ty] = sel.point || (sel.quad ? [0, 2, 4, 6].reduce((c, k) => [c[0] + sel.quad[k] / 4, c[1] + sel.quad[k + 1] / 4], [0, 0]) : [(sel.box[0] + sel.box[2]) / 2, (sel.box[1] + sel.box[3]) / 2]);
      tyXfPatch(b, { x: v.x + tx - P.pts[4][0] / P.W, y: v.y + ty - P.pts[4][1] / P.H });
      const list = JSON.parse(JSON.stringify(GZ.cur.blocks));
      list[i].xf = { ...(b.xf || {}) }; list[i].xk = b.xk || [];
      await GZ.save(list);
    }
    GZ.cur = await api(TY(`/${GZ.cur.id}/track`), { method: "POST", ...jsonBody({ block: i, t: GZ.t, ...sel, fx: !!GZ.isFx }) });
    toast("🎯 جارٍ البحث عن الشيء وتتبعه… عند الانتهاء ستجد حدوده بالأصفر");
    GZ.after();
  } catch (err) { toast(err.message, true); }
}

// تصليح بالإيد: الركن بيتحرك في الفريم ده، والفريمات اللي حواليه بتتحرك معاه أقل وأقل (نص ثانية تقريبًا)
function tyTrackNudge(tr, t, j, dx, dy, d) {
  if (!d.orig) d.orig = tr.q.map((q) => [...q]);
  const f = (t - tr.t0) * tr.fps, sp = Math.max(2, tr.fps * 0.35);
  for (let i = 0; i < tr.q.length; i++) {
    const w = Math.exp(-(((i - f) / sp) ** 2));
    if (w < 0.01) continue;
    tr.q[i][j * 2] = d.orig[i][j * 2] + dx * w;
    tr.q[i][j * 2 + 1] = d.orig[i][j * 2 + 1] + dy * w;
  }
}

async function tyTrackSave(tid) {
  try {
    await api(TY(`/${GZ.cur.id}/tracks/${tid}`), { method: "PUT", ...jsonBody({ q: GZ.doc.tracks[tid].q }) });
    toast("✋ صُحّح التتبع");
  } catch (err) { toast(err.message, true); }
}


// 🖱️ التراك: الحاجات اللي في الفريم بتتحسب مرة واحدة، والماوس بيوريك حدود اللي تحته فورًا قبل ما تدوس
function tyGizRegions() {
  const id = GZ.cur?.id, fi = Math.round(GZ.t * 30), key = `${id}|${fi}`;
  const rg = GZ.st.reg;
  if (!id || (rg && rg.key === key)) return;
  GZ.st.reg = { key, loading: true };
  const ctx = GZ;
  clearTimeout(ctx.st.regTimer);
  ctx.st.regTimer = setTimeout(async () => {
    try {
      const data = await api(TY(`/${id}/regions?t=${(fi / 30).toFixed(3)}`));
      if (ctx.st.reg?.key !== key) return;
      ctx.st.reg = { key, data };
    } catch (err) { if (ctx.st.reg?.key === key) ctx.st.reg = { key, data: null }; }
    if (GZ === ctx) { ctx.bar().dataset.sig = ""; tyGizDraw(); }
  }, 180);
}

function tyGizRegionAt(nx, ny) {
  const data = GZ.st.reg?.data;
  if (!data || nx < 0 || ny < 0 || nx >= 1 || ny >= 1) return null;
  const g = data.grid, i = g.cells[Math.floor(ny * g.h) * g.w + Math.floor(nx * g.w)];
  return i >= 0 ? data.regions[i] : null;
}

function tyGizHover(nx, ny, px, py) {
  const el = GZ.svg()?.querySelector("#gzHover");
  if (!el) return;
  const reg = tyGizRegionAt(nx, ny);
  if (reg === GZ.st.hover) return;
  GZ.st.hover = reg;
  if (!reg) { el.innerHTML = ""; return; }
  const box = GZ.box(), W = box.getBoundingClientRect().width, H = box.getBoundingClientRect().height, o = 80;
  const pts = reg.poly.map(([x, y]) => `${(x * W + o).toFixed(1)},${(y * H + o).toFixed(1)}`).join(" ");
  const xs = reg.poly.map((p) => p[0] * W + o), ys = reg.poly.map((p) => p[1] * H + o);
  const lx = Math.min(...xs), ly = Math.min(...ys) - 8;
  el.innerHTML = `<polygon points="${pts}" fill="rgba(250,204,21,.22)" stroke="#FACC15" stroke-width="2.2" stroke-linejoin="round" filter="url(#gzSh)" style="pointer-events:none"/>
    <g filter="url(#gzSh)"><rect x="${lx}" y="${ly - 14}" width="${12 + reg.name.length * 7}" height="17" rx="6" fill="#FACC15"/>
    <text x="${lx + 6 + reg.name.length * 3.5}" y="${ly - 2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1a1a1a" font-family="system-ui">${reg.name}</text></g>`;
}
