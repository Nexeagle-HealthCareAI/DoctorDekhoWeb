import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AfterVisitCard, BringList, FamilyChips, Journey, OtherVisits } from "../../components/CareCards";
import { CityPicker } from "../../components/CityPicker";
import { DoctorAvatar, DoctorCard } from "../../components/DoctorCard";
import { LanguageLink } from "../../components/LanguagePicker";
import { MapPreview } from "../../components/MapPreview";
import { Banner, Button, HelpButton, IconCircle, Loading, Logo, SectionHeader, Txt } from "../../components/ui";
import { distanceKm, effectiveFee, type Doctor } from "../../lib/api/doctors";
import type { MyAppointment } from "../../lib/api/types";
import { visitKind } from "../../lib/booking";
import { careState, journeyStep, leaveTime, otherUpcoming, useStoredSet, whoseVisit } from "../../lib/care";
import { formatShortDate, formatTime, istDateString } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { localName } from "../../lib/translit";
import { useHomePlace } from "../../lib/location";
import { hasLiveMap, hasMapImages, km, minutes, useQuietPosition, useRoutes, type LatLng } from "../../lib/map";
import { useAppProfile, useDoctors, useFamily, useMyAppointments, useProfile } from "../../lib/queries";
import { filterDoctors } from "../../lib/search";
import { skyNow } from "../../lib/sky";
import { voiceSearchAvailable } from "../../lib/speech";
import { plainSpecialty, SYMPTOMS } from "../../lib/specialties";
import { callNumber } from "../../lib/support";
import { colors, radius, space } from "../../lib/theme";

const NEAR_KM = 3;

