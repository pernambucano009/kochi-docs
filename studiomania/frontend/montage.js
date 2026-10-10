// StudioMania — الخطوة 6: المونتاج (محرر بتايم لاين زي كاب كات)

const FPS = 30;
const PV_W = 252, PV_H = 448; // حجم كادر المعاينة (9:16)
const MIN_CLIP = 1 / 30; // أقل طول لقطعة: فريم واحد
const PPS_MIN = 8, PPS_MAX = 600; // حدود زووم التايم لاين (بكسل لكل ثانية)
// كل قسم ليه مونتاج لوحده: مشاريعه ومشروعه المفتوح (فيديوهات المدربين / المسلسلات / الإعلانات)
const SECTION_OF_STEP = { "6": "coach", "6s": "series", "6a": "ads" };
const SECTION_BACK = { series: ["9", "↩ رجوع للمسلسلات"], ads: ["10", "↩ رجوع للإعلانات"] };
const projectKey = (section) => section === "coach" ? "studiomania.projectId" : `studiomania.projectId.${section}`;
let PROJECT_KEY = projectKey("coach");
const CLIP_DEFAULTS = { start: 0, end: null, zoom: 1, x: 0, y: 0, volume: 1 };

const mt = {
  projects: [], project: null, sources: [], coaches: [], voices: [], music: [], videos: [],
  sel: null, // {kind: "clip", i} | {kind: "outro"} | {kind: "voice"} | {kind: "music"}
  saveTimer: null, pollTimer: null,
  t: 0, playing: false, raf: 0, clock: 0, clockT: 0, activeKey: null, active: null, activeItem: null,
  pps: 60, tool: "select", undo: [], redo: [], histKey: null, histAt: 0,
};

// الاختيار: mt.sel هي القطعة الأساسية، وmt.extra القطع التانية اللي اتختارت بـ Ctrl أو بالتحديد
let selPrimary = null;
mt.extra = [];
Object.defineProperty(mt, "sel", {
  get: () => selPrimary,
  set: (v) => { selPrimary = v; mt.extra = []; }, // اختيار عادي بيلغي الاختيار المتعدد
});
const selKey = (x) => (x ? `${x.kind}:${x.i ?? x.p ?? ""}` : "");
function allSelected() {
  const out = [], seen = new Set();
  for (const x of [...mt.extra, mt.sel]) if (x && !seen.has(selKey(x))) { seen.add(selKey(x)); out.push(x); }
  return out;
}
const isSel = (x) => allSelected().some((y) => selKey(y) === selKey(x));
function setSelection(list) {
  selPrimary = list[list.length - 1] || null;
  mt.extra = list.slice(0, -1);
}
function selOfEl(el) {
  if (el.classList.contains("tl-cap")) return { kind: "cap", i: Number(el.dataset.c) };
  if (el.dataset.track) return { kind: el.dataset.track, p: Number(el.dataset.p) };
  if (el.dataset.outro) return { kind: "outro" };
  return { kind: "clip", i: Number(el.dataset.i) };
}
function elOfSel(x) {
  if (x.kind === "cap") return $("trkCaps").querySelector(`.tl-cap[data-c="${x.i}"]`);
  if (x.kind === "clip") return $("trkVideo").querySelector(`.tl-clip[data-i="${x.i}"]`);
  if (x.kind === "outro") return $("trkVideo").querySelector(".tl-clip[data-outro]");
  return document.querySelector(`.tl-audio[data-track="${x.kind}"][data-p="${x.p}"]`);
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const snap = (t) => Math.round(t * FPS) / FPS;
const isMontage = () => !document.querySelector('.view[data-view="6"]').hidden;

function fmtTC(t) {
  const f = Math.round(Math.max(0, t) * FPS);
  const s = Math.floor(f / FPS);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 60))}:${p(s % 60)}:${p(f % FPS)}`;
}

// الموسيقى الافتراضية لأي مشروع جديد: «beat» من مكتبة الموسيقى لو موجودة
const DEFAULT_MUSIC = "beat";
function defaultMusic() {
  const list = mt.music || [];
  const a = list.find((x) => x.name.trim().toLowerCase() === DEFAULT_MUSIC) || list.find((x) => x.name.toLowerCase().includes(DEFAULT_MUSIC));
  return a ? { id: a.id, volume: 0.3, delay: 0, offset: 0, length: null, fade_out: true, parts: [{ delay: 0, offset: 0, length: null, volume: 0.3 }] } : null;
}
function blankProject(name) {
  return { name, coach_id: null, clips: [], voice: null, music: defaultMusic(), outro: true, outro_volume: 1 };
}

async function initMontage() {
  const section = SECTION_OF_STEP[shell.step] || "coach";
  if (section !== mt.section) mt.project = null;  // قسم تاني: متفتحش مشروع القسم اللي فات
  mt.section = section;
  PROJECT_KEY = projectKey(section);
  const back = SECTION_BACK[section];
  $("montageBack").hidden = !back;
  if (back) { $("montageBack").dataset.goto = back[0]; $("montageBack").textContent = back[1]; }
  $("newFromVideo").hidden = section !== "coach";
  let all;
  [all, mt.sources, mt.coaches, mt.voices, mt.music, mt.videos, mt.sfx] = await Promise.all([
    api("/api/projects"), api("/api/montage/sources"), api("/api/coaches"),
    api("/api/audio?kind=voice"), api("/api/audio?kind=music"), api("/api/videos"),
    api("/api/montage/sfx").catch(() => []),
  ]);
  mt.projects = all.filter((p) => (p.section || "coach") === section);
  fillSelects();
  const wanted = mt.project?.id || storageGet(PROJECT_KEY);
  const p = mt.projects.find((x) => x.id === wanted) || mt.projects[0];
  openProject(p || null);
  // جاي من صفحة التوليد: نجيب آخر الفيديوهات المولَّدة للمشروع
  const handoff = mt.handoff;
  mt.handoff = null;
  if (handoff?.draft) reportDraft(handoff.draft);
  else if (handoff?.refresh && mt.project?.data.video_id) await $("refreshFromVideo").onclick();
}

function fillSelects() {
  const keep = $("newFromVideo").value;
  $("newFromVideo").innerHTML = `<option value="">مشروع فاضي</option>` +
    mt.videos.map((v) => `<option value="${v.id}">من فيديو: ${escapeHtml(v.name)}${v.voice ? " 🎙️" : ""}</option>`).join("");
  $("newFromVideo").value = mt.videos.some((v) => v.id === keep) ? keep : "";
  $("mCoach").innerHTML = `<option value="">— اختار —</option>` +
    mt.coaches.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  $("mVoice").innerHTML = `<option value="">بدون تعليق صوتي</option>` +
    mt.voices.map((a) => `<option value="${a.id}">${escapeHtml(a.name)} (${fmtDuration(a.duration)})</option>`).join("");
  $("mMusic").innerHTML = `<option value="">بدون موسيقى</option>` +
    mt.music.map((a) => `<option value="${a.id}">${escapeHtml(a.name)} (${fmtDuration(a.duration)})</option>`).join("");
}

function renderProjectSelect() {
  $("projectSelect").innerHTML = mt.projects
    .map((p) => `<option value="${p.id}" ${p.id === mt.project?.id ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
    .join("");
  $("projectSelect").hidden = mt.projects.length === 0;
  $("projectName").hidden = $("deleteProject").hidden = !mt.project;
}

function openProject(p) {
  clearTimeout(mt.pollTimer);
  pause();
  const same = p && mt.project?.id === p.id;
  mt.project = p ? structuredClone(p) : null;
  if (!same) {
    mt.sel = null;
    mt.t = 0;
    mt.undo = [];
    mt.redo = [];
  }
  if (p) storageSet(PROJECT_KEY, p.id);
  $("noProject").hidden = !!p;
  $("montage").hidden = !p;
  renderProjectSelect();
  if (!p) return;
  $("projectName").value = mt.project.data.name;
  renderLinkedVideo();
  renderAll();
  renderRender();
  if (!same) requestAnimationFrame(fitZoom);
  if (mt.project.render_status === "rendering") pollRender();
}

// ---------- الأوترو: قطعة فيديو عادية جوه التايم لاين ----------
const OUTRO_PREFIX = "outro:";
const isOutroClip = (c) => c.gen_id.startsWith(OUTRO_PREFIX);
const EXTRA_OUTRO_PREFIX = "xoutro:"; // أوترو زيادة اترفع من المونتاج
const isAnyOutro = (c) => isOutroClip(c) || c.gen_id.startsWith(EXTRA_OUTRO_PREFIX);
const outroIdFor = (coachId) => `${OUTRO_PREFIX}${coachId}`;
function coachHasOutro(coachId) {
  return !!coachId && mt.sources.some((s) => s.id === outroIdFor(coachId));
}
function addOutroClip(d) {
  if (!coachHasOutro(d.coach_id) || d.clips.some(isOutroClip)) return false;
  d.clips.push({ gen_id: outroIdFor(d.coach_id), ...CLIP_DEFAULTS, volume: d.outro_volume ?? 1 });
  return true;
}
// المشاريع القديمة (والجديدة) فيها «ضيف الأوترو» كإعداد: بنحوّله لقطعة في آخر الفيديو مرة واحدة
function migrateOutro(d) {
  if (!d.outro) return false;
  if (!d.coach_id) return false; // لسه مفيش مدرب، الأوترو هيتضاف أول ما يتختار
  addOutroClip(d);
  d.outro = false;
  return true;
}

function renderAll() {
  normalizeTracks(mt.project.data);
  if (migrateOutro(mt.project.data)) scheduleSave();
  fixSelection();
  renderBin();
  renderTimeline();
  renderInspector();
  renderSide();
  syncPreview();
  renderHistoryButtons();
}

// ---------- بيانات التايم لاين ----------
function clipSource(c) {
  return mt.sources.find((s) => s.id === c.gen_id);
}
function clipOut(c) {
  return c.end ?? clipSource(c)?.duration ?? c.start;
}
const clipSpeed = (c) => clamp(Number(c?.speed) || 1, 0.25, 4);
// طول القطعة على التايم لاين = طولها في الفيديو الأصلي ÷ السرعة
function clipLength(c) {
  return Math.max(0, clipOut(c) - c.start) / clipSpeed(c);
}
// الثانية جوه الفيديو الأصلي اللي بتظهر عند نقطة معيّنة من القطعة (بالسرعة والعكس)
function srcTimeAt(it, t) {
  const sp = it.speed || 1, rel = clamp(t - it.t0, 0, it.t1 - it.t0) * sp;
  return it.rev ? it.out - rel : it.in + rel;
}
function currentOutro() {
  const d = mt.project.data;
  const coach = mt.coaches.find((c) => c.id === d.coach_id);
  return d.outro && coach?.outro_url ? coach : null;
}

// كل حاجة على شريط الفيديو بالترتيب، وكل واحدة بتبدأ وتخلص إمتى
function seq() {
  const d = mt.project.data;
  const items = [];
  let t = 0;
  d.clips.forEach((c, i) => {
    const s = clipSource(c);
    const len = clipLength(c);
    items.push({ key: `c${i}`, kind: "clip", i, c, s, url: c.disabled ? null : s?.url, t0: t, t1: t + len, in: c.start, out: clipOut(c), speed: clipSpeed(c), rev: !!c.reverse,
      zoom: c.zoom, x: c.x, y: c.y, volume: c.volume });
    t += len;
  });
  const o = currentOutro();
  if (o && d.clips.length) {
    items.push({ key: "outro", kind: "outro", coach: o, url: o.outro_url, t0: t, t1: t + o.outro_duration, in: 0, zoom: 1, x: 0, y: 0, volume: d.outro_volume });
    t += o.outro_duration;
  }
  return { items, total: t };
}
function totalLength() {
  return seq().total;
}

// التعليق الصوتي والموسيقى ممكن يتقسّموا لكذا قطعة من نفس الملف (parts)
function normalizeTracks(d) {
  for (const kind of ["voice", "music"]) {
    const t = d[kind];
    if (t && !t.parts?.length) {
      t.parts = [{ delay: t.delay || 0, offset: t.offset || 0, length: t.length ?? null, volume: t.volume ?? 1 }];
    }
  }
}

// كل قطعة صوت ومكانها على التايم لاين
// تراكات الصوت: التعليق والموسيقى (ملف واحد مقسوم قطع) والأصوات الزيادة (كل قطعة ملفها لوحدها، وليها سطر)
const isAudKind = (k) => k === "voice" || k === "music" || k === "snd";
function partsOf(kind) {
  const d = mt.project?.data;
  if (!d) return [];
  if (kind === "snd") return d.sounds || (d.sounds = []);
  return d[kind]?.parts || [];
}
function soundSource(src) {
  return (mt.sfx || []).find((x) => x.id === src) || mt.voices.find((x) => x.id === src) || mt.music.find((x) => x.id === src) || null;
}
function soundParts() {
  const list = partsOf("snd"), t = { parts: list };
  return list.map((p, k) => {
    const a = soundSource(p.src);
    if (!a) return null;
    const offset = clamp(p.offset || 0, 0, Math.max(0, a.duration - MIN_CLIP));
    const len = Math.max(MIN_CLIP, Math.min(p.length || Infinity, a.duration - offset));
    const t0 = Math.max(0, p.delay || 0);
    return { kind: "snd", k, p, t, a, dur: a.duration, offset, len, t0, t1: t0 + len, url: a.url, volume: p.volume ?? 1, lane: clamp(p.lane | 0, 0, 7) };
  }).filter(Boolean);
}
function trackParts(kind) {
  if (kind === "snd") return soundParts();
  const t = mt.project?.data[kind];
  if (!t?.parts?.length) return [];
  const a = (kind === "voice" ? mt.voices : mt.music).find((x) => x.id === t.id);
  if (!a) return [];
  return t.parts.map((p, k) => {
    const offset = clamp(p.offset || 0, 0, Math.max(0, a.duration - MIN_CLIP));
    const len = Math.max(MIN_CLIP, Math.min(p.length || Infinity, a.duration - offset));
    const t0 = Math.max(0, p.delay || 0);
    return { kind, k, p, t, a, dur: a.duration, offset, len, t0, t1: t0 + len, url: a.url, volume: p.volume ?? 1 };
  });
}
function trackEnd(kind) {
  return Math.max(0, ...trackParts(kind).map((x) => x.t1));
}

function fixSelection() {
  const s = mt.sel;
  if (!mt.project) return;
  const d = mt.project.data;
  if (!s) { mt.extra = []; return; }
  const nCaps = captionBlocks().length;
  const valid = (s) => !((s.kind === "cap" && s.i >= nCaps) || (s.kind === "clip" && !d.clips[s.i]) || (isAudKind(s.kind) && !partsOf(s.kind)?.[s.p]) ||
      (s.kind === "outro" && !currentOutro()));
  mt.extra = mt.extra.filter(valid);
  if (!valid(s)) { mt.sel = null; return; }
  if ((s.kind === "clip" && !d.clips[s.i]) || (isAudKind(s.kind) && !partsOf(s.kind)?.[s.p]) ||
      (s.kind === "outro" && !currentOutro())) mt.sel = null;
}
function selectedClip() {
  return mt.sel?.kind === "clip" ? mt.project.data.clips[mt.sel.i] : null;
}

// ---------- رجوع وإعادة ----------
function pushHistory(key) {
  if (!mt.project) return;
  const now = Date.now();
  // السلايدر بيبعت تغييرات كتير ورا بعض، نحسبهم خطوة واحدة
  if (key && key === mt.histKey && now - mt.histAt < 1500) { mt.histAt = now; return; }
  mt.histKey = key || null;
  mt.histAt = now;
  mt.undo.push(JSON.stringify(mt.project.data));
  if (mt.undo.length > 100) mt.undo.shift();
  mt.redo = [];
  renderHistoryButtons();
}
function restore(from, to) {
  if (!from.length) return;
  to.push(JSON.stringify(mt.project.data));
  mt.project.data = JSON.parse(from.pop());
  mt.histKey = null;
  $("projectName").value = mt.project.data.name;
  changed();
}
const undoEdit = () => restore(mt.undo, mt.redo);
const redoEdit = () => restore(mt.redo, mt.undo);
function renderHistoryButtons() {
  $("tlUndo").disabled = !mt.undo.length;
  $("tlRedo").disabled = !mt.redo.length;
}
$("tlUndo").onclick = undoEdit;
$("tlRedo").onclick = redoEdit;

// ---------- الفيديوهات المتاحة ----------
function renderBin() {
  const d = mt.project.data;
  const onlyCoach = $("binCoachOnly").checked && d.coach_id;
  const q = $("binSearch").value.trim().toLowerCase(), favs = binFavs(), favOnly = $("binFavOnly").classList.contains("on");
  const list = mt.sources.filter((s) => (!onlyCoach || s.coach_id === d.coach_id || (s.extra && !s.coach_id))
    && (!q || `${s.label} ${s.coach_name || ""}`.toLowerCase().includes(q)) && (!favOnly || favs.has(s.id)))
    .sort((a, b) => favs.has(b.id) - favs.has(a.id));
  $("binEmpty").hidden = list.length > 0;
  $("binEmpty").textContent = q || favOnly ? "مفيش فيديوهات بالبحث ده." : $("binEmpty").textContent;
  const rep = mt.replacing != null;
  $("replaceBar").hidden = !rep;
  if (rep) $("replaceWhich").textContent = `رقم ${mt.replacing + 1}`;
  $("binGrid").classList.toggle("replacing", rep);
  $("binGrid").innerHTML = list
    .map(
      (s) => `<div class="bin-item" data-id="${s.id}" draggable="true">
        ${lightVideo(s.url, "muted playsinline")}
        <button class="add" title="${rep ? "حطه مكان القطعة" : "ضيف عند المؤشر"}">${rep ? "🔁" : "＋"}</button>
        <button class="fav ${favs.has(s.id) ? "on" : ""}" title="مفضلة">${favs.has(s.id) ? "★" : "☆"}</button>
        ${s.extra ? `<button class="del" title="امسح الأوترو ده">✕</button>` : ""}
        <span class="tag">${escapeHtml(s.label)} · ${s.duration.toFixed(1)}ث</span>
      </div>`
    )
    .join("");
}

// بيحط الفيديو قبل أو بعد القطعة اللي عند الوقت ده
function insertIndexAt(t) {
  for (const it of seq().items) {
    if (it.kind === "clip" && t < it.t1) return t - it.t0 < (it.t1 - it.t0) / 2 ? it.i : it.i + 1;
  }
  return mt.project.data.clips.length;
}
function insertClip(genId, index) {
  const src = mt.sources.find((s) => s.id === genId);
  if (!src) return;
  pushHistory();
  const d = mt.project.data;
  d.clips.splice(index, 0, { gen_id: src.id, ...CLIP_DEFAULTS });
  if (!d.coach_id) { d.coach_id = src.coach_id; $("mCoach").value = src.coach_id; }
  mt.sel = { kind: "clip", i: index };
  mt.t = seq().items[index].t0;
  showTab("clip");
  changed();
}

