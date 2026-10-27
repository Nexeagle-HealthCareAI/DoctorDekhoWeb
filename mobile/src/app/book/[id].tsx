import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import { Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DoctorAvatar } from "../../components/DoctorCard";
import { Confetti, PopIn, RiseIn } from "../../components/Motion";
import { Avatar, Banner, Button, Card, DateBlock, EmptyState, Loading, Logo, StepTitle, TopBar, Txt } from "../../components/ui";
import { effectiveFee, fetchAvailability, type Doctor } from "../../lib/api/doctors";
import { ApiError } from "../../lib/api/http";
import { bookAppointment, saveAppProfile } from "../../lib/api/patient";
import type { TimeWindow } from "../../lib/api/types";
import { useSession } from "../../lib/auth/session";
import { bookableDays, bookingReason, patientFromMember, patientFromProfile, REASONS, relationLabel, TIME_WINDOWS, windowOpen } from "../../lib/booking";
import { dayChipParts, formatShortDate, istDateString, rupees } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { localName } from "../../lib/translit";
import { staticMapUrl } from "../../lib/map";
import { keys, useAppProfile, useDoctor, useFamily, useProfile } from "../../lib/queries";
import { useReadAloud } from "../../lib/speech";
import { plainSpecialty } from "../../lib/specialties";
import { colors, radius, space, TINT_ORDER } from "../../lib/theme";

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
  const [reason, setReason] = useState<(typeof REASONS)[number]["id"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref?: string | null; date: string; windowLabel: string; patientName: string; start?: string } | null>(null);

  // Pre-select the usual window and patient once the app profile arrives.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || app.isLoading || family.isLoading) return;
    const members = family.data?.members ?? [];
    if (app.data?.defaultMemberId && members.some((m) => m.memberId === app.data!.defaultMemberId)) setWho(app.data.defaultMemberId);
    // No saved habit yet: start on the earliest window still open, so Confirm works with zero taps.
    setWindow(app.data?.preferredTimeWindow ?? TIME_WINDOWS.find((w) => windowOpen(w, days[0]))?.id ?? null);
    setSeeded(true);
  }, [seeded, app.isLoading, app.data, family.isLoading, family.data, days]);

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
    if (seeded && !chosenWindow && openWindows.length) setWindow(openWindows[0].id);
  }, [date, seeded, chosenWindow, openWindows.length]);

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
        reason: bookingReason(REASONS.find((r) => r.id === reason)?.en ?? "", chosenWindow),
        utmCampaign: "doctordekho-app",
      });
      if (!res.success) throw new ApiError(res.message || t("retry"), 400, res);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone({ ref: res.appointmentId, date, windowLabel: chosenWindow ? `${t(chosenWindow.key)} ${chosenWindow.range}` : "", patientName: patient.fullName, start: chosenWindow?.start.slice(0, 5) });
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

  if (doctor.isLoading && !doctor.data)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar back="close" />
        <Loading />
      </View>
    );
  const d = doctor.data;
  if (!d)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar back="close" />
        <EmptyState icon="person-remove" title={t("doctorNotFound")} action={t("backHome")} onAction={() => router.dismissAll()} />
      </View>
    );

  if (done) return <Booked doctor={d} date={done.date} windowLabel={done.windowLabel} patientName={done.patientName} reference={done.ref} mobile={mobile ?? ""} start={done.start} />;

  const fee = effectiveFee(d);
  const dayWord = (day: string) => (day === istDateString() ? t("today") : day === istDateString(1) ? t("tomorrow") : dayChipParts(day, locale).weekday);
  const whoName = member ? member.firstName : profile.data?.firstName || t("me");
  const summary = [dayWord(date) + (date !== istDateString() && date !== istDateString(1) ? ` ${dayChipParts(date, locale).day}` : ""), chosenWindow ? t(chosenWindow.key) : null, t("forName", { name: whoName })].filter(Boolean).join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar back="close" solid title={localName(d.name, locale)} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.docRow}>
          <DoctorAvatar doctor={d} size={44} />
          <Txt variant="small" color={colors.muted} style={{ flex: 1 }} numberOfLines={2}>
            {[plainSpecialty(d.specialtyId, locale), localName(d.hospitalName, locale)].filter(Boolean).join(" · ")}
          </Txt>
          {fee != null ? <Txt variant="subheading">{rupees(fee)}</Txt> : null}
        </View>

        <View>
          <StepTitle n={1}>{t("bookingFor")}</StepTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <Person name={profile.data?.firstName || t("me")} sub={t("me")} initials={(profile.data?.firstName || t("me"))[0]} tintIndex={0} on={who === ME} onPress={() => setWho(ME)} />
            {members.map((m, i) => (
              <Person key={m.memberId} name={m.firstName} sub={relationLabel(t, m.relation)} initials={m.firstName[0] ?? "?"} tintIndex={i + 1} on={who === m.memberId} onPress={() => setWho(m.memberId)} />
            ))}
            <Pressable onPress={() => router.push("/profile/member")} accessibilityRole="button" accessibilityLabel={t("addMember")} style={[styles.person, styles.addPerson]}>
              <Ionicons name="add" size={24} color={colors.primary} />
              <Txt variant="smallBold" color={colors.primary}>
                {t("add")}
              </Txt>
            </Pressable>
          </ScrollView>
          {patient && !patientReady ? (
            <Card onPress={() => router.push(member ? { pathname: "/profile/member", params: { id: member.memberId } } : "/profile/about")} style={{ marginTop: space.md, padding: 0, borderWidth: 0 }}>
              <Banner tone="warning" icon="person" text={t("completeProfileFirst")} />
            </Card>
          ) : null}
        </View>

        <View>
          <StepTitle n={2}>{t("whichDay")}</StepTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {days.map((day) => {
              const p = dayChipParts(day, locale);
              const on = day === date;
              return (
                <Pressable
                  key={day}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDate(day);
                  }}
                  style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && { transform: [{ scale: 0.95 }] }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${dayWord(day)} ${p.day} ${p.month}`}
                >
                  <Txt variant="tinyBold" color={on ? "#fff" : colors.muted} numberOfLines={1}>
                    {dayWord(day)}
                  </Txt>
                  <Txt variant="title" color={on ? "#fff" : colors.ink} style={{ lineHeight: 30 }}>
                    {p.day}
                  </Txt>
                  <Txt variant="tiny" color={on ? colors.primaryOnDark : colors.muted}>
                    {p.month}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
          {availability.isFetching && !availability.data ? (
            <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm }}>
              {t("checkingDay")}
            </Txt>
          ) : dayClosed ? (
            <View style={{ marginTop: space.sm }}>
              <Banner tone="warning" icon="alert-circle" text={t("notAvailableOnDay")} />
            </View>
          ) : null}
        </View>

        <View>
          <StepTitle n={3}>{t("whatTime")}</StepTitle>
          <View style={styles.windows}>
            {/* Every window stays visible; ones already over today say so plainly. Nothing is ever shown as "almost full". */}
            {TIME_WINDOWS.map((w) => {
              const over = !windowOpen(w, date);
              const on = !over && window === w.id;
              return (
                <Pressable
                  key={w.id}
                  disabled={over}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setWindow(w.id);
                  }}
                  style={({ pressed }) => [styles.window, on && styles.windowOn, over && styles.windowOver, pressed && { transform: [{ scale: 0.96 }] }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: over }}
                >
                  <Ionicons name={w.icon} size={22} color={over ? colors.faint : on ? "#fff" : colors.primary} />
                  <View style={{ marginLeft: 10 }}>
                    <Txt variant="bodyBold" color={over ? colors.muted : on ? "#fff" : colors.ink}>
                      {t(w.key)}
                    </Txt>
                    <Txt variant="small" color={over ? colors.muted : on ? colors.primaryOnDark : colors.muted} style={{ fontSize: 13 }}>
                      {over ? t("overForToday") : w.range}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Txt variant="small" color={colors.muted} style={{ marginTop: space.sm, fontSize: 13 }}>
            {t("hospitalFixesTime")}
          </Txt>
        </View>

        <View>
          <Txt variant="bodyBold" style={{ fontSize: 15, marginBottom: space.sm }}>
            {t("reasonTitle")}{" "}
            <Txt variant="small" color={colors.muted}>
              {t("reasonHint")}
            </Txt>
          </Txt>
          <View style={styles.reasons}>
            {REASONS.map((r) => {
              const on = reason === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setReason(on ? null : r.id);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.reason, on && styles.reasonOn, pressed && { transform: [{ scale: 0.95 }] }]}
                >
                  {on ? <Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: 4 }} /> : null}
                  <Txt variant="smallBold" color={on ? "#fff" : colors.ink} style={{ fontSize: 15 }}>
                    {t(r.key)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <View style={styles.summary}>
          <Ionicons name="checkmark" size={18} color={colors.primary} />
          <Txt variant="bodyBold" style={{ flex: 1, marginLeft: space.sm, fontSize: 15 }} numberOfLines={2}>
            {summary}
          </Txt>
        </View>
        <Button label={busy ? t("booking") : t("sendRequest")} icon={busy ? undefined : "paper-plane"} loading={busy} disabled={!patientReady || dayClosed || !mobile} onPress={confirm} />
        <Txt variant="small" color={colors.muted} center style={{ marginTop: space.sm, fontSize: 13 }}>
          {fee != null ? t("payAtCounterFee", { fee: rupees(fee) }) : t("payAtCounter")}
        </Txt>
      </SafeAreaView>
    </View>
  );
}

function Person({ name, sub, initials, tintIndex, on, onPress }: { name: string; sub: string; initials: string; tintIndex: number; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${name}, ${sub}`}
      style={[styles.person, on && styles.personOn]}
    >
      <Avatar initials={initials.toUpperCase()} tint={TINT_ORDER[tintIndex % TINT_ORDER.length]} size={40} />
      <Txt variant="smallBold" numberOfLines={1}>
        {name}
      </Txt>
      <Txt variant="tiny" color={colors.muted} numberOfLines={1}>
        {sub}
      </Txt>
    </Pressable>
  );
}

