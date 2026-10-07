// StudioMania — الواجهة: الرئيسية (مربعات)، والشاشة الكبيرة اللي كل خطوة بتفتح فيها،
// والتنقل بين خطوات الشغل بالترتيب ومعاك ناتج الخطوة اللي فاتت

const PROCESS = ["0", "1", "2", "6", "7"]; // المشاريع ← التقطيع ← التوليد ← المونتاج ← النشر
const STEP_INFO = {
  0: { num: "01", title: "المشاريع" },
  1: { num: "02", title: "التقطيع" },
  2: { num: "03", title: "التوليد بـ Seedance" },
  6: { num: "04", title: "المونتاج" },
  7: { num: "05", title: "النشر على السوشيال" },
  4: { num: "", title: "مكتبة المدربين" },
  3: { num: "", title: "مكتبة التعليق الصوتي" },
  5: { num: "", title: "مكتبة الموسيقى" },
  8: { num: "", title: "صناعة الكاروسيل" },
  9: { num: "", title: "المسلسلات" },
  10: { num: "", title: "الإعلانات" },
  11: { num: "", title: "🔬 معمل التفكيك" },
  "6s": { num: "", title: "🎞️ مونتاج المسلسلات" },
  "6a": { num: "", title: "🎞️ مونتاج الإعلانات" },
  settings: { num: "", title: "الإعدادات" },
};
const NEXT_LABEL = {
  0: "التالي: التقطيع",
  1: "التالي: التوليد",
  2: "التالي: المونتاج",
  6: "التالي: النشر",
};
const FLOW_KEY = "studiomania.flowFolder";
const shell = { step: null, folders: [], animating: false };

// ---------- المشروع اللي شغالين عليه (بيتنقل من خطوة للي بعدها) ----------
function flowFolderId() {
  return storageGet(FLOW_KEY);
}
function setFlowFolder(id) {
  if (!id || id === flowFolderId()) return;
  storageSet(FLOW_KEY, id);
  renderStageProject();
}
async function shellFolders(refresh = false) {
  if (refresh || !shell.folders.length) shell.folders = await api("/api/folders").catch(() => []);
  return shell.folders;
}
async function setFlowByVideo(videoId) {
  if (!videoId) return;
  let f = (await shellFolders()).find((x) => x.video?.id === videoId);
  if (!f) f = (await shellFolders(true)).find((x) => x.video?.id === videoId);
  if (f) setFlowFolder(f.id);
}
async function flowFolder(refresh = false) {
  const id = flowFolderId();
  return (await shellFolders(refresh)).find((f) => f.id === id) || null;
}

// ---------- الشاشة الكبيرة ----------
function tileFor(step) {
  step = { "6s": "9", "6a": "10" }[step] || step;
  return document.querySelector(`#bento [data-open="${step}"]`) || document.querySelector(`.rail-btn[data-goto="${step}"]`);
}

function openStage(step) {
  const first = shell.step === null || $("stage").hidden;
  shell.step = step;
  const info = STEP_INFO[step] || { num: "", title: "" };
  $("stageNum").textContent = info.num;
  $("stageNum").hidden = !info.num;
  $("stageTitle").textContent = info.title;
  const inFlow = PROCESS.includes(step);
  $("flowNav").hidden = !inFlow;
  $("stage").classList.toggle("library", !inFlow);
  document.querySelectorAll("#flowNav button").forEach((b) => {
    const i = PROCESS.indexOf(b.dataset.step), cur = PROCESS.indexOf(step);
    b.classList.toggle("active", b.dataset.step === step);
    b.classList.toggle("done", inFlow && i < cur);
  });
  renderStageButtons();
  renderStageProject();
  $("stageBody").scrollTop = 0;
  if (!first) return;
  $("stage").hidden = false;
  document.body.classList.add("stage-open");
  // بعد ما يفتح: خلفية سادة ونخبّي الرئيسية اللي وراه، عشان المتصفح ميفضلش يرسم البلور مع كل حركة
  animateStage(tileFor(step), true).then(() => {
    if (shell.step !== null) document.body.classList.add("stage-settled");
  });
}

