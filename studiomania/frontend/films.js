// 🎞️ فيديو بالكونيكتورز: سيناريو بيتكتب على مقاس الكونيكتورز اللي في المكتبة، فريم أول وآخر لكل مشهد،
// وبين كل مشهدين كونيكتور بيتنفذ بنفس طريقة التجارب، وبعدين الفيديو كله بيتجمّع.
const filmx = { list: [], cur: null, conns: [], pick: null, timer: null, sel: {}, notes: {}, open: new Set() };
const FILM_ST = { planning: "✍️ بيكتب السيناريو", planned: "📝 السيناريو جاهز", drawing: "🖼️ بيرسم", drawn: "🖼️ الفريمات جاهزة",
  working: "🎬 بيولّد", done: "✅ الفيديو جاهز", failed: "✕ فشل" };

async function openFilm(fid) {
  labx.view = "film";
  renderLab();
  const [list, assets] = await Promise.all([api("/api/films"), api("/api/assets")]);
  filmx.list = list;
  filmx.conns = assets.filter((a) => a.category === "connector");
  if (!filmx.pick) filmx.pick = new Set(filmx.conns.map((a) => a.id));
  filmx.cur = fid && list.some((x) => x.id === fid) ? await api(`/api/films/${fid}`) : null;
  renderFilm();
  scheduleFilmPoll();
}

function scheduleFilmPoll() {
  clearTimeout(filmx.timer);
  if (!filmx.cur?.busy || labx.view !== "film") return;
  filmx.timer = setTimeout(async () => {
    try {
      filmx.cur = await api(`/api/films/${filmx.cur.id}`);
      const playing = [...$("labFilm").querySelectorAll("video")].some((v) => !v.paused);
      const typing = $("labFilm").contains(document.activeElement) && document.activeElement.matches("input, select, textarea");
      if (!playing && !typing) renderFilm();
    } catch { /* السيرفر بيعيد التشغيل */ }
    scheduleFilmPoll();
  }, 2500);
}

function renderFilm() {
  $("labFilm").querySelectorAll("details[data-dk]").forEach((d) => filmx.open[d.open ? "add" : "delete"](d.dataset.dk));
  $("labFilm").innerHTML = filmx.cur ? filmDetail(filmx.cur) : filmHome();
}

function filmHome() {
  const cs = filmx.conns;
  return `<div class="car-head"><h2>🎞️ فيديو بالكونيكتورز</h2></div>
    <section class="panel lab-sec fm-new">
      <p class="hint">البرنامج بيقرا ملف العميل والكونيكتورز اللي في المكتبة، ويكتب سيناريو كل مشهد فيه بيخلص في المكان اللي الكونيكتور يبدأ منه،
        والمشهد اللي بعده بيبدأ مكان ما الكونيكتور بيوصل. كتابة السيناريو ببلاش تقريبًا، والرسم والتوليد بيستنوا موافقتك.</p>
      <label>الفيديو عن إيه؟ <textarea rows="3" data-fmbrief placeholder="مثلًا: فيديو ٢٠ ثانية عن أهم ٣ مميزات في التطبيق: المدرب الشخصي، متابعة التمرين، والنتايج. الختام: حمّل التطبيق"></textarea></label>
      <div><b>🔗 الكونيكتورز اللي هتتطبق</b> <small class="muted">(${filmx.pick.size} من ${cs.length})</small>
        ${cs.length ? `<div class="fm-conns">${cs.map((a) => `<label class="fm-conn ${filmx.pick.has(a.id) ? "on" : ""}">
            <input type="checkbox" data-fmpick="${a.id}" ${filmx.pick.has(a.id) ? "checked" : ""}>
            <video src="${a.url}" poster="${a.thumb_url}" preload="none" muted loop playsinline></video>
            <small data-no-i18n>${le(a.name)}</small></label>`).join("")}</div>`
          : `<p class="muted">مفيش كونيكتورز في المكتبة. فكّك فيديو في المعمل، واقبل ✅ الكونيكتورز اللي تعجبك.</p>`}</div>
      <div class="row wrap">
        <label>عدد المشاهد <select data-fmn><option value="0">تلقائي (على قد الكونيكتورز)</option>${[2, 3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></label>
        <label>المقاس <select data-fmratio><option value="9:16">9:16 (ريلز)</option><option value="16:9">16:9</option><option value="1:1">1:1</option></select></label>
        <label>موديل الحركة <select data-fmmodel>${[["seedance-mini", "Seedance 2.0 Mini (الأرخص)"], ["seedance-fast", "Seedance 2.0 Fast"], ["seedance", "Seedance 2.0 (أجود)"]].map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
        <label>الجودة <select data-fmres><option value="480p">480p</option><option value="720p">720p (الضعف)</option></select></label>
        <button type="button" class="btn primary" data-fmnew ${cs.length ? "" : "disabled"}>✍️ اكتب السيناريو</button>
      </div>
    </section>
    ${filmx.list.length ? `<div class="fm-list">${filmx.list.map((f) => `<article class="fm-card" data-fmopen="${f.id}">
        ${f.thumb ? `<img src="${f.thumb}" alt="">` : `<span class="ph">🎞️</span>`}
        <b data-no-i18n>${le(f.name)}</b><small class="muted">${f.scenes} مشهد · ${FILM_ST[f.status] || ""}</small></article>`).join("")}</div>` : ""}`;
}

