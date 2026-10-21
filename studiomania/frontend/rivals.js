// 🏆 «منافسينك» (فرع في عقل البراند): كل اللي يخص المنافسين في صفحة واحدة، بتابات:
// المنافسين (أعلى 5 مشاهدات في مجالك وسوقك، تضيف وتشيل وتبدّل وتثبّت) · اللي بينجح عندهم · حلّل آخر ١٠ فيديوهات ليك · خطة المحتوى.
// الترند بقى دراع لوحده في العقل، والفحص قبل النشر بقى أوتوماتيك في صفحة النشر، وقواعد الخوارزميات دراع لوحدها.
const RivalsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, d: null, timer: null, swap: null, focus: null, tab: "rivals", pl: { d: null, busy: false, notes: "" }, bt: { d: null, busy: "", handle: "", platform: "" } };
  const TABS = [["rivals", "🏆 المنافسين"], ["works", "🧠 اللي بينجح عندهم"], ["batch", "📊 حلّل آخر ١٠ فيديوهات ليك"], ["audience", "🎯 وصفة الاستهداف"]];
  const html = () => `<div class="nb-wrap fs-wrap rv-wrap" id="rvWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  const fmt = (n) => { n = +n || 0; return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n); };
  const PL = { tiktok: "TikTok", instagram: "Instagram" };
  const ago = (ts) => { if (!ts) return ""; const d = Math.round((Date.now() / 1000 - ts) / 86400); return d <= 0 ? "النهارده" : d === 1 ? "امبارح" : `من ${d} يوم`; };
  const profile = (r) => (r.platform === "tiktok" ? `https://www.tiktok.com/@${r.handle}` : `https://www.instagram.com/${r.handle}`);

  function card(r) {
    const focus = S.focus === r.id;
    return `<article class="fs-card rv-card${focus ? " on" : ""}" data-rid="${esc(r.id)}">
      <div class="rv-head">
        <span class="rv-pl rv-${esc(r.platform)}">${PL[r.platform] || esc(r.platform)}</span>
        <a href="${esc(profile(r))}" target="_blank" rel="noopener noreferrer" dir="ltr"><b>@${esc(r.handle)}</b></a>
        ${r.pinned ? `<span class="rv-pin" title="ثابت: مش هيتبدّل لما تدوّر تاني">📌</span>` : ""}
        <span class="rv-acts">
          <button class="nb-btn sm" data-rvpin title="${r.pinned ? "فكّ التثبيت" : "ثبّته علشان مايتبدّلش"}">${r.pinned ? "فكّ التثبيت" : "📌 ثبّت"}</button>
          <button class="nb-btn sm" data-rvswap>🔁 بدّل</button>
          <button class="nb-btn sm" data-rvone>↻ حدّث</button>
          <button class="nb-btn sm danger" data-rvdel>✕ شيل</button></span></div>
      <div class="rv-stats"><span>متوسط المشاهدات <b class="num">${fmt(r.median_views)}</b></span><span>أعلى بوست <b class="num">${fmt(r.top_views)}</b></span>
        ${r.followers ? `<span>متابعين <b class="num">${fmt(r.followers)}</b></span>` : ""}<span>آخر ٣٠ يوم <b class="num">${r.recent_count || 0}</b> بوست</span></div>
      ${r.why ? `<p class="nb-hint">💡 ${esc(r.why)}</p>` : ""}${r.error ? `<div class="fs-err">⚠️ ${esc(r.error)}</div>` : ""}
      ${S.swap === r.id ? `<div class="nb-row rv-add"><input type="text" data-rvswapin placeholder="الحساب اللي هيتحط مكانه: @اسم أو لينك" dir="ltr">
          <select data-rvswappl>${Object.entries(PL).map(([k, t]) => `<option value="${k}" ${k === r.platform ? "selected" : ""}>${t}</option>`).join("")}</select>
          <button class="nb-btn" data-rvswapgo>بدّل</button><button class="nb-btn sm" data-rvswapx>إلغاء</button></div>` : ""}
      <div class="rv-posts">${(r.posts || []).slice(0, 6).map((p) => `<a class="rv-post" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">
          <b class="vr-x">×${p.multiple || "—"}</b><span class="num">${fmt(p.views)} مشاهدة · ${ago(p.ts)}</span>
          <p>${esc((p.spoken || p.caption || "").slice(0, 160))}</p></a>`).join("")}</div>
    </article>`;
  }
  function digest(d) {
    if (!d || !Object.keys(d).length) return "";
    const box = (k, t) => (d[k] || []).length ? `<div><h4>${t}</h4><ul>${d[k].map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    return `<section class="fs-card"><h3>🧠 اللي بينجح عندهم <small>ده اللي بيدخل في كتابة أفكارك وسكريبتاتك وهوكاتك</small></h3>
      ${d.summary ? `<p>${esc(d.summary)}</p>` : ""}
      <div class="rv-dg">${box("hooks", "🎣 هوكات بتكسب")}${box("concepts", "💡 أفكار بتجيب مشاهدات")}${box("formats", "🧩 أشكال ناجحة")}${box("angles", "🚪 زوايا فاضية ليك")}${box("avoid", "🚫 بيجيب مشاهدات قليلة")}</div></section>`;
  }
  function top() {
    const d = S.d, busy = d.status === "working", b = d.brain || {};
    const where = [b.domain && `المجال: ${b.domain}`, b.market && `السوق: ${b.market}`, b.audience && `الجمهور: ${b.audience}`].filter(Boolean);
    return `<section class="fs-hero">
        <div class="fs-hero-t"><b>منافسينك</b><span class="latin">YOUR COMPETITORS</span></div>
        <p>أعلى ${d.top} منافسين مشاهدات في مجالك وسوقك، واللي بينجح عندهم، وتحليل آخر ١٠ فيديوهات ليك قصادهم. كل ده بيدخل لوحده في الأفكار والسكريبتات والهوكات بتاعتك، من غير ما ننسخ كلام حد.</p>
        <p class="nb-hint">بندوّر على حسب: ${where.length ? esc(where.join(" · ")) : "اكتب المجال والسوق والجمهور في فرع «الهوية» الأول"}</p>
        ${d.live ? "" : `<p class="nb-hint">⚠️ وضع تجربة: الحسابات والأرقام دي تجريبية لحد ما يتحط مفتاح مصدر الداتا.</p>`}
        <div class="nb-bar"><button class="nb-btn fs-go" data-rvfind ${busy ? "disabled" : ""}>${d.items.length ? "🔍 دوّر تاني (المثبّتين بيفضلوا)" : `🔍 هات أعلى ${d.top} في مجالي`}</button>
          ${d.items.length ? `<button class="nb-btn" data-rvall ${busy ? "disabled" : ""}>↻ حدّث</button>` : ""}
          ${d.updated_at ? `<span class="nb-state">آخر تحديث ${ago(d.updated_at)} · بيتحدّث لوحده كل أسبوع</span>` : ""}</div>
        <label class="rv-mode" title="القواعد بتبقى خطوات إجبارية: الأفكار الضعيفة أو برّه المجال بتتشال، السكريبت بيتفحص ويتصلّح قبل ما تشوفه، والمونتاج والكابشن بيتعملوا على القواعد">
          <input type="checkbox" data-rvmode ${d.algo_mode ? "checked" : ""}> <b>⚡ وضع الخوارزمية</b> <small>${d.algo_mode ? "شغال: القواعد خطوات إجبارية في صناعة كل فيديو" : "مقفول: القواعد نصايح بس"}</small></label>
      </section>
      ${busy ? `<div class="fs-busy">⏳ ${esc(d.step || "شغال…")}</div>` : d.error ? `<div class="fs-err">⚠️ ${esc(d.error)}</div>` : ""}
      <nav class="rv-tabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-rvtab="${k}" aria-selected="${k === S.tab}" class="${k === S.tab ? "on" : ""}">${t}</button>`).join("")}</nav>`;
  }
  // 🧭 خطة المحتوى: فريمويركس الاستراتيجية مطبّقة على البراند (لعبة المحتوى، التموضع، دواير الجمهور، المواضيع، خلطة ٣-٢-١…)
  function planTab() {
    const P = S.pl, st = P.d?.strategy, G = P.d?.games || {}, AX = P.d?.axes || {}, pl = P.d?.plan;
    if (!P.d) return `<div class="nh-empty">بيحمّل…</div>`;
    // الخطة بتتبني لوحدها من كل اللي العقل عرفه: عدّاد بيزيد، والهدف مستنتج من الدعوة واللينك والعروض والكويز (من غير ما تكتبه)
    const fresh = pl ? Math.max(0, pl.count - pl.built_from) : 0;
    const form = pl ? `<div class="pl-count"><b class="num">${pl.count}</b><span>معلومة العقل بيبني منها خطتك${pl.status === "working" ? " · ⏳ بتتبني دلوقتي…" : fresh && pl.has ? ` · ${fresh} جديدة هتدخل في التحديث الجاي` : ""}</span></div>
      <div class="pl-by">${pl.by.map((x) => `<span>${esc(x.t)} <b class="num">${x.n}</b></span>`).join("")}</div>
      <p class="nb-hint">الخطة بتتعمل وبتتحدّث لوحدها كل ما العقل يعرف حاجات جديدة عنك (من الهوية والكويز والمعرفة والمواسم ولايكاتك على الأفكار وتحليل صفحتك والمنافسين). هدفك بيتستنتج من الدعوة واللينك والعروض، مش محتاج تكتبه.
        ${st && pl.status !== "working" ? `<button class="nb-btn sm" data-plgo ${P.busy ? "disabled" : ""}>${P.busy ? "⏳…" : "🔄 حدّثها دلوقتي"}</button>` : ""}</p>${pl.error ? `<div class="fs-err">⚠️ ${esc(pl.error)}</div>` : ""}` : "";
    if (!st) return `<section class="fs-card"><h3>🧭 خطة المحتوى <small>المخ بيطبّق فريمويركس الاستراتيجية على براندك انت</small></h3>
        <p class="nb-hint">بتحدد لعبتك (شهرة ولا بيع)، وجملة التموضع، والشخص اللي بتكلمه، ودواير الجمهور، ومجموعات المواضيع والأشكال، وجدول أسبوع بخلطة ٣-٢-١، وآراءك المختلفة، والفراغ اللي المنافسين سايبينه، والدعوة والهدية. وكل الأفكار والسكريبتات والهوكات في البرنامج بتمشي عليها.</p>
        ${form}${pl && pl.status !== "working" && (pl.count < pl.min || !pl.ready) ? `<p class="nb-hint">⏳ هتتبني لوحدها أول ما العقل يعرف ${pl.min} معلومات على الأقل (ومنهم «المجال» أو «عن البراند»). كمّل العقل من الكويز أو ضيف للعقل.</p>` : ""}</section>`;
    const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join("");
    const sec = (t, h) => `<section class="fs-card pl-sec"><h3>${t}</h3>${h}</section>`;
    return `<section class="fs-card pl-hero">
        <span class="pl-game">${esc(G[st.game.key] || "")}</span>
        <p class="pl-state">${esc(st.statement)}</p>
        <p class="nb-hint">${esc(st.game.why)}</p>
        ${st.avatar ? `<p><b>الشخص اللي بنكلمه:</b> ${esc(st.avatar)}</p>` : ""}
        ${form}</section>
      ${st.rings.length ? sec("🎯 دواير الجمهور <small>من الأضيق للأعرض · ماتنزلش في أوسع دايرة</small>", `<ol class="pl-rings">${st.rings.map((r, i) => `<li style="--r:${i}"><span class="num">${i + 1}</span>${esc(r)}</li>`).join("")}</ol>`) : ""}
      ${st.buckets.length ? sec("🗂 مجموعات المواضيع", `<div class="pl-grid">${st.buckets.map((b) => `<div class="pl-card"><b>${esc(b.name)}</b><small>دايرة ${b.ring} · ${esc(b.why)}</small><ul>${li(b.topics)}</ul></div>`).join("")}</div>`) : ""}
      ${st.formats.length || st.formulas.length ? sec("🧱 الأشكال والتركيبات <small>موضوع + شكل + عرض بصري</small>", `<div class="pl-grid">${st.formats.map((f) => `<div class="pl-card"><b>${esc(f.name)}</b><small>${esc(f.why)}</small></div>`).join("")}</div>
          ${st.formulas.length ? `<table class="pl-tbl"><tr><th>الموضوع</th><th>الشكل</th><th>العرض</th></tr>${st.formulas.map((f) => `<tr><td>${esc(f.topic)}</td><td>${esc(f.format)}</td><td>${esc(f.visual)}</td></tr>`).join("")}</table>` : ""}`) : ""}
      ${st.week.length ? sec("📅 أسبوعك بخلطة ٣-٢-١", `<div class="pl-week">${st.week.map((w) => `<div class="pl-day"><span>${esc(w.day)}<small>دايرة ${w.ring}</small></span><div><b>${esc(w.idea)}</b>${w.hook ? `<i>«${esc(w.hook)}»</i>` : ""}<small>${esc(w.bucket)}${w.cta ? ` · ${esc(w.cta)}` : ""}</small></div></div>`).join("")}</div>`) : ""}
      ${st.takes.length ? sec("🔥 آراءك المختلفة <small>اللي هيخليك تخترق المجال</small>", `<ul class="pl-list">${li(st.takes)}</ul>`) : ""}
      ${sec("🧲 الارتباط والتميّز", `${st.words.length ? `<p><b>كلمات نتعرف بيها:</b> ${st.words.map((w) => `<span class="pl-chip">${esc(w)}</span>`).join("")}</p>` : ""}
          ${st.signature ? `<p><b>توقيعك الشكلي:</b> ${esc(st.signature)}</p>` : ""}
          <div class="pl-grid">${Object.entries(st.white_space).filter(([, v]) => v).map(([k, v]) => `<div class="pl-card"><b>الفراغ في ${esc(AX[k] || k)}</b><small>${esc(v)}</small></div>`).join("")}</div>`)}
      ${sec("💰 من مشاهد لعميل", `<div class="pl-grid"><div class="pl-card"><b>علّق بكلمة</b><span class="pl-chip">${esc(st.funnel.keyword || "—")}</span></div>
          <div class="pl-card"><b>الهدية</b><small>${esc(st.funnel.magnet)}</small></div><div class="pl-card"><b>العرض</b><small>${esc(st.funnel.offer)}</small></div></div>`)}
      ${sec("⏱ الإيقاع والمنصة والبروفايل", `${st.cadence ? `<p><b>الإيقاع:</b> ${esc(st.cadence)}</p>` : ""}${st.platform ? `<p><b>منصة البيت:</b> ${esc(st.platform)}</p>` : ""}
          ${st.profile.bio ? `<p><b>البايو:</b> ${esc(st.profile.bio)}</p>` : ""}${st.profile.pinned ? `<p><b>الفيديو المثبّت:</b> ${esc(st.profile.pinned)}</p>` : ""}
          ${st.avoid.length ? `<p><b>نبعد عن:</b></p><ul class="pl-list">${li(st.avoid)}</ul>` : ""}`)}`;
  }
  // 📊 تحليل الدفعة: آخر ١٠ فيديوهات للبراند، كل واحد بكام ضعف وسيط الدفعة، والمخ يقارن الفايزين بالخاسرين ويخطط العشرة الجايين
  const TIER = { gold: "🥇", win: "🏆", ok: "", low: "" };
  function batchTab() {
    const B = S.bt, d = B.d;
    if (!d) return `<div class="nh-empty">بيحمّل…</div>`;
    const c = d.calc, a = d.analysis, handle = B.handle || d.handle, plat = B.platform || d.platform;
    const by = { leads: "العملاء", follows: "المتابعين", views: "المشاهدات" };
    const head = `<section class="fs-card"><h3>📊 حلّل آخر ١٠ فيديوهات <small>بنقارن الفيديوهات ببعض مش بالأرقام المجردة: اللي عمل ٥ أضعاف وسيط الدفعة فايز، و١٠ أضعاف دهب</small></h3>
        <div class="nb-row rv-add"><input type="text" data-btin placeholder="@حساب البراند" dir="ltr" value="${esc(handle)}">
          <select data-btpl>${Object.entries(PL).map(([k, t]) => `<option value="${k}" ${k === plat ? "selected" : ""}>${t}</option>`).join("")}</select>
          <button class="nb-btn" data-btfetch ${B.busy ? "disabled" : ""}>${B.busy === "fetch" ? "⏳ بيجيب…" : "📥 هات آخر ١٠"}</button></div>
        ${d.live ? "" : `<p class="nb-hint">⚠️ وضع تجربة: الأرقام تجريبية لحد ما يتحط مفتاح مصدر الداتا.</p>`}
        ${d.algo_mode !== false ? `<p class="nb-hint">⚡ وضع الخوارزمية: بعد أول مرة تجيب فيها الفيديوهات، كل ١٠ بوستات تتنشر من البرنامج الدفعة بتتجاب وتتحلل لوحدها، والنتيجة بتدخل في الأفكار الجاية.</p>` : ""}
        <p class="nb-hint">لو عندك أرقام العملاء/التسجيلات (من ManyChat أو الرسايل) أو المتابعين اللي جابهم كل فيديو، اكتبها جنبه: التحليل بيقدّمها على المشاهدات.</p></section>`;
    if (!c) return head;
    const rows = c.rows.map((r, i) => `<div class="bt-row ${r.tier}">
        <span class="bt-x num">${r.x != null ? "×" + r.x : "—"}${TIER[r.tier] ? " " + TIER[r.tier] : ""}</span>
        <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="bt-cap"><b>${i + 1}.</b> ${esc((r.caption || "").slice(0, 120) || "—")}<small>${fmt(r.views)} مشاهدة · ${ago(r.ts)}</small></a>
        <label>عملاء<input type="number" min="0" data-btm="${esc(r.id)}" data-k="leads" value="${r.leads ?? ""}"></label>
        <label>متابعين<input type="number" min="0" data-btm="${esc(r.id)}" data-k="follows" value="${r.follows ?? ""}"></label></div>`).join("");
    const an = a ? `<section class="fs-card bt-an"><h3>🧠 اللي الدفعة دي بتقوله</h3>
        <p>${esc(a.summary)}</p>
        <div class="pl-grid"><div class="pl-card"><b>✅ اللي نجح</b><small>${esc(a.pattern)}</small></div><div class="pl-card"><b>❌ أوضح غلطة</b><small>${esc(a.mistake)}</small></div>
          <div class="pl-card"><b>🧪 التحسين الواحد اللي هنجرّبه</b><small>${esc(a.hypothesis)}</small></div>
          ${Object.values(a.formula).some(Boolean) ? `<div class="pl-card"><b>🧱 التركيبة الفايزة</b><small>${esc(a.formula.topic)} · ${esc(a.formula.format)} · ${esc(a.formula.hook_style)}</small></div>` : ""}</div>
        ${a.bricks.length ? `<table class="pl-tbl"><tr><th>القطعة</th><th>في الفايزين</th><th>في الخاسرين</th></tr>${a.bricks.map((x) => `<tr><td>${esc(x.brick)}</td><td>${esc(x.winners)}</td><td>${esc(x.losers)}</td></tr>`).join("")}</table>` : ""}
        ${a.next.length ? `<h4>📅 العشرة الجايين</h4><div class="pl-week">${a.next.map((x) => `<div class="pl-day"><span>${x.n}<small>${x.kind === "repeat" ? "تكرار" : "تجربة"}</small></span><div><b>${esc(x.idea)}</b>${x.hook ? `<i>«${esc(x.hook)}»</i>` : ""}${x.based_on ? `<small>زي فيديو ${x.based_on}</small>` : ""}</div></div>`).join("")}</div>` : ""}
        ${a.stop.length ? `<h4>🛑 نبطّل</h4><ul class="pl-list">${a.stop.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <p class="nb-hint">التحليل ده بيدخل لوحده في كتابة الأفكار والسكريبتات الجاية.</p></section>` : "";
    const hist = d.history.length ? `<section class="fs-card"><h3>🗂 الدفعات اللي فاتت</h3><ul class="pl-list">${d.history.slice().reverse().map((h) => `<li>${TIER[h.verdict] || "🔁"} ×${h.best} · ${esc(h.hypothesis || "")}</li>`).join("")}</ul></section>` : "";
    return head + `<section class="fs-card"><div class="bt-verdict ${c.verdict}">${esc(d.verdict_text)}</div>
        <p class="nb-hint">المضاعف محسوب على ${by[c.rows.find((r) => r.by)?.by] || "المشاهدات"} (وسيط الدفعة)</p>
        <div class="bt-rows">${rows}</div>
        <div class="nb-bar"><button class="nb-btn fs-go" data-btgo ${B.busy ? "disabled" : ""}>${B.busy === "an" ? "⏳ بيحلّل…" : a ? "🔄 حلّل تاني" : "🧠 حلّل الدفعة"}</button></div></section>` + an + hist;
  }
  // 🎯 وصفة الاستهداف: من كلام جمهور المنافسين (من غير أسامي) لاستهداف جاهز تحطه في ميتا وجوجل وتيك توك
  const GEN = { all: "الكل", female: "ستات", male: "رجالة" };
  const lines = (a) => (a || []).filter(Boolean).join("\n");
  function audText(a) {
    const m = a.meta, g = a.google, t = a.tiktok, sec = (h, b) => (b ? `${h}\n${b}\n` : "");
    return [a.summary, ...a.personas.map((p) => sec(`👤 ${p.name} (${p.age.join("-")} · ${GEN[p.gender]})`, [p.who, p.hook && `الهوك: ${p.hook}`].filter(Boolean).join("\n"))),
      sec("📘 ميتا", [`السن: ${m.age.join("-")} · ${GEN[m.gender]}`, m.locations.length && `الأماكن: ${m.locations.join("، ")}`, m.interests.length && `الاهتمامات: ${m.interests.join(", ")}`,
        m.behaviors.length && `السلوك: ${m.behaviors.join(", ")}`, m.exclusions.length && `استبعد: ${m.exclusions.join("، ")}`, m.placements && `الأماكن: ${m.placements}`].filter(Boolean).join("\n")),
      sec("🔎 جوجل: كلمات", lines(g.keywords)), sec("🚫 جوجل: كلمات سلبية", lines(g.negative)), sec("🎯 جوجل: سيجمنت المنافسين", lines(g.competitor_terms)), sec("▶️ يوتيوب", lines(g.youtube_topics)),
      sec("🎵 تيك توك", [t.tt_interests.join(", "), t.tt_hashtags.map((h) => "#" + h).join(" ")].filter(Boolean).join("\n")),
      sec("#️⃣ هاشتاجات", a.hashtags.map((h) => "#" + h).join(" ")), ...a.angles.map((x) => sec(`📣 ${x.angle} (${x.persona})`, `${x.text}\n${x.cta}`)),
      sec("❓ أسئلة الجمهور", lines(a.questions)), sec("🧱 اعتراضات", lines(a.objections)), sec("💰 الميزانية", a.budget)].filter(Boolean).join("\n");
  }
  function audTab() {
    const d = S.d, a = d.audience || {}, busy = d.status === "working", has = (a.personas || []).length || (a.meta?.interests || []).length;
    const chips = (arr, k, pre = "") => (arr || []).length ? `<p>${arr.map((x) => `<span class="pl-chip">${pre}${esc(x)}</span>`).join("")}
        <button class="nb-btn sm" data-aucp="${k}" title="انسخ">📋</button></p>` : "";
    const row = (t, h) => (h ? `<div class="tg-row"><b>${t}</b>${h}</div>` : "");
    const head = `<section class="fs-card"><h3>🎯 وصفة الاستهداف <small>مين الجمهور اللي هيشتري، وإزاي توصله في الإعلانات بالظبط</small></h3>
        <p class="nb-hint">بنقرا كومنتات أحسن بوستات المنافسين وهاشتاجاتهم علشان نسمع الجمهور بيقول إيه، وبعدين المخ بيطلّعلك الشرايح والاستهداف الجاهز لميتا وجوجل وتيك توك، وزوايا إعلانات بلهجة السوق.</p>
        <p class="nb-hint">🔒 بنقرا الكلام بس من غير أسامي، والاستهداف بالاهتمامات اللي المنصات نفسها بتديها، مش بقايمة ناس.</p>
        ${d.items.length ? "" : `<p class="nb-hint">⚠️ هات المنافسين الأول من تاب «🏆 المنافسين».</p>`}
        <div class="nb-bar"><button class="nb-btn fs-go" data-augo ${busy || !d.items.length ? "disabled" : ""}>${has ? "🔄 حدّث الوصفة" : "🎯 اعمل الوصفة"}</button>
          ${has ? `<button class="nb-btn" data-aucp="all">📋 انسخ الكل</button><span class="nb-state">اتعملت ${ago(a.at)}${a.comments ? ` · من ${a.comments} كومنت` : ""}</span>` : ""}</div></section>`;
    if (!has) return head;
    const m = a.meta, g = a.google, t = a.tiktok;
    return head + `${a.summary ? `<section class="fs-card"><p class="tg-sum">${esc(a.summary)}</p></section>` : ""}
      ${a.personas.length ? `<section class="fs-card"><h3>👥 الشرايح</h3><div class="pl-grid">${a.personas.map((p) => `<div class="pl-card tg-per">
          <b>${esc(p.name)}</b><small>${esc(p.who)}</small><small class="num">السن ${p.age.join("-")} · ${GEN[p.gender]}</small>
          ${p.pains.length ? `<small>😣 ${esc(p.pains.join("، "))}</small>` : ""}${p.desires.length ? `<small>✨ ${esc(p.desires.join("، "))}</small>` : ""}
          ${p.hook ? `<i>«${esc(p.hook)}»</i>` : ""}</div>`).join("")}</div></section>` : ""}
      <section class="fs-card"><h3>📘 ميتا (فيسبوك وإنستجرام) <small>حطهم في Ads Manager ← الجمهور</small></h3>
        ${row("السن والنوع", `<p class="num">${m.age.join("-")} · ${GEN[m.gender]}</p>`)}${row("الأماكن", chips(m.locations, "m.locations"))}
        ${row("الاهتمامات", chips(m.interests, "m.interests"))}${row("السلوك", chips(m.behaviors, "m.behaviors"))}${row("استبعد", chips(m.exclusions, "m.exclusions"))}
        ${row("أماكن الإعلان", m.placements ? `<p>${esc(m.placements)}</p>` : "")}</section>
      <section class="fs-card"><h3>🔎 جوجل ويوتيوب</h3>${row("كلمات البحث", chips(g.keywords, "g.keywords"))}${row("كلمات سلبية (نستبعدها)", chips(g.negative, "g.negative"))}
        ${row("سيجمنت مخصص: اللي بيدوروا على المنافسين", chips(g.competitor_terms, "g.competitor_terms"))}${row("مواضيع يوتيوب", chips(g.youtube_topics, "g.youtube_topics"))}</section>
      <section class="fs-card"><h3>🎵 تيك توك والهاشتاجات</h3>${row("اهتمامات تيك توك", chips(t.tt_interests, "t.tt_interests"))}${row("هاشتاجات الإعلانات", chips(t.tt_hashtags, "t.tt_hashtags", "#"))}
        ${row("هاشتاجات للمحتوى العادي", chips(a.hashtags, "hashtags", "#"))}</section>
      ${a.angles.length ? `<section class="fs-card"><h3>📣 زوايا الإعلانات</h3><div class="pl-grid">${a.angles.map((x, i) => `<div class="pl-card"><b>${esc(x.angle)}</b>
          <small>${esc(x.persona)}</small><p>${esc(x.text)}</p>${x.cta ? `<span class="pl-chip">${esc(x.cta)}</span>` : ""}<button class="nb-btn sm" data-aucp="angle.${i}">📋 انسخ</button></div>`).join("")}</div></section>` : ""}
      ${a.questions.length || a.objections.length ? `<section class="fs-card"><div class="rv-dg">
          ${a.questions.length ? `<div><h4>❓ أسئلة الجمهور <small>أفكار محتوى وإعلانات جاهزة</small></h4><ul>${a.questions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          ${a.objections.length ? `<div><h4>🧱 اللي بيمنعهم يشتروا <small>رد عليه في الإعلان</small></h4><ul>${a.objections.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}</div></section>` : ""}
      ${a.budget ? `<section class="fs-card"><h3>💰 تبدأ بكام</h3><p>${esc(a.budget)}</p></section>` : ""}
      <section class="fs-card"><h3>🔥 الجمهور الدافي <small>أقوى من أي اهتمامات، اعمله أول ما يبقى عندك تفاعل</small></h3><ul class="pl-list">
        <li>اللي اتفرجوا على فيديوهاتك (٥٠٪ أو أكتر) في آخر ٣٠ يوم.</li><li>اللي اتفاعلوا مع صفحتك أو بعتولك رسالة.</li>
        <li>اللي دخلوا موقعك (لو حاطط بيكسل ميتا أو تاج جوجل).</li><li>قايمة عملائك انت (اللي اشتروا منك ووافقوا) ← ومنها جمهور شبيه (Lookalike) ١-٣٪.</li></ul></section>`;
  }
  function audCopy(k) {
    const a = S.d.audience || {}, src = { m: a.meta, g: a.google, t: a.tiktok };
    let txt = "";
    if (k === "all") txt = audText(a);
    else if (k.startsWith("angle.")) { const x = a.angles[+k.slice(6)]; txt = x ? `${x.text}\n${x.cta}` : ""; }
    else { const [o, f] = k.includes(".") ? k.split(".") : [null, k]; const arr = (o ? src[o] : a)?.[f] || []; txt = (/hashtags/.test(f) ? arr.map((h) => "#" + h) : arr).join(/hashtags/.test(f) ? " " : "\n"); }
    if (!txt) return toast("مفيش حاجة تتنسخ", true);
    navigator.clipboard.writeText(txt).then(() => toast("📋 اتنسخ")).catch(() => toast("المتصفح منع النسخ", true));
  }
  function body() {
    const d = S.d, busy = d.status === "working";
    if (S.tab === "works") return digest(d.digest) || `<div class="nh-empty">لسه مفيش تحليل. هات المنافسين الأول.</div>`;
    if (S.tab === "plan") return planTab();
    if (S.tab === "batch") return batchTab();
    if (S.tab === "audience") return audTab();
    return `<section class="fs-card"><h3>ضيف منافس بنفسك</h3>
        <div class="nb-row rv-add"><input type="text" data-rvnew placeholder="@اسم الحساب أو اللينك" dir="ltr">
          <select data-rvnewpl>${Object.entries(PL).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>
          <button class="nb-btn" data-rvadd ${busy ? "disabled" : ""}>＋ ضيف</button></div>
        <p class="nb-hint">اللي بتضيفه بيتثبّت لوحده. واللي بتشيله مش بيرجع تاني لما تدوّر.
          ${d.excluded ? `<button class="nb-btn sm" data-rvreset>رجّع اللي شيلتهم (${d.excluded})</button>` : ""}</p></section>
      <div class="rv-list ${busy ? "fs-lock" : ""}">${d.items.map(card).join("") || `<div class="nh-empty">لسه مفيش منافسين. دوس «هات أعلى ${d.top} في مجالي».</div>`}</div>`;
  }
  function render(onlyTop) {
    const w = S.el;
    if (!w || !S.d) return;
    if (!w.querySelector(".rv-top")) w.innerHTML = `<div class="rv-top"></div><div class="rv-body"></div>`;
    w.querySelector(".rv-top").innerHTML = S.only ? `<section class="fs-hero"><div class="fs-hero-t"><b>خطة المحتوى</b><span class="latin">CONTENT PLAN</span></div>
        <p>استراتيجية حسابك كله: بتتبني لوحدها وبتكبر مع كل معلومة العقل بيعرفها عنك، وكل الأفكار والسكريبتات والهوكات بتمشي عليها.</p></section>` : top();
    if (onlyTop && (S.tab === "plan" || S.tab === "batch")) return;   // ماتمسحش اللي بتكتبه
    const bd = w.querySelector(".rv-body");
    bd.innerHTML = body();
    if (S.tab === "batch" && !S.bt.d) api("/api/batch").then((x) => { S.bt.d = x; if (S.tab === "batch") render(); }).catch((err) => toast(err.message, true));
    if (S.tab === "plan" && !S.pl.d) api("/api/strategy").then((x) => { S.pl.d = x; if (S.tab === "plan") render(); planPoll(); }).catch((err) => toast(err.message, true));
    if (S.focus) { w.querySelector(`[data-rid="${CSS.escape(S.focus)}"]`)?.scrollIntoView({ block: "center" }); S.focus = null; }
  }
  // الخطة وهي بتتبني لوحدها: بنشوف كل شوية لحد ما تخلص
  function planPoll() {
    clearTimeout(S.plT);
    if (S.pl.d?.plan?.status !== "working") return;
    S.plT = setTimeout(async () => { try { S.pl.d = await api("/api/strategy"); if (S.tab === "plan") render(); } catch {} planPoll(); }, 4000);
  }
  function poll() {
    clearTimeout(S.timer);
    if (S.d?.status !== "working") return;
    S.timer = setTimeout(async () => {
      try { S.d = await api("/api/rivals"); render(true); } catch {}
      poll();
    }, 2500);
  }
  async function act(path, opts) {
    try { S.d = await api(path, opts); S.swap = null; render(); poll(); }
    catch (err) { toast(err.message, true); }
  }
  function bind(w) {
    w.addEventListener("input", (e) => {
      if (e.target.matches("[data-btin]")) S.bt.handle = e.target.value;
    });
    w.addEventListener("change", (e) => {
      if (e.target.matches("[data-btpl]")) S.bt.platform = e.target.value;
      if (e.target.matches("[data-rvmode]")) {
        api("/api/algo/mode", { method: "POST", ...jsonBody({ on: e.target.checked }) })
          .then((x) => { S.d.algo_mode = x.on; render(true); toast(x.on ? "⚡ وضع الخوارزمية اشتغل" : "وضع الخوارزمية اتقفل"); }).catch((err) => toast(err.message, true));
      }
      if (e.target.matches("[data-btm]")) {
        const row = S.el.querySelectorAll(`[data-btm="${CSS.escape(e.target.dataset.btm)}"]`), val = (k) => { const x = [...row].find((i) => i.dataset.k === k)?.value; return x === "" || x == null ? null : +x; };
        api("/api/batch/metric", { method: "PATCH", ...jsonBody({ id: e.target.dataset.btm, leads: val("leads"), follows: val("follows") }) })
          .then((x) => { S.bt.d = x; render(); }).catch((err) => toast(err.message, true));
      }
    });
    w.addEventListener("click", async (e) => {
      if (e.target.closest("[data-btfetch]")) {
        const B = S.bt, h = (B.handle || B.d?.handle || "").trim();
        if (!h) return toast("اكتب حساب البراند", true);
        B.busy = "fetch"; render();
        try { B.d = await api("/api/batch/fetch", { method: "POST", ...jsonBody({ handle: h, platform: B.platform || B.d?.platform || "tiktok" }) }); }
        catch (err) { toast(err.message, true); }
        B.busy = ""; return render();
      }
      if (e.target.closest("[data-btgo]")) {
        S.bt.busy = "an"; render();
        try { S.bt.d = await api("/api/batch/analyze", { method: "POST" }); } catch (err) { toast(err.message, true); }
        S.bt.busy = ""; render();
        return S.el.querySelector(".bt-an")?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      if (e.target.closest("[data-plgo]")) {
        S.pl.busy = true; render();
        try { await api("/api/strategy", { method: "POST", ...jsonBody({}) }); S.pl.d = await api("/api/strategy"); toast("✅ الخطة اتحدّثت، وكل الأدوات هتمشي عليها"); }
        catch (err) { toast(err.message, true); }
        S.pl.busy = false; return render();
      }
      const tb = e.target.closest("[data-rvtab]");
      if (tb) { S.tab = tb.dataset.rvtab; return render(); }
      if (e.target.closest(".vr-wrap")) return;
      const rid = e.target.closest("[data-rid]")?.dataset.rid;
      if (e.target.closest("[data-augo]")) return act("/api/rivals/audience", { method: "POST" });
      const cp = e.target.closest("[data-aucp]");
      if (cp) return audCopy(cp.dataset.aucp);
      if (e.target.closest("[data-rvfind]")) return act("/api/rivals/discover", { method: "POST" });
      if (e.target.closest("[data-rvall]")) return act("/api/rivals/refresh", { method: "POST" });
      if (e.target.closest("[data-rvreset]")) return act("/api/rivals/reset-excluded", { method: "POST" });
      if (e.target.closest("[data-rvadd]")) {
        const h = w.querySelector("[data-rvnew]").value.trim();
        if (!h) return toast("اكتب اسم الحساب", true);
        return act("/api/rivals/add", { method: "POST", ...jsonBody({ handle: h, platform: w.querySelector("[data-rvnewpl]").value }) });
      }
      if (!rid) return;
      if (e.target.closest("[data-rvdel]")) { if ((await uiConfirm("تشيل المنافس ده؟ مش هيرجع تاني في البحث."))) act(`/api/rivals/${rid}`, { method: "DELETE" }); return; }
      if (e.target.closest("[data-rvpin]")) { const r = S.d.items.find((x) => x.id === rid); return act(`/api/rivals/${rid}`, { method: "PATCH", ...jsonBody({ pinned: !r?.pinned }) }); }
      if (e.target.closest("[data-rvone]")) return act(`/api/rivals/refresh?rid=${encodeURIComponent(rid)}`, { method: "POST" });
      if (e.target.closest("[data-rvswap]")) { S.swap = rid; render(); w.querySelector("[data-rvswapin]")?.focus(); return; }
      if (e.target.closest("[data-rvswapx]")) { S.swap = null; return render(); }
      if (e.target.closest("[data-rvswapgo]")) {
        const h = w.querySelector("[data-rvswapin]").value.trim();
        if (!h) return toast("اكتب اسم الحساب", true);
        return act("/api/rivals/add", { method: "POST", ...jsonBody({ handle: h, platform: w.querySelector("[data-rvswappl]").value, replace: rid }) });
      }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#rvWrap");
    if (!w) return;
    S.el = w;
    w.innerHTML = "";
    const f = String(window.RV_FOCUS || "");
    window.RV_FOCUS = null;
    S.only = f === "plan-only";   // 🧭 من نقطة «خطة المحتوى» في العقل: صفحة الخطة لوحدها
    S.tab = S.only ? "plan" : TABS.some(([k]) => `rv:${k}` === f) ? f.slice(3) : "rivals";
    S.pl.d = null;   // عدّاد الخطة بيتجاب من جديد كل مرة
    S.focus = /^rv[^:]/.test(f) ? f.slice(2) : null;
    bind(w);
    try { S.d = await api("/api/rivals"); render(); poll(); }
    catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => clearTimeout(S.timer) };
})();
