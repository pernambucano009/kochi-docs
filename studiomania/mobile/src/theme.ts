// ألوان وخطوط سمسمكيت — نفس قيم الموقع (home2.css): برتقالي #E5613E، حبر #181718، رمادي #8C8C88، خلفية #FAFAF8
import { useColorScheme } from "react-native";

export const ACCENT = "#E5613E";
export const GLOW = ["#F48A62", "#E5613E", "#D44E2C"] as const;

const light = {
  dark: false,
  bg: "#FAFAF8",
  card: "#FFFFFF",
  field: "#F3F2EF",
  ink: "#181718",
  muted: "#8C8C88",
  line: "rgba(24,23,24,.08)",
  okBg: "#E4F2EA",
  okInk: "#21643F",
  softAccent: "#FFF6F2",
  shadow: "rgba(24,23,24,.08)",
};

const dark: typeof light = {
  dark: true,
  bg: "#0C0C0E",
  card: "#1C1C1F",
  field: "#2A292A",
  ink: "#F1F1F3",
  muted: "#8A8A92",
  line: "rgba(255,255,255,.08)",
  okBg: "rgba(95,209,164,.14)",
  okInk: "#5FD1A4",
  softAccent: "rgba(229,97,62,.14)",
  shadow: "rgba(0,0,0,.45)",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

// العربي بـ Readex Pro، والأرقام واللاتيني بـ Jost (زي هيدر البرنامج)
export const F = {
  light: "ReadexPro_300Light",
  regular: "ReadexPro_400Regular",
  medium: "ReadexPro_500Medium",
  latin: "Jost_400Regular",
  latinMedium: "Jost_500Medium",
};
