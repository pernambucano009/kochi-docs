// 🎧 مختبر الأصوات (لصاحب المنصة): نفس الجملة بكل مزوّد في كل لهجة جنب بعض، تقييم بالنجوم، وكلون صوت بين ElevenLabs و MiniMax.
// النتيجة النهائية = متوسط النجوم لكل مزوّد في كل لهجة، والأعلى في كل لهجة متعلّم.
const VoiceLab = (() => {
  const S = { el: null, d: null, tab: "cmp", dialect: "ar-sa-najdi", provs: null, text: "", timer: 0, all: false, texts: null, dirty: new Set(), review: false };
  const esc = (s) => escapeHtml(String(s ?? ""));
  // 📝 ملاحظتك على الصوت ده: بتتحفظ وانت بتكتب، وبتطلع في «انسخ النتايج» جنب النجوم
  const noteBox = (rid, i, v) => `<textarea class="vl-note" rows="2" dir="auto" data-note="${esc(rid)}:${i}" placeholder="📝 ملاحظاتك على هذا الصوت (النطق، اللهجة، الإحساس، السرعة…)">${esc(v || "")}</textarea>`;
  const stars = (rid, i, v) => `<span class="vl-stars" role="group" aria-label="التقييم">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="${n <= v ? "on" : ""}" data-rate="${esc(rid)}:${i}:${n}" aria-label="${n} من 5">★</button>`).join("")}</span>`;

  async function load() {
    S.d = await api("/api/voicelab");
    if (!S.provs) S.provs = Object.keys(S.d.providers).filter((p) => S.d.ready[p]);
    if (!S.text) S.text = S.d.samples[S.dialect] || "";
    // قطعة كل لهجة: اللي على السيرفر، من غير ما نمسح اللي لسه بتعدّله
    S.texts = Object.assign({}, S.d.samples, Object.fromEntries([...S.dirty].map((k) => [k, S.texts?.[k] ?? ""])));
    // وهو شغّال بنحدّث الكروت اللي اتغيرت بس: السكرول والصوت اللي بيشتغل والكلام اللي بتكتبه يفضلوا زي ما هم
    if (!patchRuns()) render();
    clearTimeout(S.timer);
    if (S.el && S.d.runs.some((r) => r.status === "working")) S.timer = setTimeout(load, 2000);
  }
  function runHTML(r) {
    const head = r.kind === "clone" ? `🧬 كلون · ${esc(S.d.dialects[r.dialect] || "")}` : r.kind === "dub" ? "🌍 دبلجة فيديو" : esc(S.d.dialects[r.dialect] || r.dialect);
    return `<article class="vl-run" data-run="${esc(r.id)}"><header><b>${head}</b><small>${esc(r.text)}</small>
      ${r.sample ? `<audio controls preload="metadata" src="/media/voicelab/${esc(r.id)}/${esc(r.sample)}" title="العينة الأصلية"></audio>` : ""}
      ${r.clips.some((c) => c.status === "failed" && !c.skip) && r.status !== "working" ? `<button type="button" class="btn sm" data-retry="${esc(r.id)}" title="إعادة توليد الأصوات التي فشلت فقط">🔁 أعد ما فشل</button>` : ""}
      <button type="button" class="vl-x" data-del="${esc(r.id)}" aria-label="احذف التجربة">✕</button></header>
      <div class="vl-clips">${r.clips.map((c, i) => `<div class="vl-clip ${c.status}" data-sig="${esc([c.status, c.score || 0, c.url || "", c.error || ""].join("|"))}"><p><b>${esc(c.provider_label)}</b><small>${esc(c.label)}${c.sec ? ` · ${c.sec} ث` : ""}</small></p>
        ${c.status === "done" ? `${/\.mp4$/.test(c.url || "") ? `<video controls preload="metadata" playsinline src="${esc(c.url)}"></video>` : `<audio controls preload="metadata" src="${esc(c.url)}"></audio>`}${stars(r.id, i, c.score || 0)}${noteBox(r.id, i, c.note)}`
          : c.status === "manual" ? stars(r.id, i, c.score || 0) + noteBox(r.id, i, c.note)
          : c.status === "failed" ? `<p class="vl-err">${esc(c.error || "لم يكتمل")}</p>` : `<p class="vl-wait">⏳ جارٍ التوليد…</p>`}</div>`).join("")}</div></article>`;
  }
  function expHTML() {
    const failed = S.d.runs.reduce((a, r) => a + r.clips.filter((c) => c.status === "failed" && !c.skip).length, 0);
    const exp = `<div class="vl-expbox">
      <div class="row wrap vl-exp"><label class="field inline">اللهجة <select id="vlExpDia"><option value="">كل اللهجات</option>${Object.entries(S.d.dialects).map(([k, v]) => `<option value="${k}"${k === S.expDia ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label></div>
      <div class="row wrap vl-exp">
        <button type="button" class="btn primary" id="vlZip" title="كل الأصوات (مجلد لكل لهجة) ومعها التقرير بنجومك وملاحظاتك وما فشل وسببه">⬇️ نزّل الأصوات مع التقرير (zip)</button>
        <button type="button" class="btn" id="vlZipBlind" title="الأصوات بأرقام فقط دون أسماء المزوّدين، ومعها ورقة تقييم: أرسلها لأهل اللهجة">🎧 نسخة للمقيّمين من أهل اللهجة</button>
        <button type="button" class="btn" id="vlCopy">📋 انسخ التقرير</button>
        ${failed ? `<button type="button" class="btn" id="vlRetryAll">🔁 أعد كل ما فشل (${failed})</button>` : ""}</div>
      <small class="hint">أسماء الملفات في نسخة المقيّمين أرقام مثل «A1B2-3»، والرقم نفسه موجود في تقريرك بجانب اسم المزوّد. عندما يعيد المقيّمون الورقة، أرسلها هنا مع التقرير.</small></div>`;
    return exp;
  }
  function tableHTML() {
    const rows = S.d.table, exp = expHTML();
    if (!rows.length) return `${exp}<p class="hint">قيّم الأصوات بالنجوم واكتب ملاحظاتك في «المقارنة» و«الكلون»، وستظهر النتيجة هنا: متوسط كل مزوّد في كل لهجة.</p>`;
    const groups = {};
    rows.forEach((r) => (groups[r.dialect] ||= []).push(r));
    return `${exp}<table class="vl-table"><thead><tr><th>اللهجة</th><th>الترتيب (متوسط النجوم · عدد التقييمات)</th></tr></thead><tbody>${Object.entries(groups).map(([d, xs]) =>
      `<tr><td>${esc(d === "clone" ? "🧬 كلون الصوت" : d === "dub" ? "🌍 دبلجة فيديو" : S.d.dialects[d] || d)}</td><td>${xs.map((r, k) => `<span class="vl-rank${k === 0 ? " best" : ""}">${k === 0 ? "🏆 " : ""}${esc((S.d.labels || S.d.providers)[r.provider] || r.provider)} <b>${r.avg}</b><small>(${r.n})</small></span>`).join("")}</td></tr>`).join("")}</tbody></table>`;
  }
  function render() {
    if (!S.el || !S.d) return;
    const D = S.d, P = Object.entries(D.providers);
    const tabs = [["cmp", "مقارنة اللهجات"], ["clone", "كلون الصوت"], ["dub", "الدبلجة"], ["res", "النتيجة"]];
    const body = S.tab === "res" ? tableHTML() : S.tab === "dub" ? `
      <p class="hint">ارفع فيديو قصيرًا (حتى ٥ دقائق). سيدبلجه ElevenLabs إلى العربية بصوت المتحدث نفسه، وفي الوقت نفسه تُنشأ نسخة في «الترجمة والدبلجة» تكملها بالأصوات العربية باللهجة التي تختارها. قيّم الاثنين هنا بالنجوم.${D.ready.eleven ? "" : " يحتاج مفتاح ElevenLabs المباشر بصلاحية Dubbing في «المفاتيح»."}</p>
      <label class="field">الفيديو <input type="file" accept="video/*" id="vlDubFile"></label>
      <button type="button" class="btn primary" id="vlDubGo">🌍 ابدأ المقارنة</button>
      <div class="vl-runs">${tabRuns().map(runHTML).join("")}</div>` : S.tab === "clone" ? `
      <p class="hint">ارفع عينة صوت واضحة (من ٣٠ ثانية إلى دقيقة كلام دون موسيقى). سننشئ منها نسخة صوتية في ElevenLabs و MiniMax، ويقولان الجملة نفسها.${!D.ready.eleven || !D.ready.minimax ? " يحتاج مفتاحي ElevenLabs و MiniMax المباشرين في «المفاتيح» (الكلون في ElevenLabs يحتاج اشتراك Starter على الأقل)." : ""}</p>
      <label class="field">العينة <input type="file" accept="audio/*,video/*" id="vlSample"></label>
      <label class="field">اللهجة <select id="vlCloneDia">${Object.entries(D.dialects).map(([k, v]) => `<option value="${k}"${k === S.dialect ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
      <label class="field">الجملة التي سيقولونها <textarea id="vlCloneText" rows="2">${esc(S.text)}</textarea></label>
      <button type="button" class="btn primary" id="vlCloneGo">🧬 أنشئ الكلون وقارن</button>
      <div class="vl-runs">${tabRuns().map(runHTML).join("")}</div>` : `
${S.review ? reviewHTML() : `
      <p class="hint">لكل لهجة قطعة. راجعها وعدّلها إن أردت، وكل مزوّد يقولها بصوتين. المزوّد الذي لا يدعم اللهجة يظهر مقفلًا فيها. استمع وقيّم بالنجوم، والنتيجة النهائية في تبويب «النتيجة».</p>
      <div class="vl-pills">${Object.entries(D.dialects).map(([k, v]) => `<button type="button" class="${k === S.dialect ? "on" : ""}" data-dia="${k}">${esc(v)}${S.dirty.has(k) || (D.defaults[k] && S.texts[k] !== D.defaults[k]) ? " ✎" : ""}</button>`).join("")}</div>
      ${textBox(S.dialect, 6)}
      <div class="vl-pills">${provPills(S.dialect)}</div>
      <div class="row wrap"><button type="button" class="btn primary" id="vlGo">🎧 قارن في هذه اللهجة</button>
        <button type="button" class="btn" id="vlReview" title="راجع قطع كل اللهجات أولًا، ثم قارن الكل مرة واحدة">📝 راجع كل القطع وقارن كل اللهجات</button></div>
      <div class="vl-runs">${tabRuns().map(runHTML).join("")}</div>`}`;
    const top = S.el.querySelector(".vl-box")?.scrollTop || 0, same = S.shown === shownKey();
    S.shown = shownKey();
    S.el.innerHTML = `<div class="vl-box" role="dialog" aria-modal="true" aria-label="مختبر الأصوات"><header class="vl-top"><h2>🎧 مختبر الأصوات</h2>
      <nav class="vl-tabs">${tabs.map(([k, t]) => `<button type="button" class="${S.tab === k ? "on" : ""}" data-tab="${k}">${t}</button>`).join("")}</nav>
      <button type="button" class="vl-x" data-close aria-label="أغلق">✕</button></header><div class="vl-body">${S.tab === "res" ? "" : expHTML()}${body}</div></div>`;
    if (same) S.el.querySelector(".vl-box").scrollTop = top;
  }
  const shownKey = () => S.tab + (S.tab === "cmp" && S.review ? ":review" : "");
  const supports = (k, p) => !!S.d.support?.[k]?.[p];
  // مربع قطعة اللهجة: بيتحفظ لما تخرج منه، وزرار يرجّعها للأصلية
  function textBox(k, rows) {
    const t = S.texts[k] || "", def = S.d.defaults[k] || "";
    return `<label class="field">قطعة ${esc(S.d.dialects[k])} <textarea data-text="${k}" rows="${rows}">${esc(t)}</textarea></label>
      <div class="row wrap vl-tmeta"><small>${t.length} حرف</small>${def && t !== def ? `<button type="button" class="btn ghost" data-reset="${k}">↺ أعد القطعة الأصلية</button>` : ""}</div>`;
  }
  function provPills(k) {
    return Object.entries(S.d.providers).map(([p, v]) => {
      const ok = supports(k, p), ready = S.d.ready[p];
      const why = !ok ? "لا يدعم هذه اللهجة" : !ready ? "يحتاج مفتاحه في «المفاتيح»" : "";
      return `<button type="button" class="${S.provs.includes(p) && ok ? "on" : ""}${ready && ok ? "" : " off"}" data-prov="${p}"${ok ? "" : " disabled aria-disabled=\"true\""} title="${why}">${ok ? "" : "🔒 "}${esc(v)}${why ? ` · ${why}` : ""}</button>`;
    }).join("");
  }
  // المراجعة: كل القطع تحت بعض، وتحت كل واحدة المزودين اللي بيدعموها، وفي الآخر «قارن كل اللهجات»
  function reviewHTML() {
    const D = S.d, ks = Object.keys(D.dialects);
    const n = ks.reduce((a, k) => a + (S.provs.some((p) => supports(k, p)) ? 1 : 0), 0);
    return `<div class="vl-review"><div class="row wrap"><button type="button" class="btn ghost" id="vlReviewBack">→ رجوع</button>
        <p class="hint" style="margin:0">راجع قطعة كل لهجة وعدّلها أو اتركها كما هي. المزوّدون المختارون: ${S.provs.map((p) => esc(D.providers[p])).join("، ") || "لا أحد"}. المزوّد الذي لا يدعم لهجة لن يُجرَّب فيها.</p></div>
      ${ks.map((k) => `<section class="vl-rv">${textBox(k, 4)}<div class="vl-pills vl-mini">${Object.entries(D.providers).filter(([p]) => S.provs.includes(p)).map(([p, v]) => `<span class="${supports(k, p) ? "on" : "off"}">${supports(k, p) ? "" : "🔒 "}${esc(v)}</span>`).join("")}</div></section>`).join("")}
      <div class="row wrap"><button type="button" class="btn primary" id="vlAll">🌍 قارن كل اللهجات (${n} لهجة)</button></div></div>`;
  }
  // بنحفظ القطع اللي اتعدلت على السيرفر
  async function saveTexts(keys) {
    for (const k of keys) {
      const r = await api("/api/voicelab/texts", { method: "POST", ...jsonBody({ dialect: k, text: S.texts[k] || "" }) });
      S.texts[k] = r.text; S.d.samples[k] = r.text; S.dirty.delete(k);
    }
  }
  function tabRuns() {
    const R = S.d.runs;
    if (S.tab === "dub") return R.filter((r) => r.kind === "dub");
    if (S.tab === "clone") return R.filter((r) => r.kind === "clone" || (r.sample && r.kind !== "dub"));
    return R.filter((r) => r.kind === "tts" && !r.sample && !r.source);
  }
  // بيبدّل الكروت اللي حالتها اتغيرت بس، من غير ما يرسم الشاشة من الأول
  function patchRuns() {
    const box = S.el?.querySelector(".vl-runs");
    if (S.el?.querySelector(".vl-review") && S.shown === shownKey()) return true;   // المراجعة مفيهاش كروت، ومنرسمش فوق اللي بتكتبه
    if (!box || S.tab === "res" || S.shown !== shownKey()) return false;
    const tmp = document.createElement("div");
    tmp.innerHTML = tabRuns().map(runHTML).join("");
    const fresh = [...tmp.children], old = [...box.children];
    const ids = (xs) => xs.map((a) => a.dataset.run).join(",");
    if (ids(fresh) !== ids(old)) {
      // تجربة جديدة اتضافت أو اتمسحت: نبدّل اللي اتغير بس ونسيب الباقي في مكانه
      const keep = new Map(old.map((a) => [a.dataset.run, a]));
      box.replaceChildren(...fresh.map((a) => keep.get(a.dataset.run) || a));
    }
    const cur = new Map([...box.children].map((a) => [a.dataset.run, a]));
    fresh.forEach((a) => {
      const o = cur.get(a.dataset.run);
      if (!o || o === a) return;
      const oc = o.querySelectorAll(".vl-clip");
      a.querySelectorAll(".vl-clip").forEach((c, j) => { if (oc[j] && oc[j].dataset.sig !== c.dataset.sig) oc[j].replaceWith(c); });
    });
    return true;
  }
  const noteT = {}, pending = new Set();
  function saveNote(el) {
    const [rid, i] = el.dataset.note.split(":");
    clearTimeout(noteT[el.dataset.note]);
    pending.delete(el);
    const c = S.d?.runs.find((r) => r.id === rid)?.clips[+i];
    if (c) c.note = el.value;   // لو الشاشة اترسمت تاني قبل التحميل الجاي: الملاحظة تفضل زي ما كتبتها
    return api(`/api/voicelab/runs/${rid}/note`, { method: "POST", ...jsonBody({ clip: +i, note: el.value }) })
      .then(() => { el.classList.add("saved"); setTimeout(() => el.classList.remove("saved"), 1200); })
      .catch((err) => toast(err.message, true));
  }
  function onInput(e) {
    if (e.target.dataset?.note) { const el = e.target; pending.add(el); clearTimeout(noteT[el.dataset.note]); noteT[el.dataset.note] = setTimeout(() => saveNote(el), 900); return; }
    if (e.target.id === "vlCloneText") S.text = e.target.value;
    const k = e.target.dataset?.text;
    if (k) {
      S.texts[k] = e.target.value; S.dirty.add(k);
      const meta = e.target.closest(".field")?.nextElementSibling?.querySelector("small");
      if (meta) meta.textContent = `${e.target.value.length} حرف`;
    }
  }
  function onChange(e) {
    if (e.target.dataset?.note) return saveNote(e.target);
    if (e.target.id === "vlExpDia") { S.expDia = e.target.value; return render(); }
    const k = e.target.dataset?.text;
    if (k && S.dirty.has(k)) saveTexts([k]).catch((err) => toast(err.message, true));
  }
  async function onClick(e) {
    const t = e.target, b = (sel) => t.closest(sel);
    if (t === S.el || b("[data-close]")) return close();
    if (b("[data-tab]")) { S.tab = b("[data-tab]").dataset.tab; return render(); }
    if (b("[data-dia]")) { S.dialect = b("[data-dia]").dataset.dia; return render(); }
    if (b("[data-reset]")) { const k = b("[data-reset]").dataset.reset; S.texts[k] = S.d.defaults[k]; S.dirty.add(k); await saveTexts([k]).catch((err) => toast(err.message, true)); return render(); }
    if (b("#vlReview")) { S.review = true; return render(); }
    if (b("#vlReviewBack")) { S.review = false; return render(); }
    if (b("[data-prov]")?.disabled) return;
    if (b("[data-prov]")) { const k = b("[data-prov]").dataset.prov; S.provs = S.provs.includes(k) ? S.provs.filter((x) => x !== k) : [...S.provs, k]; return render(); }
    if (b("[data-rate]")) await Promise.all([...pending].map(saveNote));   // الملاحظة اللي لسه بتتكتب تتحفظ قبل ما الكارت يتحدّث
    if (b("[data-rate]")) { const [rid, i, n] = b("[data-rate]").dataset.rate.split(":"); await api(`/api/voicelab/runs/${rid}/rate`, { method: "POST", ...jsonBody({ clip: +i, score: +n }) }).catch((err) => toast(err.message, true)); return load(); }
    if (b("#vlCopy")) {
      try {
        const { text } = await api(`/api/voicelab/report?dialect=${encodeURIComponent(S.expDia || "")}`);
        await navigator.clipboard.writeText(text); toast("✓ نُسخ التقرير، الصقه في المحادثة");
      } catch (err) { toast(err.message, true); }
      return;
    }
    if (b("#vlZip") || b("#vlZipBlind")) {
      const blind = !!b("#vlZipBlind"), btn = b("#vlZip") || b("#vlZipBlind");
      btn.disabled = true;
      try {
        const r = await fetch(`/api/voicelab/export?blind=${blind}&dialect=${encodeURIComponent(S.expDia || "")}`);
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `خطأ ${r.status}`);
        const cd = r.headers.get("content-disposition") || "";
        const name = decodeURIComponent(cd.match(/filename\*=utf-8''([^;]+)/i)?.[1] || cd.match(/filename="?([^";]+)/i)?.[1] || "") || "voicelab.zip";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(await r.blob()); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      } catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
      return;
    }
    if (b("[data-retry]") || b("#vlRetryAll")) {
      const one = b("[data-retry]")?.dataset.retry;
      try {
        await api(one ? `/api/voicelab/runs/${one}/retry` : "/api/voicelab/retry-failed", { method: "POST" });
        toast("🔁 جارٍ إعادة الأصوات التي فشلت…");
      } catch (err) { toast(err.message, true); }
      return load();
    }
    if (b("[data-del]")) { if (await uiConfirm("هل تحذف هذه التجربة؟")) { await api(`/api/voicelab/runs/${b("[data-del]").dataset.del}`, { method: "DELETE" }); load(); } return; }
    try {
      if (b("#vlGo")) {
        const k = S.dialect, provs = S.provs.filter((p) => supports(k, p));
        if (!provs.length) return toast("لا يوجد مزوّد ممن اخترتهم يدعم هذه اللهجة", true);
        await saveTexts([...S.dirty]);
        await api("/api/voicelab/run", { method: "POST", ...jsonBody({ dialect: k, text: (S.texts[k] || "").trim(), providers: provs }) });
        return load();
      }
      if (b("#vlAll")) {
        const jobs = Object.keys(S.d.dialects).map((k) => [k, S.provs.filter((p) => supports(k, p))]).filter(([, ps]) => ps.length);
        const voices = jobs.reduce((a, [, ps]) => a + ps.length * 2, 0);
        if (!jobs.length) return toast("لا يوجد مزوّد مختار يدعم أي لهجة", true);
        if (!(await uiConfirm(`سنجرّب ${jobs.length} لهجة بالقطع التي راجعتها، كل لهجة بالمزوّدين الذين يدعمونها فقط (نحو ${voices} صوت). التكلفة على حساب المنصة. هل نكمل؟`))) return;
        await saveTexts([...S.dirty]);
        for (const [k, ps] of jobs) await api("/api/voicelab/run", { method: "POST", ...jsonBody({ dialect: k, text: (S.texts[k] || "").trim(), providers: ps }) }).catch((err) => toast(`${S.d.dialects[k]}: ${err.message}`, true));
        S.review = false;
        render();
        return load();
      }
      if (b("#vlDubGo")) {
        const f = S.el.querySelector("#vlDubFile").files[0];
        if (!f) return toast("اختر الفيديو أولًا", true);
        const fd = new FormData();
        fd.append("file", f);
        toast("⏳ جارٍ رفع الفيديو وبدء الدبلجة… قد يستغرق ذلك بضع دقائق");
        await api("/api/voicelab/dub", { method: "POST", body: fd });
        return load();
      }
      if (b("#vlCloneGo")) {
        const f = S.el.querySelector("#vlSample").files[0];
        if (!f) return toast("اختر ملف العينة أولًا", true);
        const fd = new FormData();
        fd.append("file", f); fd.append("text", S.el.querySelector("#vlCloneText").value.trim()); fd.append("dialect", S.el.querySelector("#vlCloneDia").value);
        toast("⏳ جارٍ رفع العينة وإنشاء الكلون…");
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
    S.el.addEventListener("input", onInput);
    S.el.addEventListener("change", onChange);
    document.addEventListener("keydown", onKey);
    S.el.innerHTML = `<div class="vl-box"><p class="hint">جارٍ التحميل…</p></div>`;
    load().catch((err) => { toast(err.message, true); close(); });
  }
  function close() {
    clearTimeout(S.timer);
    document.removeEventListener("keydown", onKey);
    S.el?.remove();
    S.el = null;
    S.shown = null;
  }
  return { open };
})();
document.getElementById("openVoiceLab")?.addEventListener("click", () => VoiceLab.open());
