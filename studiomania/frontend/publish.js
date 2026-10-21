// StudioMania — الخطوة 7: فولدر الفيديوهات الجاهزة والنشر المجدول

const pub = { exports: [], posts: [], platforms: {}, accounts: {}, service: null, videoId: null, editing: null, timer: null };
const PLATFORMS_KEY = "studiomania.platforms";
const POST_STATUS = {
  scheduled: ["متجدول", "scheduled"],
  sending: ["بيتبعت للنشر...", "active"],
  publishing: ["بيتنشر...", "active"],
  published: ["اتنشر", "published"],
  failed: ["فشل", "failed"],
};

async function initPublish() {
  const info = await api("/api/publisher");
  pub.platforms = info.platforms;
  pub.service = info.service;
  pub.accounts = info.accounts || {};
  pub.list = info.account_list || [];
  pub.creds = info.credentials || [];
  pub.soon = info.soon || {};
  pub.noPost = info.not_for_posts || [];
  const alert = $("publisherAlert");
  // الحسابات المربوطة بتبان في الإعدادات، فالشريط هنا بيظهر بس لو فيه مشكلة (خدمة النشر مش متوصّلة أو مقدرش يوصل لها)
  alert.hidden = info.service === "mock" || (info.service === "zernio" && !info.accounts_error);
  alert.className = "alert " + (info.service === "zernio" && !info.accounts_error ? "info" : "warn");
  if (!info.service) {
    alert.innerHTML = `⚠️ خدمة النشر لسه مش متوصّلة. تقدر تجدول البوستات عادي، وأول ما تتوصّل البرنامج هيبعتهم لوحده.`;
  } else if (info.accounts_error) {
    alert.textContent = `⚠️ ${info.accounts_error}`;
  }
  renderAccounts();
  renderPlatformBoxes();
  connectReturn();
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
      (e) => `<div class="ready ${e.id === pub.videoId ? "selected" : ""}" data-id="${e.id}" title="دوس عشان تجدوله">
        <div class="ready-art">${lightVideo(e.url, "muted playsinline loop")}<span class="ready-dur">${fmtDuration(e.duration)}</span><i class="ready-tick" aria-hidden="true"></i>${typeof BrainRate !== "undefined" ? BrainRate.html({ kind: "video", what: e.name, ref: `exp:${e.id}`, compact: true }) : ""}</div>
        <div class="body">
          <div class="name" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</div>
          <div class="meta">${e.id === pub.videoId ? `<span class="st-pick">مختار للجدولة</span>` : scheduled.has(e.id) ? `<span class="st-sched">متجدول</span>` : `<span>جاهز</span>`}
            <span class="pill">${e.source === "upload" ? "من برا" : "من المونتاج"}</span></div>
          <div class="acts">
            <button class="btn sm primary" data-act="pick">جدول</button>
            <a class="btn sm" href="${e.download_url}" download="${escapeHtml(e.name)}.mp4" title="تحميل">⬇</a>
            <button class="btn sm" data-act="rename" title="تغيير الاسم">✎</button>
            <button class="btn sm danger" data-act="delete" title="حذف">✕</button>
          </div>
        </div>
      </div>`
    )
    .join("");
}

