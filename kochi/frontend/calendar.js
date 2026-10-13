// StudioMania — كالندر المواعيد: البوستات المتجدولة بالأسبوع أو بالشهر.
// تدوس على بوست تشوفه وتغيّر ميعاده أو تلغيه، أو تسحبه ليوم تاني.
// الفيديوهات اللي الأوتوبايلوت لسه بيحضّرها بتظهر بخط متقطّع في ميعادها.

const CAL_KEY = "studiomania.calView";
const cal = { view: "list", cursor: new Date(), jobs: [], tz: 3, jobsAt: 0 };
try { cal.view = localStorage.getItem(CAL_KEY) || "list"; } catch {}
if (!["list", "week", "month"].includes(cal.view)) cal.view = "list";

const CAL_MAX = 3; // كام بوست يظهر في اليوم قبل «+ كمان»
const CAL_DOT = { scheduled: "sch", sending: "act", publishing: "act", published: "pub", failed: "bad" };

const calKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const calDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const calAdd = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// الأسبوع بيبدأ السبت
const calWeekStart = (d) => calAdd(calDay(d), -((d.getDay() + 1) % 7));
const calTime = (d) => d.toLocaleTimeString(UI_LOCALE(), { hour: "numeric", minute: "2-digit" });
const calFull = (d) => d.toLocaleString(UI_LOCALE(), { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

// فيديوهات الأوتوبايلوت اللي لسه ماتجدولتش (ميعادها بتوقيت السعودية من غير منطقة زمنية)
async function calLoadJobs() {
  if (Date.now() - cal.jobsAt < 10000) return;
  cal.jobsAt = Date.now();
  try {
    const st = await api("/api/autopilot");
    cal.tz = Number(st.settings?.tz_offset ?? 3);
    cal.jobs = (st.jobs || []).filter((j) => j.at && !["done", "failed", "stopped"].includes(j.step));
  } catch {
    cal.jobs = [];
  }
}
function calJobDate(j) {
  const sign = cal.tz < 0 ? "-" : "+";
  const h = String(Math.floor(Math.abs(cal.tz))).padStart(2, "0");
  const m = String(Math.round((Math.abs(cal.tz) % 1) * 60)).padStart(2, "0");
  return new Date(`${j.at.slice(0, 16)}${sign}${h}:${m}`);
}

function calItems() {
  const items = pub.posts.map((p) => ({ kind: "post", p, when: new Date(p.scheduled_at) }));
  for (const j of cal.jobs) items.push({ kind: "job", j, when: calJobDate(j) });
  const byDay = {};
  for (const it of items) {
    if (isNaN(it.when)) continue;
    (byDay[calKey(it.when)] ||= []).push(it);
  }
  for (const k in byDay) byDay[k].sort((a, b) => a.when - b.when);
  return byDay;
}

function calPlatIcons(keys) {
  return keys.map((k) => `<i class="cal-pl" title="${escapeHtml(pub.platforms[k] || k)}">${PLATFORM_ICON[k] || "•"}</i>`).join("");
}

function calCard(it, compact) {
  if (it.kind === "job") {
    const j = it.j;
    return `<div class="cal-card job" title="${escapeHtml(`🤖 الأوتوبايلوت لسه بيحضّره: ${AP_STEPS?.[j.step] || j.step}`)}">
      <span class="cal-t">${calTime(it.when)}</span><span class="cal-n">🤖 ${escapeHtml(j.name || "")}</span></div>`;
  }
  const p = it.p;
  const thumb = p.image_url || thumbOf(p.export_url || "");
  const drag = postEditable(p) ? ' draggable="true"' : "";
  if (compact) {
    return `<div class="cal-card mini ${p.status}" data-pid="${p.id}"${drag} title="${escapeHtml(p.export_name || p.caption || "")}">
      <b class="cal-dot ${CAL_DOT[p.status] || ""}"></b><span class="cal-t">${calTime(it.when)}</span>${calPlatIcons(p.platforms)}</div>`;
  }
  return `<div class="cal-card ${p.status}" data-pid="${p.id}"${drag}>
    ${thumb ? `<img src="${thumb}" alt="" loading="lazy">` : `<div class="cal-noimg">🎬</div>`}
    <div class="cal-meta"><b class="cal-dot ${CAL_DOT[p.status] || ""}"></b><span class="cal-t">${calTime(it.when)}</span>${calPlatIcons(p.platforms)}</div>
    <span class="cal-n">${escapeHtml(p.export_name || p.caption || (p.from_zernio ? "🔗 من Zernio" : ""))}</span>
  </div>`;
}

function calDayCell(date, items, compact, extraCls = "") {
  const today = calKey(date) === calKey(new Date());
  const past = calDay(date) < calDay(new Date());
  const key = calKey(date);
  const open = cal.openDay === key;
  const shown = open ? items : items.slice(0, CAL_MAX);
  const more = items.length - shown.length;
  return `<div class="cal-day ${extraCls}${today ? " today" : ""}${past ? " past" : ""}" data-day="${key}">
    <div class="cal-dh">${compact ? "" : `<span class="cal-wd">${date.toLocaleDateString(UI_LOCALE(), { weekday: "short" })}</span>`}<span class="cal-dn">${date.getDate()}</span></div>
    <div class="cal-list">${shown.map((it) => calCard(it, compact)).join("")}</div>
    ${more > 0 ? `<button type="button" class="cal-more" data-more="${key}">+${more} كمان</button>` : ""}
    ${open && items.length > CAL_MAX ? `<button type="button" class="cal-more" data-more="">أقل</button>` : ""}
    ${past ? "" : `<button type="button" class="cal-add" data-add="${key}" title="جدول بوست في اليوم ده">＋</button>`}
  </div>`;
}

function renderCal() {
  const box = $("postsCal");
  if (!box) return;
  $("calViews").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === cal.view));
  const list = cal.view === "list";
  box.hidden = list;
  $("postsList").hidden = !list;
  $("postFilter").hidden = !list;
  if (list) {
    $("postsEmpty").hidden = $("postsList").children.length > 0;
    return;
  }
  $("postsEmpty").hidden = true;
  const byDay = calItems();
  let title, body;
  if (cal.view === "week") {
    const start = calWeekStart(cal.cursor);
    const days = Array.from({ length: 7 }, (_, i) => calAdd(start, i));
    const end = days[6];
    title = start.getMonth() === end.getMonth()
      ? `${start.getDate()} – ${end.toLocaleDateString(UI_LOCALE(), { day: "numeric", month: "long", year: "numeric" })}`
      : `${start.toLocaleDateString(UI_LOCALE(), { day: "numeric", month: "short" })} – ${end.toLocaleDateString(UI_LOCALE(), { day: "numeric", month: "short", year: "numeric" })}`;
    body = `<div class="cal-week">${days.map((d) => calDayCell(d, byDay[calKey(d)] || [], false)).join("")}</div>`;
  } else {
    const first = new Date(cal.cursor.getFullYear(), cal.cursor.getMonth(), 1);
    const start = calWeekStart(first);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const weeks = Math.ceil(((last - start) / 864e5 + 1) / 7);
    const days = Array.from({ length: weeks * 7 }, (_, i) => calAdd(start, i));
    title = first.toLocaleDateString(UI_LOCALE(), { month: "long", year: "numeric" });
    const heads = days.slice(0, 7).map((d) => `<span>${d.toLocaleDateString(UI_LOCALE(), { weekday: "short" })}</span>`).join("");
    body = `<div class="cal-month"><div class="cal-mh">${heads}</div><div class="cal-mg">${days
      .map((d) => calDayCell(d, byDay[calKey(d)] || [], true, d.getMonth() === first.getMonth() ? "" : "out")).join("")}</div></div>`;
  }
  const unsched = cal.jobs.length;
  box.innerHTML = `<div class="cal-head">
      <button type="button" class="btn sm" data-nav="-1" aria-label="اللي فات">${document.dir === "rtl" ? "›" : "‹"}</button>
      <b class="cal-title">${title}</b>
      <button type="button" class="btn sm" data-nav="1" aria-label="اللي جاي">${document.dir === "rtl" ? "‹" : "›"}</button>
      <button type="button" class="btn sm" data-nav="0">النهارده</button>
      <span class="cal-legend"><i class="cal-dot sch"></i>متجدول <i class="cal-dot pub"></i>اتنشر <i class="cal-dot bad"></i>فشل${unsched ? ` <i class="cal-dot job"></i>بيتحضّر` : ""}</span>
    </div>${body}`;
}

