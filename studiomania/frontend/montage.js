// StudioMania — الخطوة 6: المونتاج

const mt = {
  projects: [], project: null, sources: [], coaches: [], voices: [], music: [], videos: [],
  selected: -1, saveTimer: null, pollTimer: null,
};
const PROJECT_KEY = "studiomania.projectId";
const CLIP_DEFAULTS = { start: 0, end: null, zoom: 1, x: 0, y: 0, volume: 1 };

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
  mt.project = p ? structuredClone(p) : null;
  mt.selected = -1;
  if (p) storageSet(PROJECT_KEY, p.id);
  $("noProject").hidden = !!p;
  $("montage").hidden = !p;
  renderProjectSelect();
  if (!p) return;
  const d = mt.project.data;
  // المشاريع القديمة ممكن يكون فيها فيديوهات اتمسحت
  $("projectName").value = d.name;
  renderLinkedVideo();
  $("mCoach").value = d.coach_id || "";
  renderAll();
  renderRender();
  if (mt.project.render_status === "rendering") pollRender();
}

function renderAll() {
  renderBin();
  renderTimeline();
  renderClipEditor();
  renderSide();
}

// ---------- الفيديوهات المتاحة ----------
function renderBin() {
  const d = mt.project.data;
  const onlyCoach = $("binCoachOnly").checked && d.coach_id;
  const list = mt.sources.filter((s) => !onlyCoach || s.coach_id === d.coach_id);
  $("binEmpty").hidden = list.length > 0;
  $("binGrid").innerHTML = list
    .map(
      (s) => `<div class="bin-item" data-id="${s.id}">
        <video src="${s.url}#t=0.5" preload="metadata" muted playsinline></video>
        <button class="add" title="ضيف للمونتاج">＋</button>
        <span class="tag">${escapeHtml(s.label)} · ${s.duration.toFixed(1)}ث</span>
      </div>`
    )
    .join("");
}

$("binGrid").addEventListener("click", (e) => {
  const item = e.target.closest(".bin-item");
  if (!item || !e.target.closest(".add")) return;
  const src = mt.sources.find((s) => s.id === item.dataset.id);
  const d = mt.project.data;
  d.clips.push({ gen_id: src.id, ...CLIP_DEFAULTS });
  if (!d.coach_id) { d.coach_id = src.coach_id; $("mCoach").value = src.coach_id; }
  mt.selected = d.clips.length - 1;
  changed();
});
$("binCoachOnly").addEventListener("change", renderBin);

// ---------- الترتيب ----------
function clipSource(c) {
  return mt.sources.find((s) => s.id === c.gen_id);
}
function clipLength(c) {
  const s = clipSource(c);
  if (!s) return 0;
  return Math.max(0, (c.end ?? s.duration) - c.start);
}
function currentOutro() {
  const d = mt.project.data;
  const coach = mt.coaches.find((c) => c.id === d.coach_id);
  return d.outro && coach?.outro_url ? coach : null;
}
function totalLength() {
  const d = mt.project.data;
  return d.clips.reduce((sum, c) => sum + clipLength(c), 0) + (currentOutro()?.outro_duration || 0);
}

function renderTimeline() {
  const d = mt.project.data;
  $("tlEmpty").hidden = d.clips.length > 0;
  const outro = currentOutro();
  $("tlList").innerHTML =
    d.clips
      .map((c, i) => {
        const s = clipSource(c);
        return `<li data-i="${i}" class="${i === mt.selected ? "selected" : ""}">
          <span class="num">${i + 1}</span>
          ${s ? `<video src="${s.url}#t=${c.start + 0.3}" preload="metadata" muted></video>` : ""}
          <span class="lbl">${s ? escapeHtml(s.label) : "⚠️ الفيديو اتمسح"}</span>
          <span class="d">${clipLength(c).toFixed(1)}s</span>
          <span class="acts">
            <button class="btn sm" data-act="up" ${i === 0 ? "disabled" : ""} title="لفوق">▲</button>
            <button class="btn sm" data-act="down" ${i === d.clips.length - 1 ? "disabled" : ""} title="لتحت">▼</button>
            <button class="btn sm danger" data-act="remove" title="شيله">✕</button>
          </span>
        </li>`;
      })
      .join("") +
    (outro && d.clips.length
      ? `<li class="outro"><span class="num">🎬</span><span class="lbl">أوترو ${escapeHtml(outro.name)}</span><span class="d">${outro.outro_duration.toFixed(1)}s</span></li>`
      : "");
  $("totalLabel").textContent = d.clips.length ? `الطول الكلي: ${fmtDuration(totalLength())}` : "";
}

