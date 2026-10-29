import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReduceMotion } from "../components/Motion";
import { Button, Chip, Logo, Txt } from "../components/ui";
import { distanceKm, type Doctor } from "../lib/api/doctors";
import { useI18n } from "../lib/i18n";
import { useHomePlace } from "../lib/location";
import { doctorCityNear } from "../lib/doctorCity";
import { askForPosition, lookupProblem, placeNames, getMapbox, MAP_STYLE, type LatLng, type PlaceNames } from "../lib/map";
import { useDoctors } from "../lib/queries";
import { colors, space } from "../lib/theme";

const PIN_TIP = 62; // pin head 48 + stem 14

type CameraHandle = { setCamera: (c: { centerCoordinate?: [number, number]; zoomLevel?: number; animationDuration?: number }) => void };

/**
 * Pick your area by sliding the map under a fixed pin, instead of choosing from a list of cities. The name of the
 * place under the pin shows as you move; the city that decides which doctors you see is the nearest city that has
 * doctors. "Use where I am now" jumps to the phone's position.
 */
export default function AreaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const doctors = useDoctors();
  const { place, setPlace } = useHomePlace();
  const { height: screenH } = useWindowDimensions();
  const reduce = useReduceMotion();
  const camera = useRef<CameraHandle | null>(null);
  const [center, setCenter] = useState<LatLng | null>(null);
  // True while the map is moving or the spot is being named: the sheet shows "…" rather than a guess.
  const [naming, setNaming] = useState(false);
  const [names, setNames] = useState<PlaceNames | null>(place?.area || place?.town ? { area: place?.area ?? null, town: place?.town ?? null, match: place?.town ? [place.town] : [] } : null);
  // The city chip just tapped: lit at once, before the map finishes moving there.
  const [picked, setPicked] = useState<string | null>(null);
  const drop = useRef(new Animated.Value(0)).current;

  const pinned = useMemo(() => (doctors.data ?? []).filter((d) => d.latitude != null && d.longitude != null), [doctors.data]);
  // Each city's centre, so a city chip can move the map there: the spot with the most of that city's doctors within
  // 25 km — not the average of all its pins, which a few mislabelled pins far away would drag into the middle of nowhere.
  const cityCentres = useMemo(() => {
    const m = new Map<string, { city: string; state: string; pins: LatLng[] }>();
    for (const d of pinned) {
      const k = `${d.city}|${d.state}`;
      const e = m.get(k) ?? { city: d.city, state: d.state, pins: [] };
      e.pins.push({ lat: d.latitude!, lng: d.longitude! });
      m.set(k, e);
    }
    return [...m.values()].map((e) => {
      const spots = new Map<string, LatLng>();
      for (const p of e.pins) spots.set(`${p.lat.toFixed(3)},${p.lng.toFixed(3)}`, p);
      let best = e.pins[0];
      let bestN = -1;
      for (const s of spots.values()) {
        const n = e.pins.filter((p) => distanceKm(s, p) <= 25).length;
        if (n > bestN) {
          bestN = n;
          best = s;
        }
      }
      return { city: e.city, state: e.state, lat: best.lat, lng: best.lng, n: e.pins.length };
    });
  }, [pinned]);
  // The doctor city here: only a directory city the map agrees is this town (see lib/doctorCity.ts).
  // While naming, there is no answer yet (never the nearest doctor's city, which can be a mislabelled test pin).
  const nearestDoctor = (p: LatLng): Doctor | undefined => (naming ? undefined : doctorCityNear(p, names ? names.match : null, pinned));

  const startAt: LatLng | null =
    place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : (cityCentres.find((c) => c.city.toLowerCase() === place?.city?.toLowerCase()) ?? cityCentres[0] ?? null);

  // Name the place under the pin once the map stops moving.
  useEffect(() => {
    if (!center) return;
    let live = true;
    setNaming(true);
    const id = setTimeout(() => {
      placeNames(center, locale)
        .then((n) => {
          if (!live) return;
          setNames(n);
          setNaming(false);
        })
        .catch(() => live && setNaming(false));
    }, 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [center, locale]);

  const bounce = () => {
    Haptics.selectionAsync().catch(() => {});
    if (reduce) return;
    drop.setValue(-26);
    Animated.spring(drop, { toValue: 0, friction: 4, tension: 160, useNativeDriver: true }).start();
  };
  // Short hops glide; a jump to another city is instant (gliding hundreds of km loads every tile on the way and feels stuck).
  const moveTo = (p: LatLng, zoom = 14) =>
    camera.current?.setCamera({ centerCoordinate: [p.lng, p.lat], zoomLevel: zoom, animationDuration: center && distanceKm(center, p) > 30 ? 0 : 450 });

  const M = getMapbox();
  const city = useMemo(() => (center ? nearestDoctor(center) : undefined), [center, pinned, names, naming]); // eslint-disable-line react-hooks/exhaustive-deps
  // Chips stay in one order (nearest to where the screen opened), so they don't jump about under the finger.
  const chips = useMemo(
    () =>
      cityCentres
        .slice()
        .sort((a, b) => (startAt ? distanceKm(startAt, a) - distanceKm(startAt, b) : b.n - a.n))
        .slice(0, 4),
    [cityCentres], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const selectedKey = picked ?? (city ? `${city.city}|${city.state}` : null);

  async function save() {
    if (!center) return;
    const d = nearestDoctor(center);
    await setPlace({ city: d?.city ?? null, state: d?.state ?? null, lat: center.lat, lng: center.lng, area: names?.area ?? null, town: names?.town ?? null });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#ECEFE7" }}>
      {M && startAt ? (
        // A finger on the map un-picks the city chip; moving the map starts naming the new spot.
        <View
          style={StyleSheet.absoluteFill}
          onTouchStart={() => setPicked(null)}
        >
        <M.MapView
          style={StyleSheet.absoluteFill}
          styleURL={`mapbox://styles/${MAP_STYLE}`}
          scaleBarEnabled={false}
          compassEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          logoPosition={{ bottom: 330, left: 12 }}
          attributionPosition={{ bottom: 330, right: 12 }}
          onCameraChanged={(s) => {
            if (s.gestures.isGestureActive) setNaming(true);
          }}
          onMapIdle={(s) => {
            const [lng, lat] = s.properties.center;
            setCenter({ lat, lng });
          }}
        >
          <M.Camera
            ref={(r) => {
              camera.current = r as unknown as CameraHandle | null;
            }}
            defaultSettings={{ centerCoordinate: [startAt.lng, startAt.lat], zoomLevel: 14 }}
          />
        </M.MapView>
        </View>
      ) : null}

      {/* The pin's tip sits exactly on the map's centre (the middle of the screen); the map moves under it. */}
      <View pointerEvents="none" style={[styles.pinWrap, { top: screenH / 2 - PIN_TIP }]}>
        <Animated.View style={{ alignItems: "center", transform: [{ translateY: drop }] }}>
          <View style={styles.pinHead}>
            <View style={styles.pinDot} />
          </View>
          <View style={styles.pinStem} />
        </Animated.View>
        <View style={styles.pinShadow} />
      </View>

      <View style={[styles.header, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("back")} style={({ pressed }) => [styles.round, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.title}>
          <Txt variant="bodyBold" numberOfLines={1}>
            {t("pickAreaTitle")}
          </Txt>
        </View>
        <Logo height={36} />
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grip} />
        <View style={{ gap: 3 }} accessibilityLiveRegion="polite">
          <Txt variant="eyebrow" color={colors.muted}>
            {t("yourArea")}
          </Txt>
          <Txt variant="heading" numberOfLines={1}>
            {naming ? "…" : [names?.area, names ? names.town : city?.city].filter(Boolean).join(", ") || "…"}
          </Txt>
          {/* For testers: why this spot has no name (both the map's and the phone's lookups failed). */}
          {!naming && !names && lookupProblem() ? (
            <Txt variant="tiny" color={colors.muted} numberOfLines={2}>
              {t("placeLookupFailed", { why: lookupProblem() ?? "" })}
            </Txt>
          ) : null}
        </View>
        <Button
          label={t("useWhereIAm")}
          icon="locate"
          variant="outline"
          size="md"
          onPress={async () => {
            const p = await askForPosition();
            if (!p) return;
            bounce();
            moveTo(p, 15);
          }}
        />
        {chips.length ? (
          <View style={{ gap: space.sm }}>
            <Txt variant="smallBold" color={colors.muted}>
              {t("citiesWithDoctors")}
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {chips.map((c) => (
                <Chip
                  key={`${c.city}|${c.state}`}
                  label={c.city}
                  selected={selectedKey === `${c.city}|${c.state}`}
                  onPress={() => {
                    setPicked(`${c.city}|${c.state}`);
                    setNaming(true);
                    bounce();
                    moveTo(c, 13);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}
        <Button label={t("setThisArea")} onPress={save} disabled={!center || naming} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: space.lg },
  round: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#10231F", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  title: { flex: 1, minHeight: 52, justifyContent: "center", paddingHorizontal: space.lg, borderRadius: 18, backgroundColor: "#fff", elevation: 4, shadowColor: "#10231F", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  pinWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  pinHead: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, borderColor: "#fff", backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", elevation: 6 },
  pinDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" },
  pinStem: { width: 4, height: 14, backgroundColor: colors.primary, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  pinShadow: { width: 28, height: 10, borderRadius: 14, backgroundColor: "rgba(16,35,31,0.3)", marginTop: -2 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.lg, paddingTop: 10, gap: space.md + 2, elevation: 12, shadowColor: "#10231F", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: -6 } },
  grip: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong },
});
