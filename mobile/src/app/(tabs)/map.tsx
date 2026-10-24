import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoctorAvatar } from "../../components/DoctorCard";
import { RiseIn } from "../../components/Motion";
import { Button, EmptyState, Logo, Txt } from "../../components/ui";
import { distanceKm, type Doctor } from "../../lib/api/doctors";
import { useI18n } from "../../lib/i18n";
import { useHomePlace } from "../../lib/location";
import { askForPosition, getMapbox, MAP_STYLE, useQuietPosition, type LatLng } from "../../lib/map";
import { useDoctors } from "../../lib/queries";
import { plainSpecialty } from "../../lib/specialties";
import { colors, radius, space } from "../../lib/theme";

type CameraHandle = { setCamera: (c: { centerCoordinate?: [number, number]; zoomLevel?: number; animationDuration?: number }) => void };
type SourceHandle = { getClusterExpansionZoom: (f: GeoJSON.Feature) => Promise<number> };

/**
 * Map tab: every doctor with a map pin, grouped into numbered bubbles when zoomed out. Tap a pin and the doctor's
 * card slides up with distance, Route and Book. Chips at the top show one kind of doctor; the blue dot is you
 * (only after you allow location). Falls back to a plain message and the list where the map isn't built in.
 */
export default function MapScreen() {
  const M = getMapbox();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const doctors = useDoctors();
  const { place } = useHomePlace();
  const quiet = useQuietPosition();
  const [me, setMe] = useState<LatLng | null>(null);
  const [kind, setKind] = useState<string>("all");
  const [picked, setPicked] = useState<string | null>(null);
  const camera = useRef<CameraHandle | null>(null);
  const source = useRef<SourceHandle | null>(null);

  const here = me ?? quiet;
  const origin: LatLng | null = here ?? (place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : null);

  const pinned = useMemo(() => (doctors.data ?? []).filter((d) => d.latitude != null && d.longitude != null), [doctors.data]);
  // The four kinds of doctor most common in the patient's city (or everywhere), plus All.
  const kinds = useMemo(() => {
    const inCity = place?.city ? pinned.filter((d) => d.city.toLowerCase() === place.city!.toLowerCase()) : pinned;
    const counts = new Map<string, number>();
    for (const d of inCity) counts.set(d.specialtyId, (counts.get(d.specialtyId) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
  }, [pinned, place?.city]);
  const shown = useMemo(() => (kind === "all" ? pinned : pinned.filter((d) => d.specialtyId === kind)), [pinned, kind]);
  const sel = shown.find((d) => d.id === picked) ?? null;

  const shape = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: shown.map((d) => ({ type: "Feature", id: d.id, properties: { id: d.id, tag: d.initials.slice(0, 2) }, geometry: { type: "Point", coordinates: [d.longitude!, d.latitude!] } })),
    }),
    [shown],
  );

  // Start on you, else on your area, else on the doctors in your city.
  const start = useMemo<LatLng | null>(() => {
    if (origin) return origin;
    const list = place?.city ? pinned.filter((d) => d.city.toLowerCase() === place.city!.toLowerCase()) : pinned;
    if (!list.length) return null;
    return { lat: list.reduce((a, d) => a + d.latitude!, 0) / list.length, lng: list.reduce((a, d) => a + d.longitude!, 0) / list.length };
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

  function pick(d: Doctor) {
    Haptics.selectionAsync().catch(() => {});
    setPicked(d.id);
  }

  const dist = sel && origin ? distanceKm(origin, { lat: sel.latitude!, lng: sel.longitude! }) : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#ECEFE7" }}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={`mapbox://styles/${MAP_STYLE}`}
        scaleBarEnabled={false}
        compassEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        logoPosition={{ bottom: sel ? 236 : 96, left: 12 }}
        attributionPosition={{ bottom: sel ? 236 : 96, right: 12 }}
        onPress={() => setPicked(null)}
      >
        <Camera
          ref={(r) => {
            camera.current = r as unknown as CameraHandle | null;
          }}
          defaultSettings={start ? { centerCoordinate: [start.lng, start.lat], zoomLevel: origin ? 13 : 11 } : { centerCoordinate: [78.9, 22.6], zoomLevel: 4 }}
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
          clusterMaxZoomLevel={13}
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
            if (d) pick(d);
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
          <CircleLayer
            id="doctor-pins"
            filter={["!", ["has", "point_count"]]}
            style={{
              circleColor: ["case", ["==", ["get", "id"], picked ?? ""], "#C2410C", colors.primary],
              circleRadius: ["case", ["==", ["get", "id"], picked ?? ""], 22, 17],
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
        </ShapeSource>
      </MapView>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => router.push("/doctors")} accessibilityRole="search" style={({ pressed }) => [styles.search, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Ionicons name="search" size={20} color={colors.ink} />
            <Txt color={colors.muted} style={{ marginLeft: 10, flex: 1 }} numberOfLines={1}>
              {t("searchPlaceholder")}
            </Txt>
          </Pressable>
          <Logo height={36} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }} style={{ marginTop: 10, marginHorizontal: -space.lg, paddingLeft: space.lg }}>
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
      </View>

      <Pressable onPress={goToMe} accessibilityRole="button" accessibilityLabel={t("myLocation")} style={({ pressed }) => [styles.fab, { bottom: sel ? 250 : 112, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
        <Ionicons name="navigate" size={22} color="#1D63D8" />
      </Pressable>

      {sel ? (
        <RiseIn key={sel.id} style={styles.sheet}>
          <View style={styles.grip} />
          <Pressable onPress={() => router.push(`/doctor/${sel.id}`)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <DoctorAvatar doctor={sel} size={52} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="subheading" numberOfLines={1}>
                {sel.name}
              </Txt>
              <Txt variant="small" color={colors.muted} numberOfLines={1}>
                {[plainSpecialty(sel.specialtyId, locale), sel.hospitalName].filter(Boolean).join(" · ")}
              </Txt>
            </View>
          </Pressable>
          <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
            {dist != null ? (
              <View style={[styles.fact, { backgroundColor: "#EEF3FC" }]}>
                <Ionicons name="location" size={15} color="#17468F" />
                <Txt variant="smallBold" color="#17468F" style={{ marginLeft: 6 }}>
                  {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                </Txt>
              </View>
            ) : null}
            {sel.isAvailableToday ? (
              <View style={[styles.fact, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="time" size={15} color={colors.success} />
                <Txt variant="smallBold" color={colors.success} style={{ marginLeft: 6 }}>
                  {t("availableToday")}
                </Txt>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label={t("route")} icon="navigate" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/route/[id]", params: { id: sel.id } })} />
            <Button label={t("bookVisit")} style={{ flex: 1.4 }} onPress={() => router.push(`/book/${sel.id}`)} />
          </View>
        </RiseIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: space.lg },
  search: { flex: 1, flexDirection: "row", alignItems: "center", minHeight: 54, paddingHorizontal: space.lg, borderRadius: 18, backgroundColor: "#fff", elevation: 5, shadowColor: "#10231F", shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  kind: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: 22, backgroundColor: "#fff", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff", elevation: 3, shadowColor: "#10231F", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  kindOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  fab: { position: "absolute", right: space.lg, width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#10231F", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.lg, paddingTop: 10, gap: space.md, elevation: 12, shadowColor: "#10231F", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -6 } },
  grip: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  fact: { flexDirection: "row", alignItems: "center", minHeight: 34, paddingHorizontal: 12, borderRadius: radius.md - 2 },
});
