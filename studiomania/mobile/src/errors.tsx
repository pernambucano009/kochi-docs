// 🧯 أخطاء الجافاسكربت: في نسخة المتجر أي خطأ في رسم الشاشة بيقفل التطبيق كله (SIGABRT من ExceptionsManager).
// - ErrorBoundary: الشاشة اللي فيها الخطأ بتعرض رسالة و«حاول مرة أخرى» بدل ما التطبيق يقفل.
// - أي خطأ (حتى اللي برّه الرسم) بيتبعت للوحة المشاكل على السيرفر برسالته والـ stack، عشان نعرف سببه من غير كمبيوتر.
import { Platform, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { api, json } from "./api";
import { useTheme } from "./theme";
import { GlowButton, T } from "./ui";

const sent = new Set<string>();

export function reportError(e: unknown, where: string) {
  const err = e instanceof Error ? e : new Error(String(e));
  const key = where + err.message;
  if (sent.has(key)) return Promise.resolve();
  sent.add(key);
  const ver = `${Platform.OS} ${Constants.expoConfig?.version || ""}`;
  return api("/api/issues/client", json({ kind: "js", screen: `app:${where}`, message: `[${ver}] ${err.message}`.slice(0, 1000), raw: (err.stack || "").slice(0, 3000) }))
    .then(() => undefined, () => undefined);
}

// بيتنادى مرة واحدة من الـ layout: بيبعت الخطأ القاتل للسيرفر ويستنى ثانية ونص قبل ما يسيب التطبيق يقفل
export function installGlobalErrorReporter() {
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => {
    const r = reportError(e, fatal ? "fatal" : "error");
    if (!fatal) return prev(e, fatal);
    Promise.race([r, new Promise((ok) => setTimeout(ok, 1500))]).finally(() => prev(e, fatal));
  });
}

// expo-router بيستخدمها لما أي route يعمل `export { ScreenError as ErrorBoundary }`
export function ScreenError({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const t = useTheme();
  reportError(error, "screen");
  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <T size={17} weight="medium" style={s.center}>حدثت مشكلة في هذه الشاشة</T>
      <T muted size={13} style={s.center}>أرسلنا تفاصيلها لفريقنا تلقائيًا.</T>
      <T muted size={11} style={s.center}>{error.message}</T>
      <GlowButton title="حاول مرة أخرى" onPress={() => { retry(); }} style={{ alignSelf: "stretch", marginTop: 8 }} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 28 },
  center: { textAlign: "center" },
});
