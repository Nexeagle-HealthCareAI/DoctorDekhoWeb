import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Banner, Button, Card, Chip, EmptyState, Loading, Txt } from "../../components/ui";
import { cancelAppointment, getAppointmentDocuments } from "../../lib/api/patient";
import type { MyAppointment } from "../../lib/api/types";
import { useSession } from "../../lib/auth/session";
import { formatShortDate, formatTime, istDateString } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { StringKey } from "../../lib/i18n/strings";
import { keys, useMyAppointments } from "../../lib/queries";
import { colors, radius, space } from "../../lib/theme";

type Kind = "pending" | "confirmed" | "cancelled" | "completed";

function kindOf(a: MyAppointment): Kind {
  const s = `${a.statusCode} ${a.status}`.toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("complet") || s.includes("closed") || s.includes("visited")) return "completed";
  if (s.includes("confirm")) return "confirmed";
  return "pending";
}

const STATUS: Record<Kind, { key: StringKey; fg: string; bg: string }> = {
  pending: { key: "statusPending", fg: colors.warning, bg: colors.warningSoft },
  confirmed: { key: "statusConfirmed", fg: colors.success, bg: colors.successSoft },
  cancelled: { key: "statusCancelled", fg: colors.danger, bg: colors.dangerSoft },
  completed: { key: "statusCompleted", fg: colors.primaryDark, bg: colors.primarySoft },
};

export default function AppointmentsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const q = useMyAppointments();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { upcoming, past } = useMemo(() => {
    const today = istDateString();
    const all = q.data?.appointments ?? [];
    const up = all
      .filter((a) => a.apptDate.slice(0, 10) >= today && (kindOf(a) === "pending" || kindOf(a) === "confirmed"))
      .sort((a, b) => a.apptDate.localeCompare(b.apptDate) || a.startAt.localeCompare(b.startAt));
    const upIds = new Set(up.map((a) => a.appointmentId));
    const pa = all.filter((a) => !upIds.has(a.appointmentId)).sort((a, b) => b.apptDate.localeCompare(a.apptDate));
    return { upcoming: up, past: pa };
  }, [q.data]);

  if (q.isLoading) return <Loading />;
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.tabs}>
        <Chip label={`${t("upcoming")}${upcoming.length ? ` (${upcoming.length})` : ""}`} selected={tab === "upcoming"} onPress={() => setTab("upcoming")} />
        <Chip label={t("past")} selected={tab === "past"} onPress={() => setTab("past")} />
      </View>
      {q.isError ? <Banner tone="warning" icon="cloud-offline" text={t("retry")} /> : null}
      <FlatList
        data={list}
        keyExtractor={(a) => a.appointmentId}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState icon="calendar-outline" title={t("noAppointments")} body={t("noAppointmentsHint")} action={t("findDoctor")} onAction={() => router.push("/doctors")} />
        }
        renderItem={({ item }) => <AppointmentCard a={item} canChange={tab === "upcoming"} />}
      />
    </View>
  );
}

function AppointmentCard({ a, canChange }: { a: MyAppointment; canChange: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const { mobile } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const kind = kindOf(a);
  const st = STATUS[kind];
  const date = formatShortDate(a.apptDate, locale);

  const docs = useQuery({
    queryKey: ["appt-docs", a.appointmentId],
    queryFn: () => getAppointmentDocuments(a.appointmentId),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  function cancel() {
    Alert.alert(t("cancelBooking"), t("cancelConfirm", { doctor: a.doctorName, date }), [
      { text: t("keepBooking"), style: "cancel" },
      {
        text: t("cancelBooking"),
        style: "destructive",
        onPress: async () => {
          if (!mobile) return;
          setBusy(true);
          try {
            const r = await cancelAppointment(a.appointmentId, mobile, "Cancelled by patient in app");
            if (!r.success) throw new Error(r.message ?? "");
            await qc.invalidateQueries({ queryKey: keys.appointments });
          } catch (e) {
            Alert.alert(t("cancelBooking"), (e as Error).message || t("retry"));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Card>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyBold">{a.doctorName}</Txt>
          <Txt variant="small" color={colors.muted}>
            {a.hospitalName}
          </Txt>
        </View>
        <View style={[styles.status, { backgroundColor: st.bg }]}>
          <Txt variant="tiny" color={st.fg} style={{ fontWeight: "700" }}>
            {t(st.key)}
          </Txt>
        </View>
      </View>
      <View style={styles.when}>
        <Ionicons name="calendar" size={16} color={colors.primary} />
        <Txt variant="smallBold" style={{ marginLeft: 6 }}>
          {[date, formatTime(a.startAt)].filter(Boolean).join(" · ")}
        </Txt>
      </View>

      {canChange ? (
        <View style={styles.actions}>
          <Button
            label={t("reschedule")}
            variant="secondary"
            icon="swap-horizontal"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: "/reschedule/[id]", params: { id: a.appointmentId, date: a.apptDate.slice(0, 10), doctor: a.doctorName } })}
          />
          <Button label={t("cancel")} variant="danger" icon="close-circle" style={{ flex: 1 }} loading={busy} onPress={cancel} />
        </View>
      ) : null}

      <Pressable onPress={() => setOpen((o) => !o)} style={styles.docsToggle} accessibilityRole="button">
        <Ionicons name="document-text" size={18} color={colors.primary} />
        <Txt variant="smallBold" color={colors.primaryDark} style={{ flex: 1, marginLeft: 6 }}>
          {t("documents")}
        </Txt>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        docs.isLoading ? (
          <Txt variant="small" color={colors.muted}>
            {t("loading")}
          </Txt>
        ) : docs.data?.documents?.length ? (
          docs.data.documents.map((doc) => (
            <Pressable
              key={doc.attachmentId}
              onPress={() => doc.storageUrl && void Linking.openURL(doc.storageUrl)}
              style={styles.doc}
              accessibilityRole="link"
            >
              <Ionicons name="attach" size={18} color={colors.muted} />
              <Txt variant="small" style={{ flex: 1, marginLeft: 6 }} numberOfLines={1}>
                {doc.fileName || doc.reportType || "Document"}
              </Txt>
              <Ionicons name="open-outline" size={16} color={colors.primary} />
            </Pressable>
          ))
        ) : (
          <Txt variant="small" color={colors.muted}>
            {t("noDocuments")}
          </Txt>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  status: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  when: { flexDirection: "row", alignItems: "center", marginTop: space.md },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  docsToggle: { flexDirection: "row", alignItems: "center", marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line, minHeight: 40 },
  doc: { flexDirection: "row", alignItems: "center", paddingVertical: space.sm, minHeight: 40 },
});
