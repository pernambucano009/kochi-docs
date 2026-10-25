// StudioMania — المشاريع: كل مشروع فولدر فيه الفيديو الخام والتعليق الصوتي والشخصية

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
  if (f.video?.clips) b.push(`✨ ${f.video.generated}/${f.video.clips} وُلّد`);
  if (f.exported) b.push("🎬 صُدّر");
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
        <span class="${f.video ? "ok" : "miss"}">🎬 ${f.video ? "فيديو" : "لا يوجد فيديو"}</span>
        <span class="${f.voice ? "ok" : "miss"}">🎙️ ${f.voice ? "صوت" : "لا يوجد صوت"}</span>
        <span class="${f.coach ? "ok" : "miss"}">🧍 ${f.coach ? escapeHtml(f.coach.name) : "لا يوجد شخصية"}</span>
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
  if (fol.list.some((f) => f.name.trim() === name) && !(await uiConfirm("فيه مشروع بنفس الاسم. تعمل واحد آخر؟"))) return;
  try {
    const f = await api("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    $("newFolderName").value = "";
    fol.current = f;
    await loadFolders();
    toast("✅ المشروع أُنشئ. ارفع الفيديو والتعليق الصوتي واختر الشخصية");
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
    ["الفيديو", !!f.video], ["الصوت", !!f.voice], ["الشخصية", !!f.coach],
    ["التقطيع", !!f.video?.clips], ["التوليد", f.video?.clips > 0 && f.video.generated === f.video.clips], ["التصدير", !!f.exported],
  ];
  $("folderProgress").innerHTML = steps.map(([t, ok]) => `<span class="${ok ? "ok" : ""}">${ok ? "✓" : "○"} ${t}</span>`).join("");

  // الفيديو الخام
  $("elVideo").innerHTML = `<h3>🎬 الفيديو الخام</h3>` + (f.video
    ? `<video src="${f.video.url}" controls preload="metadata" playsinline></video>
       <div class="muted">${fmtDuration(f.video.duration)}${f.video.clips ? ` · ${f.video.clips} قطعة` : " · ما زال لم يُقطّع"}</div>
       <div class="row wrap">
         <label class="btn sm">🔄 بدّل الفيديو<input type="file" data-up="video" accept="video/*,.mkv" hidden></label>
         <button class="btn sm danger" data-del="video">🗑️ احذف</button>
       </div>`
    : `<div class="el-empty">لا يوجد فيديو ما زال</div>
       <label class="btn primary sm">⬆ ارفع الفيديو الخام<input type="file" data-up="video" accept="video/*,.mkv" hidden></label>`)
    + `<div class="bar el-bar" hidden><i></i></div>`;

  // التعليق الصوتي
  const voiceOpts = `<option value="">— اختر من المكتبة —</option>` + fol.voices
    .map((a) => `<option value="${a.id}" ${f.voice?.id === a.id ? "selected" : ""}>${escapeHtml(a.name)} (${fmtDuration(a.duration)})</option>`).join("");
  $("elVoice").innerHTML = `<h3>🎙️ التعليق الصوتي</h3>` + (f.voice
    ? `<audio src="${f.voice.url}" controls preload="metadata"></audio>
       <div class="el-title">${escapeHtml(f.voice.name)} <span class="muted">${fmtDuration(f.voice.duration)}</span></div>
       ${f.video && Math.abs(f.voice.duration - f.video.duration) > 2 ? `<div class="warn-text">⚠️ طوله مختلف عن الفيديو (${fmtDuration(f.video.duration)})</div>` : ""}`
    : `<div class="el-empty">لا يوجد تعليق صوتي ما زال</div>`)
    + `<div class="row wrap">
         <label class="btn sm ${f.voice ? "" : "primary"}">${f.voice ? "🔄 بدّل: ارفع تسجيل" : "⬆ ارفع تسجيل"}<input type="file" data-up="voice" accept=".mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,audio/*" hidden></label>
         ${f.voice ? `<button class="btn sm danger" data-del="voice">✕ أزله</button>` : ""}
       </div>
       <select data-pick="voice">${voiceOpts}</select>
       <div class="bar el-bar" hidden><i></i></div>`;

  // الشخصية
  const coachOpts = `<option value="">— اختر شخصية —</option>` + fol.coaches
    .map((c) => `<option value="${c.id}" ${f.coach?.id === c.id ? "selected" : ""}>${escapeHtml(c.name)}${c.outro_url ? "" : " (بدون أوترو)"}</option>`).join("");
  $("elCoach").innerHTML = `<h3>🧍 الشخصية</h3>` + (f.coach
    ? `<img class="el-coach" src="${f.coach.image_url}" alt="">
       <div class="el-title">${escapeHtml(f.coach.name)}</div>
       <div class="${f.coach.outro_url ? "muted" : "warn-text"}">${f.coach.outro_url ? `🎬 أوترو ${fmtDuration(f.coach.outro_duration)}` : "⚠️ ليس له أوترو"}</div>
       ${f.coach.outro_url ? `<details><summary>انظر الأوترو</summary><video src="${f.coach.outro_url}" controls preload="none" playsinline></video></details>` : ""}`
    : `<div class="el-empty">لا يوجد شخصية ما زال</div>`)
    + `<select data-pick="coach">${coachOpts}</select>
       <div class="row wrap">
         ${f.coach ? `<button class="btn sm danger" data-del="coach">✕ أزله</button>` : ""}
         <a href="#" class="btn sm" data-goto="4">＋ أضف شخصية جديدة</a>
       </div>`;

  renderScript(f);

  $("goCut").disabled = !f.video;
  $("goGenerate").disabled = !f.video?.clips;
  $("goMontage").disabled = !f.video?.generated;
  $("goMontage").textContent = f.montage_project ? "🎬 افتح في المونتاج" : "🎬 أنشئ المونتاج";
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
  el.innerHTML = `<h3>📝 النص</h3>
    <div class="muted">النص الذي الراوي يقرؤه. إذا حبيت تغيّر صوت الراوي لاحقًا، هذا النص الذي سيُسجّل به.</div>
    <textarea id="scriptText" dir="auto" placeholder="اكتب أو ألصق النص هنا، أو ارفع ملف تكست (.txt)"></textarea>
    <div class="script-meta" id="scriptMeta"></div>
    <div class="row wrap">
      <button class="btn sm primary" id="scriptSave" disabled>💾 احفظ النص</button>
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
  $("scriptMeta").innerHTML = scriptMeta(f, text) + (scriptState.dirty ? `<span class="dirty">● متعدّل ولا تحفظ</span>` : "");
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
    toast(text ? "✅ النص حُفظ" : "النص حُذف");
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
  e.stopPropagation(); // لا تتعامل كأنه رفع فيديو أو صوت
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const text = await readTextFile(file);
    if (!text) return toast("الملف فارغ", true);
    if (scriptState.saved && !(await uiConfirm("هذا سيبدّل النص الحالي بالملف الجديد. تُكمل؟"))) return;
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
    try { await navigator.clipboard.writeText($("scriptText").value); toast("📋 نُسخ"); }
    catch { $("scriptText").select(); document.execCommand("copy"); toast("📋 نُسخ"); }
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
  if (name && name !== fol.current.name) patchFolder({ name }, "✅ الاسم تغيّر (وده اسم الفيديو النهائي)");
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
    xhr.onerror = () => { bar.hidden = true; reject(new Error("الاتصال قُطع")); };
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
        !(await uiConfirm("تبديل الفيديو سيحذف الفيديو القديم والتقطيع الخاص به. الفيديوهات التي وُلّدت من قبل ستظل موجودة. تُكمل؟"))) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const bar = e.target.closest(".element").querySelector(".el-bar");
      fol.current = await uploadWithProgress(`/api/folders/${fol.current.id}/${up}`, form, bar);
      await loadFolders();
      toast(up === "video" ? "✅ الفيديو رُفع. قطّعه من «افتح في التقطيع»" : "✅ التعليق الصوتي رُفع");
    } catch (err) {
      toast(err.message, true);
    }
  }
  if (pick === "voice") patchFolder({ voice_id: e.target.value || null }, "✅ التعليق الصوتي تغيّر");
  if (pick === "coach") patchFolder({ coach_id: e.target.value || null }, "✅ الشخصية تغيّرت");
});

$("folderDetail").addEventListener("click", async (e) => {
  const del = e.target.closest("[data-del]")?.dataset.del;
  if (!del) return;
  const f = fol.current;
  if (del === "video") {
    if (!(await uiConfirm("حذف الفيديو الخام والتقطيع الخاص به؟"))) return;
    try {
      fol.current = await api(`/api/folders/${f.id}/video`, { method: "DELETE" });
      await loadFolders();
    } catch (err) { toast(err.message, true); }
  }
  if (del === "voice") patchFolder({ voice_id: null }, "أُزيل من المشروع (ما زال موجود في مكتبة التعليق الصوتي)");
  if (del === "coach") patchFolder({ coach_id: null }, "أُزيل من المشروع (ما زال موجود في الشخصيات)");
});

$("folderDelete").onclick = async () => {
  const f = fol.current;
  if (!(await uiConfirm(`حذف المشروع "${f.name}" والفيديو الخام والقطع والفيديوهات المولّدة ومونتاجه؟\nالتعليق الصوتي والشخصية سيظلون في مكتباتهم، والفيديوهات التي صُدّرت ستظل في مجلد الجاهز.`))) return;
  try {
    await api("/api/folders/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [f.id] }) });
  } catch (err) {
    return toast(err.message, true);
  }
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
    await openMontageForVideo(fol.current.video.id);   // إذا وُلّد بأكتر من شخصية يسأل أي واحد
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
      // coach: "" = من غير شخصية، "new" = شخصية جديدة من الصورة، أو id شخصية موجودة
      coach: existingCoach ? existingCoach.id : image ? "new" : "",
      newCoachName: image ? (key ? niceName(image.name) : `شخصية ${name}`) : "",
      existingFolderId: existingFolder?.id || null,
      preview: image ? URL.createObjectURL(image) : null,
      status: "",
    });
  }
  return rows;
}

const SLOT_LABEL = { video: "الفيديو الخام", voice: "التعليق الصوتي", image: "صورة الشخصية", script: "النص" };

async function loadRowScript(r) {
  try { r.scriptText = r.script ? await readTextFile(r.script) : ""; }
  catch { r.scriptText = ""; }
}

function slotSelect(r, slot) {
  const files = r.files[slot];
  const cur = r[slot];
  if (!files.length) return `<span class="muted">لا يوجد في المجلد</span>`;
  const opts = `<option value="">— لا يوجد —</option>` + files
    .map((f, i) => `<option value="${i}" ${cur === f ? "selected" : ""}>${escapeHtml(f.name)} (${mb(f)})</option>`)
    .join("");
  return `<div class="slot"><select data-slot="${slot}">${opts}</select>
    ${cur ? `<button type="button" class="btn sm" data-preview="${slot}" title="انظر/اسمع">👁</button>` : ""}</div>`;
}

function coachOutroNote(r) {
  if (!r.coach || r.coach === "new") return "";
  const c = fol.coaches.find((x) => x.id === r.coach);
  return c?.outro_url ? `<div class="muted">🎬 الخاتمة: الخاصة بـ${escapeHtml(c.name)}</div>` : `<div class="warn-text">⚠️ هذه الشخصية ليس لها أوترو</div>`;
}

function renderFup() {
  $("fupEmpty").hidden = fup.rows.length > 0;
  const coaches = fol.coaches;
  $("fupRows").innerHTML = fup.rows
    .map((r, i) => {
      const coachOpts = `<option value="">— بدون شخصية —</option>` +
        (r.image ? `<option value="new" ${r.coach === "new" ? "selected" : ""}>＋ شخصية جديدة من الصورة</option>` : "") +
        coaches.map((c) => `<option value="${c.id}" ${r.coach === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
      return `<tr data-i="${i}" class="${r.status === "done" ? "done" : ""}">
        <td><input type="text" data-f="name" value="${escapeHtml(r.name)}">
          ${r.existingFolderId ? `<div class="warn-text">مشروع هذا بالاسم موجود، سيُحدّث</div>` : ""}
          ${r.status && r.status !== "done" ? `<div class="${r.status.startsWith("✕") ? "err" : "muted"}">${escapeHtml(r.status)}</div>` : ""}</td>
        <td>${slotSelect(r, "video")}</td>
        <td>${slotSelect(r, "voice")}
          <div class="slot-label">📝 النص</div>${slotSelect(r, "script")}
          ${r.scriptText ? `<div class="fup-script" dir="auto" title="${escapeHtml(r.scriptText.slice(0, 300))}">${escapeHtml(r.scriptText.slice(0, 80))}</div>
            <div class="muted">${scriptWords(r.scriptText)} كلمة</div>` : ""}</td>
        <td class="fup-coach">
          ${r.preview ? `<img src="${r.preview}" alt="">` : ""}
          <div class="slot-label">🖼️ الصورة</div>${slotSelect(r, "image")}
          <div class="slot-label">🧍 الشخصية</div><select data-f="coach">${coachOpts}</select>
          ${r.coach === "new" ? `<input type="text" data-f="newCoachName" value="${escapeHtml(r.newCoachName)}" placeholder="اسم الشخصية">
            <div class="muted">شخصية جديدة بدون أوترو. أضفه لاحقًا من صفحة الشخصيات</div>` : ""}
          ${coachOutroNote(r)}</td>
        <td>${r.status === "done" ? "✅" : `<button class="btn sm danger" data-f="remove" title="لا تُرفع">✕</button>`}</td>
      </tr>`;
    })
    .join("");
  const pending = fup.rows.filter((r) => r.status !== "done");
  $("fupUpload").disabled = fup.busy || !pending.length || pending.some((r) =>
    !r.name.trim() || (r.coach === "new" && (!r.newCoachName.trim() || !r.image)));
  $("fupUpload").textContent = `⬆ ارفع ${pending.length} مشروع`;
  $("fupCount").textContent = `${fup.rows.length} مشروع في القائمة`;
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
    toast(`＋ أُضيف ${rows.length} مشروع`);
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
      else if (file && !r.coach) { r.coach = "new"; r.newCoachName = key ? niceName(file.name) : `شخصية ${r.name}`; }
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
  const newCoaches = new Map(); // نفس الشخصية الجديدة إذا تكرر في كذا مجلد يُنشأ مرة واحدة
  for (const [n, r] of rows.entries()) {
    const label = `${n + 1} من ${rows.length}: ${r.name}`;
    const step = (s) => { r.status = s; $("fupProgress").textContent = `⏳ ${label} · ${s}`; renderFup(); };
    try {
      step("يعمل المشروع...");
      let folder = r.existingFolderId
        ? fol.list.find((f) => f.id === r.existingFolderId)
        : await api("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: r.name.trim() }) });
      if (r.video) {
        step(`يرفع الفيديو (${mb(r.video)})...`);
        const form = new FormData();
        form.append("file", r.video);
        folder = await uploadWithProgress(`/api/folders/${folder.id}/video`, form, bar);
      }
      if (r.voice) {
        step("يرفع التعليق الصوتي...");
        const form = new FormData();
        form.append("file", r.voice);
        folder = await uploadWithProgress(`/api/folders/${folder.id}/voice`, form, bar);
      }
      if (r.script && r.scriptText) {
        step("يحفظ النص...");
        await api(`/api/folders/${folder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: r.scriptText }) });
      }
      let coachId = r.coach && r.coach !== "new" ? r.coach : null;
      if (r.coach === "new") {
        const cname = r.newCoachName.trim();
        coachId = newCoaches.get(cname) || fol.coaches.find((c) => c.name.trim() === cname)?.id || null;
        if (!coachId) {
          step("يعمل الشخصية...");
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
  $("fupProgress").textContent = failed ? `✅ ${rows.length - failed} حسنًا · ✕ ${failed} فشلوا، صلّح واضغط ارفع مرة أخرى` : "";
  renderFup();
  if (!failed) {
    $("fupDialog").close();
    toast(`✅ رُفع ${rows.length} مشروع`);
  }
};


// ---------- 🤖 الأوتوبايلوت: كذا مشروع بيتجهزوا لوحدهم (تقطيع ← توليد ← مونتاج ← تصدير ← جدولة) ----------
const AP_STEPS = { queued: "⏳ في الطابور", cutting: "✂️ جارٍ التقطيع", generating: "✨ جارٍ التوليد", montage: "🎞️ مونتاج", rendering: "🎬 جارٍ التصدير",
  scheduling: "📅 جارٍ الجدولة", done: "✅ جُدول", failed: "⚠️ توقف", stopped: "⏹ توقف" };
const AP_PLATFORMS = [["instagram", "إنستجرام"], ["tiktok", "تيك توك"], ["youtube", "يوتيوب شورتس"], ["facebook", "فيسبوك"], ["x", "X"]];
const AP_DAYS = [[5, "السبت"], [6, "الأحد"], [0, "الاثنين"], [1, "الثلاثاء"], [2, "الأربعاء"], [3, "الخميس"], [4, "الجمعة"]];
const apLocal = (s) => new Date(`${s}+03:00`).toLocaleString("ar-EG", { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" });
const apAgo = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return m < 1 ? "الآن" : m < 60 ? `منذ ${m} دقيقة` : `منذ ${Math.floor(m / 60)} ساعة و${m % 60} دقيقة`;
};
const apFmt = (iso) => new Date(iso).toLocaleString("ar-EG", { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function openAutopilot() {
  const dlg = document.createElement("dialog");
  dlg.className = "bulk-dlg ap-dlg";
  document.body.appendChild(dlg);
  let st = await api("/api/autopilot"), timer = null;
  const prompts = await api("/api/prompts").catch(() => []);
  await loadFolders();
  const ready = (f) => f.video && f.voice && f.coach;
  const busy = () => new Set(st.jobs.filter((j) => !["done", "failed", "stopped"].includes(j.step)).map((j) => j.folder_id));
  const manual = () => (st.settings.mode || "manual") === "manual";
  const jobsHTML = () => [...st.jobs].reverse().map((j) => `<li>
      <span class="grow"><b>${escapeHtml(j.name)}</b><br><small class="muted">${escapeHtml(j.step === "done" && j.scheduled_at ? `📅 ${apFmt(j.scheduled_at)}` : j.note || "")}</small>
        ${["done", "failed", "stopped"].includes(j.step) ? "" : `<br><small class="muted">⏱️ في هذه الخطوة ${apAgo(j.step_at || j.created_at)} · آخر تحديث ${apAgo(j.updated_at)}</small>`}
        ${j.step === "done" ? "" : `<br><small class="muted">📅 ${j.at ? `سيُنشر: ${apLocal(j.at)}` : "سيُنشر في أول موعد فارغ"}</small>
          <input type="datetime-local" class="ap-at" data-jat="${j.id}" value="${(j.at || "").slice(0, 16)}" title="غيّر موعد النشر">`}
        ${j.error ? `<br><span class="ap-err">${escapeHtml(j.error)}</span>` : ""}</span>
      <span class="ap-step ${j.step}">${AP_STEPS[j.step] || j.step}</span>
      ${["failed", "stopped"].includes(j.step) ? `<button class="btn sm primary" data-resume="${j.id}" title="يُكمل من حيث توقف">▶ أكمل</button>` : ""}
      ${["done", "failed", "stopped"].includes(j.step) ? `<button class="btn sm" data-del="${j.id}" title="أزله من القائمة">✕</button>` : `<button class="btn sm" data-stop="${j.id}">⏹</button>`}
    </li>`).join("") || '<li class="off">لا يوجد عمل بعد</li>';
  // التحديث كل شوية بيغيّر قايمة الشغل بس (من غير ما الصفحة تطلع لفوق)
  const drawJobs = () => {
    const ul = dlg.querySelector("[data-jobs]");
    if (!ul || ul.contains(document.activeElement)) return;
    const y = ul.scrollTop;
    ul.innerHTML = jobsHTML();
    ul.scrollTop = y;
  };
  const draw = () => {
    const s = st.settings, b = busy(), man = manual();
    const picked = new Set([...dlg.querySelectorAll("[data-pick]:checked")].map((x) => x.dataset.pick));
    const atVals = Object.fromEntries([...dlg.querySelectorAll("[data-at]")].map((x) => [x.dataset.at, x.value]));
    const days = new Set(s.days || [0, 1, 2, 3, 4, 5, 6]);
    const y = dlg.scrollTop;
    dlg.innerHTML = `<div class="panel-head"><h2>🤖 الأوتوبايلوت</h2><button class="btn sm" data-x>إغلاق</button></div>
      <p class="hint">يُقطَّع كل مشروع إلى قطع أقل من 15 ثانية، ويُولَّد، ويُنشأ له مونتاج كوتشي، ويُصدَّر، ويُجدول بمنشور مشترك مع المدرب والغلاف قبل النهاية بثانيتين.<br>⚠️ التوليد يُخصم من الرصيد.</p>
      <div class="ap-grid">
        <div>
          <h3>موعد النشر</h3>
          <div class="row wrap">
            <label class="check"><input type="radio" name="apmode" data-mode="manual" ${man ? "checked" : ""}> سأحدد يوم كل فيديو وساعته</label>
            <label class="check"><input type="radio" name="apmode" data-mode="auto" ${man ? "" : "checked"}> وزّعها تلقائيًا على مواعيد ثابتة</label>
          </div>
          ${man ? `<p class="hint">حدد اليوم والساعة بجانب كل مشروع (بتوقيت السعودية).</p>` : `
            <div class="ap-auto">
              <h3>المواعيد كل يوم (بتوقيت السعودية)</h3>
              <div class="ap-slots">${[0, 1, 2].map((i) => `<input type="time" data-slot="${i}" value="${(s.slots || [])[i] || ""}">`).join("")}</div>
              <h3>أيام النشر</h3>
              <div class="row wrap">${AP_DAYS.map(([k, n]) => `<label class="check"><input type="checkbox" data-day="${k}" ${days.has(k) ? "checked" : ""}> ${n}</label>`).join("")}</div>
              <h3>ابدأ من يوم <span class="muted">(فارغ = من اليوم)</span></h3>
              <input type="date" data-start value="${s.start_date || ""}">
            </div>`}
          <h3>المنصات</h3>
          <div class="row wrap">${AP_PLATFORMS.map(([k, n]) => `<label class="check"><input type="checkbox" data-plat="${k}" ${(s.platforms || []).includes(k) ? "checked" : ""}> ${n}</label>`).join("")}</div>
          <h3>موجّه التوليد</h3>
          <select data-prompt><option value="">الأساسي (${escapeHtml(prompts[0]?.name || "—")})</option>${prompts.map((p) => `<option value="${p.id}" ${s.prompt_id === p.id ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</select>
          <h3>المشاريع الجاهزة <span class="muted">(فيديو + تعليق + شخصية)</span></h3>
          <ul class="ap-list">${fol.list.map((f) => {
            const ok = ready(f), on = b.has(f.id);
            return `<li class="${ok && !on ? "" : "off"}"><input type="checkbox" data-pick="${f.id}" ${ok && !on ? "" : "disabled"} ${picked.has(f.id) ? "checked" : ""}>
              <span class="grow">📁 ${escapeHtml(f.name)}${f.exported ? ' <span class="muted">· صُدّر سابقًا</span>' : ""}</span>
              ${man && ok && !on ? `<input type="datetime-local" data-at="${f.id}" value="${atVals[f.id] || ""}" title="يوم وساعة النشر (بتوقيت السعودية)">` : ""}
              <span class="muted">${on ? "يعمل" : ok ? "" : "ناقص"}</span></li>`;
          }).join("") || '<li class="off">لا توجد مشاريع</li>'}</ul>
          <div class="row gap-top"><button class="btn sm" data-all>اختر كل الجاهز</button><span class="spacer"></span><button class="btn primary" data-go>🚀 شغّل الأوتوبايلوت</button></div>
        </div>
        <div>
          <h3>العمل</h3>
          <ul class="ap-list" data-jobs>${jobsHTML()}</ul>
        </div>
      </div>`;
    dlg.scrollTop = y;
  };
  const saveSettings = async (extra = {}) => {
    const body = { platforms: [...dlg.querySelectorAll("[data-plat]:checked")].map((x) => x.dataset.plat),
      prompt_id: dlg.querySelector("[data-prompt]").value || null, ...extra };
    if (dlg.querySelector(".ap-auto")) {
      body.slots = [...dlg.querySelectorAll("[data-slot]")].map((x) => x.value).filter(Boolean);
      body.days = [...dlg.querySelectorAll("[data-day]:checked")].map((x) => Number(x.dataset.day));
      body.start_date = dlg.querySelector("[data-start]").value || null;
    }
    st = await api("/api/autopilot/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  };
  dlg.addEventListener("change", async (e) => {
    try {
      const mode = e.target.closest("[data-mode]");
      if (mode) { await saveSettings({ mode: mode.dataset.mode }); return draw(); }
      if (e.target.closest("[data-slot],[data-plat],[data-prompt],[data-day],[data-start]")) await saveSettings();
      const jat = e.target.closest("[data-jat]");
      if (jat) {
        st = await api(`/api/autopilot/${jat.dataset.jat}/at`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ at: jat.value || null }) });
        toast(jat.value ? `📅 سيُنشر ${apLocal(jat.value)}` : "📅 سيأخذ أول موعد فارغ");
        jat.blur();
        drawJobs();
      }
    } catch (err) {
      toast(err.message, true);
    }
  });
  dlg.addEventListener("click", async (e) => {
    const t = e.target;
    try {
      if (t.closest("[data-x]")) return dlg.close();
      if (t.closest("[data-all]")) return dlg.querySelectorAll("[data-pick]:not(:disabled)").forEach((x) => (x.checked = true));
      if (t.closest("[data-go]")) {
        const ids = [...dlg.querySelectorAll("[data-pick]:checked")].map((x) => x.dataset.pick);
        if (!ids.length) return toast("اختر مشروعًا واحدًا على الأقل", true);
        if (!st.settings.platforms?.length) return toast("اختر منصة واحدة على الأقل", true);
        const at = manual() ? Object.fromEntries(ids.map((id) => [id, dlg.querySelector(`[data-at="${id}"]`)?.value || ""])) : {};
        if (manual() && Object.values(at).some((v) => !v)) return toast("حدد يومًا وساعة لكل مشروع مختار", true);
        if (!(await uiConfirm(`سيُولَّد ${ids.length} مشروع ويُنشر تلقائيًا، والتوليد يُخصم من الرصيد. أنكمل؟`))) return;
        await saveSettings();
        st = await api("/api/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder_ids: ids, at }) });
        dlg.querySelectorAll("[data-pick]").forEach((x) => (x.checked = false));
        toast(`🤖 دخل ${ids.length} مشروع قائمة الانتظار`);
        return draw();
      }
      const stop = t.closest("[data-stop]"), del = t.closest("[data-del]"), res = t.closest("[data-resume]");
      if (res) { st = await api(`/api/autopilot/${res.dataset.resume}/resume`, { method: "POST" }); drawJobs(); }
      if (stop) { st = await api(`/api/autopilot/${stop.dataset.stop}/stop`, { method: "POST" }); drawJobs(); }
      if (del) { st = await api(`/api/autopilot/${del.dataset.del}`, { method: "DELETE" }); drawJobs(); }
    } catch (err) {
      toast(err.message, true);
    }
  });
  dlg.addEventListener("close", () => { clearInterval(timer); dlg.remove(); loadFolders(); });
  draw();
  dlg.showModal();
  timer = setInterval(async () => {
    st = await api("/api/autopilot").catch(() => st);
    drawJobs();
  }, 6000);
}
$("autopilotOpen").onclick = () => openAutopilot().catch((err) => toast(err.message, true));


// ---------- 🗑️ مسح مشاريع قديمة (كذا مشروع مرة واحدة) ----------
async function openFoldersPurge() {
  await loadFolders();
  const dlg = document.createElement("dialog");
  dlg.className = "bulk-dlg ap-dlg";
  const age = (f) => Math.floor((Date.now() - new Date(f.created_at)) / 864e5);
  const list = [...fol.list].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  dlg.innerHTML = `<div class="panel-head"><h2>🗑️ احذف مشاريع قديمة</h2><button class="btn sm" data-x>إغلاق</button></div>
    <p class="hint">يُحذف المشروع والفيديو الخام والقطع والفيديوهات المولّدة ومشروع المونتاج الخاص به. يبقى التعليق الصوتي والشخصيات في مكتباتها.</p>
    <div class="row wrap"><button class="btn sm" data-old="30">اختر الأقدم من شهر</button><button class="btn sm" data-old="7">الأقدم من أسبوع</button>
      <button class="btn sm" data-old="0">اختر الكل</button><button class="btn sm" data-none>أزل الاختيار</button></div>
    <ul class="ap-list gap-top">${list.map((f) => `<li><input type="checkbox" data-pick="${f.id}">
      <span class="grow">📁 ${escapeHtml(f.name)} <small class="muted">· ${age(f) ? `منذ ${age(f)} يوم` : "اليوم"}${f.exported ? " · 🎬 صُدّر" : ""}</small></span></li>`).join("") || '<li class="off">لا توجد مشاريع</li>'}</ul>
    <label class="check gap-top"><input type="checkbox" data-exp> احذف أيضًا الفيديوهات النهائية المصدّرة <span class="muted">(ما عليه منشور مجدول يبقى)</span></label>
    <div class="row gap-top"><span class="muted" data-count></span><span class="spacer"></span><button class="btn danger" data-go>🗑️ احذف المختار</button></div>`;
  const count = () => { dlg.querySelector("[data-count]").textContent = `${dlg.querySelectorAll("[data-pick]:checked").length} مختار`; };
  dlg.addEventListener("change", count);
  dlg.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.closest("[data-x]")) return dlg.close();
    const old = t.closest("[data-old]");
    if (old) { const d = Number(old.dataset.old); list.forEach((f) => { dlg.querySelector(`[data-pick="${f.id}"]`).checked = age(f) >= d; }); return count(); }
    if (t.closest("[data-none]")) { dlg.querySelectorAll("[data-pick]").forEach((x) => (x.checked = false)); return count(); }
    if (t.closest("[data-go]")) {
      const ids = [...dlg.querySelectorAll("[data-pick]:checked")].map((x) => x.dataset.pick);
      if (!ids.length) return toast("اختر مشروعًا واحدًا على الأقل", true);
      const exports = dlg.querySelector("[data-exp]").checked;
      if (!(await uiConfirm(`سيُحذف ${ids.length} مشروع${exports ? " ومعها الفيديوهات النهائية" : ""} ولا يمكن استرجاعها. أمتأكد؟`))) return;
      try {
        const r = await api("/api/folders/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, exports }) });
        toast(`🗑️ حُذف ${r.deleted} مشروع${r.kept_exports ? ` (${r.kept_exports} فيديو بقي لأن عليه منشورًا مجدولًا)` : ""}`);
        if (ids.includes(fol.current?.id)) fol.current = null;
        dlg.close();
      } catch (err) {
        toast(err.message, true);
      }
    }
  });
  dlg.addEventListener("close", () => { dlg.remove(); loadFolders(); });
  document.body.appendChild(dlg);
  count();
  dlg.showModal();
}
$("foldersPurgeOpen").onclick = () => openFoldersPurge().catch((err) => toast(err.message, true));
