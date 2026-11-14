// ملف Firebase (عشان إشعارات أندرويد) مش بيتحط في الريبو: بيترفع على Expo كـ «File» باسم GOOGLE_SERVICES_JSON وبيتقرا وقت البناء
// SIMSIMKIT_API_BASE: نسخة الاختبار الأوتوماتيك (iOS Simulator) بتكلّم staging بدل الإنتاج. من غيره الإعداد زي ما هو.
module.exports = ({ config }) => ({
  ...config,
  ...(process.env.SIMSIMKIT_API_BASE ? { extra: { ...config.extra, apiBase: process.env.SIMSIMKIT_API_BASE } } : {}),
  android: { ...config.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
});
