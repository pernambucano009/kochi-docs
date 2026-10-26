// الموافقات: كل خطوة الأوتوبايلوت واقف مستنيك فيها (فكرة، سكريبت، مونتاج، فيديو قبل النشر، تصوير)، توافق أو تتخطّى من هنا
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE, api, json, mediaHeaders, mediaUrl } from "../../src/api";
import { shoot } from "../../src/shoot";
import { ACCENT, useTheme } from "../../src/theme";
import { Card, GlowButton, SoftButton, T } from "../../src/ui";

type Opt = { id: string; title: string; text: string };
type Job = {
  id: string; kind: string; status: string; gate?: string | null; title?: string; name?: string; note?: string; error?: string | null;
  at?: string; updated_at?: string; options?: Opt[]; script?: string[]; video_url?: string | null; images?: string[];
};

const LABEL: Record<string, string> = { idea: "فكرة", script: "سكريبت", montage: "المونتاج", video: "فيديو قبل النشر" };

function when(at?: string) {
  if (!at) return "";
  const d = new Date(at), diff = (d.getTime() - Date.now()) / 60000;
  const time = d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
  if (diff > 0) return diff < 24 * 60 && d.getDate() === new Date().getDate() ? `يُنشر اليوم ${time}` : `يُنشر ${d.toLocaleDateString("ar-EG", { weekday: "long" })} ${time}`;
  if (-diff < 60) return `منذ ${Math.max(1, Math.round(-diff))} دقيقة`;
  if (-diff < 24 * 60) return `منذ ${Math.round(-diff / 60)} ساعة`;
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

function Video({ uri, headers }: { uri: string; headers: Record<string, string> }) {
  const src = useMemo(() => ({ uri, headers }), [uri, headers]);
  const player = useVideoPlayer(src, (p) => { p.loop = true; });
  return <VideoView player={player} style={s.video} contentFit="cover" nativeControls />;
}

export default function Approvals() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const { jid } = useLocalSearchParams<{ jid?: string }>();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setJobs((await api<{ jobs: Job[] }>("/api/pilot")).jobs || []); } catch { setJobs((x) => x || []); }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    const iv = setInterval(load, 10000);   // الأوتوبايلوت شغال في الخلفية: نحدّث كل ١٠ ثواني والتاب مفتوح
    return () => clearInterval(iv);
  }, [load]));
  useEffect(() => { mediaHeaders().then(setHeaders); }, []);

  async function act(j: Job, path: string, body?: unknown, done?: string) {
    setBusy(j.id);
    try {
      const r = await api<{ jobs: Job[] }>(`/api/pilot/jobs/${j.id}/${path}`, body ? json(body) : { method: "POST" });
      setJobs(r.jobs || []);
      if (done) Alert.alert("تم ✓", done);
    } catch (e) {
      Alert.alert("لم يكتمل", (e as Error).message);
    }
    setBusy("");
  }

  const skip = (j: Job) => Alert.alert("هل تتخطى هذا الموعد؟", "لن يُنشر فيديو في هذا الموعد، ويكمل الأوتوبايلوت في المواعيد التالية.", [
    { text: "رجوع", style: "cancel" },
    { text: "تخطَّ", style: "destructive", onPress: () => act(j, "stop") },
  ]);

  const film = (j: Job) => {
    shoot.start({ kind: "pilot", id: j.id, title: j.title || "فيديو الأوتوبايلوت" }, j.script || []);
    router.push("/teleprompter");
  };

  const all = jobs || [];
  const open = all.filter((j) => j.status === "wait" || j.status === "cam");
  const rest = all.filter((j) => !open.includes(j)).slice(0, 8);
  if (jid) open.sort((a, b) => (a.id === jid ? -1 : b.id === jid ? 1 : 0));

  function body(j: Job) {
    const isBusy = busy === j.id;
    if (j.status === "cam") {
      return (
        <>
          {(j.script || []).length ? <T size={13.5} style={{ lineHeight: 22 }}>{(j.script || []).join("\n")}</T> : null}
          <View style={s.acts}>
            <GlowButton title="صوّرها الآن" onPress={() => film(j)} style={{ flex: 1 }} />
            <SoftButton title="تخطَّ" onPress={() => skip(j)} />
          </View>
        </>
      );
    }
    if (j.gate === "idea" || j.gate === "script") {
      const pick = picks[j.id] || j.options?.[0]?.id || "";
      return (
        <>
          <T muted size={12}>{j.gate === "idea" ? "اختر الفكرة التي تعجبك" : "اختر السكريبت الذي يعجبك"}</T>
          {(j.options || []).map((o) => (
            <Pressable key={o.id} onPress={() => setPicks((p) => ({ ...p, [j.id]: o.id }))}
              style={[s.opt, { backgroundColor: t.field }, pick === o.id && { borderColor: ACCENT, backgroundColor: t.softAccent }]}>
              <T size={14} weight="medium">{o.title}</T>
              {o.text ? <T muted size={12.5} style={{ lineHeight: 20 }}>{o.text}</T> : null}
            </Pressable>
          ))}
          <View style={s.acts}>
            <GlowButton title={isBusy ? "…" : "موافق"} disabled={isBusy || !pick} onPress={() => act(j, "ok", { pick })} style={{ flex: 1 }} />
            <SoftButton title="تخطَّ" onPress={() => skip(j)} />
          </View>
        </>
      );
    }
    if (j.gate === "montage" || j.gate === "video") {
      const carousel = j.kind === "carousel";
      const okLabel = carousel ? (j.gate === "montage" ? "موافق، ارسم السلايدات" : "موافق، جدوِله") : j.gate === "montage" ? "موافق، صدّره" : "انشر في ميعاده";
      return (
        <>
          {j.video_url && headers.Authorization ? <Video uri={mediaUrl(j.video_url)} headers={headers} /> : null}
          {(j.images || []).length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(j.images || []).map((u) => <Image key={u} source={{ uri: mediaUrl(u), headers }} style={s.slide} contentFit="cover" />)}
            </ScrollView>
          ) : null}
          <View style={s.acts}>
            <GlowButton title={isBusy ? "…" : okLabel} disabled={isBusy} onPress={() => act(j, "ok", { pick: "" }, j.gate === "video" ? "جُدول الفيديو وسيُنشر في موعده." : undefined)} style={{ flex: 1 }} />
            {!carousel ? <SoftButton title="عدّل على الموقع" onPress={() => Linking.openURL(API_BASE + "/")} /> : null}
          </View>
          <SoftButton title="تخطَّ" onPress={() => skip(j)} style={{ alignSelf: "flex-start" }} />
        </>
      );
    }
    return null;
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: ins.top + 18, paddingBottom: ins.bottom + 110 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={ACCENT} />}>
      <View style={s.head}>
        <T size={22} weight="medium">الموافقات</T>
        <T muted size={12.5}>{open.length ? `${open.length} بانتظار ردك` : "لا شيء بانتظارك"}</T>
      </View>

      {jobs === null ? <ActivityIndicator color={ACCENT} style={{ marginTop: 30 }} /> : null}
      {jobs && !all.length ? (
        <Card style={{ gap: 6 }}>
          <T size={14} weight="medium">الأوتوبايلوت غير مفعّل بعد</T>
          <T muted size={12.5}>فعّله من الموقع، وأي خطوة تحتاج موافقتك سيصلك بها إشعار وتظهر هنا.</T>
        </Card>
      ) : null}

      {open.map((j) => (
        <Card key={j.id} style={[s.card, j.id === jid && { borderWidth: 2, borderColor: ACCENT }]}>
          <View style={s.cardTop}>
            <View style={[s.tag, { backgroundColor: t.softAccent }]}><T size={11.5} style={{ color: ACCENT }}>{j.status === "cam" ? "بانتظار تصويرك" : LABEL[j.gate || ""] || "خطوة"}</T></View>
            <T muted size={11.5}>{[when(j.at), j.name].filter(Boolean).join(" · ")}</T>
          </View>
          <T size={15.5} weight="medium">{j.title || j.name || "فيديو الأوتوبايلوت"}</T>
          {body(j)}
        </Card>
      ))}

      {rest.length ? <T weight="medium" size={14} style={{ marginTop: 8 }}>آخر الأعمال</T> : null}
      {rest.map((j) => (
        <Card key={j.id} style={{ gap: 6 }}>
          <View style={s.cardTop}>
            <T size={14} weight="medium" style={{ flex: 1 }}>{j.title || j.name || "فيديو"}</T>
            <View style={[s.tag, { backgroundColor: j.status === "done" ? t.okBg : t.field }]}>
              <T size={11} style={{ color: j.status === "done" ? t.okInk : t.muted }}>{j.status === "done" ? "جُدول ✓" : j.status === "failed" ? "توقف" : j.status === "stopped" ? "تُخطّي" : "قيد التنفيذ"}</T>
            </View>
          </View>
          <T muted size={12}>{[when(j.at), j.status === "run" ? j.note : "", j.status === "failed" ? j.error : ""].filter(Boolean).join(" · ")}</T>
          {j.status === "failed" ? <SoftButton title={busy === j.id ? "…" : "حاول مرة أخرى"} onPress={() => act(j, "retry")} style={{ alignSelf: "flex-start" }} /> : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 18, gap: 14 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  card: { gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tag: { borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10 },
  opt: { borderRadius: 16, padding: 12, gap: 4, borderWidth: 2, borderColor: "transparent" },
  acts: { flexDirection: "row", gap: 10, alignItems: "center" },
  video: { width: "100%", aspectRatio: 9 / 16, maxHeight: 460, borderRadius: 18, backgroundColor: "#000" },
  slide: { width: 150, height: 188, borderRadius: 14 },
});
