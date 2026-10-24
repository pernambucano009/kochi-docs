// 🧪 مولّدات من غير قوالب: 🎙️ صوت، 🖼️ صور، 🎬 فيديو. بتفتح فوق الصفحة (نفس شكل مسار القالب)،
// وكل اللي بيتولّد بيتحفظ في التاريخ تحت: الصوت بيدخل مكتبة التعليق، والفيديو بيدخل «الفيديوهات الجاهزة».
const Gen = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, tab: "video", info: null, list: [], timer: null, d: { lang: "", voice: "", imodel: "nano2", ratio: "9:16", count: 1, vmodel: "", secs: 5, res: "480p", audio: true } };
  const TABS = { video: ["🎬", "مولّد الفيديو"], image: ["🖼️", "مولّد الصور"], voice: ["🎙️", "مولّد الصوت"] };

  // host: لو اتبعت، المولّد بيترسم جوه العنصر ده (صفحة «ابدأ مشروع جديد») بدل ما يفتح فوق الشاشة
  let escOn = false;
  function shell(host) {
    const want = host || document.body;
    if (S.el && S.el.parentNode === want) return S.el;
    if (S.el) { clearTimeout(S.timer); S.el.remove(); }
    S.el = Object.assign(document.createElement("div"), { className: host ? "flw gen inline" : "flw gen", hidden: true });
    if (!host) S.el.setAttribute("role", "dialog");
    S.el.addEventListener("click", onClick);
    S.el.addEventListener("change", onChange);
    S.el.addEventListener("input", (e) => { if (e.target.dataset.g) S.d[e.target.dataset.g] = e.target.value; if (e.target.dataset.g === "text") costLine(); });
    want.appendChild(S.el);
    if (!escOn) {
      escOn = true;
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.el && !S.el.hidden && !S.el.classList.contains("inline")) { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
    }
    return S.el;
  }
  async function open(tab = "video", host = null) {
    shell(host);
    S.tab = tab;
    S.el.hidden = false;
    S.el.innerHTML = `<div class="flw-box"><div class="flw-load"><span class="flw-spin"></span></div></div>`;
    try {
      [S.info, S.list] = await Promise.all([S.info || api("/api/gens/info"), api("/api/gens")]);
      S.d.vmodel ||= S.info.video_models?.[0]?.key || "";
      S.d.lang ||= (S.info.dialects?.[S.info.brand_lang] ? S.info.brand_lang : Object.keys(S.info.dialects || {})[0] || "");
    } catch (err) { toast(err.message, true); return close(); }
    render(); poll();
  }
  function close() { clearTimeout(S.timer); if (S.el) { S.el.querySelectorAll("video, audio").forEach((m) => m.pause()); S.el.hidden = true; S.el.innerHTML = ""; } }

  // ---------------------------------------------------------------- الفورم (من البروتوتايب: وصف كبير + اختيارات صغيرة بأيقونات + معاينة على الجنب)
  const GI = {
    model: "M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z M12 12l7.5-4.3 M12 12v8.5 M12 12L4.5 7.7",
    secs: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v4l3 2",
    ratio: "M7 3.5h10v17H7z",
    res: "M4 6h16v12H4z M8 10v4 M8 12h2.5 M10.5 10v4 M14 10h1.5a2 2 0 0 1 0 4H14z",
    audio: "M5 10v4h3l4 4V6l-4 4z M15.5 9a4 4 0 0 1 0 6",
    image: "M4.5 5h15v14h-15z M3.5 15.5l4.5-4.5 4 4 3-3 5 5",
    count: "M7 7h12v12H7z M4 4h12",
    lang: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M3.5 12h17 M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z",
    voice: "M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z M6 11a6 6 0 0 0 12 0 M12 17v3.5",
    name: "M4 20h4L19 9l-4-4L4 16z",
    hist: "M4 12a8 8 0 1 0 2.3-5.6 M4 4v4h4 M12 8v4l3 2",
  };
  const gi = (k, s = 16) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="${GI[k]}"/></svg>`;
  const short = (t) => (window.IS_CUSTOMER ? String(t || "").replace(/\s*\((.*?)\)\s*/g, " · $1").trim() : String(t || "").replace(/\s*\(.*?\)\s*/g, " ").trim());
  function options() {
    const A = S.info, d = S.d;
    if (S.tab === "video") {
      const vr = A.video_ratios || ["9:16", "16:9", "1:1"];
      if (!vr.includes(d.ratio)) d.ratio = "9:16";
      const m = (A.video_models || []).find((x) => x.key === d.vmodel);
      return [{ k: "vmodel", ic: "model", label: "النموذج", v: short(m?.label), ch: (A.video_models || []).map((x) => [x.key, `${short(x.label)} · ~$${vmCost(x, Number(d.secs), d.res)}`]) },
        { k: "secs", ic: "secs", label: "المدة", v: `${d.secs} ثوانٍ`, ch: [3, 5, 8, 10, 12, 15].map((n) => [String(n), `${n} ثوانٍ`]) },
        { k: "ratio", ic: "ratio", label: "المقاس", v: d.ratio, ch: vr.map((r) => [r, r]) },
        { k: "res", ic: "res", label: "الجودة", v: d.res, ch: [["480p", "480p"], ["720p", "720p (الضعف)"]] },
        { k: "audio", ic: "audio", label: "الصوت", v: d.audio ? "بصوت" : "بدون صوت", ch: [["1", "بصوت"], ["", "بدون صوت"]] },
        { k: "image", ic: "image", label: "صورة البداية (اختيارية)", v: S.files?.image?.length ? S.files.image[0].name.slice(0, 18) : "صورة البداية", file: "image/*" }];
    }
    if (S.tab === "image") {
      return [{ k: "imodel", ic: "model", label: "النموذج", v: short(A.image_models[d.imodel]?.label), ch: Object.entries(A.image_models).map(([k, m]) => [k, `${short(m.label)} · $${m.price}`]) },
        { k: "ratio", ic: "ratio", label: "المقاس", v: d.ratio, ch: A.ratios.map((r) => [r, r]) },
        { k: "count", ic: "count", label: "العدد", v: `${d.count} ${+d.count === 1 ? "صورة" : "صور"}`, ch: [1, 2, 3, 4].map((n) => [String(n), String(n)]) },
        { k: "refs", ic: "image", label: "صور مرجعية (حتى ٤): منتجك أو شخصية أو أسلوب", v: S.files?.refs?.length ? `${S.files.refs.length} صور مرجعية` : "صور مرجعية", file: "image/*", multi: true }];
    }
    const langs = Object.entries(A.dialects || {}), voices = A.dialects?.[d.lang]?.voices || [];
    if (!voices.includes(d.voice)) d.voice = voices[0] || "";
    return [{ k: "lang", ic: "lang", label: "اللهجة أو اللغة", v: A.dialects?.[d.lang]?.label || "", ch: langs.map(([k, v]) => [k, v.label]) },
      { k: "voice", ic: "voice", label: "الصوت", v: A.voices?.[d.voice] || d.voice, ch: voices.map((v) => [v, A.voices?.[v] || v]) },
      { k: "name", ic: "name", label: "الاسم في مكتبة التعليق (اختياري)", v: d.name || "الاسم", ask: true }];
  }
  const HEAD = { video: ["GENERATE VIDEO", "صِف الفيديو الذي تريده", "vprompt", "مثلًا: الكاميرا تقترب ببطء من فنجان قهوة يتصاعد منه البخار، والضوء يتحرك على الطاولة"],
    image: ["GENERATE IMAGE", "صِف الصورة التي تريدها", "iprompt", "مثلًا: فنجان قهوة على طاولة خشبية بجانب نافذة، ضوء الصباح، تصوير منتج"],
    voice: ["GENERATE VOICE", "اكتب النص الذي تريد أن يُقال", "text", "اكتب النص هنا"] };
  function cost() {
    const A = S.info, d = S.d;
    if (S.tab === "image") return (A.image_models[d.imodel]?.price || 0) * Number(d.count || 1);
    if (S.tab === "video") {
      const m = (A.video_models || []).find((x) => x.key === d.vmodel);
      const img = S.files?.image?.length ? 0 : A.first_frame_cost || 0;
      return m ? m.per_sec * Number(d.secs) * (d.res === "720p" ? 2 : 1) + img : 0;
    }
    return null;
  }
  function costLine() {
    const el = S.el?.querySelector("[data-gcost]");
    if (!el) return;
    const c = cost();
    el.innerHTML = c == null ? (S.d.text ? `المدة نحو <b class="num">${Math.max(1, Math.round(S.d.text.length / 14))}</b> ثانية` : "") : `التكلفة نحو <b class="num">$${c < 0.1 ? c.toFixed(3) : c.toFixed(2)}</b>`;
  }

  // ---------------------------------------------------------------- المعاينة والسجل
  const sig = (g) => [g.status, g.url, g.step, g.error, g.cost].join("|");
  const mine = () => S.list.filter((g) => g.kind === S.tab);
  function media(g, big) {
    if (!g) return `<div class="gn-ph">${S.tab === "voice" ? "سيظهر التسجيل هنا" : S.tab === "image" ? "ستظهر الصورة هنا" : "سيظهر الفيديو هنا"}</div>`;
    if (g.status !== "done") return `<div class="gn-ph">${g.status === "failed" ? `⚠️ ${esc(g.error || "توقف")}` : `<span class="flw-spin"></span><small>${esc(g.step || "جارٍ التوليد…")}</small>`}</div>`;
    if (g.kind === "image") return `<img src="${esc(g.url)}" alt="" ${big ? "" : 'loading="lazy"'}>`;
    if (g.kind === "video") return big ? `<video src="${esc(g.url)}" controls playsinline preload="metadata"></video>` : `<video src="${esc(g.url)}#t=0.5" muted playsinline preload="metadata"></video>`;
    return big ? `<div class="gn-ph au"><audio src="${esc(g.url)}" controls preload="metadata"></audio><small dir="auto">${esc(g.prompt.slice(0, 120))}</small></div>` : `<div class="gn-ph">${gi("voice", 18)}</div>`;
  }
  function side() {
    const L = mine(), cur = L.find((g) => g.id === S.view) || L[0];
    const ratio = S.tab === "voice" ? "auto" : (cur?.ratio || S.d.ratio || "9:16").replace(":", " / ");
    return `<div class="gn-prev" style="aspect-ratio:${ratio}">${media(cur, true)}</div>
      ${cur ? `<div class="gn-cap"><span>${cur.kind === "video" ? `${esc(short((cur.model_label || "").split(" · ")[0]))} · ${cur.duration || ""} ث` : cur.kind === "voice" ? "حُفظ في مكتبة التعليق" : esc(cur.ratio || "")}${cur.cost ? ` · $${cur.cost}` : ""}</span>
        ${cur.url ? `<a class="gn-ib" href="${esc(cur.url)}" download data-tip="نزّل" aria-label="نزّل">${gi("count", 14)}</a>` : ""}<button type="button" class="gn-ib" data-gdel="${esc(cur.id)}" data-tip="احذف" aria-label="احذف">✕</button></div>` : ""}
      ${L.length > 1 ? `<div class="gn-thumbs">${L.slice(0, 5).map((g) => `<button type="button" class="gn-th${g === cur ? " on" : ""}" data-gview="${esc(g.id)}" aria-label="${esc(g.prompt.slice(0, 40))}">${media(g)}</button>`).join("")}</div>` : ""}`;
  }
  function drawer() {
    if (!S.hist) return "";
    const L = mine();
    return `<aside class="gn-dw" aria-label="كل ما ولّدته"><div class="gn-dh"><b>كل ما ولّدته</b><span class="num">${L.length}</span><button type="button" class="gn-ib" data-ghist aria-label="إغلاق">✕</button></div>
      <div class="gn-hl">${L.map((g) => `<button type="button" class="gn-hi" data-gview="${esc(g.id)}"><span class="gn-th">${media(g)}</span><span dir="auto">${esc(g.prompt.slice(0, 90))}</span></button>`).join("") || `<p class="gn-note">ما تولّده يظهر هنا ويصبح محفوظًا.</p>`}</div></aside>`;
  }
  function render() {
    if (!S.el || !S.info) return;
    const d = S.d, H = HEAD[S.tab], O = options(), pop = O.find((o) => o.k === S.pop && o.ch);
    const inline = S.el.classList.contains("inline");
    S.el.innerHTML = `<div class="flw-box gn" data-built>
      ${inline ? "" : `<header class="gn-top"><nav class="gn-tabs">${Object.entries(TABS).map(([k, [, t]]) => `<button type="button" class="${k === S.tab ? "on" : ""}" data-gtab="${k}">${t}</button>`).join("")}</nav><button type="button" class="gn-ib" data-gclose aria-label="أغلق">✕</button></header>`}
      <div class="gn-main"><div class="gn-form">
        <div class="gn-h"><span class="latin en-k">${H[0]}</span><h2>${H[1]}</h2></div>
        <textarea class="gn-pr" data-g="${H[2]}" rows="3" dir="auto" aria-label="${H[1]}" placeholder="${H[3]}">${esc(d[H[2]] || "")}</textarea>
        <div class="gn-opts">${O.map((o) => o.file ? `<label class="gn-opt${S.files?.[o.k]?.length ? " set" : ""}" data-tip="${esc(o.label)}">${gi(o.ic)}<span>${esc(o.v)}</span><input type="file" accept="${o.file}" ${o.multi ? "multiple" : ""} data-gfile="${o.k}" hidden></label>`
          : `<button type="button" class="gn-opt${S.pop === o.k ? " on" : ""}" data-gopt="${o.k}" ${o.ask ? "data-gask" : ""} data-tip="${esc(o.label)}">${gi(o.ic)}<span>${esc(o.v)}</span></button>`).join("")}</div>
        ${pop ? `<div class="gn-pop">${pop.ch.map(([v, t]) => `<button type="button" class="${String(d[pop.k] === true ? "1" : d[pop.k] === false ? "" : d[pop.k]) === v ? "on" : ""}" data-gpick="${esc(v)}">${esc(t)}</button>`).join("")}</div>` : ""}
        ${S.tab === "voice" && !S.info.fasih ? `<p class="gn-note">اللهجات العربية غير متاحة الآن.</p>` : ""}
        <div class="gn-go"><button type="button" class="gn-gobtn" data-ggo>ولّد</button><span class="gn-note" data-gcost></span>
          ${mine().length ? `<button type="button" class="gn-ib" data-ghist data-tip="كل ما ولّدته" aria-label="كل ما ولّدته">${gi("hist")}</button>` : ""}</div></div>
        <div class="gn-side">${side()}</div></div>${drawer()}</div>`;
    costLine();
  }
  // وهو بيستنى التوليد: بنحدّث المعاينة بس، فالكلام اللي بتكتبه مابيتمسحش
  function patchGrid() {
    const s = S.el?.querySelector(".gn-side");
    if (!s) return render();
    const L = mine(), cur = L.find((g) => g.id === S.view) || L[0], key = L.map(sig).join(",");
    if (s.dataset.k === key) return;
    s.dataset.k = key; s.innerHTML = side();
    if (S.hist) { const dw = S.el.querySelector(".gn-dw"); if (dw) dw.outerHTML = drawer(); }
    void cur;
  }
  function poll() {
    clearTimeout(S.timer);
    if (!S.list.some((g) => g.status === "working")) return;
    S.timer = setTimeout(async () => {
      if (!S.el || S.el.hidden) return;
      try { S.list = await api("/api/gens"); patchGrid(); } catch { /* يعيد المحاولة */ }
      poll();
    }, 3000);
  }
  // ---------------------------------------------------------------- الأحداث
  async function go() {
    const d = S.d;
    let res;
    try {
      if (S.tab === "voice") {
        if (!(d.text || "").trim()) return toast("اكتب النص", true);
        res = await api("/api/gens/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: d.text, lang: d.lang, voice: d.voice, name: d.name || "" }) });
      } else {
        const fd = new FormData();
        if (S.tab === "image") {
          if (!(d.iprompt || "").trim()) return toast("صِف الصورة", true);
          fd.append("prompt", d.iprompt); fd.append("model", d.imodel); fd.append("ratio", d.ratio); fd.append("count", d.count);
          [...(S.files?.refs || [])].forEach((f) => fd.append("refs", f));
          res = await api("/api/gens/image", { method: "POST", body: fd });
        } else {
          if (!(d.vprompt || "").trim()) return toast("صِف الفيديو", true);
          fd.append("prompt", d.vprompt); fd.append("model", d.vmodel); fd.append("duration", d.secs); fd.append("ratio", d.ratio);
          fd.append("resolution", d.res); fd.append("audio", d.audio ? "true" : "false");
          if (S.files?.image?.[0]) fd.append("image", S.files.image[0]);
          res = await api("/api/gens/video", { method: "POST", body: fd });
        }
      }
    } catch (err) { return toast(err.message, true); }
    S.list = [...(Array.isArray(res) ? res : [res]), ...S.list];
    S.files = {};
    toast("✓ بدأ التوليد، وسيظهر بجانبك عند انتهائه");
    S.view = null; render(); poll();
  }
  async function onClick(e) {
    const t = e.target, q = (s) => t.closest(s);
    let b;
    if (q("[data-gclose]")) return close();
    if ((b = q("[data-gtab]"))) { S.tab = b.dataset.gtab; S.files = {}; S.pop = null; S.view = null; S.hist = false; return render(); }
    if (q("[data-ghist]")) { S.hist = !S.hist; return render(); }
    if ((b = q("[data-gview]"))) { S.view = b.dataset.gview; return render(); }
    if ((b = q("[data-gask]"))) { const v = await uiPrompt("الاسم الذي يُحفظ به في مكتبة التعليق:", S.d.name || ""); if (v != null) S.d.name = v.trim(); return render(); }
    if ((b = q("[data-gopt]"))) { S.pop = S.pop === b.dataset.gopt ? null : b.dataset.gopt; return render(); }
    if ((b = q("[data-gpick]"))) { const k = S.pop, v = b.dataset.gpick; S.d[k] = k === "audio" ? v === "1" : v; if (k === "lang") S.d.voice = ""; S.pop = null; return render(); }
    if (S.pop && !q(".gn-pop")) { S.pop = null; render(); }
    if (q("[data-ggo]")) return go();
    if ((b = q("[data-gdel]"))) {
      if (!(await uiConfirm("هل تحذفه؟"))) return;
      try { await api(`/api/gens/${b.dataset.gdel}`, { method: "DELETE" }); S.list = S.list.filter((g) => g.id !== b.dataset.gdel); S.view = null; render(); } catch (err) { toast(err.message, true); }
    }
  }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.gfile) { S.files = { ...(S.files || {}), [el.dataset.gfile]: el.files }; render(); return; }
    if (el.dataset.g) {
      S.d[el.dataset.g] = el.type === "checkbox" ? el.checked : el.value;
      if (el.dataset.g === "lang") S.d.voice = "";
      if (el.tagName === "SELECT" || el.type === "checkbox") render();
    }
  }
  return { open, close };
})();
