// StudioMania — الخطوة 1: تقطيع الفيديوهات

const $ = (id) => document.getElementById(id);
const state = { videos: [], current: null, maxClip: 15, minGap: 0.2, history: [] };

const player = $("player");

// ---------- أدوات ----------
function fmt(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function toast(msg, isError = false) {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast" + (isError ? " error" : "");
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    location.href = "/login";
    throw new Error("لازم تسجّل دخول");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `خطأ ${res.status}`);
  return data;
}

// لغة التواريخ: أرقام عادية في العربي، وإنجليزي لو الواجهة إنجليزي
const UI_LOCALE = () => (window.I18N?.lang === "en" ? "en-US" : "ar-EG-u-nu-latn");

// القوايم بتعرض صورة صغيرة من السيرفر، والفيديو نفسه ميتحمّلش غير لما تشغّله (أخف بكتير)
const thumbOf = (url) => (url && url.startsWith("/media/") ? `/api/thumb?src=${encodeURIComponent(url.split("#")[0])}` : "");
function lightVideo(url, attrs = "") {
  const poster = thumbOf(url);
  return `<video src="${url}" preload="none"${poster ? ` poster="${poster}"` : ""} ${attrs}></video>`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// نفس منطق السيرفر عشان الشاشة تتحدث فورًا
function buildSegments(duration, cuts, skipped) {
  const points = [0, ...[...cuts].sort((a, b) => a - b), duration];
  const skipKeys = new Set(skipped.map((s) => s.toFixed(2)));
  return points.slice(0, -1).map((start, i) => {
    const end = points[i + 1];
    return {
      index: i, start, end, duration: end - start,
      skipped: skipKeys.has(start.toFixed(2)),
      too_long: end - start > state.maxClip + 1e-6,
    };
  });
}

// ---------- المكتبة ----------
async function loadVideos() {
  state.videos = await api("/api/videos");
  renderLibrary();
}

function renderLibrary() {
  const list = $("videoList");
  $("libraryEmpty").hidden = state.videos.length > 0;
  list.innerHTML = state.videos
    .map((v) => {
      const longCount = v.segments.filter((s) => s.too_long && !s.skipped).length;
      const badge = v.clips_count
        ? `<span class="badge ok">${v.clips_count} قطعة جاهزة</span>`
        : longCount
          ? `<span class="badge warn">محتاج تقطيع</span>`
          : "";
      return `<li data-id="${v.id}" class="${state.current?.id === v.id ? "active" : ""}">
        <div class="name">${escapeHtml(v.name)}</div>
        <div class="meta"><span>${fmt(v.duration)}</span><span>${v.cuts.length} نقطة قطع</span>${v.voice ? `<span class="badge ok" title="${escapeHtml(v.voice.name)}">🎙️ صوت مربوط</span>` : ""}${v.coach ? `<span class="badge ok">🧑‍🏫 ${escapeHtml(v.coach.name)}</span>` : ""}${badge}</div>
      </li>`;
    })
    .join("");
}

$("videoList").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (li) openVideo(li.dataset.id);
});

// ---------- الرفع ----------
function uploadFile(file) {
  return new Promise((resolve) => {
    const row = document.createElement("div");
    row.className = "upload-item";
    row.innerHTML = `<div>${escapeHtml(file.name)}</div><div class="bar"><i></i></div>`;
    $("uploads").appendChild(row);
    const bar = row.querySelector("i");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/videos");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) bar.style.width = `${(e.loaded / e.total) * 100}%`;
    };
    xhr.onload = () => {
      row.remove();
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        toast(`اترفع: ${file.name}`);
        resolve(data);
      } else {
        toast(`فشل رفع ${file.name}: ${data.detail || xhr.status}`, true);
        resolve(null);
      }
    };
    xhr.onerror = () => {
      row.remove();
      toast(`فشل رفع ${file.name}`, true);
      resolve(null);
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

async function uploadFiles(files) {
  let last = null;
  for (const f of files) last = (await uploadFile(f)) || last;
  await loadVideos();
  if (last && !state.current) openVideo(last.id);
}

$("fileInput").addEventListener("change", (e) => {
  uploadFiles([...e.target.files]);
  e.target.value = "";
});

const dz = $("dropzone");
["dragenter", "dragover"].forEach((ev) =>
  document.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); })
);
["dragleave", "drop"].forEach((ev) =>
  document.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "drop" || e.target === dz) dz.classList.remove("over"); })
);
document.addEventListener("drop", (e) => {
  if (!isStep1()) return;
  const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("video/") || /\.(mkv|mov|m4v)$/i.test(f.name));
  if (files.length) uploadFiles(files);
});

