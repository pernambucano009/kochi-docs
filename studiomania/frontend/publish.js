// StudioMania — الخطوة 7: فولدر الفيديوهات الجاهزة والنشر المجدول

const pub = { exports: [], posts: [], platforms: {}, service: null, videoId: null, editing: null, timer: null };
const PLATFORMS_KEY = "studiomania.platforms";
const POST_STATUS = {
  scheduled: ["متجدول", "scheduled"],
  publishing: ["بيتنشر...", "active"],
  published: ["اتنشر", "published"],
  failed: ["فشل", "failed"],
};

async function initPublish() {
  const info = await api("/api/publisher");
  pub.platforms = info.platforms;
  pub.service = info.service;
  const alert = $("publisherAlert");
  alert.hidden = !!pub.service;
  alert.textContent = "⚠️ لسه مفيش خدمة نشر مربوطة. تقدر تجدول البوستات عادي، بس مش هتتنشر فعلًا غير لما نربط خدمة (Ayrshare أو Late أو Postiz).";
  if (!$("postPlatforms").children.length) renderPlatformBoxes();
  await Promise.all([pubLoadExports(), pubLoadPosts()]);
  if (!$("postWhen").value) setWhen(nextSlot());
}

// ---------- الفولدر ----------
async function pubLoadExports() {
  pub.exports = await api("/api/exports");
  if (!pub.exports.some((e) => e.id === pub.videoId)) pub.videoId = null;
  renderReady();
  renderPostVideo();
}

function renderReady() {
  $("readyEmpty").hidden = pub.exports.length > 0;
  $("readyCount").textContent = pub.exports.length ? `(${pub.exports.length})` : "";
  const scheduled = new Set(pub.posts.filter((p) => p.status === "scheduled").map((p) => p.export_id));
  $("readyGrid").innerHTML = pub.exports
    .map(
      (e) => `<div class="ready ${e.id === pub.videoId ? "selected" : ""}" data-id="${e.id}">
        <video src="${e.url}" controls preload="metadata" playsinline></video>
        <div class="body">
          <div class="name" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</div>
          <div class="meta"><span>${fmtDuration(e.duration)}</span>
            <span class="pill">${e.source === "upload" ? "من برا" : "من المونتاج"}</span>
            ${scheduled.has(e.id) ? `<span class="pill scheduled">متجدول</span>` : ""}</div>
          <div class="acts">
            <button class="btn sm primary" data-act="pick">📅 جدول</button>
            <a class="btn sm" href="${e.url}" download="${escapeHtml(e.name)}.mp4" title="تحميل">⬇</a>
            <button class="btn sm" data-act="rename" title="تغيير الاسم">✎</button>
            <button class="btn sm danger" data-act="delete" title="حذف">✕</button>
          </div>
        </div>
      </div>`
    )
    .join("");
}

