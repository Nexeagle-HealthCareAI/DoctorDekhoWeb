import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityPicker } from "../../components/CityPicker";
import { Avatar, DoctorCard } from "../../components/DoctorCard";
import { Banner, Card, Loading, SectionHeader, Txt, type IconName } from "../../components/ui";
import { formatShortDate, formatTime, istDateString } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useHomePlace } from "../../lib/location";
import { useAppProfile, useDoctors, useMyAppointments, useProfile } from "../../lib/queries";
import { filterDoctors } from "../../lib/search";
import { POPULAR_SPECIALTY_IDS, SPECIALTIES, specialtyName } from "../../lib/specialties";
import { colors, font, radius, space } from "../../lib/theme";

/** Home: one search box, the next visit, "book again", specialties and nearby doctors — everything one tap from booking. */
export default function HomeScreen() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const profile = useProfile();
  const app = useAppProfile();
  const doctors = useDoctors();
  const appts = useMyAppointments();
  const { place, setPlace, locate, locating, cities } = useHomePlace();
  const [query, setQuery] = useState("");
  const [pickCity, setPickCity] = useState(false);

  const nearby = useMemo(() => filterDoctors(doctors.data ?? [], { place }).slice(0, 6), [doctors.data, place]);
  const lastDoctor = useMemo(
    () => (app.data?.lastDoctorId ? doctors.data?.find((d) => d.id === app.data?.lastDoctorId) : undefined),
    [app.data?.lastDoctorId, doctors.data],
  );
  const next = useMemo(() => {
    const today = istDateString();
    return (appts.data?.appointments ?? [])
      .filter((a) => a.apptDate.slice(0, 10) >= today && /pending|confirm/i.test(a.status))
      .sort((a, b) => a.apptDate.localeCompare(b.apptDate) || a.startAt.localeCompare(b.startAt))[0];
  }, [appts.data]);

  const firstName = profile.data?.firstName || profile.data?.fullName?.split(" ")[0];

  function search() {
    const q = query.trim();
    router.push({ pathname: "/doctors", params: q ? { q } : {} });
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={doctors.isRefetching}
            onRefresh={() => {
              void doctors.refetch();
              void appts.refetch();
              void app.refetch();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.topRow}>
          <Txt variant="title" style={{ flex: 1 }} numberOfLines={1}>
            {firstName ? t("hello", { name: firstName }) : t("helloGuest")}
          </Txt>
          <Pressable onPress={() => setPickCity(true)} style={styles.cityPill} accessibilityRole="button" accessibilityLabel={t("changeCity")}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Txt variant="smallBold" color={colors.primaryDark} numberOfLines={1} style={{ maxWidth: 120, marginHorizontal: 4 }}>
              {place?.city ?? t("allIndia")}
            </Txt>
            <Ionicons name="chevron-down" size={14} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            onSubmitEditing={search}
            style={styles.searchInput}
            accessibilityLabel={t("searchPlaceholder")}
          />
          <Pressable onPress={search} style={styles.searchBtn} accessibilityRole="button" accessibilityLabel={t("searchButton")}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>

        {doctors.isError && doctors.data ? <Banner text={t("offline")} tone="warning" icon="cloud-offline" /> : null}

        {next ? (
          <Card onPress={() => router.push("/appointments")} style={styles.nextCard}>
            <Txt variant="smallBold" color={colors.primaryDark}>
              {t("nextVisit")}
            </Txt>
            <Txt variant="heading" style={{ marginTop: 4 }}>
              {next.doctorName}
            </Txt>
            <Txt color={colors.muted}>
              {[formatShortDate(next.apptDate, locale), formatTime(next.startAt), next.hospitalName].filter(Boolean).join(" · ")}
            </Txt>
          </Card>
        ) : null}

        {lastDoctor ? (
          <Card style={styles.again}>
            <Avatar doctor={lastDoctor} size={44} />
            <View style={{ flex: 1, marginHorizontal: space.md }}>
              <Txt variant="bodyBold" numberOfLines={1}>
                {lastDoctor.name}
              </Txt>
              <Txt variant="small" color={colors.muted} numberOfLines={1}>
                {specialtyName(lastDoctor.specialtyId, locale)}
              </Txt>
            </View>
            <Pressable onPress={() => router.push(`/book/${lastDoctor.id}`)} style={styles.againBtn} accessibilityRole="button">
              <Txt variant="smallBold" color="#fff">
                {t("bookAgain")}
              </Txt>
            </Pressable>
          </Card>
        ) : null}

        <SectionHeader title={t("specialties")} action={t("seeAll")} onAction={() => router.push("/doctors")} />
        <View style={styles.grid}>
          {POPULAR_SPECIALTY_IDS.map((id) => {
            const s = SPECIALTIES.find((x) => x.id === id);
            if (!s) return null;
            return (
              <Pressable
                key={id}
                onPress={() => router.push({ pathname: "/doctors", params: { specialty: id } })}
                style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.primarySoft }]}
                accessibilityRole="button"
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={s.icon as IconName} size={24} color={colors.primary} />
                </View>
                <Txt variant="tiny" numberOfLines={2} style={{ textAlign: "center", marginTop: 6, color: colors.text }}>
                  {specialtyName(id, locale)}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        <SectionHeader
          title={place?.city ? t("nearYou", { city: place.city }) : t("topDoctors")}
          action={t("seeAll")}
          onAction={() => router.push("/doctors")}
        />
        {doctors.isLoading ? (
          <Loading />
        ) : nearby.length ? (
          nearby.map((d) => (
            <DoctorCard key={d.id} doctor={d} onPress={() => router.push(`/doctor/${d.id}`)} onBook={() => router.push(`/book/${d.id}`)} />
          ))
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
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 40,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingLeft: space.lg,
    minHeight: 56,
  },
  searchInput: { flex: 1, fontSize: font.body, color: colors.ink, paddingHorizontal: space.sm, minHeight: 52 },
  searchBtn: { backgroundColor: colors.primary, width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", margin: 4 },
  nextCard: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  again: { flexDirection: "row", alignItems: "center" },
  againBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: space.lg, minHeight: 40, justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.md },
  tile: { width: "23%", alignItems: "center", paddingVertical: space.sm, borderRadius: radius.md },
  tileIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
});
