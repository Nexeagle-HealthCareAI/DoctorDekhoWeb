import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoctorAvatar, OpenLine } from "../../components/DoctorCard";
import { Button, EmptyState, Logo, Txt } from "../../components/ui";
import { distanceKm, effectiveFee, parseSearch, type Doctor } from "../../lib/api/doctors";
import { rupees } from "../../lib/format";
import { openState } from "../../lib/hours";
import { useI18n } from "../../lib/i18n";
import { useHomePlace } from "../../lib/location";
import { askForPosition, getMapbox, MAP_STYLE, useQuietPosition, type LatLng } from "../../lib/map";
import { useDoctors } from "../../lib/queries";
import { matchesQuery } from "../../lib/search";
import { plainSpecialty } from "../../lib/specialties";
import { colors, radius, space } from "../../lib/theme";
import { localName } from "../../lib/translit";

type CameraHandle = {
  setCamera: (c: { centerCoordinate?: [number, number]; zoomLevel?: number; animationDuration?: number }) => void;
  fitBounds: (ne: [number, number], sw: [number, number], padding?: number | number[], duration?: number) => void;
};
type SourceHandle = { getClusterExpansionZoom: (f: GeoJSON.Feature) => Promise<number> };
type Bounds = { ne: GeoJSON.Position; sw: GeoJSON.Position };

const CARD_GAP = 12;
const MAX_CARDS = 25;
const OPEN = "#0B6B63";
const CLOSED = "#7C8B86";
const PICKED = "#C2410C";

/**
 * The live map. Every doctor with a pin, named once you zoom in, teal when open now and grey when not. A strip of
 * cards along the bottom always shows the doctors in view and moves with the map: swipe a card and the map goes to
 * that doctor; tap a pin and its card comes forward. The search box filters the map itself (names, hospitals, and
 * symptoms through the same suggestion as the search screen) and frames the results. Every card books in one tap.
 * Falls back to a plain message and the list where the map isn't built in.
 */
