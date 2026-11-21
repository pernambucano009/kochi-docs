// 💳 «باقتي ونقاطي» (أيقونة الكارت في الشريط اللي فوق): صفحة من صفحات البرنامج، والشكل نفسه في plans-view.js.
// المعاينة من غير البوابة (البرنامج شغال لوحده): بأرقام تجريبية. ?plans=public بيوري شكل الزائر.
const PlansPage = (() => {
  const html = () => `<div class="bq-wrap" id="bqWrap"><div class="nh-empty">جارٍ التحميل…</div></div>`;
  const DEMO = {
    me: { credits: { total: 1240, plan_credits: 740, topup_credits: 500 } }, owner: false, plan: "starter", cycle: "month", extra_accounts: 0, autopilot: false,
    renews_at: Date.now() / 1000 + 18 * 86400, ends_at: null, paypal: true,
    plans: [{ key: "trial", name: "تجربة مجانية", price: 0, credits: 300, accounts: 0, once: true },
      { key: "starter", name: "بداية", price: 29, credits: 1000, accounts: 2, autopilot: false },
      { key: "pro", name: "محترف", price: 79, credits: 3500, accounts: 4, autopilot: true, popular: true },
      { key: "agency", name: "وكالات", price: 199, credits: 30000, accounts: 10, autopilot: true, max_accounts: 25, topup_bonus: 2,
        features: ["النقطة أرخص بنحو ٧٠٪ من «محترف»", "تكفي ٩٠ منشورًا شهريًا بالأوتوبايلوت", "شحن النقاط بضعف القيمة"] }],
    topups: [{ key: "t15", price: 15, credits: 1000 }, { key: "t35", price: 35, credits: 2500 }, { key: "t75", price: 75, credits: 6000 }],
    rules: { plan_credits_rollover: false, topup_valid_months: 12, yearly_months: 10 },
  };
  async function mount(root) {
    const w = root.querySelector("#bqWrap");
    if (!w) return;
    let d, demo = false;
    try { d = await api("/api/billing"); } catch { d = DEMO; demo = true; }
    if (new URLSearchParams(location.search).get("plans") === "public") d = { ...d, me: null };
    PlansView.mount(w, d, {
      toast: (m, bad) => toast(m, bad),
      async coupon(code) {
        if (demo) return toast("هذه معاينة، والكود يعمل في النسخة الحقيقية");
        try {
          const r = await api("/api/billing/coupon", { method: "POST", ...jsonBody({ code }) });
          toast(r.points ? `🎁 أُضيفت ${r.points} نقطة إلى رصيدك` : r.once ? `🎟️ خصم ${r.pct}٪ على دفعتك القادمة` : `🎟️ خصم ${r.pct}٪ على الاشتراك والشحن`);
          if (typeof refreshMe === "function") refreshMe();
          mount(root);
        } catch (err) { toast(err.message, true); }
      },
      // ⬇️ النزول لباقة أقل: بيتسجّل ويحصل في ميعاد التجديد (الباقة الحالية ونقاطها لحد آخر المدة). "" = تراجع
      async downgrade(plan) {
        if (demo) return toast("هذه معاينة، والتغيير يعمل في النسخة الحقيقية");
        const name = (d.plans.find((p) => p.key === plan) || {}).name;
        if (plan && !(await uiConfirm(`تبقى باقتك الحالية ونقاطها حتى نهاية المدة التي دفعتها، ثم تنتقل إلى «${name}» عند التجديد بسعرها. هل تريد ذلك؟`))) return;
        try {
          await api("/api/billing/downgrade", plan ? { method: "POST", ...jsonBody({ plan }) } : { method: "DELETE" });
          toast(plan ? `✓ تنتقل إلى «${name}» عند التجديد` : "✓ ألغيت الانتقال، وتبقى على باقتك");
          mount(root);
        } catch (err) { toast(err.message, true); }
      },
      signup: (plan, cycle) => { location.href = `/signup${plan ? `?plan=${encodeURIComponent(plan)}&cycle=${cycle}` : ""}`; },
      async pay(kind, key, provider, cycle) {
        if (demo) return toast("هذه معاينة، والدفع يعمل في النسخة الحقيقية");
        try {
          // 🧩 إضافة ميزة = نفس باقتك + الإضافات اللي معاك + الجديدة
          const feat = kind === "feat" ? key : "";
          const r = await api("/api/billing/checkout", { method: "POST", ...jsonBody({ provider, kind: feat ? "plan" : kind, plan: feat ? d.plan : kind === "plan" ? key : "", topup: kind === "topup" ? key : "",
            accounts: (d.extra_accounts || 0) + (feat === "account" ? 1 : 0), autopilot: !!d.autopilot || feat === "autopilot", bots: !!d.bots || feat === "bots",
            brands: (d.extra_brands || 0) + (feat === "brand" ? 1 : 0),
            cycle: feat ? d.cycle || "month" : cycle }) });
          try { sessionStorage.removeItem("pv.feat"); } catch { /* */ }
          if (!r.url) throw new Error("لم تُفتح صفحة الدفع، جرّب مرة أخرى");
          location.href = r.url;
        } catch (err) { toast(err.message, true); }
      },
    });
  }
  // راجع من صفحة الدفع (/billing?ok=… بيحوّل هنا): بيفتح «باقتي ونقاطي» وبيقول حصل إيه
  (function back() {
    const q = new URLSearchParams(location.search);
    if (!q.get("plans")) return;
    const msg = q.get("ok") === "plan" ? "✓ فُعّل اشتراكك" : q.get("ok") === "topup" ? "✓ أُضيفت النقاط" : q.get("err") ? "لم يكتمل الدفع، جرّب مرة أخرى" : "";
    let tries = 0;
    const go = () => {
      const btn = document.getElementById("stagePlans");
      if (typeof NH !== "undefined" && NH && btn && document.getElementById("nh")) {
        history.replaceState(null, "", location.pathname + location.hash);
        NH.openPlans(btn);
        if (msg) setTimeout(() => toast(msg, !!q.get("err")), 900);
      } else if (++tries < 40) setTimeout(go, 250);
    };
    addEventListener("load", () => setTimeout(go, 600));
  })();
  return { html, mount, close: () => {} };
})();
