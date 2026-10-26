// الرئيسية = الكاميرا (زي سناب شات): صورة / فيديو / تيلي برومتر، وفوق شريحة بالفيديوهات اللي مستنية تصويرك
import { useCallback, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, deleteAccount, logout } from "../../src/api";
import { Icon, type IconName } from "../../src/icons";
import { unregisterPush } from "../../src/push";
import { shoot, toShoot, uploadShots, type Todo } from "../../src/shoot";
import { ACCENT, F } from "../../src/theme";
import { GlowButton, T } from "../../src/ui";

type Mode = "photo" | "video" | "tp";
const MODES: [Mode, string][] = [["photo", "صورة"], ["video", "فيديو"], ["tp", "تيلي برومتر"]];
const TIMERS = [0, 3, 10];
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Round({ icon, label, onPress, on, size = 40 }: { icon: IconName; label: string; onPress: () => void; on?: boolean; size?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [s.round, { width: size, height: size, borderRadius: size / 2 }, on && s.roundOn, pressed && { transform: [{ scale: 1.08 }] }]}>
      <Icon name={icon} />
    </Pressable>
  );
}

export default function Camera() {
  const ins = useSafeAreaInsets();
  const cam = useRef<CameraView>(null);
  const [perm, askPerm] = useCameraPermissions();
  const [mic, askMic] = useMicrophonePermissions();
  const [mode, setMode] = useState<Mode>("video");
  const [facing, setFacing] = useState<CameraType>("back");
  const [torch, setTorch] = useState(false);
  const [timer, setTimer] = useState(0);
  const [count, setCount] = useState(0);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [sheet, setSheet] = useState<null | "shoot" | "upload">(null);
  const [busy, setBusy] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  // كل ما ترجع للكاميرا: نجيب اللي مستني تصويرك وعدد الموافقات
  useFocusEffect(useCallback(() => {
    toShoot().then(setTodos).catch(() => setTodos([]));
    api<{ waiting?: number }>("/api/pilot").then((p) => setWaiting(p.waiting || 0)).catch(() => setWaiting(0));
  }, []));

  if (!perm || !mic) return <View style={s.root} />;
  if (!perm.granted || !mic.granted) {
    return (
      <View style={[s.root, s.ask]}>
        <T size={17} weight="medium" style={s.center}>سمسمكيت محتاج الكاميرا والمايك</T>
        <T muted size={13} style={s.center}>عشان تصوّر نفسك بالسكريبت والفيديو يترفع لمشروعك على طول.</T>
        <GlowButton title="اسمح بالكاميرا والمايك" onPress={async () => { await askPerm(); await askMic(); }} style={{ marginTop: 14, alignSelf: "stretch" }} />
      </View>
    );
  }

  const countdown = (n: number) => new Promise<void>((done) => {
    if (!n) return done();
    let left = n;
    setCount(left);
    const t = setInterval(() => {
      left -= 1;
      setCount(left);
      if (left <= 0) { clearInterval(t); done(); }
    }, 1000);
  });

  async function save(uri: string, what: string) {
    const p = await MediaLibrary.requestPermissionsAsync(true);
    if (!p.granted) return Alert.alert("محتاجين إذن الاستوديو", `عشان نحفظ ${what} على موبايلك.`);
    await MediaLibrary.saveToLibraryAsync(uri);
    Alert.alert("اتحفظ ✓", `${what} اتحفظ في الاستوديو بتاعك.`);
  }

  async function shutter() {
    if (!cam.current) return;
    if (mode === "tp") return router.push("/teleprompter");
    if (mode === "photo") {
      await countdown(timer);
      const p = await cam.current.takePictureAsync({ quality: 0.92 });
      if (p?.uri) await save(p.uri, "الصورة");
      return;
    }
    if (rec) { cam.current.stopRecording(); return; }
    await countdown(timer);
    setRec(true); setSecs(0);
    tick.current = setInterval(() => setSecs((x) => x + 1), 1000);
    try {
      const v = await cam.current.recordAsync({ maxDuration: 180 });
      if (v?.uri) await save(v.uri, "الفيديو");
    } catch (e) {
      Alert.alert("التسجيل وقف", (e as Error).message);
    } finally {
      if (tick.current) clearInterval(tick.current);
      setRec(false);
    }
  }

  function pickMode(m: Mode) {
    if (m === "tp") return router.push("/teleprompter");
    setMode(m);
  }

  function startShoot(t: Todo) {
    setSheet(null);
    shoot.start({ kind: t.kind, id: t.id, title: t.title }, t.lines);
    router.push("/teleprompter");
  }

  // فيديو متصوّر قبل كده: يترفع للمشروع اللي تختاره
  async function uploadFrom(t: Todo) {
    setSheet(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 1 });
    if (r.canceled || !r.assets?.[0]) return;
    setBusy(true);
    try {
      await uploadShots({ target: t, shots: [{ name: "", line: "", uri: r.assets[0].uri, secs: 0, takes: 1 }] });
      setTodos((x) => x.filter((y) => y.id !== t.id));
      Alert.alert("وصل ✓", "الفيديو اترفع للمشروع، والمراجعة والمونتاج بيكمّلوا لوحدهم.");
    } catch (e) {
      Alert.alert("الرفع ما كملش", (e as Error).message);
    }
    setBusy(false);
  }

  function account() {
    Alert.alert("حسابي", "هو نفسه حسابك على simsimkit.com", [
      { text: "رجوع", style: "cancel" },
      { text: "تسجيل الخروج", onPress: async () => { await unregisterPush(); await logout(); router.replace("/welcome"); } },
      { text: "حذف الحساب", style: "destructive", onPress: confirmDelete },
    ]);
  }
  // 🗑️ حذف الحساب نهائيًا (Apple بتطلبه في أي تطبيق بيعمل حسابات): تأكيد صريح الأول
  function confirmDelete() {
    Alert.alert("حذف الحساب نهائيًا؟", "سيُحذف حسابك وكل مشاريعك وفيديوهاتك وأفكارك من التطبيق والموقع، ويُلغى اشتراكك إن وُجد. لا يمكن التراجع عن ذلك.", [
      { text: "رجوع", style: "cancel" },
      { text: "احذف حسابي", style: "destructive", onPress: async () => {
        try { await unregisterPush(); await deleteAccount(); router.replace("/welcome"); Alert.alert("حُذف حسابك", "شكرًا لأنك جرّبت SimsimKit."); }
        catch (e) { Alert.alert("تعذّر حذف الحساب", (e as Error).message); }
      } },
    ]);
  }

  const chip = todos.length ? `${todos[0].title} · ${todos.length === 1 ? "مستني تصويرك" : `${todos.length} فيديو مستنيين تصويرك`}` : "";

  return (
    <View style={s.root}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} mode={mode === "photo" ? "picture" : "video"} enableTorch={torch} mirror={facing === "front"} />
      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,.45)", "rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,.65)"]} locations={[0, 0.22, 0.62, 1]} style={StyleSheet.absoluteFill} />

      <View style={[s.top, { top: ins.top + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="حسابي" onPress={account} style={[s.round, s.ring]}><Icon name="user" /></Pressable>
        <View style={s.grow}>
          {chip ? (
            <Pressable accessibilityRole="button" onPress={() => setSheet("shoot")} style={s.chip}>
              <View style={s.dot} /><Text numberOfLines={1} style={s.chipText}>{chip}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="الموافقات" onPress={() => router.navigate("/approvals")} style={s.round}>
          <Icon name="bell" />
          {waiting ? <View style={s.badge}><Text style={s.badgeText}>{waiting}</Text></View> : null}
        </Pressable>
      </View>

      <View style={[s.tools, { top: ins.top + 72 }]}>
        <Round icon="flip" label="قلب الكاميرا" onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))} />
        <Round icon="flash" label="الفلاش" on={torch} onPress={() => setTorch((x) => !x)} />
        <Round icon="lines" label="التيلي برومتر" on onPress={() => router.push("/teleprompter")} />
        <Pressable accessibilityRole="button" accessibilityLabel="المؤقت" onPress={() => setTimer((t) => TIMERS[(TIMERS.indexOf(t) + 1) % TIMERS.length])} style={[s.round, timer > 0 && s.roundOn]}>
          {timer ? <Text style={s.timerText}>{timer}s</Text> : <Icon name="timer" />}
        </Pressable>
      </View>

      {count > 0 ? <Text style={s.count}>{count}</Text> : null}
      {rec ? <View style={[s.recPill, { bottom: ins.bottom + 200 }]}><Text style={s.recText}>{mmss(secs)}</Text></View> : null}

      {!rec ? (
        <View style={[s.modes, { bottom: ins.bottom + 172 }]}>
          {MODES.map(([k, label]) => (
            <Pressable key={k} onPress={() => pickMode(k)} style={s.mode} accessibilityRole="button" accessibilityState={{ selected: mode === k }}>
              <Text style={[s.modeText, mode === k && s.modeOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[s.bottom, { bottom: ins.bottom + 92 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="ارفع من الاستوديو" disabled={busy}
          onPress={() => (todos.length ? setSheet("upload") : Alert.alert("مفيش مشروع مستني فيديو", "ابدأ مشروع «تصوير بالجوال» من الموقع أو شغّل الأوتوبايلوت، وهيظهر هنا."))}
          style={s.gallery}><Icon name="gallery" size={20} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={rec ? "إيقاف التسجيل" : "ابدأ التسجيل"} onPress={shutter} style={({ pressed }) => [s.shutterRing, pressed && { transform: [{ scale: 1.06 }] }]}>
          <LinearGradient colors={["#F48A62", "#E5613E", "#D44E2C"]} locations={[0, 0.55, 1]} style={s.shutter}>
            {rec ? <View style={s.stop} /> : null}
          </LinearGradient>
        </Pressable>
        <Round icon="folder" label="مشاريعي" size={44} onPress={() => router.navigate("/projects")} />
      </View>

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={s.scrim} onPress={() => setSheet(null)} />
        <View style={[s.sheet, { paddingBottom: ins.bottom + 16 }]}>
          <T size={16} weight="medium" style={{ color: "#F1F1F3" }}>{sheet === "upload" ? "ترفع الفيديو لأنهي مشروع؟" : "مستنيين تصويرك"}</T>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10, paddingTop: 12 }}>
            {todos.map((t) => (
              <Pressable key={t.kind + t.id} onPress={() => (sheet === "upload" ? uploadFrom(t) : startShoot(t))} style={({ pressed }) => [s.todo, pressed && { transform: [{ scale: 1.02 }] }]}>
                <Text style={s.todoTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={s.todoSub}>{t.lines.length} لقطة · {t.kind === "pilot" ? "من الأوتوبايلوت" : "تصوير بالجوال"}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const glass = "rgba(20,20,22,.35)";
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0C0C0E" },
  ask: { justifyContent: "center", paddingHorizontal: 28, gap: 8 },
  center: { textAlign: "center", color: "#F1F1F3" },
  top: { position: "absolute", start: 16, end: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  grow: { flex: 1, alignItems: "center" },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: glass, alignItems: "center", justifyContent: "center" },
  ring: { borderWidth: 1.5, borderColor: "rgba(255,255,255,.85)" },
  roundOn: { backgroundColor: "rgba(229,97,62,.9)", shadowColor: "#F0754F", shadowOpacity: 0.55, shadowRadius: 16, elevation: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: glass, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 14, maxWidth: "100%" },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT, shadowColor: "#F0754F", shadowOpacity: 1, shadowRadius: 10 },
  chipText: { color: "#FFFFFF", fontFamily: F.regular, fontSize: 11.5, flexShrink: 1 },
  badge: { position: "absolute", top: -2, end: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#FFFFFF", fontFamily: F.latin, fontSize: 10 },
  tools: { position: "absolute", end: 14, gap: 12 },
  timerText: { color: "#FFFFFF", fontFamily: F.latinMedium, fontSize: 12 },
  count: { position: "absolute", alignSelf: "center", top: "38%", color: "#FFFFFF", fontFamily: F.latinMedium, fontSize: 96, textShadowColor: "rgba(240,117,79,.9)", textShadowRadius: 24 },
  recPill: { position: "absolute", alignSelf: "center", backgroundColor: ACCENT, borderRadius: 99, paddingVertical: 5, paddingHorizontal: 12 },
  recText: { color: "#FFFFFF", fontFamily: F.latin, fontSize: 11 },
  modes: { position: "absolute", start: 0, end: 0, flexDirection: "row", justifyContent: "center", gap: 22 },
  mode: { minHeight: 44, justifyContent: "center", paddingHorizontal: 2 },
  modeText: { color: "rgba(255,255,255,.65)", fontFamily: F.regular, fontSize: 12.5 },
  modeOn: { color: "#FFFFFF", fontFamily: F.medium, textShadowColor: "rgba(240,117,79,.9)", textShadowRadius: 12 },
  bottom: { position: "absolute", start: 0, end: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 46 },
  gallery: { width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "#2A2A30", alignItems: "center", justifyContent: "center" },
  shutterRing: { width: 94, height: 94, borderRadius: 47, borderWidth: 4, borderColor: "rgba(255,255,255,.9)", alignItems: "center", justifyContent: "center" },
  shutter: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center", shadowColor: "#F0754F", shadowOpacity: 0.65, shadowRadius: 22, elevation: 10 },
  stop: { width: 26, height: 26, borderRadius: 7, backgroundColor: "#FFFFFF" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,.45)" },
  sheet: { backgroundColor: "#17171A", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  todo: { backgroundColor: "rgba(255,255,255,.06)", borderRadius: 18, padding: 14, gap: 4 },
  todoTitle: { color: "#F1F1F3", fontFamily: F.medium, fontSize: 14, textAlign: "right" },
  todoSub: { color: "rgba(241,241,243,.6)", fontFamily: F.regular, fontSize: 12, textAlign: "right" },
});