$("calViews").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-v]");
  if (!b) return;
  cal.view = b.dataset.v;
  try { localStorage.setItem(CAL_KEY, cal.view); } catch {}
  cal.openDay = null;
  if (cal.view !== "list") await calLoadJobs();
  renderCal();
});

$("postsCal").addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) {
    const n = Number(nav.dataset.nav);
    if (n === 0) cal.cursor = new Date();
    else if (cal.view === "week") cal.cursor = calAdd(cal.cursor, 7 * n);
    else cal.cursor = new Date(cal.cursor.getFullYear(), cal.cursor.getMonth() + n, 1);
    cal.openDay = null;
    return renderCal();
  }
  const more = e.target.closest("[data-more]");
  if (more) {
    cal.openDay = more.dataset.more || null;
    return renderCal();
  }
  const add = e.target.closest("[data-add]");
  if (add) {
    // نفس الساعة اللي في الفورم، في اليوم ده (ولو ساعة متأخرة بالليل: 6 المغرب)
    const [y, m, d] = add.dataset.add.split("-").map(Number);
    const cur = new Date($("postWhen").value);
    const ok = !isNaN(cur) && cur.getHours() >= 8;
    const when = new Date(y, m - 1, d, ok ? cur.getHours() : 18, ok ? cur.getMinutes() : 0);
    if (when < new Date()) when.setTime(nextSlot().getTime());
    setWhen(when);
    $("postForm").scrollIntoView({ behavior: "smooth", block: "start" });
    toast(`📅 الميعاد اتحط: ${calFull(when)} — اختار الفيديو وجدول`);
    return;
  }
  const card = e.target.closest("[data-pid]");
  if (card) calOpenPost(pub.posts.find((p) => p.id === card.dataset.pid));
});

