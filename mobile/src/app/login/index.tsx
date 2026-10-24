import { useRouter } from "expo-router";
import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardScreen, useRevealField } from "../../components/KeyboardScreen";
import { Button, Logo, Txt } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { sendOtp } from "../../lib/api/patient";
import { useTextStyle } from "../../lib/appearance";
import { config } from "../../lib/config";
import { cleanMobile, isValidMobile } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { LOCALES } from "../../lib/i18n/types";
import { BIG, colors, radius, space } from "../../lib/theme";

/** First screen: the logo and name, four big language buttons in their own script, one phone field, one button. */
export default function LoginScreen() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const ts = useTextStyle();
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
      <KeyboardScreen contentContainerStyle={styles.content}>
          <View style={styles.brand}>
            <Logo height={74} accessible={false} />
            <Txt variant="display" style={{ marginTop: space.md, fontSize: 30 }}>
              {t("welcomeTitle")}
            </Txt>
            <Txt color={colors.muted} center style={{ marginTop: space.xs }}>
              {t("welcomeSubtitle")}
            </Txt>
          </View>

          <Txt variant="smallBold" color={colors.muted} style={{ fontSize: 15, marginBottom: space.sm }}>
            {t("chooseLanguage")}
          </Txt>
          <View style={styles.langs}>
            {LOCALES.map((l) => {
              const on = locale === l.code;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => setLocale(l.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={l.englishLabel}
                  style={[styles.lang, on && styles.langOn]}
                >
                  {/* Each name in its own script, in the system font, so हिंदी and বাংলা render before any font loads. */}
                  <Text style={[styles.langText, on && { color: colors.primaryDark }]}>{l.nativeLabel}</Text>
                </Pressable>
              );
            })}
          </View>

          <Txt variant="smallBold" color={colors.muted} style={{ fontSize: 15, marginTop: space.xl, marginBottom: space.sm }}>
            {t("phoneTitle")}
          </Txt>
          <PhoneBox error={!!error}>
            <Txt variant="subheading" style={styles.prefix}>
              +91
            </Txt>
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
              returnKeyType="done"
              onSubmitEditing={submit}
              style={[styles.phoneInput, ts(20, "700"), { lineHeight: undefined }]}
              accessibilityLabel={t("phoneTitle")}
            />
          </PhoneBox>
          {error ? (
            <Txt variant="small" color={colors.danger} style={{ marginTop: space.sm }}>
              {error}
            </Txt>
          ) : (
            <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
              {t("phoneHint")}
            </Txt>
          )}

          <View style={{ flex: 1, minHeight: space.xl }} />
          <Button label={busy ? t("sending") : t("sendCode")} icon="logo-whatsapp" onPress={submit} loading={busy} disabled={!valid} />

          <Txt variant="tiny" color={colors.muted} center style={{ marginTop: space.lg, fontWeight: undefined }}>
            {t("consentLine")}{" "}
            <Txt variant="tinyBold" color={colors.primary} style={{ textDecorationLine: "underline" }}>
              <Text onPress={() => Linking.openURL(`${config.businessUrl}/terms`)}>{t("terms")}</Text>
            </Txt>
            {" · "}
            <Txt variant="tinyBold" color={colors.primary} style={{ textDecorationLine: "underline" }}>
              <Text onPress={() => Linking.openURL(`${config.businessUrl}/privacy`)}>{t("privacy")}</Text>
            </Txt>
          </Txt>
      </KeyboardScreen>
    </SafeAreaView>
  );
}

/** The +91 box; scrolls itself above the keyboard when its field is focused. */
function PhoneBox({ error, children }: { error: boolean; children: ReactNode }) {
  const box = useRef<ComponentRef<typeof View>>(null);
  const reveal = useRevealField();
  return (
    <View ref={box} style={[styles.phoneBox, error ? { borderColor: colors.danger } : null]} onTouchStart={() => reveal(box)}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.xxl, flexGrow: 1 },
  brand: { alignItems: "center", marginBottom: space.xxl },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  lang: { flexBasis: "47%", flexGrow: 1, minHeight: BIG, borderRadius: radius.md + 2, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  langOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  langText: { fontSize: 18, fontWeight: "700", color: colors.ink },
  phoneBox: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md + 2, backgroundColor: colors.card, minHeight: 60, overflow: "hidden" },
  prefix: { paddingHorizontal: space.md + 2, alignSelf: "stretch", textAlignVertical: "center", lineHeight: 60, borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.bg },
  // Fixed height, no font padding: some Android phones otherwise clip or hide the typed digits.
  phoneInput: { flex: 1, height: 56, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center", paddingHorizontal: space.md + 2, color: colors.ink, letterSpacing: 1 },
});