$("tlList").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-i]");
  if (!li) return;
  const i = Number(li.dataset.i);
  const clips = mt.project.data.clips;
  const act = e.target.closest("button[data-act]")?.dataset.act;
  if (act === "up" && i > 0) { [clips[i - 1], clips[i]] = [clips[i], clips[i - 1]]; mt.selected = i - 1; }
  else if (act === "down" && i < clips.length - 1) { [clips[i + 1], clips[i]] = [clips[i], clips[i + 1]]; mt.selected = i + 1; }
  else if (act === "remove") { clips.splice(i, 1); mt.selected = Math.min(mt.selected, clips.length - 1); }
  else if (!act) { mt.selected = i; renderTimeline(); renderClipEditor(); return; }
  changed();
});

// ---------- تعديل الفيديو المختار ----------
const pv = $("previewVideo");
let pvSrc = null;

function renderClipEditor() {
  const c = mt.project.data.clips[mt.selected];
  const s = c && clipSource(c);
  $("clipEditor").hidden = !s;
  if (!s) { pv.pause(); return; }
  $("editorLabel").textContent = `${mt.selected + 1}. ${s.label}`;
  if (pvSrc !== s.url) { pvSrc = s.url; pv.src = s.url; }
  const end = c.end ?? s.duration;
  for (const [id, max] of [["edStart", s.duration], ["edEnd", s.duration]]) $(id).max = max;
  $("edStart").value = c.start;
  $("edEnd").value = end;
  $("edZoom").value = Math.round(c.zoom * 100);
  $("edX").value = Math.round(c.x * 100);
  $("edY").value = Math.round(c.y * 100);
  $("edVol").value = Math.round(c.volume * 100);
  $("startVal").textContent = `${c.start.toFixed(1)}s`;
  $("endVal").textContent = `${end.toFixed(1)}s`;
  $("zoomVal").textContent = `${Math.round(c.zoom * 100)}%`;
  $("xVal").textContent = c.x.toFixed(2);
  $("yVal").textContent = c.y.toFixed(2);
  $("volVal").textContent = `${Math.round(c.volume * 100)}%`;
  layoutPreview();
}

// نفس حسبة FFmpeg: الصورة تملا الكادر، وبعدين زووم، وبعدين تحريك
function layoutPreview() {
  const c = mt.project?.data.clips[mt.selected];
  if (!c || !pv.videoWidth) return;
  const W = 216, H = 384;
  const cover = Math.max(W / pv.videoWidth, H / pv.videoHeight) * c.zoom;
  const dw = pv.videoWidth * cover, dh = pv.videoHeight * cover;
  Object.assign(pv.style, {
    width: `${dw}px`, height: `${dh}px`,
    left: `${-((dw - W) / 2) * (1 + c.x)}px`, top: `${-((dh - H) / 2) * (1 + c.y)}px`,
  });
}
pv.addEventListener("loadedmetadata", () => {
  layoutPreview();
  const c = mt.project?.data.clips[mt.selected];
  if (c) pv.currentTime = c.start;
});
pv.addEventListener("timeupdate", () => {
  const c = mt.project?.data.clips[mt.selected];
  const s = c && clipSource(c);
  if (s && pv.currentTime >= (c.end ?? s.duration)) pv.currentTime = c.start;
});