/**
 * Living Home. The top follows the day (morning, afternoon, evening and night colours and greeting); the next visit
 * says when to leave and opens the route; a still map shows the doctors around you and opens the live map; symptom
 * chips, Book again and nearby doctors follow. Help is always top-right, next to the logo.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const profile = useProfile();
  const app = useAppProfile();
  const doctors = useDoctors();
  const appts = useMyAppointments();
  const family = useFamily();
  // Whose care Home shows: "all", "me" or a family member's id. Session only.
  const [who, setWho] = useState("all");
  const { place, setPlace, locate, locating, cities } = useHomePlace();
  const [pickCity, setPickCity] = useState(false);
  const voice = voiceSearchAvailable();
  const [sky, setSky] = useState(skyNow);
  const here = useQuietPosition();

  // Re-check the time of day whenever Home comes back into view, and match the status bar to the sky.
  useFocusEffect(
    useCallback(() => {
      const s = skyNow();
      setSky(s);
      setStatusBarStyle(s.bar);
      return () => setStatusBarStyle("dark");
    }, []),
  );

  const nearby = useMemo(() => filterDoctors(doctors.data ?? [], { place }), [doctors.data, place]);
  const lastDoctor = useMemo(
    () => (app.data?.lastDoctorId ? doctors.data?.find((d) => d.id === app.data?.lastDoctorId) : undefined),
    [app.data?.lastDoctorId, doctors.data],
  );
  // What Home leads with depends on where the patient is in their care (see lib/care).
  const members = useMemo(() => family.data?.members ?? [], [family.data]);
  const myName = profile.data?.fullName;
  const allAppts = useMemo(() => appts.data?.appointments ?? [], [appts.data]);
  const shown = useMemo(() => (who === "all" ? allAppts : allAppts.filter((a) => whoseVisit(a, myName, members) === who)), [allAppts, who, myName, members]);
  const care = useMemo(() => careState(shown), [shown]);
  const chips = useMemo(() => {
    if (!members.length) return [];
    const today = istDateString();
    const upcoming = allAppts.filter((a) => a.apptDate.slice(0, 10) >= today && ["pending", "confirmed"].includes(visitKind(a)));
    const count = (id: string) => upcoming.filter((a) => whoseVisit(a, myName, members) === id).length;
    return [{ id: "me", name: t("me"), count: count("me") }, ...members.map((m) => ({ id: m.memberId, name: localName(m.firstName, locale), count: count(m.memberId) }))];
  }, [members, allAppts, myName, t, locale]);
  const whoName = chips.find((c) => c.id === who)?.name;
  const { stage, next, last } = care;
  const nextDoctor = useMemo(() => doctorOf(next, doctors.data), [next, doctors.data]);
  const lastVisitDoctor = useMemo(() => doctorOf(last, doctors.data), [last, doctors.data]);
  const hiddenAfter = useStoredSet("dd.afterHidden");
  const showAfter = stage === "after" && last && !hiddenAfter.ids.has(last.appointmentId);
  const others = useMemo(
    () =>
      who === "all"
        ? otherUpcoming(allAppts, next)
            .slice(0, 2)
            .map((a) => {
              const day = a.apptDate.slice(0, 10);
              return {
                key: a.appointmentId,
                name: a.patientName ? localName(a.patientName, locale) : "",
                when: [day === istDateString() ? t("today") : day === istDateString(1) ? t("tomorrow") : formatShortDate(a.apptDate, locale), formatTime(a.startAt)].filter(Boolean).join(" "),
                doctor: [localName(a.doctorName, locale), localName(a.hospitalName, locale)].join(" · "),
              };
            })
        : [],
    [who, allAppts, next, locale, t],
  );
  const staleMin = appts.dataUpdatedAt ? Math.floor((Date.now() - appts.dataUpdatedAt) / 60000) : 0;
  const nextConfirmed = next ? visitKind(next) === "confirmed" : false;
  const nextDay = next?.apptDate.slice(0, 10);
  const soon = nextDay === istDateString() || nextDay === istDateString(1);
  const nextStart = next?.startAt?.slice(11, 16);
  const nextStartTime = nextStart && nextStart !== "00:00" ? nextStart : undefined;

  // Where "you" are: the phone (only if location is already allowed), else the area picked on the map.
  const origin: LatLng | null = here ?? (place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : null);
  const clinic: LatLng | null = nextDoctor?.latitude != null && nextDoctor?.longitude != null ? { lat: nextDoctor.latitude, lng: nextDoctor.longitude } : null;
  // Routes only for a visit today or tomorrow, so Home doesn't spend a route lookup on a visit next week.
  const routes = useRoutes(soon ? origin : null, soon ? clinic : null);
  const auto = routes.data?.auto;
  const leave = auto ? leaveTime(nextStartTime, auto.seconds) : null;
  const visitDay = stage === "visitDay";
  const openWay = () => {
    if (!nextDoctor) return;
    if (visitDay && hasLiveMap() && clinic) router.push({ pathname: "/navigate/[id]", params: { id: nextDoctor.id, mode: "auto" } });
    else router.push({ pathname: "/route/[id]", params: { id: nextDoctor.id, date: nextDay ?? "", start: nextStartTime ?? "" } });
  };

  // The still map: centred on you, else on the doctors in your city.
  const pinned = nearby.filter((d) => d.latitude != null && d.longitude != null);
  const center: LatLng | null = origin ?? (pinned.length ? { lat: avg(pinned.slice(0, 8).map((d) => d.latitude!)), lng: avg(pinned.slice(0, 8).map((d) => d.longitude!)) } : null);
  const closeBy = origin ? pinned.filter((d) => distanceKm(origin, { lat: d.latitude!, lng: d.longitude! }) <= NEAR_KM) : [];
  const mapLabel = origin && closeBy.length ? t("doctorsWithinKm", { count: closeBy.length, km: NEAR_KM }) : place?.city ? t("doctorsInCity", { count: nearby.length, city: place.city }) : undefined;

  const firstName = profile.data?.firstName || profile.data?.fullName?.split(" ")[0];
  const greeting = firstName ? `${t(sky.greeting)}, ${firstName}` : t(sky.greeting);
  // "Sector 11, Ghaziabad": the real town from the map; the doctor-list city only when there's no town name.
  const town = place?.town ?? place?.city;
  const areaLabel = [place?.area, town].filter(Boolean).join(", ") || t("allIndia");
  const openArea = () => (hasLiveMap() ? router.push("/area") : setPickCity(true));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={doctors.isRefetching || appts.isRefetching}
            onRefresh={() => {
              void doctors.refetch();
              void appts.refetch();
              void app.refetch();
            }}
            tintColor={colors.primary}
            progressViewOffset={insets.top}
          />
        }
      >
        <View style={[styles.sky, { backgroundColor: sky.bg, paddingTop: insets.top + space.md }]}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <View style={[styles.orb, { backgroundColor: sky.orbBg }]}>
                <Ionicons name={sky.icon} size={18} color={sky.orbInk} />
              </View>
              <Pressable onPress={openArea} accessibilityRole="button" accessibilityLabel={`${areaLabel}. ${t("changeCity")}`} style={styles.areaLink} hitSlop={8}>
                <Txt variant="smallBold" color={sky.ink} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {areaLabel}
                </Txt>
                <Ionicons name="chevron-down" size={14} color={sky.ink} style={{ marginLeft: 2 }} />
              </Pressable>
            </View>
            <HelpButton />
            <Logo height={36} />
          </View>
          <Txt variant="display" color={sky.ink} numberOfLines={2} style={{ fontSize: 30, marginTop: space.md }}>
            {greeting}
          </Txt>
          <View style={{ flexDirection: "row", marginTop: space.xs }}>
            <LanguageLink color={sky.ink} />
          </View>
        </View>

        <View style={styles.body}>
          <Pressable
            onPress={() => router.push("/doctors")}
            accessibilityRole="search"
            accessibilityLabel={t("searchPlaceholder")}
            style={({ pressed }) => [styles.search, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Ionicons name="search" size={22} color={colors.ink} />
            <Txt color={colors.muted} style={{ flex: 1, marginLeft: space.md }} numberOfLines={1}>
              {t("searchPlaceholder")}
            </Txt>
            {voice ? (
              <Pressable onPress={() => router.push({ pathname: "/doctors", params: { voice: "1" } })} accessibilityRole="button" accessibilityLabel={t("speak")} style={styles.speak}>
                <Ionicons name="mic" size={20} color={colors.primaryDark} />
                <Txt variant="smallBold" color={colors.primaryDark} style={{ marginLeft: 4 }}>
                  {t("speak")}
                </Txt>
              </Pressable>
            ) : null}
          </Pressable>

          {chips.length ? <FamilyChips chips={chips} value={who} onChange={setWho} /> : null}

          {doctors.isError && doctors.data ? <Banner text={t("offline")} tone="warning" icon="cloud-offline" /> : null}

          {next ? (
            <View style={styles.nextCard} accessibilityLabel={t("nextVisit")}>
              <View style={styles.rowBetween}>
                <Txt variant="eyebrow" color={colors.primaryOnDark} style={{ flexShrink: 1 }} numberOfLines={1}>
                  {[visitDay ? t("visitToday") : nextDay === istDateString(1) ? t("tomorrow") : formatShortDate(next.apptDate, locale), formatTime(next.startAt)].filter(Boolean).join(" · ")}
                </Txt>
                <View style={[styles.pill, { backgroundColor: nextConfirmed ? colors.successSoft : colors.warningSoft }]}>
                  <Txt variant="tinyBold" color={nextConfirmed ? colors.success : colors.warning}>
                    {nextConfirmed ? t("statusConfirmed") : next.hospitalSeenAt ? t("hospitalHasSeen") : t("hospitalWillCall")}
                  </Txt>
                </View>
              </View>
              <Pressable onPress={() => router.push("/appointments")} accessibilityRole="button">
                <Txt variant="subheading" color="#fff" numberOfLines={1}>
                  {localName(next.doctorName, locale)}
                </Txt>
                <Txt variant="small" color="#DDF1ED" numberOfLines={1}>
                  {[nextDoctor ? plainSpecialty(nextDoctor.specialtyId, locale) : null, localName(next.hospitalName, locale)].filter(Boolean).join(" · ")}
                </Txt>
                {next.patientName ? (
                  <Txt variant="smallBold" color="#fff" numberOfLines={1}>
                    {t("visitFor", { name: localName(next.patientName, locale) })}
                  </Txt>
                ) : null}
              </Pressable>
              <Journey current={journeyStep(next)} tone="dark" />
              {nextDoctor && visitDay ? (
                <View style={styles.leaveBlock}>
                  <Txt variant="title" color="#fff">
                    {leave ? (leave.late ? t("leaveNow") : t("leaveByTime", { time: leave.label })) : t("seeTheWay")}
                  </Txt>
                  {auto ? (
                    <Txt variant="small" color="#DDF1ED">
                      {t("routeSummary", { min: minutes(auto.seconds), mode: t("byAuto"), dist: km(auto.meters) })}
                    </Txt>
                  ) : null}
                  <Button label={t("startNavigation")} icon="navigate" variant="onDark" onPress={openWay} style={{ marginTop: space.sm }} />
                </View>
              ) : nextDoctor ? (
                <Pressable
                  onPress={openWay}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.routeRow, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
                >
                  <View style={styles.routeIcon}>
                    <Ionicons name="navigate" size={20} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyBold" color="#fff">
                      {leave ? t("leaveByTime", { time: leave.label }) : t("seeTheWay")}
                    </Txt>
                    {auto ? (
                      <Txt variant="small" color="#DDF1ED">
                        {t("routeSummary", { min: minutes(auto.seconds), mode: t("byAuto"), dist: km(auto.meters) })}
                      </Txt>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </Pressable>
              ) : null}
              {nextDoctor?.hospitalPhone ? (
                <Button label={t("callHospital")} icon="call" variant="onDarkSoft" size="md" onPress={() => callNumber(nextDoctor.hospitalPhone!)} />
              ) : null}
            </View>
          ) : null}

          {appts.isLoading && !appts.data ? <View style={styles.placeholder} accessibilityLabel={t("loading")} /> : null}
          {next && staleMin >= 5 ? (
            <Txt variant="tiny" color={colors.muted} style={{ marginTop: -space.sm }}>
              {t("updatedAgo", { min: staleMin })}
            </Txt>
          ) : null}
          {who !== "all" && stage === "none" && whoName && appts.data ? (
            <View style={styles.again}>
              <Ionicons name="calendar-clear-outline" size={26} color={colors.muted} />
              <Txt variant="bodyBold" style={{ flex: 1 }}>
                {t("noVisitsFor", { name: whoName })}
              </Txt>
              <Button label={t("findDoctorFor")} size="md" variant="secondary" onPress={() => router.push("/doctors")} />
            </View>
          ) : null}
          <OtherVisits rows={others} onOpen={() => router.push("/appointments")} />

          {next && (stage === "dayBefore" || visitDay) ? <BringList appointmentId={next.appointmentId} fee={nextDoctor ? effectiveFee(nextDoctor) : undefined} /> : null}

          {showAfter && last ? (
            <AfterVisitCard
              doctorName={localName(last.doctorName, locale)}
              hospitalName={localName(last.hospitalName, locale)}
              onSave={() => router.push({ pathname: "/records", params: { add: "prescription" } })}
              onFollowUp={lastVisitDoctor ? () => router.push(`/book/${lastVisitDoctor.id}`) : undefined}
              onHide={() => hiddenAfter.toggle(last.appointmentId)}
            />
          ) : null}

          <View style={{ gap: space.md }}>
            <SectionHeader title={t("whatsTroubling")} action={t("seeAll")} onAction={() => router.push("/doctors")} />
            {/* The main job of Home: a big, two-column grid, ahead of the map. */}
            <View style={styles.symptomGrid}>
              {SYMPTOMS.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => router.push({ pathname: "/doctors", params: { symptom: s.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={s.label[locale]}
                  style={({ pressed }) => [styles.symptom, pressed && { borderColor: colors.primary, backgroundColor: colors.primarySoft, transform: [{ scale: 0.97 }] }]}
                >
                  <IconCircle icon={s.icon} tint={s.tint} size={44} />
                  <Txt variant="bodyBold" numberOfLines={2} style={{ flex: 1, fontSize: 15 }}>
                    {s.label[locale]}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>

          {lastDoctor && !(showAfter && lastVisitDoctor?.id === lastDoctor.id) ? (
            <View style={styles.again}>
              <DoctorAvatar doctor={lastDoctor} size={46} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="eyebrow" color={colors.muted} style={{ fontSize: 12 }}>
                  {t("bookAgain")}
                </Txt>
                <Txt variant="bodyBold" numberOfLines={1}>
                  {localName(lastDoctor.name, locale)}
                </Txt>
                <Txt variant="small" color={colors.muted} numberOfLines={1} style={{ fontSize: 13 }}>
                  {plainSpecialty(lastDoctor.specialtyId, locale)}
                </Txt>
              </View>
              <Button label={t("book")} size="md" onPress={() => router.push(`/book/${lastDoctor.id}`)} />
            </View>
          ) : null}

          {center && hasMapImages() ? (
            <MapPreview
              center={center}
              zoom={origin ? 13 : 12}
              height={120}
              pins={pinned.slice(0, 10).map((d) => ({ lat: d.latitude!, lng: d.longitude! }))}
              me={!!origin}
              label={mapLabel}
              action={t("openMap")}
              onPress={() => router.push("/map")}
              accessibilityLabel={[mapLabel, t("openMap")].filter(Boolean).join(". ")}
            />
          ) : null}

          <SectionHeader title={place?.city ? t("nearYou", { city: place.city }) : t("topDoctors")} action={t("seeAll")} onAction={() => router.push("/doctors")} />
          {doctors.isLoading ? (
            <Loading />
          ) : nearby.length ? (
            nearby.slice(0, 4).map((d) => <DoctorCard key={d.id} doctor={d} onPress={() => router.push(`/doctor/${d.id}`)} onBook={() => router.push(`/book/${d.id}`)} />)
          ) : (
            <Txt color={colors.muted}>{t("noDoctors")}</Txt>
          )}
        </View>
      </ScrollView>

      <CityPicker
        visible={pickCity}
        cities={cities}
        current={place}
        locating={locating}
        onClose={() => setPickCity(false)}
        onPick={(p) => {
          void setPlace(p);
          setPickCity(false);
        }}
        onLocate={async () => {
          if (await locate()) setPickCity(false);
        }}
      />
    </View>
  );
}

/** The doctor for a visit: by id (newer API), else by name for older servers. */
function doctorOf(a: MyAppointment | undefined, list: Doctor[] | undefined): Doctor | undefined {
  if (!a || !list) return undefined;
  return (a.doctorId ? list.find((d) => d.id.toLowerCase() === a.doctorId!.toLowerCase()) : undefined) ?? list.find((d) => d.name === a.doctorName);
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const styles = StyleSheet.create({
  sky: { paddingHorizontal: space.xl - 4, paddingBottom: 46 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  orb: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  areaLink: { flexDirection: "row", alignItems: "center", minHeight: 36, flexShrink: 1 },
  body: { marginTop: -30, paddingHorizontal: space.lg, gap: space.lg + 2 },
  search: { flexDirection: "row", alignItems: "center", minHeight: 60, paddingLeft: space.lg + 2, paddingRight: space.sm, backgroundColor: colors.card, borderRadius: 20, elevation: 4, shadowColor: "#10231F", shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  speak: { flexDirection: "row", alignItems: "center", height: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  nextCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)" },
  placeholder: { height: 190, borderRadius: radius.xl, backgroundColor: colors.line },
  leaveBlock: { padding: space.md, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", gap: 2 },
  routeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  symptomGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.sm },
  symptom: { width: "48.5%", flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 72, paddingHorizontal: space.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
  again: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, paddingLeft: space.md + 2 },
});
