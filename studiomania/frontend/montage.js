// StudioMania — الخطوة 6: المونتاج (محرر بتايم لاين زي كاب كات)

const FPS = 30;
const PV_W = 252, PV_H = 448; // حجم كادر المعاينة (9:16)
const MIN_CLIP = 0.3; // أقل طول لقطعة (السيرفر بيرفض أقل من كده)
const PPS_MIN = 8, PPS_MAX = 600; // حدود زووم التايم لاين (بكسل لكل ثانية)
const PROJECT_KEY = "studiomania.projectId";
const CLIP_DEFAULTS = { start: 0, end: null, zoom: 1, x: 0, y: 0, volume: 1 };

const mt = {
  projects: [], project: null, sources: [], coaches: [], voices: [], music: [], videos: [],
  sel: null, // {kind: "clip", i} | {kind: "outro"} | {kind: "voice"} | {kind: "music"}
  saveTimer: null, pollTimer: null,
  t: 0, playing: false, raf: 0, clock: 0, clockT: 0, activeKey: null, active: null, activeItem: null,
  pps: 60, tool: "select", undo: [], redo: [], histKey: null, histAt: 0,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const snap = (t) => Math.round(t * FPS) / FPS;
const isMontage = () => !document.querySelector('.view[data-view="6"]').hidden;

function fmtTC(t) {
  const f = Math.round(Math.max(0, t) * FPS);
  const s = Math.floor(f / FPS);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 60))}:${p(s % 60)}:${p(f % FPS)}`;
}

function blankProject(name) {
  return { name, coach_id: null, clips: [], voice: null, music: null, outro: true, outro_volume: 1 };
}

async function initMontage() {
  [mt.projects, mt.sources, mt.coaches, mt.voices, mt.music, mt.videos] = await Promise.all([
    api("/api/projects"), api("/api/montage/sources"), api("/api/coaches"),
    api("/api/audio?kind=voice"), api("/api/audio?kind=music"), api("/api/videos"),
  ]);
  fillSelects();
  const wanted = mt.project?.id || storageGet(PROJECT_KEY);
  const p = mt.projects.find((x) => x.id === wanted) || mt.projects[0];
  openProject(p || null);
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

function renderAll() {
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

// مكان التعليق الصوتي أو الموسيقى على التايم لاين
function trackInfo(kind) {
  const t = mt.project?.data[kind];
  if (!t) return null;
  const a = (kind === "voice" ? mt.voices : mt.music).find((x) => x.id === t.id);
  if (!a) return null;
  const offset = clamp(t.offset || 0, 0, Math.max(0, a.duration - 0.1));
  const len = Math.max(0.1, Math.min(t.length || Infinity, a.duration - offset));
  const t0 = Math.max(0, t.delay || 0);
  return { t, a, dur: a.duration, offset, len, t0, t1: t0 + len, url: a.url };
}

function fixSelection() {
  const s = mt.sel;
  if (!s || !mt.project) return;
  const d = mt.project.data;
  if ((s.kind === "clip" && !d.clips[s.i]) || (s.kind === "voice" && !d.voice) ||
      (s.kind === "music" && !d.music) || (s.kind === "outro" && !currentOutro())) mt.sel = null;
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
  const list = mt.sources.filter((s) => !onlyCoach || s.coach_id === d.coach_id);
  $("binEmpty").hidden = list.length > 0;
  $("binGrid").innerHTML = list
    .map(
      (s) => `<div class="bin-item" data-id="${s.id}" draggable="true">
        <video src="${s.url}#t=0.5" preload="metadata" muted playsinline></video>
        <button class="add" title="ضيف عند المؤشر">＋</button>
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

