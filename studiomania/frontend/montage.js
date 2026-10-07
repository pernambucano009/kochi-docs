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
  [all, mt.sources, mt.coaches, mt.voices, mt.music, mt.videos] = await Promise.all([
    api("/api/projects"), api("/api/montage/sources"), api("/api/coaches"),
    api("/api/audio?kind=voice"), api("/api/audio?kind=music"), api("/api/videos"),
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
function clipLength(c) {
  return Math.max(0, clipOut(c) - c.start);
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
    items.push({ key: `c${i}`, kind: "clip", i, c, s, url: s?.url, t0: t, t1: t + len, in: c.start, zoom: c.zoom, x: c.x, y: c.y, volume: c.volume });
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
function trackParts(kind) {
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
  const valid = (s) => !((s.kind === "cap" && s.i >= nCaps) || (s.kind === "clip" && !d.clips[s.i]) || ((s.kind === "voice" || s.kind === "music") && !d[s.kind]?.parts?.[s.p]) ||
      (s.kind === "outro" && !currentOutro()));
  mt.extra = mt.extra.filter(valid);
  if (!valid(s)) { mt.sel = null; return; }
  if ((s.kind === "clip" && !d.clips[s.i]) || ((s.kind === "voice" || s.kind === "music") && !d[s.kind]?.parts?.[s.p]) ||
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
  const list = mt.sources.filter((s) => !onlyCoach || s.coach_id === d.coach_id || (s.extra && !s.coach_id));
  $("binEmpty").hidden = list.length > 0;
  $("binGrid").innerHTML = list
    .map(
      (s) => `<div class="bin-item" data-id="${s.id}" draggable="true">
        ${lightVideo(s.url, "muted playsinline")}
        <button class="add" title="ضيف عند المؤشر">＋</button>
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

$("binGrid").addEventListener("click", async (e) => {
  const item = e.target.closest(".bin-item");
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

function clipStrip(s, inSec, width) {
  if (!s) return "";
  if (s.extra) return stripHtml("xoutro", s.id, inSec, width);
  return s.kind === "outro" ? stripHtml("outro", s.coach_id, inSec, width) : stripHtml("gen", s.id, inSec, width);
}

function stripHtml(kind, id, inSec, width) {
  const info = id && stripInfo(kind, id);
  if (!info) return "";
  const h = 56;
  const tw = Math.max(12, h * info.aspect);
  const n = Math.min(400, Math.ceil(width / tw));
  let html = "";
  for (let k = 0; k < n; k++) {
    const t = inSec + (k * tw + tw / 2) / mt.pps;
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
  r.style.setProperty("--minor", `${minor * mt.pps}px`);
  r.style.setProperty("--major", `${major * mt.pps}px`);
}

function renderTimeline() {
  if (!mt.project) return;
  const d = mt.project.data;
  const { items, total } = seq();
  const view = $("tlScroll").clientWidth || 800;
  const end = Math.max(total, trackEnd("voice"), trackEnd("music"));
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
          const strip = it.kind === "clip" ? clipStrip(it.s, it.in, w) : stripHtml("outro", it.coach.id, 0, w);
          const label = it.kind === "clip" ? (it.s ? escapeHtml(it.s.label) : "⚠️ الفيديو اتمسح") : `🎬 أوترو ${escapeHtml(it.coach.name)}`;
          return `<div class="tl-clip ${it.kind} ${sel ? "selected" : ""} ${it.s || it.kind === "outro" ? "" : "missing"}"
              ${it.kind === "clip" ? `data-i="${it.i}"` : `data-outro="1"`} style="left:${it.t0 * mt.pps}px;width:${w}px">
            ${strip}
            ${hasSound(it) ? `<canvas class="cw"></canvas>` : ""}
            <span class="nm" dir="auto">${label}</span><span class="du">${(it.t1 - it.t0).toFixed(1)}s</span>
            ${soundBadge(it)}
            ${hasSound(it) ? volLine(it.volume) : ""}
            ${it.kind === "clip" ? `<b class="h l" data-h="l"></b><b class="h r" data-h="r"></b>` : ""}
          </div>`;
        })
        .join("")
    : `<div class="tl-drop-hint">اسحب فيديو هنا أو دوس ＋ على فيديو من المكتبة</div>`;
  // موجة الصوت اللي جوه كل قطعة فيديو
  $("trkVideo").querySelectorAll(".tl-clip").forEach((el) => {
    const cv = el.querySelector("canvas.cw");
    const it = el.dataset.outro ? items.find((x) => x.kind === "outro") : items[Number(el.dataset.i)];
    if (cv && it) drawWave(cv, it.url, it.in, it.t1 - it.t0, it.volume > 0 ? "#9fe3a8" : "#6b7180", it.volume);
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

  $("trkCaps").innerHTML = captionBlocks()
    .map((g, n) => `<div class="tl-cap ${isSel({ kind: "cap", i: n }) ? "selected" : ""}" data-c="${n}" data-t="${g.t0}" title="دوسة تختاره · Delete تمسحه" style="left:${g.t0 * mt.pps}px;width:${Math.max(2, (g.t1 - g.t0) * mt.pps)}px">${escapeHtml(g.text)}</div>`)
    .join("");

  const nSel = allSelected().length;
  $("totalLabel").textContent = total ? `${d.clips.length} قطعة${nSel > 1 ? ` · ✔ ${nSel} مختارين` : ""}` : "";
  drawPlayhead();
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
    const part = d[el.dataset.track].parts[Number(el.dataset.p)];
    return { get: () => part.volume ?? 1, set: (v) => (part.volume = v) };
  }
  if (el.dataset.outro) return { get: () => d.outro_volume, set: (v) => (d.outro_volume = v) };
  const c = d.clips[Number(el.dataset.i)];
  return { get: () => c.volume, set: (v) => (c.volume = v) };
}
function volTargetOf(x) {
  const d = mt.project.data;
  if (x.kind === "voice" || x.kind === "music") {
    const part = d[x.kind].parts[x.p];
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
  parts[x.k].length = cut;
  parts.splice(x.k + 1, 0, { delay: snap(x.t0 + cut), offset: snap(x.offset + cut), length: rest, volume: x.volume });
  mt.sel = { kind: x.kind, p: x.k + 1 };
  changed();
}

// target: قطعة صوت معيّنة (من أداة القطع)، وإلا بيقسم المختار أو الفيديو اللي عند المؤشر
function splitAt(t, target) {
  const s = target || mt.sel;
  if (s?.kind === "voice" || s?.kind === "music") {
    const x = trackParts(s.kind)[s.p];
    if (x && t > x.t0 && t < x.t1) return splitPart(x, t);
    return toast("حط المؤشر على قطعة الصوت المختارة عشان تقسمها", true);
  }
  const it = seq().items.find((x) => x.kind === "clip" && t > x.t0 && t < x.t1);
  if (!it) return toast("حط المؤشر على قطعة فيديو عشان تقسمها", true);
  const at = snap(it.in + (t - it.t0));
  if (at - it.in < MIN_CLIP - 1e-6 || clipOut(it.c) - at < MIN_CLIP - 1e-6) return toast("مفيش ولا فريم بين المؤشر وطرف القطعة", true);
  pushHistory();
  const clips = mt.project.data.clips;
  clips.splice(it.i + 1, 0, { ...it.c, start: at });
  clips[it.i].end = at;
  mt.sel = { kind: "clip", i: it.i + 1 };
  changed();
}
$("tlSplit").onclick = $("edSplit").onclick = () => splitAt(mt.t);

function deleteSelected() {
  const list = allSelected();
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
  for (const kind of ["voice", "music"]) {
    for (const k of desc(kind)) d[kind].parts.splice(k, 1);
    if (d[kind] && !d[kind].parts.length) d[kind] = null;
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

function selectItem(sel, seekInto) {
  mt.sel = sel;
  if (sel?.kind === "clip" || sel?.kind === "outro") showTab("clip");
  else if (sel) showTab("audio");
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
      const hit = [...canvas.querySelectorAll(".tl-clip, .tl-audio, .tl-cap")]
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
  const start0 = c.start, out0 = clipOut(c);
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
      const ds = snap(dx / mt.pps);
      // وإنت بتسحب: الطرف اللي ماسكه بيمشي مع الماوس، والباقي بيتظبط لما تسيب
      let left = it0.t0;
      if (side === "l") {
        c.start = clamp(snap(start0 + ds), 0, out0 - MIN_CLIP);
        left = it0.t0 + (c.start - start0);
      } else {
        const out = clamp(snap(out0 + ds), c.start + MIN_CLIP, s.duration);
        c.end = out >= s.duration - 0.001 ? null : out;
      }
      const len = clipOut(c) - c.start;
      el.style.left = `${left * mt.pps}px`;
      el.style.width = `${len * mt.pps}px`;
      el.querySelector(".strip")?.remove();
      el.insertAdjacentHTML("afterbegin", clipStrip(s, c.start, len * mt.pps));
      const cv = el.querySelector("canvas.cw");
      if (cv) drawWave(cv, s.url, c.start, len, c.volume > 0 ? "#9fe3a8" : "#6b7180", c.volume);
      el.querySelector(".du").textContent = `${len.toFixed(1)}s`;
      const diff = len - (out0 - start0);
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
  let moved = false;
  drag(
    e,
    (dx) => {
      moved = true;
      let ds = snap(dx / mt.pps);
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

// نفس حسبة FFmpeg: الصورة تملا الكادر، وبعدين زووم، وبعدين تحريك
function layoutActive() {
  const v = mt.active, it = mt.activeItem;
  if (!v || !it || !v.videoWidth) return;
  const c = it.kind === "clip" ? it.c : { zoom: 1, x: 0, y: 0 };
  const cover = Math.max(PV_W / v.videoWidth, PV_H / v.videoHeight) * c.zoom;
  const dw = v.videoWidth * cover, dh = v.videoHeight * cover;
  Object.assign(v.style, {
    width: `${dw}px`, height: `${dh}px`,
    left: `${-((dw - PV_W) / 2) * (1 + c.x)}px`, top: `${-((dh - PV_H) / 2) * (1 + c.y)}px`,
  });
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
    if (Math.abs(n.currentTime - (x.in + 0.001)) > 0.05) n.currentTime = x.in + 0.001;
  }
}

function showItem(it, t, playing) {
  const v = it?.url ? videoFor(it.url) : null;
  const want = v ? it.in + clamp(t - it.t0, 0, it.t1 - it.t0 - 0.5 / FPS) : 0;
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
  } else syncPreview();
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
  if (mt.t >= total) { mt.t = total; return pause(); }
  const it = itemAt(items, mt.t, total);
  showItem(it, mt.t, true);
  if (it && mt.activeKey !== mt.preloadedFor) { mt.preloadedFor = mt.activeKey; preloadNext(items, it); }
  const v = mt.active;
  if (v) {
    v.muted = false;
    v.volume = clamp(it.volume, 0, 1);
    if (v.paused) v.play().catch(() => {});
  }
  const live = new Set();
  for (const kind of ["voice", "music"]) {
    const parts = trackParts(kind);
    const last = parts.reduce((m, x) => (!m || x.t0 > m.t0 ? x : m), null);
    for (const x of parts) {
      const key = `${kind}${x.k}`;
      live.add(key);
      syncAudio(audioFor(key), x, mt.t, total, kind === "music" && x === last);
    }
  }
  for (const [key, el] of audioEls) if (!live.has(key) && !el.paused) el.pause();
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

// تحريك وزووم الصورة بالماوس على المعاينة
$("previewFrame").addEventListener("pointerdown", (e) => {
  const it = mt.activeItem, v = mt.active;
  if (e.button !== 0 || it?.kind !== "clip" || !v?.videoWidth) return;
  e.preventDefault();
  pause();
  mt.sel = { kind: "clip", i: it.i };
  showTab("clip");
  renderTimeline();
  renderInspector();
  pushHistory();
  const c = it.c;
  const x0 = c.x, y0 = c.y;
  $("previewFrame").classList.add("panning");
  drag(
    e,
    (dx, dy) => {
      const cover = Math.max(PV_W / v.videoWidth, PV_H / v.videoHeight) * c.zoom;
      const mx = (v.videoWidth * cover - PV_W) / 2, my = (v.videoHeight * cover - PV_H) / 2;
      if (mx > 0.5) c.x = clamp(x0 - dx / mx, -1, 1);
      if (my > 0.5) c.y = clamp(y0 - dy / my, -1, 1);
      layoutActive();
      renderInspector();
    },
    () => { $("previewFrame").classList.remove("panning"); scheduleSave(); }
  );
});
$("previewFrame").addEventListener(
  "wheel",
  (e) => {
    const it = mt.activeItem;
    if (it?.kind !== "clip") return;
    e.preventDefault();
    pushHistory("wheel-zoom");
    it.c.zoom = clamp(it.c.zoom * (e.deltaY < 0 ? 1.05 : 1 / 1.05), 1, 3);
    mt.sel = { kind: "clip", i: it.i };
    layoutActive();
    renderInspector();
    scheduleSave();
  },
  { passive: false }
);

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
  else if (ctrl) done = false;
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
  const c = selectedClip();
  const s = c && clipSource(c);
  $("clipProps").hidden = !s;
  $("outroProps").hidden = mt.sel?.kind !== "outro";
  $("clipNone").hidden = !!s || mt.sel?.kind === "outro";
  if (!s) return;
  $("editorLabel").textContent = `${mt.sel.i + 1}. ${s.label}`;
  $("clipTimes").textContent = `المدة ${clipLength(c).toFixed(2)}ث · من ${fmtTC(c.start)} لـ ${fmtTC(clipOut(c))} في الفيديو الأصلي`;
  $("edZoom").value = Math.round(c.zoom * 100);
  $("edX").value = Math.round(c.x * 100);
  $("edY").value = Math.round(c.y * 100);
  $("edVol").value = Math.round(c.volume * 100);
  $("zoomVal").textContent = `${Math.round(c.zoom * 100)}%`;
  $("xVal").textContent = c.x.toFixed(2);
  $("yVal").textContent = c.y.toFixed(2);
  $("volVal").textContent = s.has_audio ? `${Math.round(c.volume * 100)}%` : "";
  $("edVol").disabled = !s.has_audio;
  $("edMute").hidden = !s.has_audio;
  $("edMute").textContent = c.volume === 0 ? "🔊 رجّع الصوت" : "🔇 اكتم صوت الفيديو ده";
  $("noAudio").hidden = !!s.has_audio;
}

function editorInput(key, apply) {
  return () => {
    const c = selectedClip();
    if (!c) return;
    pushHistory(key);
    apply(c);
    renderInspector();
    // لو القطعة المختارة مش هي اللي في المعاينة، نروح لها
    const it = seq().items[mt.sel.i];
    if (it && (mt.t < it.t0 || mt.t >= it.t1)) seek(it.t0);
    else syncPreview();
    scheduleSave();
  };
}
$("edZoom").addEventListener("input", editorInput("zoom", (c) => (c.zoom = Number($("edZoom").value) / 100)));
$("edX").addEventListener("input", editorInput("x", (c) => (c.x = Number($("edX").value) / 100)));
$("edY").addEventListener("input", editorInput("y", (c) => (c.y = Number($("edY").value) / 100)));
$("edVol").addEventListener("input", editorInput("vol", (c) => (c.volume = Number($("edVol").value) / 100)));
$("edMute").onclick = () => { const c = selectedClip(); if (c) toggleMute(c); };
$("edReset").onclick = editorInput(null, (c) => Object.assign(c, { zoom: 1, x: 0, y: 0, volume: 1 }));

// ---------- المدرب والصوت ----------
function renderSide() {
  const d = mt.project.data;
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