// ---------- المحرر ----------
function openVideo(id) {
  const v = state.videos.find((x) => x.id === id);
  if (!v) return;
  state.current = structuredClone(v);
  state.history = [];
  $("placeholder").hidden = true;
  $("editor").hidden = false;
  $("editorTitle").textContent = v.name;
  player.src = v.url;
  renderLibrary();
  renderEditor();
  requestAnimationFrame(fitCutZoom);
  loadClips();
  loadVoiceLink();
  loadCoachLink();
}

// ---------- ربط المدرب بالفيديو ----------
async function loadCoachLink() {
  const v = state.current;
  if (!v) return;
  const coaches = await api("/api/coaches");
  $("coachLinkSelect").innerHTML = `<option value="">— مفيش —</option>` +
    coaches.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}${c.outro_url ? "" : " (من غير أوترو)"}</option>`).join("");
  $("coachLinkSelect").value = v.coach?.id || "";
  renderCoachLink();
}

function renderCoachLink() {
  const c = state.current?.coach;
  $("coachLinkImg").hidden = !c;
  if (c) $("coachLinkImg").src = c.image_url;
  $("coachLinkInfo").textContent = !c
    ? "اربطه عشان صورته تتبعت لـ Seedance والأوترو بتاعه يتحط في الآخر لوحدهم"
    : c.has_outro ? "✓ صورته للتوليد والأوترو بتاعه في الآخر" : "⚠️ المدرب ده مالوش أوترو، ضيفه من صفحة المدربين";
}

$("coachLinkSelect").addEventListener("change", async () => {
  const v = state.current;
  try {
    const saved = await api(`/api/videos/${v.id}/coach`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coach_id: $("coachLinkSelect").value || null }),
    });
    v.coach = saved.coach;
    const i = state.videos.findIndex((x) => x.id === v.id);
    if (i >= 0) state.videos[i] = saved;
    renderLibrary();
    renderCoachLink();
    toast(saved.coach ? `✅ الفيديو اتربط بـ ${saved.coach.name}` : "اتفك الربط");
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- ربط التسجيل الصوتي بالفيديو ----------
async function loadVoiceLink() {
  const v = state.current;
  if (!v) return;
  const voices = await api("/api/audio?kind=voice");
  $("voiceSelect").innerHTML = `<option value="">— مفيش —</option>` +
    voices.map((a) => `<option value="${a.id}">${escapeHtml(a.name)} (${fmtDuration(a.duration)})</option>`).join("");
  $("voiceSelect").value = v.voice?.id || "";
  renderVoiceInfo();
}

function renderVoiceInfo() {
  const v = state.current;
  const info = $("voiceInfo");
  if (!v?.voice) {
    info.textContent = "اربطه عشان المونتاج يلاقيه جاهز";
    return;
  }
  const diff = Math.abs(v.voice.duration - v.duration);
  info.textContent = `طول الصوت ${fmtDuration(v.voice.duration)} · طول الفيديو ${fmtDuration(v.duration)}` +
    (diff > 2 ? " ⚠️ مختلفين" : " ✓");
}

async function linkVoice(voiceId) {
  const v = state.current;
  try {
    const saved = await api(`/api/videos/${v.id}/voice`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_id: voiceId || null }),
    });
    v.voice = saved.voice;
    const i = state.videos.findIndex((x) => x.id === v.id);
    if (i >= 0) state.videos[i] = saved;
    renderLibrary();
    renderVoiceInfo();
    toast(voiceId ? "✅ التسجيل اتربط بالفيديو" : "اتفك الربط");
  } catch (err) {
    toast(err.message, true);
  }
}

$("voiceSelect").addEventListener("change", () => linkVoice($("voiceSelect").value));
$("voiceUpload").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const form = new FormData();
  form.append("kind", "voice");
  form.append("file", file);
  try {
    toast(`⏳ بيرفع ${file.name}...`);
    const a = await api("/api/audio", { method: "POST", body: form });
    await linkVoice(a.id);
    await loadVoiceLink();
  } catch (err) {
    toast(`فشل الرفع: ${err.message}`, true);
  }
});

function currentSegments() {
  const v = state.current;
  return buildSegments(v.duration, v.cuts, v.skipped);
}

function renderEditor() {
  const v = state.current;
  if (!v) return;
  const segs = currentSegments();
  const t = player.currentTime || 0;

  renderCutTimeline();

  // الجدول
  $("segmentsBody").innerHTML = segs
    .map((s) => {
      const cls = s.skipped ? "skipped" : s.too_long ? "long" : "";
      const status = s.skipped
        ? `<span class="status">مستبعدة</span>`
        : s.too_long
          ? `<span class="status long">أطول من ${state.maxClip} ث</span>`
          : `<span class="status ok">تمام</span>`;
      const removeCut = s.index > 0
        ? `<button class="btn sm" data-act="merge" data-i="${s.index}" title="امسح نقطة القطع اللي في بداية القطعة دي">دمج مع اللي قبلها</button>`
        : "";
      return `<tr class="${cls}">
        <td>${s.index + 1}</td><td>${fmt(s.start)}</td><td>${fmt(s.end)}</td><td>${s.duration.toFixed(1)} ث</td>
        <td>${status}</td>
        <td class="actions">
          <button class="btn sm" data-act="play" data-i="${s.index}">▶︎</button>
          <button class="btn sm" data-act="skip" data-i="${s.index}">${s.skipped ? "رجّعها" : "استبعد"}</button>
          ${removeCut}
        </td>
      </tr>`;
    })
    .join("");

  // التحذير وزرار التقطيع
  const active = segs.filter((s) => !s.skipped);
  const tooLong = active.filter((s) => s.too_long);
  const alert = $("tooLongAlert");
  alert.hidden = tooLong.length === 0;
  if (tooLong.length) {
    alert.textContent = `⚠️ فيه ${tooLong.length} قطعة أطول من ${state.maxClip} ثانية (رقم ${tooLong.map((s) => s.index + 1).join("، ")}). زوّد نقط قطع فيها أو استبعدها قبل ما تقطّع.`;
  }
  $("splitBtn").disabled = $("splitSendBtn").disabled = tooLong.length > 0 || active.length === 0;
  $("splitInfo").textContent = active.length
    ? `هيطلع ${active.length} قطعة`
    : "كل القطع مستبعدة";
  $("undoCut").disabled = state.history.length === 0;
  updatePlayhead();
}

// ---------- تايم لاين التقطيع (شبه المونتاج) ----------
const ct = { pps: 20, fps: 30, strip: null, stripFor: null, drag: null };
const CT_MIN = 2, CT_MAX = 600;
const ctClamp = (v, a, b) => Math.min(b, Math.max(a, v));

// 00:00:00 = دقايق:ثواني:فريمات
function fmtFrames(t) {
  const f = Math.round(Math.max(0, t) * ct.fps);
  const fps = Math.round(ct.fps);
  const sec = Math.floor(f / fps);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(sec / 60))}:${p(sec % 60)}:${p(f % fps)}`;
}
const snapFrame = (t) => Math.round(t * ct.fps) / ct.fps;