function fmFrame(f, i, w) {
  const u = f.scene_files[i]?.[w], can = !["planning", "working"].includes(f.status);
  const queued = (f.queue || []).some((q) => q.only[0] === i && (q.only[1] === w || q.only[1] === "a"));
  return `<figure class="fm-frame">${u ? `<img src="${u}" alt="">` : `<div class="fm-ph">${w === "a" ? "أول المشهد" : "آخر المشهد"}</div>`}
    <figcaption>${w === "a" ? "أول المشهد" : "آخر المشهد"}
      ${queued ? `<small class="fm-queued">⏳ في الدور</small>` : ""}
      ${u && can ? `<button type="button" class="btn sm" data-fmredo="${i}" data-w="${w}" title="${w === "a" ? "يرسمه تاني (وآخر المشهد معاه)" : "يرسمه تاني"}">↻</button>` : ""}</figcaption></figure>`;
}

// ✏️ تعديل فريم: ملاحظة + صور مرجعية (لوجو أو شاشة من ملف العميل، أو صورة ترفعها) وبعدين ↻ على الفريم
function fmFix(f, i) {
  const sel = filmx.sel[i] || new Set();
  const chip = (key, url, name, del) => `<span class="fm-ref ${sel.has(key) ? "on" : ""}" data-fmref="${le(key)}" data-i="${i}" title="${le(name)}">
    <img src="${url}" alt=""><small data-no-i18n>${le(name)}</small>${del ? `<button type="button" data-fmrefdel="${le(del)}" title="امسحها">✕</button>` : ""}</span>`;
  return `<details class="fm-fix" data-dk="fix${i}" ${filmx.open.has(`fix${i}`) || sel.size || filmx.notes[i] ? "open" : ""}><summary>🛠️ صلّح فريم (ملاحظة وصور مرجعية)</summary>
    <input type="text" data-fmnote="${i}" value="${le(filmx.notes[i])}" placeholder="مثلًا: اللوجو اللي استخدمته غلط، حط اللوجو اللي في الصورة" data-no-i18n>
    <div class="fm-refs">
      ${(f.client_assets || []).map((a) => chip(`c:${a.name}`, a.url, `${a.kind === "logos" ? "🏷️" : a.kind === "screens" ? "📱" : "📦"} ${a.name}`)).join("")}
      ${(f.ref_files || []).map((r) => chip(`u:${r.file}`, r.url, `📎 ${r.name}`, r.file)).join("")}
      <label class="btn sm fm-up">📎 ارفع صورة<input type="file" accept="image/*" data-fmup="${i}" hidden></label>
    </div>
    <small class="muted">علّم على الصورة الصح (اللوجو مثلًا) واكتب الملاحظة، وبعدين دوس ↻ على الفريم اللي عايز تصلّحه. الصور اللي معلّم عليها بتتبعت للموديل ويستخدمها زي ما هي بالظبط.</small>
  </details>`;
}

