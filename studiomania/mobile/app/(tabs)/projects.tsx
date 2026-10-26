// المشاريع: كل اللي شغّال عليه (مشاريع القوالب ومشاريع المونتاج) بالكفر بتاعه، واللي خلص تتفرج عليه وتحفظه
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE, api, mediaHeaders, mediaUrl } from "../../src/api";
import { Icon } from "../../src/icons";
import { shoot, toShoot } from "../../src/shoot";
import { ACCENT, useTheme } from "../../src/theme";
import { Card, T } from "../../src/ui";
import { VideoSheet, type SheetVideo } from "../../src/VideoSheet";

type Flow = { id: string; template?: { kind?: string; name?: string }; stage?: string; title?: string; updated_at?: string };
type Project = { id: string; name: string; cover_url: string | null; render_status: string; render_progress?: number | null; export_id: string | null; updated_at: string; data?: { name?: string } };
type Export = { id: string; name: string; url: string; download_url: string; project_id: string | null; created_at: string };
type Row = { key: string; title: string; sub: string; at: string; cover: string | null; state: "done" | "busy" | "todo" | "shoot"; video?: SheetVideo; flowId?: string };

const STAGE: Record<string, string> = { idea: "الفكرة", scenario: "النص", shoot: "الفيديو", review: "الملاحظات", montage: "المونتاج", generate: "التوليد",
  format: "الشكل", cast: "الشخصيات", assets: "العناصر", output: "الناتج" };

function ago(at: string) {
  const h = (Date.now() - new Date(at).getTime()) / 3600000;
  if (!(h >= 0)) return "";
  if (h < 1) return "منذ قليل";
  if (h < 24) return `منذ ${Math.round(h)} ساعة`;
  if (h < 48) return "أمس";
  return new Date(at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export default function Projects() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [video, setVideo] = useState<SheetVideo | null>(null);
  const [filter, setFilter] = useState<"all" | "busy" | "done">("all");
  useEffect(() => { mediaHeaders().then(setHeaders); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [flows, projects, exports, todo] = await Promise.all([
      api<Flow[]>("/api/flows").catch(() => [] as Flow[]),
      api<Project[]>("/api/projects").catch(() => [] as Project[]),
      api<Export[]>("/api/exports").catch(() => [] as Export[]),
      toShoot().catch(() => []),
    ]);
    const shootIds = new Set(todo.filter((x) => x.kind === "flow").map((x) => x.id));
    const exp = new Map(exports.map((e) => [e.id, e]));
    const out: Row[] = [];
    for (const p of projects) {
      const e = p.export_id ? exp.get(p.export_id) : undefined;
      const busy = p.render_status === "rendering";
      out.push({
        key: "p" + p.id, title: p.name || "مشروع", at: p.updated_at, cover: p.cover_url,
        sub: busy ? `جارٍ التصدير${p.render_progress ? ` ${Math.round(p.render_progress)}٪` : "…"}` : e ? "الفيديو جاهز" : p.render_status === "failed" ? "توقف التصدير" : "في المونتاج",
        state: e && !busy ? "done" : busy ? "busy" : "todo", video: e ? { id: e.id, name: e.name, url: e.url, download_url: e.download_url } : undefined,
      });
    }
    for (const f of flows) {
      const needs = shootIds.has(f.id);
      out.push({
        key: "f" + f.id, title: f.title || f.template?.name || "مشروع قالب", at: f.updated_at || "", cover: null, flowId: f.id,
        sub: needs ? "📱 بانتظار تصويرك" : `${f.template?.name || "قالب"} · ${STAGE[f.stage || ""] || "قيد العمل"}`, state: needs ? "shoot" : "todo",
      });
    }
    out.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    setRows(out);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function open(r: Row) {
    if (r.video) return setVideo(r.video);
    if (r.state === "shoot" && r.flowId) {
      const todo = (await toShoot()).find((x) => x.kind === "flow" && x.id === r.flowId);
      if (todo) { shoot.start({ kind: "flow", id: todo.id, title: todo.title }, todo.lines); return router.push("/teleprompter"); }
    }
    Linking.openURL(API_BASE + "/");
  }

  const list = (rows || []).filter((r) => filter === "all" || (filter === "done" ? r.state === "done" : r.state !== "done"));
  const chip = (k: typeof filter, label: string) => (
    <Pressable key={k} onPress={() => setFilter(k)} style={[s.chip, { backgroundColor: filter === k ? ACCENT : t.field }]}>
      <T size={12.5} style={{ color: filter === k ? "#FFFFFF" : t.ink }}>{label}</T>
    </Pressable>
  );

  return (
    <>
      <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: ins.top + 18, paddingBottom: ins.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={ACCENT} />}>
        <T size={22} weight="medium">المشاريع</T>
        <View style={s.chips}>{chip("all", "الكل")}{chip("busy", "قيد العمل")}{chip("done", "المكتملة")}</View>

        {rows === null ? <ActivityIndicator color={ACCENT} style={{ marginTop: 30 }} /> : null}
        {rows && !list.length ? (
          <Card style={{ gap: 6 }}>
            <T size={14} weight="medium">{rows.length ? "لا توجد مشاريع هنا" : "لا توجد مشاريع بعد"}</T>
            <T muted size={12.5}>ابدأ مشروعًا من الموقع أو صوّر من الكاميرا، وسيظهر هنا.</T>
          </Card>
        ) : null}

        <View style={s.grid}>
          {list.map((r) => (
            <Pressable key={r.key} onPress={() => open(r)} style={({ pressed }) => [s.cell, pressed && { transform: [{ scale: 1.03 }] }]}>
              <View style={[s.cover, { backgroundColor: t.field }]}>
                {r.cover ? <Image source={{ uri: mediaUrl(r.cover), headers }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : (
                  <View style={s.noCover}><Icon name={r.state === "shoot" ? "lines" : "folder"} size={28} color={t.muted} /></View>
                )}
                {r.state === "done" ? <View style={s.play}><Icon name="play" size={18} /></View> : null}
                <View style={[s.badge, { backgroundColor: r.state === "done" ? t.okBg : r.state === "shoot" ? ACCENT : "rgba(12,12,14,.55)" }]}>
                  <T size={10.5} style={{ color: r.state === "done" ? t.okInk : "#FFFFFF" }}>{r.state === "done" ? "جاهز" : r.state === "busy" ? "جارٍ التصدير" : r.state === "shoot" ? "صوّر" : "قيد العمل"}</T>
                </View>
              </View>
              <T size={13} weight="medium" style={{ marginTop: 6 }}>{r.title}</T>
              <T muted size={11}>{[r.sub, ago(r.at)].filter(Boolean).join(" · ")}</T>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <VideoSheet video={video} onClose={() => setVideo(null)} />
    </>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 18, gap: 14 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { borderRadius: 99, paddingVertical: 7, paddingHorizontal: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
  cell: { width: "48%" },
  cover: { width: "100%", aspectRatio: 4 / 5, borderRadius: 20, overflow: "hidden" },
  noCover: { flex: 1, alignItems: "center", justifyContent: "center" },
  play: { position: "absolute", top: "50%", left: "50%", marginTop: -20, marginLeft: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 8, start: 8, borderRadius: 99, paddingVertical: 3, paddingHorizontal: 9 },
});
