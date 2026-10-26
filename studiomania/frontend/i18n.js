// StudioMania — عربي / English
// العربي هو الأصل. في الإنجليزي بنترجم أي كلام بيظهر على الشاشة من قاموس i18n-en.js،
// حتى الرسايل اللي بتيجي من السيرفر والجمل اللي فيها أرقام وأسماء.
(function () {
  const KEY = "studiomania.lang";
  let lang = "ar";
  try { lang = localStorage.getItem(KEY) === "en" ? "en" : "ar"; } catch {}
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === "en" ? "ltr" : "rtl";
  const I18N = {
    lang,
    setLang(l) {
      try { localStorage.setItem(KEY, l); } catch {}
      location.reload();
    },
    t: (s) => s,
  };
  window.I18N = I18N;
  if (lang !== "en") return;

  const AR = /[؀-ۿ]/;
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new Map();
  const pats = [];
  const frags = [];
  for (const [ar, en] of Object.entries(window.I18N_EN || {})) {
    const k = norm(ar);
    if (/\{\d\}/.test(k)) {
      const parts = k.split(/(\{\d\})/);
      // خانتين لازقين في بعض («{1}{2}»): التانية غالبًا إضافة اختيارية، فالأولى بتاخد الكلام كله والتانية ممكن تبقى فاضية.
      // من غير كده الأولى كانت بتاخد حرف واحد وتقطع الكلمة («تايبوجرافي» ← «ت» + «ايبوجرافي»)
      const body = parts.map((p, i) => (!/^\{\d\}$/.test(p) ? esc(p)
        : parts[i + 1] === "" && /^\{\d\}$/.test(parts[i + 2] || "") ? "([\\s\\S]+)"
          : parts[i - 1] === "" && /^\{\d\}$/.test(parts[i - 2] || "") ? "([\\s\\S]*?)"
            : i === 1 && parts[0] === "" && parts[2] && !/^\s/.test(parts[2]) ? "([\\s\\S]*?)"   // «{0}آخر مشروع…»: البادئة اختيارية
              : "([\\s\\S]+?)")).join("");
      const order = [...k.matchAll(/\{(\d)\}/g)].map((m) => +m[1]);
      const staticLen = parts.filter((p) => !/^\{\d\}$/.test(p)).join("").trim().length;
      // قواعد عامة أوي («{0}ث» للثواني، «{0} من {1}»، «من {0}»، «في {0}»…) ماتلقطش كلام عربي عادي:
      // من غيرها «يبحث» كانت بتطلع «يبحs» و«من المطبخ» «of المطبخ». اللي مكانه فيها لازم يكون رقم أو كلام مش عربي
      const words = parts.filter((p) => !/^\{\d\}$/.test(p)).join(" ").replace(/[^؀-ۿ]+/g, " ").trim();
      const strict = !words || /^(ث|من|في|لـ|إلى|بعد|خلال|حتى|عن)( (ث|من))?$/.test(words);
      // جوه جملة أطول: الخانة اللي في الآخر لازم تكمل لحد فاصل (· أو علامة أو آخر الجملة)، من غيرها كانت بتاخد حرف واحد
      // («آخر مشروع: تايبوجرافي · …» كانت بتطلع «Last project: ت» وباقي الكلمة «ايبوجرافي»)
      const tail = /\{\d\}$/.test(k) ? "(?=\\s·\\s|\\s*[،,.؟?!:]|$)" : "";
      pats.push({ re: new RegExp(`^${body}$`), loose: staticLen >= 8 ? new RegExp(body + tail, "g") : null, order, en, staticLen, strict });
    } else {
      exact.set(k, en);
      if (k.length >= 6) frags.push([k, en]);
    }
  }
  frags.sort((a, b) => b[0].length - a[0].length);
  pats.sort((a, b) => b.staticLen - a.staticLen); // الأدق أولًا: «{0} من {1} قطعة وُلّدت» قبل «{0} من {1}: {2}»

  const DT = { "السبت": "Saturday", "الأحد": "Sunday", "الاثنين": "Monday", "الإثنين": "Monday", "الثلاثاء": "Tuesday", "الأربعاء": "Wednesday", "الخميس": "Thursday", "الجمعة": "Friday",
    "يناير": "January", "فبراير": "February", "مارس": "March", "أبريل": "April", "إبريل": "April", "مايو": "May", "يونيو": "June", "يوليو": "July", "أغسطس": "August",
    "سبتمبر": "September", "أكتوبر": "October", "نوفمبر": "November", "ديسمبر": "December", "اليوم": "Today", "غدًا": "Tomorrow", "أمس": "Yesterday", "م": "PM", "ص": "AM" };
  const fill = (p, vals) => p.en.replace(/\{(\d)\}/g, (_, i) => t(vals[p.order.indexOf(+i)] ?? ""));
  const cache = new Map(), miss = new Set(), seen = new Set();
  I18N.misses = () => [...miss];
  // 🔎 وضع الفحص (tests/i18n): كل جملة عربي عدّت على الشاشة، عشان فحص العامية. للعملاء مش شغّال
  let AUDIT = false;
  try { AUDIT = localStorage.getItem("studiomania.i18n-audit") === "1"; } catch {}
  I18N.seen = () => [...seen];
  function t(s) {
    if (!s || !AR.test(s)) return s;
    if (AUDIT && seen.size < 50000) seen.add(norm(s));
    const hit = cache.get(s);
    if (hit !== undefined) return hit;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    const n = norm(s);
    let out = exact.get(n);
    if (out === undefined) {
      for (const p of pats) {
        const m = p.re.exec(n);
        // القاعدة العامة بتقبل كلام عربي بس لو هو نفسه بيتترجم كله («لـ عميلي» ← «for My client»)
        if (m && p.strict && m.slice(1).some((x) => AR.test(x) && AR.test(t(x)))) continue;
        if (m) { out = fill(p, m.slice(1)); break; }
      }
    }
    if (out === undefined) {
      // كلمة قبلها أو بعدها رموز/إيموجي: «🎬 فيديو» ← «🎬 Video»
      const m = n.match(/^([^\p{L}\p{N}]*)(.+?)([^\p{L}\p{N}]*)$/u);
      if (m && (m[1] || m[3])) {
        const core = exact.get(m[2]);
        if (core !== undefined) out = m[1] + core + m[3];
        else if (m[1] && exact.has(n.slice(m[1].length))) out = m[1] + exact.get(n.slice(m[1].length));   // «＋ X (تويتر)»: القوس جزء من الكلمة
      }
    }
    if (out === undefined) {
      // رقم + كلمة («0 فكرة» ← «0 ideas»)، ووقت («1:00 م» ← «1:00 PM»)، وأجزاء بينها « · » كل جزء معروف
      let m2 = n.match(/^([\d٠-٩][\d٠-٩.,:]*)\s+(\S.*)$/);
      if (m2 && /^(م|ص|مساءً|صباحًا)$/.test(m2[2])) out = m2[1] + (m2[2][0] === "م" ? " PM" : " AM");
      else if (m2 && exact.has(m2[2])) out = m2[1] + " " + exact.get(m2[2]);
      else if (n.includes(" · ")) {
        const parts = n.split(" · "), tr = parts.map((p) => { if (exact.has(p)) return exact.get(p); if (!AR.test(p)) return p; const x = t(p); return AR.test(x) ? null : x; });
        if (tr.every((x) => x != null)) out = tr.join(" · ");
      }
      if (out !== undefined) out = out.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    }
    if (out === undefined) {
      // تاريخ مكتوب بإيدينا («الأربعاء 28 أكتوبر · 1»، «اليوم 7:00 م»): أسماء الأيام والشهور بس
      const toks = n.split(/(\s+|·|,|،|-|–)/);
      if (toks.some((w) => DT[w]) && toks.every((w) => !AR.test(w) || DT[w])) {
        out = toks.map((w) => DT[w] || w).join("").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/،/g, ",");
      }
    }
    if (out === undefined) {
      // جملة متركّبة من كذا حتة: بنترجم كل حتة نعرفها جواها
      if (miss.size < 3000) miss.add(n);   // 🔎 جمل مش في القاموس (I18N.misses()): أداة الجرد بتجمعها من الشاشات
      out = n;
      for (const [a, e] of frags) if (out.includes(a)) out = out.split(a).join(e);
      for (const p of pats) if (p.loose && AR.test(out)) out = out.replace(p.loose, (...m) => fill(p, m.slice(1, 1 + p.order.length)));
      // 🔒 لو فضل فيها عربي: دي جملة مش بتاعتنا (محتوى العميل أو كلام الذكاء الاصطناعي)، فبنسيبها زي ما هي.
      // الترجمة الجزئية كانت بتبوّظها كلمة كلمة («الposts التي…»، «Cairo والجيزة»)
      if (AR.test(out.replace(/[٠-٩]/g, ""))) out = n;
      else out = out.replace(/،/g, ",").replace(/؟/g, "?").replace(/«|»/g, '"').replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    }
    out = lead + out + trail;
    if (cache.size < 8000) cache.set(s, out);
    return out;
  }
  I18N.t = t;

  // 📅 التواريخ والأرقام: أي تنسيق بالعربي (ar-EG…) بيطلع إنجليزي، عشان مايبانش «٢٦/١٠/٢٠٢٦، ١٢:٣٠ ص» في الإنجليزي
  const enLoc = (l) => (typeof l === "string" && /^ar/i.test(l)) || (Array.isArray(l) && l.some((x) => /^ar/i.test(x))) ? "en-GB" : l;
  for (const [C, fns] of [[Date, ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]], [Number, ["toLocaleString"]]]) {
    for (const f of fns) {
      const orig = C.prototype[f];
      C.prototype[f] = function (l, o) { return orig.call(this, enLoc(l), o); };
    }
  }
  const _DTF = Intl.DateTimeFormat, _NF = Intl.NumberFormat;
  Intl.DateTimeFormat = function (l, o) { return new _DTF(enLoc(l), o); };
  Intl.DateTimeFormat.prototype = _DTF.prototype; Intl.DateTimeFormat.supportedLocalesOf = _DTF.supportedLocalesOf;
  Intl.NumberFormat = function (l, o) { return new _NF(enLoc(l), o); };
  Intl.NumberFormat.prototype = _NF.prototype; Intl.NumberFormat.supportedLocalesOf = _NF.supportedLocalesOf;

  // data-tip و data-ph: تلميح الزرار والكلام الرمادي في مربعات الكتابة (بيظهروا من الـ CSS بـ attr())
  const ATTRS = ["placeholder", "title", "aria-label", "data-tip", "data-ph"];
  // 🔒 كلام العميل نفسه (اللي بيكتبه، أو محتوى علامته) مايتترجمش: لا خانات الكتابة ولا اللي متعلّم data-no-i18n
  const OWN = "[data-no-i18n], [contenteditable]";
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);
  function doText(node) {
    const v = node.nodeValue;
    if (v && AR.test(v) && !SKIP.has(node.parentNode?.nodeName) && !node.parentNode?.closest?.(OWN)) {
      const tv = t(v);
      if (tv !== v) node.nodeValue = tv;
    }
  }
  function tr(el, a) {
    const v = el.getAttribute(a);
    if (v && AR.test(v)) {
      const tv = t(v);
      if (tv !== v) el.setAttribute(a, tv); // إذا لا تغيّر لا نكتبه آخر، وإلا المراقب يظل يدور
    }
  }
  function doEl(el) {
    if (el.closest?.(OWN)) {
      // خانة كتابة: كلام العميل جواها يفضل زي ما هو، بس الكلام الرمادي (data-ph) من البرنامج فبيتترجم
      if (el.hasAttribute?.("contenteditable") && !el.closest("[data-no-i18n]")) tr(el, "data-ph");
      return;
    }
    for (const a of ATTRS) tr(el, a);
    // الأماكن اللي كانت مجبورة يمين لشمال عشان العربي
    if (el.getAttribute("dir") === "rtl") el.setAttribute("dir", "ltr");
  }
  function walk(node) {
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1 || SKIP.has(node.nodeName) && node.nodeName !== "INPUT") return;
    doEl(node);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let cur;
    while ((cur = w.nextNode())) {
      if (cur.nodeType === 3) doText(cur);
      else doEl(cur);
    }
  }
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doEl(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, "dir"] });

  const _confirm = window.confirm.bind(window), _alert = window.alert.bind(window), _prompt = window.prompt.bind(window);
  window.confirm = (m) => _confirm(t(String(m)));
  window.alert = (m) => _alert(t(String(m)));
  window.prompt = (m, d) => _prompt(t(String(m)), d);
})();
