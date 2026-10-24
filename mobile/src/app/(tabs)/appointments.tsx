import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DoctorAvatar } from "../../components/DoctorCard";
import { Banner, Card, DateBlock, EmptyState, Loading, Logo, Segmented, Txt, type IconName } from "../../components/ui";
import type { Doctor } from "../../lib/api/doctors";
import { cancelAppointment, getAppointmentDocuments } from "../../lib/api/patient";
import type { MyAppointment } from "../../lib/api/types";
import { useSession } from "../../lib/auth/session";
import { formatShortDate, formatTime, istDateString } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { StringKey } from "../../lib/i18n/strings";
import { visitKind, type VisitKind } from "../../lib/booking";
import { keys, useDoctors, useMyAppointments } from "../../lib/queries";
import { openDirections } from "../../lib/support";
import { colors, radius, space } from "../../lib/theme";

type Kind = VisitKind;
const kindOf = visitKind;

const STATUS: Record<Kind, { key: StringKey; fg: string; bg: string; icon: IconName }> = {
  pending: { key: "statusWaitingCall", fg: colors.warning, bg: colors.warningSoft, icon: "call-outline" },
  confirmed: { key: "statusConfirmed", fg: colors.success, bg: colors.successSoft, icon: "checkmark-circle-outline" },
  cancelled: { key: "statusCancelled", fg: colors.danger, bg: colors.dangerSoft, icon: "close-circle-outline" },
  completed: { key: "statusCompleted", fg: colors.primaryDark, bg: colors.primarySoft, icon: "checkmark-done-outline" },
};

/** My bookings: the upcoming visit as a big card with its three actions; past visits as a short list with "Book again". */
export default function AppointmentsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const q = useMyAppointments();
  const doctors = useDoctors();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { upcoming, past } = useMemo(() => {
    const today = istDateString();
    const all = q.data?.appointments ?? [];
    const up = all
      .filter((a) => a.apptDate.slice(0, 10) >= today && (kindOf(a) === "pending" || kindOf(a) === "confirmed"))
      .sort((a, b) => a.apptDate.localeCompare(b.apptDate) || a.startAt.localeCompare(b.startAt));
    const upIds = new Set(up.map((a) => a.appointmentId));
    return { upcoming: up, past: all.filter((a) => !upIds.has(a.appointmentId)).sort((a, b) => b.apptDate.localeCompare(a.apptDate)) };
  }, [q.data]);

  // Bookings carry the doctor's name only; match it in the directory for Book again, Directions and the photo.
  const byName = useMemo(() => new Map((doctors.data ?? []).map((d) => [d.name, d])), [doctors.data]);
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Txt variant="display" style={{ flex: 1 }}>
            {t("myBookings")}
          </Txt>
          <Logo height={30} />
        </View>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "upcoming", label: upcoming.length ? `${t("upcoming")} · ${upcoming.length}` : t("upcoming") },
            { value: "past", label: t("past") },
          ]}
        />
      </View>
      {q.isError ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <Banner tone="warning" icon="cloud-offline" text={t("couldNotLoad")} />
        </View>
      ) : null}
      {q.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(a) => a.appointmentId}
          contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title={t("noAppointments")} body={t("noAppointmentsHint")} action={t("findDoctor")} onAction={() => router.push("/doctors")} />}
          renderItem={({ item }) =>
            tab === "upcoming" ? <UpcomingCard a={item} doctor={byName.get(item.doctorName)} /> : <PastRow a={item} doctor={byName.get(item.doctorName)} />
          }
        />
      )}
    </SafeAreaView>
  );
}

