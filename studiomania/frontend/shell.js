// StudioMania — الواجهة: الرئيسية (مربعات)، والشاشة الكبيرة اللي كل خطوة بتفتح فيها،
// والتنقل بين خطوات الشغل بالترتيب ومعاك ناتج الخطوة اللي فاتت

// كوتشي (المشاريع: فيديو خام ← تقطيع ← توليد ← مونتاج ← نشر) فُصل برنامج لوحده (فولدر kochi)،
// فستوديومانيا مالوش خطوات مشروع: كل قسم بيفتح لوحده
const APP = "studio";
const PROCESS = [];
const STEP_INFO = {
  0: { num: "01", title: "المشاريع", en: "Projects" },
  1: { num: "02", title: "التقطيع", en: "Cut" },
  2: { num: "03", title: "التوليد", en: "Generate" },
  6: { num: "04", title: "المونتاج", en: "Montage" },
  7: { num: "05", title: "النشر", en: "Publish" },
  4: { num: "", title: "مكتبة الشخصيات", en: "Characters" },
  3: { num: "", title: "مكتبة التعليق الصوتي", en: "Voices" },
  5: { num: "", title: "مكتبة الموسيقى", en: "Music" },
  8: { num: "", title: "صناعة الكاروسيل", en: "Carousel" },
  9: { num: "", title: "المسلسلات", en: "Series" },
  10: { num: "", title: "الإعلانات", en: "Ads" },
  11: { num: "", title: "معمل التفكيك", en: "Lab" },
  12: { num: "", title: "التايبوجرافي", en: "Typography" },
  13: { num: "", title: "الدبلجة باللهجات", en: "Dubbing" },
  14: { num: "", title: "القوالب", en: "Templates" },
  15: { num: "", title: "التعليقات والرسائل", en: "Inbox" },
  16: { num: "", title: "الأفاتار", en: "Avatar" },
  "6s": { num: "", title: "مونتاج المسلسلات", en: "Series montage" },
  "6a": { num: "", title: "مونتاج الإعلانات", en: "Ad montage" },
  "6f": { num: "", title: "المونتاج", en: "Montage" },
  settings: { num: "", title: "الإعدادات", en: "Settings" },
  cal: { num: "", title: "المواعيد", en: "Calendar" },
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
  return document.querySelector(`.rail-btn[data-goto="${step}"]`);
}

function openStage(step) {
  const first = shell.step === null || $("stage").hidden;
  shell.step = step;
  const info = STEP_INFO[step] || { num: "", title: "" };
  // فوق العنوان: اسم القسم بالإنجليزي بحروف متباعدة، ورقم الخطوة لو جوه خطوات المشروع
  $("stageNum").textContent = [info.en, info.num && PROCESS.includes(step) ? `${Number(info.num)} / 5` : ""].filter(Boolean).join(" · ");
  $("stageNum").hidden = !info.en && !info.num;
  $("stageTitle").textContent = info.title;
  // أيقونة القسم الزجاج جنب العنوان: نفس أيقونة المربع اللي فتحه، فالزوم بيوديها مكانها من غير ما تتغيّر
  const ic = { settings: "settings", 7: "publish", cal: "publish", 15: "publish", 8: "carousel", 9: "series", 10: "publish", 12: "create", 13: "voices", 14: "reel",
    6: "film", "6f": "film", "6s": "series", "6a": "publish", 3: "voices", 4: "characters", 5: "music", 16: "characters" }[step];
  $("stageIc").hidden = !ic;
  $("stageIc").innerHTML = ic ? `<img class="ic-l" src="/icons3d/${ic}.webp?v=9" alt=""><img class="ic-d" src="/icons3d/${ic}_d.webp?v=9" alt="">` : "";
  // المونتاج شاشة شغل: راس صغير (رجوع + اسم المشروع + صدّر) بدل العنوان الكبير، زي البروتوتايب
  $("stage").classList.toggle("mt-mode", ["6", "6s", "6a", "6f"].includes(step));
  // المواعيد صفحة لوحدها جوه النشر: الرجوع بيودّي للنشر مش للرئيسية
  $("stage").classList.toggle("cal-mode", step === "cal");
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
  if ($("stage").hidden) return;
  const tile = tileFor(shell.step);
  shell.step = null;
  document.body.classList.remove("stage-open", "stage-settled");
  animateStage(tile, false).then(() => {
    $("stage").hidden = true;
    document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
  });
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

// المونتاج من شريط الخطوات: لو المشروع اللي شغال عليه اتولّد بأكتر من شخصية، يسأل أنهي شخصية
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
  if (!f) return toast("اختر مشروع أولًا", true);
  if (!f.video) return toast("هذا المشروع ما زال لا يحتوي فيديو خام. ارفعه أولًا", true);
  setFlowFolder(f.id);
  fol.current = f;
  $("goCut").onclick();
}

