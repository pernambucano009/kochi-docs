// 📱 «كمّل على موبايلك»: طلب جاي من الويب (من إشعار أو من QR). التصوير بيفتح التيلي برومبتر بالسكريبت،
// والتسجيل الصوتي بيتعمل هنا وبيرجع لنفس الخطوة على الويب
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, api, fileField } from "../../src/api";
import { Icon } from "../../src/icons";
import { shoot } from "../../src/shoot";
import { ACCENT, F } from "../../src/theme";
import { GlowButton, IconButton, SoftButton } from "../../src/ui";

type Handoff = { id: string; kind: "shoot" | "voice"; fid?: string | null; jid?: string | null; title: string; prompt: string; status: string };
type Step = "load" | "idle" | "rec" | "review" | "send" | "sent" | "gone";

const BARS = 20;
const mmss = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

// التصوير: نجيب سطور السكريبت من المشروع ونفتح التيلي برومبتر عليه
async function openShoot(h: Handoff) {
  if (h.jid) {
    const p = await api<{ jobs: { id: string; title?: string; script?: string[] }[] }>("/api/pilot");
    const j = p.jobs.find((x) => x.id === h.jid);
    if (!j?.script?.length) throw new Error("السكريبت لسه مش جاهز للفيديو ده");
    shoot.start({ kind: "pilot", id: j.id, title: j.title || h.title }, j.script);
  } else {
    const d = await api<{ scenario?: { title?: string; beats?: { say?: string; text?: string }[] }; idea?: { title?: string } }>(`/api/flows/${h.fid}`);
    const lines = (d.scenario?.beats || []).map((b) => b.say || b.text || "").filter(Boolean);
    if (!lines.length) throw new Error("المشروع ده لسه ما فيهوش سكريبت");
    shoot.start({ kind: "flow", id: String(h.fid), title: d.scenario?.title || d.idea?.title || h.title }, lines);
  }
  router.replace("/teleprompter");
}

