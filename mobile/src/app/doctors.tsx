import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CityPicker } from "../components/CityPicker";
import { DoctorCard } from "../components/DoctorCard";
import { MapPreview } from "../components/MapPreview";
import { Banner, Button, Chip, EmptyState, IconButton, Loading, Logo, Txt } from "../components/ui";
import { effectiveFee, parseSearch } from "../lib/api/doctors";
import type { SearchParseResult } from "../lib/api/types";
import { useTextStyle } from "../lib/appearance";
import { useI18n } from "../lib/i18n";
import { useHomePlace } from "../lib/location";
import { hasMapImages } from "../lib/map";
import { useDoctors } from "../lib/queries";
import { filterDoctors } from "../lib/search";
import { useVoiceSearch } from "../lib/speech";
import { plainSpecialty, POPULAR_SPECIALTY_IDS, SPECIALTIES, SYMPTOMS } from "../lib/specialties";
import { contactSupport } from "../lib/support";
import { colors, radius, space } from "../lib/theme";

/**
 * Search. Words filter the on-phone directory instantly; a symptom that matches nobody ("pet dard") is sent to the
 * Doctor Dekho router, which answers with the right specialty. Opened from a Home tile it starts on that symptom;
 * opened from "Speak" it starts listening.
 */
export default function DoctorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; specialty?: string; symptom?: string; voice?: string }>();
  const { t, locale } = useI18n();
  const ts = useTextStyle();
  const doctors = useDoctors();
  const { place, setPlace, locate, locating, cities } = useHomePlace();
  const [query, setQuery] = useState(params.q ?? "");
  const symptom = SYMPTOMS.find((s) => s.id === params.symptom);
  const [specialty, setSpecialty] = useState<string | null>(params.specialty ?? null);
  const [symptomOn, setSymptomOn] = useState(!!symptom);
  const [todayOnly, setTodayOnly] = useState(false);
  const [cheapest, setCheapest] = useState(false);
  const [mine, setMine] = useState(false);
  const myLang = locale === "hi" || locale === "hinglish" ? "Hindi" : locale === "bn" ? "Bengali" : null;
  const [pickCity, setPickCity] = useState(false);
  const [ai, setAi] = useState<{ query: string; result: SearchParseResult } | null>(null);
  const voice = useVoiceSearch(locale, (text) => setQuery(text));

  useEffect(() => {
    if (params.voice === "1" && voice.available) void voice.start();
    // Only on arrival from the Home "Speak" button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const specialtyIds = specialty ? [specialty] : symptomOn && symptom ? symptom.specialtyIds : undefined;

  const refine = (list: ReturnType<typeof filterDoctors>) => {
    let out = todayOnly ? list.filter((d) => d.isAvailableToday) : list;
    if (mine && myLang) out = out.filter((d) => d.languages.some((l) => l.toLowerCase().includes(myLang.toLowerCase())));
    if (cheapest) out = [...out].sort((a, b) => (effectiveFee(a) ?? 1e9) - (effectiveFee(b) ?? 1e9));
    return out;
  };

  const direct = useMemo(
    () => refine(filterDoctors(doctors.data ?? [], { query, specialtyIds, place })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doctors.data, query, specialty, symptomOn, place, todayOnly, cheapest, mine],
  );

  // Ask the router only when typed words match nobody (debounced).
  const q = query.trim();
  useEffect(() => {
    if (q.length < 4 || direct.length > 0 || !doctors.data) {
      setAi(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      parseSearch(q)
        .then((result) => live && setAi({ query: q, result }))
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
    () => (direct.length || !aiIds.length ? [] : refine(filterDoctors(doctors.data ?? [], { specialtyIds: aiIds, place }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [direct.length, aiIds, doctors.data, place, todayOnly, cheapest, mine],
  );
  const list = direct.length ? direct : aiList;
  // A still map strip of these results that opens the live map.
  const pinned = list.filter((d) => d.latitude != null && d.longitude != null);
  const mapCenter =
    place?.lat != null && place?.lng != null
      ? { lat: place.lat, lng: place.lng }
      : pinned.length
        ? { lat: pinned.slice(0, 8).reduce((a, d) => a + d.latitude!, 0) / Math.min(8, pinned.length), lng: pinned.slice(0, 8).reduce((a, d) => a + d.longitude!, 0) / Math.min(8, pinned.length) }
        : null;

  const chipIds = useMemo(() => [...POPULAR_SPECIALTY_IDS, ...SPECIALTIES.map((s) => s.id).filter((id) => !POPULAR_SPECIALTY_IDS.includes(id))], []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={["top"]} style={styles.head}>
        <View style={styles.searchRow}>
          <IconButton icon="chevron-back" label={t("back")} onPress={() => router.back()} />
          <View style={[styles.searchBox, voice.listening && { borderColor: colors.danger }]}>
            <Ionicons name="search" size={20} color={colors.ink} />
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                if (v) setSymptomOn(false);
              }}
              placeholder={voice.listening ? t("listening") : t("searchPlaceholder")}
              placeholderTextColor={voice.listening ? colors.danger : colors.faint}
              returnKeyType="search"
              autoFocus={!params.specialty && !params.symptom && !params.q && params.voice !== "1"}
              style={[styles.searchInput, ts(16, "600"), { lineHeight: undefined }]}
              clearButtonMode="while-editing"
              accessibilityLabel={t("searchPlaceholder")}
            />
            {voice.available ? (
              <Pressable onPress={voice.listening ? voice.stop : voice.start} accessibilityRole="button" accessibilityLabel={voice.listening ? t("stopListening") : t("speak")} style={[styles.mic, voice.listening && { backgroundColor: colors.dangerSoft }]}>
                <Ionicons name={voice.listening ? "stop" : "mic"} size={20} color={voice.listening ? colors.danger : colors.primaryDark} />
              </Pressable>
            ) : null}
          </View>
          <View style={{ marginLeft: space.sm }}>
            <Logo height={30} />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <Chip label={place?.city ?? t("allIndia")} icon="location" selected onPress={() => setPickCity(true)} />
          <Chip label={t("availableToday")} selected={todayOnly} onPress={() => setTodayOnly(!todayOnly)} tone="ink" />
          <Chip label={t("lowestFee")} selected={cheapest} onPress={() => setCheapest(!cheapest)} tone="ink" />
          {myLang ? <Chip label={t("speaksMyLanguage")} selected={mine} onPress={() => setMine(!mine)} tone="ink" /> : null}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
          {chipIds.map((id) => (
            <Chip
              key={id}
              label={plainSpecialty(id, locale)}
              selected={specialty === id}
              onPress={() => {
                setSpecialty(specialty === id ? null : id);
                setSymptomOn(false);
              }}
            />
          ))}
        </ScrollView>
      </SafeAreaView>

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
            <View style={{ gap: space.md }}>
              {voice.error === "permission" ? <Banner tone="warning" icon="mic-off" text={t("micPermission")} /> : null}
              {symptomOn && symptom && !specialty ? (
                <Pressable onPress={() => setSymptomOn(false)} accessibilityRole="button" accessibilityHint={t("clearFilter")}>
                  <Banner icon="medkit" text={t("symptomMatched", { symptom: symptom.label[locale], doctors: symptom.specialtyIds.map((id) => plainSpecialty(id, locale)).join(", ") })} />
                </Pressable>
              ) : null}
              {!direct.length && aiList.length ? (
                <Banner icon="sparkles" text={`${t("aiMatched", { specialty: aiIds.map((id) => plainSpecialty(id, locale)).join(", "), query: q })} ${t("notDiagnosis")}`} />
              ) : null}
              {mapCenter && pinned.length && hasMapImages() ? (
                <MapPreview
                  center={mapCenter}
                  zoom={place?.lat != null ? 13 : 12}
                  pins={pinned.slice(0, 10).map((d) => ({ lat: d.latitude!, lng: d.longitude! }))}
                  me={place?.lat != null}
                  action={t("showOnMap")}
                  height={96}
                  onPress={() => router.push("/map")}
                  accessibilityLabel={t("showOnMap")}
                />
              ) : null}
              {list.length ? (
                <Txt variant="smallBold" color={colors.muted}>
                  {t("doctorsCount", { count: list.length })}
                  {place?.city ? ` · ${place.city}` : ""}
                </Txt>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View>
              <EmptyState icon="search" vita="thinking" title={t("noDoctors")} body={t("vitaTipNoMatch")} action={place?.city ? t("searchAllIndia") : undefined} onAction={() => void setPlace({ city: null, state: null })} />
              <Button label={t("vitaAsk")} icon="chatbubble-ellipses" variant="primary" onPress={() => router.push("/vita")} style={{ marginHorizontal: space.xl, marginBottom: space.sm }} />
              <Button label={t("callToBook")} icon="call" variant="secondary" onPress={() => contactSupport("whatsapp", t("callToBookMessage", { need: q || symptom?.label[locale] || "" }))} style={{ marginHorizontal: space.xl }} />
            </View>
          }
          renderItem={({ item }) => <DoctorCard doctor={item} onPress={() => router.push(`/doctor/${item.id}`)} onBook={() => router.push(`/book/${item.id}`)} />}
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
  head: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingTop: space.sm, gap: 6 },
  searchBox: { flex: 1, minWidth: 0, overflow: "hidden", flexDirection: "row", alignItems: "center", minHeight: 52, borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md + 2, paddingLeft: space.md, paddingRight: 4, backgroundColor: colors.card },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: space.sm, color: colors.ink },
  mic: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
});