function fmScene(f, sc, i) {
  const lock = f.status === "planning" ? "disabled" : "", v = f.scene_files[i]?.video;
  return `<article class="fm-scene" data-scene="${i}">
    <header><b>🎬 المشهد ${i + 1}</b> <input data-sf="label" value="${le(sc.label)}" ${lock} data-no-i18n>
      <small class="muted" data-no-i18n>${le(sc.feature)}</small></header>
    <div class="fm-row">
      ${fmFrame(f, i, "a")}<span class="fm-arrow">←</span>${fmFrame(f, i, "b")}
      ${v ? `<figure class="fm-frame"><video src="${v}" controls playsinline preload="metadata"></video>
        <figcaption>الحركة ${!f.busy ? `<button type="button" class="btn sm" data-fmgen="scene" data-i="${i}" title="يولّد حركة المشهد ده تاني">↻</button>` : ""}</figcaption></figure>` : ""}
    </div>
    ${f.scene_files[i]?.a && !["planning", "working"].includes(f.status) ? fmFix(f, i) : ""}
    <details class="fm-edit" data-dk="edit${i}" ${filmx.open.has(`edit${i}`) ? "open" : ""}><summary>✏️ الكلام والبرومبتات</summary>
      <label>الكلام على الشاشة <input data-sf="text" value="${le(sc.text)}" ${lock} data-no-i18n></label>
      <label>أصل من ملف العميل (شاشة / لوجو) <input data-sf="screen" value="${le(sc.screen)}" ${lock} data-no-i18n></label>
      <label>أول المشهد <textarea rows="2" dir="ltr" data-sf="start" ${lock} data-no-i18n>${le(sc.start)}</textarea></label>
      <label>آخر المشهد <textarea rows="2" dir="ltr" data-sf="end" ${lock} data-no-i18n>${le(sc.end)}</textarea></label>
      <label>الحركة <textarea rows="2" dir="ltr" data-sf="motion" ${lock} data-no-i18n>${le(sc.motion)}</textarea></label>
      <label class="row">الطول <input type="number" step="0.1" min="2" max="5" value="${sc.seconds}" data-sf="seconds" ${lock}> ث</label>
      <small class="muted">لو غيّرت برومبت فريم، دوس ↻ عليه عشان يترسم بالجديد.</small>
    </details>
  </article>`;
}

function fmLink(f, l, i) {
  const lock = f.status === "planning" ? "disabled" : "", la = f.link_assets[i] || {}, lf = f.link_files[i] || {}, p = l.plan;
  return `<article class="fm-link" data-link="${i}">
    <header><b>🔗 الكونيكتور ${i + 1}</b>
      <select data-la ${lock}>${filmx.conns.map((a) => `<option value="${a.id}" ${a.id === l.asset ? "selected" : ""} data-no-i18n>${le(a.name)}</option>`).join("")}
        ${la.name || filmx.conns.some((a) => a.id === l.asset) ? "" : `<option selected value="${le(l.asset)}">⚠️ اتمسح من المكتبة</option>`}</select>
      ${!f.busy && (p || (f.scene_files[i]?.b && f.scene_files[i + 1]?.a)) ? `<button type="button" class="btn sm ${p ? "" : "primary"}" data-fmlplan="${i}" title="خطة للكونيكتور ده بين المشهدين دول">🧠 ${p ? "خطة تانية" : "اعمل الخطة"}</button>` : ""}
      ${lf.video && !f.busy ? `<button type="button" class="btn sm" data-fmgen="link" data-i="${i}" title="يولّد الكونيكتور ده تاني">↻ ولّده تاني</button>` : ""}</header>
    ${l.why ? `<p class="muted" data-no-i18n>💡 ${le(l.why)}</p>` : ""}
    <div class="fm-row">
      ${la.url ? `<figure class="fm-frame"><video src="${la.url}" poster="${la.thumb_url}" muted loop playsinline controls preload="none"></video><figcaption>🎯 الأصلي</figcaption></figure>` : ""}
      ${(lf.keys || []).filter(Boolean).map((u, j) => `<figure class="fm-frame"><img src="${u}" alt=""><figcaption>مرحلة ${j + 1}</figcaption></figure>`).join("")}
      ${lf.video ? `<figure class="fm-frame"><video src="${lf.video}" controls playsinline preload="metadata"></video><figcaption>🔗 عندنا</figcaption></figure>` : ""}
    </div>
    ${p ? `<details class="fm-edit" data-dk="link${i}" ${filmx.open.has(`link${i}`) ? "open" : ""}><summary>📝 خطة الكونيكتور</summary>
      ${p.adapted ? `<p class="as-tadapt" data-no-i18n>${le(p.adapted)}</p>` : ""}
      ${(p.keyframes || []).map((k, j) => `<label>🖼️ مرحلة ${j + 1}: <span data-no-i18n>${le(k.label)}</span><textarea rows="2" dir="ltr" data-lk="${j}" ${lock} data-no-i18n>${le(k.prompt)}</textarea></label>`).join("")}
      ${(p.segments || []).map((x, j) => `<label>🎬 حركة ${j + 1}: <span data-no-i18n>${le(x.label)}</span>
        <span class="row">الطول <input type="number" step="0.1" min="0.6" max="6" value="${x.seconds}" data-lsec="${j}" ${lock}> ث</span>
        <textarea rows="2" dir="ltr" data-ls="${j}" ${lock} data-no-i18n>${le(x.prompt)}</textarea></label>`).join("")}
    </details>` : `<small class="muted">الخطة بتتكتب لوحدها بعد ما فريمات المشهدين يترسموا.</small>`}
  </article>`;
}

