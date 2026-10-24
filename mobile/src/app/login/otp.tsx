import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState, StyleSheet, Text, View } from "react-native";
import { KeyboardScreen } from "../../components/KeyboardScreen";
import { LiveDot, PopIn } from "../../components/Motion";
import { OtpInput } from "../../components/OtpInput";
import { Button, Card, TopBar, Txt } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { sendOtp, verifyOtp } from "../../lib/api/patient";
import { useSession } from "../../lib/auth/session";
import { useI18n } from "../../lib/i18n";
import { colors, space } from "../../lib/theme";

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
  const [verified, setVerified] = useState(false);
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
      setVerified(true);
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
      else if (res.devCode) Alert.alert("Dev only", `Your OTP is ${res.devCode}`);   // Development API only, see login/index.tsx
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("retry"));
    }
  }

  // Opened without a number (a cold start signed out lands on the first open screen): go to the number screen.
  if (!mobile) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar />
      <KeyboardScreen contentContainerStyle={styles.content}>
          <Txt variant="display">{t("otpTitle")}</Txt>
          <Txt color={colors.muted} style={{ marginTop: space.sm, marginBottom: space.xl }}>
            {t("otpSentTo", { mobile })}{" "}
            <Txt variant="bodyBold" color={colors.primary}>
              <Text onPress={() => router.back()}>{t("changeNumber")}</Text>
            </Txt>
          </Txt>

          <View style={styles.steps} accessibilityLabel={t("codeStatus")}>
            <Step done label={t("stepSent")} />
            <Step done={verified} busy={busy} label={verified ? t("stepChecked") : busy ? t("verifying") : t("stepWaiting")} />
          </View>

          <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={verify} error={!!error} />
          {error ? (
            <Txt variant="smallBold" color={colors.danger} style={{ marginTop: space.md }}>
              {error}
            </Txt>
          ) : null}

          {verified ? (
            <View style={styles.ok} accessibilityLiveRegion="polite">
              <PopIn>
                <View style={styles.okTick}>
                  <Ionicons name="checkmark" size={24} color="#fff" />
                </View>
              </PopIn>
              <Txt variant="bodyBold" color={colors.success} style={{ flex: 1 }}>
                {t("codeRight")}
              </Txt>
            </View>
          ) : busy ? (
            <Button label={t("verifying")} onPress={() => {}} loading style={{ marginTop: space.xl }} />
          ) : code.length < 6 ? (
            <Button label={t("pasteCode")} variant="secondary" icon="clipboard-outline" onPress={pasteFromClipboard} style={{ marginTop: space.xl }} accessibilityLabel={hasClip ? t("pasteCode") : t("pasteCode")} />
          ) : null}

          <Card style={{ marginTop: space.xl }}>
            <Txt variant="bodyBold" style={{ fontSize: 15 }}>
              {t("otpWhereTitle")}
            </Txt>
            <Txt variant="small" color={colors.muted} style={{ marginTop: space.xs }}>
              {t("otpWhereBody")}
            </Txt>
          </Card>

          <View style={{ alignItems: "center", marginTop: space.xl }}>
            {left > 0 ? (
              <Txt color={colors.muted}>{t("resendIn", { seconds: left })}</Txt>
            ) : (
              <Button label={t("resend")} variant="ghost" size="md" icon="refresh" onPress={resend} />
            )}
          </View>
      </KeyboardScreen>
    </View>
  );
}

/** One honest status chip: green with a tick when done, amber while it waits on the patient. */
function Step({ label, done, busy }: { label: string; done: boolean; busy?: boolean }) {
  return (
    <View style={[styles.step, { backgroundColor: done ? colors.successSoft : colors.warningSoft }]}>
      {done ? <Ionicons name="checkmark" size={14} color={colors.success} /> : busy ? null : <LiveDot size={8} color={colors.warning} />}
      <Txt variant="tinyBold" color={done ? colors.success : colors.warning} style={{ marginLeft: 6, fontSize: 13 }}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.md },
  steps: { flexDirection: "row", gap: space.sm, marginBottom: space.lg },
  step: { flexDirection: "row", alignItems: "center", minHeight: 32, paddingHorizontal: 12, borderRadius: 16 },
  ok: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, padding: space.md + 2, borderRadius: 18, backgroundColor: colors.successSoft },
  okTick: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
});
