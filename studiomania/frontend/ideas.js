// 💡 فولدر الأفكار (تصميم «فقاعة التفكير»): زي الكرتون لما حد بيفكر، فقاعات صغيرة طالعة من الراس لسحابة كبيرة، والأفكار فقاعات جوه السحابة.
// الجديدة لونها برتقالي فاتح، واللي اتستخدمت بتصغر وترجع ورا (ولما تدوس عليها تيجي قدام). فوق عدّاد: المستخدمة (أسود) / الموجودة (برتقالي)،
// عشان العميل يحس إن الأفكار بتتجدد وبتزيد. الإضافة (كتابة، أو صوت، أو رابط) من الفقاعة «＋» اللي في سلسلة الفقاعات.
// «✨ نقّح» بيرتّب الكلام، و«📝 نسّقها نصًا» بيكتبها كلام يتقال ومعاه سندات حقيقية لو موجودة.
const IdeasPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], timer: null, rec: null, clip: null, edit: null, busy: {}, open: null, adding: false, fc: null, fitted: false };
  const html = () => `<div class="fc tb" id="idWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const ago = (t) => { try { return new Date(t).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" }); } catch { return ""; } };
  const isNew = (x) => !x.used_at && x.auto && Date.now() - new Date(x.at).getTime() < 2 * 864e5;

  // 🫧 ترتيب الفقاعات (أول مرة): الغير مستخدمة من النص لبرة (حلزوني)، والمستخدمة صغيرة ورا على الأطراف. بعد كده تمسكها وتحرّكها
  function pack(items, W) {
    const rOf = (x) => (x.used_at ? 30 : Math.round(56 + (Math.min((x.title || "").length, 60) / 60) * 20));
    const placed = [];
    const fits = (x, y, r, used) => Math.abs(x) + r < W / 2 && placed.every((p) => Math.hypot(p.x - x, p.y - y) >= (used && !p.used ? (p.r + r) * 0.62 : p.r + r + 6));
    let tMax = 0;
    for (const x of items) {
      const r = rOf(x), u = !!x.used_at;
      for (let t = u ? tMax * 0.8 : 0; t < 3000; t += 0.12) {
        const px = Math.cos(t) * t * 5 * 1.8, py = Math.sin(t) * t * 5;
        if (fits(px, py, r, u)) { placed.push({ x: Math.round(px), y: Math.round(py), r, used: u, it: x }); if (!u) tMax = Math.max(tMax, t); break; }
      }
    }
    return placed;
  }

  // 🔢 فوق على اليمين: «الأفكار» وقدامها المستخدمة (أسود) / الموجودة (برتقالي)
  function counter() {
    const used = S.list.filter((x) => x.used_at).length, tot = S.list.length;
    return `<div class="tb-tag"><b>الأفكار</b><span class="tb-count num"><i class="u">${used}</i><i class="sl">/</i><i class="t">${tot}</i></span>
      <small class="muted">تتجدد كل يوم</small></div>`;
  }

  // ☁️ السحابة على الكانفاس: كل الأفكار موجودة (من غير قلب صفحات)، والزوم والسحب زي كانفاس العقل
  function stage() {
    const fresh = S.list.filter((x) => !x.used_at), used = S.list.filter((x) => x.used_at);
    const pl = pack([...fresh, ...used], (S.el?.clientWidth || 900) < 620 ? 520 : Math.max(900, Math.sqrt(S.list.length) * 260));   // الموبايل: سحابة أعلى من عرضها
    const puff = 32, fr = pl.filter((p) => !p.used);
    const bx0 = Math.min(0, ...fr.map((p) => p.x - p.r)), bx1 = Math.max(0, ...fr.map((p) => p.x + p.r));
    const by0 = Math.min(0, ...fr.map((p) => p.y - p.r)), by1 = Math.max(0, ...fr.map((p) => p.y + p.r));
    const core = fr.length ? `<i style="left:${bx0 + (bx1 - bx0) * 0.08}px;top:${by0 + (by1 - by0) * 0.08}px;width:${(bx1 - bx0) * 0.84}px;height:${(by1 - by0) * 0.84}px"></i>` : `<i style="left:-130px;top:-90px;width:260px;height:180px"></i>`;
    const puffs = core + fr.map((p) => `<i data-p="${esc(p.it.id)}" data-r="${p.r}" style="left:${p.x - p.r - puff}px;top:${p.y - p.r - puff}px;width:${2 * (p.r + puff)}px;height:${2 * (p.r + puff)}px"></i>`).join("");
    const bubs = pl.map((p, i) => {
      const x = p.it, on = S.open === x.id, busy = x.status === "transcribing";
      const cls = `tb-bub${p.used ? " used" : ""}${isNew(x) ? " new" : ""}${on ? " on" : ""}${busy ? " busy" : ""}`;
      const title = x.title || (busy ? "جارٍ تحويل الصوت إلى نص…" : "فكرة");
      return `<div class="fc-n tb-n${p.used ? " back" : ""}" data-fc="i:${esc(x.id)}" data-x="${p.x}" data-y="${p.y}" style="left:${p.x}px;top:${p.y}px"><div class="fc-f" style="--fd:${(i % 9) * -0.7}s">
        <button type="button" class="${cls}" data-iopen="${esc(x.id)}" title="${esc(title)}" style="width:${2 * p.r}px;height:${2 * p.r}px">
        ${p.used ? `<span class="tk">✓</span>` : `${x.kind === "trend" ? `<em>ترند</em>` : isNew(x) ? `<em>جديدة</em>` : ""}<span>${esc(title)}</span>`}</button></div></div>`;
    }).join("");
    // من تحت لفوق: الراس ← فقاعة صغيرة ← أكبر ← «＋» لازقة في السحابة
    const pr = 32, px = bx1 - pr * 0.6, py = by1 + puff + pr * 0.3, hr = 32, hx = px + 74, hy = py + pr + 104;
    const trail = [[px + (hx - px) * 0.66, py + pr + (hy - hr - py - pr) * 0.62, 7], [px + (hx - px) * 0.33, py + pr + (hy - hr - py - pr) * 0.22, 11]]
      .map(([x, y, r]) => `<i class="tb-dot" style="left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px"></i>`).join("");
    return `<div class="fc-world"><div class="tb-cloud">${puffs}</div>${trail}
      <button type="button" class="tb-plus${S.adding ? " on" : ""}" data-iaddopen data-fcb data-x="${px}" data-y="${py}" title="فكرة جديدة" style="left:${px - pr}px;top:${py - pr}px;width:${2 * pr}px;height:${2 * pr}px">＋<small>فكرة جديدة</small></button>
      <i class="tb-head" data-fcb data-x="${hx}" data-y="${hy}" style="left:${hx - hr}px;top:${hy - hr}px;width:${2 * hr}px;height:${2 * hr}px"><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg></i>
      ${bubs}${S.list.length ? "" : `<p class="muted tb-empty">لا توجد أفكار بعد. اضغط «＋» لإضافة أول فكرة.</p>`}</div>${counter()}`;
  }
  // لما فقاعة تتحرّك، السحابة اللي وراها بتتحرّك معاها
  function moved(id, x, y) {
    const c = S.el?.querySelector(`.tb-cloud [data-p="${CSS.escape(id.slice(2))}"]`);
    if (!c) return;
    const r = +c.dataset.r + 32;
    c.style.left = `${x - r}px`; c.style.top = `${y - r}px`;
  }

  function addPanel() {
    const recOn = !!S.rec;
    return `<section class="tb-panel fc-skip" id="tbPanel"><h3>فكرة جديدة</h3>
        <textarea class="id-in" rows="3" data-inew="text" placeholder="اكتب فكرتك… مثلًا: فيديو يعرض ٣ أخطاء يقع فيها الناس عند…"></textarea>
        <input class="id-in" data-inew="url" dir="ltr" placeholder="https://… رابط فيديو أو منشور (اختياري)">
        <div class="tb-acts">
          <button type="button" class="${recOn ? "rec" : ""}" data-irec>${recOn ? `أوقف التسجيل <span class="num" data-irect>0:00</span>` : "سجّل بصوتك"}</button>
          <label>ارفع رسالة صوتية<input type="file" accept="audio/*,video/*" data-ifile hidden></label>
          ${S.clip ? `<span class="id-clip">${esc(S.clip.name)} <button type="button" data-iclip aria-label="إزالة">✕</button></span>` : ""}
          <span class="sp"></span><button type="button" data-iaddclose>إلغاء</button>
          <button type="button" class="nb-btn fs-go" data-iadd>أضف الفكرة</button></div></section>`;
  }

  function openPanel(x) {
    if (S.edit === x.id) {
      return `<section class="tb-panel fc-skip" id="tbPanel" data-iid="${esc(x.id)}">
        <input class="id-in" data-ie="title" value="${esc(x.title)}" placeholder="عنوان الفكرة">
        <textarea class="id-in" rows="4" data-ie="text" placeholder="الفكرة">${esc(x.text)}</textarea>
        <input class="id-in" data-ie="url" dir="ltr" value="${esc(x.url)}" placeholder="https://… رابط فيديو أو منشور (اختياري)">
        <div class="tb-acts"><span class="sp"></span><button type="button" data-icancel>إلغاء</button><button type="button" class="nb-btn fs-go" data-isave>احفظ</button></div></section>`;
    }
    const busy = x.status === "transcribing", pol = S.busy[x.id];
    return `<section class="tb-panel fc-skip" id="tbPanel" data-iid="${esc(x.id)}">
      <div class="tb-ph"><h3>${esc(x.title || "فكرة")}</h3><small class="muted">${x.used_at ? "استُخدمت · " : isNew(x) ? "جديدة · " : ""}${x.polished ? `${I18N.t("✨ منقّحة")} · ` : ""}${ago(x.at)}</small>
        <button type="button" class="tb-x" data-iclose aria-label="إغلاق">✕</button></div>
      ${x.hook ? `<p class="id-hook">«${esc(x.hook)}»</p>` : ""}
      ${busy ? `<p class="muted">جارٍ تحويل الرسالة الصوتية إلى نص…</p>` : x.script ? "" : x.text ? `<p class="id-t">${esc(x.text)}</p>` : ""}
      ${x.script ? `<div class="id-script"><small class="muted">النص</small><p>${esc(x.script)}</p></div>` : ""}
      ${(x.sources || []).length && x.script ? `<div class="id-src"><small class="muted">المصادر</small><ul>${x.sources.map((r) => `<li><b>${esc(r.label)}</b> <span data-no-i18n>${esc(r.ref)}</span>${r.where ? ` <small class="muted" data-no-i18n>· ${esc(r.where)}</small>` : ""}</li>`).join("")}</ul></div>` : ""}
      ${x.script && x.dropped ? `<p class="muted id-drop">حذفنا ${x.dropped} مصدر لم نتمكن من التأكد من وجوده بهذا النص.</p>` : ""}
      ${x.audio_url ? `<audio src="${esc(x.audio_url)}" controls preload="metadata"></audio>` : ""}
      ${x.url ? `<a class="id-link" href="${esc(x.url)}" target="_blank" rel="noopener" dir="ltr">${esc(x.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>` : ""}
      ${x.error ? `<p class="fs-err">${esc(x.error)}</p>` : ""}
      ${(x.from || []).length ? `<p class="tb-from"><small class="muted">مصدرها</small> ${x.from.map((f) => `<span>${esc(f)}</span>`).join("")}</p>` : ""}
      <div class="tb-acts">
        <button type="button" class="nb-btn tb-use" data-iuse ${busy ? "disabled" : ""}>${x.kind === "trend" ? "ابنِ فكرة على هذا الترند" : "استخدم الفكرة"}</button>
        ${x.kind === "trend" ? "" : `<button type="button" class="pri" data-ipolish ${busy || pol ? "disabled" : ""} title="يرتّب الذكاء الاصطناعي النص ويضبطه (يُخصم من الرصيد)">${pol === true ? "جارٍ التنقيح…" : "نقّح"}</button>
        <button type="button" data-iscript ${busy || pol ? "disabled" : ""} title="يكتبها نصًا يُقال، ويضع مصادر حقيقية في مكانها إن وُجدت (يُخصم من الرصيد)">${pol === "script" ? "جارٍ التنسيق…" : x.script ? "نسّق مرة أخرى" : "نسّقها نصًا"}</button>
        ${x.polished ? `<button type="button" data-irevert>أعدها كما كتبتها</button>` : ""}
        <button type="button" data-iedit ${busy ? "disabled" : ""}>عدّل</button>`}
        <button type="button" class="del" data-idel>احذف</button></div></section>`;
  }

  function render() {
    const w = S.el;
    if (!w || !w.isConnected) return;
    w.style.height = `${Math.max(420, innerHeight - w.getBoundingClientRect().top - 16)}px`;
    const cur = S.list.find((x) => x.id === S.open);
    const panel = S.adding ? addPanel() : cur ? openPanel(cur) : "";
    const v = S.fc.view;
    w.innerHTML = `${stage()}${panel ? `<div class="tb-veil fc-skip" data-iveil></div>${panel}` : ""}`;
    S.fc.place();
    if (!S.fitted || !v) { S.fc.fit(60); S.fitted = true; } else S.fc.apply();
  }
  async function load() { S.list = await api("/api/my-ideas"); }
  function poll() {
    clearTimeout(S.timer);
    if (!S.list.some((x) => x.status === "transcribing")) return;
    S.timer = setTimeout(async () => { try { await load(); if (!S.edit && !S.adding) render(); } catch { /* */ } poll(); }, 3000);
  }
  async function recToggle() {
    if (S.rec) { S.rec.mr.stop(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast("تعذّر الوصول إلى الميكروفون. اسمح للمتصفح باستخدامه", true); }
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
      const q = (s) => e.target.closest(s);
      let b;
      try {
        if ((b = q("[data-iopen]"))) { S.adding = false; S.edit = null; S.open = S.open === b.dataset.iopen ? null : b.dataset.iopen; return render(); }
        if (q("[data-iveil]")) { if (S.rec) return; keepDraft(); S.open = null; S.adding = false; S.edit = null; return render(); }
        if (q("[data-iaddopen]")) { keepDraft(); S.adding = !S.adding; S.open = null; render(); restoreDraft(); if (S.adding) S.el.querySelector('[data-inew="text"]')?.focus({ preventScroll: true }); return; }
        if (q("[data-iaddclose]")) { if (S.rec) return; S.adding = false; return render(); }
        if (q("[data-iclose]")) { S.open = null; return render(); }
        if (q("[data-irec]")) return recToggle();
        if (q("[data-iclip]")) { keepDraft(); S.clip = null; render(); return restoreDraft(); }
        if (q("[data-iadd]")) {
          keepDraft();
          const fd = new FormData();
          fd.append("text", draft.text || ""); fd.append("url", draft.url || "");
          if (S.clip) fd.append("file", S.clip);
          if (!(draft.text || "").trim() && !(draft.url || "").trim() && !S.clip) return toast("اكتب الفكرة، أو سجّلها بصوتك، أو ضع رابطًا", true);
          S.list = await api("/api/my-ideas", { method: "POST", body: fd });
          draft = {}; S.clip = null; S.adding = false; S.open = S.list[0]?.id || null; render(); poll();
          return toast("حُفظت الفكرة، وستظهر لك عند إنشاء مشروع جديد");
        }
        const c = e.target.closest("[data-iid]"), id = c?.dataset.iid;
        if (!id) return;
        if (q("[data-iuse]")) {
          await api(`/api/my-ideas/${id}/use`, { method: "POST" });
          toast("اختر القالب، وسيبدأ المشروع بهذه الفكرة");
          S.open = null;
          return window.NHNav?.("create");
        }
        if (q("[data-iedit]")) { S.edit = id; return render(); }
        if (q("[data-icancel]")) { S.edit = null; return render(); }
        if (q("[data-isave]")) {
          const v = (k) => c.querySelector(`[data-ie="${k}"]`).value;
          S.list = await api(`/api/my-ideas/${id}`, { method: "PATCH", ...jsonBody({ title: v("title"), text: v("text"), url: v("url") }) });
          S.edit = null; return render();
        }
        if (q("[data-ipolish]")) {
          S.busy[id] = true; render();
          try { S.list = await api(`/api/my-ideas/${id}/polish`, { method: "POST" }); toast("نُقّحت. إن لم تعجبك فأعدها كما كتبتها"); }
          finally { delete S.busy[id]; render(); }
          return;
        }
        if (q("[data-iscript]")) {
          S.busy[id] = "script"; render();
          try { S.list = await api(`/api/my-ideas/${id}/script`, { method: "POST" }); toast("نُسّقت نصًا. إن لم يعجبك فأعدها كما كتبتها"); }
          finally { delete S.busy[id]; render(); }
          return;
        }
        if (q("[data-irevert]")) { S.list = await api(`/api/my-ideas/${id}/revert`, { method: "POST" }); return render(); }
        if (q("[data-idel]")) {
          if (!(await uiConfirm("أتحذف هذه الفكرة؟"))) return;
          S.list = await api(`/api/my-ideas/${id}`, { method: "DELETE" }); S.open = null; return render();
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
  let onResize;
  async function mount(root) {
    const w = root.querySelector("#idWrap");
    if (!w) return;
    S.el = w; S.edit = null; S.open = null; S.adding = false; S.fitted = false; draft = {};
    S.fc = FloatCanvas.mount(w, { key: "ideas", top: 50, onMove: moved });
    bind(w);
    if (!onResize) {
      let t;
      onResize = () => { clearTimeout(t); t = setTimeout(() => { if (S.el?.isConnected && !S.adding && !S.edit) { S.fitted = false; render(); } }, 160); };
      window.addEventListener("resize", onResize);
    }
    try { await load(); render(); poll(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => { clearTimeout(S.timer); if (S.rec) S.rec.mr.stop(); } };
})();
