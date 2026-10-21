import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../lib/i18n";
import type { CityOption, HomePlace } from "../lib/location";
import { colors, font, radius, space } from "../lib/theme";
import { Button, Txt } from "./ui";

export function CityPicker({
  visible,
  cities,
  current,
  locating,
  onClose,
  onPick,
  onLocate,
}: {
  visible: boolean;
  cities: CityOption[];
  current: HomePlace | null;
  locating: boolean;
  onClose: () => void;
  onPick: (p: HomePlace) => void;
  onLocate: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? cities.filter((c) => c.city.toLowerCase().includes(s) || c.state.toLowerCase().includes(s)) : cities;
  }, [cities, q]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.header}>
          <Txt variant="heading">{t("chooseCity")}</Txt>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t("cancel")}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: space.lg }}>
          <Button label={t("useMyLocation")} icon="locate" variant="secondary" onPress={onLocate} loading={locating} />
          <TextInput value={q} onChangeText={setQ} placeholder={t("chooseCity")} placeholderTextColor={colors.faint} style={styles.search} />
        </View>
        <FlatList
          data={[{ city: "", state: "", count: 0 } as CityOption, ...list]}
          keyExtractor={(c) => `${c.city}|${c.state}`}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const all = item.city === "";
            const selected = all ? !current?.city : current?.city === item.city && current?.state === item.state;
            return (
              <Pressable
                onPress={() => onPick(all ? { city: null, state: null } : { city: item.city, state: item.state })}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.primarySoft }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.city}>{all ? t("allIndia") : item.city}</Text>
                  {!all ? <Text style={styles.state}>{`${item.state} · ${t("doctorsCount", { count: item.count })}`}</Text> : null}
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: space.lg },
  search: {
    marginTop: space.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: font.body,
    backgroundColor: colors.card,
    color: colors.ink,
  },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  city: { fontSize: font.body, fontWeight: "600", color: colors.ink },
  state: { fontSize: font.tiny + 1, color: colors.muted, marginTop: 2 },
});