// شريط الصور بتاع الفيديو الخام (بيتعمل مرة واحدة على السيرفر)
function loadCutStrip(v) {
  if (ct.stripFor === v.id) return;
  ct.stripFor = v.id;
  ct.strip = null;
  ct.fps = 30;
  fetch(`/api/montage/filmstrip?kind=raw&id=${v.id}`)
    .then(async (r) => {
      if (!r.ok || ct.stripFor !== v.id) return;
      const frames = Number(r.headers.get("X-Frames")) || 1;
      const fps = Number(r.headers.get("X-Fps")) || 1;
      ct.fps = Number(r.headers.get("X-Video-Fps")) || 30;
      const url = URL.createObjectURL(await r.blob());
      const img = new Image();
      img.onload = () => {
        if (ct.stripFor !== v.id) return;
        ct.strip = { url, frames, fps, aspect: img.width / frames / img.height };
        renderCutTimeline();
      };
      img.src = url;
    })
    .catch(() => {});
}

function cutStripHtml(s0, width) {
  const info = ct.strip;
  if (!info) return "";
  const h = 62;
  const tw = Math.max(10, h * info.aspect);
  const n = Math.min(600, Math.ceil(width / tw));
  let html = "";
  for (let k = 0; k < n; k++) {
    const t = s0 + (k * tw + tw / 2) / ct.pps;
    const fi = ctClamp(Math.floor(t * info.fps), 0, info.frames - 1);
    html += `<i style="width:${tw}px;background-position:${-fi * tw}px 0;background-size:${info.frames * tw}px 100%"></i>`;
  }
  return `<div class="strip" style="--img:url(${info.url})">${html}</div>`;
}