// المفضلة في المكتبة (على الجهاز ده)
const FAV_KEY = "studiomania.binFavs";
function binFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch { return new Set(); }
}
function toggleFav(id) {
  const f = binFavs();
  f.has(id) ? f.delete(id) : f.add(id);
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...f])); } catch { /* المتصفح مانع الحفظ */ }
}
$("binSearch").addEventListener("input", () => renderBin());
$("binFavOnly").onclick = () => { $("binFavOnly").classList.toggle("on"); renderBin(); };
// استبدال الفيديو مع الحفاظ على تعديلات القطعة
$("edReplace").onclick = () => {
  if (mt.sel?.kind !== "clip") return;
  mt.replacing = mt.sel.i;
  renderBin();
  $("binSearch").focus();
  toast("اختار من المكتبة الفيديو اللي هيتحط مكانها");
};
$("replaceCancel").onclick = () => { mt.replacing = null; renderBin(); };
function replaceClip(i, genId) {
  const c = mt.project.data.clips[i], src = mt.sources.find((s) => s.id === genId);
  if (!c || !src) return;
  pushHistory();
  // نفس الطول من نفس المكان لو ينفع، وإلا من الأول
  const len = clipOut(c) - c.start;
  let start = c.start;
  if (start + len > src.duration) start = Math.max(0, src.duration - len);
  const end = Math.min(src.duration, start + len);
  Object.assign(c, { gen_id: src.id, start, end: end >= src.duration - 0.001 ? null : end });
  if (c.reverse && end - start > 60) c.reverse = false;
  mt.replacing = null;
  mt.sel = { kind: "clip", i };
  changed();
  renderBin();
  toast("اتبدّل الفيديو والتعديلات زي ما هي");
}
$("binGrid").addEventListener("click", async (e) => {
  const item = e.target.closest(".bin-item");
  if (item && e.target.closest(".fav")) { toggleFav(item.dataset.id); renderBin(); return; }
  if (item && mt.replacing != null && !e.target.closest(".del")) { replaceClip(mt.replacing, item.dataset.id); return; }
  if (item && e.target.closest(".add")) insertClip(item.dataset.id, insertIndexAt(mt.t));
  if (item && e.target.closest(".del")) {
    const src = mt.sources.find((s) => s.id === item.dataset.id);
    if (mt.project.data.clips.some((c) => c.gen_id === src.id)) return toast("الأوترو ده في التايم لاين. شيله منه الأول", true);
    if (!confirm(`مسح «${src.label}»؟`)) return;
    try {
      await api(`/api/outros/${encodeURIComponent(src.id)}`, { method: "DELETE" });
      mt.sources = mt.sources.filter((s) => s.id !== src.id);
      renderBin();
      toast("اتمسح");
    } catch (err) {
      toast(err.message, true);
    }
  }
});

// أوترو تاني: بيترفع ويتحط في آخر المونتاج على طول
$("outroUpload").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !mt.project) return;
  const d = mt.project.data;
  const form = new FormData();
  form.append("file", file);
  form.append("name", `أوترو ${file.name.replace(/\.[^.]+$/, "")}`);
  if (d.coach_id) form.append("coach_id", d.coach_id);
  try {
    toast(`⏳ بيرفع ${file.name}...`);
    const o = await api("/api/outros", { method: "POST", body: form });
    mt.sources = await api("/api/montage/sources");
    renderBin();
    insertClip(o.id, d.clips.length);
    toast("✅ الأوترو اتضاف في آخر المونتاج. تقدر تحركه وتقصه زي أي قطعة");
  } catch (err) {
    toast(err.message, true);
  }
});
// فيديو من عندك: بيبدّل القطعة المتحددة (بنفس مكانها ومدتها) أو بيتحط عند المؤشر
$("clipUpload").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !mt.project) return;
  const d = mt.project.data;
  const c = selectedClip();
  const replace = c && confirm("تبدّل فيديو القطعة المتحددة بالفيديو ده؟\n(لو لأ، هيتحط كقطعة جديدة عند المؤشر)");
  const form = new FormData();
  form.append("file", file);
  if (d.coach_id) form.append("coach_id", d.coach_id);
  if (replace) form.append("replace", c.gen_id);
  try {
    toast(`⏳ بيرفع ${file.name}...`);
    const r = await api("/api/montage/upload", { method: "POST", body: form });
    mt.sources = await api("/api/montage/sources");
    renderBin();
    if (replace) {
      pushHistory();
      const len = clipLength(c);
      Object.assign(c, { gen_id: r.id, start: 0, end: Math.min(r.duration, len || r.duration) });
      changed();
      toast(r.duration + 0.05 < len
        ? `✅ اتبدّل الفيديو. خلي بالك: الفيديو الجديد ${r.duration.toFixed(1)}ث والقطعة كانت ${len.toFixed(1)}ث`
        : `✅ اتبدّل الفيديو${r.synced_shot ? " واتضاف كمان على اللقطة في تبويب المسلسل" : ""}`);
    } else {
      insertClip(r.id, insertIndexAt(mt.t));
      toast("✅ الفيديو اتضاف عند المؤشر");
    }
  } catch (err) {
    toast(err.message, true);
  }
});
$("binGrid").addEventListener("dblclick", (e) => {
  const item = e.target.closest(".bin-item");
  if (item) insertClip(item.dataset.id, insertIndexAt(mt.t));
});
$("binGrid").addEventListener("dragstart", (e) => {
  const item = e.target.closest(".bin-item");
  if (!item) return;
  e.dataTransfer.setData("text/sm-gen", item.dataset.id);
  e.dataTransfer.effectAllowed = "copy";
});
$("binCoachOnly").addEventListener("change", renderBin);

// ---------- صور الفيديو والموجة الصوتية للتايم لاين ----------
const strips = new Map();
function stripInfo(kind, id) {
  const key = `${kind}:${id}`;
  if (strips.has(key)) return strips.get(key).info;
  const entry = { info: null };
  strips.set(key, entry);
  fetch(`/api/montage/filmstrip?kind=${kind}&id=${encodeURIComponent(id)}`)
    .then(async (r) => {
      if (!r.ok) throw new Error(r.status);
      const frames = Number(r.headers.get("X-Frames")) || 1;
      const fps = Number(r.headers.get("X-Fps")) || 2;
      const url = URL.createObjectURL(await r.blob());
      const img = new Image();
      img.src = url;
      await img.decode();
      entry.info = { url, frames, fps, aspect: img.naturalWidth / frames / img.naturalHeight };
      scheduleTimeline();
    })
    .catch(() => {});
  return null;
}

function clipStrip(s, inSec, width, speed = 1) {
  if (!s) return "";
  if (s.extra) return stripHtml("xoutro", s.id, inSec, width, speed);
  return s.kind === "outro" ? stripHtml("outro", s.coach_id, inSec, width, speed) : stripHtml("gen", s.id, inSec, width, speed);
}

function stripHtml(kind, id, inSec, width, speed = 1) {
  const info = id && stripInfo(kind, id);
  if (!info) return "";
  const h = 56;
  const tw = Math.max(12, h * info.aspect);
  const n = Math.min(400, Math.ceil(width / tw));
  let html = "";
  for (let k = 0; k < n; k++) {
    const t = inSec + (k * tw + tw / 2) / mt.pps * speed;
    const fi = clamp(Math.floor(t * info.fps), 0, info.frames - 1);
    html += `<i style="width:${tw}px;background-position:${-fi * tw}px 0;background-size:${info.frames * tw}px 100%"></i>`;
  }
  return `<div class="strip" style="--img:url(${info.url})">${html}</div>`;
}

const waves = new Map();
let audioCtx = null;
function waveInfo(url) {
  if (waves.has(url)) return waves.get(url).info;
  const entry = { info: null };
  waves.set(url, entry);
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((buf) => {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      return audioCtx.decodeAudioData(buf);
    })
    .then((audio) => {
      const rate = 50; // قيمة كل 20 ملي ثانية
      const ch = audio.getChannelData(0);
      const step = Math.max(1, Math.floor(audio.sampleRate / rate));
      const peaks = new Float32Array(Math.ceil(ch.length / step));
      let max = 0.0001;
      for (let i = 0; i < peaks.length; i++) {
        let m = 0;
        for (let j = i * step, e = Math.min(ch.length, j + step); j < e; j += 4) m = Math.max(m, Math.abs(ch[j]));
        peaks[i] = m;
        max = Math.max(max, m);
      }
      for (let i = 0; i < peaks.length; i++) peaks[i] /= max;
      entry.info = { peaks, rate };
      scheduleTimeline();
    })
    .catch(() => {});
  return null;
}

function drawWave(canvas, url, offset, len, color, gain = 1) {
  const info = waveInfo(url);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!info || !w || !h) return;
  canvas.width = Math.min(4000, Math.ceil(w));
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.fillStyle = color;
  const cw = canvas.width;
  for (let x = 0; x < cw; x++) {
    const a = offset + (x / cw) * len, b = offset + ((x + 1) / cw) * len;
    let m = 0;
    for (let i = Math.floor(a * info.rate), e = Math.max(i + 1, Math.ceil(b * info.rate)); i < e && i < info.peaks.length; i++) m = Math.max(m, info.peaks[i]);
    // الموجة بتكبر وتصغر مع علو الصوت زي كاب كات
    const bh = Math.max(1, Math.min(1, m * gain) * (h - 4));
    g.fillRect(x, (h - bh) / 2, 1, bh);
  }
}

// ---------- رسم التايم لاين ----------
let tlQueued = false;
function scheduleTimeline() {
  if (tlQueued) return;
  tlQueued = true;
  requestAnimationFrame(() => { tlQueued = false; if (mt.project) renderTimeline(); });
}

function rulerStep() {
  const steps = [1 / FPS, 2 / FPS, 5 / FPS, 10 / FPS, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  const major = steps.find((s) => s * mt.pps >= 70) || 120;
  const minor = major <= 1 / FPS ? major : major / (major < 1 ? (major * FPS) % 5 === 0 ? 5 : 2 : 5);
  return { major, minor: minor * mt.pps < 6 ? major : minor };
}

function renderRuler(width) {
  const { major, minor } = rulerStep();
  let html = "";
  for (let k = 0; k * major * mt.pps < width; k++) {
    const t = k * major;
    const f = Math.round(t * FPS);
    const label = f % FPS === 0 ? fmtTC(t).slice(0, 5) : `${f % FPS}f`;
    html += `<span style="left:${t * mt.pps}px">${label}</span>`;
  }
  const r = $("tlRuler");
  r.innerHTML = html;
  renderMarkers();
  r.style.setProperty("--minor", `${minor * mt.pps}px`);
  r.style.setProperty("--major", `${major * mt.pps}px`);
}

function renderTimeline() {
  if (!mt.project) return;
  const d = mt.project.data;
  const { items, total } = seq();
  const view = $("tlScroll").clientWidth || 800;
  const end = Math.max(total, trackEnd("voice"), trackEnd("music"), trackEnd("snd"));
  const width = Math.max(view, (end + 4) * mt.pps);
  const canvas = $("tlCanvas");
  canvas.style.width = `${width}px`;
  canvas.classList.toggle("blade", mt.tool === "blade");
  renderRuler(width);

  $("trkVideo").innerHTML = items.length
    ? items
        .map((it) => {
          const w = (it.t1 - it.t0) * mt.pps;
          const sel = isSel(it.kind === "clip" ? { kind: "clip", i: it.i } : { kind: "outro" });
          const strip = it.kind === "clip" ? clipStrip(it.s, it.in, w, it.speed) : stripHtml("outro", it.coach.id, 0, w);
          const label = it.kind === "clip" ? (it.s ? escapeHtml(it.s.label) : "⚠️ الفيديو اتمسح") : `🎬 أوترو ${escapeHtml(it.coach.name)}`;
          const kfd = hasKf(it.c) ? it.c.kf.map((k) => `<i class="kfd" style="left:${k.t * mt.pps}px"></i>`).join("") : "";
          return `<div class="tl-clip ${it.kind} ${sel ? "selected" : ""} ${it.s || it.kind === "outro" ? "" : "missing"} ${it.c?.disabled ? "disabled" : ""}"
              ${it.kind === "clip" ? `data-i="${it.i}"` : `data-outro="1"`} style="left:${it.t0 * mt.pps}px;width:${w}px">
            ${strip}
            ${hasSound(it) ? `<canvas class="cw"></canvas>` : ""}
            <span class="nm" dir="auto">${label}</span><span class="du">${fxBadges(it.c)}${(it.t1 - it.t0).toFixed(1)}s</span>
            ${soundBadge(it)}
            ${hasSound(it) ? volLine(it.volume) : ""}
            ${it.kind === "clip" ? `<b class="h l" data-h="l"></b><b class="h r" data-h="r"></b>` : ""}${kfd}
          </div>`;
        })
        .join("")
    : `<div class="tl-drop-hint">اسحب فيديو هنا أو دوس ＋ على فيديو من المكتبة</div>`;
  // موجة الصوت اللي جوه كل قطعة فيديو
  $("trkVideo").querySelectorAll(".tl-clip").forEach((el) => {
    const cv = el.querySelector("canvas.cw");
    const it = el.dataset.outro ? items.find((x) => x.kind === "outro") : items[Number(el.dataset.i)];
    if (cv && it) drawWave(cv, it.url, it.in, (it.t1 - it.t0) * (it.speed || 1), it.volume > 0 ? "#9fe3a8" : "#6b7180", it.volume);
  });
  const clips = d.clips.filter((c) => clipSource(c)?.has_audio);
  const allMuted = clips.length > 0 && clips.every((c) => c.volume === 0);
  $("muteAll").hidden = !clips.length;
  $("muteAll").textContent = allMuted ? "🔇" : "🔊";
  $("muteAll").title = allMuted ? "رجّع صوت كل الفيديوهات" : "اكتم صوت كل الفيديوهات";
  $("muteAll").classList.toggle("off", allMuted);

  for (const [kind, color] of [["voice", "#7fb2ff"], ["music", "#6fe0bd"]]) {
    const el = $(kind === "voice" ? "trkVoice" : "trkMusic");
    const parts = trackParts(kind);
    if (!parts.length) {
      el.innerHTML = `<div class="tl-empty-track">${kind === "voice" ? "مفيش تعليق صوتي — اختاره من تاب 🔊 الصوت" : "مفيش موسيقى — اختارها من تاب 🔊 الصوت"}</div>`;
      continue;
    }
    el.innerHTML = parts
      .map((x) => {
        const sel = isSel({ kind, p: x.k });
        return `<div class="tl-audio ${kind} ${sel ? "selected" : ""}" data-track="${kind}" data-p="${x.k}" style="left:${x.t0 * mt.pps}px;width:${x.len * mt.pps}px">
          <canvas></canvas><span class="nm" dir="auto">${escapeHtml(x.a.name)}</span>${volLine(x.volume)}
          <b class="h l" data-h="l"></b><b class="h r" data-h="r"></b></div>`;
      })
      .join("");
    el.querySelectorAll(".tl-audio").forEach((box, n) => {
      const x = parts[n];
      drawWave(box.querySelector("canvas"), x.url, x.offset, x.len, color, x.volume);
    });
  }

  renderSoundRow();
  $("trkCaps").innerHTML = captionBlocks()
    .map((g, n) => `<div class="tl-cap ${isSel({ kind: "cap", i: n }) ? "selected" : ""}" data-c="${n}" data-t="${g.t0}" title="دوسة تختاره · Delete تمسحه" style="left:${g.t0 * mt.pps}px;width:${Math.max(2, (g.t1 - g.t0) * mt.pps)}px">${escapeHtml(g.text)}</div>`)
    .join("");

  renderTrackHeads();
  const nSel = allSelected().length;
  $("totalLabel").textContent = total ? `${d.clips.length} قطعة${nSel > 1 ? ` · ✔ ${nSel} مختارين` : ""}` : "";
  drawPlayhead();
}

// ---------- قفل وإخفاء وكتم كل تراك (زي كاب كات) ----------
const TRACKS = {
  video: { row: "trkVideo", head: "h-video", can: ["lock", "hide"] },
  voice: { row: "trkVoice", head: "h-voice", can: ["lock", "mute"] },
  music: { row: "trkMusic", head: "h-music", can: ["lock", "mute"] },
  caps: { row: "trkCaps", head: "h-caps", can: ["lock", "hide"] },
  typo: { row: "trkTypo", head: "h-typo", can: ["lock", "hide"] },
  fx: { row: "trkFx", head: "h-fx", can: ["lock"] },
  click: { row: "trkClick", head: "h-click", can: ["mute"] },
  snd: { row: "trkSnd", head: "h-snd", can: ["lock", "mute"] },
};
const FLAG_ICON = { lock: ["🔓", "🔒", "اقفل التراك (متقدرش تحرّك أو تمسح حاجة فيه)", "افتح التراك"],
  hide: ["👁", "🙈", "خبّي التراك من المعاينة والفيديو", "رجّع التراك يظهر"],
  mute: ["🔊", "🔇", "اكتم التراك", "رجّع صوت التراك"] };
function trackFlag(trk, flag) {
  const d = mt.project?.data;
  if (!d) return false;
  if (trk === "typo" && flag === "hide") return d.typo_on === false;
  if (trk === "click" && flag === "mute") return d.typo_sfx?.on === false;
  return !!d.tracks?.[trk]?.[flag];
}
function setTrackFlag(trk, flag, on) {
  const d = mt.project.data;
  if (trk === "typo" && flag === "hide") d.typo_on = !on;
  else if (trk === "click" && flag === "mute") d.typo_sfx = { ...(d.typo_sfx || {}), on: !on };
  else d.tracks = { ...(d.tracks || {}), [trk]: { ...(d.tracks?.[trk] || {}), [flag]: on } };
}
function renderTrackHeads() {
  for (const [trk, t] of Object.entries(TRACKS)) {
    const head = document.querySelector(`.tl-heads .${t.head}`);
    if (!head) continue;
    let box = head.querySelector(".trk-flags");
    if (!box) { box = document.createElement("span"); box.className = "trk-flags"; head.append(box); }
    box.innerHTML = t.can.map((f) => {
      const on = trackFlag(trk, f), ic = FLAG_ICON[f];
      return `<button class="ic tf ${on ? "on" : ""}" data-trk="${trk}" data-flag="${f}" title="${on ? ic[3] : ic[2]}">${on ? ic[1] : ic[0]}</button>`;
    }).join("");
    const row = $(t.row);
    row?.classList.toggle("locked", trackFlag(trk, "lock"));
    row?.classList.toggle("hidden-trk", trackFlag(trk, "hide") || trackFlag(trk, "mute"));
  }
  $("pvStage").style.visibility = trackFlag("video", "hide") ? "hidden" : "";
}
document.querySelector(".tl-heads").addEventListener("click", (e) => {
  const b = e.target.closest("[data-flag]");
  if (!b || !mt.project) return;
  pushHistory();
  setTrackFlag(b.dataset.trk, b.dataset.flag, !trackFlag(b.dataset.trk, b.dataset.flag));
  // اللي متقفل ميفضلش مختار
  if (b.dataset.flag === "lock") setSelection(allSelected().filter((x) => !kindLocked(x.kind)));
  changed();
  if (typeof mtTypoDraw === "function") mtTypoDraw();
});
function kindLocked(kind) {
  const trk = kind === "clip" || kind === "outro" ? "video" : kind === "cap" ? "caps" : kind;
  return trackFlag(trk, "lock");
}

// ---------- الصوت اللي جوه الفيديو ----------
function hasSound(it) {
  return it.kind === "outro" || !!it.s?.has_audio;
}
function soundBadge(it) {
  if (!hasSound(it)) return "";
  const v = Math.round(it.volume * 100);
  const icon = v === 0 ? "🔇" : v < 60 ? "🔉" : "🔊";
  return `<button class="snd ${v === 0 ? "off" : ""}" data-mute title="${v === 0 ? "الصوت مكتوم — دوس ترجّعه" : "الفيديو ده فيه صوت — دوس تكتمه"}">${icon}${v === 0 ? "" : ` ${v}%`}</button>`;
}
// خط الصوت جوه القطعة: تسحبه لفوق يعلّي ولتحت يوطّي (من 0% لـ 200%)
const VOL_MAX = 2;
function volLine(vol) {
  const pct = Math.round(vol * 100);
  return `<i class="vline ${pct === 0 ? "zero" : ""} ${vol > 1.4 ? "hi" : ""}" data-vol style="bottom:${(clamp(vol, 0, VOL_MAX) / VOL_MAX) * 100}%"
    title="اسحب لفوق أو لتحت عشان تعلّي أو توطّي الصوت · دبل كليك يرجّعه 100%"><em>${pct}%</em></i>`;
}
function volTarget(el) {
  const d = mt.project.data;
  if (el.dataset.track) {
    const part = partsOf(el.dataset.track)[Number(el.dataset.p)];
    return { get: () => part.volume ?? 1, set: (v) => (part.volume = v) };
  }
  if (el.dataset.outro) return { get: () => d.outro_volume, set: (v) => (d.outro_volume = v) };
  const c = d.clips[Number(el.dataset.i)];
  return { get: () => c.volume, set: (v) => (c.volume = v) };
}
function volTargetOf(x) {
  const d = mt.project.data;
  if (isAudKind(x.kind)) {
    const part = partsOf(x.kind)[x.p];
    return { get: () => part.volume ?? 1, set: (v) => (part.volume = v) };
  }
  if (x.kind === "outro") return { get: () => d.outro_volume, set: (v) => (d.outro_volume = v) };
  const c = d.clips[x.i];
  return { get: () => c.volume, set: (v) => (c.volume = v) };
}
function showVolLine(el, v) {
  const line = el?.querySelector(".vline");
  if (!line) return;
  line.style.bottom = `${(v / VOL_MAX) * 100}%`;
  line.classList.toggle("zero", v === 0);
  line.classList.toggle("hi", v > 1.4);
  line.querySelector("em").textContent = `${Math.round(v * 100)}%`;
}

// لو فيه كذا قطعة مختارة، الخط بيعلّي أو يوطّي صوتهم كلهم بنفس المقدار
function dragVolume(e, box) {
  pause();
  pushHistory();
  const me = selOfEl(box);
  const group = isSel(me) ? allSelected().filter((x) => elOfSel(x)?.querySelector(".vline")) : [me];
  const items = group.map((x) => ({ x, el: elOfSel(x), target: volTargetOf(x) })).map((o) => ({ ...o, v0: o.target.get() }));
  const mine = items.find((o) => selKey(o.x) === selKey(me)) || items[0];
  // المساحة اللي الخط بيتحرك فيها هي ارتفاع القطعة
  const h = Math.max(20, box.clientHeight - 6);
  items.forEach((o) => o.el?.classList.add("vol-drag"));
  drag(
    e,
    (dx, dy) => {
      let v = clamp(mine.v0 - (dy / h) * VOL_MAX, 0, VOL_MAX);
      v = Math.round(v * 20) / 20; // خطوات 5%
      if (items.length === 1 && Math.abs(v - 1) < 0.04) v = 1; // يلزق على 100%
      const delta = v - mine.v0;
      for (const o of items) {
        const nv = Math.round(clamp(o.v0 + delta, 0, VOL_MAX) * 20) / 20;
        o.target.set(nv);
        showVolLine(o.el, nv);
      }
      if (items.length > 1) mine.el.querySelector(".vline em").textContent = `${Math.round(v * 100)}% (${delta >= 0 ? "+" : "−"}${Math.round(Math.abs(delta) * 100)}%)`;
    },
    () => {
      items.forEach((o) => o.el?.classList.remove("vol-drag"));
      // دوسة من غير سحب: منرسمش من جديد عشان الدبل كليك يشتغل
      if (items.every((o) => o.target.get() === o.v0)) { mt.undo.pop(); renderHistoryButtons(); return; }
      changed();
    }
  );
}

const lastVolume = new WeakMap();
function toggleMute(target) {
  // target: قطعة من المونتاج، أو "outro"
  pushHistory();
  const d = mt.project.data;
  if (target === "outro") {
    if (d.outro_volume > 0) { lastVolume.set(d, d.outro_volume); d.outro_volume = 0; }
    else d.outro_volume = lastVolume.get(d) || 1;
  } else if (target.volume > 0) { lastVolume.set(target, target.volume); target.volume = 0; }
  else target.volume = lastVolume.get(target) || 1;
  changed();
}
$("muteAll").onclick = () => {
  const clips = mt.project.data.clips.filter((c) => clipSource(c)?.has_audio);
  if (!clips.length) return;
  pushHistory();
  const mute = !clips.every((c) => c.volume === 0);
  for (const c of clips) {
    if (mute && c.volume > 0) { lastVolume.set(c, c.volume); c.volume = 0; }
    else if (!mute) c.volume = lastVolume.get(c) || 1;
  }
  toast(mute ? "🔇 كتمت صوت كل الفيديوهات" : "🔊 رجّعت صوت الفيديوهات");
  changed();
};

// الكابشن اللي هيظهر على الفيديو، بمواعيده على التايم لاين
function captionBlocks() {
  const d = mt.project.data;
  const tr = d.voice && typeof brand !== "undefined" && brand.tr[d.voice.id];
  if (!d.captions?.enabled || !(tr?.status === "done" && tr.words.length)) return [];
  const blocks = [];
  const removed = new Set(d.captions.removed || []);
  const source = tr.words.filter((w) => !removed.has(Math.round(w.s * 100)));
  // كل قطعة من التعليق الصوتي ليها الكلام اللي جواها بس
  for (const x of trackParts("voice")) {
    const words = source.filter((w) => w.e > x.offset && w.s < x.offset + x.len);
    const groups = groupWords(words, d.captions.words || 3);
    const shift = x.t0 - x.offset;
    groups.forEach((g, k) => {
      const next = groups[k + 1];
      const t0 = Math.max(x.t0, g[0].s + shift);
      const t1 = Math.min(x.t1, (next ? next[0].s : Infinity) + shift, g[g.length - 1].e + 0.5 + shift);
      if (t1 > t0) blocks.push({ t0, t1, g, shift, text: g.map((w) => w.w).join(" ") });
    });
  }
  return blocks.sort((a, b) => a.t0 - b.t0);
}

function drawPlayhead() {
  $("tlPlayhead").style.left = `${mt.t * mt.pps}px`;
  $("tcNow").textContent = fmtTC(mt.t);
  $("tcTotal").textContent = fmtTC(mt.project ? totalLength() : 0);
}

// ---------- زووم التايم لاين ----------
function ppsToSlider(pps) {
  return Math.round((Math.log(pps / PPS_MIN) / Math.log(PPS_MAX / PPS_MIN)) * 1000);
}
function setZoom(pps, anchorX) {
  const sc = $("tlScroll");
  const ax = anchorX ?? clamp(mt.t * mt.pps - sc.scrollLeft, 0, sc.clientWidth);
  const tAnchor = (sc.scrollLeft + ax) / mt.pps;
  mt.pps = clamp(pps, PPS_MIN, PPS_MAX);
  $("tlZoom").value = ppsToSlider(mt.pps);
  renderTimeline();
  sc.scrollLeft = tAnchor * mt.pps - ax;
}
function fitZoom() {
  if (!mt.project) return;
  const sc = $("tlScroll");
  const end = Math.max(totalLength(), trackEnd("voice"), trackEnd("music"), 5);
  setZoom((sc.clientWidth - 30) / end, 0);
  sc.scrollLeft = 0;
}
$("tlZoom").addEventListener("input", () => setZoom(PPS_MIN * (PPS_MAX / PPS_MIN) ** ($("tlZoom").value / 1000)));
$("tlZoomIn").onclick = () => setZoom(mt.pps * 1.5);
$("tlZoomOut").onclick = () => setZoom(mt.pps / 1.5);
$("tlFit").onclick = fitZoom;
$("tlScroll").addEventListener(
  "wheel",
  (e) => {
    const sc = $("tlScroll");
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      setZoom(mt.pps * Math.exp(-e.deltaY * 0.002), e.clientX - sc.getBoundingClientRect().left);
    } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && sc.scrollWidth > sc.clientWidth) {
      e.preventDefault();
      sc.scrollLeft += e.deltaY;
    }
  },
  { passive: false }
);
window.addEventListener("resize", () => mt.project && isMontage() && renderTimeline());

