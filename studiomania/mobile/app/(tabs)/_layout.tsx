// الشريط اللي تحت: الموافقات · المشاريع · الكاميرا · الأفكار · المساحة. أيقونات مصمتة (سودا في الفاتح، بيضا في الغامق وفوق الكاميرا)
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SolidIcon, type SolidName } from "../../src/icons";
import { ACCENT, F, useTheme } from "../../src/theme";
const LABEL: Record<string, string> = { approvals: "الموافقات", projects: "المشاريع", camera: "الكاميرا", ideas: "الأفكار", storage: "المساحة" };

type BarProps = { state: { index: number; routes: { key: string; name: string }[] }; navigation: { navigate: (n: string) => void } };

function Bar({ state, navigation }: BarProps) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const onCamera = state.routes[state.index]?.name === "camera";
  const ink = onCamera || t.dark ? "#FFFFFF" : "#181718";
  return (
    <View style={[s.bar, { paddingBottom: ins.bottom || 12 }, onCamera ? s.barOver : { backgroundColor: t.card, shadowColor: t.shadow }]}>
      {state.routes.map((r, i) => {
        const on = i === state.index;
        const color = on ? (onCamera ? "#FFFFFF" : ACCENT) : ink;
        return (
          <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => navigation.navigate(r.name)} style={s.tab}>
            {r.name === "camera"
              ? <View style={[s.dot, { borderColor: onCamera ? "#FFFFFF" : t.ink }, on && s.dotOn]} />
              : <View style={s.icon}><SolidIcon name={r.name as SolidName} size={25} color={color} /></View>}
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
  barOver: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(12,12,14,.55)" },
  tab: { alignItems: "center", gap: 2, minWidth: 56, minHeight: 48 },
  icon: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, marginTop: 6, marginBottom: 6 },
  dotOn: { shadowColor: "#F0754F", shadowOpacity: 0.9, shadowRadius: 10 },
  label: { fontSize: 10.5 },
});
