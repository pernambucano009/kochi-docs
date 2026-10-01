// StudioMania — الخطوة 7: فولدر الفيديوهات الجاهزة والنشر المجدول

const pub = { exports: [], posts: [], platforms: {}, accounts: {}, service: null, videoId: null, editing: null, timer: null };
const PLATFORMS_KEY = "studiomania.platforms";
const POST_STATUS = {
  scheduled: ["متجدول", "scheduled"],
  sending: ["بيتبعت لـ Zernio...", "active"],
  publishing: ["بيتنشر...", "active"],
  published: ["اتنشر", "published"],
  failed: ["فشل", "failed"],
};

async function initPublish() {
  const info = await api("/api/publisher");
  pub.platforms = info.platforms;
  pub.service = info.service;
  pub.accounts = info.accounts || {};
  const alert = $("publisherAlert");
  alert.hidden = info.service === "mock";
  alert.className = "alert " + (info.service === "zernio" && !info.accounts_error ? "info" : "warn");
  if (!info.service) {
    alert.innerHTML = `⚠️ لسه مفيش ربط بـ Zernio. تقدر تجدول البوستات عادي، وأول ما تحط مفتاح Zernio من <a href="#" data-goto="settings">⚙️ الإعدادات</a> البرنامج هيبعتهم لوحده.`;
  } else if (info.accounts_error) {
    alert.textContent = `⚠️ ${info.accounts_error}`;
  } else if (info.service === "zernio") {
    const linked = Object.entries(pub.platforms).map(([k, label]) =>
      pub.accounts[k] ? `<span class="pill published">✓ ${label}${pub.accounts[k].name ? ` (${escapeHtml(pub.accounts[k].name)})` : ""}</span>`
        : `<span class="pill failed">✕ ${label}</span>`).join(" ");
    alert.innerHTML = `الحسابات المربوطة في Zernio: ${linked} · <a href="${info.dashboard_url}" target="_blank">اربط حسابات</a>`;
  }
  renderPlatformBoxes();
  loadHandles();
  await Promise.all([pubLoadExports(), pubLoadPosts()]);
  if (pub.service === "zernio") loadRemoteOrphans();
  loadPublished();
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
  const scheduled = new Set(pub.posts.filter((p) => p.status === "scheduled" || p.status === "sending").map((p) => p.export_id));
  $("readyGrid").innerHTML = pub.exports
    .map(
      (e) => `<div class="ready ${e.id === pub.videoId ? "selected" : ""}" data-id="${e.id}">
        ${lightVideo(e.url, "controls playsinline")}
        <div class="body">
          <div class="name" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</div>
          <div class="meta"><span>${fmtDuration(e.duration)}</span>
            <span class="pill">${e.source === "upload" ? "من برا" : "من المونتاج"}</span>
            ${scheduled.has(e.id) ? `<span class="pill scheduled">متجدول</span>` : ""}</div>
          <div class="acts">
            <button class="btn sm primary" data-act="pick">📅 جدول</button>
            <a class="btn sm" href="${e.download_url}" download="${escapeHtml(e.name)}.mp4" title="تحميل">⬇</a>
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
  const keep = checkedPlatforms();
  if (keep.length) saved = keep;
  const needLink = pub.service === "zernio";
  $("postPlatforms").innerHTML = Object.entries(pub.platforms)
    .map(([k, label]) => {
      const off = needLink && !pub.accounts[k];
      return `<label title="${off ? "الحساب ده مش مربوط في Zernio" : ""}" class="${off ? "off" : ""}">
        <input type="checkbox" value="${k}" ${saved.includes(k) && !off ? "checked" : ""} ${off ? "disabled" : ""}> ${label}</label>`;
    })
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
  // التاج: حساب مدرب المشروع بيتحط لوحده (إلا لو انت كتبت حاجة بإيدك)
  const coachTag = ex?.coach?.instagram ? `@${ex.coach.instagram}` : "";
  if (!pub.tagsTouched && !pub.editing) $("igTags").value = coachTag;
  $("igTagsHint").textContent = ex?.coach
    ? (ex.coach.instagram ? `المدرب: ${ex.coach.name} (@${ex.coach.instagram})` : `⚠️ المدرب ${ex.coach.name} مالوش حساب إنستجرام متسجل. ضيفه من صفحة المدربين`)
    : "اكتب الحسابات اللي عايز تعملها تاج، وافصل بينهم بفاصلة.";
  // الغلاف بيتختار من نفس الفيديو
  const v = $("coverVideo");
  if (ex && v.dataset.src !== ex.url) {
    v.dataset.src = ex.url;
    v.src = ex.url;
    $("coverRange").max = Math.round(ex.duration * 1000);
    if (!pub.editing) { $("coverOn").checked = false; setCover(0); }
  }
  renderPostExtras();
}

// ---------- إنستجرام: التاج والكولاب · والغلاف لإنستجرام وتيك توك ----------
function renderPostExtras() {
  const pl = checkedPlatforms();
  const ig = pl.includes("instagram"), tt = pl.includes("tiktok");
  $("igOpts").hidden = !ig;
  $("coverOpts").hidden = !(ig || tt) || !pub.videoId;
  $("coverFor").textContent = ig && tt ? "(إنستجرام وتيك توك)" : ig ? "(إنستجرام)" : "(تيك توك)";
  $("coverPick").hidden = !$("coverOn").checked;
}
function setCover(ms) {
  $("coverRange").value = ms;
  const v = $("coverVideo");
  if (v.src) v.currentTime = ms / 1000;
  $("coverTime").textContent = fmt(ms / 1000);
}
$("postPlatforms").addEventListener("change", renderPostExtras);
$("coverOn").addEventListener("change", () => { renderPostExtras(); if ($("coverOn").checked) setCover(Number($("coverRange").value)); });
$("coverRange").addEventListener("input", () => setCover(Number($("coverRange").value)));
$("coverPrev").onclick = () => setCover(Math.max(0, Number($("coverRange").value) - 33));
$("coverNext").onclick = () => setCover(Math.min(Number($("coverRange").max), Number($("coverRange").value) + 33));
$("igTags").addEventListener("input", () => (pub.tagsTouched = true));
$("addRiyadh").onclick = () => {
  const c = $("postCaption");
  if (!c.value.includes("📍")) c.value = `${c.value.trimEnd()}${c.value.trim() ? "\n\n" : ""}📍 الرياض`;
  c.focus();
};

async function loadHandles() {
  try {
    const list = await api("/api/handles");
    $("handlesList").innerHTML = list.filter((h) => h.instagram)
      .map((h) => `<option value="@${escapeHtml(h.instagram)}">${escapeHtml(h.name)}</option>`).join("");
  } catch {}
}

function postOptions() {
  const tags = $("igTags").value.split(/[,،\s]+/).map((t) => t.trim()).filter(Boolean);
  return {
    ig_tags: tags,
    ig_collab: $("igCollab").checked,
    cover_ms: $("coverOn").checked ? Number($("coverRange").value) : null,
  };
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
  pub.tagsTouched = false;
  $("igCollab").checked = false;
  $("coverOn").checked = false;
  setWhen(nextSlot());
  renderPostVideo();
}
$("postCancel").onclick = resetPostForm;

$("postForm").addEventListener("submit", (e) => {
  e.preventDefault();
  submitPost(false);
});
$("postNow").onclick = () => submitPost(true);

async function submitPost(now) {
  if (!pub.videoId) return toast("اختار فيديو من الفولدر الأول", true);
  const platforms = checkedPlatforms();
  if (!platforms.length) return toast("اختار منصة واحدة على الأقل", true);
  const when = now ? new Date() : new Date($("postWhen").value);
  if (isNaN(when)) return toast("اختار الميعاد", true);
  const names = platforms.map((k) => pub.platforms[k] || k).join("، ");
  if (now && !confirm(`البوست هينزل دلوقتي على: ${names}. تكمّل؟`)) return;
  if (!now && when < new Date() && !confirm("الميعاد ده عدّى، فالبوست هيتنشر على طول. تكمّل؟")) return;
  const body = JSON.stringify({
    export_id: pub.videoId,
    caption: $("postCaption").value,
    platforms,
    scheduled_at: when.toISOString(),
    options: postOptions(),
  });
  try {
    await api(pub.editing ? `/api/posts/${pub.editing}` : "/api/posts", {
      method: pub.editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    toast(now ? "🚀 البوست بيتبعت للنشر دلوقتي" : pub.editing ? "✅ البوست اتعدّل"
      : `✅ اتجدول ${when.toLocaleString(UI_LOCALE(), { weekday: "long", hour: "numeric", minute: "2-digit" })}`);
    resetPostForm();
    await pubLoadPosts();
  } catch (err) {
    toast(err.message, true);
  }
}

// ---------- المواعيد ----------
async function pubLoadPosts() {
  const before = new Map(pub.posts.map((p) => [p.id, p.status]));
  pub.posts = await api("/api/posts");
  // بوست كان بيتبعت أو متجدول وفشل: نقول على طول والسبب إيه
  for (const p of pub.posts) {
    const was = before.get(p.id);
    if (p.status === "failed" && was && was !== "failed") toast(`✕ البوست ماتبعتش: ${p.error || "فشل"}`, true);
  }
  renderPosts();
  renderReady();
  clearTimeout(pub.timer);
  // نحدّث كل شوية عشان نشوف البوستات اللي اتنشرت
  // لو فيه بوست جه ميعاده أو بيتنشر، نحدّث أسرع
  const nowIso = new Date().toISOString();
  const busy = pub.posts.some((p) => p.status === "publishing" || p.status === "sending" || (p.status === "scheduled" && new Date(p.scheduled_at).toISOString() <= nowIso));
  if (!document.querySelector('.view[data-view="7"]').hidden) pub.timer = setTimeout(pubLoadPosts, busy ? 3000 : 15000);
}

function renderPosts() {
  const filter = $("postFilter").value;
  const list = pub.posts
    .filter((p) =>
      filter === "all" ? true
        // البوست اللي فشل بيفضل ظاهر في «الجاية» بالسبب لحد ما تعيده أو تمسحه
        : filter === "upcoming" ? ["scheduled", "sending", "publishing", "failed"].includes(p.status)
          : p.status === filter)
    .sort((a, b) => (filter === "upcoming" ? a.scheduled_at.localeCompare(b.scheduled_at) : b.scheduled_at.localeCompare(a.scheduled_at)));
  $("postsEmpty").hidden = list.length > 0;
  $("postsList").innerHTML = list
    .map((p) => {
      let [label, cls] = POST_STATUS[p.status] || [p.status, ""];
      if (p.status === "scheduled" && p.sent) label = "متجدول في Zernio ✓";
      const when = new Date(p.scheduled_at).toLocaleString(UI_LOCALE(), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
      return `<li data-id="${p.id}" class="${p.status === "failed" ? "failed" : ""}">
        ${p.image_url ? `<img class="post-thumb" src="${p.image_url}" alt="">` : p.export_url ? lightVideo(p.export_url, "muted") : ""}
        <div class="info">
          <span class="when">${when}</span>
          <span>${escapeHtml(p.export_name || (p.from_zernio ? "🔗 من Zernio" : "⚠️ الفيديو اتمسح"))} · ${p.platforms.map((k) => pub.platforms[k] || k).join("، ")}</span>
          ${p.caption ? `<span class="cap" title="${escapeHtml(p.caption)}">${escapeHtml(p.caption)}</span>` : ""}
          ${p.options?.ig_tags?.length ? `<span class="tags" dir="ltr">🏷️ ${p.options.ig_tags.map((t) => `@${escapeHtml(t)}`).join(" ")}${p.options.ig_collab ? " · 🤝" : ""}</span>` : ""}
          ${p.error ? `<span class="err">${escapeHtml(p.error)}</span>` : ""}
        </div>
        <span class="pill ${cls}">${label}</span>
        <span class="acts">
          ${!p.carousel_id && (p.status === "scheduled" || (p.status === "failed" && !p.sent)) ? `<button class="btn sm" data-act="edit">✎ تعديل</button>` : ""}
          ${p.status === "failed" ? `<button class="btn sm" data-act="retry">↻ إعادة المحاولة</button>` : ""}
          ${p.status !== "publishing" && p.status !== "sending" ? `<button class="btn sm danger" data-act="delete">${p.status === "scheduled" ? "إلغاء" : "حذف"}</button>` : ""}
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
      const o = p.options || {};
      $("igTags").value = (o.ig_tags || []).map((t) => `@${t}`).join(", ");
      pub.tagsTouched = true;
      $("igCollab").checked = !!o.ig_collab;
      $("coverOn").checked = o.cover_ms != null;
      renderReady();
      renderPostVideo();
      if (o.cover_ms != null) setCover(o.cover_ms);
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
      if (pub.service === "zernio") loadRemoteOrphans();
    }
  } catch (err) {
    toast(err.message, true);
  }
});