// ---------- الأدوات ----------
function setTool(tool) {
  mt.tool = tool;
  document.querySelectorAll(".tl-toolbar .tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  $("tlCanvas").classList.toggle("blade", tool === "blade");
  if (tool !== "blade") $("tlHover").hidden = true;
}
document.querySelectorAll(".tl-toolbar .tool").forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));

function splitPart(x, t) {
  const cut = snap(t - x.t0);
  if (cut < MIN_CLIP - 1e-6 || x.len - cut < MIN_CLIP - 1e-6) return toast("مفيش ولا فريم بين المؤشر وطرف القطعة", true);
  pushHistory();
  const parts = x.t.parts;
  const rest = x.p.length == null ? null : snap(x.len - cut);
  parts.splice(x.k + 1, 0, { ...JSON.parse(JSON.stringify(parts[x.k])), delay: snap(x.t0 + cut), offset: snap(x.offset + cut), length: rest, volume: x.volume, fade_in: 0 });
  parts[x.k].length = cut;
  parts[x.k].fade_out = 0;
  mt.sel = { kind: x.kind, p: x.k + 1 };
  changed();
}

// target: قطعة صوت معيّنة (من أداة القطع)، وإلا بيقسم المختار أو الفيديو اللي عند المؤشر
// الكي فريمز لجزء من القطعة [a, b] (بوقت القطعة): بنحط كي فريم محسوب على الطرفين ونشيل اللي برّه، والوقت يبدأ من a
function kfWindow(c, a, b) {
  if (!hasKf(c)) return c.kf || null;
  const at = (t) => ({ t, ...transformNow({ ...c, kf: c.kf, _t: t }, t) });
  const inner = c.kf.filter((k) => k.t > a + 0.5 / FPS && k.t < b - 0.5 / FPS);
  const out = [at(a), ...inner.map((k) => ({ ...k })), at(b)].map((k) => ({ ...k, t: Math.max(0, Math.round((k.t - a) * FPS) / FPS) }));
  return out;
}
function splitAt(t, target) {
  const s = target || mt.sel;
  if (s?.kind === "voice" || s?.kind === "music") {
    const x = trackParts(s.kind)[s.p];
    if (x && t > x.t0 && t < x.t1) return splitPart(x, t);
    return toast("حط المؤشر على قطعة الصوت المختارة عشان تقسمها", true);
  }
  const it = seq().items.find((x) => x.kind === "clip" && t > x.t0 && t < x.t1);
  if (!it) return toast("حط المؤشر على قطعة فيديو عشان تقسمها", true);
  const at = snap(srcTimeAt(it, t));
  if (at - it.in < MIN_CLIP - 1e-6 || clipOut(it.c) - at < MIN_CLIP - 1e-6) return toast("مفيش ولا فريم بين المؤشر وطرف القطعة", true);
  pushHistory();
  const clips = mt.project.data.clips;
  // القطعة اللي بالعكس: الجزء الأول على التايم لاين هو آخر الفيديو الأصلي
  const first = it.rev ? { start: at } : { end: at }, second = it.rev ? { end: at } : { start: at };
  const cut = t - it.t0, len = it.t1 - it.t0;
  const kfA = kfWindow(it.c, 0, cut), kfB = kfWindow(it.c, cut, len);
  clips.splice(it.i + 1, 0, { ...JSON.parse(JSON.stringify(it.c)), ...second, fade_in: 0, anim_in: null, kf: kfB, trans: null });
  Object.assign(clips[it.i], first, { fade_out: 0, anim_out: null, kf: kfA });
  mt.sel = { kind: "clip", i: it.i + 1 };
  changed();
}
$("tlSplit").onclick = $("edSplit").onclick = () => splitAt(mt.t);

function deleteSelected() {
  const list = allSelected().filter((x) => !kindLocked(x.kind));
  if (!list.length) return;
  pushHistory();
  const d = mt.project.data;
  // الكابشن: بنشيل الكلام ده من الكابشن في المشروع ده بس (التعليق الصوتي نفسه مبيتغيّرش)
  const caps = captionBlocks();
  const gone = list.filter((x) => x.kind === "cap").flatMap((x) => caps[x.i]?.g || []);
  if (gone.length) d.captions.removed = [...new Set([...(d.captions.removed || []), ...gone.map((w) => Math.round(w.s * 100))])];
  // من الآخر للأول عشان الأرقام متتلخبطش
  const desc = (k) => list.filter((x) => x.kind === k).map((x) => x.i ?? x.p).sort((a, b) => b - a);
  for (const i of desc("clip")) d.clips.splice(i, 1);
  for (const kind of ["voice", "music", "snd"]) {
    for (const k of desc(kind)) partsOf(kind).splice(k, 1);
    if (kind !== "snd" && d[kind] && !d[kind].parts.length) d[kind] = null;
  }
  if (list.some((x) => x.kind === "outro")) d.outro = false;
  mt.sel = null;
  changed();
}
$("tlDelete").onclick = $("edDelete").onclick = deleteSelected;

$("edDup").onclick = () => {
  const c = selectedClip();
  if (!c) return;
  pushHistory();
  mt.project.data.clips.splice(mt.sel.i + 1, 0, { ...c });
  mt.sel = { kind: "clip", i: mt.sel.i + 1 };
  changed();
};

// ---------- الماوس على التايم لاين ----------
function canvasTime(e) {
  return Math.max(0, (e.clientX - $("tlCanvas").getBoundingClientRect().left) / mt.pps);
}
function drag(e, onMove, onUp) {
  const x0 = e.clientX, y0 = e.clientY;
  const move = (ev) => onMove(ev.clientX - x0, ev.clientY - y0, ev);
  const up = (ev) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    onUp?.(ev.clientX - x0, ev);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

// اللوحة بتتنقل لوحدها للي اخترته (زي كاب كات): القطعة، الصوت (وبتنزل لقسمه)، الكابشن...
function focusPane(sel) {
  if (!sel) return;
  if (sel.kind === "clip" || sel.kind === "outro") return showTab("clip");
  if (sel.kind === "cap") return showTab("caps");
  const tab = TAB_OF_KIND[sel.kind];
  if (tab) return showTab(tab);
  showTab("audio");
  const h = $(sel.kind === "music" ? "secMusic" : sel.kind === "snd" ? "secSounds" : "secVoice");
  if (h) {
    h.scrollIntoView({ block: "start", behavior: "smooth" });
    h.classList.remove("flash"); void h.offsetWidth; h.classList.add("flash");
  }
}
const TAB_OF_KIND = {};  // التراكات الجديدة بتسجّل التاب بتاعها هنا
function selectItem(sel, seekInto) {
  mt.sel = sel;
  focusPane(sel);
  if (seekInto) {
    const it = seq().items.find((x) => (sel.kind === "clip" ? x.i === sel.i : x.kind === "outro"));
    if (it && (mt.t < it.t0 || mt.t >= it.t1)) seek(it.t0);
  }
  renderTimeline();
  renderInspector();
}

$("tlCanvas").addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !mt.project) return;
  const t = canvasTime(e);
  const clipEl = e.target.closest(".tl-clip");
  const audEl = e.target.closest(".tl-audio");
  const handle = e.target.closest("[data-h]")?.dataset.h;
  e.preventDefault();

  // أداة القطع ليها الأولوية على أي حاجة جوه القطعة
  if (mt.tool === "blade" && clipEl?.dataset.i != null) { splitAt(snap(t)); return; }
  if (mt.tool === "blade" && audEl) { splitAt(snap(t), { kind: audEl.dataset.track, p: Number(audEl.dataset.p) }); return; }
  // Ctrl (أو ⌘) + دوسة: تضيف القطعة للاختيار أو تشيلها منه
  const capEl = e.target.closest(".tl-cap");
  if ((clipEl || audEl || capEl) && (e.ctrlKey || e.metaKey)) {
    const x = selOfEl(clipEl || audEl || capEl);
    setSelection(isSel(x) ? allSelected().filter((y) => selKey(y) !== selKey(x)) : [...allSelected(), x]);
    renderTimeline();
    renderInspector();
    return;
  }
  if ((clipEl || audEl) && e.target.closest("[data-vol]")) {
    // خط الصوت بيختار القطعة كمان (ولو هي من ضمن اختيار متعدد، بيفضل زي ما هو)
    const box = clipEl || audEl;
    if (!isSel(selOfEl(box))) {
      mt.sel = selOfEl(box);
      document.querySelectorAll(".tl-clip.selected, .tl-audio.selected").forEach((x) => x.classList.remove("selected"));
      box.classList.add("selected");
      renderInspector();
    }
    return dragVolume(e, box);
  }
  if (clipEl && e.target.closest("[data-mute]")) {
    toggleMute(clipEl.dataset.outro ? "outro" : mt.project.data.clips[Number(clipEl.dataset.i)]);
    return;
  }

  // سحب في مكان فاضي: مربع تحديد يختار كل القطع اللي جواه
  if (!clipEl && !audEl && !e.target.closest("#tlRuler, .tl-playhead, .tl-cap")) return marquee(e, t);

  // دوسة على كابشن: تختاره وتروح لمعاده
  if (capEl) {
    mt.sel = selOfEl(capEl);
    showTab("caps");
    seek(Number(capEl.dataset.t));
    renderTimeline();
    renderInspector();
    return;
  }

  // المسطرة ورأس المؤشر: تحريك المؤشر بالسحب
  if (e.target.closest("#tlRuler, .tl-playhead") || (!clipEl && !audEl)) {
    if (!e.target.closest("#tlRuler, .tl-playhead") && !e.target.closest(".tl-cap")) { mt.sel = null; renderTimeline(); renderInspector(); }
    const capT = e.target.closest(".tl-cap")?.dataset.t;
    seek(capT != null ? Number(capT) : t);
    const wasPlaying = mt.playing;
    if (wasPlaying) pause();
    drag(e, (dx, dy, ev) => seek(canvasTime(ev)), () => wasPlaying && play());
    return;
  }

  if (clipEl && clipEl.dataset.outro) { selectItem({ kind: "outro" }, true); return; }

  if (clipEl) {
    const i = Number(clipEl.dataset.i);
    if (mt.tool === "blade") { splitAt(snap(t)); return; }
    const c = mt.project.data.clips[i];
    const s = clipSource(c);
    if (handle && s) return trimClip(e, i, handle);
    selectItem({ kind: "clip", i }, true);
    return reorderClip(e, i);
  }

  if (audEl) {
    const kind = audEl.dataset.track, k = Number(audEl.dataset.p);
    if (mt.tool === "blade") { splitAt(snap(t), { kind, p: k }); return; }
    selectItem({ kind, p: k });
    return moveTrack(e, kind, k, handle);
  }
});

