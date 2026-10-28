import Ionicons from "@expo/vector-icons/Ionicons";
import { View } from "react-native";
import { colors } from "../lib/theme";
import { Txt } from "./ui";

/** Vita's face: a teal circle with a small spark, used wherever Vita appears. */
export function VitaFace({ size = 40 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Txt variant="bodyBold" color="#fff" style={{ fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5) }}>
        V
      </Txt>
      <View style={{ position: "absolute", right: -2, top: -2, width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, backgroundColor: "#FFF1D6", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.bg }}>
        <Ionicons name="sparkles" size={Math.round(size * 0.2)} color="#B45309" />
      </View>
    </View>
  );
}
