import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { saveAppProfile } from "../../lib/api/patient";
import { useI18n } from "../../lib/i18n";
import { LOCALES, toServerLanguage, type Locale } from "../../lib/i18n/types";
import { keys } from "../../lib/queries";
import { colors, font, radius, space } from "../../lib/theme";

/** Language for the app — also saved to the account so WhatsApp reminders use it. */
export default function LanguageScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale, setLocale } = useI18n();

  function pick(l: Locale) {
    setLocale(l);
    void saveAppProfile({ preferredLanguage: toServerLanguage(l) })
      .then((a) => a && qc.setQueryData(keys.appProfile, a))
      .catch(() => {});
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.sm }}>
      <Stack.Screen options={{ title: t("language") }} />
      {LOCALES.map((l) => {
        const selected = l.code === locale;
        return (
          <Pressable key={l.code} onPress={() => pick(l.code)} style={[styles.row, selected && styles.selected]} accessibilityRole="radio" accessibilityState={{ selected }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.native}>{l.nativeLabel}</Text>
              {l.englishLabel !== l.nativeLabel ? <Text style={styles.english}>{l.englishLabel}</Text> : null}
            </View>
            {selected ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.lg, minHeight: 64 },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  native: { fontSize: font.body + 2, fontWeight: "700", color: colors.ink },
  english: { fontSize: font.small, color: colors.muted, marginTop: 2 },
});