function cutRuler(width) {
  const steps = [1 / ct.fps, 2 / ct.fps, 5 / ct.fps, 10 / ct.fps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const major = steps.find((x) => x * ct.pps >= 70) || 300;
  let minor = major < 1 ? major / 2 : major / 5;
  if (minor * ct.pps < 6) minor = major;
  let html = "";
  for (let k = 0; k * major * ct.pps < width; k++) {
    const t = k * major;
    const f = Math.round(t * ct.fps) % Math.round(ct.fps);
    html += `<span style="left:${t * ct.pps}px">${f ? `${f}f` : fmtFrames(t).slice(0, 5)}</span>`;
  }
  const r = $("ctRuler");
  r.innerHTML = html;
  r.style.setProperty("--minor", `${minor * ct.pps}px`);
  r.style.setProperty("--major", `${major * ct.pps}px`);
}

function renderCutTimeline() {
  const v = state.current;
  if (!v) return;
  loadCutStrip(v);
  const sc = $("ctScroll");
  const width = Math.max(sc.clientWidth, v.duration * ct.pps + 30);
  $("timeline").style.width = `${width}px`;
  cutRuler(width);
  const t = player.currentTime || 0;
  const segs = currentSegments();
  $("timelineSegs").innerHTML = segs
    .map((s) => {
      const cls = s.skipped ? "skipped" : s.too_long ? "long" : "ok";
      const cur = t >= s.start && t < s.end ? " current" : "";
      const w = s.duration * ct.pps;
      return `<div class="ct-seg ${cls}${cur}" data-i="${s.index}" style="left:${s.start * ct.pps}px;width:${w}px">
        ${cutStripHtml(s.start, w)}
        ${w > 26 ? `<span class="nm"><span>#${s.index + 1}</span>${w > 90 ? `<span> · ${s.duration.toFixed(1)}ث</span>` : ""}${s.skipped && w > 150 ? "<span> · مستبعدة</span>" : s.too_long && w > 150 ? `<span> · أطول من ${state.maxClip}ث</span>` : ""}</span>` : ""}
      </div>`;
    })
    .join("") + v.cuts
    .map((c, i) => `<div class="ct-cut" data-c="${i}" style="left:${c * ct.pps}px" title="${fmtFrames(c)} · اسحب تحرّكه · دبل كليك يمسحه"></div>`)
    .join("");
  $("ctZoom").value = Math.round((Math.log(ct.pps / CT_MIN) / Math.log(CT_MAX / CT_MIN)) * 1000);
  updatePlayhead();
}

function updatePlayhead() {
  const v = state.current;
  if (!v) return;
  const t = player.currentTime || 0;
  const x = t * ct.pps;
  $("playhead").style.left = `${x}px`;
  $("timeLabel").textContent = `${fmtFrames(t)} / ${fmtFrames(v.duration)}`;
  $("playPause").textContent = player.paused ? "▶︎" : "⏸";
  // المؤشر يفضل باين وهو شغال
  const sc = $("ctScroll");
  if (!player.paused && !ct.drag && (x < sc.scrollLeft || x > sc.scrollLeft + sc.clientWidth - 40)) sc.scrollLeft = x - 40;
}

function setCutZoom(pps, anchorX) {
  const sc = $("ctScroll");
  const ax = anchorX ?? ctClamp((player.currentTime || 0) * ct.pps - sc.scrollLeft, 0, sc.clientWidth);
  const tAnchor = (sc.scrollLeft + ax) / ct.pps;
  ct.pps = ctClamp(pps, CT_MIN, CT_MAX);
  renderCutTimeline();
  sc.scrollLeft = tAnchor * ct.pps - ax;
}
function fitCutZoom() {
  const v = state.current;
  if (!v) return;
  const sc = $("ctScroll");
  setCutZoom((sc.clientWidth - 30) / Math.max(v.duration, 1), 0);
  sc.scrollLeft = 0;
}
$("ctZoom").addEventListener("input", () => setCutZoom(CT_MIN * (CT_MAX / CT_MIN) ** ($("ctZoom").value / 1000)));
$("ctZoomIn").onclick = () => setCutZoom(ct.pps * 1.5);
$("ctZoomOut").onclick = () => setCutZoom(ct.pps / 1.5);
$("ctFit").onclick = fitCutZoom;
$("ctScroll").addEventListener("wheel", (e) => {
  const sc = $("ctScroll");
  if (e.ctrlKey || e.metaKey || e.altKey) {
    e.preventDefault();
    setCutZoom(ct.pps * Math.exp(-e.deltaY * 0.002), e.clientX - sc.getBoundingClientRect().left);
  } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && sc.scrollWidth > sc.clientWidth) {
    e.preventDefault();
    sc.scrollLeft += e.deltaY;
  }
}, { passive: false });
window.addEventListener("resize", () => state.current && isStep1() && renderCutTimeline());

const timeAt = (e) => {
  const r = $("timeline").getBoundingClientRect();
  return ctClamp((e.clientX - r.left) / ct.pps, 0, state.current.duration);
};

function seekTo(t) {
  stopAt = null;
  player.currentTime = ctClamp(t, 0, state.current.duration);
  updatePlayhead();
}
// فريم بالظبط: بنقف في نص الفريم عشان المتصفح يعرضه صح
function stepFrames(n) {
  if (!state.current) return;
  player.pause();
  const f = Math.round((player.currentTime || 0) * ct.fps) + n;
  seekTo((f + 0.01) / ct.fps);
}
function stepSeconds(n) {
  if (state.current) seekTo((player.currentTime || 0) + n);
}

// دوسة أو سحب على التايم لاين = تحريك المؤشر · سحب خط القطع = تحريكه
$("timeline").addEventListener("pointerdown", (e) => {
  const v = state.current;
  if (!v || e.button !== 0) return;
  const cutEl = e.target.closest(".ct-cut");
  // دبل كليك: دوستين على نفس الخط ورا بعض بسرعة (pointer events مبتعدّش الدوسات)
  const now = performance.now();
  const dbl = cutEl && ct.lastCut?.c === cutEl.dataset.c && now - ct.lastCut.at < 400;
  ct.lastCut = cutEl ? { c: cutEl.dataset.c, at: now } : null;
  if (dbl) {
    ct.lastCut = null;
    // دبل كليك على خط القطع = امسحه
    const c = v.cuts[Number(cutEl.dataset.c)];
    commit(v.cuts.filter((x) => x !== c), v.skipped.filter((s) => Math.abs(s - c) > 0.006));
    toast("اتمسحت نقطة القطع");
    e.preventDefault();
    return;
  }
  if (cutEl) {
    const i = Number(cutEl.dataset.c);
    const old = v.cuts[i];
    ct.drag = { kind: "cut", i, old, before: { cuts: [...v.cuts], skipped: [...v.skipped] } };
  } else {
    ct.drag = { kind: "seek" };
    player.pause();
    seekTo(timeAt(e));
  }
  $("timeline").setPointerCapture(e.pointerId);
  e.preventDefault();
});
$("timeline").addEventListener("pointermove", (e) => {
  const v = state.current;
  if (!v) return;
  const hover = $("ctHover");
  if (!ct.drag) {
    hover.hidden = !e.target.closest(".ct-track");
    hover.style.left = `${timeAt(e) * ct.pps}px`;
    return;
  }
  hover.hidden = true;
  if (ct.drag.kind === "seek") return seekTo(timeAt(e));
  const { i } = ct.drag;
  const lo = (i > 0 ? v.cuts[i - 1] : 0) + state.minGap;
  const hi = (i < v.cuts.length - 1 ? v.cuts[i + 1] : v.duration) - state.minGap;
  const t = ctClamp(snapFrame(timeAt(e)), lo, hi);
  v.cuts[i] = Math.round(t * 1000) / 1000;
  ct.drag.moved = true;
  // القطعة المستبعدة تفضل مستبعدة بعد ما بدايتها تتحرك
  seekTo(t);
  renderCutTimeline();
});
$("timeline").addEventListener("pointerleave", () => ($("ctHover").hidden = true));
$("timeline").addEventListener("pointerup", () => {
  const d = ct.drag;
  ct.drag = null;
  if (d?.kind !== "cut" || !d.moved) return;
  const v = state.current;
  const moved = v.cuts[d.i];
  const skipped = d.before.skipped.map((s) => (Math.abs(s - d.old) < 0.006 ? Math.round(moved * 100) / 100 : s));
  v.cuts = d.before.cuts;
  commit(v.cuts.map((c, k) => (k === d.i ? moved : c)), skipped);
});


let saveTimer;
function commit(newCuts, newSkipped) {
  const v = state.current;
  state.history.push({ cuts: [...v.cuts], skipped: [...v.skipped] });
  v.cuts = [...newCuts].sort((a, b) => a - b);
  v.skipped = newSkipped;
  renderEditor();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}

async function save() {
  const v = state.current;
  if (!v) return;
  try {
    const saved = await api(`/api/videos/${v.id}/cuts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cuts: v.cuts, skipped: v.skipped }),
    });
    const i = state.videos.findIndex((x) => x.id === saved.id);
    if (i >= 0) state.videos[i] = saved;
    if (state.current?.id === saved.id) {
      state.current.cuts = saved.cuts;
      state.current.skipped = saved.skipped;
    }
    renderLibrary();
    renderEditor();
  } catch (err) {
    toast(`مش قادر أحفظ: ${err.message}`, true);
  }
}

