// شاشة البداية: اللوجو الرأسي بيطفو، وتحته الدخول بـ Apple (الآيفون) وجوجل والبريد الإلكتروني
import { useEffect, useState } from "react";
import { Alert, Animated, Easing, Image, Platform, StyleSheet, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { appleAvailable, appleLogin, googleLogin } from "../src/auth";
import { registerPush } from "../src/push";
import { GlowButton, SoftButton, T } from "../src/ui";

export default function Welcome() {
  const y = useState(() => new Animated.Value(0))[0];
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -10, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y]);
  useEffect(() => { if (Platform.OS === "ios") appleAvailable().then(setApple); }, []);

  async function go(kind: "apple" | "google") {
    if (busy) return;
    setBusy(kind);
    try {
      if (await (kind === "apple" ? appleLogin() : googleLogin())) { router.replace("/camera"); registerPush(); }
    } catch (e) {
      Alert.alert("لم يكتمل الدخول", (e as Error).message);
    }
    setBusy("");
  }

  return (
    <LinearGradient colors={["#24232A", "#121214", "#0C0C0E"]} locations={[0, 0.55, 1]} style={s.root}>
      <View style={s.mid}>
        <Animated.View style={{ transform: [{ translateY: y }] }}>
          <Image source={require("../assets/simsimkit-vert-dark.png")} style={s.logo} resizeMode="contain" accessibilityLabel="SimsimKit" />
        </Animated.View>
        <T muted size={13} style={s.center}>صوّر، والذكاء الاصطناعي يكمل الباقي</T>
      </View>
      <View style={s.btns}>
        {apple ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={26} style={s.appleBtn} onPress={() => go("apple")} />
        ) : null}
        <SoftButton title={busy === "google" ? "جارٍ الدخول…" : "المتابعة مع جوجل"} color="#F1F1F3" style={s.google} onPress={() => go("google")} />
        <GlowButton title="الدخول بالبريد الإلكتروني" onPress={() => router.push("/login")} />
        <T muted size={11} style={s.center}>هو نفسه حسابك على simsimkit.com</T>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingBottom: 44 },
  mid: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  logo: { width: 230, height: 265 },
  center: { textAlign: "center" },
  btns: { gap: 10 },
  appleBtn: { width: "100%", height: 52 },
  google: { backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
});
