// 💓 «نبض المجال» (فرع في عقل البراند): كل اللي بيحصل في مجالك في مكان واحد، بتابات:
// المنافسين (أعلى 5 مشاهدات في مجالك وسوقك، تضيف وتشيل وتبدّل وتثبّت) · اللي بينجح عندهم · الترند آخر ٣٠ يوم · حلّل بوستات بنفسك.
// المنافسين والترند بيدخلوا لوحدهم في كتابة الأفكار والسكريبتات والهوكات.
const RivalsPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const S = { el: null, d: null, timer: null, swap: null, focus: null, tab: "rivals" };
  const TABS = [["rivals", "🏆 المنافسين"], ["works", "🧠 اللي بينجح عندهم"], ["trend", "📈 الترند آخر ٣٠ يوم"], ["mine", "🔥 حلّل بوستات بنفسك"]];
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
        <div class="fs-hero-t"><b>نبض المجال</b><span class="latin">NICHE PULSE</span></div>
        <p>كل اللي بيحصل في مجالك في مكان واحد: أعلى ${d.top} منافسين مشاهدات في مجالك وسوقك، واللي بينجح عندهم، وأعلى البوستات في آخر ٣٠ يوم. كل ده بيدخل لوحده في الأفكار والسكريبتات والهوكات بتاعتك، من غير ما ننسخ كلام حد.</p>
        <p class="nb-hint">بندوّر على حسب: ${where.length ? esc(where.join(" · ")) : "اكتب المجال والسوق والجمهور في فرع «الهوية» الأول"}</p>
        ${d.live ? "" : `<p class="nb-hint">⚠️ وضع تجربة: الحسابات والأرقام دي تجريبية لحد ما يتحط مفتاح مصدر الداتا.</p>`}
        <div class="nb-bar"><button class="nb-btn fs-go" data-rvfind ${busy ? "disabled" : ""}>${d.items.length ? "🔍 دوّر تاني (المثبّتين بيفضلوا)" : `🔍 هات أعلى ${d.top} في مجالي`}</button>
          ${d.items.length ? `<button class="nb-btn" data-rvall ${busy ? "disabled" : ""}>↻ حدّث</button>` : ""}
          ${d.updated_at ? `<span class="nb-state">آخر تحديث ${ago(d.updated_at)} · بيتحدّث لوحده كل أسبوع</span>` : ""}</div>
      </section>
      ${busy ? `<div class="fs-busy">⏳ ${esc(d.step || "شغال…")}</div>` : d.error ? `<div class="fs-err">⚠️ ${esc(d.error)}</div>` : ""}
      <nav class="rv-tabs" role="tablist">${TABS.map(([k, t]) => `<button role="tab" data-rvtab="${k}" aria-selected="${k === S.tab}" class="${k === S.tab ? "on" : ""}">${t}</button>`).join("")}</nav>`;
  }
  function trend(list) {
    if (!list?.length) return `<div class="nh-empty">لسه مفيش. دوس «هات أعلى ${S.d.top} في مجالي» وهنجيب معاهم أعلى البوستات في مجالك آخر ٣٠ يوم.</div>`;
    return `<section class="fs-card"><h3>📈 أعلى البوستات في مجالك آخر ٣٠ يوم <small>من أي حساب، مش المنافسين بس</small></h3>
      <div class="rv-posts">${list.map((p) => `<a class="rv-post" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">
        <b class="vr-x num">${fmt(p.views)}</b><span>${PL[p.platform] || ""} · <bdi dir="ltr">@${esc(p.handle)}</bdi> · ${ago(p.ts)}</span>
        <p>${esc((p.caption || "").slice(0, 160))}</p></a>`).join("")}</div></section>`;
  }
  function body() {
    const d = S.d, busy = d.status === "working";
    if (S.tab === "works") return digest(d.digest) || `<div class="nh-empty">لسه مفيش تحليل. هات المنافسين الأول.</div>`;
    if (S.tab === "trend") return trend(d.trending);
    if (S.tab === "mine") return `<p class="nb-hint">لو شايف بوستات بنفسك (من أي حساب)، حطها هنا ونحسبلك كل بوست عدّى متوسط صاحبه بكام، ونطلعلك أفكار بنفس الهيكل.</p>${ViralPage.html()}`;
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
    w.querySelector(".rv-top").innerHTML = top();
    if (onlyTop && S.tab === "mine") return;   // ماتمسحش اللي بتكتبه في «حلّل بنفسك»
    const bd = w.querySelector(".rv-body");
    bd.innerHTML = body();
    if (S.tab === "mine") ViralPage.mount(bd);
    if (S.focus) { w.querySelector(`[data-rid="${CSS.escape(S.focus)}"]`)?.scrollIntoView({ block: "center" }); S.focus = null; }
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
    w.addEventListener("click", (e) => {
      const tb = e.target.closest("[data-rvtab]");
      if (tb) { S.tab = tb.dataset.rvtab; return render(); }
      if (e.target.closest(".vr-wrap")) return;
      const rid = e.target.closest("[data-rid]")?.dataset.rid;
      if (e.target.closest("[data-rvfind]")) return act("/api/rivals/discover", { method: "POST" });
      if (e.target.closest("[data-rvall]")) return act("/api/rivals/refresh", { method: "POST" });
      if (e.target.closest("[data-rvreset]")) return act("/api/rivals/reset-excluded", { method: "POST" });
      if (e.target.closest("[data-rvadd]")) {
        const h = w.querySelector("[data-rvnew]").value.trim();
        if (!h) return toast("اكتب اسم الحساب", true);
        return act("/api/rivals/add", { method: "POST", ...jsonBody({ handle: h, platform: w.querySelector("[data-rvnewpl]").value }) });
      }
      if (!rid) return;
      if (e.target.closest("[data-rvdel]")) { if (confirm("تشيل المنافس ده؟ مش هيرجع تاني في البحث.")) act(`/api/rivals/${rid}`, { method: "DELETE" }); return; }
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
    S.tab = TABS.some(([k]) => `rv:${k}` === f) ? f.slice(3) : "rivals";
    S.focus = /^rv[^:]/.test(f) ? f.slice(2) : null;
    bind(w);
    try { S.d = await api("/api/rivals"); render(); poll(); }
    catch (err) { w.innerHTML = `<div class="nh-empty">${esc(err.message)}</div>`; }
  }
  return { html, mount, close: () => clearTimeout(S.timer) };
})();
