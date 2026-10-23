// شاشة البداية: اللوجو الرأسي بيطفو، وتحته الدخول بـ Apple وجوجل والإيميل
import { useEffect, useState } from "react";
import { Animated, Easing, Image, Linking, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { API_BASE } from "../src/api";
import { GlowButton, SoftButton, T } from "../src/ui";

export default function Welcome() {
  const y = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -10, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y]);
  return (
    <LinearGradient colors={["#24232A", "#121214", "#0C0C0E"]} locations={[0, 0.55, 1]} style={s.root}>
      <View style={s.mid}>
        <Animated.View style={{ transform: [{ translateY: y }] }}>
          <Image source={require("../assets/simsimkit-vert-dark.png")} style={s.logo} resizeMode="contain" accessibilityLabel="SimsimKit" />
        </Animated.View>
        <T muted size={13} style={s.center}>صوّر، والذكاء الصناعي يكمّل الباقي</T>
      </View>
      <View style={s.btns}>
        {/* الدخول بـ Apple وجوجل بيتفعّلوا لما حسابات المطوّر تجهز */}
        <SoftButton title="المتابعة مع Apple" color="#141416" style={s.apple} onPress={() => {}} />
        <SoftButton title="المتابعة مع جوجل" color="#F1F1F3" style={s.google} onPress={() => Linking.openURL(API_BASE + "/auth/google")} />
        <GlowButton title="الدخول بالإيميل" onPress={() => router.push("/login")} />
        <T muted size={11} style={s.center}>نفس حسابك على simsimkit.com</T>
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
  apple: { backgroundColor: "#F1F1F3" },
  google: { backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.14)" },
});
