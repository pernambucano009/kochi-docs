# استمارة انضمام المدرب — كوتشي

- `join-coach.html` — الاستمارة (ملف واحد، شغال على الآيفون والأندرويد والكمبيوتر).
- `Code.gs` — كود Google Apps Script اللي بيكتب الردود في شيت **مدربو كوتشي v2**.

## الربط بالشيت (مرة واحدة)

1. افتح شيت **مدربو كوتشي v2** ← Extensions ← Apps Script.
2. امسح أي كود موجود والصق محتوى `Code.gs` ← Save.
3. من فوق اختار الدالة `authorize` ← Run ← وافق على الصلاحيات.
4. Deploy ← New deployment ← Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. انسخ الرابط اللي بينتهي بـ `/exec`.
6. افتح `join-coach.html` وحط الرابط مكان `PASTE_YOUR_WEB_APP_URL_HERE` في السطر:
   `var SCRIPT_URL = '...';`

للتأكد: افتح رابط `/exec` في المتصفح. لو ظهر `"ok":true` واسم الشيت، يبقى الربط شغال.

> لو عدّلت `Code.gs` بعد كده: Deploy ← Manage deployments ← Edit ← Version: New version،
> عشان الرابط يفضل زي ما هو.

## على الآيفون

الآيفون مش بيفتح ملفات `.mhtml`، وكمان لو فتحت ملف `.html` من تطبيق Files هيعرضه كمعاينة من غير ما يشغّل الإرسال.
الصح إن الاستمارة تبقى **رابط** يتفتح في Safari، مثلاً على GitHub Pages:
`https://pernambucano009.github.io/kochi-docs/coach-form/join-coach.html`
