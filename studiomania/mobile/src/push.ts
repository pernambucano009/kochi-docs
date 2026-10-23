// 🔔 إشعارات الأوتوبايلوت: الموبايل بيسجّل توكنه على الحساب، ولما تدوس على إشعار بيفتح الموافقة نفسها
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router } from "expo-router";
import { api, json } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

let token = "";

export async function registerPush() {
  if (!Device.isDevice) return;
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

function openFrom(r: Notifications.NotificationResponse | null) {
  const d = r?.notification.request.content.data as { kind?: string; jid?: string; gate?: string } | undefined;
  if (d?.kind !== "pilot") return;
  router.navigate({ pathname: "/approvals", params: { jid: d.jid || "" } });
}

// بيتنادى مرة من الـ layout: الإشعار اللي فتح التطبيق، وأي إشعار يتداس عليه بعد كده
export function listenPush() {
  openFrom(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(openFrom);
  return () => sub.remove();
}
