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

  renderScript(f);

  $("goCut").disabled = !f.video;
  $("goGenerate").disabled = !f.video?.clips;
  $("goMontage").disabled = !f.video?.generated;
  $("goMontage").textContent = f.montage_project ? "🎬 افتح في المونتاج" : "🎬 اعمل المونتاج";
}

// ---------- السكريبت (نص التعليق الصوتي) ----------
const RE_TEXT = /\.(txt|md|srt)$/i;
const WORDS_PER_MIN = 140; // سرعة قراية الراوي تقريبًا

// بيقرا ملف التكست بأي ترميز شائع (UTF-8 أو UTF-16 أو ويندوز العربي)
async function readTextFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) text = new TextDecoder("utf-16le").decode(buf);
  else if (buf[0] === 0xfe && buf[1] === 0xff) text = new TextDecoder("utf-16be").decode(buf);
  else {
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { text = new TextDecoder("windows-1256").decode(buf); }
  }
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  // ملف ترجمة: نشيل الأرقام والتوقيتات ونسيب الكلام بس
  if (/\.srt$/i.test(file.name)) {
    text = text.split(/\n{2,}/).map((b) => b.split("\n")
      .filter((l) => !/^\d+$/.test(l.trim()) && !/-->/.test(l)).join(" ").trim())
      .filter(Boolean).join("\n");
  }
  return text.trim();
}

function scriptWords(text) { return (text.match(/\S+/g) || []).length; }

function scriptMeta(f, text) {
  const words = scriptWords(text);
  if (!words) return "";
  const secs = Math.round((words / WORDS_PER_MIN) * 60);
  const parts = [`${words} كلمة`, `قراية تقريبًا ${fmtDuration(secs)}`];
  if (f.voice) parts.push(`التسجيل الحالي ${fmtDuration(f.voice.duration)}`);
  return parts.map((p) => `<span>${p}</span>`).join("·");
}

const scriptState = { folder: null, saved: "", dirty: false };

function renderScript(f) {
  const el = $("elScript");
  // متمسحش اللي بتكتبه لو الصفحة اتحدّثت وانت لسه محفظتش
  if (scriptState.folder === f.id && scriptState.dirty && el.querySelector("textarea")) return;
  scriptState.folder = f.id;
  scriptState.saved = f.script || "";
  scriptState.dirty = false;
  el.innerHTML = `<h3>📝 السكريبت</h3>
    <div class="muted">النص اللي الراوي بيقراه. لو حبيت تغيّر صوت الراوي بعدين، ده النص اللي هيتسجّل بيه.</div>
    <textarea id="scriptText" dir="auto" placeholder="اكتب أو الزق السكريبت هنا، أو ارفع ملف تكست (.txt)"></textarea>
    <div class="script-meta" id="scriptMeta"></div>
    <div class="row wrap">
      <button class="btn sm primary" id="scriptSave" disabled>💾 احفظ السكريبت</button>
      <label class="btn sm">📄 ارفع ملف تكست<input type="file" id="scriptFile" accept=".txt,.md,.srt,text/plain" hidden></label>
      <button class="btn sm" id="scriptCopy" ${f.script ? "" : "disabled"}>📋 انسخ</button>
      <button class="btn sm" id="scriptDownload" ${f.script ? "" : "disabled"}>⬇ نزّله ملف</button>
    </div>`;
  $("scriptText").value = scriptState.saved;
  updateScriptMeta();
}

function updateScriptMeta() {
  const f = fol.current;
  const text = $("scriptText").value;
  scriptState.dirty = text.trim() !== scriptState.saved.trim();
  $("scriptSave").disabled = !scriptState.dirty;
  $("scriptMeta").innerHTML = scriptMeta(f, text) + (scriptState.dirty ? `<span class="dirty">● متعدّل ومتحفظش</span>` : "");
}

