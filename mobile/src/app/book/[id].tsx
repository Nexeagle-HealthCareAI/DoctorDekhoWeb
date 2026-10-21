import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../components/DoctorCard";
import { Banner, Button, Card, Chip, EmptyState, Label, Loading, Txt } from "../../components/ui";
import { effectiveFee, fetchAvailability } from "../../lib/api/doctors";
import { ApiError } from "../../lib/api/http";
import { bookAppointment, saveAppProfile } from "../../lib/api/patient";
import type { TimeWindow } from "../../lib/api/types";
import { useSession } from "../../lib/auth/session";
import { bookableDays, bookingReason, patientFromMember, patientFromProfile, relationLabel, TIME_WINDOWS, windowOpen } from "../../lib/booking";
import { dayChipParts, formatShortDate, istDateString, rupees } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { keys, useAppProfile, useDoctor, useFamily, useProfile } from "../../lib/queries";
import { specialtyName } from "../../lib/specialties";
import { colors, font, radius, space } from "../../lib/theme";

const ME = "me";

/**
 * One-screen booking. Everything is pre-chosen from the saved profile (nearest open day, usual time window,
 * usual patient), so the common case is a single tap on "Confirm booking".
 */
export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const { mobile } = useSession();
  const doctor = useDoctor(id);
  const profile = useProfile();
  const app = useAppProfile();
  const family = useFamily();

  const days = useMemo(() => bookableDays(7), []);
  const [date, setDate] = useState(days[0]);
  const [window, setWindow] = useState<TimeWindow | null>(null);
  const [who, setWho] = useState<string>(ME);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref?: string | null; date: string } | null>(null);

  // Pre-select the usual window and patient once the app profile arrives.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || app.isLoading || family.isLoading) return;
    const members = family.data?.members ?? [];
    if (app.data?.defaultMemberId && members.some((m) => m.memberId === app.data!.defaultMemberId)) setWho(app.data.defaultMemberId);
    setWindow(app.data?.preferredTimeWindow ?? null);
    setSeeded(true);
  }, [seeded, app.isLoading, app.data, family.isLoading, family.data]);

  const availability = useQuery({
    queryKey: ["availability", id, date],
    queryFn: () => fetchAvailability(id, date),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
  const dayClosed = availability.data ? !availability.data.isAvailable : false;

  // The usual window may already be over today: fall forward to the next open one.
  const openWindows = TIME_WINDOWS.filter((w) => windowOpen(w, date));
  const chosenWindow = openWindows.find((w) => w.id === window);
  useEffect(() => {
    if (window && !chosenWindow && openWindows.length) setWindow(openWindows[0].id);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const members = family.data?.members ?? [];
  const member = who === ME ? undefined : members.find((m) => m.memberId === who);
  const patient = member ? patientFromMember(member, profile.data) : profile.data ? patientFromProfile(profile.data) : undefined;
  const patientReady = !!patient?.fullName && patient.age != null && !!patient.sex;

  async function confirm() {
    if (!doctor.data || !patient || !mobile) return;
    setBusy(true);
    setError(null);
    try {
      const res = await bookAppointment({
        doctorId: doctor.data.id,
        patient: { ...patient, mobile },
        preferredDate: date,
        preferredTime: chosenWindow?.start,
        reason: bookingReason(reason, chosenWindow),
        utmCampaign: "doctordekho-app",
      });
      if (!res.success) throw new ApiError(res.message || t("retry"), 400, res);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone({ ref: res.appointmentId, date });
      // Remember the choices so the next booking is pre-filled the same way.
      void saveAppProfile({
        lastDoctorId: doctor.data.id,
        ...(chosenWindow ? { preferredTimeWindow: chosenWindow.id } : {}),
        ...(member ? { defaultMemberId: member.memberId } : { clearDefaultMember: true }),
      })
        .then((a) => a && qc.setQueryData(keys.appProfile, a))
        .catch(() => {});
      void qc.invalidateQueries({ queryKey: keys.appointments });
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e instanceof ApiError && !e.isNetwork ? e.message : t("retry"));
    } finally {
      setBusy(false);
    }
  }

  if (doctor.isLoading && !doctor.data) return <Loading />;
  const d = doctor.data;
  if (!d) return <EmptyState icon="person-remove" title={t("doctorNotFound")} action={t("backHome")} onAction={() => router.dismissAll()} />;

  if (done) {
    return (
      <SafeAreaView style={styles.doneWrap}>
        <Stack.Screen options={{ title: "", headerShown: false }} />
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <Txt variant="title" style={{ textAlign: "center", marginTop: space.lg }}>
          {t("bookedTitle")}
        </Txt>
        <Txt variant="bodyBold" style={{ textAlign: "center", marginTop: space.sm }}>
          {`${d.name} · ${formatShortDate(done.date, locale)}`}
        </Txt>
        <Txt color={colors.muted} style={{ textAlign: "center", marginTop: space.sm }}>
          {t("bookedBody", { hospital: d.hospitalName ?? d.name, mobile: mobile ?? "" })}
        </Txt>
        {done.ref ? (
          <Txt variant="tiny" color={colors.faint} style={{ textAlign: "center", marginTop: space.md }}>
            {t("bookingRef", { ref: done.ref.slice(0, 8).toUpperCase() })}
          </Txt>
        ) : null}
        <View style={{ alignSelf: "stretch", gap: space.sm, marginTop: space.xxl }}>
          <Button
            label={t("viewBookings")}
            onPress={() => {
              router.dismissAll();
              router.navigate("/appointments");
            }}
          />
          <Button label={t("backHome")} variant="secondary" onPress={() => router.dismissAll()} />
        </View>
      </SafeAreaView>
    );
  }

  const fee = effectiveFee(d);

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t("bookAppointment") }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.docRow}>
            <Avatar doctor={d} size={48} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Txt variant="bodyBold" numberOfLines={1}>
                {d.name}
              </Txt>
              <Txt variant="small" color={colors.muted} numberOfLines={1}>
                {[specialtyName(d.specialtyId, locale), d.hospitalName].filter(Boolean).join(" · ")}
              </Txt>
            </View>
            {fee != null ? <Txt variant="bodyBold">{rupees(fee)}</Txt> : null}
          </View>

          <Label>{t("whichDay")}</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {days.map((day, i) => {
              const p = dayChipParts(day, locale);
              const label = day === istDateString() ? t("today") : day === istDateString(1) ? t("tomorrow") : p.weekday;
              const selected = day === date;
              return (
                <Pressable
                  key={day}
                  onPress={() => setDate(day)}
                  style={[styles.day, selected && styles.daySelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`day-${i}`}
                >
                  <Txt variant="tiny" color={selected ? "#fff" : colors.muted} style={{ fontWeight: "600" }}>
                    {label}
                  </Txt>
                  <Txt variant="heading" color={selected ? "#fff" : colors.ink}>
                    {p.day}
                  </Txt>
                  <Txt variant="tiny" color={selected ? "#E6F4F1" : colors.muted}>
                    {p.month}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
          {availability.isFetching && !availability.data ? (
            <Txt variant="small" color={colors.muted}>
              {t("checkingDay")}
            </Txt>
          ) : dayClosed ? (
            <Banner tone="warning" icon="alert-circle" text={t("notAvailableOnDay")} />
          ) : null}

          <Label>{t("whatTime")}</Label>
          <View style={styles.wrap}>
            {openWindows.map((w) => (
              <Chip
                key={w.id}
                label={t(w.key)}
                sublabel={w.range}
                icon={w.icon}
                selected={window === w.id}
                onPress={() => setWindow(window === w.id ? null : w.id)}
                style={{ flexBasis: "47%", flexGrow: 1 }}
              />
            ))}
          </View>

          <Label>{t("bookingFor")}</Label>
          <View style={styles.wrap}>
            <Chip label={profile.data?.firstName ? `${t("me")} · ${profile.data.firstName}` : t("me")} selected={who === ME} onPress={() => setWho(ME)} />
            {members.map((m) => (
              <Chip key={m.memberId} label={m.firstName} sublabel={relationLabel(t, m.relation)} selected={who === m.memberId} onPress={() => setWho(m.memberId)} />
            ))}
            <Chip label={t("addFamily")} icon="person-add" onPress={() => router.push("/profile/member")} />
          </View>

          {patient && !patientReady ? (
            <Card onPress={() => router.push(member ? { pathname: "/profile/member", params: { id: member.memberId } } : "/profile/about")}>
              <Banner tone="warning" icon="person" text={t("completeProfileFirst")} />
            </Card>
          ) : null}

          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t("reasonPlaceholder")}
            placeholderTextColor={colors.faint}
            style={styles.reason}
            maxLength={200}
            multiline
          />

          {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={busy ? t("booking") : t("confirmBooking")}
            icon="checkmark-circle"
            loading={busy}
            disabled={!patientReady || dayClosed || !mobile}
            onPress={confirm}
          />
          <Txt variant="tiny" color={colors.muted} style={{ textAlign: "center", marginTop: space.sm }}>
            {t("payAtCounter")}
          </Txt>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  docRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: colors.line },
  day: { width: 64, minHeight: 76, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  reason: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: font.body,
    backgroundColor: colors.card,
    color: colors.ink,
    textAlignVertical: "top",
  },
  footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
  doneWrap: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: space.xl },
  doneIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
});
