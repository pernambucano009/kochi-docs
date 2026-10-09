// StudioMania — 🔤 التايبوجرافي جوه المونتاج
// المونتاج مربوط بمشروع تايبوجرافي مخفي (فيديوه هو المونتاج نفسه): الكلام بيتسمع ويتوزّع على العناصر،
// وبيظهر خط «🔤 تايبوجرافي» في التايم لاين، والطبقة بتترسم فوق المعاينة بنفس المحرك، وأدوات التحكم (الأركان والدواير والتراك)
// بتشتغل على المعاينة لما تختار لقطة، والتصدير بيرسمها فوق الفيديو.

const mtx = { id: null, cur: null, doc: null, eng: null, fxdoc: null, fxeng: null, timer: null, loading: null };

const GZ_MT = {
  st: {},
  get doc() { return mtx.doc; }, get eng() { return mtx.eng; }, get t() { return mt.t; }, get playing() { return mt.playing; },
  get cur() { return mtx.cur; }, set cur(v) { mtx.cur = v; },
  box: () => $("previewFrame"), stage: () => $("pvTypoStage"), svg: () => $("mtGiz"), bar: () => $("mtGbar"),
  stop: () => pause(), save: (blocks, msg) => mtTypoSave(blocks, msg), redraw: () => mtTypoDraw(), after: () => { mtTypoPaneRender(); mtTypoPoll(); },
  selIndex: () => (mt.sel?.kind === "typo" ? mt.sel.i : null),
};
// ✨ العناصر الحرة: نفس الأدوات على طبقتها (من غير تراك: التراك بتاع الكلام بس)
const GZ_FX = {
  st: {},
  get doc() { return mtx.fxdoc; }, get eng() { return mtx.fxeng; }, get t() { return mt.t; }, get playing() { return mt.playing; },
  get cur() { return mtx.cur ? { ...mtx.cur, blocks: mtx.cur.fx || [], bg: null, source: null } : null; }, set cur(v) { mtx.cur = v; },
  box: () => $("previewFrame"), stage: () => $("pvFxStage"), svg: () => $("mtGiz"), bar: () => $("mtGbar"),
  stop: () => pause(), save: (fx, msg) => mtFxSave(fx, msg), redraw: () => mtTypoDraw(), after: () => mtTypoPaneRender(),
  selIndex: () => (mt.sel?.kind === "fx" ? mt.sel.i : null),
};

const mtTypoOn = () => mt.project && mt.project.data.typo_on !== false;

// المشروع اتفتح (أو اتغير): نحمّل التايبوجرافي بتاعته لو موجودة
async function mtTypoLoad() {
  const id = mt.project?.data.typo_id || null;
  if (id !== mtx.id) { mtx.id = id; mtx.cur = mtx.doc = mtx.fxdoc = null; mtx.eng = mtx.fxeng = null; $("pvTypoStage").innerHTML = ""; $("pvFxStage").innerHTML = ""; }
  if (!id) { mtTypoPaneRender(); renderTimeline(); return; }
  const job = (async () => {
    try {
      mtx.cur = await api(`/api/typo/${id}`);
      if (mtx.cur.blocks?.length || mtx.cur.fx?.length) await mtTypoDoc();
    } catch (err) {
      mtx.cur = null;
      if (!String(err.message).includes("مش موجود")) toast(err.message, true);
    }
    mtTypoPaneRender();
    renderTimeline();
    syncPreview();
    if (mtx.cur?.busy) mtTypoPoll();
  })();
  mtx.loading = job;
  return job;
}

async function mtTypoDoc() {
  const doc = await api(`/api/typo/${mtx.id}/doc`);
  doc.transparent = true;
  mtx.doc = doc;
  const stage = $("pvTypoStage");
  if (!mtx.eng) mtx.eng = new TypoEngine(stage, doc);
  else mtx.eng.set(doc);
  mtx.eng._cb = null;
  mtx.eng.editing = true;
  stage.style.position = "absolute";
  const fxs = $("pvFxStage"), fxdoc = { ...doc, blocks: doc.fx || [], transparent: true };
  mtx.fxdoc = fxdoc;
  if (!mtx.fxeng) mtx.fxeng = new TypoEngine(fxs, fxdoc);
  else mtx.fxeng.set(fxdoc);
  mtx.fxeng._cb = null;
  mtx.fxeng.editing = true;
  Object.assign(fxs.style, { position: "absolute", left: "0", top: "0" });
  await Promise.all([mtx.eng.ready(), mtx.fxeng.ready()]);
  mtTypoDraw();
}

