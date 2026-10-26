// مشغّل فيديو بيطلع من تحت (للفيديوهات النهائية والمشاريع)، ومعاه «احفظ في معرض الصور»
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mediaHeaders, mediaUrl } from "./api";
import { Icon } from "./icons";
import { ACCENT } from "./theme";
import { GlowButton, T } from "./ui";

export type SheetVideo = { id: string; name: string; url: string; download_url?: string };

function Player({ uri, headers }: { uri: string; headers: Record<string, string> }) {
  const src = useMemo(() => ({ uri, headers }), [uri, headers]);
  const player = useVideoPlayer(src, (p) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={s.video} contentFit="contain" nativeControls />;
}

export function VideoSheet({ video, onClose }: { video: SheetVideo | null; onClose: () => void }) {
  const ins = useSafeAreaInsets();
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { mediaHeaders().then(setHeaders); }, []);

  async function save() {
    if (!video || !headers) return;
    setSaving(true);
    try {
      const p = await MediaLibrary.requestPermissionsAsync(true);
      if (!p.granted) throw new Error("نحتاج إذن الوصول إلى الصور لحفظ الفيديو");
      const dest = new File(Paths.cache, `simsimkit_${video.id}.mp4`);
      const f = await File.downloadFileAsync(mediaUrl(video.download_url || video.url), dest, { headers, idempotent: true });
      await MediaLibrary.saveToLibraryAsync(f.uri);
      Alert.alert("حُفظ ✓", "الفيديو في معرض الصور، ويمكنك نشره من أي تطبيق.");
    } catch (e) {
      Alert.alert("لم يُحفظ", (e as Error).message);
    }
    setSaving(false);
  }

  return (
    <Modal visible={!!video} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[s.root, { paddingTop: ins.top + 8, paddingBottom: ins.bottom + 16 }]}>
        <View style={s.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="إغلاق" onPress={onClose} style={s.round}><Icon name="close" /></Pressable>
          <T size={14} weight="medium" style={{ color: "#F1F1F3", flex: 1 }}>{video?.name || ""}</T>
        </View>
        <View style={{ flex: 1 }}>
          {video && headers ? <Player uri={mediaUrl(video.url)} headers={headers} /> : <ActivityIndicator color={ACCENT} style={{ marginTop: 80 }} />}
        </View>
        <GlowButton title={saving ? "جارٍ الحفظ…" : "احفظ في معرض الصور"} disabled={saving || !headers} onPress={save} style={{ marginHorizontal: 16 }} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0C0C0E", gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  video: { flex: 1, backgroundColor: "#000" },
});