// ---------- السحب ليوم تاني ----------
$("postsCal").addEventListener("dragstart", (e) => {
  const card = e.target.closest("[data-pid]");
  if (!card) return;
  e.dataTransfer.setData("text/plain", card.dataset.pid);
  e.dataTransfer.effectAllowed = "move";
  card.classList.add("dragging");
});
$("postsCal").addEventListener("dragend", (e) => {
  e.target.closest?.("[data-pid]")?.classList.remove("dragging");
  $("postsCal").querySelectorAll(".cal-day.drop").forEach((d) => d.classList.remove("drop"));
});
$("postsCal").addEventListener("dragover", (e) => {
  const day = e.target.closest(".cal-day");
  if (!day || day.classList.contains("past")) return;
  e.preventDefault();
  $("postsCal").querySelectorAll(".cal-day.drop").forEach((d) => d !== day && d.classList.remove("drop"));
  day.classList.add("drop");
});
$("postsCal").addEventListener("drop", async (e) => {
  const day = e.target.closest(".cal-day");
  if (!day || day.classList.contains("past")) return;
  e.preventDefault();
  day.classList.remove("drop");
  const p = pub.posts.find((x) => x.id === e.dataTransfer.getData("text/plain"));
  if (!p || !postEditable(p)) return;
  const old = new Date(p.scheduled_at);
  const [y, m, d] = day.dataset.day.split("-").map(Number);
  const when = new Date(y, m - 1, d, old.getHours(), old.getMinutes());
  if (calKey(when) === calKey(old)) return;
  if (when < new Date()) return toast("الميعاد ده عدّى. افتح البوست واختار ساعة جاية", true);
  if (!confirm(`تنقل «${p.export_name || "البوست"}» لـ ${calFull(when)}؟`)) return;
  await calReschedule(p, when);
});