async function nextFromCutting() {
  const v = state.current;
  if (!v) return toast("افتح الفيديو الذي تريد تقطّعه أولًا", true);
  setFlowByVideo(v.id);
  if (v.clips_count) return openGenerateWith(v.id, v.coach?.id || null);
  if (!v.cuts?.length) return toast("علّم أماكن القطع أولًا بزرار «اقطع هنا»", true);
  await splitCurrent(true); // يقطّع ويفتح التوليد بالقطع
}

async function nextFromGenerate() {
  const f = await flowFolder(true);
  if (!f?.video) return toast("لا تعرف المشروع. افتح المشروع من خطوة المشاريع أولًا", true);
  if (!f.video.generated) return toast("لا يوجد بعد فيديوهات وُلّدت هذا للمشروع. ولّد القطع أولًا", true);
  fol.current = f;
  await $("goMontage").onclick();
}

function nextFromMontage() {
  const p = mt.project;
  if (!p) return toast("افتح مشروع المونتاج أولًا", true);
  if (p.render_status !== "done" || !p.export_id) {
    showTab("export");
    return toast("صدّر الفيديو أولًا، ثم أكمل للنشر", true);
  }
  pub.videoId = p.export_id; // الفيديو الذي ما زال متصدّر يصبح متختار في فورم النشر
  showStep("7");
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
    $("moneyBtn").title = `رصيد Atlas · صُرف اليوم $${money.last.spent_today.toFixed(2)}`;
    // نفس الرصيد في راس الصفحات: رقم صحيح جوه دايرة، والدايرة = الرصيد من (الرصيد + صرف الأسبوع)
    const m = money.last, c = 2 * Math.PI * 16;
    $("stageMoney").hidden = false;
    $("stageMoneyTxt").textContent = `$${Math.round(m.balance)}`;
    $("stageMoney").title = $("moneyBtn").title;
    $("stageMoneyRing").style.strokeDasharray = `${(c * Math.min(1, m.balance / Math.max(m.balance + m.spent_week, 1))).toFixed(1)} ${c.toFixed(1)}`;
    if ($("moneyDialog").open) renderMoney();
  } catch { /* بدون مفتاح أو Atlas لا يرد: العداد يختفي */ }
}
function renderMoney() {
  const m = money.last;
  if (!m) return;
  const since = new Date(m.tracked_since).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  $("moneyBody").innerHTML = `<div class="money-grid">
      <div><span>الرصيد الآن</span><b>$${m.balance.toFixed(2)}</b></div>
      <div><span>صُرف اليوم</span><b>$${m.spent_today.toFixed(2)}</b></div>
      <div><span>صُرف آخر 7 أيام</span><b>$${m.spent_week.toFixed(2)}</b></div></div>
    <p class="muted">الصرف يُحسب من نزول الرصيد من ساعة ما البرنامج بدأ يتابعه (${since}). الشحن لا يُحسب صرف.</p>
    ${m.models_recent.length ? `<h4>الطلبات لكل نموذج (آخر يومين)</h4><table class="money-tbl">${m.models_recent.map((x) =>
      `<tr><td dir="ltr">${escapeHtml(x.name)}</td><td>${x.requests}</td></tr>`).join("")}</table>` : ""}`;
}
$("moneyBtn").onclick = () => { renderMoney(); $("moneyDialog").showModal(); loadMoney(); };
$("moneyClose").onclick = () => $("moneyDialog").close();
$("moneyRefresh").onclick = loadMoney;
loadMoney();
setInterval(() => { if (!document.hidden) loadMoney(); }, 60000);

// راس الصفحات: الرصيد بيفتح تفاصيله، والكالندر بيفتح المواعيد في صفحة النشر بالأسبوع
$("stageMoney").onclick = () => $("moneyBtn").click();
$("stageCal").onclick = () => showStep("cal");
$("stagePlans").onclick = (e) => (typeof NH !== "undefined" && NH ? NH.openPlans(e.currentTarget) : (location.href = "/billing"));
