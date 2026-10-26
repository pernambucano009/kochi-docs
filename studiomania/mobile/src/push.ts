// 🔔 إشعارات الأوتوبايلوت: الموبايل بيسجّل توكنه على الحساب، ولما تدوس على إشعار بيفتح الموافقة نفسها
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router } from "expo-router";
import { Alert } from "react-native";
import { api, json } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

let token = "";

// 🔘 زراير على الإشعار نفسه (زي التصميم): المونتاج والفيديو بيتوافق عليهم من الإشعار، والفكرة والسكريبت بيتختاروا في التطبيق
async function categories() {
  const skip = { identifier: "skip", buttonTitle: "تخطَّ هذا الموعد", options: { isDestructive: true, opensAppToForeground: true } };
  await Notifications.setNotificationCategoryAsync("pilot_ok", [
    { identifier: "ok", buttonTitle: "موافق", options: { opensAppToForeground: true } }, skip,
    { identifier: "open", buttonTitle: "افتح في التطبيق", options: { opensAppToForeground: true } },
  ]).catch(() => null);
  await Notifications.setNotificationCategoryAsync("pilot_open", [
    { identifier: "open", buttonTitle: "اختر في التطبيق", options: { opensAppToForeground: true } }, skip,
  ]).catch(() => null);
}

export async function registerPush() {
  if (!Device.isDevice) return;
  await categories();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("approvals", {
      name: "الموافقات", importance: AndroidImportance.HIGH, lightColor: "#E5613E", vibrationPattern: [0, 200, 120, 200],
    });
  }
  let p = await Notifications.getPermissionsAsync();
  if (!p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
  if (!p.granted) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api("/api/push/register", json({ token }));
  } catch {
    // من غير إشعارات التطبيق شغال عادي: الموافقات بتظهر في التاب
  }
}

export async function unregisterPush() {
  if (token) await api("/api/push/unregister", json({ token })).catch(() => null);
}

const handled = new Set<string>();
async function openFrom(r: Notifications.NotificationResponse | null) {
  if (!r) return;
  const key = r.notification.request.identifier + ":" + r.actionIdentifier;
  if (handled.has(key)) return;   // نفس الضغطة ممكن توصل مرتين (فتح التطبيق + المستمع)
  handled.add(key);
  const d = r.notification.request.content.data as { kind?: string; jid?: string; gate?: string; hid?: string } | undefined;
  if (d?.kind === "handoff" && d.hid) { router.navigate({ pathname: "/handoff/[id]", params: { id: d.hid } }); return; }
  if (d?.kind !== "pilot") return;
  if (d.jid && (r.actionIdentifier === "ok" || r.actionIdentifier === "skip")) {
    try {
      await api(`/api/pilot/jobs/${d.jid}/${r.actionIdentifier === "ok" ? "ok" : "stop"}`, r.actionIdentifier === "ok" ? json({ pick: "" }) : { method: "POST" });
      Alert.alert("تم ✓", r.actionIdentifier === "ok" ? (d.gate === "video" ? "جُدول الفيديو وسيُنشر في موعده." : "وافقت، ويكمل الأوتوبايلوت العمل.") : "تخطيت هذا الموعد.");
    } catch (e) {
      Alert.alert("لم يكتمل", (e as Error).message);
    }
  }
  router.navigate({ pathname: "/approvals", params: { jid: d.jid || "" } });
}

// بيتنادى مرة من الـ layout: الإشعار اللي فتح التطبيق، وأي إشعار يتداس عليه بعد كده
export function listenPush() {
  openFrom(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(openFrom);
  return () => sub.remove();
}