async function saveScript() {
  const text = $("scriptText").value.trim();
  const id = scriptState.folder;
  scriptState.dirty = false;
  try {
    const f = await api(`/api/folders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: text }),
    });
    // لو فتحت مشروع تاني وهو بيحفظ، متغيّرش المشروع اللي قدامك
    if (fol.current?.id === id) {
      fol.current = f;
      scriptState.saved = f.script || "";
      updateScriptMeta();
      $("scriptCopy").disabled = $("scriptDownload").disabled = !f.script;
    }
    const i = fol.list.findIndex((x) => x.id === id);
    if (i >= 0) fol.list[i] = f;
    toast(text ? "✅ السكريبت اتحفظ" : "السكريبت اتمسح");
  } catch (err) {
    if (scriptState.folder === id) scriptState.dirty = true;
    toast(err.message, true);
  }
}

$("elScript").addEventListener("input", (e) => { if (e.target.id === "scriptText") updateScriptMeta(); });
// بيتحفظ لوحده لما تخرج من خانة الكتابة، عشان لو فتحت مشروع تاني ميضيعش
$("elScript").addEventListener("focusout", (e) => { if (e.target.id === "scriptText" && scriptState.dirty) saveScript(); });
$("elScript").addEventListener("keydown", (e) => {
  if (e.target.id === "scriptText" && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (scriptState.dirty) saveScript();
  }
});
$("elScript").addEventListener("change", async (e) => {
  if (e.target.id !== "scriptFile") return;
  e.stopPropagation(); // متتعاملش كأنه رفع فيديو أو صوت
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const text = await readTextFile(file);
    if (!text) return toast("الملف فاضي", true);
    if (scriptState.saved && !confirm("ده هيبدّل السكريبت الحالي بالملف الجديد. تكمّل؟")) return;
    $("scriptText").value = text;
    await saveScript();
  } catch (err) {
    toast(err.message, true);
  }
});
$("elScript").addEventListener("click", async (e) => {
  const id = e.target.closest("button")?.id;
  if (id === "scriptSave" && scriptState.dirty) saveScript();
  if (id === "scriptCopy") {
    try { await navigator.clipboard.writeText($("scriptText").value); toast("📋 اتنسخ"); }
    catch { $("scriptText").select(); document.execCommand("copy"); toast("📋 اتنسخ"); }
  }
  if (id === "scriptDownload") {
    const blob = new Blob(["\uFEFF" + $("scriptText").value], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fol.current.name} - script.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
});

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
$("goGenerate").onclick = () => openGenerateWith(fol.current.video.id, fol.current.coach?.id || null);
$("goMontage").onclick = async () => {
  try {
    await openMontageForVideo(fol.current.video.id);   // لو اتولّد بأكتر من مدرب بيسأل أنهي واحد
  } catch (err) {
    toast(err.message, true);
  }
};

viewHooks["0"] = loadFolders;

// ---------- رفع فولدرات كاملة ----------
const fup = { rows: [], busy: false };
const RE_VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i;
const RE_AUDIO = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i;
const RE_IMAGE = /\.(png|jpe?g|webp)$/i;
const RE_OUTRO = /(outro|اوترو|أوترو|إوترو)/i;
const IGNORE = /(^\.|thumbs\.db$|desktop\.ini$)/i;

function mb(f) { return f.size < 1048576 ? `${Math.max(1, Math.round(f.size / 1024))}KB` : `${(f.size / 1048576).toFixed(1)}MB`; }

// items: [{file, path}] والـ path بيبدأ باسم الفولدر اللي اتختار
function groupIntoProjects(items) {
  const groups = new Map();
  for (const { file, path } of items) {
    const parts = path.split("/").filter(Boolean);
    if (IGNORE.test(parts[parts.length - 1])) continue;
    // ملف جوه فولدر فرعي = مشروع الفولدر الفرعي، ملف في الفولدر الرئيسي = مشروع الفولدر الرئيسي
    const name = parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[0] : file.name.replace(/\.[^.]+$/, "");
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(file);
  }
  const rows = [];
  for (const [name, files] of groups) {
    const videos = files.filter((f) => RE_VIDEO.test(f.name));
    const outros = videos.filter((f) => RE_OUTRO.test(f.name));
    const raws = videos.filter((f) => !RE_OUTRO.test(f.name)).sort((a, b) => b.size - a.size);
    const audios = files.filter((f) => RE_AUDIO.test(f.name)).sort((a, b) => b.size - a.size);
    const images = files.filter((f) => RE_IMAGE.test(f.name));
    // السكريبت: ملف التكست (الأكبر لو فيه كذا واحد، والـ txt قبل الترجمة)
    const texts = files.filter((f) => RE_TEXT.test(f.name))
      .sort((a, b) => (/\.srt$/i.test(a.name) - /\.srt$/i.test(b.name)) || b.size - a.size);
    if (!raws.length && !audios.length && !images.length && !texts.length) continue;
    const notes = [];
    if (raws.length > 1) notes.push(`فيه ${raws.length} فيديوهات، هاخد الأكبر`);
    if (audios.length > 1) notes.push(`فيه ${audios.length} ملفات صوت، هاخد الأكبر`);
    if (texts.length > 1) notes.push(`فيه ${texts.length} ملفات تكست، هاخد الأكبر`);
    const image = images[0] || null;
    const key = image ? matchKey(image.name) : "";
    const existingCoach = key ? coachState.list.find((c) => matchKey(c.name) === key) || fol.coaches.find((c) => matchKey(c.name) === key) : null;
    const existingFolder = fol.list.find((f) => f.name.trim() === name.trim());
    rows.push({
      name, video: raws[0] || null, voice: audios[0] || null, image, notes,
      script: texts[0] || null, scriptText: "",
      files: {
        video: [...raws, ...outros],
        voice: audios,
        image: images,
        script: texts,
      },
      // coach: "" = من غير مدرب، "new" = مدرب جديد من الصورة، أو id مدرب موجود
      coach: existingCoach ? existingCoach.id : image ? "new" : "",
      newCoachName: image ? (key ? niceName(image.name) : `مدرب ${name}`) : "",
      existingFolderId: existingFolder?.id || null,
      preview: image ? URL.createObjectURL(image) : null,
      status: "",
    });
  }
  return rows;
}

const SLOT_LABEL = { video: "الفيديو الخام", voice: "التعليق الصوتي", image: "صورة المدرب", script: "السكريبت" };

async function loadRowScript(r) {
  try { r.scriptText = r.script ? await readTextFile(r.script) : ""; }
  catch { r.scriptText = ""; }
}

function slotSelect(r, slot) {
  const files = r.files[slot];
  const cur = r[slot];
  if (!files.length) return `<span class="muted">مفيش في الفولدر</span>`;
  const opts = `<option value="">— مفيش —</option>` + files
    .map((f, i) => `<option value="${i}" ${cur === f ? "selected" : ""}>${escapeHtml(f.name)} (${mb(f)})</option>`)
    .join("");
  return `<div class="slot"><select data-slot="${slot}">${opts}</select>
    ${cur ? `<button type="button" class="btn sm" data-preview="${slot}" title="شوف/اسمع">👁</button>` : ""}</div>`;
}

function coachOutroNote(r) {
  if (!r.coach || r.coach === "new") return "";
  const c = fol.coaches.find((x) => x.id === r.coach);
  return c?.outro_url ? `<div class="muted">🎬 الأوترو: بتاع ${escapeHtml(c.name)}</div>` : `<div class="warn-text">⚠️ المدرب ده مالوش أوترو</div>`;
}

function renderFup() {
  $("fupEmpty").hidden = fup.rows.length > 0;
  const coaches = fol.coaches;
  $("fupRows").innerHTML = fup.rows
    .map((r, i) => {
      const coachOpts = `<option value="">— من غير مدرب —</option>` +
        (r.image ? `<option value="new" ${r.coach === "new" ? "selected" : ""}>＋ مدرب جديد من الصورة</option>` : "") +
        coaches.map((c) => `<option value="${c.id}" ${r.coach === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
      return `<tr data-i="${i}" class="${r.status === "done" ? "done" : ""}">
        <td><input type="text" data-f="name" value="${escapeHtml(r.name)}">
          ${r.existingFolderId ? `<div class="warn-text">مشروع بالاسم ده موجود، هيتحدّث</div>` : ""}
          ${r.status && r.status !== "done" ? `<div class="${r.status.startsWith("✕") ? "err" : "muted"}">${escapeHtml(r.status)}</div>` : ""}</td>
        <td>${slotSelect(r, "video")}</td>
        <td>${slotSelect(r, "voice")}
          <div class="slot-label">📝 السكريبت</div>${slotSelect(r, "script")}
          ${r.scriptText ? `<div class="fup-script" dir="auto" title="${escapeHtml(r.scriptText.slice(0, 300))}">${escapeHtml(r.scriptText.slice(0, 80))}</div>
            <div class="muted">${scriptWords(r.scriptText)} كلمة</div>` : ""}</td>
        <td class="fup-coach">
          ${r.preview ? `<img src="${r.preview}" alt="">` : ""}
          <div class="slot-label">🖼️ الصورة</div>${slotSelect(r, "image")}
          <div class="slot-label">🧑‍🏫 المدرب</div><select data-f="coach">${coachOpts}</select>
          ${r.coach === "new" ? `<input type="text" data-f="newCoachName" value="${escapeHtml(r.newCoachName)}" placeholder="اسم المدرب">
            <div class="muted">مدرب جديد من غير أوترو. ضيفه بعدين من صفحة المدربين</div>` : ""}
          ${coachOutroNote(r)}</td>
        <td>${r.status === "done" ? "✅" : `<button class="btn sm danger" data-f="remove" title="متترفعش">✕</button>`}</td>
      </tr>`;
    })
    .join("");
  const pending = fup.rows.filter((r) => r.status !== "done");
  $("fupUpload").disabled = fup.busy || !pending.length || pending.some((r) =>
    !r.name.trim() || (r.coach === "new" && (!r.newCoachName.trim() || !r.image)));
  $("fupUpload").textContent = `⬆ ارفع ${pending.length} مشروع`;
  $("fupCount").textContent = `${fup.rows.length} مشروع في القايمة`;
}

async function openFolderUpload(items, append = false) {
  if (!coachState.list.length) await loadCoaches().catch(() => {});
  fol.coaches = await api("/api/coaches");
  const rows = groupIntoProjects(items);
  await Promise.all(rows.map(loadRowScript));
  if (append) {
    // لو نفس الفولدر اتضاف تاني، الجديد بياخد مكانه
    const names = new Set(rows.map((r) => r.name));
    fup.rows = [...fup.rows.filter((r) => r.status === "done" || !names.has(r.name)), ...rows];
    renderFup();
    toast(`＋ اتضاف ${rows.length} مشروع`);
    return;
  }
  fup.rows = rows;
  $("fupProgress").textContent = "";
  $("fupBar").hidden = true;
  renderFup();
  $("fupDialog").showModal();
}

$("folderUpload").addEventListener("change", (e) => {
  const items = [...e.target.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
  e.target.value = "";
  if (items.length) openFolderUpload(items);
});

$("fupAdd").addEventListener("change", (e) => {
  const items = [...e.target.files].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
  e.target.value = "";
  if (items.length) openFolderUpload(items, true);
});

// سحب الفولدرات وحطها على الزرار
async function readEntry(entry, path, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, path: `${path}${file.name}` });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let batch;
    do {
      batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const child of batch) await readEntry(child, `${path}${entry.name}/`, out);
    } while (batch.length);
  }
}
async function droppedItems(e) {
  const entries = [...e.dataTransfer.items].map((it) => it.webkitGetAsEntry?.()).filter(Boolean);
  const items = [];
  // لو اتسحبت فولدرات كتير مع بعض، كل واحد فيهم مشروع
  const multi = entries.filter((en) => en.isDirectory).length > 1;
  for (const en of entries) await readEntry(en, multi ? "_/" : "", items);
  return items;
}
for (const [id, append] of [["folderDrop", false], ["fupAddDrop", true]]) {
  const el = $(id);
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("over"); });
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove("over");
    const items = await droppedItems(e);
    if (items.length) openFolderUpload(items, append);
  });
}

