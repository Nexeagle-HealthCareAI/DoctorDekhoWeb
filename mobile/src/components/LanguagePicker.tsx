import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { saveAppProfile } from "../lib/api/patient";
import { useSession } from "../lib/auth/session";
import { useI18n } from "../lib/i18n";
import { LOCALES, toServerLanguage, type Locale } from "../lib/i18n/types";
import { keys } from "../lib/queries";
import { colors, radius, space } from "../lib/theme";
import { Button, Txt } from "./ui";

/**
 * Switch the app language at once, and save it to the account (when signed in) so WhatsApp reminders
 * and a new phone use the same language.
 */
export function useChangeLanguage() {
  const { setLocale } = useI18n();
  const { status } = useSession();
  const qc = useQueryClient();
  return useCallback(
    (l: Locale) => {
      Haptics.selectionAsync().catch(() => {});
      setLocale(l);
      if (status !== "signedIn") return;
      void saveAppProfile({ preferredLanguage: toServerLanguage(l) })
        .then((a) => a && qc.setQueryData(keys.appProfile, a))
        .catch(() => {});
    },
    [setLocale, status, qc],
  );
}

/** The four languages as big rows, each name in its own script (system font, so it renders before any font loads). */
export function LanguageOptions({ onPicked }: { onPicked?: (l: Locale) => void }) {
  const { locale } = useI18n();
  const change = useChangeLanguage();
  return (
    <View style={{ gap: space.sm + 2 }} accessibilityRole="radiogroup">
      {LOCALES.map((l) => {
        const on = l.code === locale;
        return (
          <Pressable
            key={l.code}
            onPress={() => {
              change(l.code);
              onPicked?.(l.code);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={l.englishLabel}
            style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && !on && { backgroundColor: colors.bg }]}
          >
            <View style={[styles.letter, on && { backgroundColor: colors.primary }]}>
              <Text style={[styles.letterText, on && { color: "#fff" }]}>{SAMPLE[l.code]}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={styles.native}>{l.nativeLabel}</Text>
              {l.englishLabel !== l.nativeLabel ? <Text style={styles.english}>{l.englishLabel}</Text> : null}
            </View>
            <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={26} color={on ? colors.primary : colors.lineStrong} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** A first letter in each script, so the rows can be told apart at a glance even by someone who can't read the others. */
const SAMPLE: Record<Locale, string> = { en: "A", hi: "अ", bn: "অ", hinglish: "Aa" };

export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t("close")} />
      <SafeAreaView edges={["bottom"]} style={styles.sheet}>
        <View style={styles.handle} />
        <Txt variant="title">{t("chooseLanguage")}</Txt>
        <Txt color={colors.muted} style={{ marginTop: space.xs, marginBottom: space.lg }}>
          {t("languageHint")}
        </Txt>
        <LanguageOptions onPicked={() => setTimeout(onClose, 150)} />
        <Button label={t("close")} variant="ghost" size="md" onPress={onClose} style={{ marginTop: space.sm }} />
      </SafeAreaView>
    </Modal>
  );
}

/** Small "🌐 English ▾" link that opens the sheet — on Home, beside the city, so language is one tap away. */
export function LanguageLink({ color = colors.primaryDark }: { color?: string } = {}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((l) => l.code === locale);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${t("language")}: ${current?.englishLabel ?? ""}`} hitSlop={8} style={styles.link}>
        <Ionicons name="language" size={16} color={color} />
        <Text style={[styles.linkText, { color }]} numberOfLines={1}>
          {current?.nativeLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={color} />
      </Pressable>
      <LanguageSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 68, paddingHorizontal: space.md + 2, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  letter: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.segment, alignItems: "center", justifyContent: "center" },
  letterText: { fontSize: 19, fontWeight: "700", color: colors.ink },
  native: { fontSize: 19, fontWeight: "700", color: colors.ink },
  english: { fontSize: 14, color: colors.muted, marginTop: 1 },
  scrim: { flex: 1, backgroundColor: "rgba(16,35,31,0.4)" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, paddingTop: space.md },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginBottom: space.lg },
  link: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  linkText: { fontSize: 14, fontWeight: "700", color: colors.primaryDark, maxWidth: 110 },
});