viewHooks["7"] = initPublish;

// ---------- بوستات متجدولة على Zernio ومش في القايمة هنا ----------
async function loadRemoteOrphans(verbose = false) {
  const box = $("remoteOrphans");
  try {
    const list = await api("/api/posts/remote");
    box.hidden = !list.length;
    if (verbose && !list.length) toast("✅ كل البوستات اللي على Zernio موجودة هنا");
    const when = (iso) => (iso ? new Date(iso).toLocaleString(UI_LOCALE(), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "");
    box.innerHTML = list.length ? `<p class="orphans-title">⚠️ فيه ${list.length} بوست متجدول على Zernio ومش في القايمة هنا</p>` + list.map((o) => `
      <div class="orphan" data-rid="${escapeHtml(o.id)}">
        ${o.media_url ? lightVideo(escapeHtml(o.media_url), "muted") : ""}
        <div class="info"><span class="when">${when(o.scheduled_for)}</span>
          <span>${o.platforms.map((k) => pub.platforms[k] || k).join("، ")}</span>
          ${o.content ? `<span class="cap">${escapeHtml(o.content)}</span>` : ""}</div>
        <span class="acts"><button class="btn sm" data-oact="adopt">＋ ضيفه للقايمة</button>
          <button class="btn sm danger" data-oact="cancel">✕ الغيه من Zernio</button></span>
      </div>`).join("") : "";
  } catch (err) {
    if (verbose) toast(err.message, true);
  }
}
$("syncZernio").onclick = () => loadRemoteOrphans(true);
$("remoteOrphans").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-oact]");
  if (!btn) return;
  const rid = btn.closest(".orphan").dataset.rid;
  try {
    if (btn.dataset.oact === "adopt") {
      await api("/api/posts/adopt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remote_id: rid }) });
      toast("✅ البوست اتضاف للقايمة");
    } else {
      if (!confirm("تلغي البوست ده من Zernio؟ مش هيتنشر.")) return;
      await api(`/api/posts/remote/${encodeURIComponent(rid)}/cancel`, { method: "POST" });
      toast("✅ اتلغى من Zernio");
    }
    await pubLoadPosts();
    await loadRemoteOrphans();
  } catch (err) {
    toast(err.message, true);
  }
});

