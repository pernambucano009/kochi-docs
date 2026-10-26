# 🧭 رحلة التجربة

حساب عميل تجريبي على الـ staging بيمشي في البرنامج زي العميل بالظبط، بنقاط حقيقية (برصيد محدود)، وبيسجّل لكل خطوة النتيجة والنقاط اللي صرفتها والأخطاء، وصور الشاشات بالعربي والإنجليزي، وفيديو.

- **التشغيل:** غيّر `request.json` (المرحلة، والمجالات، وأقصى نقاط) وارفعه، فيشتغل `.github/workflows/journey.yml`.
- **محتاج سرّين في GitHub:** `STAGING_ADMIN_EMAIL` و `STAGING_ADMIN_PASSWORD` (حساب الأدمن على الـ staging)، عشان يعمل حساب العميل `journey@test.simsimkit.com` ويحط رصيده.
- **النتيجة:** فرع `journey-results` تحت `phase-N/` (report.md، report.json، shots/، video/).
- **تجربة محلية من غير رصيد:** `node tests/journey/run.js` (وضع التجربة).
- **العلامات:** `brands.json` (١٠ مجالات، أسماء وهمية).