function cutHere() {
  const v = state.current;
  if (!v) return;
  const t = Math.round(snapFrame(player.currentTime) * 1000) / 1000;
  if (t < state.minGap || t > v.duration - state.minGap) {
    toast("مينفعش تقطع في أول أو آخر الفيديو بالظبط");
    return;
  }
  if (v.cuts.some((c) => Math.abs(c - t) < state.minGap)) {
    toast("فيه نقطة قطع قريبة جدًا من هنا");
    return;
  }
  // لو القطعة اللي اتقسمت كانت مستبعدة، الجزئين يفضلوا مستبعدين
  const seg = currentSegments().find((s) => t > s.start && t < s.end);
  const skipped = [...v.skipped];
  if (seg?.skipped) skipped.push(Math.round(t * 100) / 100);
  commit([...v.cuts, t], skipped);
}

function undo() {
  const prev = state.history.pop();
  if (!prev) return;
  state.current.cuts = prev.cuts;
  state.current.skipped = prev.skipped;
  renderEditor();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}

// تشغيل قطعة واحدة بس
let stopAt = null;
function playSegment(seg) {
  player.currentTime = seg.start;
  stopAt = seg.end;
  player.play();
}
player.addEventListener("timeupdate", () => {
  if (stopAt !== null && player.currentTime >= stopAt) {
    player.pause();
    stopAt = null;
  }
  renderEditorLight();
});
player.addEventListener("seeked", renderEditorLight);
player.addEventListener("play", updatePlayhead);
player.addEventListener("pause", updatePlayhead);

