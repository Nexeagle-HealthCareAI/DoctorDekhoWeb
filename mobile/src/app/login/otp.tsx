import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { OtpInput } from "../../components/OtpInput";
import { Button, Txt } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { sendOtp, verifyOtp } from "../../lib/api/patient";
import { useSession } from "../../lib/auth/session";
import { useI18n } from "../../lib/i18n";
import { colors, font, space } from "../../lib/theme";

const RESEND_SECONDS = 30;

/** Six boxes, auto-submit at the sixth digit, and a one-tap "Paste code" when a 6-digit code is on the clipboard
 * (the patient copies it from WhatsApp and comes back). */
export default function OtpScreen() {
  const { mobile = "" } = useLocalSearchParams<{ mobile?: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { signIn } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(RESEND_SECONDS);
  const [hasClip, setHasClip] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  // Coming back from WhatsApp: offer "Paste code" when the clipboard has text. The clipboard is read only when the
  // patient taps it, so iOS never shows its paste prompt on its own.
  useEffect(() => {
    const check = () => Clipboard.hasStringAsync().then(setHasClip).catch(() => setHasClip(false));
    void check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void check());
    return () => sub.remove();
  }, []);

  async function pasteFromClipboard() {
    try {
      const text = (await Clipboard.getStringAsync()) ?? "";
      const m = text.match(/(\d{6})/);
      if (!m) {
        setError(t("otpTitle"));
        return;
      }
      setCode(m[1]);
      void verify(m[1]);
    } catch {
      // ignore
    }
  }

  async function verify(value: string) {
    if (submitting.current || value.length !== 6) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await verifyOtp(mobile, value);
      if (!res.success || !res.accessToken) {
        setError(res.message || t("retry"));
        setCode("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // The router guards move the patient on to "About you" or Home once the session flips.
      await signIn(res.accessToken, res.mobile || mobile);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("retry"));
      setCode("");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    setLeft(RESEND_SECONDS);
    setError(null);
    try {
      const res = await sendOtp(mobile);
      if (!res.success) setError(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("retry"));
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Txt variant="title">{t("otpTitle")}</Txt>
        <Txt color={colors.muted} style={{ marginTop: space.xs, marginBottom: space.xl }}>
          {t("otpSentTo", { mobile })}
        </Txt>

        <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={verify} error={!!error} />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {hasClip && code.length < 6 && !busy ? (
          <Button label={t("pasteCode")} variant="secondary" icon="clipboard-outline" onPress={pasteFromClipboard} style={{ marginTop: space.xl }} />
        ) : null}

        {busy ? <Button label={t("verifying")} onPress={() => {}} loading style={{ marginTop: space.xl }} /> : null}

        <View style={styles.links}>
          <Text style={styles.link} onPress={() => router.back()}>
            {t("changeNumber")}
          </Text>
          {left > 0 ? (
            <Text style={styles.muted}>{t("resendIn", { seconds: left })}</Text>
          ) : (
            <Text style={styles.link} onPress={resend}>
              {t("resend")}
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl },
  error: { color: colors.danger, marginTop: space.md, fontSize: font.small },
  links: { flexDirection: "row", justifyContent: "space-between", marginTop: space.xxl },
  link: { color: colors.primary, fontWeight: "600", fontSize: font.small, padding: space.xs },
  muted: { color: colors.muted, fontSize: font.small, padding: space.xs },
});
