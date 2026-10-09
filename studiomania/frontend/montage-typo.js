// StudioMania — 🔤 التايبوجرافي جوه المونتاج
// المونتاج مربوط بمشروع تايبوجرافي مخفي (فيديوه هو المونتاج نفسه): الكلام بيتسمع ويتوزّع على العناصر،
// وبيظهر خط «🔤 تايبوجرافي» في التايم لاين، والطبقة بتترسم فوق المعاينة بنفس المحرك، وأدوات التحكم (الأركان والدواير والتراك)
// بتشتغل على المعاينة لما تختار لقطة، والتصدير بيرسمها فوق الفيديو.

const mtx = { id: null, cur: null, doc: null, eng: null, timer: null, loading: null };

const GZ_MT = {
  st: {},
  get doc() { return mtx.doc; }, get eng() { return mtx.eng; }, get t() { return mt.t; }, get playing() { return mt.playing; },
  get cur() { return mtx.cur; }, set cur(v) { mtx.cur = v; },
  box: () => $("previewFrame"), stage: () => $("pvTypoStage"), svg: () => $("mtGiz"), bar: () => $("mtGbar"),
  stop: () => pause(), save: (blocks, msg) => mtTypoSave(blocks, msg), redraw: () => mtTypoDraw(), after: () => { mtTypoPaneRender(); mtTypoPoll(); },
};

const mtTypoOn = () => mt.project && mt.project.data.typo_on !== false;

// المشروع اتفتح (أو اتغير): نحمّل التايبوجرافي بتاعته لو موجودة
async function mtTypoLoad() {
  const id = mt.project?.data.typo_id || null;
  if (id !== mtx.id) { mtx.id = id; mtx.cur = mtx.doc = null; mtx.eng = null; $("pvTypoStage").innerHTML = ""; }
  if (!id) { mtTypoPaneRender(); renderTimeline(); return; }
  const job = (async () => {
    try {
      mtx.cur = await api(`/api/typo/${id}`);
      if (mtx.cur.blocks?.length) await mtTypoDoc();
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
  await mtx.eng.ready();
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
  mtx.eng.renderAt(mt.t);
  if (mt.sel?.kind === "typo" && !mt.playing) { tyGizBind(GZ_MT); GZ = GZ_MT; tyGizDraw(); }
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
renderInspector = function () { _mtInspector(); if (mt.sel?.kind === "typo") mtTypoPaneRender(); };

const _mtDelete = deleteSelected;
deleteSelected = function () {
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
