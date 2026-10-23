// ملف Firebase (عشان إشعارات أندرويد) مش بيتحط في الريبو: بيترفع على Expo كـ «File» باسم GOOGLE_SERVICES_JSON وبيتقرا وقت البناء
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}) },
});
