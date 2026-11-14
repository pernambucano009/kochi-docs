// 🚩 الإبلاغ عن نتيجة من الذكاء الاصطناعي: البلاغ بيروح للسيرفر (لوحة المشاكل)، والنتيجة بتختفي من الجهاز على طول.
// أبل بتطلب الإبلاغ عن المحتوى المولّد، وبنستخدمه على أندرويد كمان.
import { Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, json } from "./api";

const KEY = "hidden_refs";
let hidden: Set<string> | null = null;

export async function hiddenRefs(): Promise<Set<string>> {
  if (!hidden) {
    const raw = await SecureStore.getItemAsync(KEY).catch(() => null);
    try { hidden = new Set<string>(raw ? JSON.parse(raw) : []); } catch { hidden = new Set(); }
  }
  return hidden;
}

async function hide(ref: string) {
  const h = await hiddenRefs();
  h.add(ref);
  await SecureStore.setItemAsync(KEY, JSON.stringify([...h].slice(-80))).catch(() => null);
}

// أندرويد بيعرض ٣ زراير بس في الرسالة: سببين + رجوع
const REASONS = ["مسيء أو غير لائق", "خاطئ أو مضلل"];

// بيسأل عن السبب، ويبعت البلاغ، ويخفي النتيجة. بيرجّع true لو المستخدم بلّغ فعلًا
export function reportContent(ref: string, what: string): Promise<boolean> {
  return new Promise((done) => {
    Alert.alert("الإبلاغ عن هذه النتيجة", "ستختفي من عندك، وسيراجعها فريقنا.", [
      ...REASONS.map((r) => ({
        text: r,
        onPress: async () => {
          await api("/api/issues/client", json({ kind: "report", screen: `app:${what}`, message: `بلاغ عن محتوى: ${r}`, raw: ref })).catch(() => null);
          await hide(ref);
          Alert.alert("وصل بلاغك ✓", "شكرًا لك. أخفينا هذه النتيجة.");
          done(true);
        },
      })),
      { text: "رجوع", style: "cancel", onPress: () => done(false) },
    ]);
  });
}

export function confirmDelete(title: string, run: () => Promise<unknown>): Promise<boolean> {
  return new Promise((done) => {
    Alert.alert(`حذف «${title}»؟`, "سيُحذف من التطبيق والموقع، ولا يمكن التراجع عن ذلك.", [
      { text: "رجوع", style: "cancel", onPress: () => done(false) },
      { text: "احذف", style: "destructive", onPress: async () => {
        try { await run(); done(true); } catch (e) { Alert.alert("لم يُحذف", (e as Error).message); done(false); }
      } },
    ]);
  });
}
