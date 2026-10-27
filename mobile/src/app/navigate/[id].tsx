import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Loading, Txt } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { getMapbox, km, MAP_STYLE, meters, minutes, navRoute, snapToLine, type LatLng, type NavRoute, type NavStep, type TravelMode } from "../../lib/map";
import { useDoctors } from "../../lib/queries";
import { SPEECH_LANG } from "../../lib/speech";
import { speakable } from "../../lib/spokenNumbers";
import { openDirections } from "../../lib/support";
import { colors, space } from "../../lib/theme";
import { localName } from "../../lib/translit";

/** How far off the line (m) counts as a wrong turn, and when to say the turn itself. */
const OFF_ROUTE = { car: 55, auto: 55, walk: 35 } as const;
const SAY_NOW = { car: 70, auto: 60, walk: 20 } as const;
const ARRIVED_M = 35;

const ICON: Record<NavStep["kind"], { name: keyof typeof Ionicons.glyphMap; turn?: number }> = {
  depart: { name: "navigate" },
  arrive: { name: "flag" },
  straight: { name: "arrow-up" },
  left: { name: "arrow-up", turn: -90 },
  right: { name: "arrow-up", turn: 90 },
  slightLeft: { name: "arrow-up", turn: -40 },
  slightRight: { name: "arrow-up", turn: 40 },
  sharpLeft: { name: "arrow-up", turn: -135 },
  sharpRight: { name: "arrow-up", turn: 135 },
  keepLeft: { name: "arrow-up", turn: -25 },
  keepRight: { name: "arrow-up", turn: 25 },
  uturn: { name: "arrow-undo" },
  roundabout: { name: "sync" },
};

/**
 * In-app turn-by-turn: follows the phone's position along a Mapbox route, shows the next turn and speaks it in the
 * patient's language, finds a new way after a wrong turn, and says when they've arrived. The screen stays on.
 * Params: id = doctor id, mode = car | auto | walk.
 */