function marquee(e, t) {
  const canvas = $("tlCanvas");
  const base = e.ctrlKey || e.metaKey ? allSelected() : [];
  let box = null;
  drag(
    e,
    (dx, dy, ev) => {
      if (!box && Math.hypot(dx, dy) < 5) return;
      if (!box) { box = document.createElement("div"); box.className = "tl-marquee"; canvas.append(box); }
      const cr = canvas.getBoundingClientRect();
      const x1 = Math.min(e.clientX, ev.clientX), x2 = Math.max(e.clientX, ev.clientX);
      const y1 = Math.min(e.clientY, ev.clientY), y2 = Math.max(e.clientY, ev.clientY);
      Object.assign(box.style, { left: `${x1 - cr.left}px`, top: `${y1 - cr.top}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px` });
      const hit = [...canvas.querySelectorAll(".tl-track:not(.locked) .tl-clip, .tl-track:not(.locked) .tl-audio, .tl-track:not(.locked) .tl-cap")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.right > x1 && r.left < x2 && r.bottom > y1 && r.top < y2; })
        .map(selOfEl);
      const keys = new Set(base.map(selKey));
      setSelection([...base, ...hit.filter((x) => !keys.has(selKey(x)))]);
      canvas.querySelectorAll(".tl-clip, .tl-audio, .tl-cap").forEach((el) => el.classList.toggle("selected", isSel(selOfEl(el))));
    },
    () => {
      if (box) { box.remove(); renderTimeline(); renderInspector(); return; }
      // دوسة من غير سحب: تنقل المؤشر وتلغي الاختيار
      mt.sel = null;
      seek(t);
      renderTimeline();
      renderInspector();
    }
  );
}

function trimClip(e, i, side) {
  pause();
  pushHistory();
  const c = mt.project.data.clips[i];
  const s = clipSource(c);
  const start0 = c.start, out0 = clipOut(c), kf0 = hasKf(c) ? JSON.parse(JSON.stringify(c.kf)) : null;
  mt.sel = { kind: "clip", i };
  renderTimeline();
  renderInspector();
  const it0 = seq().items[i];
  const el = $("trkVideo").querySelector(`.tl-clip[data-i="${i}"]`);
  el.classList.add("trimming");
  const tip = document.createElement("div");
  tip.className = "tl-tip";
  tip.dir = "ltr";
  $("tlCanvas").append(tip);
  let moved = false;
  drag(
    e,
    (dx) => {
      moved = true;
      const ds = snap(dx / mt.pps * clipSpeed(c));
      // وإنت بتسحب: الطرف اللي ماسكه بيمشي مع الماوس، والباقي بيتظبط لما تسيب
      let left = it0.t0;
      if (side === "l") {
        c.start = clamp(snap(start0 + ds), 0, out0 - MIN_CLIP);
        left = it0.t0 + (c.start - start0) / clipSpeed(c);
        if (kf0) {
          const sh = (c.start - start0) / clipSpeed(c);
          c.kf = kfWindow({ ...c, kf: kf0 }, sh, sh + clipLength(c)).filter(Boolean);
        }
      } else {
        const out = clamp(snap(out0 + ds), c.start + MIN_CLIP, s.duration);
        c.end = out >= s.duration - 0.001 ? null : out;
      }
      const len = clipLength(c);
      el.style.left = `${left * mt.pps}px`;
      el.style.width = `${len * mt.pps}px`;
      el.querySelector(".strip")?.remove();
      el.insertAdjacentHTML("afterbegin", clipStrip(s, c.start, len * mt.pps, clipSpeed(c)));
      const cv = el.querySelector("canvas.cw");
      if (cv) drawWave(cv, s.url, c.start, len * clipSpeed(c), c.volume > 0 ? "#9fe3a8" : "#6b7180", c.volume);
      el.querySelector(".du").textContent = `${len.toFixed(1)}s`;
      const diff = len - (out0 - start0) / clipSpeed(c);
      tip.textContent = `${len.toFixed(2)}s (${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(2)})`;
      const edgeX = (side === "l" ? left : left + len) * mt.pps;
      tip.style.left = `${Math.max(tip.offsetWidth / 2 + 2, edgeX)}px`;
      // المعاينة بتوريك الفريم اللي عند الطرف اللي بتسحبه
      mt.t = side === "l" ? it0.t0 : Math.max(it0.t0, it0.t0 + len - 1 / FPS);
      syncPreview();
      $("tlPlayhead").style.left = `${(side === "l" ? left : it0.t0 + len) * mt.pps}px`;
      renderInspector();
    },
    () => {
      tip.remove();
      if (!moved) { mt.undo.pop(); renderHistoryButtons(); }
      changed();
    }
  );
}

function reorderClip(e, i) {
  let moving = false, target = i, el = null;
  const marker = document.createElement("div");
  marker.className = "tl-insert";
  const me = seq().items[i];
  drag(
    e,
    (dx) => {
      if (!moving && Math.abs(dx) < 5) return;
      if (!moving) {
        moving = true;
        // التايم لاين بيترسم من جديد لما بنختار القطعة، فناخد النسخة اللي على الشاشة دلوقتي
        el = $("trkVideo").querySelector(`.tl-clip[data-i="${i}"]`);
        el?.classList.add("dragging");
        $("trkVideo").append(marker);
      }
      if (el) el.style.transform = `translateX(${dx}px)`;
      // بتبدّل مع اللي جنبها أول ما طرفها يعدّي نص القطعة التانية
      const edge0 = dx > 0 ? me.t1 + dx / mt.pps : me.t0 + dx / mt.pps;
      const others = seq().items.filter((x) => x.kind === "clip" && x.i !== i);
      target = others.filter((x) => (x.t0 + x.t1) / 2 < edge0).length;
      const edge = target === 0 ? 0 : others[target - 1].t1 - (others[target - 1].i > i ? clipLength(mt.project.data.clips[i]) : 0);
      marker.style.left = `${edge * mt.pps}px`;
    },
    () => {
      marker.remove();
      if (!moving) return;
      const clips = mt.project.data.clips;
      if (target !== i) {
        pushHistory();
        const [c] = clips.splice(i, 1);
        clips.splice(target, 0, c);
        mt.sel = { kind: "clip", i: target };
        mt.t = seq().items[target].t0;
        changed();
      } else renderTimeline();
    }
  );
}

function moveTrack(e, kind, k, side) {
  pause();
  const info = trackParts(kind)[k];
  if (!info) return;
  pushHistory();
  const p = info.p;
  const { offset: off0, t0: delay0, len: len0 } = info;
  // أطراف القطع التانية عشان القطعة تلزق فيها
  const edges = [0, mt.t, ...trackParts(kind).filter((x) => x.k !== k).flatMap((x) => [x.t0, x.t1])];
  if (kind === "snd") edges.push(...seq().items.flatMap((x) => [x.t0, x.t1]), ...markers().map((m) => m.t));
  const lane0 = info.lane || 0;
  let moved = false;
  drag(
    e,
    (dx, dy) => {
      moved = true;
      let ds = snap(dx / mt.pps);
      if (kind === "snd" && !side) p.lane = clamp(lane0 + Math.round(dy / SND_LANE_H), 0, 7);
      if (!side) {
        let delay = Math.max(0, delay0 + ds);
        for (const edge of edges) {
          if (Math.abs(delay - edge) * mt.pps < 8) { delay = edge; break; }
          if (Math.abs(delay + len0 - edge) * mt.pps < 8) { delay = edge - len0; break; }
        }
        p.delay = snap(Math.max(0, delay));
      } else if (side === "l") {
        ds = clamp(ds, Math.max(-off0, -delay0), len0 - MIN_CLIP);
        p.offset = snap(off0 + ds);
        p.delay = snap(delay0 + ds);
        p.length = snap(len0 - ds);
      } else {
        const len = clamp(snap(len0 + ds), MIN_CLIP, info.dur - off0);
        p.length = len >= info.dur - off0 - 0.01 ? null : len;
      }
      renderTimeline();
    },
    () => {
      if (!moved) { mt.undo.pop(); renderHistoryButtons(); return; }
      renderSide();
      scheduleSave();
    }
  );
}

// دبل كليك على خط الصوت: يرجّعه 100%
$("tlCanvas").addEventListener("dblclick", (e) => {
  const box = e.target.closest("[data-vol]") && e.target.closest(".tl-clip, .tl-audio");
  if (!box) return;
  pushHistory();
  volTarget(box).set(1);
  changed();
});

// خط أداة القطع
$("tlCanvas").addEventListener("pointermove", (e) => {
  const hover = $("tlHover");
  const onClip = e.target.closest(".tl-clip[data-i], .tl-audio");
  hover.hidden = !(mt.tool === "blade" && onClip);
  if (!hover.hidden) hover.style.left = `${snap(canvasTime(e)) * mt.pps}px`;
});
$("tlCanvas").addEventListener("pointerleave", () => ($("tlHover").hidden = true));