function UpcomingCard({ a, doctor }: { a: MyAppointment; doctor?: Doctor }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const { mobile } = useSession();
  const [busy, setBusy] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const kind = kindOf(a);
  const st = STATUS[kind];
  const time = formatTime(a.startAt);

  const docs = useQuery({ queryKey: ["appt-docs", a.appointmentId], queryFn: () => getAppointmentDocuments(a.appointmentId), enabled: docsOpen, staleTime: 5 * 60 * 1000 });

  function cancel() {
    Alert.alert(t("cancelBooking"), t("cancelConfirm", { doctor: a.doctorName, date: formatShortDate(a.apptDate, locale) }), [
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
    <Card style={{ gap: space.md + 2, borderRadius: radius.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md + 2 }}>
        <View style={{ backgroundColor: colors.primary, borderRadius: radius.md }}>
          <DateBlock date={a.apptDate} dark />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="subheading" numberOfLines={1}>
            {a.doctorName}
          </Txt>
          {time ? (
            <Txt variant="small" color={colors.muted}>
              {time}
            </Txt>
          ) : null}
          <Txt variant="small" color={colors.muted} numberOfLines={1}>
            {a.hospitalName}
          </Txt>
        </View>
      </View>

      <View style={[styles.status, { backgroundColor: st.bg }]}>
        <Ionicons name={st.icon} size={18} color={st.fg} />
        <Txt variant="smallBold" color={st.fg} style={{ marginLeft: space.sm, flex: 1 }}>
          {t(st.key)}
        </Txt>
      </View>

      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Action icon="navigate" label={t("directions")} onPress={() => openDirections({ lat: doctor?.latitude, lng: doctor?.longitude, query: [a.hospitalName, doctor?.city].filter(Boolean).join(", ") })} />
        <Action icon="calendar" label={t("reschedule")} onPress={() => router.push({ pathname: "/reschedule/[id]", params: { id: a.appointmentId, date: a.apptDate.slice(0, 10), doctor: a.doctorName } })} />
        <Action icon="close-circle" label={t("cancel")} danger busy={busy} onPress={cancel} />
      </View>

      <Pressable onPress={() => setDocsOpen((o) => !o)} style={styles.docsToggle} accessibilityRole="button" accessibilityState={{ expanded: docsOpen }}>
        <Ionicons name="document-text-outline" size={18} color={colors.primary} />
        <Txt variant="smallBold" color={colors.primaryDark} style={{ flex: 1, marginLeft: 6 }}>
          {t("documents")}
        </Txt>
        <Ionicons name={docsOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {docsOpen ? <Documents loading={docs.isLoading} list={docs.data?.documents ?? []} /> : null}
    </Card>
  );
}

function Documents({ loading, list }: { loading: boolean; list: { attachmentId: string; fileName?: string | null; reportType?: string | null; storageUrl?: string | null }[] }) {
  const { t } = useI18n();
  if (loading)
    return (
      <Txt variant="small" color={colors.muted}>
        {t("loading")}
      </Txt>
    );
  if (!list.length)
    return (
      <Txt variant="small" color={colors.muted}>
        {t("noDocuments")}
      </Txt>
    );
  return (
    <View>
      {list.map((doc) => (
        <Pressable key={doc.attachmentId} onPress={() => doc.storageUrl && void Linking.openURL(doc.storageUrl)} style={styles.doc} accessibilityRole="link">
          <Ionicons name="attach" size={18} color={colors.muted} />
          <Txt variant="small" style={{ flex: 1, marginLeft: 6 }} numberOfLines={1}>
            {doc.fileName || doc.reportType || t("document")}
          </Txt>
          <Ionicons name="open-outline" size={16} color={colors.primary} />
        </Pressable>
      ))}
    </View>
  );
}

function Action({ icon, label, onPress, danger, busy }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; busy?: boolean }) {
  const fg = danger ? colors.danger : colors.primaryDark;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft, opacity: busy ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      <Ionicons name={icon} size={21} color={fg} />
      <Txt variant="tinyBold" color={fg} center numberOfLines={1} style={{ fontSize: 13, marginTop: 3 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function PastRow({ a, doctor }: { a: MyAppointment; doctor?: Doctor }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const st = STATUS[kindOf(a)];
  return (
    <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md + 2 }}>
      {doctor ? <DoctorAvatar doctor={doctor} size={44} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyBold" numberOfLines={1} style={{ fontSize: 15 }}>
          {a.doctorName}
        </Txt>
        <Txt variant="small" color={colors.muted} numberOfLines={1} style={{ fontSize: 13 }}>
          {formatShortDate(a.apptDate, locale)} ·{" "}
          <Txt variant="small" color={st.fg} style={{ fontSize: 13 }}>
            {t(STATUS[kindOf(a)].key === "statusWaitingCall" ? "statusPending" : st.key)}
          </Txt>
        </Txt>
      </View>
      {doctor ? (
        <Pressable onPress={() => router.push(`/book/${doctor.id}`)} style={styles.again} accessibilityRole="button" accessibilityLabel={`${t("bookAgain")} ${a.doctorName}`}>
          <Txt variant="smallBold" color={colors.primary}>
            {t("bookAgain")}
          </Txt>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  status: { flexDirection: "row", alignItems: "center", borderRadius: radius.md - 2, paddingVertical: 10, paddingHorizontal: space.md },
  action: { flex: 1, minHeight: 64, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  docsToggle: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: space.md, minHeight: 40 },
  doc: { flexDirection: "row", alignItems: "center", paddingVertical: space.sm, minHeight: 44 },
  again: { minHeight: 48, paddingHorizontal: space.md + 2, borderRadius: radius.md - 2, borderWidth: 1.5, borderColor: colors.primary, justifyContent: "center" },
});
