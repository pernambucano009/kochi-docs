// 💳 «باقتي ونقاطي» (أيقونة في الشريط اللي فوق): صفحة من صفحات البرنامج، بنفس الشكل والشريط.
// مسجّل دخول: باقتك متعلّم عليها «مفعّلة»، والأعلى منها «أبجريد»، وتقدر تزوّد نقط. مش مسجّل: نفس الصفحة بس أسعار (المعاينة: ?plans=public).
const PlansPage = (() => {
  const esc = (s) => escapeHtml(String(s ?? ""));
  const n = (x) => Number(x || 0).toLocaleString("en-US");
  const S = { el: null, d: null, extra: 0, ap: false, sel: null, demo: false };
  const ORDER = ["trial", "starter", "pro", "agency"];
  const html = () => `<div class="nb-wrap fs-wrap bp-wrap" id="bpWrap"><div class="nh-empty">بيحمّل…</div></div>`;
  // معاينة من غير البوابة (البرنامج شغال لوحده): نفس شكل الرد بالظبط
  const DEMO = {
    me: { credits: { total: 1240, plan_credits: 740, topup_credits: 500 } }, owner: false, plan: "starter", extra_accounts: 0, autopilot: false,
    provider: "stripe", ends_at: Date.now() / 1000 + 18 * 86400, can_portal: true, stripe: true, paypal: true,
    plans: [{ key: "trial", name: "تجربة مجانية", price: 0, credits: 300, accounts: 0, once: true },
      { key: "starter", name: "بداية", price: 29, credits: 1000, accounts: 2, autopilot: false },
      { key: "pro", name: "محترف", price: 79, credits: 3500, accounts: 4, autopilot: true, popular: true },
      { key: "agency", name: "وكالات", price: 199, credits: 10000, accounts: 10, autopilot: true, max_accounts: 25 }],
    addons: [{ key: "account", name: "حساب سوشيال زيادة", price: 10, unit: "للحساب في الشهر" }, { key: "autopilot", name: "أوتوبايلوت", price: 15, unit: "في الشهر", for: ["starter"] }],
    topups: [{ key: "t15", price: 15, credits: 1000 }, { key: "t35", price: 35, credits: 2500 }, { key: "t75", price: 75, credits: 6000 }],
    rules: { plan_credits_rollover: false, topup_valid_months: 12 },
    history: [{ delta: -42, note: "فيديو بـ Kling (5 ثواني)", at: Date.now() / 1000 - 3600 }, { delta: 500, note: "نقط زيادة", at: Date.now() / 1000 - 86400 * 2 },
      { delta: 1000, note: "تجديد باقة بداية", at: Date.now() / 1000 - 86400 * 12 }],
  };
  const FEAT = (p) => [`<b class="num">${n(p.credits)}</b> نقطة ${p.once ? "مرة واحدة" : "كل شهر"}`,
    p.accounts ? `<b class="num">${p.accounts}</b> حسابات سوشيال للنشر${p.max_accounts ? ` (لحد ${p.max_accounts})` : ""}` : "من غير ربط حسابات ولا نشر",
    p.autopilot ? "أوتوبايلوت: فيديوهات وبوستات لوحدها" : "", p.key !== "trial" ? "كل الأدوات والقوالب" : "كل الأدوات للتجربة"].filter(Boolean);

  function hero() {
    const d = S.d, pub = !d.me;
    if (pub) {
      return `<section class="fs-hero"><p>ابدأ بتجربة مجانية، وبعدها اختار الباقة اللي على قد شغلك. كل حاجة في البرنامج بتتحسب بالنقط، وتقدر تزوّد نقط في أي وقت.</p></section>`;
    }
    const c = d.me.credits, cur = d.plans.find((p) => p.key === d.plan), full = (cur?.credits || 0) + (c.topup_credits || 0);
    const ends = d.ends_at ? new Date(d.ends_at * 1000).toLocaleDateString(UI_LOCALE(), { day: "numeric", month: "long" }) : "";
    const pct = full ? Math.max(0, Math.min(1, c.total / full)) : 0, R = 2 * Math.PI * 34;
    return `<section class="fs-hero bp-hero">
        <div class="bp-ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="trk"/><circle cx="40" cy="40" r="34" class="val" style="stroke-dasharray:${(R * pct).toFixed(1)} ${R.toFixed(1)}"/></svg>
          <span><b class="num">${n(c.total)}</b><small>نقطة</small></span></div>
        <div class="bp-hero-t"><p class="bp-now">${d.owner ? "ده حساب صاحب البرنامج، مش محتاج اشتراك." : `باقتك: <b>${esc(cur?.name || "مفيش باقة")}</b>${ends ? ` · بتتجدد ${esc(ends)}` : ""}`}</p>
          <div class="bp-split"><span>نقط الباقة <b class="num">${n(c.plan_credits)}</b></span><span>نقط زيادة <b class="num">${n(c.topup_credits)}</b></span></div>
          ${d.can_portal ? `<div class="nb-bar"><button class="nb-btn sm" data-bpportal>إدارة الاشتراك (الكارت والفواتير والإلغاء)</button></div>` : ""}</div>
      </section>`;
  }
  function plans() {
    const d = S.d, pub = !d.me, curI = ORDER.indexOf(d.plan);
    const cards = d.plans.map((p) => {
      const i = ORDER.indexOf(p.key), current = !pub && p.key === d.plan, higher = !pub && i > curI, lower = !pub && i < curI;
      const btn = pub ? (p.once ? `<a class="nb-btn fs-go" href="/signup">ابدأ ببلاش</a>` : `<a class="nb-btn ${p.popular ? "fs-go" : ""}" href="/signup?plan=${esc(p.key)}">اشترك</a>`)
        : current ? `<span class="bp-cur">✓ باقتك الحالية</span>`
        : higher && !p.once ? `<button class="nb-btn fs-go" data-bpup="${esc(p.key)}">⬆️ أبجريد</button>` : `<span class="bp-low">${p.once ? "خلصت التجربة" : "أقل من باقتك"}</span>`;
      return `<article class="fs-card bp-plan${current ? " on" : ""}${p.popular ? " pop" : ""}${lower ? " low" : ""}">
          ${p.popular ? `<span class="bp-tag">الأكتر اختيارًا</span>` : ""}
          <h3>${esc(p.name)}</h3>
          <div class="bp-price">${p.price ? `<b class="num">$${p.price}</b><small>في الشهر</small>` : `<b>ببلاش</b><small>مرة واحدة</small>`}</div>
          <ul>${FEAT(p).map((f) => `<li>${f}</li>`).join("")}</ul>
          <div class="bp-act">${btn}</div></article>`;
    }).join("");
    return `<section class="bp-sec"><h3 class="rv-sec">${pub ? "الباقات" : "الباقات"} <small>${pub ? "اختار اللي على قد شغلك" : "باقتك متعلّم عليها، وتقدر تعمل أبجريد لأي باقة أعلى"}</small></h3>
      <div class="bp-plans">${cards}</div>${S.sel ? upgradeBox() : ""}</section>`;
  }
  // الأبجريد: باقة + حسابات زيادة + أوتوبايلوت، وطريقة الدفع
  function upgradeBox() {
    const d = S.d, p = d.plans.find((x) => x.key === S.sel), add = Object.fromEntries(d.addons.map((a) => [a.key, a]));
    const max = p.max_accounts ? p.max_accounts - p.accounts : 20;
    S.extra = Math.max(0, Math.min(S.extra, max));
    const apOk = !p.autopilot && (add.autopilot?.for || []).includes(p.key);
    const total = p.price + S.extra * add.account.price + (apOk && S.ap ? add.autopilot.price : 0);
    return `<section class="fs-card bp-up"><h3>⬆️ الأبجريد لباقة ${esc(p.name)}</h3>
        <div class="am-row"><span>حسابات زيادة <small>($${add.account.price} للحساب)</small></span>
          <span class="bp-step"><button class="nb-btn sm" data-bpacc="-1">−</button><b class="num">${S.extra}</b><button class="nb-btn sm" data-bpacc="1">＋</button></span>
          ${apOk ? `<label><input type="checkbox" data-bpap ${S.ap ? "checked" : ""}> أوتوبايلوت <small>($${add.autopilot.price})</small></label>` : ""}</div>
        <div class="bp-total"><span>الإجمالي</span><b class="num">$${total}</b><small>في الشهر</small></div>
        <div class="nb-bar">${pay("plan", "")}<button class="nb-btn sm" data-bpx>إلغاء</button></div>
        <p class="nb-hint">${!d.stripe && !d.paypal ? "الدفع لسه بيتجهز، هيتفتح قريب." : "الدفع بيتم في صفحة الدفع الآمنة، وبيانات الكارت مش بتعدّي علينا. الفرق بيتحسب على الأيام الباقية."}</p></section>`;
  }
  const pay = (kind, topup) => `<button class="nb-btn fs-go" data-bppay="stripe" data-kind="${kind}" data-topup="${topup}" ${S.d.stripe ? "" : "disabled"}>💳 بالكارت</button>
    <button class="nb-btn" data-bppay="paypal" data-kind="${kind}" data-topup="${topup}" ${S.d.paypal ? "" : "disabled"}>PayPal</button>`;
  function topups() {
    const d = S.d, pub = !d.me;
    return `<section class="bp-sec"><h3 class="rv-sec">نقط زيادة <small>لما نقط الباقة تخلص · صالحة ${d.rules.topup_valid_months} شهر</small></h3>
      <div class="bp-tops">${d.topups.map((t) => `<article class="fs-card bp-top"><div class="bp-price"><b class="num">${n(t.credits)}</b><small>نقطة</small></div>
          <p><b class="num">$${t.price}</b> · ${(t.price * 100 / t.credits).toFixed(2)} سنت للنقطة</p>
          <div class="bp-act">${pub ? `<a class="nb-btn" href="/signup">سجّل الأول</a>` : pay("topup", t.key)}</div></article>`).join("")}</div>
      <p class="nb-hint">${d.rules.plan_credits_rollover ? "نقط الباقة بتترحّل للشهر الجاي." : "نقط الباقة بتتجدد كل شهر (مابتترحّلش)، والنقط الزيادة بتفضل لحد ما تخلص أو تعدّي مدتها."} الطلب اللي يفشل نقطه بترجعلك.</p></section>`;
  }
  function history() {
    const d = S.d;
    if (!d.me) return "";
    return `<section class="fs-card"><h3>🧾 آخر الحركات</h3>${d.history.length ? `<div class="bp-hist">${d.history.map((h) => `<div class="bp-h"><span>${new Date(h.at * 1000).toLocaleDateString(UI_LOCALE(), { day: "numeric", month: "short" })}</span>
        <span>${esc(h.note)}</span><b class="num ${h.delta > 0 ? "plus" : ""}">${h.delta > 0 ? "+" : ""}${n(h.delta)}</b></div>`).join("")}</div>` : `<p class="nb-hint">لسه مفيش حركات.</p>`}</section>`;
  }
  function render() {
    if (!S.el || !S.d) return;
    S.el.innerHTML = hero() + (S.demo ? `<p class="nb-hint">👀 معاينة بأرقام تجريبية.</p>` : "") + plans() + topups() + history();
  }
  function bind(w) {
    w.addEventListener("change", (e) => { if (e.target.matches("[data-bpap]")) { S.ap = e.target.checked; render(); } });
    w.addEventListener("click", async (e) => {
      const q = (s) => e.target.closest(s);
      if (q("[data-bpup]")) { S.sel = q("[data-bpup]").dataset.bpup; S.extra = 0; S.ap = false; render(); return w.querySelector(".bp-up")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
      if (q("[data-bpx]")) { S.sel = null; return render(); }
      if (q("[data-bpacc]")) { S.extra += +q("[data-bpacc]").dataset.bpacc; return render(); }
      if (q("[data-bpportal]")) { try { location.href = (await api("/api/billing/portal", { method: "POST" })).url; } catch (err) { toast(err.message, true); } return; }
      const b = q("[data-bppay]");
      if (b) {
        if (S.demo) return toast("ده معاينة، الدفع بيشتغل في النسخة الحقيقية");
        b.disabled = true;
        try {
          const r = await api("/api/billing/checkout", { method: "POST", ...jsonBody({ provider: b.dataset.bppay, kind: b.dataset.kind, plan: S.sel || "", accounts: S.extra, autopilot: S.ap, topup: b.dataset.topup || "" }) });
          if (!r.url) throw new Error("صفحة الدفع مارجعتش، جرّب تاني");
          location.href = r.url;
        } catch (err) { toast(err.message, true); b.disabled = false; }
      }
    });
  }
  async function mount(root) {
    const w = root.querySelector("#bpWrap");
    if (!w) return;
    S.el = w; S.sel = null;
    bind(w);
    const pubView = new URLSearchParams(location.search).get("plans") === "public" || window.PLANS_PUBLIC === true;
    try { S.d = await api("/api/billing"); S.demo = false; }
    catch { S.d = DEMO; S.demo = true; }   // البرنامج شغال من غير البوابة
    if (pubView) S.d = { ...S.d, me: null };
    render();
  }
  return { html, mount, close: () => {} };
})();