// سحب فيديو من المكتبة للتايم لاين
$("tlCanvas").addEventListener("dragover", (e) => {
  if (e.dataTransfer.types.includes("text/sm-gen")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
});
$("tlCanvas").addEventListener("drop", (e) => {
  const id = e.dataTransfer.getData("text/sm-gen");
  if (!id) return;
  e.preventDefault();
  insertClip(id, insertIndexAt(canvasTime(e)));
});

// ---------- المعاينة والتشغيل ----------
const pool = new Map(); // لكل فيديو عنصر جاهز عشان التنقل بين القطع يبقى سريع
const audioEls = new Map(); // عنصر صوت لكل قطعة من التعليق أو الموسيقى
function audioFor(key) {
  let el = audioEls.get(key);
  if (!el) { el = new Audio(); el.preload = "auto"; audioEls.set(key, el); }
  return el;
}
function pauseAudio() {
  for (const el of audioEls.values()) el.pause();
}

function videoFor(url) {
  let v = pool.get(url);
  if (!v) {
    v = document.createElement("video");
    v.preload = "auto";
    v.playsInline = true;
    v.muted = true;
    v.src = url;
    v.addEventListener("loadedmetadata", () => mt.active === v && layoutActive());
    v.addEventListener("loadeddata", () => {
      if (mt.active !== v || mt.playing) return;
      layoutActive();
      v.currentTime = v.currentTime; // نطلب الفريم تاني عشان يترسم
    });
    $("pvStage").append(v);
    pool.set(url, v);
  }
  return v;
}

// ---------- تأثيرات القطعة (زي كاب كات): نفس حسبة FFmpeg في المعاينة ----------
const LOOKS = [["", "بدون"], ["vivid", "حيوي"], ["warm", "دافي"], ["cool", "بارد"], ["teal", "سينما"], ["vintage", "قديم"],
  ["fade", "باهت"], ["film", "فيلم"], ["pink", "وردي"], ["bw", "أبيض وأسود"], ["noir", "نوار"]];
const LOOK_CSS = { bw: "grayscale(1)", noir: "grayscale(1) contrast(1.35) brightness(.97)", warm: "sepia(.25) saturate(1.1)",
  cool: "hue-rotate(-10deg) saturate(.9) brightness(1.03)", vintage: "sepia(.35) contrast(.9) saturate(.85)", vivid: "saturate(1.45) contrast(1.08)",
  fade: "contrast(.82) brightness(1.05) saturate(.8)", teal: "hue-rotate(-8deg) saturate(1.1) contrast(1.05)", film: "contrast(1.2) saturate(.9)",
  pink: "hue-rotate(-12deg) saturate(1.15)" };
function clipCss(c) {
  const a = c.adj || {}, f = [];
  const b = (a.bright || 0) / 100, ct = (a.contrast || 0) / 100, sa = (a.sat || 0) / 100, tp = (a.temp || 0) / 100;
  if (b) f.push(`brightness(${(1 + b * 0.45).toFixed(3)})`);
  if (ct) f.push(`contrast(${(1 + ct * 0.6).toFixed(3)})`);
  if (sa) f.push(`saturate(${Math.max(0, 1 + sa).toFixed(3)})`);
  if (tp > 0) f.push(`sepia(${(tp * 0.3).toFixed(3)}) saturate(${(1 + tp * 0.2).toFixed(3)})`);
  if (tp < 0) f.push(`hue-rotate(${(tp * 18).toFixed(1)}deg) saturate(${(1 + tp * 0.1).toFixed(3)})`);
  if (LOOK_CSS[c.look]) f.push(LOOK_CSS[c.look]);
  return f.join(" ");
}
function fadeGain(it, t) {
  const c = it?.c;
  if (!c) return 1;
  let g = 1;
  if (c.fade_in > 0.01) g = Math.min(g, (t - it.t0) / c.fade_in);
  if (c.fade_out > 0.01) g = Math.min(g, (it.t1 - t) / c.fade_out);
  return clamp(g, 0, 1);
}
function fxBadges(c) {
  if (!c) return "";
  const b = [];
  if (clipSpeed(c) !== 1) b.push(`⚡${clipSpeed(c)}x`);
  if (c.reverse) b.push("⏪");
  if (c.look || Object.values(c.adj || {}).some((v) => v)) b.push("🎨");
  if (c.fade_in > 0.01 || c.fade_out > 0.01) b.push("◐");
  if (c.anim_in?.type || c.anim_out?.type) b.push("🎬");
  if (c.fx?.length) b.push("✨");
  if (c.angle || hasKf(c)) b.push("◆");
  if (c.disabled) b.push("⊘");
  return b.length ? `<em class="fxb">${b.join(" ")}</em> ` : "";
}
// طبقات المعاينة الإضافية: خلفية مغبّشة (للصورة الكاملة) + فينييت + غمقان الظهور/الاختفاء
function pvLayer(id, z) {
  let el = $(id);
  if (!el) {
    el = document.createElement(id === "pvBlur" || id === "pvGrain" ? "canvas" : "div");
    el.id = id;
    el.className = "pv-layer";
    el.style.zIndex = z;
    $("pvStage").append(el);
  }
  return el;
}
function drawBlurBg() {
  const v = mt.active, it = mt.activeItem, cv = pvLayer("pvBlur", 0);
  const on = !!(v && it?.c && it.c.fit === "blur" && v.videoWidth);
  cv.hidden = !on;
  if (!on) return;
  cv.width = 63; cv.height = 112;
  cv.style.filter = `blur(10px) brightness(.9) ${clipCss(it.c)}`;
  cv.style.transform = `scale(${it.c.flip_h ? -1.08 : 1.08}, ${it.c.flip_v ? -1.08 : 1.08})`;
  const g = cv.getContext("2d");
  const rot = ((it.c.rotate || 0) % 360 + 360) % 360, side = rot === 90 || rot === 270;
  const vw = side ? v.videoHeight : v.videoWidth, vh = side ? v.videoWidth : v.videoHeight;
  const sc = Math.max(cv.width / vw, cv.height / vh);
  g.setTransform(1, 0, 0, 1, cv.width / 2, cv.height / 2);
  g.rotate((rot * Math.PI) / 180);
  try { g.drawImage(v, -v.videoWidth * sc / 2, -v.videoHeight * sc / 2, v.videoWidth * sc, v.videoHeight * sc); } catch (e) { /* لسه مفيش فريم */ }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function applyFx(post) {
  const it = mt.activeItem, c = it?.kind === "clip" ? it.c : null;
  const vig = pvLayer("pvVig", 2), fade = pvLayer("pvFadeBlack", 2), flash = pvLayer("pvFlash", 2), grain = pvLayer("pvGrain", 2);
  const vv = (c?.adj?.vignette || 0) / 100;
  vig.style.opacity = vv > 0 ? vv.toFixed(2) : 0;
  fade.style.opacity = c ? (1 - fadeGain(it, mt.t)).toFixed(3) : 0;
  flash.style.opacity = c && post?.flash ? post.flash.toFixed(3) : 0;
  drawGrain(grain, c && post?.grain ? post.grain : 0);
  $("pvStage").style.background = canvasBg();
  drawBlurBg();
}
// لون الخلفية لما الصورة مش مالية الكادر (من إعدادات الكادر)
// فلاتر SVG للألوان المفصولة (نفس rgbashift في FFmpeg)، واحد لكل قوة
function makeRgbFilters() {
  if ($("pvRgbDefs")) return;
  const r = PV_W / OUT_W;
  let defs = "";
  for (let n = 1; n <= 12; n++) {
    const d = (n * r).toFixed(2);
    defs += `<filter id="pvRgb${n}" color-interpolation-filters="sRGB" x="-5%" y="0" width="110%" height="100%">
      <feColorMatrix in="SourceGraphic" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" dx="-${d}" result="r2"/>
      <feColorMatrix in="SourceGraphic" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>
      <feColorMatrix in="SourceGraphic" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/><feOffset in="b" dx="${d}" result="b2"/>
      <feBlend in="r2" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b2" mode="screen"/></filter>`;
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "pvRgbDefs";
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.innerHTML = defs;
  document.body.append(svg);
}
function canvasBg() {
  const bg = mt.project?.data.canvas?.bg;
  return /^#[0-9a-f]{6}$/i.test(bg || "") ? bg : "#000";
}
function drawGrain(cv, amt) {
  cv.hidden = !amt;
  if (!amt) return;
  if (cv.tagName !== "CANVAS") return;
  cv.width = 126; cv.height = 224;
  const g = cv.getContext("2d"), img = g.createImageData(cv.width, cv.height);
  for (let n = 0; n < img.data.length; n += 4) {
    const v = Math.random() * 255;
    img.data[n] = img.data[n + 1] = img.data[n + 2] = v;
    img.data[n + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  cv.style.opacity = (amt * 0.3).toFixed(3);
}

// ---------- الحركة: نفس معادلات FFmpeg بالظبط (montage.py: kf_value / motion_exprs / post_fx) ----------
const OUT_W = 1080, OUT_H = 1920;
const ANIMS = [["", "بدون"], ["fade", "ظهور"], ["zoomin", "زووم إن"], ["zoomout", "زووم أوت"], ["pop", "بوب"], ["spin", "لفّة"],
  ["slidel", "من اليمين"], ["slider", "من الشمال"], ["slideu", "من تحت"], ["slided", "من فوق"]];
const ANIM_FADES = new Set(["fade", "zoomin", "zoomout", "pop", "spin"]);
const EFFECTS = [["shake", "اهتزاز"], ["pulse", "نبض"], ["flash", "فلاش"], ["glitch", "جليتش"], ["rgb", "ألوان مفصولة"], ["blur", "بلور"], ["grain", "حبيبات"]];
const clipCrop = (c) => {
  const k = c?.crop || {};
  return { l: clamp(+k.l || 0, 0, 0.9), t: clamp(+k.t || 0, 0, 0.9), r: clamp(+k.r || 0, 0, 0.9), b: clamp(+k.b || 0, 0, 0.9) };
};
function kfValue(kf, key, def, t) {
  const pts = (kf || []).filter((k) => k[key] != null).map((k) => [+k.t, +k[key]]).sort((a, b) => a[0] - b[0]);
  if (!pts.length) return def;
  if (t <= pts[0][0]) return pts[0][1];
  for (let n = 0; n + 1 < pts.length; n++) {
    const [t0, v0] = pts[n], [t1, v1] = pts[n + 1];
    if (t < t1 && t1 - t0 >= 1e-3) { const p = (t - t0) / (t1 - t0); return v0 + (v1 - v0) * p * p * (3 - 2 * p); }
  }
  return pts[pts.length - 1][1];
}
const hasKf = (c) => (c?.kf?.length || 0) >= 2;
// حالة القطعة في الوقت tl (من أولها): z مضاعف زووم، x/y من -1 لـ 1، dx/dy بالبكسل (على مقاس 1080×1920)، a درجات، alpha
function clipMotion(c, tl, dur, tf) {
  const kf = hasKf(c) ? c.kf : null;
  let z = kf ? kfValue(kf, "zoom", c.zoom ?? 1, tl) : (c.zoom ?? 1);
  const x = kf ? kfValue(kf, "x", c.x || 0, tl) : (c.x || 0);
  const y = kf ? kfValue(kf, "y", c.y || 0, tl) : (c.y || 0);
  let a = kf ? kfValue(kf, "angle", c.angle || 0, tl) : (c.angle || 0);
  let dx = 0, dy = 0, alpha = 1;
  for (const [kind, an, sign] of [["in", c.anim_in, 1], ["out", c.anim_out, -1]]) {
    if (!an?.type || !(an.dur > 0.01)) continue;
    const d = Math.min(an.dur, dur);
    const p = clamp(kind === "in" ? tl / d : (dur - tl) / d, 0, 1), e = 1 - (1 - p) ** 3;
    if (ANIM_FADES.has(an.type)) alpha = Math.min(alpha, p);
    if (an.type === "zoomin") z *= 0.5 + 0.5 * e;
    else if (an.type === "zoomout") z *= 1.5 - 0.5 * e;
    else if (an.type === "pop") z *= 0.3 + 0.7 * (1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2);
    else if (an.type === "spin") { z *= 0.4 + 0.6 * e; a += -sign * 180 * (1 - e); }
    else if (an.type === "slidel") dx += sign * OUT_W * (1 - e);
    else if (an.type === "slider") dx += -sign * OUT_W * (1 - e);
    else if (an.type === "slideu") dy += sign * OUT_H * (1 - e);
    else if (an.type === "slided") dy += -sign * OUT_H * (1 - e);
  }
  const post = { flash: 0, hue: 0, rgb: 0, blur: 0, grain: 0 };
  for (const f of c.fx || []) {
    const amt = clamp((f.amt ?? 50) / 100, 0, 1);
    if (f.type === "shake") {
      dx += amt * OUT_W * 0.015 * (Math.sin(tf * 47) + Math.sin(tf * 31.7));
      dy += amt * OUT_H * 0.01 * (Math.sin(tf * 39) + Math.sin(tf * 27.3));
    } else if (f.type === "pulse") z *= 1 + amt * 0.08 * Math.max(0, Math.sin(tf * 12.566)) ** 4;
    else if (f.type === "glitch") {
      const burst = ((tf % 0.9) + 0.9) % 0.9 > 0.78 ? 1 : 0;
      dx += burst * amt * OUT_W * 0.04 * Math.sin(tf * 90);
      post.hue = burst * amt * 90;
    } else if (f.type === "flash") post.flash = amt * 0.5 * Math.max(0, Math.sin(tf * 9.4248)) ** 8;
    else if (f.type === "rgb") post.rgb = Math.max(1, Math.round(amt * 12));
    else if (f.type === "blur") post.blur = Math.max(0.5, amt * 12);
    else if (f.type === "grain") post.grain = amt;
  }
  return { z, x, y, a, dx, dy, alpha, post };
}
// مكان القطعة على الكادر (بالبكسل على مقاس 1080×1920): نص الصورة، مقاسها، زاويتها
function clipGeom(c, v, tl, dur, tf) {
  const rot = ((Number(c.rotate) || 0) % 360 + 360) % 360, side = rot === 90 || rot === 270;
  const cr = clipCrop(c), cw = Math.max(0.1, 1 - cr.l - cr.r), ch = Math.max(0.1, 1 - cr.t - cr.b);
  let sw = v.videoWidth * cw, sh = v.videoHeight * ch;
  if (side) [sw, sh] = [sh, sw];
  const fit = c.fit === "blur" || c.fit === "black";
  const k = fit ? Math.min(OUT_W / sw, OUT_H / sh) : Math.max(OUT_W / sw, OUT_H / sh);
  const m = clipMotion(c, tl, dur, tf);
  const w = sw * k * m.z, h = sh * k * m.z;
  const cx = (fit ? OUT_W / 2 + m.x * OUT_W / 2 : OUT_W / 2 - m.x * Math.max(0, w - OUT_W) / 2) + m.dx;
  const cy = (fit ? OUT_H / 2 + m.y * OUT_H / 2 : OUT_H / 2 - m.y * Math.max(0, h - OUT_H) / 2) + m.dy;
  return { rot, cr, cw, ch, k, fit, m, w, h, cx, cy, scale: k * m.z };
}
function itemTimes(it, t = mt.t) {
  const dur = it.t1 - it.t0;
  return { dur, tl: clamp(t - it.t0, 0, dur), tf: t - it.t0 };
}

function layoutActive() {
  const v = mt.active, it = mt.activeItem;
  if (!v || !it || !v.videoWidth) return;
  const c = it.kind === "clip" ? it.c : { zoom: 1, x: 0, y: 0 };
  const { dur, tl, tf } = itemTimes(it);
  const g = clipGeom(c, v, tl, dur, tf), r = PV_W / OUT_W;
  // الفيديو كله (قبل القص) بنفس المقياس، والجزء المقصوص بيتشال بـ clip-path ويتحط نصه في مكانه
  const s = g.scale * r, ew = v.videoWidth * s, eh = v.videoHeight * s;
  const ox = (g.cr.l + g.cw / 2) * ew, oy = (g.cr.t + g.ch / 2) * eh;
  const cropped = g.cr.l + g.cr.r + g.cr.t + g.cr.b > 0.001;
  const p = g.m.post, f = [it.kind === "clip" ? clipCss(c) : ""];
  if (p.blur) f.push(`blur(${(p.blur * r).toFixed(2)}px)`);
  if (p.hue) f.push(`hue-rotate(${p.hue.toFixed(1)}deg)`);
  if (p.rgb) { makeRgbFilters(); f.push(`url(#pvRgb${Math.min(12, p.rgb)})`); }
  Object.assign(v.style, {
    width: `${ew}px`, height: `${eh}px`, left: `${g.cx * r - ox}px`, top: `${g.cy * r - oy}px`,
    transformOrigin: `${ox}px ${oy}px`,
    transform: `rotate(${g.m.a}deg) scale(${c.flip_h ? -1 : 1},${c.flip_v ? -1 : 1}) rotate(${g.rot}deg)`,
    clipPath: cropped ? `inset(${g.cr.t * 100}% ${g.cr.r * 100}% ${g.cr.b * 100}% ${g.cr.l * 100}%)` : "",
    filter: f.join(" ").trim(),
  });
  v.style.setProperty("--a", g.m.alpha.toFixed(3));
  mt.geom = { it, g };
  applyFx(p);
  drawClipBox();
}

function itemAt(items, t, total) {
  return items.find((x) => t < x.t1) || (t >= total ? items[items.length - 1] : null);
}

function revealVideo(v) {
  for (const el of pool.values()) el.classList.toggle("on", el === v);
}
// القطع اللي جاية بتتحمّل وتقف على أول فريم فيها من بدري، عشان مايبقاش فيه أسود بين اللقطات
function preloadNext(items, it) {
  const k = items.indexOf(it);
  for (const x of items.slice(k + 1, k + 3)) {
    if (!x.url) continue;
    const n = videoFor(x.url);
    if (n === mt.active || n.seeking) continue;
    const first = x.rev ? x.out - 0.05 : x.in + 0.001;
    if (Math.abs(n.currentTime - first) > 0.05) n.currentTime = first;
  }
}

function showItem(it, t, playing) {
  const v = it?.url ? videoFor(it.url) : null;
  const want = v ? (it.kind === "clip" ? srcTimeAt(it, Math.min(t, it.t1 - 0.5 / FPS)) : it.in + clamp(t - it.t0, 0, it.t1 - it.t0 - 0.5 / FPS)) : 0;
  if (v !== mt.active) {
    mt.active?.pause();
    // اللقطة اللي فاتت تفضل ظاهرة لحد ما الجديدة يبقى عندها فريم جاهز (بدل ما الشاشة تسود)
    if (!v || (v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - want) < 0.1)) revealVideo(v);
    else {
      const ready = () => { if (mt.active === v) revealVideo(v); };
      v.addEventListener("seeked", ready, { once: true });
      v.addEventListener("loadeddata", ready, { once: true });
    }
  }
  const changedItem = mt.activeKey !== it?.key || mt.active !== v;
  mt.active = v;
  mt.activeItem = it;
  mt.activeKey = it?.key ?? null;
  if (!v) return;
  // أول ما الفيديو يظهر لازم نطلب الفريم من جديد، وإلا ممكن يفضل أسود
  if (changedItem) v.currentTime = want + 0.001;
  else if (it.rev && playing) { if (Math.abs(v.currentTime - want) > 0.06) v.currentTime = want; }  // العكس: بنسحب الفيديو لورا فريم فريم
  else if (!playing || Math.abs(v.currentTime - want) > 0.3) {
    if (Math.abs(v.currentTime - want) > 0.0005) v.currentTime = want + 0.001;
  }
  layoutActive();
}

function syncPreview() {
  if (!mt.project) return;
  const { items, total } = seq();
  mt.t = clamp(mt.t, 0, total);
  const it = itemAt(items, mt.t, total);
  $("pvEmpty").hidden = !!it;
  showItem(it, mt.t, false);
  if (it) preloadNext(items, it);
  if (!mt.active) applyFx();
  drawPlayhead();
  updatePreviewOverlays();
}

function seek(t) {
  if (!mt.project) return;
  mt.t = clamp(snap(t), 0, totalLength());
  if (mt.playing) {
    mt.clock = performance.now();
    mt.clockT = mt.t;
    mt.activeKey = null;
    pauseAudio();
  } else {
    syncPreview();
    if (hasKf(selectedClip())) renderInspector();
  }
  followPlayhead();
}

function step(frames) {
  pause();
  seek(snap(mt.t) + frames / FPS);
}

function play() {
  if (!mt.project || mt.playing) return;
  const total = totalLength();
  if (!total) return;
  if (mt.t >= total - 0.5 / FPS) mt.t = 0;
  mt.playing = true;
  mt.clock = performance.now();
  mt.clockT = mt.t;
  mt.activeKey = null;
  $("tpPlay").textContent = "⏸";
  tick();
}

function pause() {
  if (!mt.playing) return;
  mt.playing = false;
  cancelAnimationFrame(mt.raf);
  for (const v of pool.values()) { v.pause(); v.muted = true; }
  pauseAudio();
  $("tpPlay").textContent = "▶︎";
  mt.t = snap(mt.t);
  syncPreview();
}
const togglePlayback = () => (mt.playing ? pause() : play());

function syncAudio(el, info, t, total, fade) {
  if (!info || t < info.t0 || t >= info.t1) { if (!el.paused) el.pause(); return; }
  if (el.getAttribute("src") !== info.url) el.src = info.url;
  let vol = clamp(info.volume, 0, 1);
  const end = Math.min(total, info.t1);
  if (fade && info.t.fade_out && end - t < 1.5) vol *= clamp((end - t) / 1.5, 0, 1);
  const fi = info.p?.fade_in || 0, fo = info.p?.fade_out || 0;
  if (fi > 0.01) vol *= clamp((t - info.t0) / fi, 0, 1);
  if (fo > 0.01) vol *= clamp((end - t) / fo, 0, 1);
  el.volume = vol;
  const want = info.offset + (t - info.t0);
  if (el.paused) { el.currentTime = want; el.play().catch(() => {}); }
  else if (Math.abs(el.currentTime - want) > 0.3) el.currentTime = want;
}

function tick() {
  if (!mt.playing) return;
  if (!isMontage()) return pause();
  const { items, total } = seq();
  mt.t = mt.clockT + (performance.now() - mt.clock) / 1000;
  if (mt.t >= total) {
    if (mt.loop && total > 0.1) { seek(0); mt.raf = requestAnimationFrame(tick); return; }
    mt.t = total; return pause();
  }
  const it = itemAt(items, mt.t, total);
  showItem(it, mt.t, true);
  if (it && mt.activeKey !== mt.preloadedFor) { mt.preloadedFor = mt.activeKey; preloadNext(items, it); }
  const v = mt.active;
  if (v) {
    v.muted = !!it.rev;
    v.volume = clamp(it.volume * fadeGain(it, mt.t), 0, 1);
    v.playbackRate = it.speed || 1;
    if (it.rev) { if (!v.paused) v.pause(); }
    else if (v.paused) v.play().catch(() => {});
  }
  const live = new Set();
  for (const kind of ["voice", "music"]) {
    if (trackFlag(kind, "mute")) continue;
    const parts = trackParts(kind);
    const last = parts.reduce((m, x) => (!m || x.t0 > m.t0 ? x : m), null);
    for (const x of parts) {
      const key = `${kind}${x.k}`;
      live.add(key);
      syncAudio(audioFor(key), x, mt.t, total, kind === "music" && x === last);
    }
  }
  if (!trackFlag("snd", "mute")) {
    for (const x of soundParts()) {
      if (x.p.mute) continue;
      const key = `snd${x.k}`;
      live.add(key);
      syncAudio(audioFor(key), x, mt.t, total, false);
    }
  }
  for (const [key, el] of audioEls) if (!live.has(key) && !el.paused) el.pause();
  if (!mt.active) applyFx();
  drawPlayhead();
  updatePreviewOverlays();
  followPlayhead();
  mt.raf = requestAnimationFrame(tick);
}

// التايم لاين بيمشي مع المؤشر
function followPlayhead() {
  const sc = $("tlScroll");
  const x = mt.t * mt.pps;
  if (x > sc.scrollLeft + sc.clientWidth - 30) sc.scrollLeft = mt.playing ? x - 30 : x - sc.clientWidth / 2;
  else if (x < sc.scrollLeft) sc.scrollLeft = Math.max(0, x - (mt.playing ? 30 : sc.clientWidth / 2));
}

$("tpPlay").onclick = togglePlayback;
$("tpPrev").onclick = $("tlPrevFrame").onclick = () => step(-1);
$("tpNext").onclick = $("tlNextFrame").onclick = () => step(1);
$("tpStart").onclick = () => { pause(); seek(0); };
$("tpEnd").onclick = () => { pause(); seek(totalLength()); };

// تحريك وزووم ولف الصورة بالماوس على المعاينة (ومقابض زي كاب كات)
function clipBox() {
  let el = $("pvBox");
  if (!el) {
    el = document.createElement("div");
    el.id = "pvBox";
    el.className = "pv-box";
    el.innerHTML = `<i data-bh="nw"></i><i data-bh="ne"></i><i data-bh="sw"></i><i data-bh="se"></i><b data-bh="rot" title="اسحب عشان تلف · Shift = كل 15°"></b>`;
    $("previewFrame").closest(".ed-player").append(el);
    el.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-bh]")) startClipDrag(e); });
  }
  return el;
}
function drawClipBox() {
  const el = clipBox(), gm = mt.geom;
  const c = selectedClip();
  const show = !!(gm && c && gm.it.c === c && !mt.playing && !$("clipProps").hidden && document.querySelector('[data-pane="clip"]:not([hidden])'));
  el.hidden = !show;
  if (!show) return;
  // المربع برّه الكادر عشان المقابض تبان حتى لو الصورة أكبر منه (زي كاب كات)
  const fr = $("previewFrame").getBoundingClientRect(), pr = el.parentElement.getBoundingClientRect();
  const r = (PV_W / OUT_W) * (fr.width / PV_W), g = gm.g;
  Object.assign(el.style, {
    width: `${g.w * r}px`, height: `${g.h * r}px`,
    left: `${fr.left - pr.left + g.cx * r - (g.w * r) / 2}px`, top: `${fr.top - pr.top + g.cy * r - (g.h * r) / 2}px`,
    transform: `rotate(${g.m.a}deg)`,
  });
}
$("previewFrame").addEventListener("pointerdown", (e) => startClipDrag(e));
function startClipDrag(e) {
  const it = mt.activeItem, v = mt.active;
  if (e.button !== 0 || it?.kind !== "clip" || !v?.videoWidth) return;
  if (e.target.closest(".pv-typo [data-gz], .sc-pick")) return;
  e.preventDefault();
  pause();
  mt.sel = { kind: "clip", i: it.i };
  showTab("clip");
  renderTimeline();
  renderInspector();
  pushHistory();
  const c = it.c, fr = $("previewFrame").getBoundingClientRect(), r = (PV_W / OUT_W) * (fr.width / PV_W);
  const t0 = transformNow(c);
  const { dur, tl, tf } = itemTimes(it);
  const g0 = clipGeom(c, v, tl, dur, tf);
  const ccx = fr.left + g0.cx * r, ccy = fr.top + g0.cy * r;
  const hnd = e.target.closest("[data-bh]")?.dataset.bh;
  $("previewFrame").classList.add("panning");
  const d0 = Math.hypot(e.clientX - ccx, e.clientY - ccy) || 1, a0 = Math.atan2(e.clientY - ccy, e.clientX - ccx);
  drag(
    e,
    (dx, dy, ev) => {
      if (hnd === "rot") {
        let a = t0.angle + ((Math.atan2(ev.clientY - ccy, ev.clientX - ccx) - a0) * 180) / Math.PI;
        a = ((a + 540) % 360) - 180;
        if (ev.shiftKey) a = Math.round(a / 15) * 15;
        setTransform(c, { angle: Math.round(a * 10) / 10 });
      } else if (hnd) {
        const d = Math.hypot(ev.clientX - ccx, ev.clientY - ccy);
        setTransform(c, { zoom: clamp(Math.round(t0.zoom * (d / d0) * 100) / 100, 0.1, 4) });
      } else {
        // نفس معادلة المكان في FFmpeg: «يملا الكادر» بيتحرك جوه الزيادة، و«كامل» بنسبة من الكادر
        const pdx = dx / r, pdy = dy / r;
        if (g0.fit) setTransform(c, { x: clamp(t0.x + pdx / (OUT_W / 2), -3, 3), y: clamp(t0.y + pdy / (OUT_H / 2), -3, 3) });
        else {
          const mx = Math.max(0, g0.w - OUT_W) / 2, my = Math.max(0, g0.h - OUT_H) / 2;
          setTransform(c, { ...(mx > 1 ? { x: clamp(t0.x - pdx / mx, -1, 1) } : {}), ...(my > 1 ? { y: clamp(t0.y - pdy / my, -1, 1) } : {}) });
        }
      }
      layoutActive();
      drawClipBox();
      renderInspector();
    },
    () => { $("previewFrame").classList.remove("panning"); if (hasKf(c)) renderTimeline(); scheduleSave(); }
  );
}
$("previewFrame").addEventListener(
  "wheel",
  (e) => {
    const it = mt.activeItem;
    if (it?.kind !== "clip") return;
    e.preventDefault();
    pushHistory("wheel-zoom");
    const z = transformNow(it.c).zoom;
    setTransform(it.c, { zoom: clamp(z * (e.deltaY < 0 ? 1.05 : 1 / 1.05), 0.1, 4) });
    mt.sel = { kind: "clip", i: it.i };
    layoutActive();
    drawClipBox();
    renderInspector();
    scheduleSave();
  },
  { passive: false }
);

// ---------- أدوات زي كاب كات: كليك يمين، نسخ/لصق الإعدادات، مسح قبل/بعد المؤشر، علامات، تكرار، شاشة كاملة ----------
// الإعدادات اللي بتتنسخ من قطعة لقطعة (كل حاجة غير الفيديو نفسه والقص والمكان على التايم لاين)
const ATTR_KEYS = ["zoom", "x", "y", "angle", "rotate", "flip_h", "flip_v", "fit", "crop", "speed", "adj", "look",
  "fade_in", "fade_out", "anim_in", "anim_out", "fx", "volume"];
function copyAttrs(c = selectedClip()) {
  if (!c) return toast("اختار قطعة فيديو الأول", true);
  mt.attrs = JSON.parse(JSON.stringify(Object.fromEntries(ATTR_KEYS.map((k) => [k, c[k] ?? null]))));
  toast("📋 اتنسخت إعدادات القطعة · Ctrl+Shift+V تلصقها");
}
function applyAttrs(c) {
  const a = JSON.parse(JSON.stringify(mt.attrs));
  if (c.reverse && clipOut(c) - c.start > 60) a.speed = a.speed ?? 1;
  Object.assign(c, a);
}
function pasteAttrs(all = false) {
  if (!mt.attrs) return toast("انسخ إعدادات قطعة الأول (كليك يمين ← انسخ الإعدادات)", true);
  const d = mt.project.data;
  const targets = all ? d.clips.filter((c) => !isOutroClip(c))
    : allSelected().filter((x) => x.kind === "clip").map((x) => d.clips[x.i]).filter(Boolean);
  if (!targets.length) return toast("اختار القطعة اللي هتلصق عليها", true);
  pushHistory();
  targets.forEach(applyAttrs);
  changed();
  toast(`✓ اتلصقت على ${targets.length} قطعة`);
}
// امسح الجزء اللي قبل أو بعد المؤشر من القطعة اللي تحته (أو المختارة)
function deleteSide(side) {
  const items = seq().items;
  const it = (mt.sel?.kind === "clip" && items[mt.sel.i] && mt.t > items[mt.sel.i].t0 && mt.t < items[mt.sel.i].t1)
    ? items[mt.sel.i] : items.find((x) => x.kind === "clip" && mt.t > x.t0 && mt.t < x.t1);
  if (!it) return toast("حط المؤشر جوه قطعة فيديو", true);
  const at = snap(srcTimeAt(it, mt.t));
  const c = it.c;
  if ((side === "left") !== !!it.rev ? at - c.start < MIN_CLIP : clipOut(c) - at < MIN_CLIP) return toast("مفيش ولا فريم يتمسح", true);
  pushHistory();
  const len = it.t1 - it.t0, cut = mt.t - it.t0;
  if (side === "left") {
    c.kf = kfWindow(c, cut, len); c.anim_in = null; c.fade_in = 0;
    if (it.rev) c.end = at; else c.start = at;
    mt.t = it.t0;
  } else {
    c.kf = kfWindow(c, 0, cut); c.anim_out = null; c.fade_out = 0;
    if (it.rev) c.start = at; else c.end = at;
  }
  mt.sel = { kind: "clip", i: it.i };
  changed();
}
$("tlDelLeft").onclick = () => deleteSide("left");
$("tlDelRight").onclick = () => deleteSide("right");

// العلامات
function markers() { return mt.project?.data.markers || (mt.project.data.markers = []); }
function addMarker() {
  if (!mt.project) return;
  const t = snap(mt.t);
  const list = markers();
  const n = list.findIndex((m) => Math.abs(m.t - t) < 0.5 / FPS);
  pushHistory();
  if (n >= 0) list.splice(n, 1);
  else list.push({ t, label: "" }), list.sort((a, b) => a.t - b.t);
  renderMarkers();
  scheduleSave();
}
$("tlMarker").onclick = addMarker;
function renderMarkers() {
  const box = $("tlMarkers");
  if (!box || !mt.project) return;
  box.innerHTML = markers().map((m, n) => `<i class="tl-mark" data-m="${n}" style="left:${m.t * mt.pps}px" title="${escapeHtml(m.label || "علامة")} · ${fmtTC(m.t)} · دوسة تروحلها · دبل كليك تكتب اسم · كليك يمين تمسحها"><em>${escapeHtml(m.label || "")}</em></i>`).join("");
}
$("tlMarkers").addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".tl-mark");
  if (!el || e.button !== 0) return;
  e.stopPropagation();
  seek(markers()[Number(el.dataset.m)].t);
});
$("tlMarkers").addEventListener("dblclick", (e) => {
  const el = e.target.closest(".tl-mark");
  if (!el) return;
  const m = markers()[Number(el.dataset.m)];
  const name = prompt("اسم العلامة", m.label || "");
  if (name == null) return;
  pushHistory();
  m.label = name.trim().slice(0, 40);
  renderMarkers();
  scheduleSave();
});

