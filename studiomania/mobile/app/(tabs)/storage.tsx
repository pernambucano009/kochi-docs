// المساحة السحابية — الشاشة بتتبني في الخطوة الجاية حسب البروتوتايب المعتمد
import { View } from "react-native";
import { useTheme } from "../../src/theme";
import { T } from "../../src/ui";

export default function Screen() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 60, paddingHorizontal: 20 }}>
      <T size={18} weight="medium">المساحة السحابية</T>
    </View>
  );
}
