// أيقونات الخط الرفيع (نفس اللي في البروتوتايب والويب): stroke 1.7 وأطراف مدوّرة
import Svg, { Path } from "react-native-svg";

const D = {
  user: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M4.5 20a7.5 7.5 0 0 1 15 0",
  bell: "M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z M10 19.5a2 2 0 0 0 4 0",
  flip: "M20 12a8 8 0 1 1-2.3-5.6 M20 4v4h-4",
  flash: "M13 3 5 14h6l-1 7 8-11h-6z",
  lines: "M5 6h14 M5 10h14 M5 14h9 M5 18h6",
  timer: "M12 7a7 7 0 1 1 0 14 7 7 0 0 1 0-14z M12 11v3l2 1.5 M10 3h4",
  folder: "M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
  close: "M6 6l12 12M18 6 6 18",
  back: "m9 6 6 6-6 6",
  swap: "M20 10a8 8 0 0 0-14.6-3.5M4 14a8 8 0 0 0 14.6 3.5 M20 4v6h-6M4 20v-6h6",
  gallery: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M4 16l4.5-4.5 4 4 2.5-2.5 5 5 M15 9h.01",
  check: "M5 12.5l4.5 4.5L19 7",
  edit: "M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4",
  play: "M8 5v14l11-7z",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z M5 11a7 7 0 0 0 14 0 M12 18v3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z",
} as const;

export type IconName = keyof typeof D;

export function Icon({ name, size = 18, color = "#FFFFFF", width = 1.7 }: { name: IconName; size?: number; color?: string; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <Path d={D[name]} />
    </Svg>
  );
}