$("fupRows").addEventListener("input", (e) => {
  const r = fup.rows[Number(e.target.closest("tr").dataset.i)];
  if (e.target.dataset.f === "name") { r.name = e.target.value; r.existingFolderId = fol.list.find((f) => f.name.trim() === r.name.trim())?.id || null; }
  if (e.target.dataset.f === "newCoachName") r.newCoachName = e.target.value;
  $("fupUpload").disabled = false;
  const btnState = fup.rows.filter((x) => x.status !== "done").some((x) => !x.name.trim() || (x.coach === "new" && !x.newCoachName.trim()));
  $("fupUpload").disabled = fup.busy || btnState;
});
$("fupRows").addEventListener("change", async (e) => {
  const r = fup.rows[Number(e.target.closest("tr").dataset.i)];
  const slot = e.target.dataset.slot;
  if (slot) {
    const file = e.target.value === "" ? null : r.files[slot][Number(e.target.value)];
    r[slot] = file;
    if (slot === "script") await loadRowScript(r);
    if (slot === "image") {
      if (r.preview) URL.revokeObjectURL(r.preview);
      r.preview = file ? URL.createObjectURL(file) : null;
      const key = file ? matchKey(file.name) : "";
      const match = key ? fol.coaches.find((c) => matchKey(c.name) === key) : null;
      if (match) r.coach = match.id;
      else if (!file && r.coach === "new") r.coach = "";
      else if (file && !r.coach) { r.coach = "new"; r.newCoachName = key ? niceName(file.name) : `مدرب ${r.name}`; }
    }
  }
  if (e.target.dataset.f === "coach") r.coach = e.target.value;
  renderFup();
});