function filmDetail(f) {
  const p = f.plan || {}, sc = p.scenes || [], c = f.costs || {};
  const framesLeft = f.scene_files.some((x) => !x.a || !x.b), working = f.busy;
  const ready = sc.length && !framesLeft && (p.links || []).every((l) => l.plan);
  return `<div class="car-head"><button type="button" class="btn sm" data-fmback>→ كل الفيديوهات</button>
      <input class="ad-title" data-fmname value="${le(f.name)}" data-no-i18n>
      <div class="row wrap">${f.final_url ? `<a class="btn sm" href="${f.final_url}" download="${le(f.name)}.mp4">⬇️ نزّل</a>` : ""}
        <button type="button" class="btn sm danger" data-fmdel ${working ? "disabled" : ""}>🗑️</button></div></div>
    <div class="fm-status"><span class="lab-st ${working ? "working" : f.status}">${working ? `<span class="spin-inline"></span>` : ""} ${FILM_ST[f.status] || ""}</span>
      ${f.step ? `<small class="muted">${le(f.step)}</small>` : ""}${f.error ? `<small class="err">${le(f.error)}</small>` : ""}</div>
    ${f.final_url ? `<section class="panel fm-final"><video src="${f.final_url}" controls playsinline preload="metadata"></video></section>` : ""}
    ${p.idea ? `<p class="panel fm-idea" data-no-i18n><b>${le(p.title)}</b><br>${le(p.idea)}</p>` : ""}
    ${sc.length ? `<div class="row wrap fm-actions">
        ${framesLeft ? `<button type="button" class="btn primary" data-fmframes ${working ? "disabled" : ""}>🖼️ ارسم الفريمات (~${c.frames}$)</button>` : ""}
        ${ready ? `<button type="button" class="btn primary" data-fmrun ${working ? "disabled" : ""}>🎬 ${f.final_url ? "ولّد اللي اتغيّر وجمّع" : "ولّد الفيديو"} (~${c.video}$)</button>` : ""}
        <button type="button" class="btn sm" data-fmreplan ${working ? "disabled" : ""}>✍️ سيناريو جديد</button>
        <small class="muted">التعديلات بتتحفظ لوحدها. اللي اتولد قبل كده بيفضل، والتوليد بيعمل الناقص بس.</small></div>` : ""}
    <div class="fm-board ${f.ratio === "16:9" ? "wide" : f.ratio === "1:1" ? "square" : ""}">${sc.map((s, i) => fmScene(f, s, i) + (i < sc.length - 1 && p.links?.[i] ? fmLink(f, p.links[i], i) : "")).join("")}</div>`;
}

function filmPlanFrom() {
  const box = $("labFilm"), p = filmx.cur.plan;
  const scenes = p.scenes.map((s, i) => {
    const el = box.querySelector(`[data-scene="${i}"]`), out = { ...s };
    el?.querySelectorAll("[data-sf]").forEach((x) => (out[x.dataset.sf] = x.dataset.sf === "seconds" ? Number(x.value) : x.value));
    return out;
  });
  const links = p.links.map((l, i) => {
    const el = box.querySelector(`[data-link="${i}"]`), out = { ...l };
    if (!el) return out;
    out.asset = el.querySelector("[data-la]")?.value || l.asset;
    if (l.plan) {
      out.plan = { ...l.plan,
        keyframes: l.plan.keyframes.map((k, j) => ({ ...k, prompt: el.querySelector(`[data-lk="${j}"]`)?.value ?? k.prompt })),
        segments: l.plan.segments.map((x, j) => ({ ...x, prompt: el.querySelector(`[data-ls="${j}"]`)?.value ?? x.prompt,
          seconds: Number(el.querySelector(`[data-lsec="${j}"]`)?.value ?? x.seconds) })) };
    }
    return out;
  });
  return { scenes, links };
}

