// الأفكار: أكبر زرار بالبرتقالي «سجّل فكرة بصوتك»، والكلام بيتكتب لوحده، وبعدين تختار «نسّقها» أو «خليها زي ما هي».
// نفس مجلد الأفكار اللي على الويب، فأي فكرة هنا بتظهر هناك والعكس.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, fileField, json } from "../../src/api";
import { Icon, type IconName } from "../../src/icons";
import { ACCENT, F, useTheme } from "../../src/theme";
import { Card, GlowButton, SoftButton, T } from "../../src/ui";

type Idea = { id: string; title: string; text: string; hook: string; url: string; audio_url: string | null; status: string; error: string | null; polished: boolean; at: string };
type Step = "idle" | "rec" | "write" | "wait" | "review";

const BARS = 18;
const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

function when(at: string) {
  const d = (Date.now() - new Date(at).getTime()) / 86400000;
  if (!(d >= 0)) return "";
  if (d < 1 / 24) return "دلوقتي";
  if (d < 1) return "النهارده";
  if (d < 2) return "امبارح";
  if (d < 7) return `من ${Math.floor(d)} أيام`;
  if (d < 14) return "الأسبوع اللي فات";
  return new Date(at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

const kindOf = (x: Idea): [IconName, string] => (x.audio_url ? ["mic", "صوت"] : x.url ? ["link", "رابط"] : ["edit", "كتابة"]);

export default function Ideas() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const rec = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rs = useAudioRecorderState(rec, 250);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [step, setStep] = useState<Step>("idle");
  const [cur, setCur] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const pulse = useState(() => new Animated.Value(0))[0];

  const load = useCallback(async () => {
    setLoading(true);
    try { setIdeas(await api<Idea[]>("/api/my-ideas")); } catch { /* الشبكة: الليستة تفضل زي ما هي */ }
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // الموجة بتتحرك على قد صوتك (metering بالـ dB من -60 لـ 0)
  useEffect(() => {
    if (step !== "rec") return;
    const iv = setInterval(() => {
      const lv = Math.max(0, Math.min(1, ((rec.getStatus().metering ?? -60) + 60) / 60));
      setLevels((l) => [...l.slice(1), lv]);
    }, 90);
    return () => clearInterval(iv);
  }, [step, rec]);

  useEffect(() => {
    if (step !== "idle") return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [step, pulse]);

  // الفويس نوت بيتكتب في الخلفية على السيرفر: نسأل كل ثانيتين لحد ما يخلص
  useEffect(() => {
    if (step !== "wait" || !cur) return;
    const iv = setInterval(async () => {
      const list = await api<Idea[]>("/api/my-ideas").catch(() => null);
      const x = list?.find((y) => y.id === cur);
      if (!list || !x || x.status === "transcribing") return;
      setIdeas(list);
      setDraft(x.text);
      setStep("review");
    }, 2000);
    return () => clearInterval(iv);
  }, [step, cur]);

  const idea = ideas.find((x) => x.id === cur) || null;

  async function startRec() {
    const p = await requestRecordingPermissionsAsync();
    if (!p.granted) return Alert.alert("محتاجين المايك", "عشان تسجّل فكرتك بصوتك.");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await rec.prepareToRecordAsync();
    setLevels(Array(BARS).fill(0));
    rec.record();
    setStep("rec");
  }

  async function stopRec() {
    await rec.stop();
    await setAudioModeAsync({ allowsRecording: false });
    if (!rec.uri) { setStep("idle"); return; }
    await send({ file: rec.uri });
  }

  async function send(what: { file?: string; text?: string }) {
    setStep("wait");
    try {
      const fd = new FormData();
      if (what.file) fd.append("file", fileField(what.file, "idea.m4a", "audio/m4a"));
      if (what.text) fd.append("text", what.text);
      const list = await api<Idea[]>("/api/my-ideas", { method: "POST", body: fd });
      setIdeas(list);
      setCur(list[0]?.id || null);
      if (what.text) { setDraft(list[0]?.text || what.text); setStep("review"); }
    } catch (e) {
      setStep("idle");
      Alert.alert("ما اتحفظتش", (e as Error).message);
    }
  }

  async function act(label: string, fn: () => Promise<Idea[]>, after?: Step) {
    setBusy(label);
    try {
      const list = await fn();
      setIdeas(list);
      const x = list.find((y) => y.id === cur);
      if (x) setDraft(x.text);
      if (after) setStep(after);
    } catch (e) {
      Alert.alert("ما كملش", (e as Error).message);
    }
    setBusy("");
  }

  // «خليها زي ما هي» / «احفظها»: لو عدّلت في النص بيتحفظ تعديلك
  const keep = () => act("save", () => (idea && draft.trim() !== idea.text
    ? api<Idea[]>(`/api/my-ideas/${cur}`, { ...json({ text: draft.trim() }), method: "PATCH" })
    : api<Idea[]>("/api/my-ideas")), "idle");
  const polish = () => act("polish", async () => {
    if (idea && draft.trim() !== idea.text) await api(`/api/my-ideas/${cur}`, { ...json({ text: draft.trim() }), method: "PATCH" });
    return api<Idea[]>(`/api/my-ideas/${cur}/polish`, { method: "POST" });
  });
  const revert = () => act("revert", () => api<Idea[]>(`/api/my-ideas/${cur}/revert`, { method: "POST" }));
  const open = (x: Idea) => { setCur(x.id); setDraft(x.text); setStep(x.status === "transcribing" ? "wait" : "review"); };

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] });

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[s.page, { paddingTop: ins.top + 18, paddingBottom: ins.bottom + 110 }]}
      keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={ACCENT} />}>
      <T size={22} weight="medium">الأفكار</T>

      {step === "idle" ? (
        <>
          <Animated.View style={{ transform: [{ scale: glowScale }] }}>
            <GlowButton title="سجّل فكرة بصوتك" icon={<Icon name="mic" size={24} />} onPress={startRec} style={s.big} textStyle={{ fontSize: 17 }} />
          </Animated.View>
          <SoftButton title="أو اكتبها" icon={<Icon name="edit" size={16} color={t.ink} />} onPress={() => { setDraft(""); setStep("write"); }} />
        </>
      ) : null}

      {step === "rec" ? (
        <GlowButton onPress={stopRec} style={s.big} icon={
          <View style={s.recRow}>
            <View style={s.wave}>
              {levels.map((v, k) => <View key={k} style={[s.bar, { height: 8 + v * 34 }]} />)}
            </View>
            <Text style={s.recText}><Text style={{ fontFamily: F.latin }}>{mmss(rs.durationMillis)}</Text> · اضغط لما تخلص</Text>
          </View>
        } />
      ) : null}

      {step === "write" ? (
        <Card style={{ gap: 10 }}>
          <T muted size={12.5}>اكتب فكرتك زي ما هي في دماغك</T>
          <TextInput value={draft} onChangeText={setDraft} multiline autoFocus placeholder="مثلًا: فيديو عن ٣ غلطات الناس بتعملها…" placeholderTextColor={t.muted}
            style={[s.input, { backgroundColor: t.field, color: t.ink }]} textAlignVertical="top" />
          <View style={s.row}>
            <GlowButton title="احفظها" disabled={!draft.trim()} onPress={() => send({ text: draft.trim() })} style={{ flex: 1 }} />
            <SoftButton title="رجوع" onPress={() => setStep("idle")} />
          </View>
        </Card>
      ) : null}

      {step === "wait" ? (
        <Card style={s.waitCard}>
          <ActivityIndicator color={ACCENT} />
          <T size={13.5}>بيكتب كلامك…</T>
        </Card>
      ) : null}

      {step === "review" && idea ? (
        <Card style={{ gap: 10 }}>
          <T muted size={12.5}>{idea.polished ? "بعد التنسيق" : idea.audio_url ? "اتكتب من صوتك (تقدر تعدّل فيه)" : "فكرتك (تقدر تعدّل فيها)"}</T>
          {idea.error ? <T size={12.5} style={{ color: "#D44E2C" }}>{idea.error}</T> : null}
          {idea.polished ? (
            <View style={[s.polished, { backgroundColor: t.softAccent }]}>
              <T weight="medium" size={15}>{idea.title}</T>
              <T size={14}>{idea.text}</T>
              {idea.hook ? <T muted size={13}>الهوك: «{idea.hook}»</T> : null}
            </View>
          ) : (
            <TextInput value={draft} onChangeText={setDraft} multiline style={[s.input, { backgroundColor: t.field, color: t.ink }]} textAlignVertical="top" />
          )}
          <View style={s.row}>
            {idea.polished ? (
              <>
                <GlowButton title="احفظها" onPress={() => setStep("idle")} style={{ flex: 1 }} />
                <SoftButton title={busy === "revert" ? "…" : "رجّعها زي ما قلتها"} onPress={revert} />
              </>
            ) : (
              <>
                <GlowButton title={busy === "polish" ? "بينسّق…" : "نسّقها"} icon={busy ? null : <Icon name="sparkle" size={16} />} disabled={!!busy || !draft.trim()} onPress={polish} style={{ flex: 1 }} />
                <SoftButton title={busy === "save" ? "…" : "خليها زي ما هي"} onPress={keep} />
              </>
            )}
          </View>
        </Card>
      ) : null}

      <View style={s.head}>
        <T weight="medium" size={15}>أفكارك</T>
        <T muted size={12}>{ideas.length} فكرة · بتظهر في الويب كمان</T>
      </View>
      {ideas.map((x) => {
        const [ic, kind] = kindOf(x);
        return (
          <Pressable key={x.id} onPress={() => open(x)} style={({ pressed }) => [s.item, { backgroundColor: t.card, shadowColor: t.shadow }, pressed && { transform: [{ scale: 1.02 }] }]}>
            <View style={[s.itemIcon, { backgroundColor: t.softAccent }]}><Icon name={ic} size={17} color={ACCENT} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={14} weight="medium">{x.status === "transcribing" ? "بيكتب الفويس نوت…" : x.title || "فكرة"}</T>
              <T muted size={11.5}>{[when(x.at), kind, x.polished ? "متنسّقة" : ""].filter(Boolean).join(" · ")}</T>
            </View>
          </Pressable>
        );
      })}
      {!ideas.length && !loading ? <T muted size={13} style={{ textAlign: "center", marginTop: 10 }}>لسه مفيش أفكار. سجّل أول فكرة بصوتك.</T> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 18, gap: 14 },
  big: { height: 92, borderRadius: 30 },
  recRow: { alignItems: "center", gap: 6 },
  wave: { flexDirection: "row", alignItems: "center", gap: 4, height: 44 },
  bar: { width: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,.92)" },
  recText: { color: "#FFFFFF", fontFamily: F.regular, fontSize: 12.5 },
  input: { minHeight: 120, borderRadius: 16, padding: 14, fontFamily: F.regular, fontSize: 15, lineHeight: 24, textAlign: "right", writingDirection: "rtl" },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  waitCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 22 },
  polished: { borderRadius: 16, padding: 14, gap: 6 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, padding: 14, shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  itemIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
