// 💡 فولدر الأفكار (تاب في «مكتبة محتويات البراند»): أفكارك انت، كتابة أو فويس نوت (تسجيل أو ملف) أو لينك فيديو/بوست.
// كل فكرة بتظهرلك وانت بتختار الفكرة في أي مشروع جديد. «✨ نقّح» بيخلّي الذكاء الصناعي يرتّب الكلام، ولو مادستش بتفضل زي ما هي.
// «📝 نسّق كسكريبت» بيكتبها كلام يتقال ومعاه سندات (آيات، أحاديث، كتب، دراسات) في مكانها لو موجودة فعلًا، والسكريبت ده بيتقال زي ما هو في المشروع.
const IdeasPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], timer: null, rec: null, clip: null, edit: null, busy: {} };
  const html = () => `<div class="nb-wrap id-wrap" id="idWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const ago = (t) => { try { return new Date(t).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" }); } catch { return ""; } };

  function card(x) {
    if (S.edit === x.id) {
      return `<article class="id-card on" data-iid="${esc(x.id)}">
        <input class="id-in" data-ie="title" value="${esc(x.title)}" placeholder="عنوان الفكرة">
        <textarea class="id-in" rows="4" data-ie="text" placeholder="الفكرة">${esc(x.text)}</textarea>
        <input class="id-in" data-ie="url" dir="ltr" value="${esc(x.url)}" placeholder="https://… رابط فيديو أو منشور (اختياري)">
        <div class="id-acts"><button type="button" class="nb-btn fs-go" data-isave>✓ احفظ</button><button type="button" class="nb-btn" data-icancel>إلغاء</button></div></article>`;
    }
    const busy = x.status === "transcribing", pol = S.busy[x.id];
    return `<article class="id-card" data-iid="${esc(x.id)}">
      <div class="id-h"><b>${esc(x.title || "فكرة")}</b><small class="muted">${x.polished ? "✨ متنقّحة · " : ""}${x.used_at ? "✓ اتستخدمت · " : ""}${ago(x.at)}</small></div>
      ${x.hook ? `<p class="id-hook">«${esc(x.hook)}»</p>` : ""}
      ${busy ? `<p class="muted">⏳ جارٍ الكتابة الفويس نوت نص…</p>` : x.script ? "" : x.text ? `<p class="id-t">${esc(x.text)}</p>` : ""}
      ${x.script ? `<div class="id-script"><small class="muted">📝 النص</small><p>${esc(x.script)}</p></div>` : ""}
      ${(x.sources || []).length ? `<div class="id-src"><small class="muted">📚 السندات</small><ul>${x.sources.map((r) => `<li><b>${esc(r.label)}</b> ${esc(r.ref)}${r.where ? ` <small class="muted">· ${esc(r.where)}</small>` : ""}</li>`).join("")}</ul></div>` : ""}
      ${x.script && x.dropped ? `<p class="muted id-drop">شلنا ${x.dropped} سند لم نتمكن نتأكد أنه موجود هذا بالنص.</p>` : ""}
      ${x.audio_url ? `<audio src="${esc(x.audio_url)}" controls preload="none"></audio>` : ""}
      ${x.url ? `<a class="id-link" href="${esc(x.url)}" target="_blank" rel="noopener" dir="ltr">🔗 ${esc(x.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>` : ""}
      ${x.error ? `<p class="fs-err">⚠️ ${esc(x.error)}</p>` : ""}
      <div class="id-acts">
        <button type="button" class="nb-btn fs-go" data-ipolish ${busy || pol ? "disabled" : ""} title="الذكاء الاصطناعي يرتّب النص ويظبطه (يُخصم من الرصيد)">${pol === true ? "⏳ ينقّح…" : "✨ نقّح"}</button>
        <button type="button" class="nb-btn" data-iscript ${busy || pol ? "disabled" : ""} title="يكتبها نص يُقال، ويضع سندات حقيقية في مكانها إذا موجودة (يُخصم من الرصيد)">${pol === "script" ? "⏳ ينسّق…" : x.script ? "📝 نسّق مرة أخرى" : "📝 نسّق كسكريبت"}</button>
        ${x.polished ? `<button type="button" class="nb-btn" data-irevert>↩ أعدها كما كتبتها</button>` : ""}
        <button type="button" class="nb-btn" data-iedit ${busy ? "disabled" : ""}>✏️ عدّل</button>
        <button type="button" class="nb-btn danger" data-idel>🗑 احذف</button></div></article>`;
  }
  function render() {
    const w = S.el;
    if (!w) return;
    const recOn = !!S.rec;
    w.innerHTML = `<section class="fs-hero"><div class="fs-hero-t"><b>الأفكار</b><span class="latin">IDEAS</span></div>
        <p>ضع هنا أي فكرة تأتي في بالك: اكتبها، أو سجّلها بصوتك، أو ضع رابط فيديو أو منشور يعجبك. هذه الأفكار تظهرلك وأنت تختار الفكرة في أي مشروع جديد إذا حابب تستخدمها. وإذا تريد الذكاء الاصطناعي يرتّبلك النص، اضغط «✨ نقّح»، وإذا تريدها نص جاهز بسنداته (آيات، كتب، دراسات) اضغط «📝 نسّق كسكريبت».</p>
        <div class="cm-stats"><span><b class="num">${S.list.length}</b> فكرة</span></div></section>
      <section class="id-new">
        <textarea class="id-in" rows="3" data-inew="text" placeholder="اكتب فكرتك… مثلًا: فيديو يوري ٣ غلطات الأشخاص تعملها في…"></textarea>
        <input class="id-in" data-inew="url" dir="ltr" placeholder="https://… رابط فيديو أو منشور (اختياري)">
        <div class="id-acts">
          <button type="button" class="nb-btn${recOn ? " danger" : ""}" data-irec>${recOn ? `⏹ أوقف التسجيل <span class="num" data-irect>0:00</span>` : "🎙️ سجّل بصوتك"}</button>
          <label class="nb-btn">⬆ ارفع فويس نوت<input type="file" accept="audio/*,video/*" data-ifile hidden></label>
          ${S.clip ? `<span class="id-clip">🎧 ${esc(S.clip.name)} <button type="button" class="nb-btn sm" data-iclip>✕</button></span>` : ""}
          <button type="button" class="nb-btn fs-go" data-iadd>＋ أضف الفكرة</button></div>
      </section>
      <div class="id-list">${S.list.map(card).join("") || `<div class="nh-empty">لا يوجد بعد أفكار. أضف أول فكرة أعلى.</div>`}</div>`;
  }
  async function load() { S.list = await api("/api/my-ideas"); }
  function poll() {
    clearTimeout(S.timer);
    if (!S.list.some((x) => x.status === "transcribing")) return;
    S.timer = setTimeout(async () => { try { await load(); if (!S.edit) render(); } catch { /* */ } poll(); }, 3000);
  }
  async function recToggle() {
    if (S.rec) { S.rec.mr.stop(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast("تعذّر الوصول للمايك. اسمح للمتصفح يستخدمه", true); }
    const chunks = [], mr = new MediaRecorder(stream);
    const t0 = Date.now();
    S.rec = { mr, timer: setInterval(() => { const s = Math.round((Date.now() - t0) / 1000), el = S.el?.querySelector("[data-irect]"); if (el) el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }, 500) };
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      clearInterval(S.rec?.timer); S.rec = null; stream.getTracks().forEach((t) => t.stop());
      const type = mr.mimeType || "audio/webm";
      S.clip = new File(chunks, `فكرة-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${type.includes("mp4") ? "m4a" : "webm"}`, { type });
      keepDraft(); render(); restoreDraft();
    };
    mr.start();
    keepDraft(); render(); restoreDraft();
  }
  // اللي مكتوب في خانة الفكرة الجديدة مايضيعش لما الصفحة تترسم تاني
  let draft = {};
  const keepDraft = () => { S.el?.querySelectorAll("[data-inew]").forEach((el) => { draft[el.dataset.inew] = el.value; }); };
  const restoreDraft = () => { S.el?.querySelectorAll("[data-inew]").forEach((el) => { el.value = draft[el.dataset.inew] || ""; }); };
  function bind(w) {
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s), c = e.target.closest("[data-iid]"), id = c?.dataset.iid;
      try {
        if (q("[data-irec]")) return recToggle();
        if (q("[data-iclip]")) { keepDraft(); S.clip = null; render(); return restoreDraft(); }
        if (q("[data-iadd]")) {
          keepDraft();
          const fd = new FormData();
          fd.append("text", draft.text || ""); fd.append("url", draft.url || "");
          if (S.clip) fd.append("file", S.clip);
          if (!(draft.text || "").trim() && !(draft.url || "").trim() && !S.clip) return toast("اكتب الفكرة، أو سجّلها بصوتك، أو ضع رابط", true);
          S.list = await api("/api/my-ideas", { method: "POST", body: fd });
          draft = {}; S.clip = null; render(); poll();
          return toast("💡 الفكرة حُفظت، وستظهرلك وأنت تعمل مشروع جديد");
        }
        if (!id) return;
        if (q("[data-iedit]")) { S.edit = id; return render(); }
        if (q("[data-icancel]")) { S.edit = null; return render(); }
        if (q("[data-isave]")) {
          const v = (k) => c.querySelector(`[data-ie="${k}"]`).value;
          S.list = await api(`/api/my-ideas/${id}`, { method: "PATCH", ...jsonBody({ title: v("title"), text: v("text"), url: v("url") }) });
          S.edit = null; return render();
        }
        if (q("[data-ipolish]")) {
          S.busy[id] = true; render();
          try { S.list = await api(`/api/my-ideas/${id}/polish`, { method: "POST" }); toast("✨ نُقّحت. إذا لم تعجبك أعدها كما كتبتها"); }
          finally { delete S.busy[id]; render(); }
          return;
        }
        if (q("[data-iscript]")) {
          S.busy[id] = "script"; render();
          try { S.list = await api(`/api/my-ideas/${id}/script`, { method: "POST" }); toast("📝 نُسّقت نص. إذا لم يعجبك أعدها كما كتبتها"); }
          finally { delete S.busy[id]; render(); }
          return;
        }
        if (q("[data-irevert]")) { S.list = await api(`/api/my-ideas/${id}/revert`, { method: "POST" }); return render(); }
        if (q("[data-idel]")) {
          if (!(await uiConfirm("تحذف هذه الفكرة؟"))) return;
          S.list = await api(`/api/my-ideas/${id}`, { method: "DELETE" }); return render();
        }
      } catch (err) { toast(err.message, true); }
    });
    w.addEventListener("change", (e) => {
      if (!e.target.matches("[data-ifile]")) return;
      const f = e.target.files[0];
      if (!f) return;
      keepDraft(); S.clip = f; render(); restoreDraft();
    });
  }
  async function mount(root) {
    const w = root.querySelector("#idWrap");
    if (!w) return;
    S.el = w; S.edit = null; draft = {};
    bind(w);
    try { await load(); render(); poll(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => { clearTimeout(S.timer); if (S.rec) S.rec.mr.stop(); } };
})();
