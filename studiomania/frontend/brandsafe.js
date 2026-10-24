// 🛡️ حسابات العملاء ما تشوفش أسامي المزوّدين ولا الدولار: كل كلام بيظهر في الصفحة بيعدّي على هنا.
// - أسامي الموديلات بتبقى أسامي مستعارة ثابتة، والوصف اللي جنبها (الأرخص، أجود، أغلى…) بيفضل.
// - أي «$X» بيتحول لنقاط (التكلفة × سعر النقطة)، إلا في الأماكن المعلّمة data-usd (زي أسعار الباقات بالدولار).
// - أي عنصر معلّم data-brand-keep بيفضل زي ما هو (زي حقوق Pexels اللي لازم تظهر).
// صاحب البرنامج (الأدمن) بيشوف كل حاجة زي ما هي.
(() => {
  const AR = "\\u0600-\\u06FF";
  const word = (w) => new RegExp(`(?<![${AR}A-Za-z])(وب|ب|و|بـ ?)?${w}(?![${AR}A-Za-z])`, "g");
  // أسامي الموديلات والمنصات ← أسامي ثابتة من عندنا
  const NAMES = [
    [/Seedance(?: \d(?:\.\d)?)? ?Mini/g, "«ومضة» الخفيف"], [/Seedance(?: \d(?:\.\d)?)? ?Fast/g, "«ومضة» السريع"],
    [/Seedance 2\.5/g, "«ومضة» برو"], [/Seedance(?: \d(?:\.\d)?)?/g, "«ومضة»"],
    [/Kling(?: [A-Za-z]?\d(?:\.\d)?)?(?: (?:Std|Pro|Master))?/g, "«لمعة»"], [/Veo ?\d?(?:\.\d)?/g, "«أفق»"], [/\bWan ?\d(?:\.\d)?/g, "«موجة»"],
    [/Hailuo(?: \d+)?/g, "«نجمة»"], [/Sora(?: \d)?/g, "«سحاب»"], [/Flux(?: [A-Z][a-z]+)?/g, "«شعاع»"], [/Seedream(?: \d(?:\.\d)?)?/g, "«حُلم»"],
    [/Nano Banana(?: (?:Pro|\d))?/g, "«خاطف» للصور"], [/GPT Image(?: \d(?:\.\d)?)?/g, "«دقيق» للصور"], [/Veed/g, "«مزامنة»"], [/Recraft/g, "«تصميم»"],
    [/ElevenLabs(?: \([^)]*\))?/g, "«صدى»"], [/MiniMax/g, "«نغم»"], [/SILMA/g, "«نجد»"], [/AudioShake/g, "فصل الصوت"],
    [/ScrapeCreators/g, "تحليل الحسابات"], [/Zernio/g, "النشر"],
  ];
  // جمل فيها Atlas: بتتشال أو بتبقى «نقاطك»
  const ATLAS = [
    [/\s*\((?:من|على) Atlas\)/g, ""], [/(?:ستُحسب|سيُحسب|يُحسب|ويُحسب|تُحسب) على Atlas/g, "تُحسب من نقاطك"],
    [/(?:من )?رصيد Atlas/g, "نقاطك"], [/مال Atlas/g, "نقاطك"], [/\s*(?:على|من|في)\s+(?:كتالوج\s+)?Atlas/g, ""], [/مفتاح Atlas/g, "الخدمة"], [/\s*Atlas/g, ""],
  ];
  const pre = (p) => (!p ? "" : p === "وب" ? "وب" : p === "و" ? "و" : "ب");
  const AR_NAMES = [[word("فصيح"), (m, p) => `${pre(p)}الأصوات العربية`], [word("منصت"), (m, p) => `${pre(p)}الأصوات الخليجية`]];
  const MONEY = [/~?\$\s?(\d+(?:\.\d+)?)/g, /(?<![\w.])(\d+(?:\.\d+)?)\s?\$/g];
  let rate = 300;
  const pts = (usd) => `${Math.max(1, Math.ceil(usd * rate)).toLocaleString("en-US")} نقطة`;

  function clean(s, money) {
    if (!s || !/[A-Za-z$]|فصيح|منصت/.test(s)) return s;
    let o = s;
    for (const [re, to] of ATLAS) o = o.replace(re, to);
    for (const [re, to] of NAMES) o = o.replace(re, to);
    for (const [re, fn] of AR_NAMES) o = o.replace(re, fn);
    if (money) for (const re of MONEY) o = o.replace(re, (m, n) => pts(Number(n)));
    return o;
  }
  const keep = (el) => el?.closest?.("[data-brand-keep], script, style, textarea, input, code, pre");
  const moneyOk = (el) => !el?.closest?.("[data-usd], .pv, #setPlan");
  function doText(n) {
    const el = n.parentElement;
    if (!el || keep(el)) return;
    const v = n.nodeValue, c = clean(v, moneyOk(el));
    if (c !== v) n.nodeValue = c;
  }
  function doEl(el) {
    if (keep(el)) return;
    for (const a of ["title", "placeholder", "aria-label"]) {
      const v = el.getAttribute(a);
      if (v) { const c = clean(v, moneyOk(el)); if (c !== v) el.setAttribute(a, c); }
    }
  }
  function walk(node) {
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1) return;
    doEl(node);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let cur;
    while ((cur = w.nextNode())) cur.nodeType === 3 ? doText(cur) : doEl(cur);
  }
  window.brandSafe = (s) => s;   // قبل ما نعرف نوع الحساب: الكلام زي ما هو
  (window.MEP || Promise.resolve(null)).then((me) => {
    const customer = !!(me && me.role !== "admin");
    document.documentElement.dataset.role = customer ? "customer" : "admin";
    window.IS_CUSTOMER = customer;
    if (!customer) return;
    // 🌐 الواجهة الإنجليزية مخفية عن العملاء لحد ما الترجمة تكتمل: زرار EN مش ظاهر، واللي كان مختار الإنجليزي يرجع للعربي
    if (window.I18N?.lang === "en") return window.I18N.setLang("ar");
    rate = Number(me.pts_per_usd) || rate;
    window.brandSafe = (s) => clean(String(s ?? ""), true);
    walk(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "placeholder", "aria-label"] });
    const _c = window.confirm.bind(window), _a = window.alert.bind(window);
    window.confirm = (m) => _c(clean(String(m), true));
    window.alert = (m) => _a(clean(String(m), true));
  });
})();
