// الدخول بالإيميل — نفس حساب الويب، وفيه زرار العين للباسوورد زي صفحة الدخول
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { login } from "../src/api";
import { registerPush } from "../src/push";
import { F, useTheme } from "../src/theme";
import { GlowButton, IconButton, T } from "../src/ui";

export default function Login() {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const field = [s.input, { backgroundColor: t.card, color: t.ink, borderColor: t.line }];
  async function go() {
    setErr(""); setBusy(true);
    try {
      const r = await login(email.trim(), pw);
      if (r.verify) setErr("أكّد إيميلك الأول من الرسالة اللي وصلتك، وبعدين ادخل.");
      else { router.replace("/camera"); registerPush(); }
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[s.root, { backgroundColor: t.bg }]}>
      <View style={s.top}>
        <IconButton label="رجوع" onPress={() => router.back()}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={1.8} strokeLinecap="round"><Path d="m9 6 6 6-6 6" /></Svg>
        </IconButton>
        <T size={18} weight="medium">الدخول</T>
      </View>
      <View style={s.form}>
        <T muted size={12.5}>البريد الإلكتروني</T>
        <TextInput style={field} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <T muted size={12.5}>كلمة المرور</T>
        <View>
          <TextInput style={[field, { paddingLeft: 52 }]} value={pw} onChangeText={setPw} secureTextEntry={!show} autoComplete="password" textContentType="password" />
          <Pressable accessibilityRole="button" accessibilityLabel={show ? "اخفي كلمة المرور" : "اظهر كلمة المرور"} onPress={() => setShow(!show)} style={s.eye} hitSlop={8}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {show ? <Path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                : <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><Circle cx={12} cy={12} r={3} /></>}
            </Svg>
          </Pressable>
        </View>
        {err ? <T size={12.5} style={{ color: "#D44E2C" }}>{err}</T> : null}
        <GlowButton title={busy ? "جارٍ الدخول…" : "دخول"} onPress={go} disabled={busy || !email || !pw} style={{ marginTop: 10 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  form: { marginTop: 30, gap: 8 },
  input: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontFamily: F.regular, fontSize: 15, textAlign: "right" },
  eye: { position: "absolute", left: 10, top: 0, height: 52, width: 36, alignItems: "center", justifyContent: "center" },
});
