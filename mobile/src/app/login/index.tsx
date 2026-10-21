import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Chip, Txt } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { sendOtp } from "../../lib/api/patient";
import { config } from "../../lib/config";
import { cleanMobile, isValidMobile } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { LOCALES } from "../../lib/i18n/types";
import { colors, font, radius, space } from "../../lib/theme";

/** First screen: pick a language (pre-selected from the phone) and enter the WhatsApp number. One button. */
export default function LoginScreen() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = isValidMobile(mobile);

  async function submit() {
    if (!valid) {
      setError(t("invalidPhone"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await sendOtp(mobile);
      if (!res.success) {
        setError(res.message || t("invalidPhone"));
        return;
      }
      router.push({ pathname: "/login/otp", params: { mobile } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("retry"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="medkit" size={34} color="#fff" />
            </View>
            <Txt variant="title">{t("welcomeTitle")}</Txt>
            <Txt color={colors.muted} style={{ marginTop: space.xs, textAlign: "center" }}>
              {t("welcomeSubtitle")}
            </Txt>
          </View>

          <Txt variant="smallBold" style={{ marginBottom: space.sm }}>
            {t("chooseLanguage")}
          </Txt>
          <View style={styles.langs}>
            {LOCALES.map((l) => (
              <Chip key={l.code} label={l.nativeLabel} selected={locale === l.code} onPress={() => setLocale(l.code)} style={{ flexGrow: 1 }} />
            ))}
          </View>

          <Txt variant="heading" style={{ marginTop: space.xxl }}>
            {t("phoneTitle")}
          </Txt>
          <Txt color={colors.muted} style={{ marginTop: space.xs, marginBottom: space.lg }}>
            {t("phoneHint")}
          </Txt>
          <View style={[styles.phoneBox, error ? { borderColor: colors.danger } : null]}>
            <Text style={styles.prefix}>+91</Text>
            <TextInput
              value={mobile}
              onChangeText={(v) => {
                setMobile(cleanMobile(v));
                setError(null);
              }}
              placeholder={t("phonePlaceholder")}
              placeholderTextColor={colors.faint}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              maxLength={14}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              style={styles.phoneInput}
              accessibilityLabel={t("phoneTitle")}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label={busy ? t("sending") : t("sendCode")} icon="logo-whatsapp" variant="whatsapp" onPress={submit} loading={busy} disabled={!valid} style={{ marginTop: space.xl }} />

          <Text style={styles.consent}>
            {t("consentLine")}{" "}
            <Text style={styles.link} onPress={() => Linking.openURL(`${config.businessUrl}/terms`)}>
              {t("terms")}
            </Text>
            {" · "}
            <Text style={styles.link} onPress={() => Linking.openURL(`${config.businessUrl}/privacy`)}>
              {t("privacy")}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1 },
  brand: { alignItems: "center", marginBottom: space.xxl },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: space.md },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  phoneBox: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.card, minHeight: 56 },
  prefix: { fontSize: 18, fontWeight: "600", color: colors.ink, paddingHorizontal: space.lg, borderRightWidth: 1, borderRightColor: colors.line },
  phoneInput: { flex: 1, fontSize: 20, paddingHorizontal: space.lg, color: colors.ink, letterSpacing: 1 },
  error: { color: colors.danger, marginTop: space.sm, fontSize: font.small },
  consent: { color: colors.muted, fontSize: font.tiny, marginTop: space.lg, lineHeight: 18, textAlign: "center" },
  link: { color: colors.primary, fontWeight: "600" },
});