// الطبقة فوق المعاينة على قد الكادر، وأدوات التحكم لو فيه لقطة تايبوجرافي مختارة والتشغيل واقف
function mtTypoDraw() {
  const wrap = $("pvTypo");
  if (!wrap) return;
  const show = mtTypoOn() && mtx.eng && mtx.doc;
  wrap.hidden = !show;
  if (!show) { $("mtGiz").innerHTML = ""; $("mtGbar").innerHTML = ""; return; }
  const k = $("previewFrame").clientWidth / mtx.doc.w;
  $("pvTypoStage").style.transform = `scale(${k})`;
  $("pvFxStage").style.transform = `scale(${k})`;
  mtx.eng.renderAt(mt.t);
  mtx.fxeng?.renderAt(mt.t);
  const ctx = mt.sel?.kind === "typo" ? GZ_MT : mt.sel?.kind === "fx" ? GZ_FX : null;
  if (ctx && !mt.playing) { if (GZ !== ctx) $("mtGbar").dataset.sig = ""; tyGizBind(ctx); GZ = ctx; tyGizDraw(); }
  else if ($("mtGbar").dataset.sig) { $("mtGiz").innerHTML = ""; $("mtGbar").innerHTML = ""; $("mtGbar").dataset.sig = ""; }
  else $("mtGiz").innerHTML = "";
}

// المعاينة والتايم لاين بتوع المونتاج بينادوا الدوال دي: بنزوّد عليها التايبوجرافي
const _mtOverlays = updatePreviewOverlays;
updatePreviewOverlays = function () { _mtOverlays(); mtTypoDraw(); };

const _mtTimeline = renderTimeline;
renderTimeline = function () { _mtTimeline(); mtTypoTrack(); };

const _mtOpen = openProject;
openProject = function (p) { const r = _mtOpen(p); mtTypoLoad(); return r; };

const _mtInspector = renderInspector;
renderInspector = function () { _mtInspector(); if (mt.sel?.kind === "typo" || mt.sel?.kind === "fx") mtTypoPaneRender(); };

const _mtDelete = deleteSelected;
deleteSelected = function () {
  if (mt.sel?.kind === "fx") {
    const fx = JSON.parse(JSON.stringify(mtx.cur.fx || []));
    fx.splice(mt.sel.i, 1);
    mt.sel = null;
    return mtFxSave(fx, "🗑️ العنصر اتشال");
  }
  if (mt.sel?.kind !== "typo") return _mtDelete();
  const i = mt.sel.i, blocks = JSON.parse(JSON.stringify(mtx.cur.blocks));
  blocks.splice(i, 1);
  mt.sel = null;
  mtTypoSave(blocks, "🗑️ التايبوجرافي اتشالت من الجزء ده");
};
$("tlDelete").onclick = $("edDelete").onclick = () => deleteSelected();

// ---------- خط التايبوجرافي في التايم لاين
// خط كليكات التايبوجرافي: نفس أصوات فيديو التايبوجرافي، بموجتها، وبتشتغل في المعاينة والتصدير
const mtClickOn = () => mt.project && (mt.project.data.typo_sfx?.on ?? true);
const mtClickVol = () => Number(mt.project?.data.typo_sfx?.volume ?? 1);
const mtClickUrl = () => (mtx.id && mtx.doc?.blocks?.length ? `/api/typo/${mtx.id}/clicks.wav?v=${encodeURIComponent(mtx.cur?.updated_at || "")}` : "");
function mtClickTrack() {
  const el = $("trkClick");
  if (!el) return;
  const url = mtClickUrl();
  if (!url) { el.innerHTML = `<div class="tl-empty-track">كليكات التايبوجرافي بتظهر هنا</div>`; return; }
  const dur = mtx.doc.duration;
  el.innerHTML = `<div class="tl-audio click ${mtClickOn() ? "" : "off"}" style="left:0;width:${dur * mt.pps}px" title="كليكات التايبوجرافي (العلو من تاب 🔤)"><canvas></canvas><span class="nm">🔊 كليكات ${mtClickOn() ? `${Math.round(mtClickVol() * 100)}٪` : "(مقفولة)"}</span></div>`;
  drawWave(el.querySelector("canvas"), url, 0, dur, mtClickOn() ? "#ffb86b" : "#6b7180", mtClickOn() ? mtClickVol() : 0.3);
}
let mtClickEl = null;
function mtClickSync() {
  const url = mtClickUrl();
  if (!mt.playing || !url || !mtClickOn() || !mtTypoOn()) { mtClickEl?.pause(); return; }
  if (!mtClickEl) { mtClickEl = new Audio(); mtClickEl.preload = "auto"; }
  syncAudio(mtClickEl, { t0: 0, t1: mtx.doc.duration, offset: 0, url, volume: Math.min(1, mtClickVol()), t: {} }, mt.t, totalLength(), false);
}
const _mtTick = tick;
tick = function () { _mtTick(); mtClickSync(); };
const _mtPause = pause;
pause = function () { const r = _mtPause(); mtClickEl?.pause(); return r; };

