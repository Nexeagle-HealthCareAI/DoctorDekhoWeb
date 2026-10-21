import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { CityPicker } from "../components/CityPicker";
import { DoctorCard } from "../components/DoctorCard";
import { Banner, Chip, EmptyState, Loading, Txt } from "../components/ui";
import { parseSearch } from "../lib/api/doctors";
import type { SearchParseResult } from "../lib/api/types";
import { useI18n } from "../lib/i18n";
import { useHomePlace } from "../lib/location";
import { useDoctors } from "../lib/queries";
import { filterDoctors } from "../lib/search";
import { SPECIALTIES, specialtyName } from "../lib/specialties";
import { colors, font, radius, space } from "../lib/theme";

/**
 * Search results. Instant keyword filtering on the phone; when a symptom-like query finds nothing,
 * ask the Doctor Dekho router which specialty fits ("pet dard" → General Physician / Gastro).
 */
export default function DoctorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; specialty?: string }>();
  const { t, locale } = useI18n();
  const doctors = useDoctors();
  const { place, setPlace, locate, locating, cities } = useHomePlace();
  const [query, setQuery] = useState(params.q ?? "");
  const [specialty, setSpecialty] = useState<string | null>(params.specialty ?? null);
  const [pickCity, setPickCity] = useState(false);
  const [ai, setAi] = useState<{ query: string; result: SearchParseResult } | null>(null);

  const direct = useMemo(
    () => filterDoctors(doctors.data ?? [], { query, specialtyIds: specialty ? [specialty] : undefined, place }),
    [doctors.data, query, specialty, place],
  );

  // Debounced AI fallback, only when the typed words match nobody.
  const q = query.trim();
  useEffect(() => {
    if (q.length < 4 || direct.length > 0 || !doctors.data) {
      setAi(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      parseSearch(q)
        .then((result) => {
          if (live) setAi({ query: q, result });
        })
        .catch(() => {});
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, direct.length, doctors.data]);

  const aiIds = useMemo(() => {
    if (!ai || ai.query !== q) return [];
    const ids = ai.result.specialtyIds?.length ? ai.result.specialtyIds : ai.result.specialtyId ? [ai.result.specialtyId] : [];
    return ids.filter((id) => id !== "unclear");
  }, [ai, q]);

  const aiList = useMemo(
    () => (direct.length || !aiIds.length ? [] : filterDoctors(doctors.data ?? [], { specialtyIds: aiIds, place })),
    [direct.length, aiIds, doctors.data, place],
  );
  const list = direct.length ? direct : aiList;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t("findDoctor") }} />
      <View style={styles.head}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchPlaceholder")}
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            autoFocus={!params.specialty && !params.q}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <Chip label={place?.city ?? t("allIndia")} icon="location" onPress={() => setPickCity(true)} />
          <Chip label={t("allSpecialties")} selected={!specialty} onPress={() => setSpecialty(null)} />
          {SPECIALTIES.map((s) => (
            <Chip key={s.id} label={specialtyName(s.id, locale)} selected={specialty === s.id} onPress={() => setSpecialty(specialty === s.id ? null : s.id)} />
          ))}
        </ScrollView>
      </View>

      {doctors.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={8}
          ListHeaderComponent={
            <View style={{ gap: space.sm }}>
              {!direct.length && aiList.length ? (
                <Banner icon="sparkles" text={t("aiMatched", { specialty: specialtyName(aiIds[0], locale), query: q })} />
              ) : null}
              {list.length ? (
                <Txt variant="small" color={colors.muted}>
                  {t("doctorsCount", { count: list.length })}
                </Txt>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title={t("noDoctors")}
              action={place?.city ? t("allIndia") : undefined}
              onAction={() => void setPlace({ city: null, state: null })}
            />
          }
          renderItem={({ item }) => (
            <DoctorCard doctor={item} onPress={() => router.push(`/doctor/${item.id}`)} onBook={() => router.push(`/book/${item.id}`)} />
          )}
        />
      )}

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

const styles = StyleSheet.create({
  head: { backgroundColor: colors.bg, paddingTop: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: space.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  searchInput: { flex: 1, fontSize: font.body, color: colors.ink, paddingHorizontal: space.sm, minHeight: 48 },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
});

