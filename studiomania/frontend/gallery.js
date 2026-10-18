// 🎬 معرض القوالب («ابدأ مشروع جديد»): كل قالب ستايل كارت طولي بفيديو بيعبّر عنه.
// الفيديو بيشتغل لما تقف على الكارت، والدوسة بتفتحه كبير. (اللي بيحصل بعد كده هنتفق عليه بعدين)
const Gallery = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { items: [], cats: [], cat: "all", root: null };
  // التايبوجرافي قالب زي الباقي: فيديو العرض بتاعه مترسوم بمحرك الكلام المتحرك نفسه
  const EXTRA = [{ id: "typo", name: "تايبوجرافي", icon: "🔤", sample_url: "/gallery/typo.mp4", cover_url: "/gallery/typo.jpg", cat: "motion",
    desc: "كلام بيتحرك على الإيقاع من صوتك أو سكريبتك، بأكتر من 300 حركة جاهزة." },
    // قوالب موشن بالكود (library/motion/r/t-*): بتترسم من غير توليد، والكلام والألوان بيتغيروا
    ...[["t-watercolor", "ألوان مية", "art", "صفحة كراسة بترسم نفسها بالفرشاة، وملاحظات بخط اليد جنب الرسمة."],
      ["t-riso", "ريزوجراف", "art", "طباعة بـ٣ أحبار فوق بعض، بنقط وألوان مش راكبة على بعض بالظبط."],
      ["t-hose", "كرتون قديم", "cartoon2d", "كرتون التلاتينات بالأبيض والأسود: شخصية بترقص على الجاز وكروت عناوين قديمة."],
      ["t-board", "سبورة بيضا", "explain", "شرح بيترسم قدامك بالماركر، والكاميرا بتمشي على السبورة من فكرة للتانية."],
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
    "sk-felt": "عالم وعرايس من الصوف والفِلت بخيوط وزراير، ستوب موشن دافي.",
    "sk-anime": "أنيمي مرسوم باليد بسما كبيرة ونور حنين ولحظات يومية.",
    "sk-watercolor": "لوحة ألوان مية بتتفتح على الورق وبتتحرك بهدوء.",
    "sk-miniature": "الدنيا الحقيقية شكلها لعب صغيرة بتصوير تيلت شيفت.",
    "sk-noir": "فيلم أبيض وأسود غامض بظلال قوية ومطر وراوي.",
    "sk-lowpoly": "عالم 3D بأشكال مضلّعة بسيطة وألوان باستيل زي الألعاب.",
    "sk-vhs": "فيديو بيتي قديم من التسعينات بألوان باهتة ودفا العيلة.",
    "sk-chalk": "رسومات طباشير بتترسم خط خط على سبورة لشرح الأفكار.",
    "sk-sand": "رسم بالرمل على ترابيزة منوّرة، والصور بتتحول لبعضها.",
    "sk-foodslow": "إعلان أكل بالتصوير البطيء جدًا: رشات وقطرات وإضاءة شهية.",
    "sk-surreal": "عالم أحلام سريالي: حاجات عملاقة وأشياء طايرة وسما ناعمة.",
    "sk-toy": "عالم لعب بلاستيك لامعة وألوان حلويات وحركة مرحة.",
    "sk-hd2d": "شخصيات بكسل جوه ديوراما مجسّمة منوّرة بفوانيس وضباب، زي ألعاب المغامرات.",
    "sk-popup": "كتاب بوب أب حقيقي على مكتب بيتفتح ويقوم منه مسرح ورق.",
    "sk-scifitoon": "كرتون فضاء مضحك: رائد فضاء صغير وروبوت وكواكب ملونة.",
    "sk-drone": "إعلان عقارات فخم بتصوير درون: فيلات وبيسينات وبحر وقت الغروب.",
  };
  const CAT_EN = { cartoon2d: "2D Cartoon", anim3d: "3D Animation", paper: "Paper", clay: "Clay", collage: "Collage", motion: "Motion", ugc: "UGC", cinematic: "Cinematic", product: "Product", art: "Art & Print", explain: "Explainer", social: "Social Ads", retro: "Retro Games", other: "My Templates" };

  // فيديوهات عرض جاهزة للقوالب (متعمولة مرة واحدة ومحفوظة في frontend/gallery)
  const SHOW = ["sk-clay", "sk-papercut", "sk-ugc", "sk-cinema-ad", "sk-skeleton", "sk-talking", "sk-song",
    "sk-studio-shot", "sk-product-scene", "sk-static-ads", "sk-felt", "sk-anime", "sk-watercolor", "sk-miniature", "sk-noir", "sk-lowpoly",
    "sk-vhs", "sk-chalk", "sk-sand", "sk-foodslow", "sk-surreal", "sk-toy",
    "sk-hd2d", "sk-popup", "sk-scifitoon", "sk-drone"];
  async function load() {
    const [tpls, cats] = await Promise.all([api("/api/templates"), api("/api/style-cats").catch(() => [])]);
    const catOf = {};
    cats.forEach((c) => (c.templates || []).forEach((t) => (catOf[t.id] = c.id)));
    S.cats = [...cats, ...MORE_CATS.filter((m) => !cats.some((c) => c.id === m.id))];
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
      S.pv.addEventListener("click", (e) => {
        if (e.target.closest("[data-gstart]")) {   // 🧭 مسار القالب (flow.js)
          const x = S.pvItem;
          closePv();
          return Flow.start({ id: x.id, name: x.name, cat: catName(x.cat), desc: DESC[x.id] || x.desc || x.description || "" });
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
        <p>${esc(DESC[x.id] || x.desc || x.description || "")}</p><small class="muted">${esc(catName(x.cat))}</small>
        <button type="button" class="nh-gal-go" data-gstart>✨ ابدأ بالقالب ده</button>
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
      const c = e.target.closest("[data-gcat]");
      if (c) { S.cat = c.dataset.gcat; render(); return; }
      const gn = e.target.closest("[data-gen]");
      if (gn) return Gen.open(gn.dataset.gen);
      const fl = e.target.closest("[data-gflow]");
      if (fl) return Flow.open(fl.dataset.gflow);
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

  // 🧭 مشاريع بدأتها من قالب ولسه مخلصتش
  const STAGE_AR = { idea: "الفكرة", format: "نوع البوست", scenario: "السيناريو", cast: "الأبطال", assets: "الملفات", generate: "التوليد" };
  // 🧪 مولّدات من غير قوالب (gen.js): صوت وصور وفيديو بالوصف بس
  function gens() {
    const g = S.root.querySelector("#nhGal");
    if (g.querySelector(".nh-gal-gens")) return;
    const box = Object.assign(document.createElement("div"), { className: "nh-gal-gens" });
    box.innerHTML = `<small class="muted">من غير قالب:</small>
      <button type="button" class="nh-gal-gen" data-gen="video"><i>🎬</i><span><b>مولد فيديو</b><small>وصف ← فيديو بأي موديل</small></span></button>
      <button type="button" class="nh-gal-gen" data-gen="image"><i>🖼️</i><span><b>مولد صور</b><small>وصف ومرجع ← صور</small></span></button>
      <button type="button" class="nh-gal-gen" data-gen="voice"><i>🎙️</i><span><b>مولد صوت</b><small>كلام ← صوت بلهجتك</small></span></button>`;
    g.querySelector(".nh-gal-chips").before(box);
  }
  async function resume() {
    const g = S.root.querySelector("#nhGal");
    let box = g.querySelector(".nh-gal-resume");
    if (!box) { box = Object.assign(document.createElement("div"), { className: "nh-gal-resume" }); g.querySelector(".nh-gal-chips").before(box); }
    const list = await Flow.recent();
    box.hidden = !list.length;
    box.innerHTML = list.length ? `<small class="muted">كمّل اللي بدأته:</small>${list.map((f) => `<button type="button" class="nh-gal-chip" data-gflow="${esc(f.id)}">🧭 ${esc(f.title || f.template?.name || "مشروع")}<span class="num">${esc(STAGE_AR[f.stage] || "")}</span></button>`).join("")}` : "";
  }
  async function mount(root) {
    S.root = root;
    S.cat = "all";
    if (!root._gal) { root._gal = true; bind(root); }   // نفس العنصر بيتعاد استخدامه لكل الصفحات: الأحداث مرة واحدة بس
    try { await load(); render(); gens(); resume(); } catch (err) { root.querySelector(".nh-gal-grid").innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { mount };
})();
