// اللقطات: تتفرج على كل لقطة، تعيد اللي مش عاجباك بس، ولما كله يبقى تمام بيترفع للمشروع ويتلصق بالترتيب
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as MediaLibrary from "expo-media-library/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../src/icons";
import { shoot, uploadShots, useShoot } from "../src/shoot";
import { ACCENT, F } from "../src/theme";
import { GlowButton } from "../src/ui";

function Preview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

export default function Shots() {
  const ins = useSafeAreaInsets();
  const sess = useShoot();
  const params = useLocalSearchParams<{ i?: string }>();
  const [cur, setCur] = useState(Number(params.i || 0));
  const [busy, setBusy] = useState(false);

  if (!sess) {
    return (
      <View style={[s.root, { justifyContent: "center", padding: 24 }]}>
        <Text style={s.title}>مفيش لقطات دلوقتي</Text>
        <GlowButton title="ارجع للكاميرا" onPress={() => router.replace("/camera")} style={{ marginTop: 14 }} />
      </View>
    );
  }

  const shots = sess.shots;
  const i = Math.min(cur, shots.length - 1);
  const shot = shots[i];
  const done = shots.filter((x) => x.uri).length;
  const all = done === shots.length;
  const next = shots.findIndex((x, k) => k > i && !x.uri);
  const free = sess.target.kind === "free";

  const retake = (k: number) => router.replace({ pathname: "/teleprompter", params: { i: String(k) } });

  async function finish() {
    setBusy(true);
    try {
      if (free) {
        const p = await MediaLibrary.requestPermissionsAsync(true);
        if (!p.granted) throw new Error("محتاجين إذن الاستوديو عشان نحفظ اللقطات");
        for (const x of shots) if (x.uri) await MediaLibrary.saveToLibraryAsync(x.uri);
        Alert.alert("اتحفظ ✓", `${done} لقطة اتحفظوا في الاستوديو بالترتيب.`);
      } else {
        await uploadShots(sess!);
        Alert.alert("وصل ✓", "اللقطات اترفعت واتلصقت بالترتيب في المشروع، والمراجعة والمونتاج بيكمّلوا لوحدهم.");
      }
      shoot.clear();
      router.replace("/camera");
    } catch (e) {
      Alert.alert("ما كملش", (e as Error).message + "\nاللقطات لسه معاك، جرّب تاني.");
    }
    setBusy(false);
  }

  const okLabel = all ? (free ? "تمام، احفظهم في الاستوديو" : "تمام، ارفعهم للمشروع") : next >= 0 ? "تمام، اللقطة اللي بعدها" : "صوّر اللقطة الباقية";
  const ok = () => (all ? finish() : retake(next >= 0 ? next : shots.findIndex((x) => !x.uri)));

  return (
    <View style={[s.root, { paddingTop: ins.top + 10, paddingBottom: ins.bottom + 16 }]}>
      <View style={s.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع للكاميرا" disabled={busy} onPress={() => retake(i)} style={s.round}><Icon name="back" /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{sess.target.title}</Text>
          <Text style={s.sub}>{all ? "كل اللقطات جاهزة" : `${done} من ${shots.length} لقطات جاهزة`}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip} style={{ flexGrow: 0 }}>
        {shots.map((x, k) => (
          <Pressable key={k} onPress={() => setCur(k)} accessibilityRole="button" accessibilityState={{ selected: k === i }}
            style={[s.tile, x.uri ? s.tileDone : null, k === i ? s.tileCur : null]}>
            <Text style={s.tileName}>لقطة {k + 1} · {x.name}</Text>
            <Text style={[s.tileState, x.uri ? { color: "#5FD1A4" } : null]}>{x.uri ? "✓ جاهزة" : "لسه"}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.preview}>
        {shot.uri ? <Preview key={shot.uri} uri={shot.uri} /> : <View style={s.empty}><Icon name="play" size={40} color="rgba(255,255,255,.4)" /></View>}
        {shot.uri ? <Text style={s.take}>TAKE {shot.takes} · 00:{String(shot.secs).padStart(2, "0")}</Text> : null}
        <Text style={s.line}>«{shot.line}»</Text>
      </View>

      <View style={s.acts}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => retake(i)} style={({ pressed }) => [s.soft, pressed && { transform: [{ scale: 1.05 }] }]}>
          <Icon name="flip" size={16} /><Text style={s.softText}>{shot.uri ? "أعد اللقطة دي بس" : "صوّر اللقطة دي"}</Text>
        </Pressable>
        {busy ? <View style={s.busy}><ActivityIndicator color={ACCENT} /><Text style={s.softText}>{free ? "بيحفظ…" : "بيرفع…"}</Text></View>
          : <GlowButton title={okLabel} onPress={ok} disabled={!shot.uri && !all} style={{ flex: 1 }} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0C0C0E", paddingHorizontal: 16, gap: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  title: { color: "#F1F1F3", fontFamily: F.medium, fontSize: 15, textAlign: "right" },
  sub: { color: "rgba(241,241,243,.6)", fontFamily: F.regular, fontSize: 12, textAlign: "right" },
  strip: { gap: 10, paddingVertical: 4 },
  tile: { width: 112, height: 58, borderRadius: 16, borderWidth: 2, borderColor: "transparent", backgroundColor: "rgba(255,255,255,.06)", alignItems: "center", justifyContent: "center", gap: 2 },
  tileDone: { backgroundColor: "rgba(95,209,164,.14)" },
  tileCur: { borderColor: ACCENT, backgroundColor: "rgba(229,97,62,.14)", shadowColor: "#F0754F", shadowOpacity: 0.35, shadowRadius: 18, elevation: 4 },
  tileName: { color: "#F1F1F3", fontFamily: F.regular, fontSize: 11.5 },
  tileState: { color: "rgba(241,241,243,.6)", fontFamily: F.regular, fontSize: 11 },
  preview: { flex: 1, borderRadius: 26, overflow: "hidden", backgroundColor: "#17171A", justifyContent: "flex-end" },
  empty: { position: "absolute", top: 0, bottom: 0, start: 0, end: 0, alignItems: "center", justifyContent: "center" },
  take: { position: "absolute", top: 14, start: 14, color: "#FFFFFF", fontFamily: F.latin, fontSize: 11, backgroundColor: "rgba(0,0,0,.4)", borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10, overflow: "hidden" },
  line: { color: "#FFFFFF", fontFamily: F.medium, fontSize: 15, lineHeight: 24, textAlign: "right", writingDirection: "rtl", padding: 16, backgroundColor: "rgba(0,0,0,.45)" },
  acts: { flexDirection: "row", gap: 10, alignItems: "center" },
  soft: { height: 52, borderRadius: 99, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, backgroundColor: "rgba(255,255,255,.08)" },
  softText: { color: "#F1F1F3", fontFamily: F.regular, fontSize: 13 },
  busy: { flex: 1, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
