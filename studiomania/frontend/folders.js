// StudioMania — المشاريع: كل مشروع فولدر فيه الفيديو الخام والتعليق الصوتي والمدرب

const fol = { list: [], current: null, voices: [], coaches: [], query: "" };

async function loadFolders() {
  [fol.list, fol.voices, fol.coaches] = await Promise.all([
    api("/api/folders"), api("/api/audio?kind=voice"), api("/api/coaches"),
  ]);
  if (fol.current) fol.current = fol.list.find((f) => f.id === fol.current.id) || null;
  renderFolders();
}

function folderBadges(f) {
  const b = [];
  if (f.video?.clips) b.push(`✂️ ${f.video.clips} قطعة`);
  if (f.video?.clips) b.push(`✨ ${f.video.generated}/${f.video.clips} اتولّد`);
  if (f.exported) b.push("🎬 اتصدّر");
  return b;
}

function renderFolders() {
  const q = fol.query.trim().toLowerCase();
  const list = fol.list.filter((f) => !q || f.name.toLowerCase().includes(q));
  $("folderCount").textContent = fol.list.length ? `(${fol.list.length})` : "";
  $("foldersEmpty").hidden = fol.list.length > 0;
  $("folderList").innerHTML = list
    .map((f) => `<li data-id="${f.id}" class="${fol.current?.id === f.id ? "active" : ""}">
      <div class="fname">📁 ${escapeHtml(f.name)}</div>
      <div class="fparts">
        <span class="${f.video ? "ok" : "miss"}">🎬 ${f.video ? "فيديو" : "مفيش فيديو"}</span>
        <span class="${f.voice ? "ok" : "miss"}">🎙️ ${f.voice ? "صوت" : "مفيش صوت"}</span>
        <span class="${f.coach ? "ok" : "miss"}">🧑‍🏫 ${f.coach ? escapeHtml(f.coach.name) : "مفيش مدرب"}</span>
      </div>
      ${folderBadges(f).length ? `<div class="fbadges">${folderBadges(f).map((x) => `<span class="badge">${x}</span>`).join("")}</div>` : ""}
    </li>`)
    .join("");
  renderFolderDetail();
}

$("folderList").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  fol.current = fol.list.find((f) => f.id === li.dataset.id);
  renderFolders();
});
$("folderSearch").addEventListener("input", (e) => { fol.query = e.target.value; renderFolders(); });