function mtTypoTrack() {
  mtClickTrack();
  mtFxTrack();
  const el = $("trkTypo");
  if (!el || !mt.project) return;
  if (!mtx.id || !mtx.doc?.blocks?.length) {
    el.innerHTML = `<div class="tl-empty-track">${mtx.cur?.busy ? `⏳ ${escapeHtml(mtx.cur.step || "بيشتغل")}` : "مفيش تايبوجرافي: دوس «🧠 وزّع التايبوجرافي» من تاب 🔤"}</div>`;
    return;
  }
  el.innerHTML = mtx.doc.blocks.map((b, i) => {
    const sel = mt.sel?.kind === "typo" && mt.sel.i === i;
    const label = (TY_KINDS[b.kind] || b.kind).replace(/^[⭐🎬\s]+/, "");
    const txt = (b.words || []).map((w) => w.w).join(" ");
    return `<div class="tl-typo ${sel ? "selected" : ""}" data-ty="${i}" title="${escapeHtml(txt)}" style="left:${b.t0 * mt.pps}px;width:${Math.max(4, (b.t1 - b.t0) * mt.pps)}px">
      ${b.trans ? `<span class="tr" title="ترانزيشن">◆</span>` : ""}<b>${escapeHtml(label)}</b><span dir="auto">${escapeHtml(txt)}</span>
      <i class="h l" data-h="l"></i><i class="h r" data-h="r"></i></div>`;
  }).join("");
}

$("trkTypo").addEventListener("pointerdown", (e) => {
  const box = e.target.closest(".tl-typo");
  if (!box) return;
  e.stopPropagation();
  const i = Number(box.dataset.ty), b = mtx.doc.blocks[i];
  mt.sel = { kind: "typo", i };
  showTab("typo");
  const h = e.target.dataset.h;
  if (!h) {
    pause();
    if (mt.t < b.t0 || mt.t >= b.t1) seek(b.t0 + 0.05);
    renderTimeline(); mtTypoPaneRender(); syncPreview();
    return;
  }
  // سحب طرف اللقطة: الحدود بتتنقل لأقرب كلمة (الكلمة بتروح للقطة اللي جنبها)
  const words = mtx.cur.words || [];
  const raw = JSON.parse(JSON.stringify(mtx.cur.blocks));
  const x0 = e.clientX, t0 = h === "l" ? b.t0 : b.t1;
  let k = null;
  box.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const t = t0 + (ev.clientX - x0) / mt.pps;
    let best = 0, bd = 1e9;
    words.forEach((w, j) => { const d = Math.abs(w.s - t); if (d < bd) { bd = d; best = j; } });
    const r = raw[i], prev = raw[i - 1], next = raw[i + 1];
    if (h === "l") k = Math.max(prev ? prev.from + 1 : 0, Math.min(best, r.to));
    else k = Math.min(next ? next.to : words.length - 1, Math.max(best - 1, r.from));
    const at = h === "l" ? words[k]?.s : words[k + 1]?.s ?? mtx.doc.duration;
    box.style[h === "l" ? "left" : "width"] = h === "l" ? `${at * mt.pps}px` : `${Math.max(4, (at - b.t0) * mt.pps)}px`;
  };
  const up = () => {
    box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up);
    if (k == null) return;
    const r = raw[i];
    if (h === "l") { if (raw[i - 1]) raw[i - 1].to = k - 1; r.from = k; }
    else { r.to = k; if (raw[i + 1]) raw[i + 1].from = k + 1; }
    for (const x of raw) x.text = "";
    mtTypoSave(raw.filter((x) => x.from <= x.to), "↔️ اتظبطت");
  };
  box.addEventListener("pointermove", move);
  box.addEventListener("pointerup", up);
});

// ---------- الحفظ والمتابعة
async function mtTypoSave(blocks, msg) {
  try {
    mtx.cur = await api(`/api/typo/${mtx.id}`, { method: "PATCH", ...jsonBody({ blocks }) });
    await mtTypoDoc();
    renderTimeline();
    mtTypoPaneRender();
    if (msg) toast(msg);
  } catch (err) { toast(err.message, true); }
}

function mtTypoPoll() {
  clearTimeout(mtx.timer);
  if (!mtx.id || !mtx.cur?.busy) return;
  mtx.timer = setTimeout(async () => {
    try {
      const id = mtx.id;
      const cur = await api(`/api/typo/${id}`);
      if (id !== mtx.id) return;
      mtx.cur = cur;
      if (!cur.busy) {
        if (cur.blocks?.length) await mtTypoDoc();
        if (cur.status === "failed") toast(`🔤 ${cur.error || "التوزيع فشل"}`, true);
        else if (cur.blocks?.length) toast("🔤 التايبوجرافي اتوزّعت على المونتاج");
        syncPreview();
      }
      renderTimeline();
      mtTypoPaneRender();
      mtTypoPoll();
    } catch (err) { toast(err.message, true); }
  }, 2500);
}