// التشغيل المتكرر والشاشة الكاملة
function toggleLoop() {
  mt.loop = !mt.loop;
  $("tpLoop").classList.toggle("on", mt.loop);
  toast(mt.loop ? "🔁 التشغيل المتكرر شغال" : "التشغيل المتكرر اتقفل");
}
$("tpLoop").onclick = toggleLoop;
function toggleFull() {
  const el = $("previewFrame").closest(".ed-player");
  if (document.fullscreenElement) document.exitFullscreen?.();
  else el.requestFullscreen?.().catch(() => toast("المتصفح مش سامح بالشاشة الكاملة", true));
}
$("tpFull").onclick = toggleFull;
document.addEventListener("fullscreenchange", () => {
  const full = !!document.fullscreenElement;
  $("previewFrame").closest(".ed-player").classList.toggle("full", full);
  // الكادر بيكبر على قد الشاشة (المعاينة بنفس الحسبة، بس بتتكبّر بـ CSS)
  const fr = $("previewFrame");
  fr.style.transform = full ? `scale(${Math.min((innerHeight - 90) / PV_H, (innerWidth - 40) / PV_W).toFixed(3)})` : "";
  drawClipBox();
});

// قايمة الكليك يمين
function ctxMenu() {
  let m = $("ctxMenu");
  if (!m) {
    m = document.createElement("div");
    m.id = "ctxMenu";
    m.className = "ctx-menu";
    m.hidden = true;
    document.body.append(m);
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b || b.disabled) return;
      m.hidden = true;
      CTX_ACTS[b.dataset.act]?.();
    });
    document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#ctxMenu")) m.hidden = true; }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") m.hidden = true; });
  }
  return m;
}
const CTX_ACTS = {
  copy: () => copyAttrs(),
  paste: () => pasteAttrs(),
  pasteAll: () => pasteAttrs(true),
  dup: () => $("edDup").click(),
  split: () => splitAt(mt.t),
  delLeft: () => deleteSide("left"),
  delRight: () => deleteSide("right"),
  disable: () => $("edDisable").click(),
  replace: () => $("edReplace").click(),
  del: () => deleteSelected(),
  resetFx: () => $("fxReset").click(),
  kf: () => $("kfToggle").click(),
};
$("tlCanvas").addEventListener("contextmenu", (e) => {
  const clipEl = e.target.closest(".tl-clip[data-i]"), audEl = e.target.closest(".tl-audio[data-track]");
  const mk = e.target.closest(".tl-mark");
  if (mk) {
    e.preventDefault();
    pushHistory();
    markers().splice(Number(mk.dataset.m), 1);
    renderMarkers();
    scheduleSave();
    return;
  }
  if (!clipEl && !audEl) return;
  e.preventDefault();
  const x = selOfEl(clipEl || audEl);
  if (kindLocked(x.kind)) return toast("التراك ده مقفول 🔒", true);
  if (!isSel(x)) selectItem(x);
  const c = clipEl ? mt.project.data.clips[x.i] : null;
  const k = (key) => `<kbd>${key}</kbd>`;
  const rows = clipEl ? [
    ["copy", "📋 انسخ الإعدادات", k("Ctrl+Shift+C")],
    ["paste", "📥 الصق الإعدادات", k("Ctrl+Shift+V"), !mt.attrs],
    ["pasteAll", "📥 الصق الإعدادات على كل القطع", "", !mt.attrs],
    "-",
    ["split", "✂ قسّم عند المؤشر", k("S")],
    ["delLeft", "⇤ امسح اللي قبل المؤشر", k("Q")],
    ["delRight", "⇥ امسح اللي بعد المؤشر", k("W")],
    ["dup", "⧉ كرّر", ""],
    ["kf", "◇ كي فريم عند المؤشر", ""],
    "-",
    ["replace", "🔁 استبدل الفيديو", ""],
    ["disable", c?.disabled ? "✓ فعّل القطعة" : "⊘ عطّل القطعة", ""],
    ["resetFx", "↺ شيل كل التأثيرات", ""],
    ["del", "🗑 احذف", k("Delete")],
  ] : [
    ["split", "✂ قسّم عند المؤشر", k("S")],
    ["del", "🗑 احذف", k("Delete")],
  ];
  const m = ctxMenu();
  m.innerHTML = rows.map((r) => r === "-" ? "<hr>" :
    `<button data-act="${r[0]}" ${r[3] ? "disabled" : ""}><span>${r[1]}</span>${r[2]}</button>`).join("");
  m.hidden = false;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = `${Math.min(e.clientX, innerWidth - w - 8)}px`;
  m.style.top = `${Math.min(e.clientY, innerHeight - h - 8)}px`;
});

// ---------- الكيبورد ----------
document.addEventListener("keydown", (e) => {
  if (!mt.project || !isMontage() || document.querySelector("dialog[open]")) return;
  if (e.target.matches("input:not([type=range]):not([type=checkbox]), textarea, select")) return;
  if (e.target.matches("input[type=range]") && e.key.startsWith("Arrow")) return;
  const ctrl = e.ctrlKey || e.metaKey;
  const code = e.code;
  let done = true;
  if (e.key === " " || code === "Space") togglePlayback();
  else if (e.key === "ArrowLeft") step(e.shiftKey ? -FPS : -1);
  else if (e.key === "ArrowRight") step(e.shiftKey ? FPS : 1);
  else if (e.key === "Home") { pause(); seek(0); }
  else if (e.key === "End") { pause(); seek(totalLength()); }
  else if (ctrl && code === "KeyZ") e.shiftKey ? redoEdit() : undoEdit();
  else if (ctrl && code === "KeyY") redoEdit();
  else if (ctrl && code === "KeyA") {
    setSelection([...document.querySelectorAll("#tlCanvas .tl-clip, #tlCanvas .tl-audio, #tlCanvas .tl-cap")].map(selOfEl));
    renderTimeline();
    renderInspector();
  }
  else if (ctrl && code === "KeyB") splitAt(mt.t);
  else if (ctrl && e.shiftKey && code === "KeyC") copyAttrs();
  else if (ctrl && e.shiftKey && code === "KeyV") pasteAttrs();
  else if (ctrl) done = false;
  else if (code === "KeyQ") deleteSide("left");
  else if (code === "KeyW") deleteSide("right");
  else if (code === "KeyM") addMarker();
  else if (code === "KeyL") toggleLoop();
  else if (code === "KeyF") toggleFull();
  else if (code === "KeyS") splitAt(mt.t);
  else if (code === "KeyB" || code === "KeyC") setTool("blade");
  else if (e.key === "Escape") { setTool("select"); mt.sel = null; renderTimeline(); renderInspector(); }
  else if (code === "KeyV" || code === "KeyA") setTool("select");
  else if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
  else if (e.key === "+" || e.key === "=") setZoom(mt.pps * 1.5);
  else if (e.key === "-" || e.key === "_") setZoom(mt.pps / 1.5);
  else done = false;
  if (done) {
    e.preventDefault();
    if (e.target.matches("button")) e.target.blur();
  }
});

// ---------- لوحة الإعدادات ----------
function showTab(tab) {
  document.querySelectorAll("#inspTabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".ed-inspector .pane").forEach((p) => (p.hidden = p.dataset.pane !== tab));
  if (mt.project) updatePreviewOverlays();
}
$("inspTabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) showTab(b.dataset.tab);
});

function renderInspector() {
  renderPartProps();
  const c = selectedClip();
  const s = c && clipSource(c);
  $("clipProps").hidden = !s;
  $("outroProps").hidden = mt.sel?.kind !== "outro";
  $("clipNone").hidden = !!s || mt.sel?.kind === "outro";
  if (!s) return;
  $("editorLabel").textContent = `${mt.sel.i + 1}. ${s.label}`;
  $("clipTimes").textContent = `المدة ${clipLength(c).toFixed(2)}ث · من ${fmtTC(c.start)} لـ ${fmtTC(clipOut(c))} في الفيديو الأصلي`;
  const tv = transformNow(c);
  $("edZoom").value = Math.round(tv.zoom * 100);
  $("edX").value = Math.round(tv.x * 100);
  $("edY").value = Math.round(tv.y * 100);
  $("edVol").value = Math.round(c.volume * 100);
  $("zoomVal").textContent = `${Math.round(tv.zoom * 100)}%`;
  $("xVal").textContent = tv.x.toFixed(2);
  $("yVal").textContent = tv.y.toFixed(2);
  $("volVal").textContent = s.has_audio ? `${Math.round(c.volume * 100)}%` : "";
  $("edVol").disabled = !s.has_audio;
  $("edMute").hidden = !s.has_audio;
  $("edMute").textContent = c.volume === 0 ? "🔊 رجّع الصوت" : "🔇 اكتم صوت الفيديو ده";
  $("noAudio").hidden = !!s.has_audio;
  renderFx(c);
  $("edDisable").textContent = c.disabled ? "✓ فعّل القطعة" : "⊘ عطّل";
}

// الحجم والمكان والزاوية: لو القطعة فيها كي فريمز، التعديل بيتحط في كي فريم عند المؤشر (زي كاب كات)
const TKEYS = ["zoom", "x", "y", "angle"];
function selItem() {
  return mt.sel?.kind === "clip" ? seq().items[mt.sel.i] : null;
}
function clipLocalT(c) {
  const it = seq().items.find((x) => x.c === c);
  return it ? clamp(mt.t - it.t0, 0, it.t1 - it.t0) : 0;
}
function transformNow(c, at) {
  const kf = hasKf(c) ? c.kf : null;
  const t = at ?? (kf ? clipLocalT(c) : 0);
  const base = { zoom: c.zoom ?? 1, x: c.x || 0, y: c.y || 0, angle: c.angle || 0 };
  if (!kf) return base;
  return Object.fromEntries(TKEYS.map((k) => [k, kfValue(kf, k, base[k], t)]));
}
function kfAt(c, t) {
  return (c.kf || []).findIndex((k) => Math.abs(k.t - t) < 0.5 / FPS);
}
function setTransform(c, patch) {
  if (!hasKf(c)) { Object.assign(c, patch); return; }
  const t = clipLocalT(c);
  let n = kfAt(c, t);
  if (n < 0) {
    c.kf.push({ t: Math.round(t * FPS) / FPS, ...transformNow(c) });
    c.kf.sort((a, b) => a.t - b.t);
    n = kfAt(c, t);
  }
  Object.assign(c.kf[n], patch);
}
function editorInput(key, apply) {
  return () => {
    const c = selectedClip();
    if (!c) return;
    pushHistory(key);
    const nk = c.kf?.length || 0;
    apply(c);
    if ((c.kf?.length || 0) !== nk) renderTimeline();
    renderInspector();
    // لو القطعة المختارة مش هي اللي في المعاينة، نروح لها
    const it = seq().items[mt.sel.i];
    if (it && (mt.t < it.t0 || mt.t >= it.t1)) seek(it.t0);
    else syncPreview();
    scheduleSave();
  };
}
$("edZoom").addEventListener("input", editorInput("zoom", (c) => setTransform(c, { zoom: Number($("edZoom").value) / 100 })));
$("edX").addEventListener("input", editorInput("x", (c) => setTransform(c, { x: Number($("edX").value) / 100 })));
$("edY").addEventListener("input", editorInput("y", (c) => setTransform(c, { y: Number($("edY").value) / 100 })));
$("edVol").addEventListener("input", editorInput("vol", (c) => (c.volume = Number($("edVol").value) / 100)));
$("edMute").onclick = () => { const c = selectedClip(); if (c) toggleMute(c); };
$("edReset").onclick = editorInput(null, (c) => Object.assign(c, { zoom: 1, x: 0, y: 0, volume: 1 }));

// ---------- لوحة التأثيرات (سرعة/عكس/شكل/فلتر/ألوان/ظهور) ----------
const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3, 4];
const FITS = [["fill", "يملا الكادر"], ["blur", "كامل + خلفية مغبّشة"], ["black", "كامل + أسود"]];
const ADJ = [["bright", "الإضاءة"], ["contrast", "التباين"], ["sat", "التشبّع"], ["temp", "دافي ⟷ بارد"], ["vignette", "إطار غامق"], ["sharp", "الحدّة"]];
const REV_MAX = 60;
$("fxSpeedChips").innerHTML = SPEEDS.map((v) => `<button class="chip" data-speed="${v}">${v}x</button>`).join("");
$("fxFit").innerHTML = FITS.map(([k, l]) => `<button class="chip" data-fit="${k}">${l}</button>`).join("");
$("fxLooks").innerHTML = LOOKS.map(([k, l]) => `<button class="chip" data-look="${k}">${l}</button>`).join("");
$("fxAdj").innerHTML = ADJ.map(([k, l]) =>
  `<label>${l} <b data-adjval="${k}"></b><input type="range" dir="ltr" data-adj="${k}" min="-100" max="100" step="1"></label>`).join("");
// التغييرات اللي بتغيّر طول القطعة أو علاماتها لازم ترسم التايم لاين تاني
const fxInput = (key, apply) => {
  const run = editorInput(key, apply);
  return (e) => { run(e); renderTimeline(); };
};
const setSpeed = (c, v) => {
  v = clamp(Math.round(v * 100) / 100, 0.25, 4);
  if (c.reverse && (clipOut(c) - c.start) > REV_MAX) c.reverse = false;
  c.speed = v;
};
$("fxSpeedChips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-speed]");
  if (b) fxInput("speed", (c) => setSpeed(c, Number(b.dataset.speed)))();
});
$("fxSpeed").addEventListener("input", fxInput("speed", (c) => setSpeed(c, 2 ** (Number($("fxSpeed").value) / 100))));
$("fxReverse").addEventListener("change", fxInput("rev", (c) => {
  c.reverse = $("fxReverse").checked && (clipOut(c) - c.start) <= REV_MAX;
}));
$("fxFit").addEventListener("click", (e) => {
  const b = e.target.closest("[data-fit]");
  if (b) editorInput(null, (c) => (c.fit = b.dataset.fit === "fill" ? "" : b.dataset.fit))();
});
$("fxLooks").addEventListener("click", (e) => {
  const b = e.target.closest("[data-look]");
  if (b) fxInput(null, (c) => (c.look = b.dataset.look))();
});
$("fxAdj").addEventListener("input", (e) => {
  const k = e.target.dataset.adj;
  if (k) fxInput("adj-" + k, (c) => (c.adj = { ...(c.adj || {}), [k]: Number(e.target.value) }))();
});
$("fxAdj").addEventListener("dblclick", (e) => {
  const k = e.target.dataset.adj;
  if (k) fxInput(null, (c) => (c.adj = { ...(c.adj || {}), [k]: 0 }))();
});
$("fxRotate").onclick = editorInput(null, (c) => (c.rotate = ((c.rotate || 0) + 90) % 360));
$("fxFlipH").onclick = editorInput(null, (c) => (c.flip_h = !c.flip_h));
$("fxFlipV").onclick = editorInput(null, (c) => (c.flip_v = !c.flip_v));
$("fxFadeIn").addEventListener("input", fxInput("fadein", (c) => (c.fade_in = Number($("fxFadeIn").value) / 100)));
$("fxFadeOut").addEventListener("input", fxInput("fadeout", (c) => (c.fade_out = Number($("fxFadeOut").value) / 100)));
$("fxReset").onclick = fxInput(null, (c) => Object.assign(c, {
  speed: 1, reverse: false, flip_h: false, flip_v: false, rotate: 0, adj: {}, look: "", fade_in: 0, fade_out: 0, fit: "",
  angle: 0, crop: null, kf: null, anim_in: null, anim_out: null, fx: [],
}));
$("edDisable").onclick = fxInput(null, (c) => (c.disabled = !c.disabled));
// اللف بأي زاوية والمحاذاة
$("fxAngle").addEventListener("input", editorInput("angle", (c) => setTransform(c, { angle: Number($("fxAngle").value) })));
$("fxAngle").addEventListener("dblclick", editorInput(null, (c) => setTransform(c, { angle: 0 })));
$("fxAlign").addEventListener("click", (e) => {
  const b = e.target.closest("[data-align]");
  if (!b) return;
  editorInput(null, (c) => {
    const v = mt.active, it = selItem();
    const fit = c.fit === "blur" || c.fit === "black";
    let ex = 1, ey = 1;  // في «كامل»: المكان اللي حرف الصورة فيه بيلزق في حرف الكادر
    if (fit && v?.videoWidth && it) {
      const { dur, tl, tf } = itemTimes(it), g = clipGeom(c, v, tl, dur, tf);
      ex = g.w / OUT_W - 1; ey = g.h / OUT_H - 1;
    }
    const a = b.dataset.align;
    const p = a === "l" ? { x: fit ? ex : -1 } : a === "r" ? { x: fit ? -ex : 1 } : a === "ch" ? { x: 0 }
      : a === "t" ? { y: fit ? ey : -1 } : a === "b" ? { y: fit ? -ey : 1 } : { y: 0 };
    setTransform(c, p);
  })();
});
// قص الكادر
$("clipFx").addEventListener("input", (e) => {
  const k = e.target.dataset.crop;
  if (k) fxInput("crop-" + k, (c) => (c.crop = { ...clipCrop(c), [k]: Number(e.target.value) / 100 }))();
});
// حركات الدخول والخروج
$("fxAnimIn").innerHTML = ANIMS.map(([k, l]) => `<button class="chip" data-anim="${k}">${l}</button>`).join("");
$("fxAnimOut").innerHTML = ANIMS.map(([k, l]) => `<button class="chip" data-anim="${k}">${l}</button>`).join("")
  .replace("من اليمين", "لليمين").replace("من الشمال", "للشمال").replace("من تحت", "لتحت").replace("من فوق", "لفوق");