$("binGrid").addEventListener("click", (e) => {
  const item = e.target.closest(".bin-item");
  if (item && e.target.closest(".add")) insertClip(item.dataset.id, insertIndexAt(mt.t));
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

function drawWave(canvas, url, offset, len, color) {
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
    const bh = Math.max(1, m * (h - 4));
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
  const voice = trackInfo("voice"), music = trackInfo("music");
  const end = Math.max(total, voice?.t1 || 0, music?.t1 || 0);
  const width = Math.max(view, (end + 4) * mt.pps);
  const canvas = $("tlCanvas");
  canvas.style.width = `${width}px`;
  canvas.classList.toggle("blade", mt.tool === "blade");
  renderRuler(width);

  $("trkVideo").innerHTML = items.length
    ? items
        .map((it) => {
          const w = (it.t1 - it.t0) * mt.pps;
          const sel = (it.kind === "clip" && mt.sel?.kind === "clip" && mt.sel.i === it.i) || (it.kind === "outro" && mt.sel?.kind === "outro");
          const strip = it.kind === "clip" ? stripHtml("gen", it.s?.id, it.in, w) : stripHtml("outro", it.coach.id, 0, w);
          const label = it.kind === "clip" ? (it.s ? escapeHtml(it.s.label) : "⚠️ الفيديو اتمسح") : `🎬 أوترو ${escapeHtml(it.coach.name)}`;
          return `<div class="tl-clip ${it.kind} ${sel ? "selected" : ""} ${it.s || it.kind === "outro" ? "" : "missing"}"
              ${it.kind === "clip" ? `data-i="${it.i}"` : `data-outro="1"`} style="left:${it.t0 * mt.pps}px;width:${w}px">
            ${strip}
            <span class="nm" dir="auto">${label}</span><span class="du">${(it.t1 - it.t0).toFixed(1)}s</span>
            ${it.kind === "clip" ? `<b class="h l" data-h="l"></b><b class="h r" data-h="r"></b>` : ""}
          </div>`;
        })
        .join("")
    : `<div class="tl-drop-hint">اسحب فيديو هنا أو دوس ＋ على فيديو من المكتبة</div>`;

  for (const [kind, info, color] of [["voice", voice, "#7fb2ff"], ["music", music, "#6fe0bd"]]) {
    const el = $(kind === "voice" ? "trkVoice" : "trkMusic");
    if (!info) {
      el.innerHTML = `<div class="tl-empty-track">${kind === "voice" ? "مفيش تعليق صوتي — اختاره من تاب 🔊 الصوت" : "مفيش موسيقى — اختارها من تاب 🔊 الصوت"}</div>`;
      continue;
    }
    const sel = mt.sel?.kind === kind;
    el.innerHTML = `<div class="tl-audio ${kind} ${sel ? "selected" : ""}" data-track="${kind}" style="left:${info.t0 * mt.pps}px;width:${info.len * mt.pps}px">
        <canvas></canvas><span class="nm" dir="auto">${escapeHtml(info.a.name)}</span>
        <b class="h l" data-h="l"></b><b class="h r" data-h="r"></b></div>`;
    drawWave(el.querySelector("canvas"), info.url, info.offset, info.len, color);
  }

  $("trkCaps").innerHTML = captionBlocks()
    .map((g) => `<div class="tl-cap" data-t="${g.t0}" style="left:${g.t0 * mt.pps}px;width:${Math.max(2, (g.t1 - g.t0) * mt.pps)}px">${escapeHtml(g.text)}</div>`)
    .join("");

  $("totalLabel").textContent = total ? `${d.clips.length} قطعة` : "";
  drawPlayhead();
}

// الكابشن اللي هيظهر على الفيديو، بمواعيده على التايم لاين
function captionBlocks() {
  const d = mt.project.data;
  const voice = trackInfo("voice");
  const tr = voice && typeof brand !== "undefined" && brand.tr[voice.t.id];
  if (!d.captions?.enabled || !(tr?.status === "done" && tr.words.length)) return [];
  const words = tr.words.filter((w) => w.e > voice.offset && w.s < voice.offset + voice.len);
  const groups = groupWords(words, d.captions.words || 3);
  const shift = voice.t0 - voice.offset;
  return groups.map((g, k) => {
    const next = groups[k + 1];
    const t0 = g[0].s + shift;
    const t1 = Math.min(next ? next[0].s : Infinity, g[g.length - 1].e + 0.5) + shift;
    return { t0, t1, g, shift, text: g.map((w) => w.w).join(" ") };
  });
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
  const end = Math.max(totalLength(), trackInfo("voice")?.t1 || 0, trackInfo("music")?.t1 || 0, 5);
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

function splitAt(t) {
  const it = seq().items.find((x) => x.kind === "clip" && t > x.t0 && t < x.t1);
  if (!it) return toast("حط المؤشر على قطعة فيديو عشان تقسمها", true);
  const at = snap(it.in + (t - it.t0));
  if (at - it.in < MIN_CLIP || clipOut(it.c) - at < MIN_CLIP) return toast("قريب أوي من طرف القطعة", true);
  pushHistory();
  const clips = mt.project.data.clips;
  clips.splice(it.i + 1, 0, { ...it.c, start: at });
  clips[it.i].end = at;
  mt.sel = { kind: "clip", i: it.i + 1 };
  changed();
}
$("tlSplit").onclick = $("edSplit").onclick = () => splitAt(mt.t);

function deleteSelected() {
  const s = mt.sel;
  if (!s) return;
  pushHistory();
  const d = mt.project.data;
  if (s.kind === "clip") d.clips.splice(s.i, 1);
  else if (s.kind === "voice") d.voice = null;
  else if (s.kind === "music") d.music = null;
  else if (s.kind === "outro") d.outro = false;
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
    const kind = audEl.dataset.track;
    selectItem({ kind });
    return moveTrack(e, kind, handle);
  }
});

function trimClip(e, i, side) {
  pause();
  pushHistory();
  const c = mt.project.data.clips[i];
  const s = clipSource(c);
  const start0 = c.start, out0 = clipOut(c);
  mt.sel = { kind: "clip", i };
  drag(
    e,
    (dx) => {
      const ds = snap(dx / mt.pps);
      if (side === "l") {
        c.start = clamp(snap(start0 + ds), 0, out0 - MIN_CLIP);
        mt.t = seq().items[i].t0;
      } else {
        const out = clamp(snap(out0 + ds), c.start + MIN_CLIP, s.duration);
        c.end = out >= s.duration - 0.001 ? null : out;
        mt.t = Math.max(seq().items[i].t0, seq().items[i].t1 - 1 / FPS);
      }
      renderTimeline();
      renderInspector();
      syncPreview();
    },
    () => { renderSide(); scheduleSave(); }
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

function moveTrack(e, kind, side) {
  pause();
  const info = trackInfo(kind);
  if (!info) return;
  pushHistory();
  const t = info.t;
  const { offset: off0, t0: delay0, len: len0 } = info;
  drag(
    e,
    (dx) => {
      let ds = snap(dx / mt.pps);
      if (!side) {
        let delay = Math.max(0, delay0 + ds);
        // يلزق في أول الفيديو وفي المؤشر
        if (delay * mt.pps < 8) delay = 0;
        if (Math.abs(delay - mt.t) * mt.pps < 8) delay = mt.t;
        t.delay = snap(delay);
      } else if (side === "l") {
        ds = clamp(ds, Math.max(-off0, -delay0), len0 - 0.3);
        t.offset = snap(off0 + ds);
        t.delay = snap(delay0 + ds);
        t.length = snap(len0 - ds);
      } else {
        const len = clamp(snap(len0 + ds), 0.3, info.dur - off0);
        t.length = len >= info.dur - off0 - 0.01 ? null : len;
      }
      renderTimeline();
    },
    () => { renderSide(); scheduleSave(); }
  );
}

// خط أداة القطع
$("tlCanvas").addEventListener("pointermove", (e) => {
  const hover = $("tlHover");
  const onClip = e.target.closest(".tl-clip[data-i]");
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
const voiceEl = new Audio(), musicEl = new Audio();
voiceEl.preload = musicEl.preload = "auto";

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

function showItem(it, t, playing) {
  const v = it?.url ? videoFor(it.url) : null;
  if (v !== mt.active) {
    mt.active?.pause();
    for (const el of pool.values()) el.classList.toggle("on", el === v);
  }
  const changedItem = mt.activeKey !== it?.key || mt.active !== v;
  mt.active = v;
  mt.activeItem = it;
  mt.activeKey = it?.key ?? null;
  if (!v) return;
  const want = it.in + clamp(t - it.t0, 0, it.t1 - it.t0 - 0.5 / FPS);
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
    voiceEl.pause();
    musicEl.pause();
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
  voiceEl.pause();
  musicEl.pause();
  $("tpPlay").textContent = "▶︎";
  mt.t = snap(mt.t);
  syncPreview();
}
const togglePlayback = () => (mt.playing ? pause() : play());

function syncAudio(el, info, t, total, fade) {
  if (!info || t < info.t0 || t >= info.t1) { if (!el.paused) el.pause(); return; }
  if (el.getAttribute("src") !== info.url) el.src = info.url;
  let vol = clamp(info.t.volume ?? 1, 0, 1);
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
  const v = mt.active;
  if (v) {
    v.muted = false;
    v.volume = clamp(it.volume, 0, 1);
    if (v.paused) v.play().catch(() => {});
  }
  syncAudio(voiceEl, trackInfo("voice"), mt.t, total, false);
  syncAudio(musicEl, trackInfo("music"), mt.t, total, true);
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
  else if (ctrl && code === "KeyB") splitAt(mt.t);
  else if (ctrl) done = false;
  else if (code === "KeyS") splitAt(mt.t);
  else if (code === "KeyB" || code === "KeyC") setTool("blade");
  else if (code === "KeyV" || code === "KeyA" || e.key === "Escape") setTool("select");
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
  $("volVal").textContent = `${Math.round(c.volume * 100)}%`;
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
$("edReset").onclick = editorInput(null, (c) => Object.assign(c, { zoom: 1, x: 0, y: 0, volume: 1 }));

// ---------- المدرب والصوت ----------
function renderSide() {
  const d = mt.project.data;
  const coach = mt.coaches.find((c) => c.id === d.coach_id);
  $("mCoach").value = d.coach_id || "";
  $("mOutro").checked = d.outro;
  $("mOutro").disabled = !coach?.outro_url;
  $("outroInfo").textContent = !coach ? "" : coach.outro_url ? `(${fmtDuration(coach.outro_duration)})` : "(المدرب ده مالوش أوترو)";
  $("mOutroVol").value = Math.round(d.outro_volume * 100);
  $("outroVolVal").textContent = `${Math.round(d.outro_volume * 100)}%`;

  $("mVoice").value = d.voice?.id || "";
  $("voiceOpts").hidden = !d.voice;
  if (d.voice) {
    $("mVoiceVol").value = Math.round(d.voice.volume * 100);
    $("voiceVolVal").textContent = `${Math.round(d.voice.volume * 100)}%`;
    $("mVoiceDelay").value = d.voice.delay;
  }

  $("mMusic").value = d.music?.id || "";
  $("musicOpts").hidden = !d.music;
  if (d.music) {
    $("mMusicVol").value = Math.round(d.music.volume * 100);
    $("musicVolVal").textContent = `${Math.round(d.music.volume * 100)}%`;
    $("mMusicOffset").value = d.music.offset;
    $("mMusicFade").checked = d.music.fade_out;
    const info = trackInfo("music");
    const total = totalLength();
    $("musicWarn").hidden = !info || info.t1 >= total - 0.05;
    if (info) $("musicWarn").textContent = `⚠️ الموسيقى بتخلص عند ${fmtDuration(info.t1)} والفيديو طوله ${fmtDuration(total)}، فآخر الفيديو هيبقى من غير موسيقى.`;
  }
  $("renderBtn").disabled = d.clips.length === 0 || mt.project.render_status === "rendering";
  if (typeof renderBrandPanels === "function") renderBrandPanels();
}

function sideInput(key, apply) {
  return () => { pushHistory(key); apply(mt.project.data); fixSelection(); renderSide(); renderTimeline(); syncPreview(); scheduleSave(); };
}
$("mCoach").addEventListener("change", sideInput(null, (d) => { d.coach_id = $("mCoach").value || null; renderBin(); }));
$("mOutro").addEventListener("change", sideInput(null, (d) => (d.outro = $("mOutro").checked)));
$("mOutroVol").addEventListener("input", sideInput("outroVol", (d) => (d.outro_volume = $("mOutroVol").value / 100)));
$("mVoice").addEventListener("change", sideInput(null, (d) => {
  d.voice = $("mVoice").value ? { id: $("mVoice").value, volume: d.voice?.volume ?? 1, delay: d.voice?.delay ?? 0, offset: 0, length: null, fade_out: false } : null;
}));
$("mVoiceVol").addEventListener("input", sideInput("voiceVol", (d) => (d.voice.volume = $("mVoiceVol").value / 100)));
$("mVoiceDelay").addEventListener("change", sideInput(null, (d) => (d.voice.delay = Math.max(0, Number($("mVoiceDelay").value) || 0))));
$("mMusic").addEventListener("change", sideInput(null, (d) => {
  d.music = $("mMusic").value ? { id: $("mMusic").value, volume: d.music?.volume ?? 0.3, delay: 0, offset: 0, length: null, fade_out: d.music?.fade_out ?? true } : null;
}));
$("mMusicVol").addEventListener("input", sideInput("musicVol", (d) => (d.music.volume = $("mMusicVol").value / 100)));
$("mMusicOffset").addEventListener("change", sideInput(null, (d) => {
  d.music.offset = Math.max(0, Number($("mMusicOffset").value) || 0);
  d.music.length = null;
}));
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
    body: JSON.stringify(data),
  });
  mt.projects.unshift(p);
  openProject(p);
  $("projectName").select();
};
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
  btn.textContent = p.render_status === "rendering" ? "⏳ بيصدّر..." : "🎬 صدّر الفيديو";
  $("renderError").hidden = p.render_status !== "failed";
  $("renderError").textContent = p.render_error || "";
  const done = p.render_status === "done" && p.export_id;
  $("renderResult").hidden = !done;
  if (done) {
    const url = `/media/exports/${p.export_id}.mp4`;
    if ($("resultVideo").getAttribute("src") !== url) $("resultVideo").src = url;
    $("resultDownload").href = url;
    $("resultDownload").setAttribute("download", `${p.data.name}.mp4`);
  }
  renderSide();
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
  }
};

async function pollRender() {
  clearTimeout(mt.pollTimer);
  const id = mt.project?.id;
  if (!id) return;
  const list = await api("/api/projects");
  const fresh = list.find((p) => p.id === id);
  if (!fresh || mt.project?.id !== id) return;
  Object.assign(mt.project, { render_status: fresh.render_status, render_error: fresh.render_error, export_id: fresh.export_id });
  renderRender();
  if (fresh.render_status === "rendering") mt.pollTimer = setTimeout(pollRender, 2000);
  else if (fresh.render_status === "done") toast("✅ الفيديو جاهز");
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
    d.clips = draft.gen_ids.map((gen_id) => old.get(gen_id) || { gen_id, ...CLIP_DEFAULTS });
    if (draft.voice && d.voice?.id !== draft.voice.id) {
      d.voice = { id: draft.voice.id, volume: d.voice?.volume ?? 1, delay: d.voice?.delay ?? 0, offset: 0, length: null, fade_out: false };
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