function closeStage() {
  if ($("stage").hidden) { loadHome(); return; }
  const tile = tileFor(shell.step);
  shell.step = null;
  document.body.classList.remove("stage-open", "stage-settled");
  animateStage(tile, false).then(() => {
    $("stage").hidden = true;
    document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
  });
  loadHome();
}

// المربع بيكبر من مكانه لحد ما يملا الشاشة، ولما تصغّره بيرجع مكانه
function animateStage(tile, opening) {
  const card = $("stageCard");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!tile || reduce || !card.animate) return Promise.resolve();
  const from = tile.getBoundingClientRect(), to = card.getBoundingClientRect();
  if (!from.width || !to.width) return Promise.resolve();
  const dx = from.left - to.left, dy = from.top - to.top;
  const sx = from.width / to.width, sy = from.height / to.height;
  const small = { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.4, borderRadius: "48px" };
  const big = { transform: "none", opacity: 1, borderRadius: "34px" };
  const frames = opening ? [small, big] : [big, small];
  const body = $("stageBody");
  body.animate(opening ? [{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
    { duration: opening ? 520 : 260, easing: "ease-out" });
  $("stage").animate(opening ? [{ backgroundColor: "rgba(236,236,236,0)" }, { backgroundColor: "rgba(236,236,236,.55)" }]
    : [{ backgroundColor: "rgba(236,236,236,.55)" }, { backgroundColor: "rgba(236,236,236,0)" }], { duration: 420 });
  return card.animate(frames, { duration: opening ? 480 : 380, easing: "cubic-bezier(.2,.8,.2,1)" }).finished.catch(() => {});
}

function renderStageButtons() {
  const step = shell.step;
  const i = PROCESS.indexOf(step);
  const prev = i > 0 ? PROCESS[i - 1] : null;
  $("stagePrev").hidden = !prev;
  if (prev) $("stagePrev").querySelector("span").textContent = STEP_INFO[prev].title;
  const next = NEXT_LABEL[step];
  $("stageNext").hidden = !next;
  if (next) $("stageNext").querySelector("span").textContent = next;
}

async function renderStageProject() {
  const f = await flowFolder();
  $("stageProject").textContent = f ? `📁 ${f.name}` : "";
  $("stageProject").hidden = !f || !PROCESS.includes(shell.step);
}

$("stageMin").onclick = () => showStep("home");
$("flowNav").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-step]");
  if (!b) return;
  if (b.dataset.step === "6") return openFlowMontage().catch((err) => toast(err.message, true));
  showStep(b.dataset.step);
});

// المونتاج من شريط الخطوات: لو المشروع اللي شغال عليه اتولّد بأكتر من مدرب، يسأل أنهي مدرب
async function openFlowMontage() {
  const f = await flowFolder();
  if (f?.video?.generated && (await api(`/api/videos/${f.video.id}/coaches`)).length > 1) return openMontageForVideo(f.video.id);
  showStep("6");
}
$("stagePrev").onclick = () => {
  const i = PROCESS.indexOf(shell.step);
  if (i > 0 && PROCESS[i - 1] === "6") return openFlowMontage().catch((err) => toast(err.message, true));
  if (i > 0) showStep(PROCESS[i - 1]);
};
$("stageNext").onclick = () => goNext(shell.step);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("stage").hidden && !document.querySelector("dialog[open]") &&
      !e.target.matches("input, textarea, select") && !["6", "6s", "6a"].includes(shell.step)) showStep("home");
});

// ---------- الخطوة الجاية بناتج الخطوة دي ----------
async function goNext(step) {
  try {
    if (step === "0") return await nextFromProjects();
    if (step === "1") return await nextFromCutting();
    if (step === "2") return await nextFromGenerate();
    if (step === "6") return nextFromMontage();
  } catch (err) {
    toast(err.message, true);
  }
}