$("newFolderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("newFolderName").value.trim();
  if (!name) return;
  if (fol.list.some((f) => f.name.trim() === name) && !confirm("فيه مشروع بنفس الاسم. تعمل واحد تاني؟")) return;
  try {
    const f = await api("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    $("newFolderName").value = "";
    fol.current = f;
    await loadFolders();
    toast("✅ المشروع اتعمل. ارفع الفيديو والتعليق الصوتي واختار المدرب");
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- تفاصيل المشروع ----------
function renderFolderDetail() {
  const f = fol.current;
  $("folderDetail").hidden = !f;
  $("folderPlaceholder").hidden = !!f;
  if (!f) return;
  if (document.activeElement !== $("folderName")) $("folderName").value = f.name;
  const steps = [
    ["الفيديو", !!f.video], ["الصوت", !!f.voice], ["المدرب", !!f.coach],
    ["التقطيع", !!f.video?.clips], ["التوليد", f.video?.clips > 0 && f.video.generated === f.video.clips], ["التصدير", !!f.exported],
  ];
  $("folderProgress").innerHTML = steps.map(([t, ok]) => `<span class="${ok ? "ok" : ""}">${ok ? "✓" : "○"} ${t}</span>`).join("");

  // الفيديو الخام
  $("elVideo").innerHTML = `<h3>🎬 الفيديو الخام</h3>` + (f.video
    ? `<video src="${f.video.url}" controls preload="metadata" playsinline></video>
       <div class="muted">${fmtDuration(f.video.duration)}${f.video.clips ? ` · ${f.video.clips} قطعة` : " · لسه متقطّعش"}</div>
       <div class="row wrap">
         <label class="btn sm">🔄 بدّل الفيديو<input type="file" data-up="video" accept="video/*,.mkv" hidden></label>
         <button class="btn sm danger" data-del="video">🗑️ احذف</button>
       </div>`
    : `<div class="el-empty">مفيش فيديو لسه</div>
       <label class="btn primary sm">⬆ ارفع الفيديو الخام<input type="file" data-up="video" accept="video/*,.mkv" hidden></label>`)
    + `<div class="bar el-bar" hidden><i></i></div>`;

  // التعليق الصوتي
  const voiceOpts = `<option value="">— اختار من المكتبة —</option>` + fol.voices
    .map((a) => `<option value="${a.id}" ${f.voice?.id === a.id ? "selected" : ""}>${escapeHtml(a.name)} (${fmtDuration(a.duration)})</option>`).join("");
  $("elVoice").innerHTML = `<h3>🎙️ التعليق الصوتي</h3>` + (f.voice
    ? `<audio src="${f.voice.url}" controls preload="none"></audio>
       <div class="el-title">${escapeHtml(f.voice.name)} <span class="muted">${fmtDuration(f.voice.duration)}</span></div>
       ${f.video && Math.abs(f.voice.duration - f.video.duration) > 2 ? `<div class="warn-text">⚠️ طوله مختلف عن الفيديو (${fmtDuration(f.video.duration)})</div>` : ""}`
    : `<div class="el-empty">مفيش تعليق صوتي لسه</div>`)
    + `<div class="row wrap">
         <label class="btn sm ${f.voice ? "" : "primary"}">${f.voice ? "🔄 بدّل: ارفع تسجيل" : "⬆ ارفع تسجيل"}<input type="file" data-up="voice" accept=".mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,audio/*" hidden></label>
         ${f.voice ? `<button class="btn sm danger" data-del="voice">✕ شيله</button>` : ""}
       </div>
       <select data-pick="voice">${voiceOpts}</select>
       <div class="bar el-bar" hidden><i></i></div>`;

  // المدرب
  const coachOpts = `<option value="">— اختار مدرب —</option>` + fol.coaches
    .map((c) => `<option value="${c.id}" ${f.coach?.id === c.id ? "selected" : ""}>${escapeHtml(c.name)}${c.outro_url ? "" : " (من غير أوترو)"}</option>`).join("");
  $("elCoach").innerHTML = `<h3>🧑‍🏫 المدرب</h3>` + (f.coach
    ? `<img class="el-coach" src="${f.coach.image_url}" alt="">
       <div class="el-title">${escapeHtml(f.coach.name)}</div>
       <div class="${f.coach.outro_url ? "muted" : "warn-text"}">${f.coach.outro_url ? `🎬 أوترو ${fmtDuration(f.coach.outro_duration)}` : "⚠️ مالوش أوترو"}</div>
       ${f.coach.outro_url ? `<details><summary>شوف الأوترو</summary><video src="${f.coach.outro_url}" controls preload="none" playsinline></video></details>` : ""}`
    : `<div class="el-empty">مفيش مدرب لسه</div>`)
    + `<select data-pick="coach">${coachOpts}</select>
       <div class="row wrap">
         ${f.coach ? `<button class="btn sm danger" data-del="coach">✕ شيله</button>` : ""}
         <a href="#" class="btn sm" data-goto="4">＋ ضيف مدرب جديد</a>
       </div>`;

  $("goCut").disabled = !f.video;
  $("goGenerate").disabled = !f.video?.clips;
  $("goMontage").disabled = !f.video?.generated;
  $("goMontage").textContent = f.montage_project ? "🎬 افتح في المونتاج" : "🎬 اعمل المونتاج";
}

async function patchFolder(changes, msg) {
  try {
    fol.current = await api(`/api/folders/${fol.current.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
    });
    await loadFolders();
    if (msg) toast(msg);
  } catch (err) {
    toast(err.message, true);
  }
}

$("folderName").addEventListener("change", () => {
  const name = $("folderName").value.trim();
  if (name && name !== fol.current.name) patchFolder({ name }, "✅ الاسم اتغيّر (وده اسم الفيديو النهائي)");
});
$("folderName").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

// رفع بشريط تقدّم (الفيديوهات ممكن تبقى كبيرة)
function uploadWithProgress(url, form, bar) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    bar.hidden = false;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) bar.querySelector("i").style.width = `${(e.loaded / e.total) * 100}%`; };
    xhr.onload = () => {
      bar.hidden = true;
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 401) location.href = "/login";
      xhr.status < 300 ? resolve(data) : reject(new Error(data.detail || `خطأ ${xhr.status}`));
    };
    xhr.onerror = () => { bar.hidden = true; reject(new Error("الاتصال اتقطع")); };
    xhr.send(form);
  });
}

$("folderDetail").addEventListener("change", async (e) => {
  const up = e.target.dataset.up;
  const pick = e.target.dataset.pick;
  if (up) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (up === "video" && fol.current.video?.clips &&
        !confirm("تبديل الفيديو هيمسح الفيديو القديم والتقطيع بتاعه. الفيديوهات اللي اتولّدت قبل كده هتفضل موجودة. تكمّل؟")) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const bar = e.target.closest(".element").querySelector(".el-bar");
      fol.current = await uploadWithProgress(`/api/folders/${fol.current.id}/${up}`, form, bar);
      await loadFolders();
      toast(up === "video" ? "✅ الفيديو اترفع. قطّعه من «افتح في التقطيع»" : "✅ التعليق الصوتي اترفع");
    } catch (err) {
      toast(err.message, true);
    }
  }
  if (pick === "voice") patchFolder({ voice_id: e.target.value || null }, "✅ التعليق الصوتي اتغيّر");
  if (pick === "coach") patchFolder({ coach_id: e.target.value || null }, "✅ المدرب اتغيّر");
});

$("folderDetail").addEventListener("click", async (e) => {
  const del = e.target.closest("[data-del]")?.dataset.del;
  if (!del) return;
  const f = fol.current;
  if (del === "video") {
    if (!confirm("حذف الفيديو الخام والتقطيع بتاعه؟")) return;
    try {
      fol.current = await api(`/api/folders/${f.id}/video`, { method: "DELETE" });
      await loadFolders();
    } catch (err) { toast(err.message, true); }
  }
  if (del === "voice") patchFolder({ voice_id: null }, "اتشال من المشروع (لسه موجود في مكتبة التعليق الصوتي)");
  if (del === "coach") patchFolder({ coach_id: null }, "اتشال من المشروع (لسه موجود في المدربين)");
});

$("folderDelete").onclick = async () => {
  const f = fol.current;
  if (!confirm(`حذف المشروع "${f.name}" والفيديو الخام بتاعه؟\nالتعليق الصوتي والمدرب هيفضلوا في مكتباتهم، والفيديوهات اللي اتصدّرت هتفضل في فولدر الجاهز.`)) return;
  await api(`/api/folders/${f.id}`, { method: "DELETE" });
  fol.current = null;
  await loadFolders();
};

// ---------- التنقل للخطوات ----------
$("goCut").onclick = async () => {
  const id = fol.current.video.id;
  showStep("1");
  await loadVideos();
  openVideo(id);
};
$("goGenerate").onclick = () => {
  const vid = fol.current.video.id;
  const coachId = fol.current.coach?.id;
  showStep("2");
  // نختار قطع الفيديو ده والمدرب بتاعه لوحدهم
  const wait = setInterval(() => {
    if (!gen.clips.length) return;
    clearInterval(wait);
    gen.selected = new Set(gen.clips.filter((c) => c.video_id === vid && c.duration >= 2).map((c) => c.id));
    if (coachId) gen.coachId = coachId;
    document.querySelectorAll(".coach-pick").forEach((x) => x.classList.toggle("selected", x.dataset.id === gen.coachId));
    renderClipPicker();
  }, 150);
  setTimeout(() => clearInterval(wait), 5000);
};
$("goMontage").onclick = async () => {
  const f = fol.current;
  try {
    let pid = f.montage_project;
    if (!pid) {
      const draft = await api(`/api/videos/${f.video.id}/montage-draft`);
      const p = await api("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name, video_id: f.video.id, coach_id: draft.coach_id,
          clips: draft.gen_ids.map((gen_id) => ({ gen_id, start: 0, end: null, zoom: 1, x: 0, y: 0, volume: 1 })),
          voice: draft.voice ? { id: draft.voice.id, volume: 1, delay: 0, offset: 0, fade_out: false } : null,
          music: null, outro: true, outro_volume: 1,
        }),
      });
      pid = p.id;
      if (draft.missing.length) toast(`لسه ${draft.missing.length} قطعة متولّدتش. دوس «حدّث من الفيديو» لما يخلصوا`, true);
    }
    storageSet("studiomania.projectId", pid);
    mt.project = null;
    showStep("6");
  } catch (err) {
    toast(err.message, true);
  }
};

viewHooks["0"] = loadFolders;