// بنحدّث التايم لاين بس (مش الجدول) أثناء التشغيل
function renderEditorLight() {
  const v = state.current;
  if (!v) return;
  const t = player.currentTime;
  const segs = currentSegments();
  document.querySelectorAll("#timelineSegs .ct-seg").forEach((el) => {
    const s = segs[Number(el.dataset.i)];
    el.classList.toggle("current", !!s && t >= s.start && t < s.end);
  });
  updatePlayhead();
}

$("segmentsBody").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const v = state.current;
  const seg = currentSegments()[Number(btn.dataset.i)];
  if (btn.dataset.act === "play") playSegment(seg);
  if (btn.dataset.act === "skip") {
    const key = seg.start.toFixed(2);
    const skipped = seg.skipped
      ? v.skipped.filter((s) => s.toFixed(2) !== key)
      : [...v.skipped, Math.round(seg.start * 100) / 100];
    commit(v.cuts, skipped);
  }
  if (btn.dataset.act === "merge") {
    const skipped = v.skipped.filter((s) => s.toFixed(2) !== seg.start.toFixed(2));
    commit(v.cuts.filter((c) => Math.abs(c - seg.start) > 1e-6), skipped);
  }
});

function togglePlay() {
  stopAt = null;
  player.paused ? player.play() : player.pause();
}