export default function NavigateScreen() {
  useKeepAwake();
  const { id, mode: modeParam } = useLocalSearchParams<{ id: string; mode?: string }>();
  const mode: TravelMode = modeParam === "car" || modeParam === "walk" ? modeParam : "auto";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const doctors = useDoctors();
  const d = doctors.data?.find((x) => x.id === id);
  const to: LatLng | null = d?.latitude != null && d?.longitude != null ? { lat: d.latitude, lng: d.longitude } : null;

  const [me, setMe] = useState<(LatLng & { heading: number | null }) | null>(null);
  const [denied, setDenied] = useState(false);
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [voice, setVoice] = useState(true);
  const [following, setFollowing] = useState(true);
  const [arrived, setArrived] = useState(false);

  // Mutable trip state that changes every GPS fix but shouldn't redraw on its own.
  const offCount = useRef(0);
  const lastReroute = useRef(0);
  const said = useRef<Set<string>>(new Set());
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const say = useCallback(
    (text: string) => {
      if (!voiceRef.current) return;
      void Speech.stop();
      Speech.speak(speakable(text, locale), { language: SPEECH_LANG[locale], rate: 0.95 });
    },
    [locale],
  );
  useEffect(() => () => void Speech.stop(), []);

  const action = useCallback(
    (s: NavStep): string => {
      const base =
        s.kind === "roundabout"
          ? s.exit
            ? t("navRoundabout", { n: String(s.exit) })
            : t("navRoundaboutPlain")
          : s.kind === "arrive"
            ? t("navArrive")
            : s.kind === "depart"
              ? t("navStart")
              : t(
                  ({ left: "navLeft", right: "navRight", slightLeft: "navSlightLeft", slightRight: "navSlightRight", sharpLeft: "navSharpLeft", sharpRight: "navSharpRight", uturn: "navUturn", straight: "navStraight", keepLeft: "navKeepLeft", keepRight: "navKeepRight" } as const)[s.kind],
                );
      return s.road && s.kind !== "arrive" && s.kind !== "roundabout" ? t("navOnto", { action: base, road: s.road }) : base;
    },
    [t],
  );

  // Follow the phone's position for as long as the screen is open.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let live = true;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        if (live) setDenied(true);
        return;
      }
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 }, (p) => {
        if (!live) return;
        const h = p.coords.heading;
        setMe({ lat: p.coords.latitude, lng: p.coords.longitude, heading: h != null && h >= 0 && (p.coords.speed ?? 0) > 1 ? h : null });
      });
      if (!live) sub.remove();
    })().catch(() => live && setDenied(true));
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);

  const plan = useCallback(
    async (from: LatLng & { heading: number | null }) => {
      if (!to) return;
      setRerouting(true);
      lastReroute.current = Date.now();
      try {
        const r = await navRoute(mode, from, to, from.heading);
        if (r) {
          setRoute(r);
          setFailed(false);
          said.current = new Set();
          offCount.current = 0;
        } else setFailed(true);
      } catch {
        setFailed(true);
      } finally {
        setRerouting(false);
      }
    },
    [mode, to?.lat, to?.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // First route as soon as we know where the patient is.
  const planned = useRef(false);
  useEffect(() => {
    if (me && to && !planned.current) {
      planned.current = true;
      void plan(me);
    }
  }, [me, to, plan]);

  // Where we are on the route, and what's next.
  const progress = useMemo(() => {
    if (!route || !me) return null;
    const snap = snapToLine(me, route.line, route.cum);
    const next = route.steps.find((s, i) => i > 0 && s.along > snap.along + 5) ?? route.steps[route.steps.length - 1];
    const remaining = Math.max(0, route.meters - snap.along);
    return { snap, next, toNext: Math.max(0, next.along - snap.along), remaining, seconds: route.meters > 0 ? (route.seconds * remaining) / route.meters : 0 };
  }, [route, me]);

  // React to each fix: arrival, wrong turns, and the spoken instructions.
  useEffect(() => {
    if (!progress || !me || !to || arrived) return;
    if (meters(me, to) < ARRIVED_M || progress.remaining < 20) {
      setArrived(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      say(t("navArrive"));
      return;
    }
    if (progress.snap.off > OFF_ROUTE[mode]) {
      offCount.current += 1;
      if (offCount.current >= 3 && !rerouting && Date.now() - lastReroute.current > 15000) {
        say(t("navRerouting"));
        void plan(me);
      }
      return;
    }
    offCount.current = 0;
    const key = `${progress.next.along}`;
    const text = action(progress.next);
    if (!said.current.has(`${key}:early`) && progress.toNext > SAY_NOW[mode] * 1.5) {
      said.current.add(`${key}:early`);
      say(t("navIn", { dist: km(progress.toNext), action: text }));
    } else if (!said.current.has(`${key}:now`) && progress.toNext <= SAY_NOW[mode]) {
      said.current.add(`${key}:early`);
      said.current.add(`${key}:now`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      say(text);
    }
  }, [progress, me, to, arrived, mode, rerouting, plan, say, action, t]);

  const google = useCallback(() => {
    if (d) openDirections({ lat: d.latitude, lng: d.longitude, query: [d.hospitalName, d.address, d.city].filter(Boolean).join(", ") }, mode);
  }, [d, mode]);

  // No live map in this build, or no coordinates for the hospital: hand over to Google Maps.
  const M = getMapbox();
  const handOver = !!d && (!M || !to);
  useEffect(() => {
    if (!handOver) return;
    google();
    router.back();
  }, [handOver]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d || !M || !to) return <Loading />;
  const hospital = localName(d.hospitalName ?? d.name, locale);
  const end = () => {
    void Speech.stop();
    router.back();
  };

  const line = route?.line ?? [];
  const done = progress && route ? route.line.slice(0, progress.snap.seg + 1).concat([{ lat: me!.lat, lng: me!.lng }]) : [];
  const eta = progress ? new Date(Date.now() + progress.seconds * 1000) : null;
  const etaLabel = eta ? `${((eta.getHours() + 11) % 12) + 1}:${String(eta.getMinutes()).padStart(2, "0")} ${eta.getHours() < 12 ? "AM" : "PM"}` : "";
  const icon = progress ? ICON[progress.next.kind] : ICON.depart;
  const banner = arrived
    ? t("navArrive")
    : denied
      ? t("locationForNav")
      : rerouting
        ? t("navRerouting")
        : failed
          ? t("noRoute")
          : progress
            ? action(progress.next)
            : t("navWaitingGps");

  return (
    <View style={{ flex: 1, backgroundColor: "#ECEFE7" }}>
      <M.MapView
        style={StyleSheet.absoluteFill}
        styleURL={`mapbox://styles/${MAP_STYLE}`}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoPosition={{ bottom: insets.bottom + 150, left: 12 }}
        attributionPosition={{ bottom: insets.bottom + 150, right: 12 }}
      >
        <M.Camera
          followUserLocation={following}
          followUserMode={M.UserTrackingMode.FollowWithCourse}
          followZoomLevel={mode === "walk" ? 17.5 : 16.5}
          followPitch={50}
          followPadding={{ paddingTop: insets.top + 160, paddingBottom: insets.bottom + 200 }}
          onUserTrackingModeChange={(e) => {
            if (!e.nativeEvent.payload.followUserLocation) setFollowing(false);
          }}
        />
        <M.LocationPuck puckBearingEnabled puckBearing="course" pulsing={{ isEnabled: true, color: "#1D63D8" }} />
        {line.length > 1 ? (
          <M.ShapeSource id="nav-route" shape={{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line.map((p) => [p.lng, p.lat]) } }}>
            <M.LineLayer id="nav-casing" style={{ lineColor: "#FFFFFF", lineWidth: 13, lineCap: "round", lineJoin: "round" }} />
            <M.LineLayer id="nav-line" style={{ lineColor: mode === "walk" ? colors.primary : "#1D63D8", lineWidth: 9, lineCap: "round", lineJoin: "round" }} />
          </M.ShapeSource>
        ) : null}
        {done.length > 1 ? (
          <M.ShapeSource id="nav-done" shape={{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: done.map((p) => [p.lng, p.lat]) } }}>
            <M.LineLayer id="nav-done-line" aboveLayerID="nav-line" style={{ lineColor: "#A7B0AD", lineWidth: 9, lineCap: "round", lineJoin: "round" }} />
          </M.ShapeSource>
        ) : null}
        <M.MarkerView coordinate={[to.lng, to.lat]} anchor={{ x: 0.5, y: 1 }} allowOverlap>
          <View style={styles.clinicPin} accessibilityLabel={hospital}>
            <Ionicons name="medkit" size={20} color="#fff" />
          </View>
        </M.MarkerView>
      </M.MapView>

      {/* Next turn */}
      <View style={[styles.banner, { top: insets.top + space.sm }]} accessibilityLiveRegion="polite">
        <View style={styles.turnIcon}>
          <Ionicons name={arrived ? "flag" : icon.name} size={34} color="#fff" style={icon.turn && !arrived ? { transform: [{ rotate: `${icon.turn}deg` }] } : undefined} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {progress && !arrived && !rerouting && !failed ? (
            <Txt variant="title" color="#fff">
              {km(progress.toNext)}
            </Txt>
          ) : null}
          <Txt variant="bodyBold" color="#fff" numberOfLines={3}>
            {banner}
          </Txt>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            if (voice) void Speech.stop();
            setVoice(!voice);
          }}
          accessibilityRole="button"
          accessibilityLabel={voice ? t("navMute") : t("navUnmute")}
          style={styles.voiceBtn}
        >
          <Ionicons name={voice ? "volume-high" : "volume-mute"} size={24} color="#fff" />
        </Pressable>
      </View>

      {!following && !arrived ? (
        <Pressable onPress={() => setFollowing(true)} accessibilityRole="button" style={[styles.recenter, { bottom: insets.bottom + 170 }]}>
          <Ionicons name="locate" size={20} color={colors.primaryDark} />
          <Txt variant="bodyBold" color={colors.primaryDark}>
            {t("navRecenter")}
          </Txt>
        </Pressable>
      ) : null}

      {/* Trip summary */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
        {arrived ? (
          <>
            <Txt variant="heading">{t("navArrive")}</Txt>
            <Txt variant="body" color={colors.muted}>
              {t("navArrivedHint", { hospital })}
            </Txt>
            <Button label={t("done")} icon="checkmark" onPress={end} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading" color={colors.success}>
                  {progress ? t("navLeft2", { min: String(minutes(progress.seconds)), dist: km(progress.remaining) }) : "–"}
                </Txt>
                <Txt variant="small" color={colors.muted} numberOfLines={1}>
                  {[progress ? t("navEta", { eta: etaLabel }) : null, hospital].filter(Boolean).join(" · ")}
                </Txt>
              </View>
              <Button label={t("navEnd")} icon="close" variant="secondary" size="md" onPress={end} />
            </View>
            {denied || failed ? <Button label={t("openInGoogleMaps")} icon="navigate" variant="outline" size="md" onPress={google} /> : null}
            {!denied && !failed ? (
              <Pressable onPress={google} accessibilityRole="link" style={{ alignSelf: "center", padding: 4 }}>
                <Txt variant="small" color={colors.muted} style={{ textDecorationLine: "underline" }}>
                  {t("openInGoogleMaps")}
                </Txt>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: "absolute", left: space.md, right: space.md, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 22, backgroundColor: "#0B4F49", elevation: 8, shadowColor: "#10231F", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  turnIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  voiceBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  recenter: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 44, borderRadius: 22, backgroundColor: "#fff", elevation: 6, shadowColor: "#10231F", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  clinicPin: { width: 44, height: 44, borderRadius: 22, borderBottomLeftRadius: 5, backgroundColor: "#C2410C", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.lg, gap: space.sm + 2, elevation: 12, shadowColor: "#10231F", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -6 } },
});
