import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { staticMapUrl, type LatLng } from "../lib/map";
import { colors, radius } from "../lib/theme";
import { Pulse } from "./Motion";
import { Txt } from "./ui";

/**
 * A still Mapbox picture with doctor pins, a "you are here" pulse and a label — opens the live map on tap.
 * A picture loads in one request and is cached on the phone, so Home stays instant on budget phones and
 * doesn't spend live-map loads every time it's opened.
 */
export function MapPreview({
  center,
  zoom,
  pins,
  me,
  label,
  action,
  height = 196,
  onPress,
  accessibilityLabel,
  style,
}: {
  center: LatLng;
  zoom: number;
  pins: LatLng[];
  me?: boolean;
  label?: string;
  action?: string;
  height?: number;
  onPress: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const uri = width ? staticMapUrl({ center, zoom, width, height, pins: pins.slice(0, 12) }) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={({ pressed }) => [styles.box, { height, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" transition={150} accessible={false} /> : null}
      {me ? <Pulse size={16} color="#1D63D8" style={{ position: "absolute", left: width / 2 - 8, top: height / 2 - 8 }} /> : null}
      {label ? (
        <View style={styles.label}>
          <Txt variant="smallBold" style={{ fontSize: 15 }}>
            {label}
          </Txt>
        </View>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <Txt variant="smallBold" color="#fff">
            {action}
          </Txt>
          <Ionicons name="chevron-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
        </View>
      ) : null}
      <Txt variant="tiny" color="#4A5551" style={styles.credit}>
        © Mapbox © OpenStreetMap
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: "#ECEFE7", borderWidth: 1, borderColor: colors.line },
  label: { position: "absolute", left: 12, top: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: "#fff", elevation: 2, shadowColor: "#10231F", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  action: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", alignItems: "center", minHeight: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.ink },
  credit: { position: "absolute", left: 10, bottom: 6, fontSize: 9 },
});