$("playPause").onclick = togglePlay;
$("back1").onclick = () => stepSeconds(-1);
$("fwd1").onclick = () => stepSeconds(1);
$("prevFrame").onclick = () => stepFrames(-1);
$("nextFrame").onclick = () => stepFrames(1);
$("cutHere").onclick = cutHere;
$("undoCut").onclick = undo;

document.addEventListener("keydown", (e) => {
  if (!state.current || !isStep1() || e.target.matches("input, textarea, select")) return;
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); togglePlay(); }
  else if (k === "c" || k === "ؤ") { e.preventDefault(); cutHere(); }
  else if (k === "z" || k === "ئ") { e.preventDefault(); undo(); }
  else if (k === "arrowleft") { e.preventDefault(); e.shiftKey ? stepSeconds(-1) : stepFrames(-1); }
  else if (k === "arrowright") { e.preventDefault(); e.shiftKey ? stepSeconds(1) : stepFrames(1); }
  else if (k === "," || k === "و") { e.preventDefault(); stepFrames(-1); }
  else if (k === "." || k === "ز") { e.preventDefault(); stepFrames(1); }
});

$("deleteVideo").onclick = async () => {
  const v = state.current;
  if (!confirm(`حذف "${v.name}" وكل القطع اللي اتعملت منه؟`)) return;
  await api(`/api/videos/${v.id}`, { method: "DELETE" });
  state.current = null;
  player.removeAttribute("src");
  $("editor").hidden = true;
  $("placeholder").hidden = false;
  await loadVideos();
};

