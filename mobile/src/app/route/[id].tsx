import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pulse } from "../../components/Motion";
import { Button, Loading, Logo, Txt } from "../../components/ui";
import { formatShortDate, istDateString } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { localName } from "../../lib/translit";
import { useHomePlace } from "../../lib/location";
import { askForPosition, getMapbox, hasLiveMap, km, leaveBy, MAP_STYLE, minutes, useRoutes, type LatLng, type TravelMode } from "../../lib/map";
import { useDoctors } from "../../lib/queries";
import { callNumber, mapsLink, openDirections } from "../../lib/support";
import { colors, space } from "../../lib/theme";

const MODES: { id: TravelMode; label: "modeCar" | "modeAuto" | "modeWalk"; by: "byCar" | "byAuto" | "onFoot" }[] = [
  { id: "car", label: "modeCar", by: "byCar" },
  { id: "auto", label: "modeAuto", by: "byAuto" },
  { id: "walk", label: "modeWalk", by: "onFoot" },
];

/**
 * "On the way": the route from you to the hospital on a live map, with Car / Auto / Walk times and, for a booked
 * visit, when to leave. Start directions opens the in-app navigator (Google Maps when there's no live map). Params: id = doctor id,
 * date = visit day (YYYY-MM-DD), start = visit start (HH:mm) when known.
 */
