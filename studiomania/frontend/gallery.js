// 🎬 معرض القوالب («ابدأ مشروع جديد»): عجلة مالية الشاشة، وكل قالب ستايل كارت بفيديو بيعبّر عنه.
// الفيديو بيشتغل للكارت اللي في النص، والدوسة عليه بتفتحه كبير. مولّدات الصوت والصور والفيديو زراير جوه كورة العجلة.
const Gallery = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { items: [], cats: [], root: null };
  // التايبوجرافي قالب زي الباقي: فيديو العرض بتاعه مترسوم بمحرك الكلام المتحرك نفسه
  const EXTRA = [{ id: "typo", name: "تايبوجرافي", icon: "🔤", sample_url: "/gallery/typo.mp4", cover_url: "/gallery/typo.jpg", cat: "motion",
    desc: "كلام بيتحرك على الإيقاع من صوتك أو سكريبتك، بأكتر من 300 حركة جاهزة." },
    // قوالب موشن بالكود (library/motion/r/t-*): بتترسم من غير توليد، والكلام والألوان بيتغيروا
    ...[["t-watercolor", "ألوان مية", "art", "صفحة كراسة بترسم نفسها بالفرشاة، وملاحظات بخط اليد جنب الرسمة."],
      ["t-riso", "ريزوجراف", "art", "طباعة بـ٣ أحبار فوق بعض، بنقط وألوان مش راكبة على بعض بالظبط."],
      ["t-hose", "كرتون قديم", "cartoon2d", "كرتون التلاتينات بالأبيض والأسود: شخصية بترقص على الجاز وكروت عناوين قديمة."],
      ["t-board", "سبورة", "explain", "شرح بيترسم قدامك على سبورة بيضا بالماركر أو خضرا وسودا بالطباشير، والكاميرا بتمشي من فكرة للتانية."],
      ["t-chat", "قصة شات", "social", "محادثة بين العميل والمتجر على الموبايل، بتنتهي بتأكيد الطلب."],
      ["t-price", "كشف السعر", "social", "السعر القديم بيتشطب والجديد بيخبط بكونفيتي، وعد تنازلي وزرار اطلب."],
      ["t-pixel", "بكسل", "retro", "عالم لعبة قديمة: البطل بيروح للمحل، صندوق كلام، «حصلت على…» وقايمة اختيار."],
      ["t-blueprint", "مخطط هندسي", "explain", "المنتج بيترسم بخطوط بيضا على ورق أزرق بالمقاسات والملاحظات، وختم «معتمد» في الآخر."],
      ["t-swiss", "تصميم سويسري", "art", "شبكة صارمة ورقم ضخم وسطور بتطلع على الإيقاع، ودايرة حمرا واحدة خارجة عن الشبكة."],
      ["t-review", "رأي عميل", "social", "اقتباس بيظهر كلمة كلمة ونجوم بتنور وصاحب الرأي، وفي الآخر متوسط التقييم."],
      ["t-milestone", "رقم إنجاز", "social", "آلاف النقط زي النجوم بتتجمع في رقمك، وبعدين تتفرق وتكوّن اسم البراند."],
      ["t-wrapped", "ملخص السنة", "social", "شرايح سريعة بألوان صريحة، كل واحدة رقم أو معلومة عن العميل في السنة."],
      ["t-ink", "حبر صيني", "art", "لوحة حبر بتترسم على ورق رز: جبال في الضباب وقارب وصنوبر، وختم أحمر واحد."],
      ["t-silent", "فيلم صامت", "retro", "سينما زمان: فيلم أبيض وأسود بخدوش وكروت كلام وقصة كوميدية على بيانو."],
      ["t-anime", "أنمي التمانينات", "retro", "مدينة نيون بالليل، بطلة على سكوتر بخطوط سرعة، وعنوان منوّر على شريط فيديو قديم."],
      ["t-count", "عد تنازلي", "social", "رقم بيقلب زي ساعات المطار لحد الصفر، وبعدها العرض بيتكشف بفلاش وكونفيتي."],
      ["t-map", "خريطة متحركة", "explain", "دبابيس على الأحياء وطريق التوصيل بيترسم للعميل، وبعدين مناطق التغطية بتنوّر."],
      ["t-launch", "إطلاق منتج", "social", "جملة على المشاهد، شاشة زجاج فيها طلب بيتكتب ونتيجته، علامات صح ورقم والاسم."],
      ["t-ukiyo", "أوكييو-إي", "art", "طباعة خشب يابانية: كل لون من لوح لوحده، جبل وموج وقارب وشمس حمرا، وخانة عنوان بختم."],
      ["t-glass", "زجاج معشق", "art", "شباك زجاج ملوّن في حيطة حجر بينوّر لما الشمس تعدّي، ولونه بيقع على الأرض."],
      ["t-screen", "بوستر طباعة شاشة", "art", "بوستر بيتطبع لون ورا لون بالمسّاحة، بأحبار سادة وشريط بيانات تحت."],
      ["t-deco", "آرت ديكو", "art", "خطوط دهب على أسود: شمس بأشعة وقوس متدرّج وجوهرة في النص وعنوان بلمعة دهب."],
      ["t-crayon", "ألوان شمع", "cartoon2d", "صفحة كتاب أطفال بتترسم بالشمع: بيت وشمس بوش وشجرة وطفل ببالونة."],
      ["t-spy", "تترات جاسوسية", "retro", "ورق مقصوص بأربع ألوان وسيلويت بيجري ورا شنطة، والشنطة بتتفتح على العرض السري."],
      ["t-holo", "هولوجرام", "explain", "المنتج مجسم خطوط نور فوق قاعدة إسقاط: مسح وتفكيك وأرقام بتتثبت بلون التمييز."],
      ["t-tilt", "تيلت شيفت", "motion", "المدينة من فوق كأنها ماكيت صغير، والناس بيتجمعوا عند الفرع الجديد."],
      ["t-toon", "كرتون الخمسينات", "cartoon2d", "مذيعة إعلانات زمان بتشرح المنتج في ٣ خطوات بألوان مطبوعة ونجوم أتوميك."],
      ["t-show", "برنامج مسابقات", "social", "سؤال و٣ إجابات على الإيقاع، جرس و«صح!»، والجايزة في الآخر."],
      ["t-brick", "مكعبات طوب", "anim3d", "محل بيتبني طوبة طوبة على مكتب خشب، وشخصية من الطوب ماشية للباب."],
      ["t-chart", "رسم بياني متحرك", "explain", "أعمدة بتطلع وبتتحول لخط، والرقم المهم بيتعلّم، وجملة كبيرة في الآخر."],
      ["t-impasto", "ألوان زيت سميكة", "art", "لوحة بتتبني ضربة سكينة ورا التانية، والعنوان نفسه معمول من ضربات ألوان."],
      ["t-oneline", "رسمة بخط واحد", "art", "خط واحد مابيتقطعش بيرسم الكوباية والبخار اللي بيبقى قلب، وبيكتب سطر تحت العنوان."],
      ["t-shadow", "خيال الظل", "retro", "عرايس جلد ملوّن على قماشة منوّرة: راجل بطربوش وجمل، ويافطة حروفها مخرومة."],
      ["t-lantern", "صندوق ورق رمضان", "art", "طبقات ورق مقصوص: الهلال والجامع والبيوت والفوانيس، والشبابيك بتنوّر واحد واحد."],
      ["t-keynote", "كينوت إطلاق تطبيق", "social", "فوضى إشعارات بتتصف في قائمة مترتبة وتتعلّم صح، وبعدين الرقم الكبير واسم التطبيق."],
      ["t-ascii", "شاشة كمبيوتر قديمة", "retro", "شاشة كهرماني بتكتب أوامر، وفنجان بيتطبع من حروف ورموز، والبخار بيتحرك."],
      ["t-audiogram", "أوديوجرام بودكاست", "social", "غلاف الحلقة وموجة صوت بتتحرك، والجملة بتظهر كلمة كلمة والكلمة الحالية متعلّمة."],
      ["t-captions", "كابشن تيك توك", "social", "فيديو منتج وكلام تقيل بيطلع كلمتين كلمتين، والكلمة المهمة ملوّنة، وزراير التفاعل على الجنب."],
      ["t-particles", "جزيئات بتكتب الاسم", "social", "آلاف النقط المنوّرة بتلف زي مجرة، وتكتب العنوان، وتنفجر، وترجع تكتب اسم البراند."],
      ["t-math", "شرح رياضي", "explain", "معادلة بتظهر رمز رمز، ومنحنيين بيتسابقوا، والفرق بينهم بيتعلّم بقوس وجملة."],
      ["t-iso", "رسم أيزومتري", "explain", "رسم تقني أبيض وأسود بيحكي رحلة الطلب: الموبايل، السير، العربية، لحد باب البيت."],
      ["t-logo", "ظهور لوجو", "social", "نقطة بتتنطط وتتحول لوجو بتلات بيتفتح ويلف، والخلفية بتتقلب للون البراند، والاسم يظهر."],
      ["t-versus", "مقارنة VS", "social", "الشاشة بتتقسم بلونين وعلامة VS بتخبط، وجولات مقارنة بأعمدة، والفايز بياخد الشاشة كلها."],
      ["t-lower", "شريط اسم المتكلم", "explain", "تلات ستايلات لشريط الاسم والوظيفة على مشهد مقابلة، مع شارة البرنامج والموضوع."],
      ["t-loop", "لوب هندسي", "art", "أشكال بتتحول من دايرة لنجمة في شبكة مالهاش آخر، والكاميرا بتبعد وترجع واللوب بيقفل."],
      ["t-beat", "على الإيقاع", "social", "كلمة جديدة بلون وتكوين مختلف مع كل ضربة، وبعدين الدروب باسم البراند بيومض."],
      ["t-flow", "رسم توضيحي للخطوات", "explain", "كروت الخطوات بتظهر متعرّجة، والخطوط بينها بتترسم ونقط بتجري عليها، والنتيجة في الآخر."],
      ["t-title3d", "عنوان مجسّم", "social", "عنوان بحروف بارزة طالع من أرض لامعة، والكاميرا بتلف حواليه، ولمعة بتعدّي، زي تترات المسلسلات."],
      ["t-dossier", "ملف قضية مطبوع", "art", "ورقة أرشيف بنقط طباعة: المشتبه فيه في صورة الفيش، دليل برقم عملاق، وختم «اتقفلت» بيخبط."],
      ["t-woodcut", "طباعة خشب محفور", "art", "لوح خشب أسود والسكينة بتحفر النور: فرن ونار، رغيف، وعنوان محفور بلون واحد."],
      ["t-sketch", "سكتش مدينة بالقلم", "art", "كراسة رسم بخطوط قلم وألوان مية، وبالونة حمرا بتطير في الشارع لحد باب المحل."],
      ["t-redcut", "قص ورق أحمر", "art", "وردة ورق بتتفتح، وبرواز مسنن فيه بيت وشجرة وعصافير، والاسم مقصوص جوه دايرة."],
      ["t-pictogram", "بطاقات بيكتوجرام", "social", "رسومات بشرية هندسية بتتحرك على الإيقاع، كل بطاقة بلون وعنوان ضخم ورقم."],
      ["t-microgame", "ألعاب سريعة", "retro", "ألعاب صغيرة ورا بعض بستايلات مختلفة والإيقاع بيسرع، والمنتج هو الجايزة."],
      ["t-screencast", "عرض تطبيق حي", "explain", "تسجيل شاشة بماوس وزووم على الضغطات، وكائن بكسل صغير بيمثّل اللي التطبيق بيعمله."],
      ["t-ytintro", "مقدمة ونهاية لقناة", "social", "افتتاحية بلوجو القناة، كارت عنوان الحلقة، وشاشة نهاية بفيديوهات مقترحة وزرار اشتراك."],
      ["t-newsletter", "إعلان نشرة بريدية", "social", "ظرف بيتفتح، سؤال بيشد، تلات كروت من العدد، وخانة إيميل وزرار اشتراك."],
      ["t-notch", "فيلم إطلاق بالنوتش", "social", "الكبسولة اللي فوق الشاشة بتكبر لودجتس (الطلب، الدفع، الخريطة) وبعدين تملى الشاشة باسم المنتج."],
      ["t-onehero", "كورة واحدة بتحكي", "explain", "لقطة واحدة من غير قطع: كورة بتعدّي على قمع وبوابة ألوان وسوستة لحد العلبة."],
      ["t-signature", "كارت شكر بتوقيع", "art", "كارت فاخر بيتفتح، كلمة الشكر بتترسم، توقيع بالقلم، وختم شمع باسم البراند."],
      ["t-shopfloat", "متجر بمنتجات طايرة", "social", "جملة البراند كلمة كلمة بأيقونات المنتجات، بلوكات لون بتمسح الشاشة، كروت منتج بالسعر وزرار «أضف للسلة»، واللوجو."],
      ["t-brandreveal", "كشف هوية البراند", "social", "على الإيقاع: العلامة والاسم، كاروسيل بوستات ثري دي، الحرف بيتحوّل، صفحات دليل البراند، ومطر رمز البراند."],
      ["t-flipcards", "ستيكرات بتتقلب زي الكروت", "social", "٣ رسايل كل واحدة كارت: عنوان بشخبطة، صورة أبيض وأسود قدام دايرة، وستيكرات حواليها، والكارت بيتقلب للي بعده."]]
      .map(([id, name, cat, desc]) => ({ id, name, cat, desc, sample_url: `/gallery/${id}.mp4`, cover_url: `/gallery/${id}.jpg` }))];
  // تصنيفات القوالب اللي مش جاية من السيرفر
  const MORE_CATS = [{ id: "art", ar: "رسم وطباعة" }, { id: "explain", ar: "شرح" }, { id: "social", ar: "إعلانات سوشيال" }, { id: "cartoon2d", ar: "كرتون 2D" }, { id: "retro", ar: "ألعاب وريترو" }, { id: "other", ar: "قوالبي" }];
  const CAT_EN = { cartoon2d: "2D Cartoon", anim3d: "3D Animation", paper: "Paper", clay: "Clay", collage: "Collage", motion: "Motion", ugc: "UGC", cinematic: "Cinematic", product: "Product", art: "Art & Print", explain: "Explainer", social: "Social Ads", retro: "Retro Games", other: "My Templates" };

  async function load() {
    const cats = await api("/api/style-cats").catch(() => []);
    S.cats = [...cats, ...MORE_CATS.filter((m) => !cats.some((c) => c.id === m.id))];
    // المعرض قوالب كود بس: بتترسم زي الغلاف بالظبط ومن غير توليد. قوالب التوليد بالذكاء الصناعي (sk-* واللي من المعمل)
    // اتشالت من هنا لأن نتيجتها مش مضمونة ومش شبه الغلاف، ومكانها بعدين في «مولد الفيديو» لو احتجناها
    S.items = [...EXTRA];
  }
  const catName = (id) => S.cats.find((c) => c.id === id)?.ar || "تانية";
  // 🎡 العجلة: مالية الصفحة. أسماء القوالب على قوس على الشمال، واسم القالب اللي السهم عليه في النص، والكروت عمودين على اليمين.
  // رول الماوس بيدّي العجلة دفعة فتجري وتهدى بالاحتكاك وتقف على أقرب قالب (فوق العجلة بتجري أكتر من فوق الكروت)، ومعاها تكّة سقاطة.
  // العجلة طبقات على عمق مختلف (حلقات ← أسماء ← طوق ← كورة ← زراير) فلما الماوس يقف عليها بتميل ناحيته والطبقات بتبعد عن بعض.
  const W = { list: [], pos: 0, vel: 0, mode: "snap", target: 0, fric: 1.7, shown: -1, cell: 0, lastTick: 0, G: {}, raf: 0, drag: null, tilt: { x: 0, y: 0, l: 0, tx: 0, ty: 0, tl: 0 } };
  const VMAX = 42, SNAPV = 1.6, STEP = 7.5 * Math.PI / 180;
  const pad = (n) => String(n).padStart(2, "0");
  // 🧪 مولّدات من غير قوالب (gen.js): زراير جوه الكورة الرمادي
  const GENS = [["video", "🎬", "مولد فيديو", "وصف ← فيديو"], ["image", "🖼️", "مولد صور", "وصف ومرجع ← صور"], ["voice", "🎙️", "مولد صوت", "كلام ← صوت"]];
  const gensHTML = (cls) => `<div class="${cls}">${GENS.map(([k, i, b, s]) => `<button type="button" class="nh-wh-gen" data-gen="${k}"><i>${i}</i><span><b>${b}</b><small>${s}</small></span></button>`).join("")}</div>`;
  function card(x, k) {
    const vid = x.sample_url ? `<video muted loop playsinline preload="none" ${x.cover_url ? `poster="${esc(x.cover_url)}"` : ""} data-src="${esc(x.sample_url)}"></video>` : `<span class="nh-gal-ph"><i>${x.icon || "✦"}</i><small>فيديو العرض جاي قريب</small></span>`;
    return `<article class="nh-wc${x.sample_url ? "" : " soon"}" tabindex="0" data-wi="${k}" aria-label="${esc(x.name)}">
      <div class="nh-wc-h"><b>${esc(x.name)}</b><i>${k + 1}</i></div><div class="nh-wc-art">${vid}</div></article>`;
  }
  function render() {
    const list = S.items.map((x, i) => [x, i]);
    list.sort((a, b) => (!!b[0].sample_url - !!a[0].sample_url));   // اللي ليه فيديو الأول
    W.list = list;
    const box = S.root.querySelector(".nh-gal-grid");
    if (!list.length) { box.innerHTML = `<div class="nh-empty">مفيش قوالب لسه.</div>`; return; }
    box.innerHTML = `<div class="nh-wh" dir="ltr">
      <div class="nh-wh-wheel"><div class="nh-wh-3d">
        <svg class="nh-wh-l nh-wh-back" aria-hidden="true"></svg>
        <div class="nh-wh-l nh-wh-labs" aria-hidden="true">${list.map(([x]) => `<span>${esc(x.name)}</span>`).join("")}</div>
        <svg class="nh-wh-l nh-wh-ring" aria-hidden="true"></svg>
        <svg class="nh-wh-l nh-wh-ball" aria-hidden="true"></svg>
        <i class="nh-wh-l nh-wh-ptr" aria-hidden="true"></i>
        ${gensHTML("nh-wh-l nh-wh-gens")}
      </div></div>
      <section class="nh-wh-info" dir="rtl" aria-live="polite">
        ${gensHTML("nh-wh-mgens")}
        <div class="nh-wh-eye"><span class="num"></span><span>·</span><span class="cat"></span></div>
        <h2 class="nh-wh-title"><span></span></h2><p class="nh-wh-desc"></p>
        <button type="button" class="nh-wh-go">ابدأ بالقالب ده <span aria-hidden="true">←</span></button>
        <div class="nh-wh-foot"><span><kbd>رول الماوس</kbd> فوق العجلة بيجري أسرع</span><span><kbd>↑</kbd> <kbd>↓</kbd> قالب قالب</span></div>
      </section>
      <div class="nh-wh-cards"><div class="nh-wh-track">${list.map(([x], k) => card(x, k)).join("")}</div></div>
      <aside class="nh-wh-side"><span class="nh-wh-dots" aria-hidden="true">${"<i></i>".repeat(12)}</span>
        <button type="button" class="nh-wh-snd" aria-pressed="${sndOn}" title="صوت العجلة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg><span>${sndOn ? "الصوت شغال" : "شغّل الصوت"}</span></button></aside>
    </div>`;
    Object.assign(W, { pos: 0, vel: 0, target: 0, mode: "snap", shown: -1, cell: 0, drag: null, el: box.querySelector(".nh-wh") });
    wheelBind(W.el);
    layout();
    show(0);
    if (!W.raf) W.raf = requestAnimationFrame(loop);
  }
  function layout() {
    const el = W.el; if (!el || !el.isConnected) return;
    // الإطار بياخد الباقي من الشاشة كله، علشان العجلة والكروت يبانوا كاملين من غير سكرول
    const mobile = innerWidth <= 720;
    el.style.height = Math.max(mobile ? 620 : 480, innerHeight - Math.max(0, el.getBoundingClientRect().top)) + "px";
    const wheel = el.querySelector(".nh-wh-wheel"), cards = el.querySelector(".nh-wh-cards");
    wheel.style.top = mobile ? cards.offsetTop + "px" : "";   // على الموبايل العجلة جنب الكروت تحت الكلام
    const h = wheel.clientHeight, w = wheel.clientWidth;
    // على الكمبيوتر الكورة باينة أكتر علشان الزراير تبقى جواها، وعلى الموبايل العجلة مستخبية أكتر ورا الحرف
    const R = mobile ? Math.min(h * .5, 300) : Math.min(h * .45, w * .7, 420), cx = mobile ? -R * .66 : -R * .1, cy = h * (mobile ? .36 : .5);
    const rs = R * (mobile ? .6 : .56), rr = rs + R * .06;
    const ring = (r, sw, op) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--nh-ink)" stroke-opacity="${op}" stroke-width="${sw}"/>`;
    el.querySelector(".nh-wh-back").innerHTML = ring(R * 1.03, 1.2, .14) + ring(R * .985, 1, .07) + `<path class="arc" fill="none" stroke="var(--nh-ink)" stroke-width="3" stroke-linecap="round"/><g class="ticks"></g>`;
    // الطوق: حلقة تخينة بتدرّج نور ضلمة فوق الكورة
    el.querySelector(".nh-wh-ring").innerHTML = `<defs><linearGradient id="nhWhRg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--wh-ring-hi)"/><stop offset=".55" style="stop-color:var(--wh-ring)"/><stop offset="1" style="stop-color:var(--wh-ring-lo)"/></linearGradient></defs>
      <circle cx="${cx}" cy="${cy + 6}" r="${rr}" fill="none" stroke="#000" stroke-opacity=".12" stroke-width="${R * .05}" style="filter:blur(6px)"/>
      <circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="url(#nhWhRg)" stroke-width="${R * .05}"/>
      <circle cx="${cx}" cy="${cy}" r="${rr + R * .025}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1"/>`;
    // الكورة: تدرّج دايري بنقطة نور بتمشي مع الماوس، وضل تحتها، وحزوز على الحرف بتلف مع العجلة
    el.querySelector(".nh-wh-ball").innerHTML = `<defs><radialGradient id="nhWhSph" gradientUnits="userSpaceOnUse" cx="${cx + rs * .35}" cy="${cy - rs * .35}" r="${rs * 1.5}" fx="${cx + rs * .35}" fy="${cy - rs * .35}">
        <stop offset="0" style="stop-color:var(--wh-ball-hi)"/><stop offset=".45" style="stop-color:var(--wh-ball)"/><stop offset="1" style="stop-color:var(--wh-ball-lo)"/></radialGradient>
        <radialGradient id="nhWhRim" cx="50%" cy="50%" r="50%"><stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient></defs>
      <ellipse cx="${cx + rs * .08}" cy="${cy + rs * .96}" rx="${rs * .8}" ry="${rs * .12}" fill="#000" fill-opacity=".18" style="filter:blur(10px)"/>
      <circle cx="${cx}" cy="${cy}" r="${rs}" fill="url(#nhWhSph)"/><circle cx="${cx}" cy="${cy}" r="${rs}" fill="url(#nhWhRim)"/><g class="knurl"></g>`;
    // الكلام في النص يبدأ بعد آخر أسماء العجلة علشان مايركبش عليها
    el.querySelector(".nh-wh-info").style.paddingLeft = mobile ? "" : Math.round(cx + R * .8 + 210) + "px";
    const ptr = el.querySelector(".nh-wh-ptr"); ptr.style.left = (cx + R * .74) + "px"; ptr.style.top = (cy - 7) + "px";
    // الزراير في الجزء الباين من الكورة
    const gw = Math.max(110, Math.min(170, cx + Math.sqrt(Math.max(0, rs * rs - 95 * 95)) - 70));
    Object.assign(el.querySelector(".nh-wh-gens").style, { left: "34px", top: (cy - 92) + "px", width: gw + "px" });
    // عمودين كروت كبيرة متزحزحين نص كارت (قالبين في الشاشة)، وكل كارت في مكانه على أسطوانة بتلف. الموبايل عمود واحد
    const cols = mobile ? 1 : 2, colW = cards.clientWidth / cols, cellH = (mobile ? 54 : 72) + colW * 5 / 4;
    W.G = { R, cx, cy, rs, cols, cellH, gh: cards.clientHeight, labs: [...el.querySelectorAll(".nh-wh-labs span")], cards: [...el.querySelectorAll(".nh-wc")],
      arc: el.querySelector(".arc"), ticks: el.querySelector(".ticks"), knurl: el.querySelector(".knurl"), sph: el.querySelector("#nhWhSph"),
      d3: el.querySelector(".nh-wh-3d"), track: el.querySelector(".nh-wh-track"), wheelW: w };
    W.G.cards.forEach((c, i) => {
      const col = cols === 1 ? 0 : i % 2, row = cols === 1 ? i : Math.floor(i / 2);
      Object.assign(c.style, { top: (row * cellH + (col ? cellH / 2 : 0)) + "px", left: col || cols === 1 ? "0" : "50%", width: 100 / cols + "%", transform: "" });
      c._hx = c._hy = 0;
    });
  }
  // مكان نص الكارت لأي مكان كسري في القايمة، علشان الحركة متصلة
  const yOne = (i) => { const G = W.G, N = W.list.length; i = Math.max(0, Math.min(N - 1, i)); const col = G.cols === 1 ? 0 : i % 2, row = G.cols === 1 ? i : Math.floor(i / 2); return row * G.cellH + (col ? G.cellH / 2 : 0) + G.cellH / 2; };
  const yOf = (p) => { const f = Math.floor(p); return yOne(f) + (yOne(f + 1) - yOne(f)) * (p - f); };
  function snapTo(v) { W.target = Math.max(0, Math.min(W.list.length - 1, Math.round(v))); W.mode = "snap"; }
  function wheelBind(el) {
    const cards = el.querySelector(".nh-wh-cards");
    el.addEventListener("wheel", (e) => {
      e.preventDefault(); if (W.drag) return;
      const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      if (W.mode === "snap" && Math.sign(d) !== Math.sign(W.vel)) W.vel *= .3;   // لو عكست الاتجاه العجلة تفرمل الأول
      const onCards = cards.contains(e.target), k = onCards ? .022 : .075, cap = onCards ? 5 : 16;
      W.fric = onCards ? 3.2 : 1.4;
      W.vel = Math.max(-VMAX, Math.min(VMAX, W.vel + Math.sign(d) * Math.min(cap, Math.abs(d) * k)));
      W.mode = "coast";
    }, { passive: false });
    // الميلان الثلاثي الأبعاد: الماوس فوق العجلة بيميّلها ناحيته وبيبعّد الطبقات
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / Math.max(1, W.G.wheelW), y = (e.clientY - r.top) / r.height, T = W.tilt;
      const on = e.pointerType === "mouse" && x < 1;
      T.tx = on ? (x - .45) * 16 : 0; T.ty = on ? (y - .5) * -12 : 0; T.tl = on ? 1 : 0;
    });
    el.addEventListener("pointerleave", () => { const T = W.tilt; T.tx = T.ty = T.tl = 0; W.hov = null; });
    // الكارت اللي الماوس عليه بيميل ناحيته ولمعة بتمشي عليه
    cards.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const c = e.target.closest(".nh-wc"); if (!c) { W.hov = null; return; }
      const r = c.getBoundingClientRect(); W.hov = { c, x: (e.clientX - r.left) / r.width - .5, y: (e.clientY - r.top) / r.height - .5 };
    });
    cards.addEventListener("pointerleave", () => (W.hov = null));
    el.addEventListener("keydown", (e) => {
      const cur = W.mode === "snap" ? W.target : W.pos;
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); snapTo(cur + 1); }
      if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); snapTo(cur - 1); }
      if (e.key === "Enter" && e.target.closest(".nh-wc")) tap(+e.target.closest(".nh-wc").dataset.wi);
    });
    // سحب بالصباع أو الماوس على الكروت — ولو سبتها وهي ماشية بتكمّل بنفس السرعة
    cards.addEventListener("pointerdown", (e) => { W.drag = { y: e.clientY, p0: W.pos, moved: 0, s: [[performance.now(), W.pos]] }; W.vel = 0; W.mode = "drag"; cards.setPointerCapture(e.pointerId); });
    cards.addEventListener("pointermove", (e) => {
      const D = W.drag; if (!D) return; const dy = D.y - e.clientY, now = performance.now(), N = W.list.length; D.moved = Math.max(D.moved, Math.abs(dy));
      let p = D.p0 + dy / (W.G.cellH / W.G.cols); if (p < 0) p *= .35; if (p > N - 1) p = N - 1 + (p - N + 1) * .35;   // مطاطية عند الأطراف
      W.pos = p; D.s.push([now, p]); while (D.s.length > 2 && now - D.s[0][0] > 90) D.s.shift();
    });
    const end = (e) => {
      const D = W.drag; if (!D) return; const a = D.s[0], b = D.s[D.s.length - 1], dt = (b[0] - a[0]) / 1000;
      const c = e && document.elementFromPoint(e.clientX, e.clientY)?.closest(".nh-wc");
      W.drag = null;
      if (D.moved < 6 && c) return tap(+c.dataset.wi);
      W.vel = dt > .008 && performance.now() - b[0] < 80 ? Math.max(-VMAX, Math.min(VMAX, (b[1] - a[1]) / dt)) : 0;
      W.fric = 1.7;
      if (Math.abs(W.vel) > SNAPV) W.mode = "coast"; else snapTo(W.pos);
    };
    cards.addEventListener("pointerup", end); cards.addEventListener("pointercancel", () => end(null));
    el.querySelector(".nh-wh-go").addEventListener("click", () => preview(S.items[W.list[W.shown][1]]));
    el.querySelector(".nh-wh-snd").addEventListener("click", () => setSound(!sndOn));
  }
  // دوسة على القالب اللي في النص بتفتحه، وعلى أي قالب تاني بتلف العجلة عليه
  function tap(k) { if (k === W.shown && Math.abs(W.vel) < 1) preview(S.items[W.list[k][1]]); else snapTo(k); }
  function show(k) {
    const el = W.el, [x] = W.list[k]; W.shown = k;
    W.G.cards.forEach((c, j) => c.classList.toggle("on", j === k));
    const N = W.list.length;
    el.querySelectorAll(".nh-wh-dots i").forEach((d, j) => d.classList.toggle("on", j === Math.round(k / Math.max(1, N - 1) * 11)));
    el.querySelector(".nh-wh-eye .num").textContent = pad(k + 1) + " / " + pad(N);
    clearTimeout(W.swapT);
    W.swapT = setTimeout(() => {   // الاسم بيتغيّر لما العجلة تهدى شوية (مش مع كل تكّة)
      const ti = el.querySelector(".nh-wh-title"); ti.innerHTML = ""; const s = document.createElement("span"); s.textContent = x.name; ti.appendChild(s);
      s.animate?.([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
      el.querySelector(".nh-wh-desc").textContent = x.desc || x.description || "";
      el.querySelector(".nh-wh-eye .cat").textContent = catName(x.cat);
    }, 60);
    clearTimeout(W.playT);
    W.playT = setTimeout(() => W.G.cards.forEach((c, j) => play(c, j === W.shown)), 380);   // الفيديو بيشتغل للقالب اللي وقفت عليه بس
  }
  function loop(now) {
    const el = W.el;
    if (!el || !el.isConnected) { W.raf = 0; W.G.cards?.forEach((c) => play(c, false)); return; }   // الصفحة اتقفلت
    const dt = Math.min(.05, (now - (W.last || now)) / 1000), N = W.list.length, G = W.G; W.last = now;
    if (W.mode === "coast") {   // بتجري بالدفعة وتهدى بالاحتكاك
      W.pos += W.vel * dt; W.vel *= Math.exp(-W.fric * dt);
      if (W.pos < 0 || W.pos > N - 1) snapTo(W.pos);   // خبطت في الطرف: ترجع بسبرنج
      else if (Math.abs(W.vel) < SNAPV) snapTo(W.vel > 0 ? Math.ceil(W.pos - .15) : Math.floor(W.pos + .15));
    } else if (W.mode === "snap") {   // سبرنج خفيف يقفلها على القالب (بيعدّي سنة صغيرة ويرجع)
      W.vel += ((W.target - W.pos) * 95 - W.vel * 16) * dt; W.pos += W.vel * dt;
      if (Math.abs(W.target - W.pos) < .0005 && Math.abs(W.vel) < .002) { W.pos = W.target; W.vel = 0; }
    }
    const pos = W.pos, idx = Math.max(0, Math.min(N - 1, Math.round(pos))), cell = Math.floor(pos + .5);
    if (cell !== W.cell) { if (now - W.lastTick > 18) { tick(Math.abs(W.vel) || 4); W.lastTick = now; } W.cell = cell; }
    if (idx !== W.shown) show(idx);
    G.track.style.transform = `translateY(${G.gh / 2 - yOf(pos)}px)`;
    // الكروت على أسطوانة: اللي بعيد عن النص بيلف لورا ويصغر ويغمق، واللي تحت الماوس بيميل ناحيته
    const kh = 1 - Math.exp(-dt * 10);
    const yc = yOf(pos);
    for (let j = Math.max(0, Math.floor(pos) - 4); j <= Math.min(N - 1, Math.ceil(pos) + 4); j++) {
      const c = G.cards[j], d = (yOne(j) - yc) / G.cellH, ad = Math.abs(d), H = W.hov && W.hov.c === c ? W.hov : null;
      c._hx += ((H ? H.x : 0) - c._hx) * kh; c._hy += ((H ? H.y : 0) - c._hy) * kh;
      c.style.transform = `translateZ(${(-ad * 70).toFixed(1)}px) rotateX(${(-d * 18 - c._hy * 12).toFixed(2)}deg) rotateY(${(c._hx * 14).toFixed(2)}deg) scale(${(1 - Math.min(.12, ad * .07)).toFixed(3)})`;
      c.style.setProperty("--dim", Math.min(.5, Math.max(0, ad - .3) * .45).toFixed(3));
      c.style.setProperty("--gx", (50 + c._hx * 90).toFixed(1) + "%"); c.style.setProperty("--gy", (50 + c._hy * 90).toFixed(1) + "%");
      c.style.setProperty("--gl", Math.min(1, Math.hypot(c._hx, c._hy) * 3).toFixed(3));
    }
    // الميلان بيلحق الماوس بنعومة، والسرعة بتميّل العجلة سنة كمان كأنها تقيلة
    const T = W.tilt, k = 1 - Math.exp(-dt * 7);
    T.x += (T.tx - T.x) * k; T.y += (T.ty - T.y) * k; T.l += (T.tl - T.l) * k;
    const spin = Math.max(-1, Math.min(1, W.vel / 20));
    G.d3.style.setProperty("--ry", (16 + T.x).toFixed(2) + "deg"); G.d3.style.setProperty("--rx", (T.y + spin * 3).toFixed(2) + "deg"); G.d3.style.setProperty("--lift", T.l.toFixed(3));
    const lx = G.cx + G.rs * (.35 + T.x * .02), ly = G.cy - G.rs * (.35 + T.y * .03);
    G.sph.setAttribute("cx", lx); G.sph.setAttribute("cy", ly); G.sph.setAttribute("fx", lx); G.sph.setAttribute("fy", ly);
    const rl = G.R * .8;
    G.labs.forEach((s, i) => {
      const a = (i - pos) * STEP;
      if (Math.abs(a) > 1.2) { s.style.opacity = 0; return; }
      const d = Math.abs(i - pos);
      s.style.opacity = Math.max(0, 1 - d * .12).toFixed(3);
      s.style.transform = `translate(${G.cx + Math.cos(a) * rl}px,${G.cy + Math.sin(a) * rl - 8}px) rotate(${a}rad) scale(${d < .5 ? 1.12 : 1})`;
      s.classList.toggle("on", i === idx);
    });
    // القوس الغامق بيلف مع العجلة، والتكّات على الحلقة والحزوز على الكورة بتعدّي
    const r = G.R * 1.03, a0 = -0.95 + (pos / Math.max(1, N - 1)) * 1.6, P = (a) => `${G.cx + Math.cos(a) * r} ${G.cy + Math.sin(a) * r}`;
    G.arc.setAttribute("d", `M ${P(a0)} A ${r} ${r} 0 0 1 ${P(a0 + .3)}`);
    const fr = ((pos % 1) + 1) % 1;
    let html = "";
    for (let j = -16; j <= 16; j++) { const a = (j - fr) * STEP, r1 = G.R * .96, r2 = G.R * .935; html += `<line x1="${G.cx + Math.cos(a) * r1}" y1="${G.cy + Math.sin(a) * r1}" x2="${G.cx + Math.cos(a) * r2}" y2="${G.cy + Math.sin(a) * r2}" stroke="var(--nh-ink)" stroke-opacity="${Math.max(0, .32 - Math.abs(j) * .018).toFixed(3)}" stroke-width="1.2"/>`; }
    G.ticks.innerHTML = html;
    html = "";
    for (let j = 0; j < 48; j++) {   // الحزوز بتنوّر في الناحية اللي جاي منها النور (فوق يمين)
      const a = (j - fr * 2) * Math.PI / 24, c = Math.cos(a), s = Math.sin(a);
      if (c < -.2) continue;
      const lit = Math.max(0, c * .7 - s * .7), r1 = G.rs * .9, r2 = G.rs * .985;
      html += `<line x1="${G.cx + c * r1}" y1="${G.cy + s * r1}" x2="${G.cx + c * r2}" y2="${G.cy + s * r2}" stroke="var(--wh-knurl)" stroke-opacity="${(.12 + lit * .45).toFixed(3)}" stroke-width="2" stroke-linecap="round"/>`;
    }
    G.knurl.innerHTML = html;
    W.raf = requestAnimationFrame(loop);
  }
  addEventListener("resize", () => layout());
  // 🔊 تكّة سقاطة متولّدة بالكود (مش ملف صوت): طقّة تخينة + خبطة واطية + رنّة معدن قصيرة
  // الصوت شغال من الأول إلا لو العميل قفله. المتصفح بيسمح بيه بعد أول دوسة في الصفحة (زي الدوسة اللي فتحت المعرض)
  let ac = null, sndOn = true, noiseB = null;
  try { sndOn = localStorage.getItem("nh-wheel-snd") !== "0"; } catch (e) {}
  function unlock() { if (!sndOn) return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) { ac = null; } }
  addEventListener("pointerdown", unlock, true); addEventListener("keydown", unlock, true);
  function setSound(on) {
    sndOn = on;
    try { localStorage.setItem("nh-wheel-snd", on ? "1" : "0"); } catch (e) {}
    const b = W.el?.querySelector(".nh-wh-snd"); if (b) { b.setAttribute("aria-pressed", on); b.querySelector("span").textContent = on ? "الصوت شغال" : "شغّل الصوت"; }
    unlock(); if (on) setTimeout(() => tick(4), 60);
  }
  function tick(speed) {
    if (!sndOn) return;
    if (!ac || ac.state !== "running") { unlock(); if (!ac || ac.state !== "running") return; }
    if (!noiseB) { noiseB = ac.createBuffer(1, Math.floor(ac.sampleRate * .03), ac.sampleRate); const d = noiseB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + .002, r = () => 1 + (Math.random() - .5) * .14;
    const out = ac.createGain(); out.gain.value = Math.min(.42, .16 + Math.min(speed, 30) * .009) * (.85 + Math.random() * .3); out.connect(ac.destination);
    const n = ac.createBufferSource(), bp = ac.createBiquadFilter(), gn = ac.createGain();
    n.buffer = noiseB; bp.type = "bandpass"; bp.frequency.value = 3400 * r(); bp.Q.value = 1;
    gn.gain.setValueAtTime(1, t); gn.gain.exponentialRampToValueAtTime(.001, t + .01 + Math.random() * .004);
    n.connect(bp).connect(gn).connect(out); n.start(t, Math.random() * .01, .02);
    [[180, .55, .035], [900, .26, .03], [2200, .1, .014]].forEach(([f, a, d]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f * r();
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(.0005, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + .01);
    });
  }
  // الفيديو بيتحمّل ويشتغل للكارت اللي في النص بس (عشان الصفحة تفضل خفيفة)
  function play(cardEl, on) {
    const v = cardEl.querySelector("video");
    if (!v) return;
    if (on) {
      if (!v.src) v.src = v.dataset.src;
      v.play().catch(() => {});
      cardEl.classList.add("playing");
    } else { if (!v.paused) v.pause(); cardEl.classList.remove("playing"); }
  }
  // المعاينة فوق الشاشة كلها (برّه الصفحة نفسها)
  function pvEl() {
    if (!S.pv) {
      S.pv = Object.assign(document.createElement("div"), { className: "nh-gal-pv", hidden: true });
      S.pv.setAttribute("role", "dialog");
      S.pv.addEventListener("click", (e) => {
        if (e.target.closest("[data-gstart]")) {   // 🧭 مسار القالب (flow.js)
          const x = S.pvItem;
          closePv();
          return Flow.start({ id: x.id, name: x.name, cat: catName(x.cat), desc: x.desc || x.description || "" });
        }
        if (e.target.closest("[data-gedit]")) {   // ✏️ محرر القالب: كل خانة بنصيحتها، والخطوط والألوان والمشاهد
          const x = S.pvItem;
          closePv();
          return MotionPage.openTemplate(x.id, x.name);
        }
        if (e.target === S.pv || e.target.closest("[data-gclose]")) closePv();
      });
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
        <p>${esc(x.desc || x.description || "")}</p><small class="muted">${esc(catName(x.cat))}</small>
        <button type="button" class="nh-gal-go" data-gstart>✨ ابدأ بالقالب ده</button>
        ${String(x.id).startsWith("t-") ? `<button type="button" class="nh-gal-go ghost" data-gedit>✏️ عدّله بنفسك</button>` : ""}
        <small class="nh-gal-hint">المخ هيقترح عليك أفكار وسيناريوهات على قد البراند بتاعك، وانت تختار.</small></div></div>`;
    S.pvItem = x;
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
      const gn = e.target.closest("[data-gen]");
      if (gn) return Gen.open(gn.dataset.gen);
    });
  }
  // Esc بيقفل المعاينة الأول (قبل ما يرجع من الصفحة)
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && closePv()) e.preventDefault(); }, true);

  async function mount(root) {
    S.root = root;
    if (!root._gal) { root._gal = true; bind(root); }   // نفس العنصر بيتعاد استخدامه لكل الصفحات: الأحداث مرة واحدة بس
    try { await load(); render(); } catch (err) { root.querySelector(".nh-gal-grid").innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { mount };
})();
