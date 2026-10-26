# الخطة الجاية

حاجات اتأجلت عن قصد، وهنرجعلها بعدين.

## 📱 الدخول برقم الجوال (رمز برسالة نصية أو واتساب)

- **الحالة:** الكود جاهز ومتجرّب، بس **مقفول**. اتأجل لأن أسعار Authentica غالية دلوقتي.
- **الموجود:**
  - `backend/phoneauth.py`
  - `/api/auth/phone/send` و`/api/auth/phone/verify` في `backend/gateway.py`
  - خانة الجوال في `frontend/auth.html`
  - مفتاح «authentica» في إعدادات الأدمن
  - `deploy/oracle/setkey.sh`، بيتأكد من المفتاح قبل ما يحفظه
- **المفتاح:** موجود على السيرفر في `/srv/simsimkit/app.env`، والرصيد صفر.
- **علشان نشغّلها:**
  1. نشحن رصيد عند Authentica، أو نختار شركة أرخص (Unifonic أو Taqnyat أو Msegat). لو اخترنا شركة تانية، نغيّر بس `send` و`verify` في `phoneauth.py`.
  2. نضيف `PHONE_LOGIN=1` لملف `app.env`، ونشغّل `update.sh`.
  3. نعمل تنبيه للأدمن لما الرصيد يقرب يخلص. العنوان `/api/platform/sms` بيرجّع الرصيد أصلًا.