async function nextFromProjects() {
  const f = fol.current || (await flowFolder(true));
  if (!f) return toast("اختار مشروع الأول", true);
  if (!f.video) return toast("المشروع ده لسه مفيهوش فيديو خام. ارفعه الأول", true);
  setFlowFolder(f.id);
  fol.current = f;
  $("goCut").onclick();
}

async function nextFromCutting() {
  const v = state.current;
  if (!v) return toast("افتح الفيديو اللي عايز تقطّعه الأول", true);
  setFlowByVideo(v.id);
  if (v.clips_count) return openGenerateWith(v.id, v.coach?.id || null);
  if (!v.cuts?.length) return toast("علّم أماكن القطع الأول بزرار «اقطع هنا»", true);
  await splitCurrent(true); // بيقطّع ويفتح التوليد بالقطع
}

async function nextFromGenerate() {
  const f = await flowFolder(true);
  if (!f?.video) return toast("مش عارف المشروع. افتح المشروع من خطوة المشاريع الأول", true);
  if (!f.video.generated) return toast("لسه مفيش فيديوهات اتولّدت للمشروع ده. ولّد القطع الأول", true);
  fol.current = f;
  await $("goMontage").onclick();
}

function nextFromMontage() {
  const p = mt.project;
  if (!p) return toast("افتح مشروع المونتاج الأول", true);
  if (p.render_status !== "done" || !p.export_id) {
    showTab("export");
    return toast("صدّر الفيديو الأول، وبعدين كمّل للنشر", true);
  }
  pub.videoId = p.export_id; // الفيديو اللي لسه متصدّر بيبقى متختار في فورم النشر
  showStep("7");
}

// ---------- الرئيسية ----------
function renderDate() {
  const now = new Date();
  const loc = document.documentElement.lang === "en" ? "en-US" : "ar-EG-u-nu-latn";
  $("dateDay").textContent = now.toLocaleDateString(loc, { day: "numeric" });
  $("dateText").innerHTML = `${now.toLocaleDateString(loc, { weekday: "short" })}${loc === "en-US" ? "," : "،"}<br>${now.toLocaleDateString(loc, { month: "long" })}`;
}

// الخطوة اللي المشروع وصلها (من 5)
function folderStage(f) {
  if (!f) return { done: 0, next: "0" };
  if (!f.video) return { done: 0, next: "0" };
  if (!f.video.clips) return { done: 1, next: "1" };
  if (f.video.generated < f.video.clips) return { done: 2, next: "2" };
  if (!f.exported) return { done: 3, next: "6" };
  return { done: 4, next: "7" };
}

