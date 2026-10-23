// قطع الواجهة المشتركة: الزرار البرتقالي المنوّر، والأزرار اللي بتبرز مع اللمس، والكروت والنصوص
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ACCENT, F, GLOW, useTheme } from "./theme";

// بيكبر شوية مع الضغط (زي الويب: scale 1.06) ويرجع بنعومة
function usePop(to = 1.06) {
  const s = useRef(new Animated.Value(1)).current;
  const spring = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return { scale: s, onPressIn: () => spring(to), onPressOut: () => spring(1) };
}

export function GlowButton({ title, onPress, icon, style, textStyle, disabled }: {
  title?: string; onPress?: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle>; disabled?: boolean;
}) {
  const pop = usePop();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow]);
  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [12, 22] });
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
      onPressIn={pop.onPressIn}
      onPressOut={pop.onPressOut}
    >
      <Animated.View style={[styles.glowWrap, { transform: [{ scale: pop.scale }], shadowRadius, opacity: disabled ? 0.6 : 1 }, style]}>
        <LinearGradient colors={GLOW} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.glowShine} />
        {icon}
        {title ? <Text style={[styles.glowText, textStyle]}>{title}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

export function SoftButton({ title, onPress, icon, style, color }: { title: string; onPress?: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; color?: string }) {
  const t = useTheme();
  const pop = usePop(1.05);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} onPressIn={pop.onPressIn} onPressOut={pop.onPressOut}>
      <Animated.View style={[styles.soft, { backgroundColor: t.field, transform: [{ scale: pop.scale }] }, style]}>
        {icon}
        <Text style={{ color: color || t.ink, fontFamily: F.regular, fontSize: 13.5 }}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

// زرار دايري بأيقونة (44×44) — زي أزرار هيدر البرنامج
export function IconButton({ children, onPress, label, dim, style }: { children: ReactNode; onPress?: () => void; label: string; dim?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const pop = usePop(1.08);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={pop.onPressIn} onPressOut={pop.onPressOut}>
      <Animated.View style={[styles.iconBtn, dim ? styles.iconDim : { backgroundColor: t.card, shadowColor: t.shadow }, { transform: [{ scale: pop.scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, shadowColor: t.shadow }, style]}>{children}</View>;
}

export function T({ children, style, muted, size = 13.5, weight = "regular" }: {
  children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; size?: number; weight?: "light" | "regular" | "medium";
}) {
  const t = useTheme();
  return <Text style={[{ color: muted ? t.muted : t.ink, fontFamily: F[weight], fontSize: size, textAlign: "right", writingDirection: "rtl" }, style]}>{children}</Text>;
}

export const accent = ACCENT;

const styles = StyleSheet.create({
  glowWrap: {
    height: 52, borderRadius: 99, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 24, shadowColor: "#F0754F", shadowOpacity: 0.55, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  glowShine: { position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,.38)" },
  glowText: { color: "#FFFFFF", fontFamily: F.medium, fontSize: 14.5 },
  soft: { height: 48, borderRadius: 99, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 20 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  iconDim: { backgroundColor: "rgba(20,20,22,.35)" },
  card: { borderRadius: 24, padding: 16, shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
});