$("readyGrid").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  const card = e.target.closest(".ready");
  if (!btn || !card) return;
  const ex = pub.exports.find((x) => x.id === card.dataset.id);
  try {
    if (btn.dataset.act === "pick") {
      pub.videoId = ex.id;
      renderReady();
      renderPostVideo();
      $("postCaption").focus();
    }
    if (btn.dataset.act === "rename") {
      const name = prompt("الاسم الجديد:", ex.name);
      if (!name || name === ex.name) return;
      await api(`/api/exports/${ex.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      await pubLoadExports();
      await pubLoadPosts();
    }
    if (btn.dataset.act === "delete") {
      if (!confirm(`حذف "${ex.name}" من الفولدر؟`)) return;
      await api(`/api/exports/${ex.id}`, { method: "DELETE" });
      await pubLoadExports();
    }
  } catch (err) {
    toast(err.message, true);
  }
});

$("readyUpload").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  for (const file of files) {
    const row = document.createElement("div");
    row.className = "upload-item";
    row.textContent = `⏳ ${file.name}`;
    $("readyUploads").appendChild(row);
    const form = new FormData();
    form.append("file", file);
    try {
      await api("/api/exports/upload", { method: "POST", body: form });
    } catch (err) {
      toast(`فشل رفع ${file.name}: ${err.message}`, true);
    }
    row.remove();
  }
  await pubLoadExports();
});

// ---------- فورم الجدولة ----------
function renderPlatformBoxes() {
  let saved = [];
  try { saved = JSON.parse(storageGet(PLATFORMS_KEY) || "[]"); } catch {}
  $("postPlatforms").innerHTML = Object.entries(pub.platforms)
    .map(([k, label]) => `<label><input type="checkbox" value="${k}" ${saved.includes(k) ? "checked" : ""}> ${label}</label>`)
    .join("");
}
function checkedPlatforms() {
  return [...$("postPlatforms").querySelectorAll("input:checked")].map((i) => i.value);
}
$("postPlatforms").addEventListener("change", () => storageSet(PLATFORMS_KEY, JSON.stringify(checkedPlatforms())));

function renderPostVideo() {
  const ex = pub.exports.find((x) => x.id === pub.videoId);
  $("postVideo").innerHTML = ex
    ? `🎬 ${escapeHtml(ex.name)} <span class="muted">(${fmtDuration(ex.duration)})</span>`
    : `<span class="muted">اختار فيديو من الفولدر (دوس 📅 جدول)</span>`;
}

// datetime-local بيشتغل بالتوقيت المحلي للجهاز
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function setWhen(d) {
  $("postWhen").value = toLocalInput(d);
}
function nextSlot() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d;
}
const QUICK = [
  ["بعد ساعة", () => nextSlot()],
  ["بكرة 12 الضهر", () => atHour(1, 12)],
  ["بكرة 6 المغرب", () => atHour(1, 18)],
  ["بكرة 9 بالليل", () => atHour(1, 21)],
];
function atHour(daysAhead, hour) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
}
$("quickTimes").innerHTML = QUICK.map(([label], i) => `<button type="button" class="btn sm" data-q="${i}">${label}</button>`).join("");
$("quickTimes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-q]");
  if (b) setWhen(QUICK[Number(b.dataset.q)][1]());
});

function resetPostForm() {
  pub.editing = null;
  $("postFormTitle").textContent = "جدولة بوست";
  $("postSubmit").textContent = "📅 جدول";
  $("postCancel").hidden = true;
  $("postCaption").value = "";
  setWhen(nextSlot());
}
$("postCancel").onclick = resetPostForm;

$("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pub.videoId) return toast("اختار فيديو من الفولدر الأول", true);
  const platforms = checkedPlatforms();
  if (!platforms.length) return toast("اختار منصة واحدة على الأقل", true);
  const when = new Date($("postWhen").value);
  if (isNaN(when)) return toast("اختار الميعاد", true);
  if (when < new Date() && !confirm("الميعاد ده عدّى، فالبوست هيتنشر على طول. تكمّل؟")) return;
  const body = JSON.stringify({
    export_id: pub.videoId,
    caption: $("postCaption").value,
    platforms,
    scheduled_at: when.toISOString(),
  });
  try {
    await api(pub.editing ? `/api/posts/${pub.editing}` : "/api/posts", {
      method: pub.editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    toast(pub.editing ? "✅ البوست اتعدّل" : `✅ اتجدول ${when.toLocaleString("ar-EG", { weekday: "long", hour: "numeric", minute: "2-digit" })}`);
    resetPostForm();
    await pubLoadPosts();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- المواعيد ----------
async function pubLoadPosts() {
  pub.posts = await api("/api/posts");
  renderPosts();
  renderReady();
  clearTimeout(pub.timer);
  // نحدّث كل شوية عشان نشوف البوستات اللي اتنشرت
  // لو فيه بوست جه ميعاده أو بيتنشر، نحدّث أسرع
  const nowIso = new Date().toISOString();
  const busy = pub.posts.some((p) => p.status === "publishing" || (p.status === "scheduled" && new Date(p.scheduled_at).toISOString() <= nowIso));
  if (!document.querySelector('.view[data-view="7"]').hidden) pub.timer = setTimeout(pubLoadPosts, busy ? 3000 : 15000);
}

function renderPosts() {
  const filter = $("postFilter").value;
  const list = pub.posts
    .filter((p) =>
      filter === "all" ? true
        : filter === "upcoming" ? p.status === "scheduled" || p.status === "publishing"
          : p.status === filter)
    .sort((a, b) => (filter === "upcoming" ? a.scheduled_at.localeCompare(b.scheduled_at) : b.scheduled_at.localeCompare(a.scheduled_at)));
  $("postsEmpty").hidden = list.length > 0;
  $("postsList").innerHTML = list
    .map((p) => {
      const [label, cls] = POST_STATUS[p.status] || [p.status, ""];
      const when = new Date(p.scheduled_at).toLocaleString("ar-EG", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
      return `<li data-id="${p.id}">
        ${p.export_url ? `<video src="${p.export_url}#t=0.5" preload="metadata" muted></video>` : ""}
        <div class="info">
          <span class="when">${when}</span>
          <span>${escapeHtml(p.export_name || "⚠️ الفيديو اتمسح")} · ${p.platforms.map((k) => pub.platforms[k] || k).join("، ")}</span>
          ${p.caption ? `<span class="cap" title="${escapeHtml(p.caption)}">${escapeHtml(p.caption)}</span>` : ""}
          ${p.error ? `<span class="err">${escapeHtml(p.error)}</span>` : ""}
        </div>
        <span class="pill ${cls}">${label}</span>
        <span class="acts">
          ${p.status === "scheduled" || p.status === "failed" ? `<button class="btn sm" data-act="edit">✎ تعديل</button>` : ""}
          ${p.status === "failed" ? `<button class="btn sm" data-act="retry">↻ إعادة المحاولة</button>` : ""}
          ${p.status !== "publishing" ? `<button class="btn sm danger" data-act="delete">${p.status === "scheduled" ? "إلغاء" : "حذف"}</button>` : ""}
        </span>
      </li>`;
    })
    .join("");
}
$("postFilter").addEventListener("change", renderPosts);

$("postsList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const p = pub.posts.find((x) => x.id === btn.closest("li").dataset.id);
  try {
    if (btn.dataset.act === "edit") {
      pub.editing = p.id;
      pub.videoId = p.export_id;
      $("postFormTitle").textContent = "تعديل البوست";
      $("postSubmit").textContent = "💾 حفظ التعديل";
      $("postCancel").hidden = false;
      $("postCaption").value = p.caption;
      $("postPlatforms").querySelectorAll("input").forEach((i) => (i.checked = p.platforms.includes(i.value)));
      setWhen(new Date(p.scheduled_at));
      renderReady();
      renderPostVideo();
      $("postForm").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (btn.dataset.act === "retry") {
      await api(`/api/posts/${p.id}/retry`, { method: "POST" });
      await pubLoadPosts();
    }
    if (btn.dataset.act === "delete") {
      if (!confirm(p.status === "scheduled" ? "إلغاء البوست ده؟" : "حذف البوست ده من القايمة؟")) return;
      await api(`/api/posts/${p.id}`, { method: "DELETE" });
      if (pub.editing === p.id) resetPostForm();
      await pubLoadPosts();
    }
  } catch (err) {
    toast(err.message, true);
  }
});

viewHooks["7"] = initPublish;