export default function RouteScreen() {
  const { id, date, start } = useLocalSearchParams<{ id: string; date?: string; start?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const doctors = useDoctors();
  const { place } = useHomePlace();
  const d = doctors.data?.find((x) => x.id === id);
  const [me, setMe] = useState<LatLng | null>(null);
  const [asked, setAsked] = useState(false);
  const [mode, setMode] = useState<TravelMode>("auto");

  // Opening a route is a clear reason to ask for location; if the patient says no, start from their area.
  useEffect(() => {
    askForPosition()
      .then(setMe)
      .finally(() => setAsked(true));
  }, []);

  const from: LatLng | null = me ?? (place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : null);
  const to: LatLng | null = d?.latitude != null && d?.longitude != null ? { lat: d.latitude, lng: d.longitude } : null;
  const routes = useRoutes(from, to);
  const cur = routes.data?.[mode] ?? null;
  const leave = cur ? leaveBy(start, cur.seconds) : null;
  const startLabel = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})/.exec(start ?? "");
    if (!m) return null;
    const h = Number(m[1]);
    return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
  }, [start]);

  if (!d) return <Loading />;
  const M = getMapbox();
  const target = { lat: d.latitude, lng: d.longitude, query: [d.hospitalName, d.address, d.city].filter(Boolean).join(", ") };
  const dayLabel = date ? (date === istDateString() ? t("today") : date === istDateString(1) ? t("tomorrow") : formatShortDate(date, locale)) : null;
  const line = cur?.line ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#ECEFE7" }}>
      {M && from && to ? (
        <M.MapView style={StyleSheet.absoluteFill} styleURL={`mapbox://styles/${MAP_STYLE}`} scaleBarEnabled={false} compassEnabled={false} pitchEnabled={false} rotateEnabled={false} logoPosition={{ bottom: 380, left: 12 }} attributionPosition={{ bottom: 380, right: 12 }}>
          <M.Camera
            bounds={{ ne: [Math.max(from.lng, to.lng), Math.max(from.lat, to.lat)], sw: [Math.min(from.lng, to.lng), Math.min(from.lat, to.lat)], paddingTop: insets.top + 110, paddingBottom: 400, paddingLeft: 50, paddingRight: 50 }}
            animationDuration={600}
          />
          {me ? <M.LocationPuck puckBearingEnabled={false} pulsing={{ isEnabled: true, color: "#1D63D8" }} /> : null}
          {line.length > 1 ? (
            <M.ShapeSource id="route" shape={{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line.map((p) => [p.lng, p.lat]) } }}>
              <M.LineLayer id="route-casing" style={{ lineColor: "#FFFFFF", lineWidth: 11, lineCap: "round", lineJoin: "round" }} />
              <M.LineLayer id="route-line" style={{ lineColor: mode === "walk" ? colors.primary : "#1D63D8", lineWidth: 7, lineCap: "round", lineJoin: "round", ...(mode === "walk" ? { lineDasharray: [0.2, 1.6] } : {}) }} />
            </M.ShapeSource>
          ) : null}
          {!me ? (
            <M.MarkerView coordinate={[from.lng, from.lat]} allowOverlap>
              <Pulse size={18} color="#1D63D8" />
            </M.MarkerView>
          ) : null}
          <M.MarkerView coordinate={[to.lng, to.lat]} anchor={{ x: 0.5, y: 1 }} allowOverlap>
            <View style={styles.clinicPin} accessibilityLabel={localName(d.hospitalName ?? d.name, locale)}>
              <Ionicons name="medkit" size={20} color="#fff" />
            </View>
          </M.MarkerView>
        </M.MapView>
      ) : null}

      <View style={[styles.header, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("back")} style={({ pressed }) => [styles.round, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Txt variant="heading" style={{ flex: 1 }}>
          {t("onTheWay")}
        </Txt>
        <Logo height={36} />
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grip} />
        <View style={{ gap: 3 }}>
          <Txt variant="eyebrow" color={colors.muted} numberOfLines={1}>
            {[dayLabel, localName(d.name, locale), startLabel].filter(Boolean).join(" · ")}
          </Txt>
          <Txt variant="heading" numberOfLines={2}>
            {localName(d.hospitalName ?? d.name, locale)}
          </Txt>
          <Txt variant="bodyBold" color={colors.success}>
            {cur
              ? leave && startLabel
                ? t("reachBy", { leave, start: startLabel })
                : t("routeSummary", { min: minutes(cur.seconds), mode: t(MODES.find((m) => m.id === mode)!.by), dist: km(cur.meters) })
              : routes.isFetching || !asked
                ? t("findingWay")
                : !from
                  ? t("locationForTime")
                  : t("noRoute")}
          </Txt>
        </View>

        <View style={styles.modes} accessibilityRole="radiogroup">
          {MODES.map((m) => {
            const on = m.id === mode;
            const r = routes.data?.[m.id];
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setMode(m.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.mode, on && styles.modeOn]}
              >
                <Txt variant="bodyBold" color={on ? colors.primaryDark : colors.text}>
                  {t(m.label)}
                </Txt>
                <Txt variant="small" color={on ? colors.primaryDark : colors.muted}>
                  {r ? (m.id === "auto" ? t("aboutMin", { min: minutes(r.seconds) }) : `${minutes(r.seconds)} min`) : "–"}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {!from && asked ? <Button label={t("allowLocation")} icon="locate" variant="outline" size="md" onPress={() => askForPosition().then(setMe)} /> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          {d.hospitalPhone ? <Button label={t("callHospital")} icon="call" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => callNumber(d.hospitalPhone!)} /> : null}
          <Button
            label={t("shareTrip")}
            icon="share-social"
            variant="secondary"
            size="md"
            style={{ flex: 1 }}
            onPress={() => void Share.share({ message: t("shareTripMessage", { hospital: d.hospitalName ?? "", doctor: d.name, link: mapsLink(target) }) })}
          />
        </View>
        <Button
          label={t("startDirections")}
          icon="navigate"
          onPress={() => (hasLiveMap() && to ? router.push({ pathname: "/navigate/[id]", params: { id: d.id, mode } }) : openDirections(target, mode))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: space.lg },
  round: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#10231F", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  clinicPin: { width: 44, height: 44, borderRadius: 22, borderBottomLeftRadius: 5, backgroundColor: "#C2410C", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.lg, paddingTop: 10, gap: space.md + 2, elevation: 12, shadowColor: "#10231F", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -6 } },
  grip: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
  modes: { flexDirection: "row", gap: 6, padding: 5, borderRadius: 18, backgroundColor: colors.segment },
  mode: { flex: 1, minHeight: 58, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modeOn: { backgroundColor: "#fff", elevation: 2, shadowColor: "#10231F", shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
});