export default function MapScreen() {
  const M = getMapbox();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, locale } = useI18n();
  const doctors = useDoctors();
  const { place } = useHomePlace();
  const quiet = useQuietPosition();
  const [me, setMe] = useState<LatLng | null>(null);
  const [kind, setKind] = useState<string>("all");
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [ai, setAi] = useState<{ q: string; ids: string[] } | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [center, setCenter] = useState<LatLng | null>(null);
  const camera = useRef<CameraHandle | null>(null);
  const source = useRef<SourceHandle | null>(null);
  const list = useRef<FlatList<Doctor> | null>(null);
  const fromSwipe = useRef(false);

  const cardW = width - space.lg * 2 - 24;
  const here = me ?? quiet;
  const origin: LatLng | null = here ?? (place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : null);

  const pinned = useMemo(() => (doctors.data ?? []).filter((d) => d.latitude != null && d.longitude != null), [doctors.data]);
  const kinds = useMemo(() => {
    const inCity = place?.city ? pinned.filter((d) => d.city.toLowerCase() === place.city!.toLowerCase()) : pinned;
    const counts = new Map<string, number>();
    for (const d of inCity) counts.set(d.specialtyId, (counts.get(d.specialtyId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  }, [pinned, place?.city]);

  // What the search box asks for: names / hospitals / specialty words first; if nothing matches, the symptom suggestion.
  const q = query.trim();
  const byKind = useMemo(() => (kind === "all" ? pinned : pinned.filter((d) => d.specialtyId === kind)), [pinned, kind]);
  const direct = useMemo(() => (q ? byKind.filter((d) => matchesQuery(d, q)) : byKind), [byKind, q]);
  useEffect(() => {
    if (q.length < 3 || direct.length > 0) {
      setAi(null);
      return;
    }
    let live = true;
    const id = setTimeout(() => {
      parseSearch(q)
        .then((r) => {
          const ids = (r.specialtyIds?.length ? r.specialtyIds : r.specialtyId ? [r.specialtyId] : []).filter((x) => x && x !== "unclear");
          if (live) setAi({ q, ids });
        })
        .catch(() => {
          if (live) setAi({ q, ids: [] });
        });
    }, 450);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, direct.length]);
  const aiIds = useMemo(() => (ai && ai.q === q ? ai.ids : []), [ai, q]);
  const shown = useMemo(() => (direct.length || !q ? direct : byKind.filter((d) => aiIds.includes(d.specialtyId))), [direct, q, byKind, aiIds]);

  // The cards: doctors inside the map view, nearest the middle of the map first.
  const inView = useMemo(() => {
    if (!bounds) return shown.slice(0, MAX_CARDS);
    const [e, n] = bounds.ne;
    const [w, s] = bounds.sw;
    const mid = center ?? { lat: (n + s) / 2, lng: (e + w) / 2 };
    return shown
      .filter((d) => d.latitude! <= n && d.latitude! >= s && d.longitude! <= e && d.longitude! >= w)
      .map((d) => ({ d, k: distanceKm(mid, { lat: d.latitude!, lng: d.longitude! }) }))
      .sort((a, b) => a.k - b.k)
      .slice(0, MAX_CARDS)
      .map((x) => x.d);
  }, [shown, bounds, center]);
  const openCount = useMemo(() => inView.filter((d) => openState(d)?.kind === "open").length, [inView]);

  const shape = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: shown.map((d) => ({
        type: "Feature",
        id: d.id,
        properties: {
          id: d.id,
          tag: d.initials.slice(0, 2),
          // Map labels stay in Latin script: the map's text engine can't join Devanagari or Bengali letters correctly.
          label: d.name,
          sub: plainSpecialty(d.specialtyId, "en"),
          open: openState(d)?.kind === "open" ? 1 : 0,
        },
        geometry: { type: "Point", coordinates: [d.longitude!, d.latitude!] },
      })),
    }),
    [shown],
  );

  // Frame the results whenever the search or the kind changes.
  const resultKey = `${q}|${kind}|${shown.length}`;
  const lastFramed = useRef("");
  useEffect(() => {
    if (!q && kind === "all") return;
    if (!shown.length || lastFramed.current === resultKey) return;
    lastFramed.current = resultKey;
    setPicked(null);
    if (shown.length === 1) {
      camera.current?.setCamera({ centerCoordinate: [shown[0].longitude!, shown[0].latitude!], zoomLevel: 14.5, animationDuration: 700 });
      return;
    }
    // The nearest twelve, so one far-away match doesn't zoom the map out to all of India.
    const ref = origin ?? center;
    const sorted = ref ? [...shown].sort((a, b) => distanceKm(ref, { lat: a.latitude!, lng: a.longitude! }) - distanceKm(ref, { lat: b.latitude!, lng: b.longitude! })) : shown;
    const pts = sorted.slice(0, 12);
    const lats = pts.map((d) => d.latitude!);
    const lngs = pts.map((d) => d.longitude!);
    camera.current?.fitBounds([Math.max(...lngs), Math.max(...lats)], [Math.min(...lngs), Math.min(...lats)], [insets.top + 170, 48, 330, 48], 700);
  }, [resultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useMemo<LatLng | null>(() => {
    if (origin) return origin;
    const l = place?.city ? pinned.filter((d) => d.city.toLowerCase() === place.city!.toLowerCase()) : pinned;
    if (!l.length) return null;
    return { lat: l.reduce((a, d) => a + d.latitude!, 0) / l.length, lng: l.reduce((a, d) => a + d.longitude!, 0) / l.length };
    // Only the first position matters; later moves are the patient's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned.length > 0, !!origin]);

  if (!M) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.xl }}>
        <EmptyState icon="map-outline" title={t("mapUnavailable")} body={t("mapUnavailableHint")} action={t("findDoctor")} onAction={() => router.push("/doctors")} />
      </View>
    );
  }
  const { MapView, Camera, ShapeSource, CircleLayer, SymbolLayer, LocationPuck } = M;

  async function goToMe() {
    const p = await askForPosition();
    if (!p) return;
    setMe(p);
    camera.current?.setCamera({ centerCoordinate: [p.lng, p.lat], zoomLevel: 14, animationDuration: 700 });
  }

  // A pin was tapped: bring its card forward.
  function pickPin(d: Doctor) {
    Haptics.selectionAsync().catch(() => {});
    setPicked(d.id);
    const i = inView.findIndex((x) => x.id === d.id);
    if (i >= 0) list.current?.scrollToIndex({ index: i, animated: true });
  }

  // A card came to rest: light its pin and bring the map to it.
  function cardSettled(i: number) {
    const d = inView[i];
    if (!d || d.id === picked) return;
    fromSwipe.current = true;
    setPicked(d.id);
    camera.current?.setCamera({ centerCoordinate: [d.longitude!, d.latitude!], animationDuration: 450 });
  }

  const pickedExpr = picked ?? "";
  const noMatch = !!q && !shown.length && (direct.length > 0 || ai?.q === q);
  const suggestion = !direct.length && q && aiIds.length && shown.length ? t("mapSuggestion", { specialty: plainSpecialty(aiIds[0], locale), q }) : null;
  // Name, then the kind of doctor in smaller grey type underneath (a Mapbox "format" expression).
  type TextField = NonNullable<NonNullable<React.ComponentProps<typeof SymbolLayer>["style"]>["textField"]>;
  const nameText = ["format", ["get", "label"], { "font-scale": 1 }, "\n", {}, ["get", "sub"], { "font-scale": 0.82, "text-color": "#4A5551" }] as unknown as TextField;

  return (
    <View style={{ flex: 1, backgroundColor: "#ECEFE7" }}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={`mapbox://styles/${MAP_STYLE}`}
        scaleBarEnabled={false}
        compassEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        logoPosition={{ bottom: 296, left: 12 }}
        attributionPosition={{ bottom: 296, right: 12 }}
        onPress={() => {
          Keyboard.dismiss();
          setPicked(null);
        }}
        onMapIdle={(s) => {
          // A move made by swiping the cards keeps the strip as it is, so the card under the thumb doesn't change.
          if (fromSwipe.current) {
            fromSwipe.current = false;
            return;
          }
          setBounds(s.properties.bounds);
          const [lng, lat] = s.properties.center;
          setCenter({ lat, lng });
          // The patient moved the map: start the strip again from the doctor nearest the middle.
          list.current?.scrollToOffset({ offset: 0, animated: false });
        }}
      >
        <Camera
          ref={(r) => {
            camera.current = r as unknown as CameraHandle | null;
          }}
          defaultSettings={start ? { centerCoordinate: [start.lng, start.lat], zoomLevel: origin ? 13.5 : 11 } : { centerCoordinate: [78.9, 22.6], zoomLevel: 4 }}
        />
        {here ? <LocationPuck puckBearingEnabled={false} pulsing={{ isEnabled: true, color: "#1D63D8" }} /> : null}
        <ShapeSource
          id="doctors"
          ref={(r) => {
            source.current = r as unknown as SourceHandle | null;
          }}
          shape={shape}
          cluster
          clusterRadius={44}
          clusterMaxZoomLevel={12}
          onPress={async (e) => {
            const f = e.features[0];
            if (!f) return;
            if (f.properties?.cluster) {
              const zoom = await source.current?.getClusterExpansionZoom(f).catch(() => undefined);
              const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
              camera.current?.setCamera({ centerCoordinate: [lng, lat], zoomLevel: zoom ?? 14, animationDuration: 500 });
              return;
            }
            const d = shown.find((x) => x.id === f.properties?.id);
            if (d) pickPin(d);
          }}
        >
          <CircleLayer
            id="doctor-clusters"
            filter={["has", "point_count"]}
            style={{ circleColor: colors.primary, circleRadius: ["step", ["get", "point_count"], 18, 10, 22, 50, 26], circleStrokeColor: "#FFFFFF", circleStrokeWidth: 3 }}
          />
          <SymbolLayer
            id="doctor-cluster-count"
            filter={["has", "point_count"]}
            style={{ textField: ["get", "point_count_abbreviated"], textSize: 14, textColor: "#FFFFFF", textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"], textAllowOverlap: true, textIgnorePlacement: true }}
          />
          {/* A soft glow under doctors who are open right now. */}
          <CircleLayer
            id="doctor-open-glow"
            filter={["all", ["!", ["has", "point_count"]], ["==", ["get", "open"], 1]]}
            style={{ circleColor: OPEN, circleRadius: 28, circleOpacity: 0.16, circleBlur: 0.4 }}
          />
          <CircleLayer
            id="doctor-pins"
            filter={["!", ["has", "point_count"]]}
            style={{
              circleColor: ["case", ["==", ["get", "id"], pickedExpr], PICKED, ["==", ["get", "open"], 1], OPEN, CLOSED],
              circleRadius: ["case", ["==", ["get", "id"], pickedExpr], 22, 17],
              circleRadiusTransition: { duration: 220, delay: 0 },
              circleStrokeColor: "#FFFFFF",
              circleStrokeWidth: 2.5,
            }}
          />
          <SymbolLayer
            id="doctor-pin-tags"
            filter={["!", ["has", "point_count"]]}
            style={{ textField: ["get", "tag"], textSize: 12, textColor: "#FFFFFF", textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"], textAllowOverlap: true, textIgnorePlacement: true }}
          />
          {/* Names once you're close enough to read them; names that would overlap give way, the picked one always shows. */}
          <SymbolLayer
            id="doctor-names"
            minZoomLevel={12.5}
            filter={["all", ["!", ["has", "point_count"]], ["!=", ["get", "id"], pickedExpr]]}
            style={{
              textField: nameText,
              textFont: ["DIN Pro Medium", "Arial Unicode MS Regular"],
              textSize: 12.5,
              textColor: "#10231F",
              textHaloColor: "#FFFFFF",
              textHaloWidth: 1.6,
              textAnchor: "top",
              textOffset: [0, 1.6],
              textMaxWidth: 10,
              textOptional: true,
            }}
          />
          <SymbolLayer
            id="doctor-name-picked"
            filter={["==", ["get", "id"], pickedExpr]}
            style={{
              textField: nameText,
              textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"],
              textSize: 13.5,
              textColor: PICKED,
              textHaloColor: "#FFFFFF",
              textHaloWidth: 2,
              textAnchor: "top",
              textOffset: [0, 1.9],
              textMaxWidth: 12,
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </ShapeSource>
      </MapView>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.search}>
            <Ionicons name="search" size={20} color={colors.ink} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("mapSearch")}
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              accessibilityLabel={t("mapSearch")}
              style={styles.input}
            />
            {query ? (
              <Pressable
                onPress={() => {
                  setQuery("");
                  setPicked(null);
                  lastFramed.current = "";
                }}
                accessibilityRole="button"
                accessibilityLabel={t("clearSearch")}
                hitSlop={10}
                style={styles.clear}
              >
                <Ionicons name="close" size={18} color={colors.ink} />
              </Pressable>
            ) : null}
          </View>
          <Logo height={36} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }} style={{ marginTop: 10, marginHorizontal: -space.lg, paddingLeft: space.lg }}>
          {["all", ...kinds].map((k) => {
            const on = k === kind;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setKind(k);
                  setPicked(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.kind, on && styles.kindOn, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
              >
                <Txt variant="smallBold" color={on ? "#fff" : colors.ink} style={{ fontSize: 15 }}>
                  {k === "all" ? t("all") : plainSpecialty(k, locale)}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
        {suggestion ? (
          <View style={styles.note}>
            <Ionicons name="sparkles-outline" size={16} color={colors.primaryDark} />
            <Txt variant="small" color={colors.primaryDark} style={{ flex: 1 }}>
              {suggestion}
            </Txt>
          </View>
        ) : null}
      </View>

      <Pressable onPress={goToMe} accessibilityRole="button" accessibilityLabel={t("myLocation")} style={({ pressed }) => [styles.fab, { bottom: 312, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
        <Ionicons name="navigate" size={22} color="#1D63D8" />
      </Pressable>

      {/* Live strip: who is in view right now. */}
      <View style={styles.strip} pointerEvents="box-none">
        <View style={styles.countRow} pointerEvents="none">
          <View style={styles.count}>
            <Txt variant="smallBold">{t("mapDoctorsHere", { count: inView.length })}</Txt>
            {openCount ? (
              <>
                <View style={styles.dot} />
                <Txt variant="smallBold" color={colors.success}>
                  {t("mapOpenNow", { count: openCount })}
                </Txt>
              </>
            ) : null}
          </View>
        </View>
        {inView.length ? (
          <FlatList
            ref={list}
            data={inView}
            horizontal
            keyExtractor={(d) => d.id}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            snapToInterval={cardW + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: CARD_GAP }}
            getItemLayout={(_, index) => ({ length: cardW + CARD_GAP, offset: (cardW + CARD_GAP) * index, index })}
            onMomentumScrollEnd={(e) => cardSettled(Math.round(e.nativeEvent.contentOffset.x / (cardW + CARD_GAP)))}
            renderItem={({ item: d }) => (
              <DoctorMapCard
                doctor={d}
                width={cardW}
                picked={d.id === picked}
                distance={origin ? distanceKm(origin, { lat: d.latitude!, lng: d.longitude! }) : null}
                onOpen={() => router.push(`/doctor/${d.id}`)}
                onRoute={() => router.push({ pathname: "/route/[id]", params: { id: d.id } })}
                onBook={() => router.push(`/book/${d.id}`)}
              />
            )}
          />
        ) : (
          <View style={[styles.empty, { marginHorizontal: space.lg }]}>
            <Ionicons name={noMatch ? "search-outline" : "map-outline"} size={22} color={colors.muted} />
            <Txt variant="body" color={colors.muted} style={{ flex: 1 }}>
              {noMatch ? t("mapNoMatch", { q }) : t("mapNoneHere")}
            </Txt>
          </View>
        )}
      </View>
    </View>
  );
}

function DoctorMapCard({ doctor: d, width, picked, distance, onOpen, onRoute, onBook }: { doctor: Doctor; width: number; picked: boolean; distance: number | null; onOpen: () => void; onRoute: () => void; onBook: () => void }) {
  const { t, locale } = useI18n();
  const fee = effectiveFee(d);
  return (
    <View style={[styles.card, { width }, picked && styles.cardPicked]}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <DoctorAvatar doctor={d} size={50} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="subheading" numberOfLines={1}>
            {localName(d.name, locale)}
          </Txt>
          <Txt variant="small" color={colors.muted} numberOfLines={1}>
            {[plainSpecialty(d.specialtyId, locale), localName(d.hospitalName, locale)].filter(Boolean).join(" · ")}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
        {distance != null ? (
          <View style={[styles.fact, { backgroundColor: "#EEF3FC" }]}>
            <Ionicons name="location" size={14} color="#17468F" />
            <Txt variant="smallBold" color="#17468F" style={{ marginLeft: 4 }}>
              {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
            </Txt>
          </View>
        ) : null}
        {fee != null ? (
          <View style={[styles.fact, { backgroundColor: colors.bg }]}>
            <Txt variant="smallBold">{t("fullFee", { fee: rupees(fee) })}</Txt>
          </View>
        ) : null}
        <OpenLine doctor={d} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button label={t("route")} icon="navigate" variant="secondary" size="md" style={{ flex: 1 }} onPress={onRoute} />
        <Button label={t("bookVisit")} size="md" style={{ flex: 1.5 }} onPress={onBook} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: space.lg },
  search: { flex: 1, flexDirection: "row", alignItems: "center", minHeight: 54, paddingLeft: space.lg, paddingRight: 8, borderRadius: 18, backgroundColor: "#fff", elevation: 5, shadowColor: "#10231F", shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  input: { flex: 1, minHeight: 50, marginLeft: 10, fontSize: 16, color: colors.ink },
  clear: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  kind: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: 22, backgroundColor: "#fff", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff", elevation: 3, shadowColor: "#10231F", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  kindOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  note: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: colors.primarySoft },
  fab: { position: "absolute", right: space.lg, width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#10231F", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  strip: { position: "absolute", left: 0, right: 0, bottom: 16, gap: 8 },
  countRow: { flexDirection: "row", paddingHorizontal: space.lg },
  count: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: "#fff", elevation: 3, shadowColor: "#10231F", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  card: { backgroundColor: "#fff", borderRadius: 22, padding: space.md + 2, gap: space.md, borderWidth: 2, borderColor: "#fff", elevation: 8, shadowColor: "#10231F", shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  cardPicked: { borderColor: PICKED },
  fact: { flexDirection: "row", alignItems: "center", minHeight: 30, paddingHorizontal: 10, borderRadius: radius.md - 2 },
  empty: { flexDirection: "row", alignItems: "center", gap: 10, padding: space.lg, borderRadius: 22, backgroundColor: "#fff", elevation: 6 },
});