// part = "scenes" أو "links": بيتبعت الجزء اللي اتعدّل بس، عشان ما يغطيش على اللي البرنامج بيكتبه وهو شغال
async function filmSave(part) {
  const all = filmPlanFrom(), plan = part ? { [part]: all[part] } : all;
  filmx.cur = await api(`/api/films/${filmx.cur.id}`, { method: "PATCH", ...jsonBody({ plan }) });
}

$("labFilmBtn").onclick = () => (labx.view === "film" && !filmx.cur ? (labx.view = "lab", renderLab()) : openFilm());
$("labLibBtn").addEventListener("click", () => clearTimeout(filmx.timer));

$("labFilm").addEventListener("click", async (e) => {
  const t = e.target, F = (path, opts) => api(`/api/films/${filmx.cur.id}${path}`, opts);
  const go = async (btn, fn) => busyButton(btn, "⏳", async () => { filmx.cur = await fn(); renderFilm(); scheduleFilmPoll(); });
  const open = t.closest("[data-fmopen]");
  if (open) return openFilm(open.dataset.fmopen);
  if (t.closest("[data-fmback]")) { filmx.cur = null; return openFilm(); }
  const nb = t.closest("[data-fmnew]");
  if (nb) {
    const box = $("labFilm"), g = (k) => box.querySelector(`[data-${k}]`).value;
    if (!filmx.pick.size) return toast("اختار كونيكتور واحد على الأقل", true);
    return busyButton(nb, "⏳", async () => {
      filmx.cur = await api("/api/films", { method: "POST", ...jsonBody({ brief: g("fmbrief"), connectors: [...filmx.pick],
        scenes: Number(g("fmn")), ratio: g("fmratio"), model: g("fmmodel"), resolution: g("fmres") }) });
      filmx.list = await api("/api/films");
      renderFilm(); scheduleFilmPoll();
    });
  }
  if (!filmx.cur) return;
  if (t.closest("[data-fmdel]")) {
    if (!confirm("تمسح الفيديو ده بكل فريماته؟")) return;
    try { await F("", { method: "DELETE" }); filmx.cur = null; return openFilm(); } catch (err) { return toast(err.message, true); }
  }
  const replan = t.closest("[data-fmreplan]");
  if (replan) {
    if (!confirm("تكتب سيناريو جديد من الأول؟ الفريمات والفيديوهات اللي اتعملت هتتمسح.")) return;
    return go(replan, () => F("/replan", { method: "POST" }));
  }
  const fr = t.closest("[data-fmframes]");
  if (fr) {
    await filmSave();
    if (!confirm(`يرسم الفريمات؟ حوالي ${filmx.cur.costs.frames}$ على Atlas، وبعدها بيكتب خطة كل كونيكتور.`)) return renderFilm();
    return go(fr, () => F("/frames", { method: "POST" }));
  }
  const redo = t.closest("[data-fmredo]");
  if (redo) {
    const i = Number(redo.dataset.fmredo), w = redo.dataset.w;
    const note = $("labFilm").querySelector(`[data-fmnote="${i}"]`)?.value.trim() || "";
    const keys = [...(filmx.sel[i] || [])], refs = keys.filter((k) => k.startsWith("u:")).map((k) => k.slice(2));
    const client = keys.filter((k) => k.startsWith("c:")).map((k) => k.slice(2));
    try { await filmSave("scenes"); } catch (err) { return toast(err.message, true); }
    const what = note || keys.length ? "يعدّل" : "يرسم";
    if (!confirm(`${what} ${w === "a" ? "أول المشهد (وآخره بيترسم من جديد معاه)" : "آخر المشهد"}${note ? ` بالملاحظة: «${note}»` : ""}${keys.length ? ` ومعاه ${keys.length} صورة مرجعية` : ""}؟ (حوالي ${w === "a" ? 0.12 : 0.06}$)`)) return renderFilm();
    return go(redo, async () => {
      const r = await F(`/scenes/${i}/${w}`, { method: "POST", ...jsonBody({ note, refs, client }) });
      delete filmx.sel[i]; delete filmx.notes[i];
      if (r.queue?.length && filmx.cur?.status === "drawing") toast("⏳ اتحط في الدور: هيترسم أول ما اللي شغال يخلص");
      return r;
    });
  }
  const del = t.closest("[data-fmrefdel]");
  if (del) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("تمسح الصورة دي؟")) return;
    Object.values(filmx.sel).forEach((s) => s.delete(`u:${del.dataset.fmrefdel}`));
    try { filmx.cur = await F(`/refs/${encodeURIComponent(del.dataset.fmrefdel)}`, { method: "DELETE" }); renderFilm(); } catch (err) { toast(err.message, true); }
    return;
  }
  const ref = t.closest("[data-fmref]");
  if (ref) {
    const i = ref.dataset.i, s = (filmx.sel[i] ||= new Set()), k = ref.dataset.fmref;
    s.has(k) ? s.delete(k) : s.add(k);
    ref.classList.toggle("on", s.has(k));
    return;
  }
  const lp = t.closest("[data-fmlplan]");
  if (lp) { try { await filmSave("links"); } catch (err) { return toast(err.message, true); } return go(lp, () => F(`/links/${lp.dataset.fmlplan}/plan`, { method: "POST" })); }
  const run = t.closest("[data-fmrun]"), gen = t.closest("[data-fmgen]");
  if (run || gen) {
    await filmSave();
    const c = filmx.cur.costs.video;
    const what = gen ? `${gen.dataset.fmgen === "scene" ? "حركة المشهد" : "الكونيكتور"} ${Number(gen.dataset.i) + 1} تاني` : "الفيديو";
    if (!confirm(`يولّد ${what}؟ هيتحسب على Atlas${c && !gen ? ` حوالي ${c}$` : ""}، وبياخد كام دقيقة.`)) return renderFilm();
    return go(run || gen, () => F("/run", { method: "POST", ...jsonBody(gen ? { kind: gen.dataset.fmgen, i: Number(gen.dataset.i) } : {}) }));
  }
});