async function loadHome() {
  renderDate();
  const [folders, posts, videos, coaches, voices, music, projects] = await Promise.all([
    shellFolders(true), api("/api/posts").catch(() => []), api("/api/videos").catch(() => []),
    api("/api/coaches").catch(() => []), api("/api/audio?kind=voice").catch(() => []),
    api("/api/audio?kind=music").catch(() => []), api("/api/projects").catch(() => []),
  ]);
  const cur = folders.find((f) => f.id === flowFolderId()) || folders[0] || null;
  const st = folderStage(cur);

  // الترحيب وزرار «كمّل»
  $("greetTitle").textContent = cur ? `كمّل «${cur.name}»` : "أهلاً، يللا نعمل فيديو 👋";
  $("greetSub").textContent = cur
    ? `وصلت للخطوة ${st.done + 1} من 5 · الجاية: ${STEP_INFO[st.next].title}`
    : "كل مربع خطوة. دوس عليه يفتح، وخلّص وكمّل للي بعده.";
  $("continueLabel").textContent = cur ? `كمّل: ${STEP_INFO[st.next].title}` : "ابدأ مشروع";
  $("continueBtn").onclick = () => {
    if (cur) setFlowFolder(cur.id);
    openFromTile(cur ? st.next : "0");
  };
  $("currentChip").hidden = !cur;
  if (cur) $("currentChip").innerHTML = `<i></i>${escapeHtml(cur.name)}`;

  // حلقة المشروع الحالي
  const pct = Math.round((st.done / 5) * 100);
  const C = 2 * Math.PI * 47;
  $("ringFg").style.strokeDasharray = `${(C * pct) / 100} ${C}`;
  $("ringPct").textContent = `${pct}%`;
  $("ringLabel").textContent = cur ? cur.name : "مفيش مشروع لسه";
  document.querySelector(".t-ring").dataset.open = cur ? st.next : "0";

  // المشاريع
  $("tileProjects").innerHTML = folders.length
    ? folders.slice(0, 4).map((f) => {
        const s = folderStage(f);
        return `<li data-folder="${f.id}" class="${f.id === cur?.id ? "cur" : ""}"><span class="pname">${escapeHtml(f.name)}</span>
          <span class="steps5">${[0, 1, 2, 3, 4].map((k) => `<i class="${k < s.done ? "on" : ""}"></i>`).join("")}</span></li>`;
      }).join("") + (folders.length > 4 ? `<li class="more">+${folders.length - 4}</li>` : "")
    : `<li class="empty-li">لسه مفيش مشاريع. افتح المربع واعمل أول مشروع</li>`;

  // التقطيع
  const clipsTotal = folders.reduce((n, f) => n + (f.video?.clips || 0), 0);
  $("tileCutBig").textContent = `${videos.length}`;
  $("tileCutSub").textContent = `فيديو خام · ${clipsTotal} قطعة`;

  // التوليد: نقطة لكل قطعة، والملوّنة اتولّدت
  const gens = folders.flatMap((f) => f.video ? Array.from({ length: f.video.clips }, (_, k) => k < f.video.generated) : []);
  $("tileGenDots").innerHTML = gens.slice(0, 40).map((on) => `<i class="${on ? "on" : ""}"></i>`).join("") || `<i></i><i></i><i></i><i></i><i></i>`;
  const genDone = gens.filter(Boolean).length;
  $("tileGenSub").textContent = `${genDone} من ${gens.length} قطعة اتولّدت`;

  // المونتاج
  const exported = projects.filter((p) => p.export_id).length;
  $("tileMontSub").textContent = `${projects.length} مشروع مونتاج · ${exported} اتصدّر`;
  api("/api/carousels").then((list) => {
    const done = list.filter((c) => c.slides && c.done === c.slides).length;
    if (list.length) $("tileCarSub").textContent = `${list.length} كاروسيل · ${done} خلصان`;
    const covers = list.filter((c) => c.cover).slice(0, 3);
    document.querySelectorAll("#tileCarStack i").forEach((el, i) => {
      el.style.background = covers[i] ? `center / cover url("${covers[i].cover}")` : "";
    });
  }).catch(() => {});

  // النشر
  const upcoming = posts.filter((p) => p.status === "scheduled").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const loc = document.documentElement.lang === "en" ? "en-US" : "ar-EG-u-nu-latn";
  $("tilePosts").innerHTML = upcoming.slice(0, 3).map((p) => `<li><span>${escapeHtml(p.export_name || p.caption || "")}</span>
    <b>${new Date(p.scheduled_at).toLocaleString(loc, { weekday: "short", hour: "numeric", minute: "2-digit" })}</b></li>`).join("");
  $("tilePubSub").textContent = upcoming.length ? `${upcoming.length} بوست متجدول` : "مفيش بوستات متجدولة";

  // المكتبات
  $("tileCoachSub").textContent = `${coaches.length} مدرب`;
  $("tileAvatars").innerHTML = coaches.slice(0, 4).map((c) => `<img src="${c.image_url}" alt="">`).join("");
  $("tileVoiceSub").textContent = `${voices.length} تسجيل`;
  $("tileMusicSub").textContent = `${music.length} تراك`;
}