async function calReschedule(p, when) {
  try {
    await api(`/api/posts/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ export_id: p.export_id, caption: p.caption, platforms: p.platforms, scheduled_at: when.toISOString(), options: p.options || {} }),
    });
    toast(`✅ الميعاد الجديد: ${calFull(when)}`);
    await pubLoadPosts();
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

// ---------- نافذة البوست ----------
function calOpenPost(p) {
  if (!p) return;
  const dlg = document.createElement("dialog");
  dlg.className = "cal-dlg";
  const [label, cls] = POST_STATUS[p.status] || [p.status, ""];
  const when = new Date(p.scheduled_at);
  const canMove = postEditable(p);
  const media = p.image_url ? `<img src="${p.image_url}" alt="">`
    : p.export_url ? `<video src="${p.export_url}" controls playsinline preload="metadata"${thumbOf(p.export_url) ? ` poster="${thumbOf(p.export_url)}"` : ""}></video>` : "";
  const o = p.options || {};
  dlg.innerHTML = `<button type="button" class="cal-x" data-x aria-label="اقفل">✕</button>
    <div class="cal-dlg-body">
      ${media ? `<div class="cal-media">${media}</div>` : ""}
      <div class="cal-info">
        <h3>${escapeHtml(p.export_name || (p.from_zernio ? "🔗 من Zernio" : "⚠️ الفيديو اتمسح"))}</h3>
        <span class="pill ${cls}">${p.status === "scheduled" && p.sent ? "متجدول في Zernio ✓" : label}</span>
        <p class="when">📅 ${calFull(when)}</p>
        <p>${p.platforms.map((k) => `${PLATFORM_ICON[k] || ""} ${escapeHtml(pub.platforms[k] || k)}`).join(" · ")}</p>
        ${o.ig_tags?.length ? `<p dir="ltr" class="muted">🏷️ ${o.ig_tags.map((t) => `@${escapeHtml(t)}`).join(" ")}${o.ig_collab ? " · 🤝" : ""}</p>` : ""}
        ${p.caption ? `<p class="cal-cap">${escapeHtml(p.caption)}</p>` : ""}
        ${p.error ? `<p class="err">${escapeHtml(p.error)}</p>` : ""}
        ${canMove ? `<label class="field">ميعاد جديد <input type="datetime-local" data-when value="${toLocalInput(when)}"></label>` : ""}
        <div class="row">
          ${canMove ? `<button type="button" class="btn primary sm" data-a="move">💾 غيّر الميعاد</button>
            <button type="button" class="btn sm" data-a="edit">✎ تعديل كامل</button>` : ""}
          ${p.status === "failed" ? `<button type="button" class="btn sm" data-a="retry">↻ إعادة المحاولة</button>` : ""}
          ${p.status !== "publishing" && p.status !== "sending" ? `<button type="button" class="btn sm danger" data-a="delete">${p.status === "scheduled" ? "إلغاء النشر" : "حذف"}</button>` : ""}
        </div>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", async (e) => {
    if (e.target === dlg || e.target.closest("[data-x]")) return dlg.close();
    const b = e.target.closest("[data-a]");
    if (!b) return;
    if (b.dataset.a === "move") {
      const d = new Date(dlg.querySelector("[data-when]").value);
      if (isNaN(d)) return toast("اختار الميعاد", true);
      if (d < new Date() && !confirm("الميعاد ده عدّى، فالبوست هيتنشر على طول. تكمّل؟")) return;
      b.disabled = true;
      if (await calReschedule(p, d)) dlg.close();
      b.disabled = false;
      return;
    }
    if (b.dataset.a === "edit") dlg.close();
    if (await postAction(b.dataset.a, p) && b.dataset.a !== "edit") dlg.close();
  });
  dlg.showModal();
}

// نحدّث فيديوهات الأوتوبايلوت مع كل تحديث للمواعيد
const _calPubLoad = pubLoadPosts;
pubLoadPosts = async function () {
  if (cal.view !== "list") await calLoadJobs();
  return _calPubLoad();
};
