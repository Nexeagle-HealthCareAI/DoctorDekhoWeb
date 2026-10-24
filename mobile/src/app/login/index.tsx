import { useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardScreen, useRevealField } from "../../components/KeyboardScreen";
import { RiseIn } from "../../components/Motion";
import { Button, HelpButton, Logo, Txt } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { sendOtp } from "../../lib/api/patient";
import { useTextStyle } from "../../lib/appearance";
import { config } from "../../lib/config";
import { cleanMobile, isValidMobile } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { LOCALES } from "../../lib/i18n/types";
import { skyNow } from "../../lib/sky";
import { BIG, colors, radius, space } from "../../lib/theme";

/** First screen: the logo and name, four big language buttons in their own script, one phone field, one button. */
export default function LoginScreen() {
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const ts = useTextStyle();
  const insets = useSafeAreaInsets();
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
      // Only a Development API hands the code back (it sends no WhatsApp message there); every other server sends nothing here.
      if (res.devCode) Alert.alert("Dev only", `Your OTP is ${res.devCode}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("retry"));
    } finally {
      setBusy(false);
    }
  }

  // The welcome band follows the time of day, like Home; the status bar matches it.
  const sky = skyNow();
  useEffect(() => {
    setStatusBarStyle(sky.bar);
    return () => setStatusBarStyle("dark");
  }, [sky.bar]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardScreen contentContainerStyle={styles.content}>
        <View style={[styles.brand, { backgroundColor: sky.bg, paddingTop: insets.top + space.xxl }]}>
          <RiseIn>
            <Logo height={80} accessible={false} />
          </RiseIn>
          <Txt variant="display" color={sky.ink} style={{ marginTop: space.md, fontSize: 30 }}>
            {t("welcomeTitle")}
          </Txt>
          <Txt color={sky.ink} center style={{ marginTop: space.xs, fontWeight: "600" }}>
            {t("welcomeSubtitle")}
          </Txt>
        </View>

        <View style={styles.card}>
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
                  style={({ pressed }) => [styles.lang, on && styles.langOn, pressed && { transform: [{ scale: 0.96 }] }]}
                >
                  {/* Each name in its own script, in the system font, so हिंदी and বাংলা render before any font loads. */}
                  <Text style={[styles.langText, on && { color: colors.primaryDark }]}>{l.nativeLabel}</Text>
                </Pressable>
              );
            })}
          </View>

          <Txt variant="smallBold" color={colors.muted} style={{ fontSize: 15, marginTop: space.lg, marginBottom: space.sm }}>
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
            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.sm }}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} style={{ marginTop: 1 }} />
              <Txt variant="small" color={colors.text} style={{ flex: 1 }}>
                {t("numberPrivacy")}
              </Txt>
            </View>
          )}
        </View>

        <View style={{ flex: 1, minHeight: space.lg }} />
        <View style={{ paddingHorizontal: space.lg }}>
          <Button label={busy ? t("sending") : t("sendCode")} icon="logo-whatsapp" onPress={submit} loading={busy} disabled={!valid} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, marginBottom: insets.bottom + space.md }}>
            <Txt variant="tiny" color={colors.muted} style={{ flex: 1, fontWeight: undefined }}>
              {t("consentLine")}{" "}
              <Txt variant="tinyBold" color={colors.primary} style={{ textDecorationLine: "underline" }}>
                <Text onPress={() => Linking.openURL(`${config.businessUrl}/terms`)}>{t("terms")}</Text>
              </Txt>
              {" · "}
              <Txt variant="tinyBold" color={colors.primary} style={{ textDecorationLine: "underline" }}>
                <Text onPress={() => Linking.openURL(`${config.businessUrl}/privacy`)}>{t("privacy")}</Text>
              </Txt>
            </Txt>
            <HelpButton context="sign-in" />
          </View>
        </View>
      </KeyboardScreen>
    </View>
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
  content: { flexGrow: 1 },
  brand: { alignItems: "center", paddingHorizontal: space.xl, paddingBottom: 52 },
  card: { marginTop: -28, marginHorizontal: space.lg, padding: space.lg + 2, borderRadius: 24, backgroundColor: colors.card, elevation: 4, shadowColor: "#10231F", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  lang: { flexBasis: "47%", flexGrow: 1, minHeight: BIG, borderRadius: radius.md + 2, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  langOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  langText: { fontSize: 18, fontWeight: "700", color: colors.ink },
  phoneBox: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md + 2, backgroundColor: colors.card, minHeight: 60, overflow: "hidden" },
  prefix: { paddingHorizontal: space.md + 2, alignSelf: "stretch", textAlignVertical: "center", lineHeight: 60, borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.bg },
  // Fixed height, no font padding: some Android phones otherwise clip or hide the typed digits.
  phoneInput: { flex: 1, height: 56, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center", paddingHorizontal: space.md + 2, color: colors.ink, letterSpacing: 1 },
});