// الفيديو بيشتغل من غير صوت وإنت واقف عليه، والدوسة على الكارت بتختاره للجدولة
$("readyGrid").addEventListener("mouseover", (e) => {
  const v = e.target.closest(".ready-art")?.querySelector("video");
  if (v && v.paused) { v.preload = "auto"; v.play().catch(() => {}); }
});
$("readyGrid").addEventListener("mouseout", (e) => {
  const art = e.target.closest(".ready-art");
  if (art && !art.contains(e.relatedTarget)) art.querySelector("video")?.pause();
});
$("pubAllPlat").onclick = () => {
  const boxes = [...$("postPlatforms").querySelectorAll("input")];
  const all = boxes.every((i) => i.checked);
  boxes.forEach((i) => (i.checked = !all));
  $("postPlatforms").dispatchEvent(new Event("change", { bubbles: true }));
};
$("readyGrid").addEventListener("click", async (e) => {
  const card = e.target.closest(".ready");
  const btn = e.target.closest("button[data-act]") || (card && !e.target.closest("a") ? card.querySelector('[data-act="pick"]') : null);
  if (!btn || !card) return;
  const ex = pub.exports.find((x) => x.id === card.dataset.id);
  try {
    if (btn.dataset.act === "pick") {
      pub.videoId = ex.id;
      renderReady();
      renderPostVideo();
      // الكابشن = اسم المشروع (اسم الفيديو). لو كنت كاتب كابشن بإيدك مش بيتغيّر
      const cap = $("postCaption").value.trim();
      if (!pub.editing && (!cap || cap === pub.autoCaption)) $("postCaption").value = pub.autoCaption = ex.name;
      $("postCaption").focus();
      pcAuto();   // الفحص قبل النشر بيشتغل لوحده
    }
    if (btn.dataset.act === "rename") {
      const name = (await uiPrompt("الاسم الجديد:", ex.name));
      if (!name || name === ex.name) return;
      await api(`/api/exports/${ex.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      await pubLoadExports();
      await pubLoadPosts();
    }
    if (btn.dataset.act === "delete") {
      if (!(await uiConfirm(`حذف "${ex.name}" من الفولدر؟`))) return;
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
// أيقونات المنصات (خطوط رفيعة) لمربعات «فين هينزل»
const PLAT_SVG = {
  instagram: "M8.5 4h7A4.5 4.5 0 0 1 20 8.5v7a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5v-7A4.5 4.5 0 0 1 8.5 4z M12 8.4a3.6 3.6 0 1 1 0 7.2a3.6 3.6 0 1 1 0-7.2z M17 6.8v.1",
  tiktok: "M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5 M14 4c.5 2.6 2.4 4.3 5 4.5",
  youtube: "M7 6h10a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4z M10.5 9.5v5l4.5-2.5z",
  facebook: "M14 8h2.5V4.5H14A3.5 3.5 0 0 0 10.5 8v2.5H8V14h2.5v6H14v-6h2.5l.5-3.5h-3V8z",
  x: "M5 5l14 14 M19 5L5 19",
  linkedin: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8 10v6 M8 7.5v.1 M11.5 16v-3.5a2 2 0 0 1 4 0V16 M11.5 10v6",
  threads: "M16.5 10.5c-.6-2.6-2.5-3.8-4.8-3.8-3 0-5.2 2.3-5.2 5.3s2.2 5.3 5.2 5.3c2.4 0 4.6-1.4 4.6-3.6 0-2.3-2.2-3-4-3-1.6 0-2.8.8-2.8 2s1.1 1.9 2.3 1.9c2.2 0 3-2 2.6-5",
  pinterest: "M12 4a8 8 0 0 0-2.9 15.5 M12 4a8 8 0 0 1 0 16 M10.5 20l1.8-7.5 M12.3 12.5c-1-.2-1.5-1-1.3-2a2 2 0 0 1 3.9.5c0 1.8-1 3.4-2.4 3.4",
  reddit: "M5 13.5c0-2.8 3.1-4.6 7-4.6s7 1.8 7 4.6-3.1 4.6-7 4.6-7-1.8-7-4.6z M9.5 13v.1 M14.5 13v.1 M9.8 15.6c1.3.8 3.1.8 4.4 0 M12 8.9l1-4 3 .8 M17.5 5.8v.1",
  bluesky: "M12 11c-1.5-3-4.5-6-7-6-1.5 0-1 3 0 5 .8 1.6 3 2 5 1.8-2.2.6-4 1.8-3 3.7 1.3 2.4 4 .7 5-2.5 1 3.2 3.7 4.9 5 2.5 1-1.9-.8-3.1-3-3.7 2 .2 4.2-.2 5-1.8 1-2 1.5-5 0-5-2.5 0-5.5 3-7 6z",
  snapchat: "M12 4c2.8 0 4.5 2 4.5 4.6v2.2l1.8-.4c.5.5.3 1.1-.5 1.4l-1.4.5c.6 1.6 1.8 2.8 3.3 3.2-.4.8-1.6 1.1-2.8 1.2l-.4 1.1c-1.2-.2-2.3-.1-3.2.6-.8.6-1.6.6-2.4 0-.9-.7-2-.8-3.2-.6l-.4-1.1c-1.2-.1-2.4-.4-2.8-1.2 1.5-.4 2.7-1.6 3.3-3.2l-1.4-.5c-.8-.3-1-.9-.5-1.4l1.8.4V8.6C7.5 6 9.2 4 12 4z",
  googlebusiness: "M4 9.5 5.5 5h13L20 9.5 M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0 M5.5 12v7h13v-7 M10 19v-4h4v4",
  telegram: "M4 11.5 19.5 5l-2.7 13.5-5-3.8-2.6 2.5.4-4 7.2-6.2-9 5.3z",
  whatsapp: "M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 8.4 18.5z M9.2 8.8c.3 2.4 2 4.3 4.6 5l1.1-1.2 1.7.8c-.2 1.1-1 1.6-2 1.6-3 0-5.9-2.9-5.9-5.9 0-1 .5-1.8 1.6-2l.8 1.7z",
};
// اللوجوهات الحقيقية للمنصات (Simple Icons، CC0) جوه مربع بلون المنصة
const PLAT_LOGO = {
  tiktok: ["M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z", "#000000", "#ffffff"],
  instagram: ["M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077", "#FF0069", "#ffffff"],
  youtube: ["M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z", "#FF0000", "#ffffff"],
  facebook: ["M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z", "#0866FF", "#ffffff"],
  x: ["M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z", "#000000", "#ffffff"],
  threads: ["M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z", "#000000", "#ffffff"],
  pinterest: ["M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z", "#BD081C", "#ffffff"],
  reddit: ["M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z", "#FF4500", "#ffffff"],
  bluesky: ["M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026", "#1185FE", "#ffffff"],
  snapchat: ["M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z", "#FFFC00", "#000000"],
  googlebusiness: ["M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z", "#4285F4", "#ffffff"],
  telegram: ["M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z", "#26A5E4", "#ffffff"],
  linkedin: ["M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V23h-4V8zm7.5 0h3.8v2.05h.05c.53-1 1.84-2.05 3.79-2.05 4.05 0 4.8 2.67 4.8 6.14V23h-4v-7.1c0-1.7-.03-3.88-2.36-3.88-2.36 0-2.72 1.84-2.72 3.76V23h-4V8z", "#0A66C2", "#ffffff"]
};
function pLogo(k, cls = "") {
  const l = PLAT_LOGO[k];
  if (!l) return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PLAT_SVG[k] || PLAT_SVG.x}"/></svg>`;
  return `<i class="plogo ${cls}" style="--pb:${l[1]};--pf:${l[2]}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${l[0]}"/></svg></i>`;
}
const platOf = (t) => String(t).split("@")[0];
const accOf = (id) => (pub.list || []).find((a) => a.id === id);
// اسم الهدف: المنصة، ولو عندك أكتر من حساب عليها بيتكتب الحساب كمان
function tLabel(t) {
  const [p, id] = String(t).split("@"), name = pub.platforms[p] || p, a = id && accOf(id);
  const many = (pub.list || []).filter((x) => x.platform === p).length > 1;
  return a && many ? `${name} (${a.username ? "@" + a.username : a.name})` : name;
}

// ---------- 🔗 حساباتك: كل المنصات، وأكتر من حساب على نفس المنصة، والربط والفصل من هنا ----------
function renderAccounts() {
  const box = $("pubAccounts");
  if (!box) return;
  box.hidden = !pub.service;
  if (!pub.service) return;
  const plats = Object.entries(pub.platforms);
  box.innerHTML = `<div class="pa-head"><h3>حساباتك</h3><small class="muted">اربط أي عدد من الحسابات على كل منصة، واختار تنشر على أنهي حساب وانت بتجدول.</small></div>
    <div class="pa-grid">${plats.filter(([k]) => pub.list.some((a) => a.platform === k)).map(([k, label]) => {
      const accs = pub.list.filter((a) => a.platform === k);
      return `<div class="pa-plat ${accs.length ? "on" : ""}">
        <div class="pa-ph">${pLogo(k)}<b>${escapeHtml(label)}</b>
          <button type="button" class="pa-add" data-paadd="${k}" title="اربط حساب ${escapeHtml(label)}">＋</button></div>
        ${accs.map((a) => `<div class="pa-acc${a.needs_reconnect ? " bad" : ""}">
          ${a.avatar ? `<img src="${escapeHtml(a.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<i>${escapeHtml((a.name || a.username || "?").slice(0, 1))}</i>`}
          <span><b dir="auto">${escapeHtml(a.name || a.username)}</b>${a.username ? `<small dir="ltr">@${escapeHtml(a.username)}</small>` : ""}
            ${a.needs_reconnect ? `<small class="err">محتاج يتربط تاني</small>` : ""}</span>
          ${a.needs_reconnect ? `<button type="button" class="pa-re" data-paadd="${k}">اربط تاني</button>` : ""}
          <button type="button" class="pa-x" data-padel="${escapeHtml(a.id)}" data-paname="${escapeHtml(a.name || a.username)}" title="افصل الحساب">✕</button></div>`).join("")}
      </div>`;
    }).join("")}</div>
    <div class="pa-more"><small class="muted">${pub.list.length ? "اربط منصة تانية:" : "اربط أول حساب:"}</small>
      ${plats.filter(([k]) => !pub.list.some((a) => a.platform === k)).map(([k, label]) => pub.soon[k]
        ? `<span class="pa-chip soon" title="${escapeHtml(pub.soon[k])}">${pLogo(k, "sm")}${escapeHtml(label)} <em>قريبًا</em></span>`
        : `<button type="button" class="pa-chip" data-paadd="${k}">${pLogo(k, "sm")}＋ ${escapeHtml(label)}${pub.noPost.includes(k) ? ` <em>للرسايل</em>` : ""}</button>`).join("")}</div>`;
}

// ---------- 🔗 الربط كله من جوه البرنامج ----------
// مربع بسيط بنفس شكل مربعات البرنامج، بيرجّع العنصر وفانكشن تقفله
function paModal(html) {
  const back = document.createElement("div");
  back.className = "ui-dlg pa-dlg";
  back.innerHTML = `<div class="ui-dlg-box" dir="rtl">${html}</div>`;
  const close = () => { back.remove(); document.removeEventListener("keydown", key, true); };
  const key = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", key, true);
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  back.addEventListener("click", (e) => { if (e.target.closest("[data-pa-close]")) close(); });
  document.body.appendChild(back);
  return { el: back, close };
}
const paRefresh = (info) => { pub.list = info.account_list || []; pub.accounts = info.accounts || {}; renderAccounts(); renderPlatformBoxes(); };
// المنصات اللي من غير تسجيل دخول: فورم عندنا
const PA_FORMS = {
  bluesky: { t: "اربط بلوسكاي", fields: [["identifier", "اسم الحساب أو الإيميل", "you.bsky.social", "ltr"], ["password", "باسورد التطبيق (App Password)", "xxxx-xxxx-xxxx-xxxx", "ltr"]],
    help: "من بلوسكاي: Settings ← Privacy and security ← App passwords ← Add App Password. انسخ الباسورد اللي بيطلع وحطه هنا (مش باسورد حسابك العادي).", url: "/api/publisher/connect/bluesky" },
  whatsapp: { t: "اربط واتساب بيزنس", fields: [["token", "Access Token (دايم، من System User)", "EAAG…", "ltr"], ["waba", "WhatsApp Business Account ID", "1234567890", "ltr"],
      ["phone", "Phone Number ID", "1098765432", "ltr"], ["pin", "PIN التحقق بخطوتين (لو مفعّله)", "6 أرقام", "ltr"]],
    help: `واتساب هنا للرسايل والرد على العملاء (الإنبوكس والرسايل الجماعية بقوالب متوافق عليها)، مش لنشر الفيديوهات.
محتاج: <b>WhatsApp Business Platform (Cloud API)</b> من Meta، مش تطبيق واتساب بيزنس العادي على الموبايل.
<ol><li>من business.facebook.com اعمل أو اختار WhatsApp Business Account، وضيف رقم مش متسجّل على واتساب عادي.</li>
<li>من Business Settings ← System Users اعمل System User واديله صلاحيات whatsapp_business_management و whatsapp_business_messaging.</li>
<li>اعمل له Access Token دايم.</li><li>من WhatsApp Manager ← Phone Numbers هتلاقي الـ WABA ID والـ Phone Number ID.</li></ol>`, url: "/api/publisher/connect/whatsapp" },
};
async function paForm(k) {
  if (k === "telegram") return paTelegram();
  const F = PA_FORMS[k];
  const m = paModal(`<p class="ui-dlg-msg"><b>${F.t}</b></p><div class="pa-help">${F.help}</div>
    ${F.fields.map(([n, l, ph, dir]) => `<label class="pa-f"><span>${l}</span><input class="ui-dlg-in" data-paf="${n}" dir="${dir}" placeholder="${escapeHtml(ph)}" ${n === "password" || n === "token" ? 'type="password"' : ""} autocomplete="off"></label>`).join("")}
    <div class="ui-dlg-acts"><button type="button" class="ui-dlg-ok" data-pa-go>اربط</button><button type="button" class="ui-dlg-no" data-pa-close>إلغاء</button></div>`);
  m.el.querySelector("input")?.focus();
  m.el.querySelector("[data-pa-go]").onclick = async (e) => {
    const body = {};
    m.el.querySelectorAll("[data-paf]").forEach((i) => (body[i.dataset.paf] = i.value.trim()));
    e.target.disabled = true; e.target.textContent = "⏳ بيربط…";
    try { paRefresh(await api(F.url, { method: "POST", ...jsonBody(body) })); m.close(); toast("✅ اتربط"); }
    catch (err) { toast(err.message, true); e.target.disabled = false; e.target.textContent = "اربط"; }
  };
}
// تيليجرام: كود بنطلّعه، والعميل بيضيف البوت أدمن في القناة ويبعتله الكود، وإحنا بنستنى لحد ما يتربط
async function paTelegram() {
  let r;
  try { r = await api("/api/publisher/connect/telegram", { method: "POST" }); } catch (err) { return toast(err.message, true); }
  const m = paModal(`<p class="ui-dlg-msg"><b>اربط قناة أو جروب تيليجرام</b></p>
    <ol class="pa-help"><li>ضيف <b dir="ltr">@${escapeHtml(r.bot || "")}</b> أدمن في القناة أو الجروب.</li>
      <li>ابعت للبوت الرسالة دي (فيها الكود واسم القناة): <code dir="ltr" class="pa-code">${escapeHtml(r.code || "")} @قناتك</code></li>
      <li>استنى هنا، أول ما يتربط هيظهر لوحده.</li></ol>
    <p class="pa-wait">⏳ مستني الربط… <small>(الكود شغال ${Math.round((r.expires_in || 900) / 60)} دقيقة)</small></p>
    <div class="ui-dlg-acts"><button type="button" class="ui-dlg-no" data-pa-close>اقفل</button></div>`);
  const tick = async () => {
    if (!m.el.isConnected) return;
    try {
      const st = await api(`/api/publisher/connect/telegram/${encodeURIComponent(r.code)}`);
      if (st.status === "connected") { m.close(); toast("✅ تيليجرام اتربط"); return paRefresh(await api("/api/publisher")); }
      if (st.status === "expired") { m.el.querySelector(".pa-wait").textContent = "⌛ الكود خلص. اقفل وابدأ تاني."; return; }
    } catch { /* بيحاول تاني */ }
    setTimeout(tick, 3000);
  };
  setTimeout(tick, 3000);
}
// رجع من تسجيل الدخول على المنصة: لو محتاج يختار صفحة/منظمة/مكان/بورد بنعرضله القايمة هنا
async function connectReturn() {
  const q = new URLSearchParams(location.search);
  if (!q.has("step") && !q.has("connected") && !q.has("error")) return;
  const params = Object.fromEntries(q.entries());
  history.replaceState(null, "", location.pathname + location.hash);   // اللينك مايفضلش فيه بيانات الربط
  if (params.error) return toast(`⚠️ الربط ماكملش: ${params.error_message || params.error}`, true);
  if (params.connected) { toast("✅ الحساب اتربط"); return paRefresh(await api("/api/publisher")); }
  let r;
  try { r = await api("/api/publisher/connect/pending", { method: "POST", ...jsonBody({ params }) }); } catch (err) { return toast(err.message, true); }
  const WHAT = { facebook: "الصفحة", instagram: "حساب إنستجرام", linkedin: "الحساب", googlebusiness: "المكان", pinterest: "البورد" };
  const opts = [...(r.personal ? [{ id: "personal", name: "حسابي الشخصي", sub: "تنشر باسمك انت" }] : []), ...r.options];
  const m = paModal(`<p class="ui-dlg-msg"><b>اختار ${WHAT[r.platform] || ""} اللي هتنشر عليه في ${escapeHtml(r.label)}</b></p>
    <div class="pa-opts">${opts.map((o) => `<button type="button" class="pa-opt" data-paopt="${escapeHtml(o.id)}">${o.img ? `<img src="${escapeHtml(o.img)}" alt="" referrerpolicy="no-referrer">` : `<i>${escapeHtml((o.name || "?").slice(0, 1))}</i>`}
      <span><b dir="auto">${escapeHtml(o.name)}</b>${o.sub ? `<small dir="auto">${escapeHtml(o.sub)}</small>` : ""}</span></button>`).join("") || `<p class="muted">مفيش حاجة تتختار. اتأكد إنك مدير على الصفحة أو المكان، وابدأ الربط تاني.</p>`}</div>
    <div class="ui-dlg-acts"><button type="button" class="ui-dlg-no" data-pa-close>إلغاء</button></div>`);
  m.el.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-paopt]");
    if (!b) return;
    m.el.querySelectorAll("[data-paopt]").forEach((x) => (x.disabled = true));
    b.classList.add("on");
    try { paRefresh(await api("/api/publisher/connect/select", { method: "POST", ...jsonBody({ sid: r.sid, choice: b.dataset.paopt }) })); m.close(); toast("✅ اتربط"); }
    catch (err) { toast(err.message, true); m.close(); }
  });
}
document.addEventListener("click", async (e) => {
  const add = e.target.closest("[data-paadd]"), del = e.target.closest("[data-padel]");
  if (!add && !del) return;
  if (pub.service === "mock" && !(add && ["bluesky", "telegram", "whatsapp"].includes(add.dataset.paadd))) return toast("ده وضع تجريبي: الربط الحقيقي بيشتغل لما خدمة النشر تتوصّل", true);
  try {
    if (add) {
      const k = add.dataset.paadd;
      if (pub.creds.includes(k)) return paForm(k);
      const r = await api("/api/publisher/connect", { method: "POST", ...jsonBody({ platform: k }) });
      if (r.form) return paForm(r.form);
      // تسجيل الدخول على المنصة نفسها في نفس الصفحة، وبعدها بيرجع هنا على طول (ولو محتاج يختار صفحة بيختار عندنا)
      location.assign(r.url);
    } else if ((await uiConfirm(`تفصل حساب «${del.dataset.paname}»؟ البوستات المتجدولة عليه مش هتنزل.`))) {
      const info = await api(`/api/publisher/accounts/${encodeURIComponent(del.dataset.padel)}`, { method: "DELETE" });
      pub.list = info.account_list || [];
      pub.accounts = info.accounts || {};
      renderAccounts(); renderPlatformBoxes();
      toast("اتفصل");
    }
  } catch (err) { toast(err.message, true); }
});
window.addEventListener("focus", async () => {
  if (!pub.waitLink) return;
  pub.waitLink = false;
  try {
    const info = await api("/api/publisher");
    pub.list = info.account_list || []; pub.accounts = info.accounts || {};
    renderAccounts(); renderPlatformBoxes();
  } catch { /* مش مهم */ }
});
function renderPlatformBoxes() {
  let saved = [];
  try { saved = JSON.parse(storageGet(PLATFORMS_KEY) || "[]"); } catch {}
  const keep = checkedPlatforms();
  if (keep.length) saved = keep;
  // مع Zernio: مربع لكل حساب مربوط (ممكن أكتر من حساب على نفس المنصة) · من غير Zernio: مربع لكل منصة
  if (pub.list?.length) {
    $("postPlatforms").innerHTML = pub.list.filter((a) => !(pub.noPost || []).includes(a.platform)).map((a) => {
      const v = `${a.platform}@${a.id}`, on = saved.includes(v) || saved.includes(a.platform) && pub.accounts[a.platform]?.id === a.id;
      const many = pub.list.filter((x) => x.platform === a.platform).length > 1;
      return `<label title="${escapeHtml(pub.platforms[a.platform] || a.platform)} · ${escapeHtml(a.name || a.username)}" class="plat acc">
        <input type="checkbox" value="${escapeHtml(v)}" ${on ? "checked" : ""}>
        ${pLogo(a.platform)}
        <span>${escapeHtml(pub.platforms[a.platform] || a.platform)}</span>${many || a.username ? `<em dir="ltr">${escapeHtml(a.username ? "@" + a.username : a.name)}</em>` : ""}</label>`;
    }).join("");
    return;
  }
  const needLink = pub.service === "zernio";
  $("postPlatforms").innerHTML = Object.entries(pub.platforms)
    .map(([k, label]) => {
      const off = needLink && !pub.accounts[k];
      return `<label title="${off ? "الحساب ده مش مربوط" : escapeHtml(label)}" class="plat ${off ? "off" : ""}">
        <input type="checkbox" value="${k}" ${saved.includes(k) && !off ? "checked" : ""} ${off ? "disabled" : ""}>
        ${pLogo(k)}<span>${label}</span></label>`;
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
    : `<span class="muted">اختار فيديو من الفولدر (دوس «جدول»)</span>`;
  // التاج: حساب شخصية المشروع بيتحط لوحده (إلا لو انت كتبت حاجة بإيدك)
  const coachTag = ex?.coach?.instagram ? `@${ex.coach.instagram}` : "";
  if (!pub.tagsTouched && !pub.editing) {
    $("igTags").value = coachTag;
    // الفيديو عن شخصية ليها حساب: كولاب معاه تلقائي (تقدر تشيله)
    $("igCollab").checked = !!coachTag;
  }
  $("igTagsHint").textContent = ex?.coach
    ? (ex.coach.instagram ? `الشخصية: ${ex.coach.name} (@${ex.coach.instagram})` : `⚠️ الشخصية ${ex.coach.name} مالهاش حساب إنستجرام متسجل. ضيفه من صفحة الشخصيات`)
    : "اكتب الحسابات اللي عايز تعملها تاج، وافصل بينهم بفاصلة.";
  // الغلاف بيتختار من نفس الفيديو
  const v = $("coverVideo");
  if (ex && v.dataset.src !== ex.url) {
    v.dataset.src = ex.url;
    v.src = ex.url;
    $("coverRange").max = Math.round(ex.duration * 1000);
    // الغلاف دايمًا قبل آخر فريم بثانيتين (تقدر تغيّره)
    if (!pub.editing) { $("coverOn").checked = true; setCover(coverDefaultMs(ex.duration)); algoPack(false); }
  }
  renderPostExtras();
}

const coverDefaultMs = (dur) => Math.max(0, Math.round((dur - 2) * 1000));
// ⚡ وضع الخوارزمية: الكابشن والغلاف وعلامة AI بيتجهزوا لوحدهم أول ما تختار الفيديو (تقدر تعدّلهم)
async function algoPack(force) {
  const id = pub.videoId, note = $("pubAlgo");
  if (!id) return force && toast("اختار فيديو من الفولدر الأول", true);
  if (!force && $("postCaption").value.trim()) return;
  if (force) { note.hidden = false; note.textContent = "⏳ بيكتب الكابشن…"; }
  try {
    const pl = checkedPlatforms().map(platOf)[0] || "";
    const r = await api("/api/algo/post-pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ export_id: id, platform: pl }) });
    if (pub.videoId !== id || pub.editing) return;
    if (!r.on) { note.hidden = !force; note.textContent = "⚡ وضع الخوارزمية مقفول (افتحه من عقل البراند ← منافسينك في المجال)"; return; }
    if (force || !$("postCaption").value.trim()) $("postCaption").value = r.caption;
    $("coverOn").checked = true;
    setCover(r.cover_ms);
    pub.notAi = !r.ai;
    note.hidden = false;
    note.textContent = `⚡ اتجهز بالخوارزمية: كابشن (هوك تاني${r.cta ? " + دعوة الخطة" : ""} + هاشتاجات المجال) · الغلاف ${r.cover_hook ? "على فريم الهوك" : "قبل الآخر بثانيتين"}${r.ai ? " · 🤖 علامة AI" : ""}. عدّل براحتك.`;
    renderPostExtras();
  } catch (err) {
    note.hidden = !force;
    note.textContent = "";
    if (force) toast(err.message, true);
  }
}
$("algoCaption").onclick = () => algoPack(true);

// ---------- إنستجرام: التاج والكولاب · والغلاف لإنستجرام وتيك توك ----------
function renderPostExtras() {
  const pl = checkedPlatforms();
  const ig = pl.some((v) => platOf(v) === "instagram"), tt = pl.some((v) => platOf(v) === "tiktok");
  // تاج إنستجرام والغلاف: كبسولة صغيرة جنب «كابشن البراند»، والإعدادات بتتفتح لما تدوس عليها (زي البروتوتايب)
  const tagged = !!$("igTags").value.trim() || $("igCollab").checked;
  $("igOptsChip").hidden = !ig;
  $("igOptsChip").classList.toggle("on", ig && (pub.showIg || tagged));
  $("igOptsChip").textContent = tagged ? "✓ تاج الكوتش + كولاب" : "تاج الكوتش + كولاب";
  $("igOpts").hidden = !ig || !pub.showIg;
  $("coverChip").hidden = !(ig || tt) || !pub.videoId;
  $("coverChip").classList.toggle("on", !!pub.showCover);
  $("coverChip").textContent = $("coverOn").checked ? "✓ الغلاف" : "الغلاف";
  $("coverOpts").hidden = !(ig || tt) || !pub.videoId || !pub.showCover;
  $("coverFor").textContent = ig && tt ? "(إنستجرام وتيك توك)" : ig ? "(إنستجرام)" : "(تيك توك)";
  $("coverPick").hidden = !$("coverOn").checked;
  if (typeof PC_CTA !== "undefined") renderPubCheck();
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

// ✨ كابشن البراند: القالب بتاع عقل البراند ({caption} {cta} {link})، واللي مكتوب يتحط مكان {caption}
function brandCaption(text) {
  const c = clientx.cur || {};
  const tpl = (c.caption || "").trim() || (c.cta || c.link ? "{caption}\n\n{cta}\n{link}" : "");
  if (!tpl) return null;
  return tpl.replaceAll("{caption}", text.trim()).replaceAll("{cta}", c.cta || "").replaceAll("{link}", c.link || "")
    .split("\n").map((l) => l.trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
$("brandCaption").onclick = () => {
  const out = brandCaption($("postCaption").value);
  if (out === null) return toast("مفيش كابشن افتراضي في عقل البراند (تاب «التسليم»)", true);
  $("postCaption").value = out;
  $("postCaption").focus();
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
    dm_on: $("dmOn").checked,
    dm_words: $("dmWords").value.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
    dm_message: $("dmMessage").value,
    dm_reply: $("dmReply").value,
  };
}

// 💬 «علّق بكلمة»: أول مرة بتتفتح بتتملى من خطة المحتوى ولينك الواتساب
let dmDef = null;
async function dmFill() {
  $("dmBox").hidden = !$("dmOn").checked;
  if (!$("dmOn").checked || $("dmWords").value || $("dmMessage").value) return;
  try { dmDef = dmDef || (await api("/api/dm/defaults")); } catch { dmDef = {}; }
  $("dmWords").value = dmDef.word || "";
  $("dmMessage").value = dmDef.message || "";
  $("dmReply").value = dmDef.reply || "";
}
$("dmOn").addEventListener("change", dmFill);
// الكابشن فيه «اكتب «كلمة» في كومنت»؟ الرد الأوتوماتيك بيتفعّل لوحده (زي السيرفر بالظبط)
function dmDetect(c) {
  for (const line of String(c || "").split("\n")) {
    if (!/(علّ?ق|علِّق|اكتب|كومنت|تعليق|comment)/i.test(line)) continue;
    const m = line.match(/[«"“'‘]\s*([^»"”'’\n]{1,30}?)\s*[»"”'’]/) || line.match(/كلمة\s+([\u0600-\u06FF\w]{2,30})/) || line.match(/\b(?:comment|type)\s+([A-Za-z0-9]{2,30})\b/i);
    if (m) return m[1].trim();
  }
  return "";
}
$("postCaption").addEventListener("input", async () => {
  const w = dmDetect($("postCaption").value);
  $("dmAuto").hidden = !w;
  if (!w || $("dmOn").checked) return;
  $("dmOn").checked = true;
  await dmFill();
  $("dmWords").value = w;
});
$("dmCta").addEventListener("click", () => {
  const w = $("dmWords").value.split(/[,،]/)[0]?.trim();
  if (!w) return toast("اكتب الكلمة الأول", true);
  const tt = [...$("postPlatforms").querySelectorAll("input:checked")].some((i) => platOf(i.value) === "tiktok");
  const lines = [`💬 اكتب «${w}» في كومنت ويوصلك على الخاص`];
  if (tt && dmDef?.number) lines.push(`📩 على تيك توك: ابعت «${w}» على الواتساب ${dmDef.number}`);
  else if (tt) lines.push(`📩 على تيك توك: ابعتلنا «${w}» في رسالة`);
  const c = $("postCaption");
  c.value = `${c.value.trim()}\n\n${lines.join("\n")}`.trim();
  c.dispatchEvent(new Event("input", { bubbles: true }));
});

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
  if (!b) return;
  setWhen(QUICK[Number(b.dataset.q)][1]());
  $("quickTimes").querySelectorAll("[data-q]").forEach((x) => x.classList.toggle("on", x === b));   // الميعاد اللي اتختار بيبان غامق
});
$("postWhen").addEventListener("input", () => $("quickTimes").querySelectorAll(".on").forEach((x) => x.classList.remove("on")));

function resetPostForm() {
  pub.editing = null;
  pub.notAi = false;
  $("pubAlgo").hidden = true;
  $("postFormTitle").textContent = "جدولة بوست";
  $("postSubmit").textContent = "جدول";
  $("postCancel").hidden = true;
  $("postCaption").value = "";
  pub.tagsTouched = false;
  $("igCollab").checked = false;
  $("dmOn").checked = false; $("dmBox").hidden = true; $("dmAuto").hidden = true;
  ["dmWords", "dmMessage", "dmReply"].forEach((k) => ($(k).value = ""));
  setWhen(nextSlot());
  renderPostVideo();
  const ex = pub.exports.find((x) => x.id === pub.videoId);
  $("coverOn").checked = !!ex;
  if (ex) setCover(coverDefaultMs(ex.duration));
  renderPostExtras();
  if (ex) algoPack(false);
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
  const names = platforms.map(tLabel).join("، ");
  if (now && !(await uiConfirm(`البوست هينزل دلوقتي على: ${names}. تكمّل؟`))) return;
  if (!now && when < new Date() && !(await uiConfirm("الميعاد ده عدّى، فالبوست هيتنشر على طول. تكمّل؟"))) return;
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
  if (typeof renderCal === "function") renderCal();
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
      if (p.status === "scheduled" && p.sent) label = "متجدول للنشر ✓";
      const when = new Date(p.scheduled_at).toLocaleString(UI_LOCALE(), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
      return `<li data-id="${p.id}" class="${p.status === "failed" ? "failed" : ""}">
        ${p.image_url ? `<img class="post-thumb" src="${p.image_url}" alt="">` : p.export_url ? lightVideo(p.export_url, "muted") : ""}
        <div class="info">
          <span class="when">${when}</span>
          <span>${escapeHtml(p.export_name || (p.from_zernio ? "🔗 من حساباتك" : "⚠️ الفيديو اتمسح"))} · ${p.platforms.map(tLabel).join("، ")}</span>
          ${p.caption ? `<span class="cap" title="${escapeHtml(p.caption)}">${escapeHtml(p.caption)}</span>` : ""}
          ${p.options?.ig_tags?.length ? `<span class="tags" dir="ltr">🏷️ ${p.options.ig_tags.map((t) => `@${escapeHtml(t)}`).join(" ")}${p.options.ig_collab ? " · 🤝" : ""}</span>` : ""}
          ${p.options?.dm ? `<span class="tags" title="${escapeHtml(Object.entries(p.options.dm_auto || {}).map(([k, v]) => `${k}: ${v.error || "شغال"}`).join(" · "))}">💬 «${escapeHtml(p.options.dm.words[0])}»${p.options.dm_auto ? (Object.values(p.options.dm_auto).some((v) => v.error) ? " ⚠️" : " ✓ شغال") : ""}</span>` : ""}
          ${p.error ? `<span class="err">${escapeHtml(p.error)}</span>` : ""}
        </div>
        <span class="pill ${cls}">${label}</span>
        <span class="acts">
          ${postEditable(p) ? `<button class="btn sm" data-act="edit">✎ تعديل</button>` : ""}
          ${p.status === "failed" ? `<button class="btn sm" data-act="retry">↻ إعادة المحاولة</button>` : ""}
          ${p.status !== "publishing" && p.status !== "sending" ? `<button class="btn sm danger" data-act="delete">${p.status === "scheduled" ? "إلغاء" : "حذف"}</button>` : ""}
        </span>
      </li>`;
    })
    .join("");
}
$("postFilter").addEventListener("change", renderPosts);

$("postsList").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  postAction(btn.dataset.act, pub.posts.find((x) => x.id === btn.closest("li").dataset.id));
});

// بيستخدمها كمان الكالندر (calendar.js)
function postEditable(p) {
  return !p.carousel_id && (p.status === "scheduled" || (p.status === "failed" && !p.sent));
}

function editPost(p) {
  pub.editing = p.id;
  pub.videoId = p.export_id;
  $("postFormTitle").textContent = "تعديل البوست";
  $("postSubmit").textContent = "💾 حفظ التعديل";
  $("postCancel").hidden = false;
  $("postCaption").value = p.caption;
  // البوستات القديمة متسجّلة بالمنصة بس («tiktok»): بتتعلّم على أول حساب للمنصة دي
  $("postPlatforms").querySelectorAll("input").forEach((i) => (i.checked = p.platforms.includes(i.value)
    || (p.platforms.includes(platOf(i.value)) && pub.accounts[platOf(i.value)]?.id === i.value.split("@")[1])));
  setWhen(new Date(p.scheduled_at));
  const o = p.options || {};
  $("igTags").value = (o.ig_tags || []).map((t) => `@${t}`).join(", ");
  pub.tagsTouched = true;
  $("igCollab").checked = !!o.ig_collab;
  $("coverOn").checked = o.cover_ms != null;
  $("dmOn").checked = !!o.dm;
  $("dmWords").value = (o.dm?.words || []).join("، ");
  $("dmMessage").value = o.dm?.message || "";
  $("dmReply").value = o.dm?.reply || "";
  $("dmBox").hidden = !o.dm;
  renderReady();
  renderPostVideo();
  if (o.cover_ms != null) setCover(o.cover_ms);
  $("postForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

// بيرجّع true لو اتعمل
async function postAction(act, p) {
  if (!p) return false;
  try {
    if (act === "edit") editPost(p);
    if (act === "retry") {
      await api(`/api/posts/${p.id}/retry`, { method: "POST" });
      await pubLoadPosts();
    }
    if (act === "delete") {
      if (!(await uiConfirm(p.status === "scheduled" ? "إلغاء البوست ده؟" : "حذف البوست ده من القايمة؟"))) return false;
      await api(`/api/posts/${p.id}`, { method: "DELETE" });
      if (pub.editing === p.id) resetPostForm();
      await pubLoadPosts();
      if (pub.service === "zernio") loadRemoteOrphans();
    }
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

viewHooks["7"] = initPublish;

// ---------- بوستات متجدولة على Zernio ومش في القايمة هنا ----------
async function loadRemoteOrphans(verbose = false) {
  const box = $("remoteOrphans");
  try {
    const list = await api("/api/posts/remote");
    box.hidden = !list.length;
    if (verbose && !list.length) toast("✅ كل البوستات المتجدولة موجودة هنا");
    const when = (iso) => (iso ? new Date(iso).toLocaleString(UI_LOCALE(), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }) : "");
    box.innerHTML = list.length ? `<p class="orphans-title">⚠️ فيه ${list.length} بوست متجدول على حساباتك ومش في القايمة هنا</p>` + list.map((o) => `
      <div class="orphan" data-rid="${escapeHtml(o.id)}">
        ${o.media_url ? lightVideo(escapeHtml(o.media_url), "muted") : ""}
        <div class="info"><span class="when">${when(o.scheduled_for)}</span>
          <span>${o.platforms.map(tLabel).join("، ")}</span>
          ${o.content ? `<span class="cap">${escapeHtml(o.content)}</span>` : ""}</div>
        <span class="acts"><button class="btn sm" data-oact="adopt">＋ ضيفه للقايمة</button>
          <button class="btn sm danger" data-oact="cancel">✕ الغيه</button></span>
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
      if (!(await uiConfirm("تلغي البوست ده؟ مش هيتنشر."))) return;
      await api(`/api/posts/remote/${encodeURIComponent(rid)}/cancel`, { method: "POST" });
      toast("✅ اتلغى");
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
        if (x.url) return `<a class="pl-link ${ok ? "" : "bad"}" href="${escapeHtml(x.url)}" target="_blank" rel="noopener">${pLogo(x.key, "xs")} ${escapeHtml(name)} ↗</a>`;
        return `<span class="pl-link ${ok ? "nolink" : "bad"}" title="${escapeHtml(x.error || "")}">${pLogo(x.key, "xs")} ${escapeHtml(name)}${ok ? "" : " ✕"}</span>`;
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

$("igOptsChip").onclick = () => { pub.showIg = !pub.showIg; renderPostExtras(); };
$("coverChip").onclick = () => { pub.showCover = !pub.showCover; renderPostExtras(); };
$("igTags").addEventListener("change", renderPostExtras);
$("igCollab").addEventListener("change", renderPostExtras);

// ✅ شيك ليست النشر (بروتوكول النشر من العقل العام): بتتحسب وانت بتكتب، ببلاش ومن غير موديل.
// وزرار «📡 افحص الكابشن» بيقيّمه بالموديل ويقترح كابشن أحسن.
var PC_BAD_TAGS = /#(fyp|foryou|foryoupage|viral|explore|explorepage|trending|اكسبلور|إكسبلور|ترند|فيرال)\b/i;
var PC_GREET = /^(\s*)(اهلا|أهلا|هلا|السلام|مرحبا|هاي|hi|hello|hey|صباح|مساء)/i;
var PC_CTA = /(علّق|علق|اكتب|كومنت|تعليق|احفظ|شارك|ابعت|تابع|اللينك|الرابط|link|comment|save|follow|DM|رسالة|اطلب|حمّل|حمل|سجّل|سجل|احجز)/i;
var PC_AI = /(ذكاء صناعي|ذكاء اصطناعي|#ai\b|AI generated|بالذكاء)/i;
function pubChecks() {
  const cap = $("postCaption").value.trim(), first = cap.split("\n").find((l) => l.trim()) || "";
  const tags = cap.match(/#[\p{L}\p{N}_]+/gu) || [];
  const fw = first.replace(/#[\p{L}\p{N}_]+/gu, "").trim().split(/\s+/).filter(Boolean).length;
  const pl = checkedPlatforms(), visual = pl.some((v) => ["instagram", "tiktok"].includes(platOf(v)));
  return [
    { ok: !!cap && fw > 0 && fw <= 14 && !PC_GREET.test(first), t: "أول سطر هوك تاني (مختصر، بيكمّل الفضول، مش «أهلًا بيكم»)", tip: "آخر حاجة بيقراها قبل ما يسكرول: سيب سؤال مفتوح أو كمّل وعد الفيديو" },
    { ok: PC_CTA.test(cap), t: "فيه دعوة واضحة (علّق بكلمة، احفظ، اللينك…)", tip: "دعوة واحدة مطابقة لموضوع الفيديو" },
    { ok: tags.length >= 3 && tags.length <= 5, t: `٣–٥ هاشتاجات من المجال (دلوقتي ${tags.length})`, tip: "الهاشتاج تأثيره ضعيف؛ ٣–٥ محددين كفاية" },
    { ok: !tags.some((x) => PC_BAD_TAGS.test(x)), t: "من غير #fyp #viral #explore", tip: "بيودّوا الفيديو لناس مش مهتمة فوقت المشاهدة يقل" },
    ...(visual && pub.videoId ? [{ ok: $("coverOn").checked, t: "الغلاف متختار بنفسك (فريم مثير)", tip: "فرصة هوك زيادة في البروفايل", act: "cover" }] : []),
    { ok: PC_AI.test(cap) || !!pub.notAi, t: "لو الفيديو معمول بالذكاء الصناعي معلّم عليه", tip: "مفيش عقاب، والمنصة ممكن تشيله لو ماعلّمتش", act: "ai" },
    { ok: null, t: "الترجمة في نص الشاشة ومش مستخبية تحت الكابشن والأزرار", tip: "اتأكد من الفيديو نفسه" },
    { ok: null, t: "بعد النشر: رد على أول ٣٠ كومنت", tip: "النقاش في الكومنتات بيطوّل وقت المشاهدة" },
  ];
}
function renderPubCheck() {
  const box = $("pubCheck");
  if (!box) return;
  const list = pubChecks(), scored = list.filter((c) => c.ok !== null), n = scored.filter((c) => c.ok).length;
  box.innerHTML = `<div class="pc-head"><b>✅ قبل ما تنشر</b><span class="num ${n === scored.length ? "ok" : ""}">${n}/${scored.length}</span>
      <button type="button" class="btn sm" id="pcReview" title="الموديل بيقيّم الكابشن بقواعد الخوارزميات ويقترح واحد أحسن">📡 افحص الكابشن</button></div>
    <ul>${list.map((c) => `<li class="${c.ok === null ? "info" : c.ok ? "ok" : "no"}" title="${escapeHtml(c.tip)}"><i>${c.ok === null ? "•" : c.ok ? "✓" : "✕"}</i><span>${escapeHtml(c.t)}</span>
      ${c.act === "cover" && !c.ok ? `<button type="button" class="btn xs" data-pc="cover">اختار الغلاف</button>` : ""}
      ${c.act === "ai" && !c.ok ? `<button type="button" class="btn xs" data-pc="ai">🤖 علّم إنه AI</button><button type="button" class="btn xs" data-pc="notai">مش AI</button>` : ""}</li>`).join("")}</ul>
    <div id="pcOut"></div>`;
}
$("postCaption").addEventListener("input", renderPubCheck);
// 📡 «افحص قبل النشر» بقى أوتوماتيك: لما الكابشن يقف عن التغيير شوية بيتفحص بقواعد الخوارزميات لوحده (مرة لكل كابشن)
let pcAutoT = 0, pcAutoLast = "";
function pcAuto() {
  clearTimeout(pcAutoT);
  pcAutoT = setTimeout(() => {
    const cap = $("postCaption").value.trim();
    if (cap.length < 20 || cap === pcAutoLast || !pub.videoId) return;
    pcAutoLast = cap;
    $("pcReview")?.click();
  }, 2500);
}
$("postCaption").addEventListener("input", pcAuto);
$("postCaption").addEventListener("change", pcAuto);
$("coverOn").addEventListener("change", renderPubCheck);
$("postPlatforms").addEventListener("change", renderPubCheck);
$("pubCheck").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-pc]");
  if (b?.dataset.pc === "cover") { pub.showCover = true; $("coverOn").checked = true; $("coverOn").dispatchEvent(new Event("change")); return; }
  if (b?.dataset.pc === "ai") { const c = $("postCaption"); c.value = `${c.value.trimEnd()}${c.value.trim() ? "\n\n" : ""}🤖 الفيديو معمول بالذكاء الصناعي`; return renderPubCheck(); }
  if (b?.dataset.pc === "notai") { pub.notAi = true; return renderPubCheck(); }
  const use = e.target.closest("[data-pcuse]");
  if (use) { $("postCaption").value = use.dataset.pcuse; return renderPubCheck(); }
  if (!e.target.closest("#pcReview")) return;
  const cap = $("postCaption").value.trim();
  if (cap.length < 8) return toast("اكتب الكابشن الأول", true);
  const out = $("pcOut");
  out.innerHTML = `<p class="muted">⏳ بيفحص…</p>`;
  try {
    const pl = checkedPlatforms().map(platOf)[0] || "";
    const r = await api("/api/algo/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: cap, kind: "caption", platform: pl }) });
    out.innerHTML = `<div class="pc-rev"><b class="num">${r.score}/100</b> ${escapeHtml(r.verdict)}
      ${r.top_fixes.length ? `<ol>${r.top_fixes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ol>` : ""}
      ${r.caption ? `<div class="pc-sug"><span>${escapeHtml(r.caption)}</span><button type="button" class="btn sm primary" data-pcuse="${escapeHtml(r.caption)}">استخدمه</button></div>` : ""}</div>`;
  } catch (err) { out.innerHTML = ""; toast(err.message, true); }
});
renderPubCheck();
