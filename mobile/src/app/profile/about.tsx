import { useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { ProfileForm, type ProfileFormValues } from "../../components/ProfileForm";
import { Loading } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { saveProfile } from "../../lib/api/patient";
import { useI18n } from "../../lib/i18n";
import { keys, useProfile } from "../../lib/queries";
import { colors, space } from "../../lib/theme";

/** Edit the short profile (dbo.PatientAccountProfiles — the same record the website edits). */
export default function AboutScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const profile = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(v: ProfileFormValues) {
    setBusy(true);
    setError(null);
    try {
      const { remindersOptIn: _ignored, ...input } = v;
      const saved = await saveProfile(input);
      qc.setQueryData(keys.profile, saved);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError && !e.isNetwork ? e.message : t("retry"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: t("personalInfo") }} />
      <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
        {profile.isLoading ? (
          <Loading />
        ) : (
          <ProfileForm initial={profile.data} submitLabel={t("save")} busy={busy} serverError={error} onSubmit={submit} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
