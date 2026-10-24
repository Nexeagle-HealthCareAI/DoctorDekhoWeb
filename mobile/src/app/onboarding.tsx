import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { ProfileForm, type ProfileFormValues } from "../components/ProfileForm";
import { Loading, TopBar, Txt } from "../components/ui";
import { ApiError } from "../lib/api/http";
import { saveAppProfile, saveProfile } from "../lib/api/patient";
import { useSession } from "../lib/auth/session";
import { syncDevice } from "../lib/device";
import { useI18n } from "../lib/i18n";
import { toServerLanguage } from "../lib/i18n/types";
import { keys, useProfile } from "../lib/queries";
import { colors, space } from "../lib/theme";

/** Shown once, right after the first sign-in: three fields, then straight to Home. */
export default function OnboardingScreen() {
  const { t, locale } = useI18n();
  const { markProfileComplete } = useSession();
  const qc = useQueryClient();
  const profile = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(v: ProfileFormValues) {
    setBusy(true);
    setError(null);
    try {
      const { remindersOptIn, ...input } = v;
      const saved = await saveProfile(input);
      qc.setQueryData(keys.profile, saved);
      const app = await saveAppProfile({ preferredLanguage: toServerLanguage(locale), remindersOptIn, onboardingCompleted: true });
      if (app) qc.setQueryData(keys.appProfile, app);
      if (remindersOptIn) void syncDevice(true);
      markProfileComplete();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("retry"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar back={false} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Txt variant="smallBold" color={colors.primary}>
            {t("aboutYouEyebrow")}
          </Txt>
          <Txt variant="display" style={{ marginTop: space.xs }}>{t("aboutYouTitle")}</Txt>
          <Txt color={colors.muted} style={{ marginTop: space.xs, marginBottom: space.xl }}>
            {t("aboutYouHint")}
          </Txt>
          {profile.isLoading ? (
            <Loading />
          ) : (
            <ProfileForm initial={profile.data} showReminders submitLabel={t("startUsing")} busy={busy} serverError={error} onSubmit={submit} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.sm },
});
