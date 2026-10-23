// التيلي برومتر: الكاميرا الأمامية والنص بيطلع لوحده وانت بتتكلم. كل جملة لقطة لوحدها، فلو غلطت بتعيد اللقطة دي بس
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../src/icons";
import { shoot, splitScript, useShoot } from "../src/shoot";
import { ACCENT, F } from "../src/theme";
import { GlowButton } from "../src/ui";

const BOX = 230;            // ارتفاع شباك النص
const WPS = 2.4;            // كلمة في الثانية على السرعة 1x (كلام عادي)
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Teleprompter() {
  const ins = useSafeAreaInsets();
  const sess = useShoot();
  const params = useLocalSearchParams<{ i?: string }>();
  const cam = useRef<CameraView>(null);
  const [perm, askPerm] = useCameraPermissions();
  const [mic, askMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [size, setSize] = useState(24);
  const [speed, setSpeed] = useState(1);
  const [count, setCount] = useState(0);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [draft, setDraft] = useState("");
  const [textH, setTextH] = useState(0);
  const y = useState(() => new Animated.Value(0))[0];
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const started = useRef(0);

  const shots = sess?.shots || [];
  const first = shots.findIndex((x) => !x.uri);
  const i = Math.min(Math.max(0, params.i != null ? Number(params.i) : first < 0 ? 0 : first), Math.max(0, shots.length - 1));
  const shot = shots[i];
  const words = shot ? shot.line.split(/\s+/).length : 0;

  // النص بيرجع لأوله مع كل لقطة جديدة
  useEffect(() => { anim.current?.stop(); y.setValue(0); }, [i, sess?.target.id, y]);

  // يطلع النص من مكانه الحالي للآخر، بالسرعة الحالية (فلو غيّرت السرعة وانت بتسجل بيكمّل من نفس المكان)
  function scroll() {
    const end = -Math.max(0, textH - BOX * 0.45);
    y.stopAnimation((from) => {
      const total = Math.max(3, words / (WPS * speed));
      const left = end === 0 ? 0 : total * Math.max(0, (from - end) / -end);
      anim.current = Animated.timing(y, { toValue: end, duration: left * 1000, easing: Easing.linear, useNativeDriver: true });
      anim.current.start();
    });
  }
  useEffect(() => { if (rec) scroll(); }, [speed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs(Math.round((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [rec]);

  if (!perm || !mic) return <View style={s.root} />;
  if (!perm.granted || !mic.granted) {
    return (
      <View style={[s.root, s.pad]}>
        <Text style={s.title}>محتاجين الكاميرا والمايك عشان تصوّر</Text>
        <GlowButton title="اسمح" onPress={async () => { await askPerm(); await askMic(); }} style={{ marginTop: 14 }} />
      </View>
    );
  }

  // مفيش مشروع: تكتب النص بنفسك (أو تلزقه) وكل جملة بتبقى لقطة
  if (!sess) {
    return (
      <View style={[s.root, s.pad, { paddingTop: ins.top + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={() => router.back()} style={s.round}><Icon name="close" width={1.8} /></Pressable>
        <Text style={[s.title, { marginTop: 18 }]}>اكتب النص اللي هتقوله</Text>
        <Text style={s.hint}>كل سطر أو جملة هتبقى لقطة لوحدها، فلو غلطت في جملة تعيدها هي بس.</Text>
        <TextInput value={draft} onChangeText={setDraft} multiline placeholder="مثلًا: القهوة دي غيّرت صباحي في أسبوع واحد…" placeholderTextColor="rgba(255,255,255,.35)" style={s.input} textAlignVertical="top" />
        <GlowButton title="ابدأ التصوير" disabled={!draft.trim()} onPress={() => shoot.start({ kind: "free", id: "free", title: "تصوير حر" }, splitScript(draft))} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const countdown = () => new Promise<void>((done) => {
    let left = 3;
    setCount(left);
    const t = setInterval(() => {
      left -= 1;
      setCount(left);
      if (left <= 0) { clearInterval(t); done(); }
    }, 1000);
  });

  async function toggle() {
    if (!cam.current || count) return;
    if (rec) { cam.current.stopRecording(); return; }
    y.setValue(0);
    await countdown();
    setRec(true); setSecs(0); started.current = Date.now();
    scroll();
    try {
      const v = await cam.current.recordAsync({ maxDuration: 120 });
      anim.current?.stop();
      setRec(false);
      if (v?.uri) {
        shoot.setTake(i, v.uri, Math.max(1, Math.round((Date.now() - started.current) / 1000)));
        router.replace({ pathname: "/shots", params: { i: String(i) } });
      }
    } catch (e) {
      anim.current?.stop();
      setRec(false);
      Alert.alert("التسجيل وقف", (e as Error).message);
    }
  }

  const done = shots.filter((x) => x.uri).length;

  return (
    <View style={s.root}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} mode="video" mirror={facing === "front"} />
      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,.6)", "rgba(0,0,0,.15)", "rgba(0,0,0,.1)", "rgba(0,0,0,.7)"]} locations={[0, 0.4, 0.6, 1]} style={StyleSheet.absoluteFill} />

      <View style={[s.top, { top: ins.top + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع" disabled={rec} onPress={() => router.back()} style={s.round}><Icon name="close" width={1.8} /></Pressable>
        <View style={s.pill}>
          <View style={[s.recDot, { backgroundColor: rec ? ACCENT : "rgba(255,255,255,.6)" }]} />
          <Text style={s.lat}>{rec ? mmss(secs) : "3 · 2 · 1"}</Text>
        </View>
        <Text style={s.shotLabel}>لقطة {i + 1} من {shots.length} · {shot?.name}</Text>
      </View>

      {/* شباك النص: أول سطرين واضحين والباقي بيختفي تحت عشان عينك تفضل قريبة من العدسة */}
      <View style={[s.box, { top: ins.top + 66 }]}>
        <Animated.View style={{ transform: [{ translateY: y }] }} onLayout={(e) => setTextH(e.nativeEvent.layout.height)}>
          <Text style={[s.script, { fontSize: size, lineHeight: size * 1.6 }]}>{shot?.line}</Text>
        </Animated.View>
        <LinearGradient pointerEvents="none" colors={["rgba(12,12,14,0)", "rgba(12,12,14,.85)"]} style={s.fade} />
      </View>
      <Text style={[s.hint, { position: "absolute", top: ins.top + 66 + BOX + 10, start: 20, end: 20 }]}>النص فيه الكلام المنطوق بس، من غير وقفات أو تعليمات</Text>

      {count > 0 ? <Text style={s.count}>{count}</Text> : null}

      <View style={[s.ctrls, { bottom: ins.bottom + 150 }]}>
        <View style={s.ctrl}>
          <Pressable accessibilityRole="button" accessibilityLabel="تصغير الخط" onPress={() => setSize((x) => Math.max(16, x - 2))} style={s.small}><Text style={s.lat}>A-</Text></Pressable>
          <Text style={s.lat}>{size} px</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="تكبير الخط" onPress={() => setSize((x) => Math.min(40, x + 2))} style={s.small}><Text style={s.lat}>A+</Text></Pressable>
        </View>
        <View style={s.ctrl}>
          <Pressable accessibilityRole="button" accessibilityLabel="أبطأ" onPress={() => setSpeed((x) => Math.max(0.5, +(x - 0.25).toFixed(2)))} style={s.small}><Text style={s.lat}>−</Text></Pressable>
          <Text style={s.ctrlText}>السرعة <Text style={s.lat}>{speed}x</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel="أسرع" onPress={() => setSpeed((x) => Math.min(2, +(x + 0.25).toFixed(2)))} style={s.small}><Text style={s.lat}>+</Text></Pressable>
        </View>
      </View>

      <View style={[s.bottom, { bottom: ins.bottom + 36 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="اللقطات" disabled={rec || !done} onPress={() => router.replace({ pathname: "/shots", params: { i: String(i) } })} style={[s.takes, !done && { opacity: 0.5 }]}>
          <Text style={s.takesText}>{done} من {shots.length}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={rec ? "إيقاف التسجيل" : "ابدأ التسجيل"} onPress={toggle} style={({ pressed }) => [s.shutterRing, pressed && { transform: [{ scale: 1.06 }] }]}>
          <LinearGradient colors={["#F48A62", "#E5613E", "#D44E2C"]} locations={[0, 0.55, 1]} style={s.shutter}>
            {rec ? <View style={s.stop} /> : null}
          </LinearGradient>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="تبديل الكاميرا" disabled={rec} onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))} style={[s.round, { width: 48, height: 48, borderRadius: 24 }]}>
          <Icon name="swap" size={22} />
        </Pressable>
      </View>

    </View>
  );
}

const glass = "rgba(20,20,22,.45)";
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0C0C0E" },
  pad: { paddingHorizontal: 22, justifyContent: "center" },
  title: { color: "#F1F1F3", fontFamily: F.medium, fontSize: 17, textAlign: "right" },
  hint: { color: "rgba(255,255,255,.6)", fontFamily: F.regular, fontSize: 11.5, textAlign: "center", marginTop: 6 },
  input: { marginTop: 14, minHeight: 220, borderRadius: 20, backgroundColor: "rgba(255,255,255,.06)", color: "#FFFFFF", fontFamily: F.regular, fontSize: 16, lineHeight: 26, padding: 16, textAlign: "right", writingDirection: "rtl" },
  top: { position: "absolute", start: 16, end: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: glass, alignItems: "center", justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: glass, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 12 },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  lat: { color: "#FFFFFF", fontFamily: F.latin, fontSize: 12.5 },
  shotLabel: { marginStart: "auto", color: "rgba(255,255,255,.85)", fontFamily: F.regular, fontSize: 12 },
  box: { position: "absolute", start: 16, end: 16, height: BOX, overflow: "hidden", borderRadius: 22, backgroundColor: "rgba(12,12,14,.55)", paddingHorizontal: 18, paddingTop: 14 },
  script: { color: "#FFFFFF", fontFamily: F.medium, textAlign: "right", writingDirection: "rtl" },
  fade: { position: "absolute", start: 0, end: 0, bottom: 0, height: 70 },
  count: { position: "absolute", alignSelf: "center", top: "50%", color: "#FFFFFF", fontFamily: F.latinMedium, fontSize: 96, textShadowColor: "rgba(240,117,79,.9)", textShadowRadius: 24 },
  ctrls: { position: "absolute", start: 16, end: 16, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  ctrl: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: glass, borderRadius: 99, padding: 4 },
  ctrlText: { color: "#FFFFFF", fontFamily: F.regular, fontSize: 12 },
  small: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.08)" },
  bottom: { position: "absolute", start: 0, end: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 42 },
  takes: { minWidth: 56, height: 48, borderRadius: 16, backgroundColor: glass, borderWidth: 1, borderColor: "rgba(255,255,255,.3)", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  takesText: { color: "#FFFFFF", fontFamily: F.regular, fontSize: 12 },
  shutterRing: { width: 94, height: 94, borderRadius: 47, borderWidth: 4, borderColor: "rgba(255,255,255,.9)", alignItems: "center", justifyContent: "center" },
  shutter: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center", shadowColor: "#F0754F", shadowOpacity: 0.65, shadowRadius: 22, elevation: 10 },
  stop: { width: 26, height: 26, borderRadius: 7, backgroundColor: "#FFFFFF" },
});
