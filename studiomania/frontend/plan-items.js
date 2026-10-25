// 💳 بنود الباقات: مصدر واحد لصفحة الأسعار (/pricing و«باقتي ونقاطي») وشاشة الأسعار في صفحة الهبوط، عشان العميل يشوف نفس الكلام في الاتنين.
// كل باقة بتعرض اللي بيزيد فيها عن اللي قبلها، من بيانات /api/pricing نفسها، ومن «features» لو اتضافت في billing.json.
const PlanItems = (() => {
  const T = {
    ar: { base: ["كل الأدوات والقوالب", "عقل العلامة"], acc1: (n) => (n === 2 ? "حسابين سوشيال للنشر" : `${n} حسابات سوشيال للنشر`),
      sched: "جدولة ونشر", inbox: "التعليقات والرسائل", accN: (n, m) => `${n} حسابات سوشيال${m ? ` (حتى ${m})` : ""}`,
      pilot: "أوتوبايلوت: يعمل وينشر تلقائيًا", addon: (p) => `الأوتوبايلوت إضافة بـ ${p} ر.س شهريًا`, nopub: "بدون نشر" },
    en: { base: ["All tools and templates", "Brand brain"], acc1: (n) => `${n} social accounts for publishing`,
      sched: "Scheduling and publishing", inbox: "Comments and messages", accN: (n, m) => `${n} social accounts${m ? ` (up to ${m})` : ""}`,
      pilot: "Autopilot: makes and posts on its own", addon: (p) => `Autopilot add-on, ${p} SAR a month`, nopub: "No publishing" },
  };
  const sar = (v) => Math.round(v * 3.76);
  // p: الباقة، prev: اللي قبلها، addons: إضافات /api/pricing، lang: "ar" أو "en"
  function adds(p, prev, addons, lang) {
    const t = T[lang === "en" ? "en" : "ar"], out = [];
    if (!prev) out.push(...t.base);
    if (p.accounts && !(prev && prev.accounts)) out.push(t.acc1(p.accounts), t.sched, t.inbox);
    else if (prev && p.accounts > prev.accounts) out.push(t.accN(p.accounts, p.max_accounts));
    if (p.autopilot && !(prev && prev.autopilot)) out.push(t.pilot);
    const ap = !p.autopilot && (addons || []).find((a) => a.key === "autopilot" && (a.for || []).includes(p.key));
    if (ap) out.push(t.addon(sar(ap.price)));
    if (!p.accounts) out.push(t.nopub);
    return out.concat((lang === "en" ? p.features_en : p.features) || []);
  }
  return { adds };
})();