function editorInput(apply) {
  return () => {
    const c = mt.project.data.clips[mt.selected];
    if (!c) return;
    apply(c, clipSource(c));
    renderClipEditor();
    renderTimeline();
    renderSide();
    scheduleSave();
  };
}
$("edStart").addEventListener("input", editorInput((c, s) => {
  const end = c.end ?? s.duration;
  c.start = Math.min(Number($("edStart").value), end - 0.5);
  if (c.start < 0) c.start = 0;
  pv.currentTime = c.start;
}));
$("edEnd").addEventListener("input", editorInput((c, s) => {
  const v = Math.max(Number($("edEnd").value), c.start + 0.5);
  c.end = v >= s.duration - 0.05 ? null : v;
  pv.currentTime = Math.max(c.start, v - 1);
}));
$("edZoom").addEventListener("input", editorInput((c) => (c.zoom = Number($("edZoom").value) / 100)));
$("edX").addEventListener("input", editorInput((c) => (c.x = Number($("edX").value) / 100)));
$("edY").addEventListener("input", editorInput((c) => (c.y = Number($("edY").value) / 100)));
$("edVol").addEventListener("input", editorInput((c) => (c.volume = Number($("edVol").value) / 100)));
$("edReset").onclick = editorInput((c) => Object.assign(c, CLIP_DEFAULTS));
$("edPlay").onclick = () => {
  if (pv.paused) { pv.muted = false; pv.volume = Math.min(1, mt.project.data.clips[mt.selected].volume); pv.play(); }
  else pv.pause();
};
pv.addEventListener("play", () => ($("edPlay").textContent = "⏸ إيقاف"));
pv.addEventListener("pause", () => ($("edPlay").textContent = "▶︎ معاينة"));

// ---------- المدرب والصوت ----------
function renderSide() {
  const d = mt.project.data;
  const coach = mt.coaches.find((c) => c.id === d.coach_id);
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
    const track = mt.music.find((a) => a.id === d.music.id);
    const available = track ? track.duration - d.music.offset : 0;
    const total = totalLength();
    $("musicWarn").hidden = !track || available >= total;
    $("musicWarn").textContent = `⚠️ الموسيقى (${fmtDuration(Math.max(0, available))}) أقصر من الفيديو (${fmtDuration(total)})، فآخر الفيديو هيبقى من غير موسيقى.`;
  }
  $("renderBtn").disabled = d.clips.length === 0 || mt.project.render_status === "rendering";
}

function sideInput(apply) {
  return () => { apply(mt.project.data); renderSide(); renderTimeline(); scheduleSave(); };
}
$("mCoach").addEventListener("change", sideInput((d) => { d.coach_id = $("mCoach").value || null; renderBin(); }));
$("mOutro").addEventListener("change", sideInput((d) => (d.outro = $("mOutro").checked)));
$("mOutroVol").addEventListener("input", sideInput((d) => (d.outro_volume = $("mOutroVol").value / 100)));
$("mVoice").addEventListener("change", sideInput((d) => {
  d.voice = $("mVoice").value ? { id: $("mVoice").value, volume: d.voice?.volume ?? 1, delay: d.voice?.delay ?? 0, offset: 0, fade_out: false } : null;
}));
$("mVoiceVol").addEventListener("input", sideInput((d) => (d.voice.volume = $("mVoiceVol").value / 100)));
$("mVoiceDelay").addEventListener("change", sideInput((d) => (d.voice.delay = Math.max(0, Number($("mVoiceDelay").value) || 0))));
$("mMusic").addEventListener("change", sideInput((d) => {
  d.music = $("mMusic").value ? { id: $("mMusic").value, volume: d.music?.volume ?? 0.3, delay: 0, offset: 0, fade_out: d.music?.fade_out ?? true } : null;
}));
$("mMusicVol").addEventListener("input", sideInput((d) => (d.music.volume = $("mMusicVol").value / 100)));
$("mMusicOffset").addEventListener("change", sideInput((d) => (d.music.offset = Math.max(0, Number($("mMusicOffset").value) || 0))));
$("mMusicFade").addEventListener("change", sideInput((d) => (d.music.fade_out = $("mMusicFade").checked)));

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
      voice: draft.voice ? { id: draft.voice.id, volume: 1, delay: 0, offset: 0, fade_out: false } : null,
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
    // التعديلات (قص وزووم...) بتفضل على الفيديوهات اللي كانت موجودة
    const old = new Map(d.clips.map((c) => [c.gen_id, c]));
    d.clips = draft.gen_ids.map((gen_id) => old.get(gen_id) || { gen_id, ...CLIP_DEFAULTS });
    if (draft.voice && d.voice?.id !== draft.voice.id) {
      d.voice = { id: draft.voice.id, volume: d.voice?.volume ?? 1, delay: d.voice?.delay ?? 0, offset: 0, fade_out: false };
    }
    if (!d.coach_id) d.coach_id = draft.coach_id;
    $("mCoach").value = d.coach_id || "";
    mt.selected = -1;
    reportDraft(draft);
    changed();
  } catch (err) {
    toast(err.message, true);
  }
};

viewHooks["6"] = initMontage;