// ---------- اللي اتنشر (من Zernio، بلينك البوست على كل منصة) ----------
const PLATFORM_ICON = { tiktok: "♪", instagram: "◎", youtube: "▶", facebook: "f", x: "𝕏" };
async function loadPublished(verbose = false) {
  try {
    const list = await api("/api/posts/published");
    $("publishedEmpty").hidden = list.length > 0;
    $("publishedCount").textContent = list.length ? `(${list.length})` : "";
    $("publishedList").innerHTML = list.map((p) => {
      const when = p.published_at ? new Date(p.published_at).toLocaleString(UI_LOCALE(), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "";
      const plats = p.platforms.map((x) => {
        const name = pub.platforms[x.key] || x.key;
        const ok = !x.status || x.status === "published";
        if (x.url) return `<a class="pl-link ${ok ? "" : "bad"}" href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${PLATFORM_ICON[x.key] || ""} ${escapeHtml(name)} ↗</a>`;
        return `<span class="pl-link ${ok ? "nolink" : "bad"}" title="${escapeHtml(x.error || "")}">${PLATFORM_ICON[x.key] || ""} ${escapeHtml(name)}${ok ? "" : " ✕"}</span>`;
      }).join("");
      return `<li>
        ${p.media_url ? lightVideo(escapeHtml(p.media_url), "muted") : ""}
        <div class="info"><span class="when">${when}</span>
          ${p.name ? `<span>${escapeHtml(p.name)}</span>` : ""}
          ${p.content ? `<span class="cap" title="${escapeHtml(p.content)}">${escapeHtml(p.content)}</span>` : ""}
          <span class="pl-links">${plats}</span></div>
      </li>`;
    }).join("");
    if (verbose) toast("✅ اتحدّث");
  } catch (err) {
    if (verbose) toast(err.message, true);
  }
}
$("publishedRefresh").onclick = () => loadPublished(true);
