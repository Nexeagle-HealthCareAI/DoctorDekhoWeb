import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Button, Chip, Txt } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { rescheduleAppointment } from "../../lib/api/patient";
import { useSession } from "../../lib/auth/session";
import { bookableDays } from "../../lib/booking";
import { formatShortDate, istDateString } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { keys } from "../../lib/queries";
import { colors, space } from "../../lib/theme";

/** Move a booking to another day (the hospital confirms the exact time again). */
export default function RescheduleScreen() {
  const { id, date: current, doctor } = useLocalSearchParams<{ id: string; date?: string; doctor?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const { mobile } = useSession();
  const days = bookableDays(14).filter((d) => d !== current);
  const [date, setDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!date || !mobile) return;
    setBusy(true);
    setError(null);
    try {
      const r = await rescheduleAppointment(id, mobile, date, "Rescheduled by patient in app");
      if (!r.success) throw new ApiError(r.message || t("retry"), 400, r);
      await qc.invalidateQueries({ queryKey: keys.appointments });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError && !e.isNetwork ? e.message : t("retry"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t("reschedule") }} />
      <ScrollView contentContainerStyle={styles.content}>
        {doctor ? <Txt variant="heading">{doctor}</Txt> : null}
        {current ? <Txt color={colors.muted}>{formatShortDate(current, locale)}</Txt> : null}
        <Txt variant="bodyBold" style={{ marginTop: space.md }}>
          {t("rescheduleTitle")}
        </Txt>
        <View style={styles.wrap}>
          {days.map((d) => (
            <Chip
              key={d}
              label={d === istDateString() ? t("today") : d === istDateString(1) ? t("tomorrow") : formatShortDate(d, locale)}
              selected={date === d}
              onPress={() => setDate(d)}
            />
          ))}
        </View>
        {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={t("reschedule")} icon="checkmark-circle" disabled={!date} loading={busy} onPress={save} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
});
