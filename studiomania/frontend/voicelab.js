// 🎧 مختبر الأصوات (لصاحب المنصة): نفس الجملة بكل مزوّد في كل لهجة جنب بعض، تقييم بالنجوم، وكلون صوت بين ElevenLabs و MiniMax.
// النتيجة النهائية = متوسط النجوم لكل مزوّد في كل لهجة، والأعلى في كل لهجة متعلّم.
const VoiceLab = (() => {
  const S = { el: null, d: null, tab: "cmp", dialect: "ar-sa-najdi", provs: null, text: "", timer: 0, all: false };
  const esc = (s) => escapeHtml(String(s ?? ""));
  const stars = (rid, i, v) => `<span class="vl-stars" role="group" aria-label="التقييم">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= v ? "on" : ""}" data-rate="${esc(rid)}:${i}:${n}" aria-label="${n} من 5">★</button>`).join("")}</span>`;

  async function load() {
    S.d = await api("/api/voicelab");
    if (!S.provs) S.provs = Object.keys(S.d.providers).filter((p) => S.d.ready[p]);
    if (!S.text) S.text = S.d.samples[S.dialect] || "";
    render();
    clearTimeout(S.timer);
    if (S.el && S.d.runs.some((r) => r.status === "working")) S.timer = setTimeout(load, 2000);
  }
  function runHTML(r) {
    const head = r.kind === "clone" ? `🧬 كلون · ${esc(S.d.dialects[r.dialect] || "")}` : esc(S.d.dialects[r.dialect] || r.dialect);
    return `<article class="vl-run"><header><b>${head}</b><small>${esc(r.text)}</small>
      ${r.sample ? `<audio controls preload="none" src="/media/voicelab/${esc(r.id)}/${esc(r.sample)}" title="العينة الأصلية"></audio>` : ""}
      <button type="button" class="vl-x" data-del="${esc(r.id)}" aria-label="احذف التجربة">✕</button></header>
      <div class="vl-clips">${r.clips.map((c, i) => `<div class="vl-clip ${c.status}"><p><b>${esc(c.provider_label)}</b><small>${esc(c.label)}${c.sec ? ` · ${c.sec} ث` : ""}</small></p>
        ${c.status === "done" ? `<audio controls preload="none" src="${esc(c.url)}"></audio>${stars(r.id, i, c.score || 0)}`
          : c.status === "failed" ? `<p class="vl-err">${esc(c.error || "ماكملش")}</p>` : `<p class="vl-wait">⏳ بيتولّد…</p>`}</div>`).join("")}</div></article>`;
  }
  function tableHTML() {
    const rows = S.d.table;
    if (!rows.length) return `<p class="hint">قيّم الأصوات بالنجوم في «المقارنة» و«الكلون»، والنتيجة هتظهر هنا: متوسط كل مزوّد في كل لهجة.</p>`;
    const groups = {};
    rows.forEach((r) => (groups[r.dialect] ||= []).push(r));
    return `<table class="vl-table"><thead><tr><th>اللهجة</th><th>الترتيب (متوسط النجوم · عدد التقييمات)</th></tr></thead><tbody>${Object.entries(groups).map(([d, xs]) =>
      `<tr><td>${esc(d === "clone" ? "🧬 كلون الصوت" : S.d.dialects[d] || d)}</td><td>${xs.map((r, k) => `<span class="vl-rank${k === 0 ? " best" : ""}">${k === 0 ? "🏆 " : ""}${esc(S.d.providers[r.provider] || r.provider)} <b>${r.avg}</b><small>(${r.n})</small></span>`).join("")}</td></tr>`).join("")}</tbody></table>`;
  }
  function render() {
    if (!S.el || !S.d) return;
    const D = S.d, P = Object.entries(D.providers);
    const tabs = [["cmp", "مقارنة اللهجات"], ["clone", "كلون الصوت"], ["res", "النتيجة"]];
    const body = S.tab === "res" ? tableHTML() : S.tab === "clone" ? `
      <p class="hint">ارفع عينة صوت واضحة (٣٠ ثانية لدقيقة كلام من غير موسيقى). هنعمل منها كلون بـ ElevenLabs و MiniMax، ويقولوا نفس الجملة.${!D.ready.eleven || !D.ready.minimax ? " محتاج مفتاح ElevenLabs و MiniMax المباشرين في «المفاتيح» (كلون ElevenLabs محتاج اشتراك Starter على الأقل)." : ""}</p>
      <label class="field">العينة <input type="file" accept="audio/*,video/*" id="vlSample"></label>
      <label class="field">اللهجة <select id="vlCloneDia">${Object.entries(D.dialects).map(([k, v]) => `<option value="${k}"${k === S.dialect ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
      <label class="field">الجملة اللي هيقولوها <textarea id="vlCloneText" rows="2">${esc(S.text)}</textarea></label>
      <button type="button" class="btn primary" id="vlCloneGo">🧬 اعمل الكلون وقارن</button>
      <div class="vl-runs">${D.runs.filter((r) => r.kind === "clone" || r.sample).map(runHTML).join("")}</div>` : `
      <p class="hint">نفس الجملة بكل مزوّد (صوتين من كل واحد). اسمع وقيّم بالنجوم، والنتيجة النهائية في تبويب «النتيجة».</p>
      <div class="vl-pills">${Object.entries(D.dialects).map(([k, v]) => `<button type="button" class="${k === S.dialect ? "on" : ""}" data-dia="${k}">${esc(v)}</button>`).join("")}</div>
      <label class="field">الجملة <textarea id="vlText" rows="2">${esc(S.text)}</textarea></label>
      <div class="vl-pills">${P.map(([k, v]) => `<button type="button" class="${S.provs.includes(k) ? "on" : ""}${D.ready[k] ? "" : " off"}" data-prov="${k}" title="${D.ready[k] ? "" : "محتاج مفتاحه في «المفاتيح»"}">${esc(v)}${D.ready[k] ? "" : " · بدون مفتاح"}</button>`).join("")}</div>
      <div class="row wrap"><button type="button" class="btn primary" id="vlGo">🎧 قارن في اللهجة دي</button>
        <button type="button" class="btn" id="vlAll" title="تجربة لكل لهجة عربي بالجملة النموذجية بتاعتها">🌍 قارن كل اللهجات</button></div>
      <div class="vl-runs">${D.runs.filter((r) => r.kind === "tts" && !r.sample).map(runHTML).join("")}</div>`;
    S.el.innerHTML = `<div class="vl-box" role="dialog" aria-modal="true" aria-label="مختبر الأصوات"><header class="vl-top"><h2>🎧 مختبر الأصوات</h2>
      <nav class="vl-tabs">${tabs.map(([k, t]) => `<button type="button" class="${S.tab === k ? "on" : ""}" data-tab="${k}">${t}</button>`).join("")}</nav>
      <button type="button" class="vl-x" data-close aria-label="اقفل">✕</button></header><div class="vl-body">${body}</div></div>`;
  }
  async function onClick(e) {
    const t = e.target, b = (sel) => t.closest(sel);
    if (t === S.el || b("[data-close]")) return close();
    if (b("[data-tab]")) { S.tab = b("[data-tab]").dataset.tab; return render(); }
    if (b("[data-dia]")) { S.dialect = b("[data-dia]").dataset.dia; S.text = S.d.samples[S.dialect] || ""; return render(); }
    if (b("[data-prov]")) { const k = b("[data-prov]").dataset.prov; S.provs = S.provs.includes(k) ? S.provs.filter((x) => x !== k) : [...S.provs, k]; return render(); }
    if (b("[data-rate]")) { const [rid, i, n] = b("[data-rate]").dataset.rate.split(":"); await api(`/api/voicelab/runs/${rid}/rate`, { method: "POST", ...jsonBody({ clip: +i, score: +n }) }).catch((err) => toast(err.message, true)); return load(); }
    if (b("[data-del]")) { if (await uiConfirm("تحذف التجربة دي؟")) { await api(`/api/voicelab/runs/${b("[data-del]").dataset.del}`, { method: "DELETE" }); load(); } return; }
    try {
      if (b("#vlGo")) {
        S.text = S.el.querySelector("#vlText").value.trim();
        await api("/api/voicelab/run", { method: "POST", ...jsonBody({ dialect: S.dialect, text: S.text, providers: S.provs }) });
        return load();
      }
      if (b("#vlAll")) {
        if (!(await uiConfirm(`هنجرب ${Object.keys(S.d.dialects).length} لهجة × المزودين المختارين بالجملة النموذجية لكل لهجة. التكلفة على حساب المنصة (قروش قليلة لكل صوت). نكمل؟`))) return;
        for (const k of Object.keys(S.d.dialects)) await api("/api/voicelab/run", { method: "POST", ...jsonBody({ dialect: k, text: "", providers: S.provs }) }).catch((err) => toast(err.message, true));
        return load();
      }
      if (b("#vlCloneGo")) {
        const f = S.el.querySelector("#vlSample").files[0];
        if (!f) return toast("اختار ملف العينة الأول", true);
        const fd = new FormData();
        fd.append("file", f); fd.append("text", S.el.querySelector("#vlCloneText").value.trim()); fd.append("dialect", S.el.querySelector("#vlCloneDia").value);
        toast("⏳ بيرفع العينة ويعمل الكلون…");
        await api("/api/voicelab/clone", { method: "POST", body: fd });
        return load();
      }
    } catch (err) { toast(err.message, true); }
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  function open() {
    if (S.el) return;
    S.el = document.createElement("div");
    S.el.className = "vl-ov";
    document.body.appendChild(S.el);
    S.el.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    S.el.innerHTML = `<div class="vl-box"><p class="hint">جارٍ التحميل…</p></div>`;
    load().catch((err) => { toast(err.message, true); close(); });
  }
  function close() {
    clearTimeout(S.timer);
    document.removeEventListener("keydown", onKey);
    S.el?.remove();
    S.el = null;
  }
  return { open };
})();
document.getElementById("openVoiceLab")?.addEventListener("click", () => VoiceLab.open());