// ---------- التقطيع والقطع الجاهزة ----------
async function splitCurrent(thenSend) {
  const v = state.current;
  const btn = thenSend ? $("splitSendBtn") : $("splitBtn");
  const label = btn.textContent;
  clearTimeout(saveTimer);
  await save();
  if (v.clips_count && !confirm("الفيديو ده اتقطّع قبل كده. التقطيع الجديد هيمسح القطع القديمة. تكمّل؟")) return;
  $("splitBtn").disabled = $("splitSendBtn").disabled = true;
  btn.textContent = "⏳ بيقطّع...";
  try {
    const res = await api(`/api/videos/${v.id}/split`, { method: "POST" });
    await loadVideos();
    const fresh = state.videos.find((x) => x.id === v.id);
    if (fresh && state.current?.id === v.id) state.current.clips_count = fresh.clips_count;
    if (thenSend) {
      openGenerateWith(v.id, v.coach?.id || null);
      return;
    }
    toast(`✅ اتعمل ${res.clips_count} قطعة. دوس «✨ ابعت القطع لـ Seedance» تحت`);
    await loadClips();
    $("clipsSection").scrollIntoView({ behavior: "smooth", block: "start" });
    $("toSeedance").classList.add("pulse");
    setTimeout(() => $("toSeedance").classList.remove("pulse"), 4000);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.textContent = label;
    renderEditor();
  }
}
$("splitBtn").onclick = () => splitCurrent(false);
$("splitSendBtn").onclick = () => splitCurrent(true);

$("toSeedance").onclick = () => openGenerateWith(state.current.id, state.current.coach?.id || null);

async function loadClips() {
  const v = state.current;
  if (!v) return;
  const clips = await api(`/api/clips?video_id=${v.id}`);
  $("clipsSection").hidden = clips.length === 0;
  $("clipsCount").textContent = `(${clips.length})`;
  $("clipsGrid").innerHTML = clips
    .map(
      (c) => `<div class="clip">
        ${lightVideo(c.url, "controls playsinline")}
        <div class="info"><span>#${c.index} · ${c.duration.toFixed(1)} ث</span>
        <button class="btn sm danger" data-del="${c.id}" title="حذف القطعة">✕</button></div>
      </div>`
    )
    .join("");
}

$("clipsGrid").addEventListener("click", async (e) => {
  const id = e.target.closest("[data-del]")?.dataset.del;
  if (!id || !confirm("حذف القطعة دي؟")) return;
  await api(`/api/clips/${id}`, { method: "DELETE" });
  await loadVideos();
  await loadClips();
});

// ---------- التنقل بين الخطوات ----------
const viewHooks = {}; // كل صفحة بتسجّل هنا اللي يحصل لما تفتح
// "home" = الرئيسية (المربعات). أي خطوة تانية بتفتح في الشاشة الكبيرة (shell.js)
function showStep(step) {
  if (step !== "home" && !document.querySelector(`.view[data-view="${step}"]`)) step = "home";
  document.querySelectorAll("video, audio").forEach((m) => m.pause());
  if (location.hash !== `#${step}`) history.replaceState(null, "", `#${step}`);
  if (step === "home") return closeStage();
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.dataset.view !== step));
  openStage(step);
  viewHooks[step]?.();
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-goto]");
  if (a) { e.preventDefault(); showStep(a.dataset.goto); }
});
const isStep1 = () => !document.querySelector('.view[data-view="1"]').hidden;

// ---------- البداية ----------
(async () => {
  const cfg = await api("/api/config");
  state.maxClip = cfg.max_clip_seconds;
  state.minGap = cfg.min_cut_gap;
  await loadVideos();
  showStep(location.hash.slice(1) || "home");
})();
