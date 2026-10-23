import { useEffect } from "react";
import { I18nManager } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { ReadexPro_300Light, ReadexPro_400Regular, ReadexPro_500Medium } from "@expo-google-fonts/readex-pro";
import { Jost_400Regular, Jost_500Medium } from "@expo-google-fonts/jost";
import { listenPush } from "../src/push";
import { useTheme } from "../src/theme";

// التطبيق عربي: الاتجاه من اليمين للشمال
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const t = useTheme();
  const [loaded] = useFonts({ ReadexPro_300Light, ReadexPro_400Regular, ReadexPro_500Medium, Jost_400Regular, Jost_500Medium });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  useEffect(() => (loaded ? listenPush() : undefined), [loaded]);
  if (!loaded) return null;
  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: "fade" }} />
    </>
  );
}
