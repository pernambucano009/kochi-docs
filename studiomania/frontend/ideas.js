// 💡 فولدر الأفكار (تصميم «فقاعة التفكير»): زي الكرتون لما حد بيفكر، فقاعات صغيرة طالعة من الراس لسحابة كبيرة، والأفكار فقاعات جوه السحابة.
// الجديدة لونها برتقالي فاتح، واللي اتستخدمت بتصغر وترجع ورا (ولما تدوس عليها تيجي قدام). فوق عدّاد: المستخدمة (أسود) / الموجودة (برتقالي)،
// عشان العميل يحس إن الأفكار بتتجدد وبتزيد. الإضافة (كتابة، أو صوت، أو رابط) من الفقاعة «＋» اللي في سلسلة الفقاعات.
// «✨ نقّح» بيرتّب الكلام، و«📝 نسّقها نصًا» بيكتبها كلام يتقال ومعاه سندات حقيقية لو موجودة.
const IdeasPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, list: [], timer: null, rec: null, clip: null, edit: null, busy: {}, open: null, adding: false };
  const html = () => `<div class="nb-wrap tb" id="idWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const ago = (t) => { try { return new Date(t).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" }); } catch { return ""; } };
  const isNew = (x) => !x.used_at && x.auto && Date.now() - new Date(x.at).getTime() < 2 * 864e5;

  // 🫧 ترتيب الفقاعات: الغير مستخدمة من النص لبرة (حلزوني)، والمستخدمة صغيرة ومستخبية ورا على الأطراف
  function pack(W, small) {
    const fresh = S.list.filter((x) => !x.used_at), used = S.list.filter((x) => x.used_at).slice(0, 40);
    const rOf = (x) => {
      if (x.used_at) return small ? 22 : 28;
      const n = (x.title || "").length;
      return Math.round((small ? 42 : 56) + Math.min(n, 60) / 60 * (small ? 12 : 18));
    };
    const placed = [], cx = W / 2, sx = small ? 1.05 : 1.7;
    const fits = (x, y, r, used) => {
      if (x - r < 8 || x + r > W - 8) return false;
      return placed.every((p) => {
        const d = Math.hypot(p.x - x, p.y - y);
        return d >= (used && !p.used ? (p.r + r) * 0.62 : p.r + r + 6);
      });
    };
    let tMax = 0;
    for (const x of [...fresh, ...used]) {
      const r = rOf(x), u = !!x.used_at;
      // المستخدمة بتبدأ من طرف السحابة (ورا الأفكار الجديدة، مش في النص)
      for (let t = u ? tMax * 0.8 : 0; t < 2400; t += 0.12) {
        const px = cx + Math.cos(t) * t * 5 * sx, py = Math.sin(t) * t * 5;
        if (fits(px, py, r, u)) { placed.push({ x: px, y: py, r, used: u, it: x }); if (!u) tMax = Math.max(tMax, t); break; }
      }
    }
    return placed;
  }

  function counter() {
    const used = S.list.filter((x) => x.used_at).length, tot = S.list.length, fresh = S.list.filter(isNew).length;
    return `<section class="tb-top">
      <div class="tb-count"><span class="u"><b class="num">${used}</b><small>استُخدمت</small></span><i>/</i><span class="t"><b class="num">${tot}</b><small>فكرة لديك</small></span></div>
      <p class="muted">تُضاف أفكار جديدة كل يوم من أفضل منشورات منافسيك، والترند، وأسئلة جمهورك${fresh ? `، ومنها <b class="tb-fresh">${fresh} جديدة</b>` : ""}. وأضف أفكارك أنت من «＋».</p></section>`;
  }

  function stage() {
    const W = Math.max(300, S.el.clientWidth || 900), small = W < 620;
    const pl = pack(W, small);
    const top = Math.min(0, ...pl.map((p) => p.y - p.r)) - (small ? 34 : 44), bot = Math.max(0, ...pl.map((p) => p.y + p.r));
    const puff = small ? 22 : 34, oy = -top;
    const cloudH = bot - top + puff + 14;
    // السحابة: دايرة أكبر شوية ورا كل فكرة (اتحادهم بيعمل شكل سحابة)
    const fr = pl.filter((p) => !p.used);
    const bx0 = Math.min(...fr.map((p) => p.x - p.r)), bx1 = Math.max(...fr.map((p) => p.x + p.r)), by0 = Math.min(...fr.map((p) => p.y - p.r)) + oy, by1 = Math.max(...fr.map((p) => p.y + p.r)) + oy;
    const core = fr.length ? `<i style="left:${bx0 + (bx1 - bx0) * 0.08}px;top:${by0 + (by1 - by0) * 0.08}px;width:${(bx1 - bx0) * 0.84}px;height:${(by1 - by0) * 0.84}px"></i>` : "";
    const puffs = core + fr.map((p) => `<i style="left:${p.x - p.r - puff}px;top:${p.y + oy - p.r - puff}px;width:${2 * (p.r + puff)}px;height:${2 * (p.r + puff)}px"></i>`).join("")
      || `<i style="left:${W / 2 - 120}px;top:20px;width:240px;height:160px"></i>`;
    const bubs = pl.map((p, i) => {
      const x = p.it, on = S.open === x.id, busy = x.status === "transcribing";
      const cls = `tb-bub${p.used ? " used" : ""}${isNew(x) ? " new" : ""}${on ? " on" : ""}${busy ? " busy" : ""}`;
      const title = x.title || (busy ? "جارٍ تحويل الصوت إلى نص…" : "فكرة");
      return `<button type="button" class="${cls}" data-iopen="${esc(x.id)}" title="${esc(title)}" style="left:${p.x - p.r}px;top:${p.y + oy - p.r}px;width:${2 * p.r}px;height:${2 * p.r}px;--fl:${(i % 7) * -0.9}s">
        ${p.used ? `<span class="tk">✓</span>` : `${isNew(x) ? `<em>جديدة</em>` : ""}<span>${esc(title)}</span>`}</button>`;
    }).join("");
    // الراس وسلسلة الفقاعات الصغيرة لحد السحابة، وأكبرهم «＋»
    // من تحت لفوق: الراس ← فقاعة صغيرة ← أكبر ← «＋» لازقة في السحابة
    const pr = small ? 25 : 30, px = fr.length ? Math.min(W - pr - 50, bx1 - pr * 0.6) : W / 2 + 60, py = fr.length ? by1 + puff + pr * 0.3 : cloudH + pr - 4;
    const hr = small ? 26 : 32, hx = Math.min(W - hr - 6, px + (small ? 46 : 70)), hy = py + pr + (small ? 74 : 92);
    const trail = [[px + (hx - px) * 0.66, py + pr + (hy - hr - py - pr) * 0.62, 7], [px + (hx - px) * 0.33, py + pr + (hy - hr - py - pr) * 0.22, 11]]
      .map(([x, y, r]) => `<i class="tb-dot" style="left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px"></i>`).join("");
    const H = hy + hr + 26;
    return `<div class="tb-stage" style="height:${H}px">
      <div class="tb-cloud" style="height:${cloudH}px">${puffs}</div>${bubs}${trail}
      <button type="button" class="tb-plus${S.adding ? " on" : ""}" data-iaddopen title="فكرة جديدة" style="left:${px - pr}px;top:${py - pr}px;width:${2 * pr}px;height:${2 * pr}px">＋<small>فكرة جديدة</small></button>
      <i class="tb-head" style="left:${hx - hr}px;top:${hy - hr}px;width:${2 * hr}px;height:${2 * hr}px"><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg></i>
    </div>`;
  }

  function addPanel() {
    const recOn = !!S.rec;
    return `<section class="tb-panel" id="tbPanel"><h3>فكرة جديدة</h3>
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
      return `<section class="tb-panel" id="tbPanel" data-iid="${esc(x.id)}">
        <input class="id-in" data-ie="title" value="${esc(x.title)}" placeholder="عنوان الفكرة">
        <textarea class="id-in" rows="4" data-ie="text" placeholder="الفكرة">${esc(x.text)}</textarea>
        <input class="id-in" data-ie="url" dir="ltr" value="${esc(x.url)}" placeholder="https://… رابط فيديو أو منشور (اختياري)">
        <div class="tb-acts"><span class="sp"></span><button type="button" data-icancel>إلغاء</button><button type="button" class="nb-btn fs-go" data-isave>احفظ</button></div></section>`;
    }
    const busy = x.status === "transcribing", pol = S.busy[x.id];
    return `<section class="tb-panel" id="tbPanel" data-iid="${esc(x.id)}">
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
      <p class="muted tb-hint">تظهر هذه الفكرة عند اختيار الفكرة في أي مشروع جديد.</p>
      <div class="tb-acts">
        <button type="button" class="pri" data-ipolish ${busy || pol ? "disabled" : ""} title="يرتّب الذكاء الاصطناعي النص ويضبطه (يُخصم من الرصيد)">${pol === true ? "جارٍ التنقيح…" : "نقّح"}</button>
        <button type="button" data-iscript ${busy || pol ? "disabled" : ""} title="يكتبها نصًا يُقال، ويضع مصادر حقيقية في مكانها إن وُجدت (يُخصم من الرصيد)">${pol === "script" ? "جارٍ التنسيق…" : x.script ? "نسّق مرة أخرى" : "نسّقها نصًا"}</button>
        ${x.polished ? `<button type="button" data-irevert>أعدها كما كتبتها</button>` : ""}
        <button type="button" data-iedit ${busy ? "disabled" : ""}>عدّل</button>
        <button type="button" class="del" data-idel>احذف</button></div></section>`;
  }

  function render() {
    const w = S.el;
    if (!w || !w.isConnected) return;
    const cur = S.list.find((x) => x.id === S.open);
    w.innerHTML = `${counter()}${S.list.length ? stage() : `<div class="tb-empty">${stage()}<p class="muted">لا توجد أفكار بعد. اضغط «＋» لإضافة أول فكرة.</p></div>`}
      ${S.adding ? addPanel() : cur ? openPanel(cur) : ""}`;
  }
  const reveal = () => requestAnimationFrame(() => S.el?.querySelector("#tbPanel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
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
        if ((b = q("[data-iopen]"))) { S.adding = false; S.edit = null; S.open = S.open === b.dataset.iopen ? null : b.dataset.iopen; render(); return reveal(); }
        if (q("[data-iaddopen]")) { keepDraft(); S.adding = !S.adding; S.open = null; render(); restoreDraft(); if (S.adding) { reveal(); S.el.querySelector('[data-inew="text"]')?.focus({ preventScroll: true }); } return; }
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
    S.el = w; S.edit = null; S.open = null; S.adding = false; draft = {};
    bind(w);
    if (!onResize) {
      let t;
      onResize = () => { clearTimeout(t); t = setTimeout(() => { if (S.el?.isConnected && !S.adding && !S.edit) render(); }, 160); };
      window.addEventListener("resize", onResize);
    }
    try { await load(); render(); poll(); } catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => { clearTimeout(S.timer); if (S.rec) S.rec.mr.stop(); } };
})();