// معاينة الملف قبل ما تختاره
$("fupRows").addEventListener("click", (e) => {
  const b = e.target.closest("[data-preview]");
  if (!b) return;
  const r = fup.rows[Number(b.closest("tr").dataset.i)];
  const file = r[b.dataset.preview];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const dlg = document.createElement("dialog");
  dlg.className = b.dataset.preview === "script" ? "outro-dlg script-dlg" : "outro-dlg";
  const media = b.dataset.preview === "script"
    ? `<div dir="auto" style="white-space:pre-wrap;max-height:60vh;overflow:auto;line-height:1.8;padding:8px 2px">${escapeHtml(r.scriptText || "")}</div>`
    : RE_IMAGE.test(file.name)
    ? `<img src="${url}" alt="" style="max-width:100%;max-height:70vh;display:block;border-radius:8px">`
    : RE_AUDIO.test(file.name) ? `<audio src="${url}" controls autoplay style="width:100%"></audio>`
    : `<video src="${url}" controls autoplay playsinline></video>`;
  dlg.innerHTML = `<div class="el-title">${SLOT_LABEL[b.dataset.preview]}: ${escapeHtml(file.name)}</div>${media}
    <div class="row gap-top"><button class="btn sm">إغلاق</button></div>`;
  dlg.querySelector("button").onclick = () => dlg.close();
  dlg.addEventListener("close", () => { URL.revokeObjectURL(url); dlg.remove(); });
  document.body.appendChild(dlg);
  dlg.showModal();
});
$("fupRows").addEventListener("click", (e) => {
  if (e.target.closest("[data-f=remove]")) { fup.rows.splice(Number(e.target.closest("tr").dataset.i), 1); renderFup(); }
});
$("fupClose").onclick = () => { if (!fup.busy) $("fupDialog").close(); };

