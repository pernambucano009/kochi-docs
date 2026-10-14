// 🧪 مولّدات من غير قوالب: 🎙️ صوت، 🖼️ صور، 🎬 فيديو. بتفتح فوق الصفحة (نفس شكل مسار القالب)،
// وكل اللي بيتولّد بيتحفظ في التاريخ تحت: الصوت بيدخل مكتبة التعليق، والفيديو بيدخل «الفيديوهات الجاهزة».
const Gen = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, tab: "video", info: null, list: [], timer: null, d: { lang: "", voice: "", imodel: "nano2", ratio: "9:16", count: 1, vmodel: "", secs: 5, res: "480p", audio: true } };
  const TABS = { voice: ["🎙️", "مولد صوت"], image: ["🖼️", "مولد صور"], video: ["🎬", "مولد فيديو"] };

  function shell() {
    if (S.el) return S.el;
    S.el = Object.assign(document.createElement("div"), { className: "flw gen", hidden: true });
    S.el.setAttribute("role", "dialog");
    S.el.addEventListener("click", onClick);
    S.el.addEventListener("change", onChange);
    S.el.addEventListener("input", (e) => { if (e.target.dataset.g) S.d[e.target.dataset.g] = e.target.value; if (e.target.dataset.g === "text") costLine(); });
    document.body.appendChild(S.el);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.el && !S.el.hidden) { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
    return S.el;
  }
  async function open(tab = "video") {
    shell();
    S.tab = tab;
    S.el.hidden = false;
    S.el.innerHTML = `<div class="flw-box"><div class="flw-load"><span class="flw-spin"></span></div></div>`;
    try {
      [S.info, S.list] = await Promise.all([S.info || api("/api/gens/info"), api("/api/gens")]);
      S.d.vmodel ||= S.info.video_models?.[0]?.key || "";
      S.d.lang ||= Object.keys(S.info.dialects || {})[0] || "";
    } catch (err) { toast(err.message, true); return close(); }
    render(); poll();
  }
  function close() { clearTimeout(S.timer); if (S.el) { S.el.querySelectorAll("video, audio").forEach((m) => m.pause()); S.el.hidden = true; S.el.innerHTML = ""; } }

  // ---------------------------------------------------------------- الفورم
  function voiceForm() {
    const A = S.info, d = S.d, langs = Object.entries(A.dialects || {});
    const voices = A.dialects?.[d.lang]?.voices || [];
    if (!voices.includes(d.voice)) d.voice = voices[0] || "";
    const opt = (g) => langs.filter(([, v]) => v.group === g).map(([k, v]) => `<option value="${k}" ${k === d.lang ? "selected" : ""}>${esc(v.label)}</option>`).join("");
    return `<label class="gen-f"><b>الكلام</b><textarea data-g="text" rows="5" dir="auto" placeholder="اكتب الكلام اللي عايزه يتقال">${esc(d.text || "")}</textarea></label>
      <div class="gen-row"><label class="gen-f"><b>اللهجة / اللغة</b><select data-g="lang"><optgroup label="عربي">${opt("ar")}</optgroup><optgroup label="لغات تانية">${opt("foreign")}</optgroup></select></label>
        <label class="gen-f"><b>الصوت</b><select data-g="voice">${voices.map((v) => `<option value="${v}" ${v === d.voice ? "selected" : ""}>${esc(A.voices?.[v] || v)}</option>`).join("")}</select></label>
        <label class="gen-f"><b>الاسم (اختياري)</b><input data-g="name" value="${esc(d.name || "")}" placeholder="بيتحفظ بيه في مكتبة التعليق"></label></div>
      ${!A.fasih ? `<small class="muted">اللهجات العربية مش متاحة دلوقتي.</small>` : ""}`;
  }
  function imageForm() {
    const A = S.info, d = S.d;
    return `<label class="gen-f"><b>اوصف الصورة</b><textarea data-g="iprompt" rows="4" dir="auto" placeholder="مثلًا: كوباية قهوة على ترابيزة خشب جنب شباك، نور الصبح، تصوير منتج">${esc(d.iprompt || "")}</textarea></label>
      <div class="gen-row"><label class="gen-f"><b>الموديل</b><select data-g="imodel">${Object.entries(A.image_models).map(([k, m]) => `<option value="${k}" ${k === d.imodel ? "selected" : ""}>${esc(m.label)} · $${m.price}</option>`).join("")}</select></label>
        <label class="gen-f"><b>المقاس</b><select data-g="ratio">${A.ratios.map((r) => `<option ${r === d.ratio ? "selected" : ""}>${r}</option>`).join("")}</select></label>
        <label class="gen-f"><b>العدد</b><select data-g="count">${[1, 2, 3, 4].map((n) => `<option ${String(n) === String(d.count) ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
      <label class="gen-drop"><input type="file" accept="image/*" multiple data-gfile="refs" hidden>🖼️ صور مرجعية (اختياري، لحد ٤): منتجك أو شخصية أو ستايل <small class="muted" data-gnames="refs"></small></label>`;
  }
  function videoForm() {
    const A = S.info, d = S.d;
    const vratios = A.video_ratios || ["9:16", "16:9", "1:1"];
    if (!vratios.includes(d.ratio)) d.ratio = "9:16";
    return `<label class="gen-f"><b>اوصف الفيديو</b><textarea data-g="vprompt" rows="4" dir="auto" placeholder="مثلًا: كاميرا بتقرّب ببطء من كوباية قهوة والبخار طالع منها، والنور بيتحرك على الترابيزة">${esc(d.vprompt || "")}</textarea></label>
      <div class="gen-row"><label class="gen-f wide"><b>الموديل</b><select data-g="vmodel">${vmOptions(A.video_models, d.vmodel, Number(d.secs), d.res, `لـ ${d.secs} ث`)}</select></label></div>
      <div class="gen-row"><label class="gen-f"><b>المدة</b><select data-g="secs">${[3, 5, 8, 10, 12, 15].map((n) => `<option value="${n}" ${String(n) === String(d.secs) ? "selected" : ""}>${n} ثواني</option>`).join("")}</select></label>
        <label class="gen-f"><b>المقاس</b><select data-g="ratio">${vratios.map((r) => `<option ${r === d.ratio ? "selected" : ""}>${r}</option>`).join("")}</select></label>
        <label class="gen-f"><b>الجودة</b><select data-g="res"><option value="480p" ${d.res === "480p" ? "selected" : ""}>480p</option><option value="720p" ${d.res === "720p" ? "selected" : ""}>720p (الضعف)</option></select></label>
        <label class="gen-f chk"><input type="checkbox" data-g="audio" ${d.audio ? "checked" : ""}> بصوت</label></div>
      <label class="gen-drop"><input type="file" accept="image/*" data-gfile="image" hidden>🖼️ صورة البداية (اختياري) <small class="muted" data-gnames="image">من غيرها البرنامج بيرسم أول فريم من الوصف</small></label>`;
  }
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
    el.textContent = c == null ? (S.d.text ? `حوالي ${Math.max(1, Math.round(S.d.text.length / 14))} ثانية` : "") : `التكلفة حوالي $${c < 0.1 ? c.toFixed(3) : c.toFixed(2)}`;
  }

  // ---------------------------------------------------------------- التاريخ
  function card(g) {
    const media = g.status !== "done" ? `<div class="gen-ph">${g.status === "failed" ? "⚠️" : `<span class="flw-spin"></span>`}<small>${esc(g.step || (g.status === "failed" ? "وقف" : ""))}</small></div>`
      : g.kind === "image" ? `<a href="${esc(g.url)}" target="_blank" rel="noopener"><img src="${esc(g.url)}" alt="" loading="lazy"></a>`
      : g.kind === "video" ? `<video src="${esc(g.url)}" controls playsinline preload="metadata"></video>`
      : `<div class="gen-ph au"><audio src="${esc(g.url)}" controls preload="none"></audio></div>`;
    return `<figure class="gen-card ${g.kind} ${g.status}">${media}
      <figcaption><span dir="auto">${esc(g.prompt)}</span>${g.error ? `<small class="err">${esc(g.error)}</small>` : ""}
        <small class="muted">${g.kind === "video" ? `${esc((g.model_label || "").split(" · ")[0])} · ${g.duration || ""} ث` : g.kind === "voice" ? "اتحفظ في مكتبة التعليق" : esc(g.ratio || "")}${g.cost ? ` · $${g.cost}` : ""}</small>
        <span class="gen-acts">${g.url ? `<a class="flw-link" href="${esc(g.url)}" download>⬇️ نزّل</a>` : ""}<button type="button" class="flw-link" data-gdel="${esc(g.id)}">✕ امسح</button></span></figcaption></figure>`;
  }
  function render() {
    if (!S.el || !S.info) return;
    const form = { voice: voiceForm, image: imageForm, video: videoForm }[S.tab]();
    const list = S.list.filter((g) => g.kind === S.tab);
    const scroll = S.el.querySelector(".flw-main")?.scrollTop || 0;
    S.el.innerHTML = `<div class="flw-box" data-built>
      <header class="flw-head"><div class="flw-tpl"><small class="latin">Generate</small><b>مولّدات من غير قوالب</b></div>
        <nav class="gen-tabs">${Object.entries(TABS).map(([k, [ic, t]]) => `<button type="button" class="${k === S.tab ? "on" : ""}" data-gtab="${k}">${ic} ${t}</button>`).join("")}</nav>
        <div class="flw-hr"><button type="button" class="flw-x big" data-gclose aria-label="اقفل">✕</button></div></header>
      <main class="flw-main"><div class="gen-form">${form}
        <div class="flw-acts end"><small class="muted" data-gcost></small><button type="button" class="flw-btn pri big" data-ggo>${TABS[S.tab][0]} ولّد</button></div></div>
        <h3 class="gen-h">اللي اتولّد <small class="muted">${list.length}</small></h3>
        <div class="gen-grid">${list.map(card).join("") || `<div class="flw-empty">لسه مفيش. اللي هتولّده هيظهر هنا ويفضل محفوظ.</div>`}</div></main></div>`;
    S.el.querySelector(".flw-main").scrollTop = scroll;
    if (S.files) Object.entries(S.files).forEach(([k, fs]) => { const n = S.el.querySelector(`[data-gnames="${k}"]`); if (n && fs.length) n.textContent = [...fs].map((f) => f.name).join("، "); });
    costLine();
  }
  function poll() {
    clearTimeout(S.timer);
    if (!S.list.some((g) => g.status === "working")) return;
    S.timer = setTimeout(async () => {
      if (!S.el || S.el.hidden) return;
      try {
        S.list = await api("/api/gens");
        const busyUi = S.el.contains(document.activeElement) && document.activeElement.matches("input, textarea, select");
        const playing = [...S.el.querySelectorAll("video, audio")].some((m) => !m.paused);
        if (!busyUi && !playing) render();
      } catch { /* بيعيد المحاولة */ }
      poll();
    }, 3000);
  }

  // ---------------------------------------------------------------- الأحداث
  async function go() {
    const d = S.d;
    let res;
    try {
      if (S.tab === "voice") {
        if (!(d.text || "").trim()) return toast("اكتب الكلام", true);
        res = await api("/api/gens/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: d.text, lang: d.lang, voice: d.voice, name: d.name || "" }) });
      } else {
        const fd = new FormData();
        if (S.tab === "image") {
          if (!(d.iprompt || "").trim()) return toast("اوصف الصورة", true);
          fd.append("prompt", d.iprompt); fd.append("model", d.imodel); fd.append("ratio", d.ratio); fd.append("count", d.count);
          [...(S.files?.refs || [])].forEach((f) => fd.append("refs", f));
          res = await api("/api/gens/image", { method: "POST", body: fd });
        } else {
          if (!(d.vprompt || "").trim()) return toast("اوصف الفيديو", true);
          fd.append("prompt", d.vprompt); fd.append("model", d.vmodel); fd.append("duration", d.secs); fd.append("ratio", d.ratio);
          fd.append("resolution", d.res); fd.append("audio", d.audio ? "true" : "false");
          if (S.files?.image?.[0]) fd.append("image", S.files.image[0]);
          res = await api("/api/gens/video", { method: "POST", body: fd });
        }
      }
    } catch (err) { return toast(err.message, true); }
    S.list = [...(Array.isArray(res) ? res : [res]), ...S.list];
    S.files = {};
    toast("✨ بدأ، هتلاقيه تحت لما يخلص");
    render(); poll();
  }
  async function onClick(e) {
    const t = e.target, q = (s) => t.closest(s);
    let b;
    if (q("[data-gclose]")) return close();
    if ((b = q("[data-gtab]"))) { S.tab = b.dataset.gtab; S.files = {}; return render(); }
    if (q("[data-ggo]")) return go();
    if ((b = q("[data-gdel]"))) {
      if (!confirm("تمسحه؟")) return;
      try { await api(`/api/gens/${b.dataset.gdel}`, { method: "DELETE" }); S.list = S.list.filter((g) => g.id !== b.dataset.gdel); render(); } catch (err) { toast(err.message, true); }
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
