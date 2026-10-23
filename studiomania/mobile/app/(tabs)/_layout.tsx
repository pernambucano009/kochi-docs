// الشريط اللي تحت بأيقونات سمسمكيت الزجاجية: الموافقات · المشاريع · الكاميرا · الأفكار · المساحة
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ACCENT, F, useTheme } from "../../src/theme";

const ICONS: Record<string, { l: number; d: number }> = {
  approvals: { l: require("../../assets/icons/wacamp.webp"), d: require("../../assets/icons/wacamp_d.webp") },
  projects: { l: require("../../assets/icons/progress.webp"), d: require("../../assets/icons/progress_d.webp") },
  ideas: { l: require("../../assets/icons/voices.webp"), d: require("../../assets/icons/voices_d.webp") },
  storage: { l: require("../../assets/icons/assets.webp"), d: require("../../assets/icons/assets_d.webp") },
};
const LABEL: Record<string, string> = { approvals: "الموافقات", projects: "المشاريع", camera: "الكاميرا", ideas: "الأفكار", storage: "المساحة" };

type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (n: string) => void } };

function Bar({ state, navigation }: BarProps) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const onCamera = state.routes[state.index]?.name === "camera";
  const ink = onCamera ? "rgba(255,255,255,.85)" : t.muted;
  return (
    <View style={[s.bar, { paddingBottom: ins.bottom || 12 }, onCamera ? s.barOver : { backgroundColor: t.card, shadowColor: t.shadow }]}>
      {state.routes.map((r, i) => {
        const on = i === state.index;
        const color = on ? (onCamera ? "#FFFFFF" : ACCENT) : ink;
        return (
          <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => navigation.navigate(r.name)} style={s.tab}>
            {r.name === "camera"
              ? <View style={[s.dot, { borderColor: onCamera ? "#FFFFFF" : t.ink }, on && s.dotOn]} />
              : <Image source={(t.dark || onCamera ? ICONS[r.name].d : ICONS[r.name].l) as number} style={s.icon} />}
            <Text style={[s.label, { color, fontFamily: on ? F.medium : F.regular }]}>{LABEL[r.name]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const unstable_settings = { initialRouteName: "camera" };

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(p) => <Bar {...(p as unknown as BarProps)} />}>
      <Tabs.Screen name="approvals" />
      <Tabs.Screen name="projects" />
      <Tabs.Screen name="camera" />
      <Tabs.Screen name="ideas" />
      <Tabs.Screen name="storage" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "space-around", paddingTop: 8, shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  barOver: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(12,12,14,.35)" },
  tab: { alignItems: "center", gap: 2, minWidth: 56, minHeight: 48 },
  icon: { width: 34, height: 34, resizeMode: "contain" },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, marginTop: 6, marginBottom: 6 },
  dotOn: { shadowColor: "#F0754F", shadowOpacity: 0.9, shadowRadius: 10 },
  label: { fontSize: 10.5 },
});