for (const [box, key, dur] of [["fxAnimIn", "anim_in", "fxAnimInDur"], ["fxAnimOut", "anim_out", "fxAnimOutDur"]]) {
  $(box).addEventListener("click", (e) => {
    const b = e.target.closest("[data-anim]");
    if (b) fxInput(null, (c) => (c[key] = b.dataset.anim ? { type: b.dataset.anim, dur: c[key]?.dur || 0.5 } : null))();
  });
  $(dur).addEventListener("input", editorInput(key, (c) => {
    if (c[key]?.type) c[key].dur = Number($(dur).value) / 100;
  }));
}
// التأثيرات
$("fxEffects").innerHTML = EFFECTS.map(([k, l]) => `<button class="chip" data-eff="${k}">${l}</button>`).join("");
$("fxEffects").addEventListener("click", (e) => {
  const b = e.target.closest("[data-eff]");
  if (!b) return;
  fxInput(null, (c) => {
    const fx = c.fx || [];
    c.fx = fx.some((f) => f.type === b.dataset.eff) ? fx.filter((f) => f.type !== b.dataset.eff) : [...fx, { type: b.dataset.eff, amt: 50 }];
  })();
});
$("fxEffectAmts").addEventListener("input", (e) => {
  const k = e.target.dataset.effamt;
  if (k) editorInput("eff-" + k, (c) => { const f = (c.fx || []).find((x) => x.type === k); if (f) f.amt = Number(e.target.value); })();
});
// الكي فريمز
$("kfToggle").onclick = fxInput(null, (c) => {
  const t = clipLocalT(c), cur = transformNow(c);
  if (!hasKf(c)) {
    // أول كي فريم: بنحط واحد في أول القطعة وواحد عند المؤشر (بنفس القيم)، وبعدها أي تعديل بيتحط عند المؤشر
    const it = seq().items.find((x) => x.c === c), end = it ? it.t1 - it.t0 : t;
    const at = t > 0.05 ? t : end;
    c.kf = [{ t: 0, ...cur }, { t: Math.round(at * FPS) / FPS, ...cur }];
    return;
  }
  const n = kfAt(c, t);
  if (n >= 0) c.kf.splice(n, 1);
  else { c.kf.push({ t: Math.round(t * FPS) / FPS, ...cur }); c.kf.sort((a, b) => a.t - b.t); }
  if (c.kf.length < 2) { Object.assign(c, transformNow({ ...c, kf: null })); c.kf = null; }
});
$("kfClear").onclick = fxInput(null, (c) => { Object.assign(c, transformNow(c)); c.kf = null; });
function jumpKf(dir) {
  const c = selectedClip(), it = selItem();
  if (!c || !it || !hasKf(c)) return;
  const t = mt.t - it.t0;
  const list = c.kf.map((k) => k.t).sort((a, b) => a - b);
  const next = dir > 0 ? list.find((x) => x > t + 0.5 / FPS) : [...list].reverse().find((x) => x < t - 0.5 / FPS);
  if (next != null) seek(it.t0 + next);
}
$("kfPrev").onclick = () => jumpKf(-1);
$("kfNext").onclick = () => jumpKf(1);
function renderFx(c) {
  const sp = clipSpeed(c), a = c.adj || {}, fit = c.fit || "fill";
  const tv = transformNow(c);
  $("fxAngle").value = Math.round(tv.angle);
  $("angleVal").textContent = Math.round(tv.angle) ? `${Math.round(tv.angle)}°` : "";
  const cr = clipCrop(c);
  for (const k of ["l", "t", "r", "b"]) {
    document.querySelector(`[data-crop="${k}"]`).value = Math.round(cr[k] * 100);
    document.querySelector(`[data-cropval="${k}"]`).textContent = cr[k] ? `${Math.round(cr[k] * 100)}%` : "";
  }
  for (const [box, key, dur, lab] of [["fxAnimIn", "anim_in", "fxAnimInDur", "animInVal"], ["fxAnimOut", "anim_out", "fxAnimOutDur", "animOutVal"]]) {
    const an = c[key]?.type ? c[key] : null;
    $(box).querySelectorAll("[data-anim]").forEach((b) => b.classList.toggle("on", b.dataset.anim === (an?.type || "")));
    $(dur).hidden = !an;
    $(dur).value = Math.round((an?.dur || 0.5) * 100);
    $(lab).textContent = an ? `${an.dur.toFixed(2)}ث` : "";
  }
  const fxs = c.fx || [];
  $("fxEffects").querySelectorAll("[data-eff]").forEach((b) => b.classList.toggle("on", fxs.some((f) => f.type === b.dataset.eff)));
  const want = fxs.map((f) => f.type).join(",");
  if ($("fxEffectAmts").dataset.k !== want) {
    $("fxEffectAmts").dataset.k = want;
    $("fxEffectAmts").innerHTML = fxs.map((f) => `<label>قوة ${EFFECTS.find((x) => x[0] === f.type)?.[1] || f.type} <b data-effval="${f.type}"></b>
      <input type="range" dir="ltr" data-effamt="${f.type}" min="5" max="100" step="1"></label>`).join("");
  }
  for (const f of fxs) {
    const r = document.querySelector(`[data-effamt="${f.type}"]`);
    if (r && document.activeElement !== r) r.value = f.amt ?? 50;
    const l = document.querySelector(`[data-effval="${f.type}"]`);
    if (l) l.textContent = `${f.amt ?? 50}%`;
  }
  const kfOn = hasKf(c), here = kfOn && kfAt(c, clipLocalT(c)) >= 0;
  $("kfToggle").classList.toggle("on", here);
  $("kfToggle").textContent = here ? "◆ شيل الكي فريم" : "◇ كي فريم";
  $("kfInfo").textContent = kfOn ? `${c.kf.length} كي فريم` : "";
  $("kfClear").hidden = !kfOn;
  $("kfPrev").disabled = $("kfNext").disabled = !kfOn;
  $("speedVal").textContent = `${sp}x`;
  $("fxSpeed").value = Math.round(Math.log2(sp) * 100);
  document.querySelectorAll("#fxSpeedChips [data-speed]").forEach((b) => b.classList.toggle("on", Number(b.dataset.speed) === sp));
  const longSrc = clipOut(c) - c.start > REV_MAX;
  $("fxReverse").checked = !!c.reverse;
  $("fxReverse").disabled = longSrc && !c.reverse;
  $("revNote").textContent = longSrc ? `(للقطع الأقصر من ${REV_MAX} ثانية بس)` : "";
  document.querySelectorAll("#fxFit [data-fit]").forEach((b) => b.classList.toggle("on", b.dataset.fit === fit));
  document.querySelectorAll("#fxLooks [data-look]").forEach((b) => b.classList.toggle("on", b.dataset.look === (c.look || "")));
  $("fxRotate").textContent = `⟳ لف 90°${c.rotate ? ` (${c.rotate}°)` : ""}`;
  $("fxFlipH").classList.toggle("on", !!c.flip_h);
  $("fxFlipV").classList.toggle("on", !!c.flip_v);
  ADJ.forEach(([k]) => {
    const v = a[k] || 0;
    document.querySelector(`[data-adj="${k}"]`).value = v;
    document.querySelector(`[data-adjval="${k}"]`).textContent = v ? (v > 0 ? `+${v}` : v) : "";
  });
  $("fxFadeIn").value = Math.round((c.fade_in || 0) * 100);
  $("fxFadeOut").value = Math.round((c.fade_out || 0) * 100);
  $("fadeInVal").textContent = c.fade_in ? `${c.fade_in.toFixed(2)}ث` : "";
  $("fadeOutVal").textContent = c.fade_out ? `${c.fade_out.toFixed(2)}ث` : "";
}

// ---------- تحويل الكلام لصوت من جوه المونتاج ----------
let ttsInfo = null;
$("ttsBox").addEventListener("toggle", async () => {
  if (!$("ttsBox").open || ttsInfo) return;
  try {
    ttsInfo = await api("/api/montage/tts");
    $("ttsVoice").innerHTML = ttsInfo.voices.map((v) => `<option value="${v.id}">${escapeHtml(v.label)}</option>`).join("");
    ttsCost();
  } catch (err) { toast(err.message, true); }
});
function ttsCost() {
  const n = $("ttsText").value.trim().length;
  $("ttsCost").textContent = n && ttsInfo ? `حوالي ${Math.max(0.001, (n / 1000) * ttsInfo.per_1k).toFixed(3)}$` : "";
}
$("ttsText").addEventListener("input", ttsCost);
$("ttsGo").onclick = async () => {
  const text = $("ttsText").value.trim();
  if (!text || !mt.project) return toast("اكتب الكلام الأول", true);
  $("ttsGo").disabled = true;
  $("ttsGo").textContent = "⏳ بيحوّل…";
  try {
    const a = await api("/api/montage/tts", { method: "POST", ...jsonBody({ text, voice_id: $("ttsVoice").value }) });
    mt.voices = await api("/api/audio?kind=voice");
    fillSelects();
    placeNewAudio(a);
    $("ttsText").value = "";
    ttsCost();
    toast(`🗣️ الصوت جاهز (${a.duration.toFixed(1)}ث) واتحط عند المؤشر`);
  } catch (err) {
    toast(err.message, true);
  } finally {
    $("ttsGo").disabled = false;
    $("ttsGo").textContent = "🗣️ حوّل لصوت";
  }
};
// صوت جديد: لو مفيش تعليق بيبقى هو التعليق، وإلا بيتحط في تراك صوت زيادة عند المؤشر
function placeNewAudio(a) {
  const d = mt.project.data;
  pushHistory();
  if (!d.voice) {
    d.voice = { id: a.id, volume: 1, delay: 0, offset: 0, length: null, fade_out: false, parts: [{ delay: snap(mt.t), offset: 0, length: null, volume: 1 }] };
    mt.sel = { kind: "voice", p: 0 };
  } else if (typeof addSound === "function") {
    addSound(a, snap(mt.t));
  } else {
    d.voice = { ...d.voice, id: a.id, parts: [{ delay: snap(mt.t), offset: 0, length: null, volume: 1 }] };
  }
  changed();
}

// ---------- تراك الأصوات الزيادة والمؤثرات ----------
const SND_LANE_H = 26;
function renderSoundRow() {
  const parts = soundParts();
  const lanes = Math.max(1, ...parts.map((x) => x.lane + 1)) + (parts.length ? 1 : 0);
  const h = Math.min(8, lanes) * SND_LANE_H + 4;
  $("trkSnd").style.height = $("hSnd").style.height = `${h}px`;
  if (!parts.length) {
    $("trkSnd").innerHTML = `<div class="tl-empty-track">مؤثرات وأصوات زيادة: ضيفها من تاب 🔊 الصوت</div>`;
    return;
  }
  $("trkSnd").innerHTML = parts.map((x) => {
    const sel = isSel({ kind: "snd", p: x.k });
    return `<div class="tl-audio snd ${sel ? "selected" : ""} ${x.p.mute ? "off" : ""}" data-track="snd" data-p="${x.k}"
        style="left:${x.t0 * mt.pps}px;width:${x.len * mt.pps}px;top:${2 + x.lane * SND_LANE_H}px;height:${SND_LANE_H - 3}px">
      <canvas></canvas><span class="nm" dir="auto">${escapeHtml(x.a.name)}${x.volume !== 1 ? ` · ${Math.round(x.volume * 100)}%` : ""}</span>
      <b class="h l" data-h="l"></b><b class="h r" data-h="r"></b></div>`;
  }).join("");
  $("trkSnd").querySelectorAll(".tl-audio").forEach((box, n) => {
    const x = parts[n];
    drawWave(box.querySelector("canvas"), x.url, x.offset, x.len, "#f7a8d8", x.volume);
  });
}
// صوت جديد في أول سطر فاضي عند الوقت ده
function addSound(a, t, extra = {}) {
  const list = partsOf("snd");
  const busy = (lane) => soundParts().some((x) => x.lane === lane && x.t0 < t + a.duration && x.t1 > t);
  let lane = 0;
  while (lane < 7 && busy(lane)) lane++;
  list.push({ src: a.id, delay: snap(t), offset: 0, length: null, volume: 1, fade_in: 0, fade_out: 0, lane, ...extra });
  mt.sel = { kind: "snd", p: list.length - 1 };
}
function renderSfx() {
  const q = $("sfxSearch").value.trim().toLowerCase();
  const list = (mt.sfx || []).filter((x) => !q || x.name.toLowerCase().includes(q) || x.id.includes(q));
  $("sfxGrid").innerHTML = list.map((x) => `<div class="sfx-item" data-sfx="${x.id}" title="${escapeHtml(x.name)} · ${x.duration.toFixed(1)}ث">
      <button class="play" data-play="${x.id}" title="اسمعه">▶</button><span dir="auto">${escapeHtml(x.name)}</span>
      <button class="add" data-addsfx="${x.id}" title="ضيفه عند المؤشر">＋</button></div>`).join("") || `<p class="muted">مفيش مؤثرات بالاسم ده</p>`;
  $("sndFromLib").innerHTML = `<option value="">＋ صوت من المكتبة…</option>` +
    [...mt.voices.map((a) => [a, "🎙️"]), ...mt.music.map((a) => [a, "🎵"])].map(([a, ic]) => `<option value="${a.id}">${ic} ${escapeHtml(a.name)} (${fmtDuration(a.duration)})</option>`).join("");
}
$("sfxSearch").addEventListener("input", renderSfx);
let sfxPreview = null;
$("sfxGrid").addEventListener("click", (e) => {
  const pl = e.target.closest("[data-play]"), ad = e.target.closest("[data-addsfx]");
  if (pl) {
    const a = soundSource(pl.dataset.play);
    sfxPreview?.pause();
    sfxPreview = new Audio(a.url);
    sfxPreview.play().catch(() => {});
  }
  if (ad && mt.project) {
    if (kindLocked("snd")) return toast("تراك الأصوات مقفول 🔒", true);
    pushHistory();
    addSound(soundSource(ad.dataset.addsfx), mt.t);
    changed();
  }
});
$("sndFromLib").addEventListener("change", () => {
  const a = soundSource($("sndFromLib").value);
  $("sndFromLib").value = "";
  if (!a || !mt.project) return;
  pushHistory();
  addSound(a, mt.t);
  changed();
});
$("sfxUpload").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const form = new FormData();
  form.append("kind", "sfx");
  form.append("file", file);
  try {
    const a = await api("/api/audio", { method: "POST", body: form });
    mt.sfx = await api("/api/montage/sfx");
    renderSfx();
    pushHistory();
    addSound(soundSource(a.id), mt.t);
    changed();
    toast("⬆ اتحفظ في المكتبة واتحط عند المؤشر");
  } catch (err) { toast(err.message, true); }
});
// تسجيل من المايك
let rec = null;
$("micRec").onclick = async () => {
  if (rec) { rec.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia) return toast("المتصفح ده مش بيدعم التسجيل", true);
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return toast("محتاج تسمح للبرنامج يستخدم المايك", true); }
  const chunks = [], t0 = mt.t, started = Date.now();
  rec = new MediaRecorder(stream);
  rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
  const timer = setInterval(() => ($("micInfo").textContent = `⏺ ${((Date.now() - started) / 1000).toFixed(1)}ث`), 200);
  rec.onstop = async () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    rec = null;
    $("micRec").textContent = "🎙️ سجّل";
    $("micRec").classList.remove("rec");
    $("micInfo").textContent = "⬆ بيرفع…";
    const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
    const form = new FormData();
    form.append("kind", "voice");
    form.append("file", blob, `تسجيل ${new Date().toLocaleTimeString("ar-EG")}.webm`);
    try {
      const a = await api("/api/audio", { method: "POST", body: form });
      mt.voices = await api("/api/audio?kind=voice");
      fillSelects();
      mt.t = t0;
      placeNewAudio(a);
      $("micInfo").textContent = "";
      toast("🎙️ التسجيل اتحط عند المؤشر");
    } catch (err) { $("micInfo").textContent = ""; toast(err.message, true); }
  };
  rec.start();
  if (!mt.playing) togglePlayback();  // بتسمع الفيديو وانت بتسجّل (زي كاب كات)
  $("micRec").textContent = "⏹ وقّف التسجيل";
  $("micRec").classList.add("rec");
};
// ظبط الصوت كله
function renderMix() {
  const m = mt.project?.data.mix || {};
  $("mixDuckOn").checked = (m.duck || 0) > 0;
  $("mixDuckRow").hidden = !((m.duck || 0) > 0);
  $("mixDuck").value = Math.round((m.duck || 0.6) * 100);
  $("mixDuckVal").textContent = m.duck ? `${Math.round(m.duck * 100)}%` : "";
  $("mixEnhance").checked = !!m.enhance;
  $("mixNormalize").checked = !!m.normalize;
}
function setMix(patch) {
  pushHistory("mix");
  mt.project.data.mix = { ...(mt.project.data.mix || {}), ...patch };
  renderMix();
  scheduleSave();
}
$("mixDuckOn").addEventListener("change", () => setMix({ duck: $("mixDuckOn").checked ? 0.6 : 0 }));
$("mixDuck").addEventListener("input", () => setMix({ duck: Number($("mixDuck").value) / 100 }));
$("mixEnhance").addEventListener("change", () => setMix({ enhance: $("mixEnhance").checked }));
$("mixNormalize").addEventListener("change", () => setMix({ normalize: $("mixNormalize").checked }));