/**
 * After booking: a short celebration (one burst of confetti and a tick that pops in — none of it with reduce motion),
 * then the visit as a ticket with a mini map that opens the route, what happens next, and Listen / Send to family.
 * It still says plainly that the hospital will call to confirm the time.
 */
function Booked({ doctor, date, windowLabel, patientName, reference, mobile, start }: { doctor: Doctor; date: string; windowLabel: string; patientName: string; reference?: string | null; mobile: string; start?: string }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const { width } = useWindowDimensions();
  const { speaking, toggle } = useReadAloud(locale);
  const fee = effectiveFee(doctor);
  const when = [formatShortDate(date, locale), windowLabel].filter(Boolean).join(", ");
  const spoken = t("bookedSpoken", { doctor: doctor.name, when, hospital: doctor.hospitalName ?? "", name: patientName });
  const steps = [
    t("nextStepCall", { mobile: mobile ? `+91 ${mobile}` : "" }),
    t("nextStepReminder"),
    fee != null ? t("nextStepPayFee", { fee: rupees(fee) }) : t("nextStepPay"),
  ];
  const clinic = doctor.latitude != null && doctor.longitude != null ? { lat: doctor.latitude, lng: doctor.longitude } : null;
  const mini = clinic ? staticMapUrl({ center: clinic, zoom: 14, width: 72, height: 52, pins: [{ ...clinic, color: "#C2410C" }] }) : null;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.ticketTop}>
          <Pressable onPress={() => router.dismissAll()} accessibilityRole="button" accessibilityLabel={t("close")} style={styles.ticketClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Logo height={36} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg + 2 }}>
        <View style={{ alignItems: "center", gap: space.sm }}>
          <PopIn delay={120}>
            <View style={styles.tick}>
              <Ionicons name="checkmark" size={46} color={colors.primary} />
            </View>
          </PopIn>
          <Txt variant="display" color="#fff" center style={{ marginTop: space.sm }}>
            {t("bookedTitle")}
          </Txt>
          <Txt color="#DDF1ED" center>
            {t("bookedSubtitle")}
          </Txt>
        </View>

        <RiseIn delay={250} style={styles.ticket}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md + 2, padding: space.lg }}>
            <DateBlock date={date} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="subheading" numberOfLines={1}>
                {localName(doctor.name, locale)}
              </Txt>
              <Txt variant="small" color={colors.muted}>
                {[windowLabel, t("forName", { name: patientName })].filter(Boolean).join(" · ")}
              </Txt>
            </View>
          </View>
          <View style={styles.perf}>
            <View style={[styles.notch, { left: -12 }]} />
            <View style={styles.perfLine} />
            <View style={[styles.notch, { right: -12 }]} />
          </View>
          <Pressable
            onPress={() => router.push({ pathname: "/route/[id]", params: { id: doctor.id, date, start: start ?? "" } })}
            accessibilityRole="button"
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, paddingTop: space.md }, pressed && { backgroundColor: colors.bg }]}
          >
            {mini ? (
              <Image source={{ uri: mini }} style={styles.miniMap} contentFit="cover" cachePolicy="disk" accessible={false} />
            ) : (
              <View style={[styles.miniMap, { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }]}>
                <Ionicons name="navigate" size={22} color={colors.primaryDark} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="bodyBold" numberOfLines={1}>
                {doctor.hospitalName ? localName(doctor.hospitalName, locale) : t("directions")}
              </Txt>
              <Txt variant="small" color={colors.muted} numberOfLines={1}>
                {[doctor.city, t("seeRoute")].filter(Boolean).join(" · ")}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </RiseIn>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button label={speaking ? t("stop") : t("listen")} icon={speaking ? "stop" : "volume-high"} variant="onDarkSoft" size="md" style={{ flex: 1 }} onPress={() => toggle(spoken)} />
          <Button label={t("sendToFamily")} icon="logo-whatsapp" variant="onDarkSoft" size="md" style={{ flex: 1 }} onPress={() => void Share.share({ message: t("shareBooking", { doctor: doctor.name, when, hospital: doctor.hospitalName ?? "", name: patientName }) })} />
        </View>

        <View style={{ gap: space.md }}>
          <Txt variant="subheading" color="#fff">
            {t("whatNext")}
          </Txt>
          {steps.map((s, i) => (
            <View key={i} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
              <View style={[styles.stepNum, { backgroundColor: i === 0 ? "#fff" : "rgba(255,255,255,0.16)" }]}>
                <Txt variant="smallBold" color={i === 0 ? colors.primaryDark : "#fff"}>
                  {i + 1}
                </Txt>
              </View>
              <Txt color="#fff" style={{ flex: 1, paddingTop: 4, fontSize: 15 }}>
                {s}
              </Txt>
            </View>
          ))}
        </View>

        {reference ? (
          <Txt variant="tiny" color="#CDEBE6" center selectable>
            {t("bookingRef", { ref: reference.slice(0, 8).toUpperCase() })}
          </Txt>
        ) : null}
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={{ padding: space.lg, paddingTop: space.sm, gap: 10 }}>
        <Button
          label={t("viewBookings")}
          variant="onDark"
          onPress={() => {
            router.dismissAll();
            router.navigate("/appointments");
          }}
        />
        <Button label={t("backHome")} variant="onDarkSoft" size="md" onPress={() => router.dismissAll()} />
      </SafeAreaView>
      <Confetti width={width} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl - 2, paddingBottom: space.xl },
  docRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  day: { width: 66, minHeight: 80, borderRadius: radius.lg - 2, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  windows: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  window: { flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", minHeight: 64, paddingHorizontal: space.md + 2, borderRadius: radius.lg - 2, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.card },
  windowOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  windowOver: { backgroundColor: colors.segment, borderColor: colors.line },
  person: { width: 92, alignItems: "center", gap: 4, paddingVertical: space.md, paddingHorizontal: 4, borderRadius: radius.lg - 2, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.card },
  personOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  addPerson: { borderStyle: "dashed", justifyContent: "center", borderColor: "#B9C3BC" },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  reason: { flexDirection: "row", alignItems: "center", minHeight: 46, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.card, justifyContent: "center" },
  reasonOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  footer: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: space.lg, paddingTop: space.md, gap: 10 },
  summary: { flexDirection: "row", alignItems: "center", minHeight: 24 },
  tick: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  ticketTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingVertical: space.sm },
  ticketClose: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  ticket: { backgroundColor: "#fff", borderRadius: 24, overflow: "hidden", elevation: 8, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
  perf: { height: 24, justifyContent: "center", marginHorizontal: space.lg },
  perfLine: { borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.lineStrong },
  notch: { position: "absolute", top: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, marginHorizontal: -space.lg },
  miniMap: { width: 72, height: 52, borderRadius: 12, overflow: "hidden", backgroundColor: "#ECEFE7" },
  stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
});