// ---------- تاب 🔤 تايبوجرافي
function mtTypoPaneRender() {
  const el = $("mtTypoPane");
  if (!el || !mt.project) return;
  const d = mt.project.data, c = mtx.cur, busy = !!c?.busy;
  const stale = c?.source?.duration && Math.abs(c.source.duration - totalLength()) > 0.25;
  let h = `<div class="mt-typo-row">
    <p class="hint">الكلام اللي في المونتاج بيتسمع ويتوزّع على عناصر التايبوجرافي، ويظهر في خط «🔤 تايبوجرافي» تحت. دوس على أي لقطة في الخط عشان تغيّر عنصرها أو الترانزيشن، والأدوات بتظهر على المعاينة (اسحب، كبّر، لفّ، أركان، ورا الشخص، تراك).</p>
    ${busy ? `<p><span class="spin-inline"></span> ${escapeHtml(c.step || "بيشتغل…")}</p>` : ""}
    ${c?.status === "failed" ? `<p class="err">⚠️ ${escapeHtml(c.error || "")}</p>` : ""}
    ${stale && !busy ? `<p class="hint">⚠️ المونتاج اتغيّر بعد ما اتوزّعت التايبوجرافي (الطول مختلف): وزّعها من جديد عشان المواعيد تتظبط.</p>` : ""}
    <input type="text" id="mtTypoBrief" placeholder="عن الفيديو (اختياري): مين بيتكلم ولمين وإيه الإحساس" value="${escapeHtml(c?.brief || "")}">
    <div class="row wrap"><button class="btn primary sm" id="mtTypoPlan" ${busy || !d.clips.length ? "disabled" : ""}>🧠 ${c?.blocks?.length ? "وزّع من جديد" : "وزّع التايبوجرافي"}</button>
      ${c ? `<label class="check"><input type="checkbox" id="mtTypoOn" ${mtTypoOn() ? "checked" : ""}> اظهرها في المعاينة والتصدير</label>` : ""}
      ${c ? `<button class="btn sm" id="mtTypoOpen" title="المحرر الكامل: الستايل والأيقونات والعلامات">✏️ المحرر الكامل</button>` : ""}</div>
    ${c?.blocks?.length ? `<div class="row wrap"><label class="check"><input type="checkbox" id="mtClickOn" ${mtClickOn() ? "checked" : ""}> 🔊 كليكات التايبوجرافي</label>
      <label>العلو <b>${Math.round(mtClickVol() * 100)}٪</b> <input type="range" id="mtClickVol" min="0" max="200" step="5" value="${Math.round(mtClickVol() * 100)}" ${mtClickOn() ? "" : "disabled"}></label></div>` : ""}
  </div>`;
  const i = mt.sel?.kind === "typo" ? mt.sel.i : -1, b = mtx.doc?.blocks?.[i], r = mtx.cur?.blocks?.[i];
  if (b && r) {
    const txt = (b.words || []).map((w) => w.w).join(" ");
    const studio = window.TypoEngine?.STUDIO?.has(r.kind);
    h += `<div class="mt-typo-row"><h3>لقطة ${i + 1} <small class="muted" dir="auto">«${escapeHtml(txt)}»</small></h3>
      <label>العنصر <select id="mtTyKind">${Object.entries(TY_KINDS).map(([k, l]) => `<option value="${k}" ${k === r.kind ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      ${studio ? `<label>🎞️ الترانزيشن <select id="mtTyTrans">${Object.entries(TY_TRANS).map(([k, l]) => `<option value="${k}" ${k === (r.trans || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>` : ""}
      <div><b>✏️ الكلام</b> <small class="muted">دوس على أي كلمة وصلّحها لو اتسمعت غلط (توقيتها بيفضل زي ما هو)</small>
        <div class="wd-row" dir="auto">${(mtx.cur.words || []).slice(r.from, r.to + 1).map((w, j) => `<input class="wd" data-wi="${r.from + j}" value="${escapeHtml(w.w)}" size="${Math.max(2, [...w.w].length + 1)}" dir="auto" spellcheck="false">`).join("")}</div></div>
      <details class="wd-more"><summary>اكتب الكلام اللي يظهر بنفسك (بدل اللي اتقال)</summary>
        <input id="mtTyText" value="${escapeHtml(r.text || "")}" placeholder="${escapeHtml(txt)}" dir="auto"></details>
      <div class="row wrap"><button class="btn sm" id="mtTyPrev">→ اللي قبلها</button><button class="btn sm" id="mtTyNext">اللي بعدها ←</button>
        <button class="btn sm danger" id="mtTyDel">🗑 شيلها</button></div></div>`;
  }
  h += mtFxPaneHtml();
  el.innerHTML = h;
}

$("mtTypoPane").addEventListener("click", async (e) => {
  const t = e.target;
  if (t.id === "mtTypoPlan") {
    if (mtx.cur?.blocks?.length && !confirm("توزّع التايبوجرافي من جديد؟ التعديلات اللي عملتها عليها هتتبدل.")) return;
    await saveProject();
    try {
      const res = await api(`/api/projects/${mt.project.id}/typo`, { method: "POST", ...jsonBody({ brief: $("mtTypoBrief")?.value || "" }) });
      mt.project.data.typo_id = res.id;
      mtx.id = res.id; mtx.cur = res; mtx.doc = null;
      mtx.eng = null; $("pvTypoStage").innerHTML = "";
      scheduleSave();
      mtTypoPaneRender(); renderTimeline(); mtTypoPoll();
      toast("🧠 بيجهّز المونتاج ويسمع الكلام… دي بتاخد دقيقة أو اتنين");
    } catch (err) { toast(err.message, true); }
    return;
  }
  if (t.id === "mtTypoOpen") {
    await saveProject();
    document.querySelector('[data-goto="12"]')?.click();
    setTimeout(() => tyOpen(mtx.id).catch((err) => toast(err.message, true)), 300);
    return;
  }
  const i = mt.sel?.kind === "typo" ? mt.sel.i : -1;
  if (t.id === "mtTyPrev" || t.id === "mtTyNext") {
    const j = i + (t.id === "mtTyNext" ? 1 : -1), b = mtx.doc?.blocks?.[j];
    if (!b) return;
    mt.sel = { kind: "typo", i: j };
    seek(b.t0 + 0.05); renderTimeline(); mtTypoPaneRender();
    return;
  }
  if (t.id === "mtTyDel") deleteSelected();
});

$("mtTypoPane").addEventListener("input", (e) => {
  if (e.target.classList.contains("wd")) e.target.size = Math.max(2, [...e.target.value].length + 1);
});
$("mtTypoPane").addEventListener("change", async (e) => {
  const t = e.target;
  if (t.classList.contains("wd")) {   // تصليح كلمة: نفس العدد والأوقات، والكلام بيتحدث في كل اللقطات
    const v = t.value.trim();
    if (!v) { t.value = mtx.cur.words[Number(t.dataset.wi)].w; return; }
    const words = mtx.cur.words.map((w) => w.w);
    words[Number(t.dataset.wi)] = v;
    try {
      mtx.cur = await api(`/api/typo/${mtx.id}`, { method: "PATCH", ...jsonBody({ words }) });
      await mtTypoDoc(); renderTimeline(); toast("✏️ الكلمة اتصلّحت");
    } catch (err) { toast(err.message, true); }
    return;
  }
  if (t.id === "mtTypoOn") { mt.project.data.typo_on = t.checked; scheduleSave(); return mtTypoDraw(); }
  if (t.id === "mtClickOn" || t.id === "mtClickVol") {
    const ts = mt.project.data.typo_sfx = { on: true, volume: 1, ...(mt.project.data.typo_sfx || {}) };
    if (t.id === "mtClickOn") ts.on = t.checked; else ts.volume = Number(t.value) / 100;
    scheduleSave(); mtClickTrack(); mtTypoPaneRender();
    return;
  }
  const i = mt.sel?.kind === "typo" ? mt.sel.i : -1;
  if (i < 0 || !mtx.cur?.blocks?.[i]) return;
  const blocks = JSON.parse(JSON.stringify(mtx.cur.blocks));
  if (t.id === "mtTyKind") blocks[i].kind = t.value;
  else if (t.id === "mtTyTrans") blocks[i].trans = t.value;
  else if (t.id === "mtTyText") blocks[i].text = t.value;
  else return;
  mtTypoSave(blocks);
});

// الخلفية الشفافة: صفحة المونتاج ما بتحتاجش ستايل خلفية للكلام
window.addEventListener("resize", () => mtTypoDraw());


// ---------- ✨ خط العناصر الحرة: عنصر في أي وقت (اسمك، QR، أرقام، شعار…) من غير ما يكون مربوط بكلام متقال
const FX_DEFAULT = "lowerthird";

async function mtFxEnsure() {   // العناصر محتاجة مشروع تايبوجرافي مربوط (من غير ما يسمع ولا يوزّع)
  if (mtx.id && mtx.cur) return true;
  await saveProject();
  try {
    const res = await api(`/api/projects/${mt.project.id}/typo`, { method: "POST", ...jsonBody({ run: false }) });
    mt.project.data.typo_id = res.id;
    mtx.id = res.id; mtx.cur = res;
    scheduleSave();
    return true;
  } catch (err) { toast(err.message, true); return false; }
}

async function mtFxSave(fx, msg) {
  try {
    mtx.cur = await api(`/api/typo/${mtx.id}`, { method: "PATCH", ...jsonBody({ fx }) });
    await mtTypoDoc();
    renderTimeline();
    mtTypoPaneRender();
    if (msg) toast(msg);
  } catch (err) { toast(err.message, true); }
}

async function mtFxAdd(kind, text) {
  if (!(await mtFxEnsure())) return;
  const fx = JSON.parse(JSON.stringify(mtx.cur.fx || []));
  const t0 = Math.round(mt.t * 100) / 100;
  fx.push({ id: `fx${Date.now().toString(36)}`, t0, t1: t0 + 2.5, kind: kind || FX_DEFAULT, text: text || "اكتب هنا", theme: "dark" });
  await mtFxSave(fx, "✨ العنصر اتضاف عند المؤشر");
  const i = (mtx.cur.fx || []).findIndex((q) => Math.abs(q.t0 - t0) < 0.01);
  if (i >= 0) { mt.sel = { kind: "fx", i }; showTab("typo"); renderTimeline(); mtTypoPaneRender(); syncPreview(); }
}

function mtFxTrack() {
  const el = $("trkFx");
  if (!el || !mt.project) return;
  const fx = mtx.cur?.fx || [];
  if (!fx.length) { el.innerHTML = `<div class="tl-empty-track">دوس ＋ عشان تحط عنصر في أي وقت (اسمك، QR، رقم، شعار…)</div>`; return; }
  // العناصر اللي بتتراكب بتنزل صف تحت التاني
  const lanes = [];
  const lane = fx.map((q) => { let k = 0; while ((lanes[k] ?? -1) > q.t0 + 0.001) k++; lanes[k] = q.t1; return k; });
  const n = Math.max(1, lanes.length), hh = 100 / n;
  el.innerHTML = fx.map((q, i) => {
    const sel = mt.sel?.kind === "fx" && mt.sel.i === i;
    const label = (TY_KINDS[q.kind] || q.kind).replace(/^[⭐🎬\s]+/, "");
    return `<div class="tl-fx ${sel ? "selected" : ""}" data-fx="${i}" title="${escapeHtml(q.text)}" style="left:${q.t0 * mt.pps}px;width:${Math.max(6, (q.t1 - q.t0) * mt.pps)}px;top:calc(${lane[i] * hh}% + 2px);height:calc(${hh}% - 4px)">
      ${q.trans ? `<span class="tr">◆</span>` : ""}<b>${escapeHtml(label)}</b><span dir="auto">${escapeHtml(q.text)}</span><i class="h l" data-h="l"></i><i class="h r" data-h="r"></i></div>`;
  }).join("");
}

$("trkFx").addEventListener("pointerdown", (e) => {
  const box = e.target.closest(".tl-fx");
  if (!box) return;
  e.stopPropagation();
  const i = Number(box.dataset.fx), fx = JSON.parse(JSON.stringify(mtx.cur.fx)), q = fx[i];
  mt.sel = { kind: "fx", i };
  showTab("typo");
  pause();
  const h = e.target.dataset.h, x0 = e.clientX, a = q.t0, z = q.t1;
  let moved = false;
  box.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const dt = Math.round(((ev.clientX - x0) / mt.pps) * 30) / 30;
    if (Math.abs(ev.clientX - x0) > 2) moved = true;
    if (h === "l") q.t0 = Math.max(0, Math.min(z - 0.2, a + dt));
    else if (h === "r") q.t1 = Math.max(a + 0.2, z + dt);
    else { q.t0 = Math.max(0, a + dt); q.t1 = q.t0 + (z - a); }
    box.style.left = `${q.t0 * mt.pps}px`;
    box.style.width = `${Math.max(6, (q.t1 - q.t0) * mt.pps)}px`;
  };
  const up = () => {
    box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up);
    if (moved) return mtFxSave(fx);
    if (mt.t < q.t0 || mt.t >= q.t1) seek(q.t0 + 0.05);
    renderTimeline(); mtTypoPaneRender(); syncPreview();
  };
  box.addEventListener("pointermove", move);
  box.addEventListener("pointerup", up);
});

$("fxAddQuick").addEventListener("click", (e) => { e.stopPropagation(); showTab("typo"); mtFxAdd(FX_DEFAULT, ""); });

function mtFxPaneHtml() {
  const kinds = Object.entries(TY_KINDS).filter(([k]) => window.TypoEngine?.STUDIO?.has(k));
  const i = mt.sel?.kind === "fx" ? mt.sel.i : -1, q = mtx.cur?.fx?.[i];
  let h = `<div class="mt-typo-row fx-box"><h3>✨ العناصر الحرة</h3>
    <p class="hint">عنصر يظهر في أي وقت تختاره حتى لو مش مربوط بكلام متقال، زي اسمك في الأول، أو QR في الآخر، أو رقم مهم. بيظهر فوق التايبوجرافي.</p>
    <div class="row wrap"><select id="fxNewKind">${kinds.map(([k, l]) => `<option value="${k}" ${k === FX_DEFAULT ? "selected" : ""}>${l}</option>`).join("")}</select>
      <input id="fxNewText" placeholder="الكلام اللي فيه" dir="auto">
      <button class="btn sm primary" id="fxAdd">＋ ضيف عند المؤشر</button></div></div>`;
  if (q) {
    h += `<div class="mt-typo-row fx-box"><h3>عنصر ${i + 1} <small class="muted" dir="ltr">${fmtTC(q.t0)} ← ${fmtTC(q.t1)}</small></h3>
      <label>العنصر <select id="fxKind">${kinds.map(([k, l]) => `<option value="${k}" ${k === q.kind ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>🎞️ الترانزيشن <select id="fxTrans">${Object.entries(TY_TRANS).map(([k, l]) => `<option value="${k}" ${k === (q.trans || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>الكلام <input id="fxText" value="${escapeHtml(q.text)}" dir="auto"></label>
      <div class="row wrap"><button class="btn sm" id="fxHere">⇤ يبدأ عند المؤشر</button><button class="btn sm" id="fxDup">⧉ كرّر</button>
        <button class="btn sm danger" id="fxDel">🗑 شيله</button></div>
      <p class="hint">اسحبه في خط «✨ عناصر» عشان تغيّر وقته، ومن طرفه عشان تطوّله أو تقصّره. والأدوات على المعاينة بتحرّكه وتلفّه.</p></div>`;
  }
  return h;
}

$("mtTypoPane").addEventListener("click", (e) => {
  const t = e.target, i = mt.sel?.kind === "fx" ? mt.sel.i : -1;
  if (t.id === "fxAdd") return mtFxAdd($("fxNewKind").value, $("fxNewText").value.trim());
  if (i < 0 || !mtx.cur?.fx?.[i]) return;
  const fx = JSON.parse(JSON.stringify(mtx.cur.fx)), q = fx[i];
  if (t.id === "fxDel") return deleteSelected();
  if (t.id === "fxDup") { const len = q.t1 - q.t0; fx.push({ ...q, id: `fx${Date.now().toString(36)}`, t0: q.t1, t1: q.t1 + len }); return mtFxSave(fx, "⧉ اتكرر بعده"); }
  if (t.id === "fxHere") { const len = q.t1 - q.t0; q.t0 = Math.round(mt.t * 100) / 100; q.t1 = q.t0 + len; return mtFxSave(fx); }
});

$("mtTypoPane").addEventListener("change", (e) => {
  const t = e.target, i = mt.sel?.kind === "fx" ? mt.sel.i : -1;
  if (!["fxKind", "fxTrans", "fxText"].includes(t.id) || i < 0 || !mtx.cur?.fx?.[i]) return;
  const fx = JSON.parse(JSON.stringify(mtx.cur.fx));
  fx[i][{ fxKind: "kind", fxTrans: "trans", fxText: "text" }[t.id]] = t.value;
  mtFxSave(fx);
});

// ---------- ◆ ترانزيشنز بين لقطات الفيديو: معيّن بين كل قطعتين، تدوس عليه وتختار
const MT_TRANS = [["", "من غير", "✂️"], ["fade", "تلاشي", "◐"], ["fadeblack", "سواد", "●"], ["fadewhite", "فلاش أبيض", "○"], ["dissolve", "ذوبان", "░"],
  ["slideleft", "زحلقة", "⇠"], ["smoothleft", "زحلقة ناعمة", "↜"], ["slideup", "لفوق", "⇡"], ["wipeleft", "مسحة", "▤"], ["circleopen", "دايرة بتفتح", "◎"],
  ["radial", "عقارب", "◔"], ["zoomin", "زووم", "⊕"], ["pixelize", "بكسلات", "▦"], ["hblur", "ضباب", "≋"], ["squeezeh", "عصرة", "⇔"], ["diagtl", "مايلة", "◩"]];
const mtTransName = (k) => (MT_TRANS.find((x) => x[0] === k) || [k, k])[1];

function mtTransMarks() {
  const tv = $("trkVideo");
  if (!tv || !mt.project) return;
  const { items } = seq();
  tv.querySelectorAll(".tl-trans").forEach((x) => x.remove());
  items.forEach((it, k) => {
    if (k === 0 || it.kind !== "clip" || items[k - 1].kind !== "clip") return;
    const tr = it.c.trans;
    const el = document.createElement("button");
    el.type = "button";
    el.className = `tl-trans ${tr?.type ? "on" : ""}`;
    el.dataset.ci = it.i;
    el.title = tr?.type ? `ترانزيشن: ${mtTransName(tr.type)} (${(tr.dur || 0.5).toFixed(1)}ث)` : "ضيف ترانزيشن بين اللقطتين";
    el.style.left = `${it.t0 * mt.pps}px`;
    el.innerHTML = `<i></i>`;
    tv.appendChild(el);
  });
}
const _mtTimeline2 = renderTimeline;
renderTimeline = function () { _mtTimeline2(); mtTransMarks(); };

function mtTransPop(ci, anchor) {
  document.querySelector(".tr-pop")?.remove();
  const c = mt.project.data.clips[ci];
  const cur = c.trans?.type || "", dur = c.trans?.dur || 0.5;
  const pop = document.createElement("div");
  pop.className = "tr-pop";
  pop.innerHTML = `<div class="tr-head"><b>◆ الترانزيشن</b><button type="button" class="tr-x" data-trx>✕</button></div>
    <div class="tr-grid">${MT_TRANS.map(([k, l, ic]) => `<button type="button" class="tr-opt ${k === cur ? "on" : ""}" data-trk="${k}"><span class="tr-ic tr-${k || "cut"}">${ic}</span>${l}</button>`).join("")}</div>
    <label class="tr-dur">المدة <b>${dur.toFixed(1)}ث</b><input type="range" min="0.2" max="1.5" step="0.1" value="${dur}" data-trd ${cur ? "" : "disabled"}></label>
    <small class="muted">الطول الكلي للفيديو مبيتغيّرش، والترانزيشن بيبقى في نص اللقطتين. المعاينة هنا تقريبية، والتصدير بيعمله بالظبط.</small>`;
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const pw = 330;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - pw - 8, r.left + r.width / 2 - pw / 2))}px`;
  pop.style.top = `${Math.max(8, r.top - pop.offsetHeight - 10)}px`;
  const set = (patch) => {
    pushHistory();
    const t = { type: cur, dur, ...(c.trans || {}), ...patch };
    c.trans = t.type ? { type: t.type, dur: t.dur || 0.5 } : null;
    changed();
  };
  pop.addEventListener("click", (e) => {
    const o = e.target.closest("[data-trk]");
    if (o) { set({ type: o.dataset.trk }); mtTransPop(ci, document.querySelector(`.tl-trans[data-ci="${ci}"]`) || anchor); return; }
    if (e.target.closest("[data-trx]")) pop.remove();
  });
  pop.addEventListener("change", (e) => { if (e.target.matches("[data-trd]")) { set({ dur: Number(e.target.value) }); mtTransPop(ci, document.querySelector(`.tl-trans[data-ci="${ci}"]`) || anchor); } });
  pop.addEventListener("input", (e) => { if (e.target.matches("[data-trd]")) pop.querySelector(".tr-dur b").textContent = `${Number(e.target.value).toFixed(1)}ث`; });
  setTimeout(() => document.addEventListener("pointerdown", function off(ev) {
    if (!pop.contains(ev.target) && !ev.target.closest(".tl-trans")) { pop.remove(); document.removeEventListener("pointerdown", off, true); }
  }, true), 0);
}

$("trkVideo").addEventListener("pointerdown", (e) => {
  const m = e.target.closest(".tl-trans");
  if (!m) return;
  e.stopPropagation(); e.preventDefault();
  mtTransPop(Number(m.dataset.ci), m);
}, true);

// المعاينة: الترانزيشن بيتشاف تقريبًا (تغميق/فلاش/ضباب حوالين القطع)، والتصدير بيعمله حقيقي
function mtTransPreview() {
  let ov = $("pvTrans");
  if (!ov) { ov = document.createElement("div"); ov.id = "pvTrans"; ov.className = "pv-trans"; $("previewFrame").appendChild(ov); }
  ov.style.opacity = 0; $("pvStage").style.filter = ""; $("pvStage").style.transform = "";
  if (!mt.project) return;
  const { items } = seq();
  for (let k = 1; k < items.length; k++) {
    const it = items[k], tr = it.kind === "clip" && it.c.trans;
    if (!tr?.type) continue;
    const d = tr.dur || 0.5, T = it.t0;
    if (mt.t < T - d / 2 || mt.t > T + d / 2) continue;
    const p = 1 - Math.abs(mt.t - T) / (d / 2);   // 0 → 1 عند القطع → 0
    const white = tr.type === "fadewhite";
    ov.style.background = white ? "#fff" : "#000";
    ov.style.opacity = (["fade", "dissolve"].includes(tr.type) ? p * 0.55 : ["fadeblack", "fadewhite"].includes(tr.type) ? p : p * 0.25).toFixed(3);
    if (["hblur", "pixelize", "dissolve", "zoomin"].includes(tr.type)) $("pvStage").style.filter = `blur(${(p * 6).toFixed(1)}px)`;
    if (tr.type === "zoomin") $("pvStage").style.transform = `scale(${(1 + p * 0.15).toFixed(3)})`;
    break;
  }
}
const _mtOverlays2 = updatePreviewOverlays;
updatePreviewOverlays = function () { _mtOverlays2(); mtTransPreview(); };