// ---------- القطعة المختارة من التعليق أو الموسيقى: ظهور واختفاء بالتدريج ----------
function selPart() {
  const x = mt.sel;
  if (!isAudKind(x?.kind)) return null;
  return partsOf(x.kind)?.[x.p] || null;
}
function renderPartProps() {
  const p = selPart();
  $("partProps").hidden = !p;
  if (!p) return;
  const nm = mt.sel.kind === "snd" ? `«${soundSource(p.src)?.name || "صوت"}»` : mt.sel.kind === "voice" ? "التعليق" : "الموسيقى";
  $("partLabel").textContent = `🎚️ قطعة ${nm} المختارة`;
  $("pVol").value = Math.round((p.volume ?? 1) * 100);
  $("pVolVal").textContent = `${Math.round((p.volume ?? 1) * 100)}%`;
  $("pFadeIn").value = Math.round((p.fade_in || 0) * 100);
  $("pFadeOut").value = Math.round((p.fade_out || 0) * 100);
  $("pFadeInVal").textContent = p.fade_in ? `${p.fade_in.toFixed(1)}ث` : "";
  $("pFadeOutVal").textContent = p.fade_out ? `${p.fade_out.toFixed(1)}ث` : "";
}
for (const [id, key] of [["pFadeIn", "fade_in"], ["pFadeOut", "fade_out"], ["pVol", "volume"]]) {
  $(id).addEventListener("input", () => {
    const p = selPart();
    if (!p) return;
    pushHistory("part-" + key);
    p[key] = Number($(id).value) / 100;
    renderPartProps();
    if (key === "volume") renderTimeline();
    scheduleSave();
  });
}

// ---------- المدرب والصوت ----------
function renderSide() {
  const d = mt.project.data;
  renderSfx();
  renderMix();
  const coach = mt.coaches.find((c) => c.id === d.coach_id);
  $("mCoach").value = d.coach_id || "";
  const outros = d.clips.filter(isOutroClip);
  $("mOutro").checked = outros.length > 0;
  $("mOutro").disabled = !coach?.outro_url;
  $("outroInfo").textContent = !coach ? "" : coach.outro_url ? `(${fmtDuration(coach.outro_duration)})` : "(المدرب ده مالوش أوترو)";
  const ov = outros[0]?.volume ?? d.outro_volume ?? 1;
  $("mOutroVol").value = Math.round(ov * 100);
  $("outroVolVal").textContent = `${Math.round(ov * 100)}%`;

  $("mVoice").value = d.voice?.id || "";
  $("voiceOpts").hidden = !d.voice;
  renderVoiceSync();
  if (d.voice) {
    const vv = d.voice.parts?.[0]?.volume ?? d.voice.volume ?? 1;
    $("mVoiceVol").value = Math.round(vv * 100);
    $("voiceVolVal").textContent = `${Math.round(vv * 100)}%`;
  }

  $("mMusic").value = d.music?.id || "";
  $("musicOpts").hidden = !d.music;
  if (d.music) {
    const mv = d.music.parts?.[0]?.volume ?? d.music.volume ?? 1;
    $("mMusicVol").value = Math.round(mv * 100);
    $("musicVolVal").textContent = `${Math.round(mv * 100)}%`;
    $("mMusicFade").checked = d.music.fade_out;
    const end = trackEnd("music");
    const total = totalLength();
    $("musicWarn").hidden = !end || end >= total - 0.05;
    $("musicWarn").textContent = `⚠️ الموسيقى بتخلص عند ${fmtDuration(end)} والفيديو طوله ${fmtDuration(total)}، فآخر الفيديو هيبقى من غير موسيقى.`;
  }
  $("renderBtn").disabled = d.clips.length === 0 || mt.project.render_status === "rendering";
  if (typeof renderBrandPanels === "function") renderBrandPanels();
}

function sideInput(key, apply) {
  return () => { pushHistory(key); apply(mt.project.data); fixSelection(); renderSide(); renderTimeline(); syncPreview(); scheduleSave(); };
}
$("mCoach").addEventListener("change", sideInput(null, (d) => {
  d.coach_id = $("mCoach").value || null;
  // الأوترو بيتبدّل بأوترو المدرب الجديد (أو بيتشال لو مالوش أوترو)
  const had = d.clips.some(isOutroClip);
  d.clips = d.clips.filter((c) => !isOutroClip(c));
  if (had) addOutroClip(d);
  renderBin();
}));
$("mOutro").addEventListener("change", sideInput(null, (d) => {
  if ($("mOutro").checked) addOutroClip(d);
  else d.clips = d.clips.filter((c) => !isOutroClip(c));
  d.outro = false;
}));
$("mOutroVol").addEventListener("input", sideInput("outroVol", (d) => {
  d.outro_volume = $("mOutroVol").value / 100;
  d.clips.filter(isOutroClip).forEach((c) => (c.volume = d.outro_volume));
}));
// صوت من عندك (تعليق أو موسيقى): بيترفع لمكتبة الصوت ويتحط في المشروع على طول
document.querySelectorAll("[data-audio-up]").forEach((inp) => inp.addEventListener("change", async () => {
  const file = inp.files[0];
  inp.value = "";
  if (!file || !mt.project) return;
  const kind = inp.dataset.audioUp;
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  try {
    toast(`⏳ بيرفع ${file.name}...`);
    const a = await api("/api/audio", { method: "POST", body: form });
    (kind === "voice" ? mt.voices : mt.music).unshift(a);
    fillSelects();
    const sel = $(kind === "voice" ? "mVoice" : "mMusic");
    sel.value = a.id;
    sel.dispatchEvent(new Event("change"));
    renderAll();
    toast(kind === "voice" ? "✅ التعليق الصوتي اترفع واتحط في المونتاج" : "✅ الموسيقى اترفعت واتحطت في المونتاج");
  } catch (err) {
    toast(err.message, true);
  }
}));
// 🎙️ تعليق صوتي جديد مكان القديم: بيفضل بنفس العلو ونفس مكان البداية، والملف كله من أوله (القص والتقسيم بتوع القديم بيتشالوا)
function newVoiceTrack(d, id) {
  const vol = d.voice?.parts?.[0]?.volume ?? d.voice?.volume ?? 1, delay = d.voice?.parts?.[0]?.delay ?? d.voice?.delay ?? 0;
  if (d.captions?.removed?.length) d.captions.removed = [];  // الكلام اللي اتمسح من الكابشن كان من الصوت القديم
  return id ? { id, volume: vol, delay: 0, offset: 0, length: null, fade_out: false, parts: [{ delay, offset: 0, length: null, volume: vol }] } : null;
}
$("mVoice").addEventListener("change", sideInput(null, (d) => {
  d.voice = newVoiceTrack(d, $("mVoice").value);
  if (d.voice) toast("✅ التعليق الصوتي اتبدّل في المونتاج");
}));
// لو التعليق الصوتي بتاع المشروع (الفيديو الخام) اتغير بعد ما المونتاج اتعمل: تنبيه وزرار يبدّله
function renderVoiceSync() {
  const d = mt.project?.data, box = $("voiceSync");
  const video = d?.video_id && mt.videos.find((v) => v.id === d.video_id);
  const fresh = video?.voice;
  const stale = fresh && fresh.id !== d.voice?.id && mt.voices.some((a) => a.id === fresh.id);
  box.hidden = $("voiceSyncTop").hidden = !stale;
  if (!stale) return;
  const cur = mt.voices.find((a) => a.id === d.voice?.id);
  box.innerHTML = `<b>⚠️ التعليق الصوتي بتاع المشروع اتغيّر</b>
    <span>المشروع دلوقتي على «<b data-no-i18n>${escapeHtml(fresh.name)}</b>» والمونتاج لسه ${cur ? `على «<b data-no-i18n>${escapeHtml(cur.name)}</b>»` : "من غير تعليق"}.</span>
    <button type="button" class="btn sm primary" id="voiceSyncGo">🔁 بدّله بالجديد</button>`;
  $("voiceSyncGo").onclick = $("voiceSyncTop").onclick = sideInput(null, (dd) => {
    dd.voice = newVoiceTrack(dd, fresh.id);
    toast(`✅ التعليق الصوتي اتبدّل بـ «${fresh.name}»`);
  });
}
// سلايدر الصوت في التاب بيغيّر كل قطع التعليق مرة واحدة
function setTrackVolume(t, v) {
  t.volume = v;
  for (const p of t.parts || []) p.volume = v;
}
$("mVoiceVol").addEventListener("input", sideInput("voiceVol", (d) => setTrackVolume(d.voice, $("mVoiceVol").value / 100)));
$("mMusic").addEventListener("change", sideInput(null, (d) => {
  const vol = d.music?.parts?.[0]?.volume ?? 0.3;
  d.music = $("mMusic").value
    ? { id: $("mMusic").value, volume: vol, delay: 0, offset: 0, length: null, fade_out: d.music?.fade_out ?? true, parts: [{ delay: 0, offset: 0, length: null, volume: vol }] }
    : null;
}));
$("mMusicVol").addEventListener("input", sideInput("musicVol", (d) => setTrackVolume(d.music, $("mMusicVol").value / 100)));
$("mMusicFade").addEventListener("change", sideInput(null, (d) => (d.music.fade_out = $("mMusicFade").checked)));

// ---------- الحفظ ----------
function changed() {
  renderAll();
  scheduleSave();
}
function scheduleSave() {
  $("saveState").textContent = "…";
  clearTimeout(mt.saveTimer);
  mt.saveTimer = setTimeout(saveProject, 500);
}
async function saveProject() {
  clearTimeout(mt.saveTimer);
  const p = mt.project;
  if (!p) return;
  try {
    const saved = await api(`/api/projects/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p.data),
    });
    const i = mt.projects.findIndex((x) => x.id === saved.id);
    if (i >= 0) mt.projects[i] = saved;
    if (mt.project?.id === saved.id) mt.project.name = saved.name;
    renderProjectSelect();
    $("saveState").textContent = "✓ اتحفظ";
  } catch (err) {
    $("saveState").textContent = "";
    toast(`مش قادر أحفظ: ${err.message}`, true);
  }
}

$("projectName").addEventListener("input", () => { mt.project.data.name = $("projectName").value; scheduleSave(); });
$("projectSelect").addEventListener("change", async () => {
  await saveProject();
  openProject(mt.projects.find((p) => p.id === $("projectSelect").value));
});
$("newProject").onclick = async () => {
  await saveProject();
  const videoId = $("newFromVideo").value;
  let data = blankProject(`فيديو ${mt.projects.length + 1}`);
  if (videoId) {
    const draft = await api(`/api/videos/${videoId}/montage-draft`);
    data = {
      ...data,
      name: draft.name,
      video_id: videoId,
      coach_id: draft.coach_id,
      clips: draft.gen_ids.map((gen_id) => ({ gen_id, ...CLIP_DEFAULTS })),
      voice: draft.voice ? { id: draft.voice.id, volume: 1, delay: 0, offset: 0, length: null, fade_out: false } : null,
    };
    reportDraft(draft);
  }
  const p = await api("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, section: mt.section || "coach" }),
  });
  mt.projects.unshift(p);
  openProject(p);
  $("projectName").select();
};
// لو المشروع اتولّد بأكتر من مدرب: يسأل أنهي مدرب (null = لغى). مدرب واحد أو مفيش: من غير سؤال
async function pickVideoCoach(videoId) {
  const list = await api(`/api/videos/${videoId}/coaches`);
  if (list.length < 2) return { coach: list[0] || null, many: false };
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "bulk-dlg coach-pick-dlg";
    dlg.innerHTML = `<div class="panel-head"><h2>🎬 عايز مونتاج أنهي مدرب؟</h2><button class="btn sm" data-x>إلغاء</button></div>
      <p class="hint">المشروع ده اتولّد بأكتر من مدرب. كل مدرب ليه مونتاج لوحده.</p>
      <div class="coach-pick">${list.map((c, i) => `<button type="button" class="coach-pick-item" data-i="${i}">
        <img src="${c.image_url}" alt=""><b data-no-i18n>${escapeHtml(c.name)}</b>
        <small class="muted">${c.ready} / ${c.total} جاهز</small></button>`).join("")}</div>`;
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.addEventListener("click", (e) => {
      const it = e.target.closest("[data-i]");
      if (it) return done({ coach: list[Number(it.dataset.i)], many: true });
      if (e.target.closest("[data-x]") || e.target === dlg) done(null);
    });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); done(null); });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

// يفتح مونتاج الفيديو ده بآخر الفيديوهات المولَّدة للمدرب المختار (أو يعمل له مشروع لو مفيش)
async function openMontageForVideo(videoId) {
  const pick = await pickVideoCoach(videoId);
  if (!pick) return;
  const coachId = pick.coach?.id || null;
  const projects = await api("/api/projects");
  const mine = projects.filter((x) => x.data.video_id === videoId && (!pick.many || x.data.coach_id === coachId))
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  let p = mine[0];
  if (p) {
    mt.handoff = { refresh: true };
  } else {
    mt.music = await api("/api/audio?kind=music");
    const draft = await api(`/api/videos/${videoId}/montage-draft${coachId ? `?coach_id=${coachId}` : ""}`);
    const name = pick.many ? `${draft.name} · ${pick.coach.name}` : draft.name;
    const data = {
      ...blankProject(name), name, video_id: videoId, coach_id: draft.coach_id,
      clips: draft.gen_ids.map((gen_id) => ({ gen_id, ...CLIP_DEFAULTS })),
      voice: draft.voice ? { id: draft.voice.id, volume: 1, delay: 0, offset: 0, length: null, fade_out: false } : null,
    };
    p = await api("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    mt.handoff = { draft };
  }
  if (mt.project) await saveProject();
  storageSet(projectKey("coach"), p.id);
  mt.project = null;
  showStep("6");
}
$("deleteProject").onclick = async () => {
  if (!confirm(`حذف المشروع "${mt.project.data.name}"؟ (الفيديوهات اللي اتصدّرت منه هتفضل موجودة)`)) return;
  try {
    await api(`/api/projects/${mt.project.id}`, { method: "DELETE" });
    mt.projects = mt.projects.filter((p) => p.id !== mt.project.id);
    openProject(mt.projects[0] || null);
  } catch (err) {
    toast(err.message, true);
  }
};

// ---------- التصدير ----------
function renderRender() {
  const p = mt.project;
  const btn = $("renderBtn");
  btn.textContent = p.render_status === "rendering" ? `⏳ ${p.render_progress || "بيصدّر..."}` : "🎬 صدّر الفيديو";
  $("renderCancel").hidden = p.render_status !== "rendering";
  $("renderError").hidden = p.render_status !== "failed";
  $("renderError").textContent = p.render_error || "";
  const done = p.render_status === "done" && p.export_id;
  $("renderResult").hidden = !done;
  if (done) {
    // اسم المشروع جوه الرابط، عشان الفيديو يتحفظ باسمه من أي مكان
    const file = exportFileName(p.data.name);
    const url = `/media/export/${p.export_id}/${encodeURIComponent(file)}`;
    if ($("resultVideo").getAttribute("src") !== url) $("resultVideo").src = url;
    $("resultDownload").href = `${url}?download=1`;
    $("resultDownload").setAttribute("download", file);
  }
  renderSide();
}

// اسم ملف الفيديو = اسم المشروع من غير الحروف اللي مينفعش تبقى في اسم ملف
function exportFileName(name) {
  const clean = (name || "").replace(/[\\/:*?"<>|]+/g, " ").trim();
  return (clean || "video") + ".mp4";
}

$("renderBtn").onclick = async () => {
  pause();
  await saveProject();
  try {
    await api(`/api/projects/${mt.project.id}/render`, { method: "POST" });
    mt.project.render_status = "rendering";
    renderRender();
    pollRender();
  } catch (err) {
    toast(err.message, true);
    // الرسالة بتفضل ظاهرة تحت الزرار عشان تقدر تقراها
    $("renderError").textContent = err.message;
    $("renderError").hidden = false;
  }
};

$("renderCancel").onclick = async () => {
  if (!confirm("توقّف التصدير؟")) return;
  try {
    await api(`/api/projects/${mt.project.id}/render/cancel`, { method: "POST" });
    toast("⏹ بيوقف التصدير…");
  } catch (err) {
    toast(err.message, true);
  }
};

async function pollRender() {
  clearTimeout(mt.pollTimer);
  const id = mt.project?.id;
  if (!id) return;
  let list;
  try {
    list = await api("/api/projects");
  } catch {
    // السيرفر ممكن يكون بيعيد التشغيل: نفضل نحاول، منقفش
    mt.pollTimer = setTimeout(pollRender, 4000);
    return;
  }
  const fresh = list.find((p) => p.id === id);
  if (!fresh || mt.project?.id !== id) return;
  Object.assign(mt.project, { render_status: fresh.render_status, render_error: fresh.render_error, render_progress: fresh.render_progress, export_id: fresh.export_id });
  renderRender();
  if (fresh.render_status === "rendering") mt.pollTimer = setTimeout(pollRender, 2000);
  else if (fresh.render_status === "done") toast("✅ الفيديو جاهز");
  else if (fresh.render_status === "failed") toast("✕ التصدير فشل، شوف السبب تحت الزرار", true);
}

// ---------- الربط بالفيديو الخام ----------
function reportDraft(draft) {
  const got = draft.gen_ids.length;
  if (!draft.clips_total) return toast("الفيديو ده لسه متقطّعش", true);
  if (draft.missing.length) {
    toast(`جبت ${got} من ${draft.clips_total} قطعة. القطع رقم ${draft.missing.join("، ")} لسه متولّدتش`, true);
  } else {
    toast(`✅ جبت ${got} قطعة بالترتيب${draft.voice ? " والتعليق الصوتي بتاعهم" : ""}`);
  }
}

function renderLinkedVideo() {
  const d = mt.project?.data;
  const video = d?.video_id && mt.videos.find((v) => v.id === d.video_id);
  $("linkedVideo").hidden = $("refreshFromVideo").hidden = !d?.video_id;
  if (d?.video_id) {
    $("linkedVideo").textContent = video
      ? `🔗 من فيديو: ${video.name}${video.voice ? ` · 🎙️ ${video.voice.name}` : ""}`
      : "🔗 الفيديو الخام اتمسح";
  }
}

$("refreshFromVideo").onclick = async () => {
  const d = mt.project.data;
  try {
    const draft = await api(`/api/videos/${d.video_id}/montage-draft${d.coach_id ? `?coach_id=${d.coach_id}` : ""}`);
    mt.sources = await api("/api/montage/sources");
    pushHistory();
    // التعديلات (قص وزووم...) بتفضل على الفيديوهات اللي كانت موجودة
    const old = new Map(d.clips.map((c) => [c.gen_id, c]));
    const outros = d.clips.filter(isAnyOutro);
    d.clips = [...draft.gen_ids.map((gen_id) => old.get(gen_id) || { gen_id, ...CLIP_DEFAULTS }), ...outros];
    if (draft.voice && d.voice?.id !== draft.voice.id) {
      d.voice = newVoiceTrack(d, draft.voice.id);  // كان بيتحط من غير قطع فمكانش بيظهر في التايم لاين
    }
    if (!d.coach_id) d.coach_id = draft.coach_id;
    mt.sel = null;
    reportDraft(draft);
    changed();
  } catch (err) {
    toast(err.message, true);
  }
};

viewHooks["6"] = initMontage;