$("labFilm").addEventListener("change", async (e) => {
  const t = e.target;
  if (t.matches("[data-fmpick]")) {
    filmx.pick[t.checked ? "add" : "delete"](t.dataset.fmpick);
    t.closest(".fm-conn").classList.toggle("on", t.checked);
    const n = $("labFilm").querySelector(".fm-new b + small");
    if (n) n.textContent = `(${filmx.pick.size} من ${filmx.conns.length})`;
    return;
  }
  if (filmx.cur && t.matches("[data-fmup]")) {
    const file = t.files[0], i = t.dataset.fmup;
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await api(`/api/films/${filmx.cur.id}/refs`, { method: "POST", body: fd });
      filmx.cur = r;
      (filmx.sel[i] ||= new Set()).add(`u:${r.uploaded}`);
      renderFilm(); toast("📎 الصورة اترفعت ومتعلّم عليها");
    } catch (err) { toast(err.message, true); }
    return;
  }
  if (t.matches("[data-fmnote]")) { filmx.notes[t.dataset.fmnote] = t.value; return; }
  if (!filmx.cur) return;
  try {
    if (t.matches("[data-fmname]")) {
      filmx.cur = await api(`/api/films/${filmx.cur.id}`, { method: "PATCH", ...jsonBody({ name: t.value }) });
      return toast("✅ اتحفظ");
    }
    if (t.closest("[data-scene], [data-link]")) {
      await filmSave(t.closest("[data-scene]") ? "scenes" : "links");
      toast("✅ اتحفظ");
      if (t.matches("[data-la], [data-lsec], [data-sf=seconds], [data-sf=motion]")) renderFilm();   // التمن والحاجات اللي هتتولد تاني اتغيرت
    }
  } catch (err) { toast(err.message, true); }
});

$("labFilm").addEventListener("mouseover", (e) => {
  const c = e.target.closest(".fm-conn");
  if (c && !c.contains(e.relatedTarget)) { const v = c.querySelector("video"); v.preload = "auto"; v.play().catch(() => {}); }
});
$("labFilm").addEventListener("mouseout", (e) => {
  const c = e.target.closest(".fm-conn");
  if (c && !c.contains(e.relatedTarget)) c.querySelector("video").pause();
});
$("labFilm").addEventListener("input", (e) => {
  if (e.target.matches("[data-fmnote]")) filmx.notes[e.target.dataset.fmnote] = e.target.value;
});

// القوايم المفتوحة بتفضل مفتوحة لما الصفحة تتحدث وهو شغال
$("labFilm").addEventListener("toggle", (e) => {
  const k = e.target.dataset?.dk;
  if (k) filmx.open[e.target.open ? "add" : "delete"](k);
}, true);
