// المساحة السحابية: قد إيه مستخدم (فيديوهات نهائية، لقطات خام، صور، أصوات)، وفيديوهاتك النهائية تتفرج عليها وتحفظها
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../src/api";
import { Icon } from "../../src/icons";
import { ACCENT, useTheme } from "../../src/theme";
import { Card, T } from "../../src/ui";
import { VideoSheet, type SheetVideo } from "../../src/VideoSheet";

type Storage = { folders: Record<string, number> };
type Export = { id: string; name: string; url: string; download_url: string; duration: number | null; created_at: string };

// فولدرات السيرفر متجمّعة في ٤ أنواع زي البروتوتايب
const GROUPS: { name: string; color: string; keys: string[] }[] = [
  { name: "الفيديوهات النهائية", color: ACCENT, keys: ["exports"] },
  { name: "اللقطات الخام", color: "#F6B29E", keys: ["raw", "clips", "generated", "lab", "refs", "tvideos", "films", "series"] },
  { name: "الصور والتصاميم", color: "#8C8C88", keys: ["assets", "carousels", "coaches", "ads", "typo"] },
  { name: "الأصوات والموسيقى", color: "#5FD1A4", keys: ["audio"] },
];
const ADDONS = [50, 200, 1000];
const gb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} جيجا` : `${Math.max(1, Math.round(mb))} ميجا`);
const dur = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

export default function StorageTab() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const [st, setSt] = useState<Storage | null>(null);
  const [exps, setExps] = useState<Export[]>([]);
  const [loading, setLoading] = useState(false);
  const [video, setVideo] = useState<SheetVideo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([api<Storage>("/api/storage").catch(() => null), api<Export[]>("/api/exports").catch(() => [] as Export[])]);
    setSt(a || { folders: {} });
    setExps(b);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const f = st?.folders || {};
  const parts = GROUPS.map((g) => ({ ...g, mb: g.keys.reduce((n, k) => n + (f[k] || 0), 0) }));
  const used = parts.reduce((n, p) => n + p.mb, 0);

  return (
    <>
      <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: ins.top + 18, paddingBottom: ins.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={ACCENT} />}>
        <T size={22} weight="medium">المساحة السحابية</T>

        <Card style={{ gap: 12 }}>
          {st === null ? <ActivityIndicator color={ACCENT} /> : (
            <>
              <View style={s.usedRow}>
                <T size={30} weight="medium">{gb(used)}</T>
                <T muted size={12.5}>مستخدمة على حسابك</T>
              </View>
              <View style={[s.bar, { backgroundColor: t.field }]}>
                {used > 0 ? parts.map((p) => <View key={p.name} style={{ flex: p.mb, backgroundColor: p.color }} />) : null}
              </View>
              <View style={{ gap: 6 }}>
                {parts.map((p) => (
                  <View key={p.name} style={s.legend}>
                    <View style={[s.dot, { backgroundColor: p.color }]} />
                    <T size={12.5} style={{ flex: 1 }}>{p.name}</T>
                    <T muted size={12}>{p.mb ? gb(p.mb) : "—"}</T>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>

        <View style={s.head}>
          <T weight="medium" size={15}>فيديوهاتك النهائية</T>
          <T muted size={12}>{exps.length} فيديو</T>
        </View>
        {!exps.length && st ? <T muted size={12.5}>لا توجد فيديوهات مُصدّرة بعد.</T> : null}
        {exps.slice(0, 30).map((e) => (
          <Pressable key={e.id} onPress={() => setVideo(e)} style={({ pressed }) => [s.item, { backgroundColor: t.card, shadowColor: t.shadow }, pressed && { transform: [{ scale: 1.02 }] }]}>
            <View style={[s.itemIcon, { backgroundColor: t.softAccent }]}><Icon name="play" size={16} color={ACCENT} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={13.5} weight="medium">{e.name}</T>
              <T muted size={11.5}>{[dur(e.duration), new Date(e.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}</T>
            </View>
          </Pressable>
        ))}

        <T weight="medium" size={15} style={{ marginTop: 8 }}>زِد مساحتك</T>
        <View style={s.addons}>
          {ADDONS.map((n) => (
            <View key={n} style={[s.addon, { backgroundColor: t.card, shadowColor: t.shadow }]}>
              <T size={18} weight="medium">+{n === 1000 ? "1 تيرا" : n}</T>
              <T muted size={11.5}>{n === 1000 ? "" : "جيجا"}</T>
              <T muted size={11}>قريبًا</T>
            </View>
          ))}
        </View>
        <T muted size={12} style={{ textAlign: "center" }}>نفس المساحة في التطبيق وعلى الموقع.</T>
      </ScrollView>
      <VideoSheet video={video} onClose={() => setVideo(null)} />
    </>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 18, gap: 14 },
  usedRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  bar: { height: 12, borderRadius: 6, overflow: "hidden", flexDirection: "row" },
  legend: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, padding: 14, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  itemIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  addons: { flexDirection: "row", gap: 10 },
  addon: { flex: 1, height: 96, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 2, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
});
