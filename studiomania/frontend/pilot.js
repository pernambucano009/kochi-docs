// 🛫 الأوتوبايلوت (المربع الرابع في الرئيسية): كام بوست في اليوم، في أحسن أوقات، من القوالب اللي تختارها بالتبادل.
// يا إما يعمل كل حاجة لوحده، يا إما يقف عند الخطوات اللي تختارها لحد ما توافق. قالب الموبايل بيستناك تصوّر بالسكريبت.
// الطابور تحت على الشمال: كل ميعاد جاي وحالته، والموافقة والتصوير من جوه الطابور نفسه. الشغل نفسه على السيرفر (/api/pilot).
const PilotPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const CSS = `
#nh .ap { --ap-sub: #6B6A66; --ap-card: var(--card, #fff); --ap-field: var(--field, #F3F2EF); --ap-line: rgba(24, 23, 24, .1); --ap-track: #E3E2DE;
  --ap-soft: rgba(229, 97, 62, .1); --ap-sh: 0 4px 24px rgba(24, 23, 24, .06); --ap-chip: 0 4px 18px rgba(24, 23, 24, .08); --ap-pop: cubic-bezier(.2, .8, .2, 1);
  position: relative; min-height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); color: var(--nh-ink); }
:root[data-nh-theme="dark"] #nh .ap { --ap-sub: #A3A29E; --ap-field: #2A292A; --ap-line: rgba(255, 255, 255, .1); --ap-track: #3D3C3D; --ap-soft: rgba(240, 117, 79, .14);
  --ap-sh: 0 4px 24px rgba(0, 0, 0, .28); --ap-chip: 0 4px 18px rgba(0, 0, 0, .35); }
#nh .ap :where(button) { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }
#nh .ap .lat { font: 400 11px var(--nh-latin); letter-spacing: .3em; text-transform: uppercase; direction: ltr; unicode-bidi: isolate; color: var(--nh-muted); }
#nh .ap .num { font-family: var(--nh-latin); font-weight: 300; direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
#nh .ap-top { display: flex; align-items: center; gap: 12px; }
#nh .ap-tg { position: relative; width: 44px; height: 24px; border-radius: 99px; background: var(--ap-track); transition: background .3s; flex: none; }
#nh .ap-tg::after { content: ""; position: absolute; top: 3px; inset-inline-start: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, .2); transition: inset-inline-start .45s cubic-bezier(.65, 0, .35, 1); }
#nh .ap-tg.on { background: var(--nh-accent); }
#nh .ap-tg.on::after { inset-inline-start: 23px; }
#nh .ap-st { font-size: 13px; color: var(--ap-sub); }
#nh .ap-main { display: grid; align-content: center; justify-items: center; gap: 22px; min-height: 0; padding: 4px 0 70px; }
#nh .ap-row { display: flex; align-items: center; justify-content: center; gap: 40px; width: min(1100px, 100%); }
#nh .ap-row > .ap-sec { width: auto; }
#nh .ap-row > .ap-sec:last-child { flex: 1; max-width: 760px; }
#nh .ap-sec { display: grid; justify-items: center; gap: 12px; width: min(1180px, 100%); }
#nh .ap-sec > small { font-size: 12.5px; color: var(--ap-sub); }
#nh .ap-cnt { display: flex; align-items: center; gap: 16px; }
#nh .ap-cnt button { width: 40px; height: 40px; border-radius: 50%; background: var(--ap-card); box-shadow: var(--ap-chip); font-size: 18px; color: var(--ap-sub); transition: scale .3s var(--ap-pop); }
#nh .ap-cnt button:hover { scale: 1.08; }
#nh .ap-cnt .n { font-size: 38px; line-height: 1; min-width: 52px; text-align: center; }
#nh .ap-day { position: relative; width: min(760px, 100%); height: 46px; direction: ltr; cursor: copy; touch-action: none; }
#nh .ap-day::before { content: ""; position: absolute; left: 0; right: 0; top: 22px; height: 2px; border-radius: 2px; background: var(--ap-line); }
#nh .ap-day .pk { position: absolute; top: 18px; height: 10px; border-radius: 10px; background: var(--ap-soft); }
#nh .ap-day .hr { position: absolute; top: 32px; translate: -50% 0; font: 300 10px var(--nh-latin); color: var(--nh-muted); }
#nh .ap-day .pt { position: absolute; top: 13px; translate: -50% 0; width: 20px; height: 20px; border-radius: 50%; background: var(--nh-accent); box-shadow: 0 0 0 4px var(--ap-card), 0 6px 14px rgba(229, 97, 62, .35); cursor: grab; }
#nh .ap-day .pt b { position: absolute; bottom: calc(100% + 8px); left: 50%; translate: -50% 0; font: 400 11.5px var(--nh-latin); white-space: nowrap; direction: rtl; unicode-bidi: isolate; }
#nh .ap-day .pt.mine { background: var(--nh-ink); box-shadow: 0 0 0 4px var(--ap-card); }
#nh .ap-leg { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; font-size: 11.5px; color: var(--nh-muted); }
#nh .ap-leg i { display: inline-block; width: 18px; height: 8px; border-radius: 8px; background: var(--ap-soft); margin-inline-end: 6px; vertical-align: middle; }
#nh .ap-leg em { font-style: normal; display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--nh-accent); margin-inline-end: 6px; vertical-align: middle; }
#nh .ap-tpls { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
#nh .ap-md { position: relative; display: grid; gap: 2px; justify-items: start; align-content: start; min-width: 140px; max-width: 210px; padding: 10px 14px; border-radius: 18px; background: var(--ap-card); box-shadow: var(--ap-sh); text-align: start; transition: scale .3s var(--ap-pop), box-shadow .3s; }
#nh .ap-md:hover { scale: 1.03; }
#nh .ap-md b { font-size: 13.5px; font-weight: 500; }
#nh .ap-md small { font-size: 11px; color: var(--nh-muted); }
#nh .ap-md .n { position: absolute; bottom: 10px; inset-inline-end: 12px; font: 300 10px var(--nh-latin); color: var(--nh-muted); }
#nh .ap-md.on { box-shadow: inset 0 0 0 1.5px var(--nh-accent), var(--ap-sh); }
#nh .ap-md.on::after { content: "✓"; position: absolute; top: -6px; left: -6px; box-shadow: 0 0 0 3px var(--nh-bg); width: 18px; height: 18px; border-radius: 50%; background: var(--nh-accent); color: #fff; font-size: 11px; display: grid; place-items: center; }
#nh .ap-md .tag { font-size: 10.5px; padding: 1px 8px; border-radius: 99px; background: var(--ap-field); color: var(--ap-sub); margin-top: 4px; }
#nh .ap-md .tag.cam { background: var(--ap-soft); color: var(--nh-accent); }
#nh .ap-md.off { opacity: .55; }
#nh .ap-md.new { background: none; box-shadow: inset 0 0 0 1.5px var(--ap-line); justify-items: center; align-content: center; color: var(--ap-sub); }
#nh .ap-md.new b { font-weight: 400; }
#nh .ap-more { display: none; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 820px; max-height: 150px; overflow: auto; padding: 4px; }
#nh .ap-more.on { display: flex; }
#nh .ap-more button { height: 30px; padding: 0 12px; border-radius: 999px; background: var(--ap-field); font-size: 12px; color: var(--ap-sub); }
#nh .ap-more button.on { background: var(--ap-soft); color: var(--nh-accent); }
#nh .ap-plan { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px; font-size: 12.5px; color: var(--ap-sub); text-align: center; max-width: 560px; line-height: 1.7; }
#nh .ap-plan button { height: 30px; padding: 0 14px; border-radius: 999px; background: var(--ap-field); font-size: 12px; color: var(--nh-ink); }
#nh .ap-tpls.dim, #nh .ap-more.dim { opacity: .35; pointer-events: none; }
#nh .ap-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--ap-field); }
#nh .ap-seg button { height: 32px; padding: 0 16px; border-radius: 999px; font-size: 12.5px; color: var(--ap-sub); transition: background .25s, color .25s; }
#nh .ap-seg button.on { background: var(--ap-card); color: var(--nh-ink); box-shadow: 0 2px 8px rgba(24, 23, 24, .08); }
#nh .ap-steps { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
#nh .ap-sec.ap-modes { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 16px; }
#nh .ap-steps button { height: 30px; padding: 0 12px; border-radius: 999px; background: var(--ap-field); font-size: 12px; color: var(--ap-sub); }
#nh .ap-steps button.on { background: var(--ap-soft); color: var(--nh-accent); }
#nh .ap-steps i { font-style: normal; color: var(--ap-track); align-self: center; }
#nh .ap-dock { position: fixed; bottom: 24px; inset-inline-end: 28px; z-index: 6; display: grid; justify-items: end; gap: 10px; }
#nh .ap-cap { display: inline-flex; align-items: center; gap: 10px; height: 44px; padding: 0 18px; border-radius: 22px; background: var(--ap-card); box-shadow: var(--ap-chip); font-size: 13px; transition: translate .32s var(--ap-pop); }
#nh .ap-cap:hover { translate: 0 -3px; }
#nh .ap-cap .n { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: var(--nh-accent); color: #fff; font: 400 11px var(--nh-latin); display: grid; place-items: center; }
#nh .ap-cap small { font-size: 11.5px; color: var(--nh-muted); }
#nh .ap-q { display: none; width: min(460px, calc(100vw - 32px)); max-height: min(62vh, 560px); overflow: auto; padding: 8px; border-radius: 22px; background: var(--ap-card); box-shadow: 0 30px 80px -30px rgba(24, 23, 24, .45); }
#nh .ap-dock.open .ap-q { display: grid; gap: 2px; }
#nh .ap-qi { display: grid; gap: 8px; padding: 10px 12px; border-radius: 16px; }
#nh .ap-qi + .ap-qi { border-top: 1px solid var(--ap-line); border-radius: 0; }
#nh .ap-qh { display: flex; align-items: center; gap: 10px; }
#nh .ap-qh .tx { flex: 1; min-width: 0; font-size: 13px; }
#nh .ap-qh .tx small { display: block; font-size: 11px; color: var(--nh-muted); }
#nh .ap-qh .st { font-size: 11px; padding: 2px 10px; border-radius: 99px; background: var(--ap-field); color: var(--ap-sub); white-space: nowrap; }
#nh .ap-qh .st.wait, #nh .ap-qh .st.cam { background: var(--ap-soft); color: var(--nh-accent); }
#nh .ap-qh .st.failed { color: #C2482E; }
#nh .ap-opts { display: grid; gap: 6px; }
#nh .ap-opt { display: grid; gap: 2px; padding: 9px 12px; border-radius: 12px; background: var(--ap-field); text-align: start; font-size: 12.5px; transition: box-shadow .2s; }
#nh .ap-opt small { font-size: 11.5px; color: var(--ap-sub); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
#nh .ap-opt:hover { box-shadow: inset 0 0 0 1.5px var(--nh-accent); }
#nh .ap-acts { display: flex; flex-wrap: wrap; gap: 6px; }
#nh .ap .ap-acts button, #nh .ap .ap-acts a, #nh .ap .ap-acts label { height: 30px; padding: 0 14px; border-radius: 999px; background: var(--ap-field); font-size: 12px; display: inline-flex; align-items: center; cursor: pointer; color: inherit; text-decoration: none; }
#nh .ap .ap-acts .ok { background: var(--nh-accent); color: #fff; }
#nh .ap-acts input { display: none; }
#nh .ap-say { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--ap-field); font-size: 12.5px; line-height: 1.8; }
#nh .ap-imgs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
#nh .ap-imgs img { height: 150px; border-radius: 10px; flex: none; }
#nh .ap-qi video { width: 100%; max-height: 260px; border-radius: 12px; background: #000; }
#nh .ap-err { font-size: 11.5px; color: #C2482E; }
#nh .ap-none { padding: 16px; text-align: center; font-size: 12.5px; color: var(--nh-muted); }
/* شاشات قصيرة: كل حاجة بتتلم في الشاشة من غير سكرول */
@media (min-width: 821px) and (max-height: 860px) {
  #nh .ap-main { gap: 14px; padding: 0 0 56px; }
  #nh .ap-sec { gap: 8px; }
  #nh .ap-cnt button { width: 34px; height: 34px; font-size: 16px; }
  #nh .ap-cnt .n { font-size: 32px; }
  #nh .ap-md { min-width: 124px; padding: 8px 12px; border-radius: 16px; }
  #nh .ap-md .tag { margin-top: 2px; }
  #nh .ap-leg span:last-child { display: none; }
  #nh .ap-seg button, #nh .ap-steps button { height: 28px; }
}
@media (min-width: 821px) and (max-height: 700px) {
  #nh .ap .lat { display: none; }
  #nh .ap-main { gap: 10px; }
}
@media (max-width: 820px) {
  #nh .ap-main { align-content: start; gap: 24px; }
  #nh .ap-row { flex-direction: column; gap: 24px; }
  #nh .ap-row > .ap-sec:last-child { width: 100%; }
  #nh .ap-cnt .n { font-size: 36px; }
  #nh .ap-md { flex: 1 1 calc(50% - 5px); min-width: 0; max-width: none; }
  #nh .ap-dock { inset-inline-end: 16px; bottom: 16px; }
}`;
  const STEP_N = [["idea", "الفكرة"], ["script", "النص"], ["montage", "المونتاج"], ["video", "الفيديو"]];
  const PEAKS = [[12, 14], [18.5, 22.5]];   // الأوقات التي الجمهور يصبح فيها أنشط عادةً (للإرشاد فقط)
  const S = { d: null, root: null, more: false, drag: null, open: false, timer: 0 };
  const hOf = (t) => { const [h, m] = String(t).split(":").map(Number); return h + (m || 0) / 60; };
  const tOf = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  const fmtH = (h) => { const H = Math.floor(h), m = Math.round((h - H) * 60), h12 = ((H + 11) % 12) + 1; return `${h12}:${String(m).padStart(2, "0")} ${H >= 12 ? "م" : "ص"}`; };
  const when = (iso) => {
    const d = new Date(iso), t = new Date(), day = d.toDateString() === t.toDateString() ? "اليوم" : d.toDateString() === new Date(+t + 864e5).toDateString() ? "غدًا" : d.toLocaleDateString("ar-EG", { weekday: "long" });
    return `${day} ${fmtH(d.getHours() + d.getMinutes() / 60)}`;
  };
  const codeTpls = () => (typeof Gallery !== "undefined" && Gallery.list ? Gallery.list() : []).filter((x) => String(x.id).startsWith("t-"));

  const html = () => `<div class="ap" id="apRoot"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  async function mount(root) {
    if (!document.getElementById("apCss")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "apCss", textContent: CSS }));
    S.root = root.querySelector("#apRoot");
    if (!S.root) return;
    try { S.d = await api("/api/pilot"); } catch (err) { S.root.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; return; }
    S.mo = await api("/api/plan/month").catch(() => null);
    S.root.innerHTML = shell();
    bind();
    draw();
    clearInterval(S.timer);
    S.timer = setInterval(refresh, 15000);
  }
  async function refresh() {
    if (!S.root?.isConnected) return clearInterval(S.timer);
    if (S.drag || document.hidden) return;
    try { S.d = await api("/api/pilot"); drawQ(); drawHead(); } catch { /* اللفة القادمة */ }
  }
  const shell = () => `
    <header class="ap-top"><span class="lat">Autopilot</span><button type="button" class="ap-tg" data-on aria-label="الأوتوبايلوت"></button><span class="ap-st" data-st></span></header>
    <main class="ap-main">
      <div class="ap-row"><section class="ap-sec"><span class="lat">Posts per day</span>
        <div class="ap-cnt"><button type="button" data-cnt="-1" aria-label="أقل">−</button><span class="n num" data-n></span><button type="button" data-cnt="1" aria-label="أكثر">+</button></div>
        <small>منشور في اليوم <span data-fee></span></small></section>
      <section class="ap-sec"><div class="ap-day" data-day></div>
        <div class="ap-leg"><span><em></em>اخترناه في أحسن وقت</span><span><i></i>وقت الجمهور الأنشط</span><span>اضغط على الخط تزوّد موعد · اسحب النقطة تغيّره · اضغط عليها تزيلها</span></div></section></div>
      <section class="ap-sec"><span class="lat">Templates</span>
        <div class="ap-seg" data-srcs><button type="button" data-src="rotate">بالدور من القوالب</button><button type="button" data-src="plan">من خطة الشهر</button></div>
        <div class="ap-plan" data-plan></div>
        <div class="ap-tpls" data-tpls></div><div class="ap-more" data-more></div>
        <small data-tplsub>يختار منهم بالتبادل لكي المحتوى لا يتكرر</small></section>
      <section class="ap-sec ap-modes"><div class="ap-seg" data-modes><button type="button" data-mode="auto">يعمل كل شيء تلقائيًا</button><button type="button" data-mode="approve">أوافق على هذه الخطوات</button></div>
        <div class="ap-steps" data-steps></div></section>
    </main>
    <div class="ap-dock" data-dock><div class="ap-q" data-q></div>
      <button type="button" class="ap-cap" data-cap><span>الطابور</span><span class="n" data-qn hidden></span><small data-qsub></small></button></div>`;
  const q = (s) => S.root.querySelector(s);
  function draw() { drawHead(); drawDay(); drawSrc(); drawTpls(); drawMode(); drawQ(); }
  // 🗓️ المصدر: بالدور من القوالب، أو خطة الشهر (كل بوست في ميعاده بفكرته وقالبه، من صفحة «خطة المحتوى»)
  const fromPlan = () => S.d.settings.source === "plan";
  function drawSrc() {
    const plan = fromPlan(), m = S.mo?.month, left = (m?.items || []).filter((x) => !x.job).length;
    q("[data-srcs]").querySelectorAll("[data-src]").forEach((b) => b.classList.toggle("on", b.dataset.src === (plan ? "plan" : "rotate")));
    q("[data-plan]").innerHTML = plan
      ? `<span>حسنًا على خطة الشهر: <b class="num">${left}</b> منشور فاضل، كل واحد في موعده بفكرته وقالبه.</span><button type="button" data-openplan>افتح الخطة</button>`
      : m?.items?.length ? `<span>لديك خطة شهر فيها <b class="num">${m.items.length}</b> منشور${m.status === "applied" ? "" : " تنتظر موافقتك"}.</span><button type="button" data-openplan>راجعها</button>`
      : S.mo && !S.mo.ready ? `<span>خطة الشهر تُنشأ عندما العقل يفهمك ${S.mo.need}٪ (الآن ${S.mo.score}٪).</span>` : "";
    q("[data-tpls]").classList.toggle("dim", plan);
    q("[data-more]").classList.toggle("dim", plan);
    q("[data-tplsub]").textContent = plan ? "القوالب تأتي من الخطة، والموافقات أسفل كما هي" : "يختار منهم بالتبادل لكي المحتوى لا يتكرر";
  }
  async function setSrc(src) {
    if ((src === "plan") === fromPlan()) return;
    if (src === "plan" && !S.mo?.month?.items?.length) {
      toast(S.mo?.ready ? "أنشئ خطة الشهر أولًا من صفحة خطة المحتوى" : `خطة الشهر تُنشأ عندما العقل يفهمك ${S.mo?.need ?? 55}٪`, true);
      return openPlan();
    }
    try {
      const r = await api("/api/plan/month/apply", { method: "POST", ...jsonBody({ on: src === "plan" }) });
      S.d = r.pilot; S.mo = r; draw();
      toast(src === "plan" ? "✅ الأوتوبايلوت حسنًا على خطة الشهر" : "الأوتوبايلوت أعد يختار من القوالب بالدور");
    } catch (err) { toast(err.message, true); }
  }
  function openPlan() { window.RV_FOCUS = "plan-only"; window.NHNav?.("plan"); }
  function drawHead() {
    const s = S.d.settings, nx = S.d.upcoming?.[0];
    q("[data-on]").classList.toggle("on", !!s.on);
    q("[data-st]").textContent = !s.on ? "مغلق" : !s.templates.length && s.source !== "plan" ? "يعمل · اختر قالب واحد على الأقل" : `يعمل${nx ? ` · القادم ${when(nx)}` : ""}`;
  }
  function drawDay() {
    const pct = (h) => (h / 24) * 100, s = S.d.settings;
    q("[data-day]").innerHTML = PEAKS.map(([a, b]) => `<span class="pk" style="left:${pct(a)}%;width:${pct(b - a)}%"></span>`).join("")
      + [0, 6, 12, 18].map((h) => `<span class="hr" style="left:${pct(h)}%">${String(h).padStart(2, "0")}</span>`).join("")
      + s.times.map((t, i) => `<span class="pt ${t.mine ? "mine" : ""}" data-pt="${i}" style="left:${pct(hOf(t.t))}%"><b>${fmtH(hOf(t.t))}</b></span>`).join("");
    q("[data-n]").textContent = s.times.length;
    q("[data-fee]").textContent = S.d.fee ? `· كل منشور ${S.d.fee} نقطة للأوتوبايلوت + تكلفة التوليد` : "";
  }
  function tplList() {
    const d = S.d, twin = d.twins.find((t) => t.ready);
    const names = d.settings.names || {};
    return [
      { id: "phone", n: "تصوير بالجوال", k: "قالب", tag: ["cam", "📱 يحتاج تصوّر بنفسك"] },
      { id: "avatar", n: "تصوير الفيديو بالأفاتار", k: twin ? `بأفاتار ${twin.name}` : "قالب", tag: twin ? null : ["", "يحتاج أفاتار جاهز"], off: !twin },
      ...d.custom.map((c) => ({ id: c.id, n: c.name, k: "قالب مخصص" })),
      { id: "carousel", n: "كاروسيل", k: "قالب", tag: ["", "🖼️ صور على إنستجرام"] },
      ...d.settings.templates.filter((t) => t.startsWith("t-")).map((t) => ({ id: t, n: names[t] || codeTpls().find((x) => x.id === t)?.name || t, k: "قالب" })),
    ];
  }
  function drawTpls() {
    const on = new Set(S.d.settings.templates);
    q("[data-tpls]").innerHTML = tplList().map((m, i) => `<button type="button" class="ap-md ${on.has(m.id) ? "on" : ""} ${m.off ? "off" : ""}" data-tpl="${esc(m.id)}">
        <span class="n">${i + 1}</span><b>${esc(m.n)}</b><small>${esc(m.k)}</small>${m.tag ? `<span class="tag ${m.tag[0]}">${esc(m.tag[1])}</span>` : ""}</button>`).join("")
      + `<button type="button" class="ap-md new" data-moretpl><b>+ قوالب أخرى</b><small>من معرض القوالب</small></button>`
      + `<button type="button" class="ap-md new" data-newauto><b>+ قالب مخصص</b><small>بخطواتك أنت</small></button>`;
    const box = q("[data-more]");
    box.classList.toggle("on", S.more);
    if (S.more) box.innerHTML = codeTpls().map((x) => `<button type="button" class="${on.has(x.id) ? "on" : ""}" data-code="${esc(x.id)}">${on.has(x.id) ? "✓ " : ""}${esc(x.name)}</button>`).join("") || `<span class="ap-none">لا يوجد قوالب أخرى</span>`;
  }
  function drawMode() {
    const s = S.d.settings, cam = s.templates.includes("phone");
    q("[data-modes]").querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === s.mode));
    q("[data-steps]").innerHTML = s.mode === "approve"
      ? STEP_N.map(([k, n], i) => `${i ? "<i>←</i>" : ""}<button type="button" data-step="${k}" class="${s.steps.includes(k) ? "on" : ""}">${s.steps.includes(k) ? "✓ " : ""}${n}</button>`).join("")
      : `<small style="font-size:12.5px;color:var(--nh-muted)">يختار الفكرة ويكتب النص ويعمل الفيديو وينشر بدون ما يرجعلك${cam ? " · قالب الجوال سيستناك تصوّر" : ""}</small>`;
  }
  // صور الكاروسيل صف واحد بيتسحب بالعرض
  const imgs = (j) => (j.images || []).length ? `<div class="ap-imgs">${j.images.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>` : "";
  const ST = { run: "يعمل", wait: "مستنيك", cam: "ينتظر تصويرك", done: "جُدول", failed: "توقف", stopped: "توقف" };
  function jobHTML(j) {
    const head = `<div class="ap-qh"><div class="tx">${esc(j.title || j.name)}<small>${esc(when(j.at))} · ${esc(j.name)}${j.note && j.status === "run" ? ` · ${esc(j.note)}` : ""}</small></div>
      <span class="st ${j.status}">${ST[j.status] || ""}</span></div>`;
    let body = "";
    if (j.status === "wait" && (j.gate === "idea" || j.gate === "script")) {
      body = `<div class="ap-opts">${(j.options || []).map((o) => `<button type="button" class="ap-opt" data-pick="${esc(j.id)}" data-id="${esc(o.id)}"><b>${esc(o.title)}</b><small>${esc(o.text)}</small></button>`).join("")}</div>
        <div class="ap-acts"><span style="font-size:11.5px;color:var(--nh-muted);align-self:center">${j.gate === "idea" ? "اختر فكرة" : "اختر نص"}</span><button type="button" data-stop="${esc(j.id)}">أزل هذا الموعد</button></div>`;
    } else if (j.status === "wait" && j.gate === "montage" && j.kind === "carousel") {
      body = `${imgs(j)}<div class="ap-acts"><button type="button" class="ok" data-ok="${esc(j.id)}">موافق، ارسم السلايدات</button></div>`;
    } else if (j.status === "wait" && j.gate === "video" && j.kind === "carousel") {
      body = `${imgs(j)}<div class="ap-acts"><button type="button" class="ok" data-ok="${esc(j.id)}">موافق، جدوله</button></div>`;
    } else if (j.status === "wait" && j.gate === "montage") {
      body = `<div class="ap-acts"><button type="button" data-edit="${esc(j.project_id)}">افتح المونتاج</button><button type="button" class="ok" data-ok="${esc(j.id)}">موافق، صدّره</button></div>`;
    } else if (j.status === "wait" && j.gate === "video") {
      body = `${j.video_url ? `<video src="${esc(j.video_url)}" controls playsinline preload="metadata"></video>` : ""}
        <div class="ap-acts">${j.project_id ? `<button type="button" data-edit="${esc(j.project_id)}">عدّل في المونتاج</button>` : ""}<button type="button" class="ok" data-ok="${esc(j.id)}">موافق، جدوله</button></div>`;
    } else if (j.status === "cam") {
      body = `${(j.script || []).length ? `<p class="ap-say">${j.script.map(esc).join("<br>")}</p>` : ""}
        <div class="ap-acts"><label class="ok">📱 ارفع الفيديو الذي صوّرته<input type="file" accept="video/*" capture="user" data-cam="${esc(j.id)}"></label><button type="button" data-stop="${esc(j.id)}">أزل هذا الموعد</button></div>`;
    } else if (j.status === "failed") {
      body = `<span class="ap-err">${esc(j.error || "")}</span><div class="ap-acts"><button type="button" data-retry="${esc(j.id)}">جرّب مرة أخرى</button><button type="button" data-del="${esc(j.id)}">احذفها</button></div>`;
    } else if (j.status === "done" && (j.images || []).length) {
      body = imgs(j);
    } else if (j.status === "done" && j.video_url) {
      body = `<div class="ap-acts"><a href="${esc(j.video_url)}" target="_blank" rel="noopener">انظر الفيديو</a></div>`;
    }
    return `<div class="ap-qi">${head}${body}</div>`;
  }
  function drawQ() {
    const jobs = S.d.jobs, w = S.d.waiting;
    const n = q("[data-qn]");
    n.textContent = w; n.hidden = !w;
    q("[data-qsub]").textContent = w ? "ينتظرون منك شيء" : jobs.length ? `${jobs.length} منشور` : "";
    if (S.root.querySelector(".ap-q input[type=file]:focus")) return;
    q("[data-q]").innerHTML = jobs.map(jobHTML).join("") || `<div class="ap-none">${S.d.settings.on ? "أول موعد قادم سيظهر هنا" : "شغّل الأوتوبايلوت والمواعيد ستظهر هنا"}</div>`;
    q("[data-dock]").classList.toggle("open", S.open);
  }

  async function save(patch, msg) {
    try {
      S.d = await api("/api/pilot", { method: "PUT", ...jsonBody({ ...patch, tz: -new Date().getTimezoneOffset() }) });
      draw();
      if (msg) toast(msg);
    } catch (err) { toast(err.message, true); }
  }
  async function act(path, opts, msg) {
    try { S.d = await api(`/api/pilot/jobs/${path}`, opts || { method: "POST" }); drawQ(); drawHead(); if (msg) toast(msg); } catch (err) { toast(err.message, true); }
  }
  const saveTimes = () => save({ times: S.d.settings.times });
  function autoTimes(n) { return (S.d.best[n] || S.d.best[6]).map((t) => ({ t, mine: false })); }

  function bind() {
    const day = q("[data-day]");
    day.addEventListener("pointerdown", (e) => {
      const pt = e.target.closest("[data-pt]"), r = day.getBoundingClientRect(), s = S.d.settings;
      if (pt) { S.drag = { i: +pt.dataset.pt, x: e.clientX, moved: false }; pt.setPointerCapture(e.pointerId); return; }
      if (s.times.length >= 6) return toast("أقصى 6 منشورات في اليوم");
      const h = Math.max(0, Math.min(23.5, Math.round(((e.clientX - r.left) / r.width) * 48) / 2));
      if (s.times.some((t) => t.t === tOf(h))) return;
      s.times.push({ t: tOf(h), mine: true });
      s.times.sort((a, b) => hOf(a.t) - hOf(b.t));
      drawDay(); saveTimes();
    });
    day.addEventListener("pointermove", (e) => {
      const g = S.drag; if (!g) return;
      if (Math.abs(e.clientX - g.x) > 3) g.moved = true;
      if (!g.moved) return;
      const r = day.getBoundingClientRect(), h = Math.max(0, Math.min(23.5, Math.round(((e.clientX - r.left) / r.width) * 48) / 2));
      S.d.settings.times[g.i] = { t: tOf(h), mine: true };
      const el = day.querySelector(`[data-pt="${g.i}"]`);
      el.style.left = `${(h / 24) * 100}%`; el.querySelector("b").textContent = fmtH(h); el.classList.add("mine");
    });
    day.addEventListener("pointerup", () => {
      const g = S.drag; if (!g) return;
      S.drag = null;
      const s = S.d.settings;
      if (!g.moved) { if (s.times.length > 1) s.times.splice(g.i, 1); else return toast("يجب موعد واحد على الأقل"); }
      s.times.sort((a, b) => hOf(a.t) - hOf(b.t));
      drawDay(); saveTimes();
    });
    S.root.addEventListener("change", async (e) => {
      const inp = e.target.closest("[data-cam]");
      if (!inp?.files?.[0]) return;
      const fd = new FormData(); fd.append("file", inp.files[0]);
      toast("يرفع الفيديو…");
      await act(`${inp.dataset.cam}/footage`, { method: "POST", body: fd }, "✓ الفيديو وصل، ويُكمل المراجعة والمونتاج تلقائيًا");
    });
    S.root.addEventListener("click", (e) => {
      const b = e.target.closest("button, a"); const d = b?.dataset || {};
      if (!b) { if (!e.target.closest("[data-dock]") && S.open) { S.open = false; drawQ(); } return; }
      const s = S.d.settings;
      if ("on" in d) return save({ on: !s.on }, !s.on ? "الأوتوبايلوت اشتغل" : "الأوتوبايلوت أُغلق، ولا يوجد شيء جديدة ستبدأ تلقائيًا");
      if (d.cnt) { const n = Math.max(1, Math.min(6, s.times.length + +d.cnt)); s.times = autoTimes(n); drawDay(); return saveTimes(); }
      if (d.tpl) {
        const m = tplList().find((x) => x.id === d.tpl);
        if (m?.off) return toast("أنشئ أفاتار أولًا من «الأفاتار» (فيديو قراية أو صورة قدامية)");
        const set = new Set(s.templates); set.has(d.tpl) ? set.delete(d.tpl) : set.add(d.tpl);
        return save({ templates: [...set] });
      }
      if ("moretpl" in d) { S.more = !S.more; return drawTpls(); }
      if (d.code) {
        const set = new Set(s.templates), x = codeTpls().find((t) => t.id === d.code);
        set.has(d.code) ? set.delete(d.code) : set.add(d.code);
        return save({ templates: [...set], names: x ? { [x.id]: x.name } : {} });
      }
      if ("newauto" in d) return window.NHNav?.("auto");
      if (d.mode) return save({ mode: d.mode });
      if (d.src) return setSrc(d.src);
      if ("openplan" in d) return openPlan();
      if (d.step) { const st = new Set(s.steps); st.has(d.step) ? st.delete(d.step) : st.add(d.step); return save({ steps: STEP_N.map(([k]) => k).filter((k) => st.has(k)) }); }
      if ("cap" in d) { S.open = !S.open; return drawQ(); }
      if (d.pick) return act(`${d.pick}/ok`, { method: "POST", ...jsonBody({ pick: d.id }) }, "✓ اعتُمد، ويُكمل الخطوة القادمة");
      if (d.ok) return act(`${d.ok}/ok`, { method: "POST", ...jsonBody({}) }, "✓ اعتُمد");
      if (d.stop) return act(`${d.stop}/stop`, null, "هذا الموعد أُزيل");
      if (d.retry) return act(`${d.retry}/retry`, null, "يحاول مرة أخرى");
      if (d.del) return act(d.del, { method: "DELETE" });
      if (d.edit) { storageSet(projectKey("free"), d.edit); return showStep("6f"); }
    });
  }
  return { html, mount, close: () => clearInterval(S.timer) };
})();
