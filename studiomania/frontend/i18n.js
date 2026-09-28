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
      const body = parts.map((p) => (/^\{\d\}$/.test(p) ? "([\\s\\S]+?)" : esc(p))).join("");
      const order = [...k.matchAll(/\{(\d)\}/g)].map((m) => +m[1]);
      const staticLen = parts.filter((p) => !/^\{\d\}$/.test(p)).join("").trim().length;
      pats.push({ re: new RegExp(`^${body}$`), loose: staticLen >= 8 ? new RegExp(body, "g") : null, order, en, staticLen });
    } else {
      exact.set(k, en);
      if (k.length >= 6) frags.push([k, en]);
    }
  }
  frags.sort((a, b) => b[0].length - a[0].length);
  pats.sort((a, b) => b.staticLen - a.staticLen); // الأدق الأول: «{0} من {1} قطعة اتولّدت» قبل «{0} من {1}: {2}»

  const fill = (p, vals) => p.en.replace(/\{(\d)\}/g, (_, i) => t(vals[p.order.indexOf(+i)] ?? ""));
  const cache = new Map();
  function t(s) {
    if (!s || !AR.test(s)) return s;
    const hit = cache.get(s);
    if (hit !== undefined) return hit;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    const n = norm(s);
    let out = exact.get(n);
    if (out === undefined) {
      for (const p of pats) {
        const m = p.re.exec(n);
        if (m) { out = fill(p, m.slice(1)); break; }
      }
    }
    if (out === undefined) {
      // كلمة قبلها أو بعدها رموز/إيموجي: «🎬 فيديو» ← «🎬 Video»
      const m = n.match(/^([^\p{L}\p{N}]*)(.+?)([^\p{L}\p{N}]*)$/u);
      if (m && (m[1] || m[3])) {
        const core = exact.get(m[2]);
        if (core !== undefined) out = m[1] + core + m[3];
      }
    }
    if (out === undefined) {
      // جملة متركّبة من كذا حتة: بنترجم كل حتة نعرفها جواها
      out = n;
      for (const [a, e] of frags) if (out.includes(a)) out = out.split(a).join(e);
      for (const p of pats) if (p.loose && AR.test(out)) out = out.replace(p.loose, (...m) => fill(p, m.slice(1, 1 + p.order.length)));
      out = out.replace(/،/g, ",").replace(/؟/g, "?").replace(/«|»/g, '"');
    }
    out = lead + out + trail;
    if (cache.size < 8000) cache.set(s, out);
    return out;
  }
  I18N.t = t;

  const ATTRS = ["placeholder", "title", "aria-label"];
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT"]);
  function doText(node) {
    const v = node.nodeValue;
    if (v && AR.test(v) && !SKIP.has(node.parentNode?.nodeName) && !node.parentNode?.closest?.("[data-no-i18n]")) {
      const tv = t(v);
      if (tv !== v) node.nodeValue = tv;
    }
  }
  function doEl(el) {
    if (el.closest?.("[data-no-i18n]")) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && AR.test(v)) {
        const tv = t(v);
        if (tv !== v) el.setAttribute(a, tv); // لو ماتغيّرش منكتبوش تاني، وإلا المراقب يفضل يلف
      }
    }
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
