import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityPicker } from "../../components/CityPicker";
import { DoctorAvatar, DoctorCard } from "../../components/DoctorCard";
import { LanguageLink } from "../../components/LanguagePicker";
import { Banner, Button, DateBlock, HelpButton, IconCircle, Loading, Logo, SectionHeader, Txt } from "../../components/ui";
import { visitKind } from "../../lib/booking";
import { formatShortDate, formatTime, istDateString } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useHomePlace } from "../../lib/location";
import { useAppProfile, useDoctors, useMyAppointments, useProfile } from "../../lib/queries";
import { filterDoctors } from "../../lib/search";
import { voiceSearchAvailable } from "../../lib/speech";
import { plainSpecialty, SYMPTOMS } from "../../lib/specialties";
import { callNumber, openDirections } from "../../lib/support";
import { colors, radius, space } from "../../lib/theme";

/**
 * Home: next visit first (with Directions and Call), then "What's troubling you?" — six symptom tiles, because
 * patients think in symptoms, not specialties — then Book again and doctors nearby. Help is always top-right.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const profile = useProfile();
  const app = useAppProfile();
  const doctors = useDoctors();
  const appts = useMyAppointments();
  const { place, setPlace, locate, locating, cities } = useHomePlace();
  const [pickCity, setPickCity] = useState(false);
  const voice = voiceSearchAvailable();

  const nearby = useMemo(() => filterDoctors(doctors.data ?? [], { place }).slice(0, 4), [doctors.data, place]);
  const lastDoctor = useMemo(
    () => (app.data?.lastDoctorId ? doctors.data?.find((d) => d.id === app.data?.lastDoctorId) : undefined),
    [app.data?.lastDoctorId, doctors.data],
  );
  const next = useMemo(() => {
    const today = istDateString();
    return (appts.data?.appointments ?? [])
      .filter((a) => a.apptDate.slice(0, 10) >= today && (visitKind(a) === "pending" || visitKind(a) === "confirmed"))
      .sort((a, b) => a.apptDate.localeCompare(b.apptDate) || a.startAt.localeCompare(b.startAt))[0];
  }, [appts.data]);
  // Bookings carry only the doctor's name; find the doctor in the directory for the hospital's phone and map pin.
  const nextDoctor = useMemo(() => (next ? doctors.data?.find((d) => d.name === next.doctorName) : undefined), [next, doctors.data]);
  const nextConfirmed = next ? visitKind(next) === "confirmed" : false;

  const firstName = profile.data?.firstName || profile.data?.fullName?.split(" ")[0];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={doctors.isRefetching || appts.isRefetching}
            onRefresh={() => {
              void doctors.refetch();
              void appts.refetch();
              void app.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.metaRow}>
              <Pressable onPress={() => setPickCity(true)} accessibilityRole="button" accessibilityLabel={t("changeCity")} style={styles.cityLink} hitSlop={8}>
                <Ionicons name="location" size={16} color={colors.primaryDark} />
                <Txt variant="smallBold" color={colors.primaryDark} numberOfLines={1} style={{ marginHorizontal: 4, maxWidth: 120 }}>
                  {place?.city ?? t("allIndia")}
                </Txt>
                <Ionicons name="chevron-down" size={14} color={colors.primaryDark} />
              </Pressable>
              <View style={styles.metaDot} />
              <LanguageLink />
            </View>
            <Txt variant="display" numberOfLines={1}>
              {firstName ? t("hello", { name: firstName }) : t("helloGuest")}
            </Txt>
          </View>
          <HelpButton />
          <Logo height={34} />
        </View>

        <Pressable onPress={() => router.push("/doctors")} accessibilityRole="search" accessibilityLabel={t("searchPlaceholder")} style={styles.search}>
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

        {doctors.isError && doctors.data ? <Banner text={t("offline")} tone="warning" icon="cloud-offline" /> : null}

        {next ? (
          <View style={styles.nextCard} accessibilityLabel={t("nextVisit")}>
            <View style={styles.rowBetween}>
              <Txt variant="eyebrow" color={colors.primaryOnDark}>
                {t("nextVisit")}
              </Txt>
              <View style={[styles.pill, { backgroundColor: nextConfirmed ? colors.successSoft : colors.warningSoft }]}>
                <Txt variant="tinyBold" color={nextConfirmed ? colors.success : colors.warning}>
                  {nextConfirmed ? t("statusConfirmed") : t("hospitalWillCall")}
                </Txt>
              </View>
            </View>
            <Pressable onPress={() => router.push("/appointments")} style={[styles.row, { gap: space.md + 2 }]} accessibilityRole="button">
              <DateBlock date={next.apptDate} dark size={58} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt variant="subheading" color="#fff" numberOfLines={1}>
                  {next.doctorName}
                </Txt>
                <Txt variant="small" color="#DDF1ED" numberOfLines={1}>
                  {[nextDoctor ? plainSpecialty(nextDoctor.specialtyId, locale) : null, formatTime(next.startAt) || formatShortDate(next.apptDate, locale)].filter(Boolean).join(" · ")}
                </Txt>
                <Txt variant="small" color="#DDF1ED" numberOfLines={1}>
                  {next.hospitalName}
                </Txt>
              </View>
            </Pressable>
            <View style={[styles.row, { gap: 10 }]}>
              <Button
                label={t("directions")}
                icon="navigate"
                variant="onDark"
                size="md"
                style={{ flex: 1 }}
                onPress={() => openDirections({ lat: nextDoctor?.latitude, lng: nextDoctor?.longitude, query: [next.hospitalName, nextDoctor?.city].filter(Boolean).join(", ") })}
              />
              {nextDoctor?.hospitalPhone ? (
                <Button label={t("callHospital")} icon="call" variant="onDarkSoft" size="md" style={{ flex: 1 }} onPress={() => callNumber(nextDoctor.hospitalPhone!)} />
              ) : null}
            </View>
          </View>
        ) : null}

        <SectionHeader title={t("whatsTroubling")} action={t("seeAll")} onAction={() => router.push("/doctors")} />
        <View style={styles.grid}>
          {SYMPTOMS.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push({ pathname: "/doctors", params: { symptom: s.id } })}
              accessibilityRole="button"
              accessibilityLabel={s.label[locale]}
              style={({ pressed }) => [styles.tile, pressed && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
            >
              <IconCircle icon={s.icon} tint={s.tint} size={46} />
              <Txt variant="smallBold" center numberOfLines={2} style={{ marginTop: space.sm, fontWeight: undefined }}>
                {s.label[locale]}
              </Txt>
            </Pressable>
          ))}
        </View>

        {lastDoctor ? (
          <View style={styles.again}>
            <DoctorAvatar doctor={lastDoctor} size={46} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="eyebrow" color={colors.muted} style={{ fontSize: 12 }}>
                {t("bookAgain")}
              </Txt>
              <Txt variant="bodyBold" numberOfLines={1}>
                {lastDoctor.name}
              </Txt>
              <Txt variant="small" color={colors.muted} numberOfLines={1} style={{ fontSize: 13 }}>
                {plainSpecialty(lastDoctor.specialtyId, locale)}
              </Txt>
            </View>
            <Button label={t("book")} size="md" onPress={() => router.push(`/book/${lastDoctor.id}`)} />
          </View>
        ) : null}

        <SectionHeader title={place?.city ? t("nearYou", { city: place.city }) : t("topDoctors")} action={t("seeAll")} onAction={() => router.push("/doctors")} />
        {doctors.isLoading ? (
          <Loading />
        ) : nearby.length ? (
          nearby.map((d) => <DoctorCard key={d.id} doctor={d} onPress={() => router.push(`/doctor/${d.id}`)} onBook={() => router.push(`/book/${d.id}`)} />)
        ) : (
          <Txt color={colors.muted}>{t("noDoctors")}</Txt>
        )}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl - 4, paddingTop: space.md, paddingBottom: space.xxl, gap: space.lg + 2 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.sm + 2 },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong },
  cityLink: { flexDirection: "row", alignItems: "center", minHeight: 32 },
  search: { flexDirection: "row", alignItems: "center", minHeight: 60, paddingLeft: space.lg + 2, paddingRight: space.sm, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: radius.lg },
  speak: { flexDirection: "row", alignItems: "center", height: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  nextCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: space.lg + 2, gap: space.md + 2 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: -space.sm },
  tile: { flexBasis: "30%", flexGrow: 1, alignItems: "center", paddingVertical: space.md + 2, paddingHorizontal: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
  again: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.md, paddingLeft: space.md + 2 },
});