function openFromTile(step) {
  if (step === "current") step = "0";
  showStep(step);
}
$("bento").addEventListener("click", (e) => {
  const li = e.target.closest("[data-folder]");
  if (li) {
    // دوسة على مشروع في المربع: بيبقى المشروع الحالي ويفتح خطوته الجاية
    const f = shell.folders.find((x) => x.id === li.dataset.folder);
    setFlowFolder(f.id);
    fol.current = f;
    return openFromTile("0");
  }
  const tile = e.target.closest("[data-open]");
  if (tile) openFromTile(tile.dataset.open);
});

// المشروع الحالي بيتعلّم لوحده في كل خطوة
(() => {
  const _renderDetail = renderFolderDetail;
  renderFolderDetail = function () {
    _renderDetail();
    if (fol.current) setFlowFolder(fol.current.id);
  };
  const _loadFolders = loadFolders;
  loadFolders = async function () {
    if (!fol.current && flowFolderId()) fol.current = { id: flowFolderId() };
    await _loadFolders();
    shell.folders = fol.list;
  };
  viewHooks["0"] = loadFolders;
  const _openVideo = openVideo;
  openVideo = function (id) {
    _openVideo(id);
    setFlowByVideo(id);
  };
  const _openGen = openGenerateWith;
  openGenerateWith = function (videoId, coachId) {
    setFlowByVideo(videoId);
    _openGen(videoId, coachId);
  };
  const _openProject = openProject;
  openProject = function (p) {
    _openProject(p);
    if (p?.data?.video_id) setFlowByVideo(p.data.video_id);
  };
})();

// ---------- اللغة ----------
$("langToggle").querySelector(".lang-code").textContent = I18N.lang === "en" ? "ع" : "EN";
$("langToggle").onclick = () => I18N.setLang(I18N.lang === "en" ? "ar" : "en");

// ---------- 💰 رصيد Atlas: بيتحدث كل دقيقة، والصرف بيتحسب من نزول الرصيد ----------
const money = { last: null };
async function loadMoney() {
  try {
    money.last = await api("/api/atlas/money");
    $("moneyBtn").hidden = false;
    $("moneyVal").textContent = `$${money.last.balance.toFixed(2)}`;
    $("moneyBtn").title = `رصيد Atlas · اتصرف النهارده $${money.last.spent_today.toFixed(2)}`;
    if ($("moneyDialog").open) renderMoney();
  } catch { /* من غير مفتاح أو Atlas مش بيرد: العداد بيستخبى */ }
}
function renderMoney() {
  const m = money.last;
  if (!m) return;
  const since = new Date(m.tracked_since).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  $("moneyBody").innerHTML = `<div class="money-grid">
      <div><span>الرصيد دلوقتي</span><b>$${m.balance.toFixed(2)}</b></div>
      <div><span>اتصرف النهارده</span><b>$${m.spent_today.toFixed(2)}</b></div>
      <div><span>اتصرف آخر 7 أيام</span><b>$${m.spent_week.toFixed(2)}</b></div></div>
    <p class="muted">الصرف بيتحسب من نزول الرصيد من ساعة ما البرنامج بدأ يتابعه (${since}). الشحن مش بيتحسب صرف.</p>
    ${m.models_recent.length ? `<h4>الطلبات لكل موديل (آخر يومين)</h4><table class="money-tbl">${m.models_recent.map((x) =>
      `<tr><td dir="ltr">${escapeHtml(x.name)}</td><td>${x.requests}</td></tr>`).join("")}</table>` : ""}`;
}
$("moneyBtn").onclick = () => { renderMoney(); $("moneyDialog").showModal(); loadMoney(); };
$("moneyClose").onclick = () => $("moneyDialog").close();
$("moneyRefresh").onclick = loadMoney;
loadMoney();
setInterval(() => { if (!document.hidden) loadMoney(); }, 60000);