$("fupUpload").onclick = async () => {
  fup.busy = true;
  renderFup();
  const bar = $("fupBar");
  const rows = fup.rows.filter((r) => r.status !== "done");
  const newCoaches = new Map(); // نفس المدرب الجديد لو اتكرر في كذا فولدر يتعمل مرة واحدة
  for (const [n, r] of rows.entries()) {
    const label = `${n + 1} من ${rows.length}: ${r.name}`;
    const step = (s) => { r.status = s; $("fupProgress").textContent = `⏳ ${label} · ${s}`; renderFup(); };
    try {
      step("بيعمل المشروع...");
      let folder = r.existingFolderId
        ? fol.list.find((f) => f.id === r.existingFolderId)
        : await api("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: r.name.trim() }) });
      if (r.video) {
        step(`بيرفع الفيديو (${mb(r.video)})...`);
        const form = new FormData();
        form.append("file", r.video);
        folder = await uploadWithProgress(`/api/folders/${folder.id}/video`, form, bar);
      }
      if (r.voice) {
        step("بيرفع التعليق الصوتي...");
        const form = new FormData();
        form.append("file", r.voice);
        folder = await uploadWithProgress(`/api/folders/${folder.id}/voice`, form, bar);
      }
      if (r.script && r.scriptText) {
        step("بيحفظ السكريبت...");
        await api(`/api/folders/${folder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: r.scriptText }) });
      }
      let coachId = r.coach && r.coach !== "new" ? r.coach : null;
      if (r.coach === "new") {
        const cname = r.newCoachName.trim();
        coachId = newCoaches.get(cname) || fol.coaches.find((c) => c.name.trim() === cname)?.id || null;
        if (!coachId) {
          step("بيعمل المدرب...");
          const form = new FormData();
          form.append("name", cname);
          form.append("image", r.image);
          coachId = (await api("/api/coaches", { method: "POST", body: form })).id;
          newCoaches.set(cname, coachId);
        }
      }
      if (coachId) {
        await api(`/api/folders/${folder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coach_id: coachId }) });
      }
      r.status = "done";
    } catch (err) {
      r.status = `✕ ${err.message}`;
    }
    renderFup();
  }
  fup.busy = false;
  await loadFolders();
  const failed = fup.rows.filter((r) => r.status !== "done").length;
  $("fupProgress").textContent = failed ? `✅ ${rows.length - failed} تمام · ✕ ${failed} فشلوا، صلّح ودوس ارفع تاني` : "";
  renderFup();
  if (!failed) {
    $("fupDialog").close();
    toast(`✅ اترفع ${rows.length} مشروع`);
  }
};