export default function HandoffScreen() {
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [h, setH] = useState<Handoff | null>(null);
  const [step, setStep] = useState<Step>("load");
  const [msg, setMsg] = useState("");
  const rec = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const rs = useAudioRecorderState(rec, 250);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [uri, setUri] = useState<string | null>(null);
  const [dur, setDur] = useState(0);
  const src = useMemo(() => (uri ? { uri } : null), [uri]);
  const player = useAudioPlayer(src);

  useEffect(() => {
    let live = true;
    api<Handoff>(`/api/handoff/${id}`).then(async (x) => {
      if (!live) return;
      setH(x);
      if (x.status !== "waiting") { setStep("gone"); setMsg("الطلب ده خلص قبل كده."); return; }
      if (x.kind === "shoot") {
        try { await openShoot(x); } catch (e) { setStep("gone"); setMsg((e as Error).message); }
        return;
      }
      setStep("idle");
    }).catch((e) => {
      if (!live) return;
      if (e instanceof ApiError && e.status === 401) { router.replace("/welcome"); return; }
      setStep("gone"); setMsg((e as Error).message);
    });
    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    if (step !== "rec") return;
    const iv = setInterval(() => {
      const lv = Math.max(0, Math.min(1, ((rec.getStatus().metering ?? -60) + 60) / 60));
      setLevels((l) => [...l.slice(1), lv]);
    }, 90);
    return () => clearInterval(iv);
  }, [step, rec]);

  async function toggle() {
    if (step === "rec") {
      setDur(rs.durationMillis);
      await rec.stop();
      await setAudioModeAsync({ allowsRecording: false });
      setUri(rec.uri);
      setStep(rec.uri ? "review" : "idle");
      return;
    }
    const p = await requestRecordingPermissionsAsync();
    if (!p.granted) return Alert.alert("محتاجين المايك", "عشان تسجّل بصوتك.");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await rec.prepareToRecordAsync();
    setLevels(Array(BARS).fill(0));
    rec.record();
    setStep("rec");
  }

  async function send() {
    if (!uri || !h) return;
    setStep("send");
    try {
      const fd = new FormData();
      fd.append("file", fileField(uri, "voice.m4a", "audio/m4a"));
      await api(`/api/handoff/${h.id}/voice`, { method: "POST", body: fd });
      setStep("sent");
    } catch (e) {
      setStep("review");
      Alert.alert("ما اترفعش", (e as Error).message);
    }
  }

  const status = { idle: ["00:00", "اضغط وابدأ الكلام", "rgba(241,241,243,.6)"], rec: [mmss(rs.durationMillis), "بيسجّل…", ACCENT],
    review: [mmss(dur), "اسمعه قبل ما ترفعه", "rgba(241,241,243,.6)"], send: [mmss(dur), "بيرفع…", "rgba(241,241,243,.6)"],
    sent: [mmss(dur), "اترفع", "#5FD1A4"] } as Record<string, [string, string, string]>;
  const st = status[step];

  if (step === "load" || (h?.kind === "shoot" && step !== "gone")) {
    return <View style={[s.root, s.center]}><ActivityIndicator color={ACCENT} /><Text style={s.sub}>بيفتح الطلب…</Text></View>;
  }

  return (
    <View style={[s.root, { paddingTop: ins.top + 12, paddingBottom: ins.bottom + 24 }]}>
      <View style={s.top}>
        <IconButton label="رجوع" dim onPress={() => router.replace("/camera")}><Icon name="back" /></IconButton>
        <Text style={s.title}>{h?.kind === "voice" ? "التسجيل الصوتي" : "كمّل على موبايلك"}</Text>
      </View>

      {step === "gone" ? (
        <View style={[s.center, { flex: 1, gap: 16 }]}>
          <Text style={s.prompt}>{msg}</Text>
          <GlowButton title="ارجع للكاميرا" onPress={() => router.replace("/camera")} style={{ alignSelf: "stretch" }} />
        </View>
      ) : (
        <>
          <View style={s.chip}>
            <View style={s.dot} />
            <View style={{ flex: 1 }}>
              <Text style={s.chipSmall}>طلب من الويب · بيترفع على</Text>
              <Text style={s.chipTitle} numberOfLines={2}>{h?.title}</Text>
            </View>
          </View>
          {h?.prompt ? <Text style={s.prompt}>{h.prompt}</Text> : null}

          <View style={s.mid}>
            <View style={s.wave}>
              {levels.map((v, k) => <View key={k} style={[s.bar, { height: 10 + v * 56, opacity: step === "rec" ? 1 : 0.25 }]} />)}
            </View>
            <Text style={s.time}>{st[0]}</Text>
            <Text style={[s.sub, { color: st[2] }]}>{st[1]}</Text>
          </View>

          {step === "idle" || step === "rec" ? (
            <GlowButton onPress={toggle} style={s.mic} icon={step === "rec" ? <View style={s.stop} /> : <Icon name="mic" size={30} />} />
          ) : null}
          {step === "review" ? (
            <View style={s.acts}>
              <SoftButton title="اسمعه" icon={<Icon name="play" size={14} color="#F1F1F3" />} color="#F1F1F3" style={s.soft}
                onPress={() => { player.seekTo(0); player.play(); }} />
              <SoftButton title="سجّل تاني" color="#F1F1F3" style={s.soft} onPress={() => { setUri(null); setStep("idle"); }} />
              <GlowButton title="ارفعه على الويب" onPress={send} style={{ flex: 1 }} />
            </View>
          ) : null}
          {step === "send" ? <ActivityIndicator color={ACCENT} style={{ marginBottom: 20 }} /> : null}
          {step === "sent" ? (
            <View style={{ gap: 12 }}>
              <View style={s.ok}><Icon name="check" size={16} color="#5FD1A4" /><Text style={s.okText}>اترفع ✓ كمّل شغلك على الويب، التسجيل ظهر هناك</Text></View>
              <SoftButton title="ارجع للكاميرا" color="#F1F1F3" style={s.soft} onPress={() => router.replace("/camera")} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0C0C0E", paddingHorizontal: 20, gap: 16 },
  center: { alignItems: "center", justifyContent: "center", gap: 10 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: "#F1F1F3", fontFamily: F.medium, fontSize: 17 },
  chip: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,.06)", borderRadius: 18, padding: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  chipSmall: { color: "rgba(241,241,243,.6)", fontFamily: F.regular, fontSize: 11.5, textAlign: "right" },
  chipTitle: { color: "#F1F1F3", fontFamily: F.medium, fontSize: 14, textAlign: "right" },
  prompt: { color: "rgba(241,241,243,.8)", fontFamily: F.regular, fontSize: 14, lineHeight: 23, textAlign: "right", writingDirection: "rtl" },
  mid: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  wave: { flexDirection: "row", alignItems: "center", gap: 5, height: 70 },
  bar: { width: 5, borderRadius: 3, backgroundColor: ACCENT },
  time: { color: "#F1F1F3", fontFamily: F.latin, fontSize: 30 },
  sub: { color: "rgba(241,241,243,.6)", fontFamily: F.regular, fontSize: 13 },
  mic: { width: 92, height: 92, borderRadius: 46, alignSelf: "center", paddingHorizontal: 0, marginBottom: 12 },
  stop: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#FFFFFF" },
  acts: { flexDirection: "row", gap: 8, alignItems: "center" },
  soft: { backgroundColor: "rgba(255,255,255,.08)" },
  ok: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(95,209,164,.12)", borderRadius: 16, padding: 14 },
  okText: { color: "#5FD1A4", fontFamily: F.regular, fontSize: 13, flex: 1, textAlign: "right" },
});
