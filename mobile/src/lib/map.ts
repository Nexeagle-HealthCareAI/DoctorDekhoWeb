import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { NativeModules, Platform } from "react-native";
import type { Locale } from "./i18n/types";

/**
 * Mapbox for Doctor Dekho: live maps (Map tab, route, pick your area), still map pictures on Home and the ticket,
 * driving / walking routes, and the name of the area under a pin.
 *
 * Only the PUBLIC token (pk.…) ships in the app, from EXPO_PUBLIC_MAPBOX_TOKEN at build time. Restrict it in the
 * Mapbox account to these APIs. Without a token, or in Expo Go / web where the native map isn't built in,
 * every map surface falls back to the plain list and Google Maps directions.
 */
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

type MapboxModule = typeof import("@rnmapbox/maps");
let cached: MapboxModule | null | undefined;

/** The native map module, or null when it can't be used here (no token, Expo Go, web). */
export function getMapbox(): MapboxModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (!MAPBOX_TOKEN || Platform.OS === "web" || NativeModules.RNMBXModule == null) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("@rnmapbox/maps") as MapboxModule;
    void m.default.setAccessToken(MAPBOX_TOKEN);
    m.default.setTelemetryEnabled?.(false);
    cached = m;
  } catch {
    cached = null;
  }
  return cached;
}

export const hasLiveMap = () => getMapbox() != null;
export const hasMapImages = () => !!MAPBOX_TOKEN;

export interface LatLng {
  lat: number;
  lng: number;
}

export const MAP_STYLE = "mapbox/streets-v12";

/**
 * A still map picture (Mapbox Static Images). Cheaper and faster than a live map, so Home and the ticket use it and
 * the live map opens on tap. Attribution is drawn by the app over the picture ("© Mapbox © OpenStreetMap").
 */
export function staticMapUrl(opts: { center: LatLng; zoom: number; width: number; height: number; pins?: (LatLng & { color?: string; big?: boolean })[]; route?: LatLng[] }): string | null {
  if (!MAPBOX_TOKEN) return null;
  const w = Math.min(640, Math.max(60, Math.round(opts.width)));
  const h = Math.min(640, Math.max(40, Math.round(opts.height)));
  const overlays: string[] = [];
  if (opts.route && opts.route.length > 1) {
    const geo = { type: "Feature", properties: { stroke: "#1D63D8", "stroke-width": 4 }, geometry: { type: "LineString", coordinates: thin(opts.route, 60).map((p) => [round(p.lng), round(p.lat)]) } };
    overlays.push(`geojson(${encodeURIComponent(JSON.stringify(geo))})`);
  }
  for (const p of opts.pins ?? []) overlays.push(`pin-${p.big ? "l" : "s"}+${(p.color ?? "0B6B63").replace("#", "")}(${round(p.lng)},${round(p.lat)})`);
  const overlay = overlays.length ? `${overlays.join(",")}/` : "";
  return `https://api.mapbox.com/styles/v1/${MAP_STYLE}/static/${overlay}${round(opts.center.lng)},${round(opts.center.lat)},${opts.zoom}/${w}x${h}@2x?attribution=false&logo=false&access_token=${MAPBOX_TOKEN}`;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;
function thin<T>(a: T[], max: number): T[] {
  if (a.length <= max) return a;
  const step = (a.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => a[Math.round(i * step)]);
}

export type TravelMode = "car" | "auto" | "walk";
export interface RouteInfo {
  seconds: number;
  meters: number;
  line: LatLng[];
}

async function directions(profile: "driving-traffic" | "walking", from: LatLng, to: LatLng): Promise<RouteInfo | null> {
  if (!MAPBOX_TOKEN) return null;
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] } }[] };
  const r = json.routes?.[0];
  if (!r) return null;
  return { seconds: r.duration, meters: r.distance, line: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })) };
}

// Auto-rickshaws follow the car route but are slower in town; shown as "about" so the estimate is honest.
export const AUTO_FACTOR = 1.25;

/** Car and walking routes from A to B (auto is derived from the car route), cached for 15 minutes. */
export function useRoutes(from: LatLng | null, to: LatLng | null) {
  const key = from && to ? [round(from.lat), round(from.lng), round(to.lat), round(to.lng)] : null;
  return useQuery({
    queryKey: ["routes", key],
    enabled: !!key && !!MAPBOX_TOKEN,
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      const [car, walk] = await Promise.all([directions("driving-traffic", from!, to!).catch(() => null), directions("walking", from!, to!).catch(() => null)]);
      const auto = car ? { ...car, seconds: car.seconds * AUTO_FACTOR } : null;
      return { car, auto, walk } as Record<TravelMode, RouteInfo | null>;
    },
  });
}

// ── In-app navigation ───────────────────────────────────────────────────────────────────────────

/** One manoeuvre: what to do at `at`, and the road it leads onto. Text is built in the app's language from `kind`. */
export interface NavStep {
  kind: "depart" | "arrive" | "left" | "right" | "slightLeft" | "slightRight" | "sharpLeft" | "sharpRight" | "uturn" | "straight" | "keepLeft" | "keepRight" | "roundabout";
  road: string;
  exit?: number;
  at: LatLng;
  /** Distance along the route line (m) where this manoeuvre happens. */
  along: number;
}
export interface NavRoute {
  seconds: number;
  meters: number;
  line: LatLng[];
  /** Cumulative distance (m) along `line` at each point. */
  cum: number[];
  steps: NavStep[];
}

type RawStep = { name?: string; maneuver: { type: string; modifier?: string; exit?: number; location: [number, number] } };

function stepKind(m: RawStep["maneuver"]): NavStep["kind"] {
  if (m.type === "arrive") return "arrive";
  if (m.type === "depart") return "depart";
  if (m.type === "roundabout" || m.type === "rotary" || m.type === "exit roundabout" || m.type === "exit rotary") return "roundabout";
  const mod = m.modifier ?? "straight";
  if (m.type === "fork" || m.type === "merge" || m.type === "on ramp" || m.type === "off ramp") {
    if (mod.includes("left")) return "keepLeft";
    if (mod.includes("right")) return "keepRight";
    return "straight";
  }
  switch (mod) {
    case "uturn": return "uturn";
    case "sharp right": return "sharpRight";
    case "right": return "right";
    case "slight right": return "slightRight";
    case "sharp left": return "sharpLeft";
    case "left": return "left";
    case "slight left": return "slightLeft";
    default: return "straight";
  }
}

/** Distance in metres between two points (haversine). */
export function meters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Where `p` sits on the line: distance along it (m), how far off it (m), and the segment index. Uses a flat
 * projection around `p`, which is exact enough at street scale.
 */
export function snapToLine(p: LatLng, line: LatLng[], cum: number[]): { along: number; off: number; seg: number } {
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110540;
  let best = { along: 0, off: Infinity, seg: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i].lng - p.lng) * kx, ay = (line[i].lat - p.lat) * ky;
    const bx = (line[i + 1].lng - p.lng) * kx, by = (line[i + 1].lat - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (off < best.off) best = { along: cum[i] + t * (cum[i + 1] - cum[i]), off, seg: i };
  }
  return best;
}

/** A turn-by-turn route from A to B for the in-app navigator. Auto-rickshaws use the car route, a little slower. */
export async function navRoute(mode: TravelMode, from: LatLng, to: LatLng, bearing?: number | null): Promise<NavRoute | null> {
  if (!MAPBOX_TOKEN) return null;
  const profile = mode === "walk" ? "walking" : "driving-traffic";
  // The heading keeps a rerouted trip from telling a moving vehicle to turn round on the spot.
  const bearings = bearing != null && bearing >= 0 && mode !== "walk" ? `&bearings=${Math.round(bearing)},60;` : "";
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&steps=true${bearings}&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { routes?: { duration: number; distance: number; geometry: { coordinates: [number, number][] }; legs: { steps: RawStep[] }[] }[] };
  const r = json.routes?.[0];
  if (!r) return null;
  const line = r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + meters(line[i - 1], line[i]));
  let seg = 0;
  const steps: NavStep[] = [];
  for (const s of r.legs.flatMap((l) => l.steps)) {
    const at = { lat: s.maneuver.location[1], lng: s.maneuver.location[0] };
    // Manoeuvres come in order, so look for each one from where the previous one was found.
    let bestI = seg, bestD = Infinity;
    for (let i = seg; i < line.length; i++) {
      const dd = meters(at, line[i]);
      if (dd < bestD) { bestD = dd; bestI = i; }
      if (bestD < 2) break;
    }
    seg = bestI;
    steps.push({ kind: stepKind(s.maneuver), road: (s.name ?? "").trim(), exit: s.maneuver.exit, at, along: cum[bestI] });
  }
  const seconds = mode === "auto" ? r.duration * AUTO_FACTOR : r.duration;
  return { seconds, meters: r.distance, line, cum, steps };
}

/** Doctors further than this from the patient don't decide their "city"; the list just shows the nearest doctors anywhere. */
export const NEAR_CITY_KM = 40;

/**
 * What the place under a point is called: the neighbourhood ("Sector 11") and the real town or city ("Ghaziabad"), in the
 * patient's language where Mapbox has it. The town comes from the map, never from the doctor list, so it is right even
 * where Doctor Dekho has no doctors yet.
 */
export async function placeNames(p: LatLng, locale: Locale): Promise<{ area: string | null; town: string | null } | null> {
  if (!MAPBOX_TOKEN) return null;
  const lang = locale === "hi" ? "hi" : locale === "bn" ? "bn" : "en";
  const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${p.lng}&latitude=${p.lat}&types=neighborhood,locality,place&limit=1&language=${lang}&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    type Ctx = { name?: string };
    const json = (await res.json()) as { features?: { properties?: { name?: string; feature_type?: string; context?: { place?: Ctx; district?: Ctx } } }[] };
    const f = json.features?.[0]?.properties;
    if (!f) return null;
    const isTown = f.feature_type === "place";
    return { area: isTown ? null : (f.name ?? null), town: isTown ? (f.name ?? null) : (f.context?.place?.name ?? f.context?.district?.name ?? null) };
  } catch {
    return null;
  }
}

/**
 * The phone's position, but only if the patient has already allowed location — never asks on its own.
 * Screens the patient opens on purpose (route, "Use where I am now") ask through `askForPosition`.
 */
export function useQuietPosition(): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") return;
      const p = await Location.getLastKnownPositionAsync();
      if (live && p) setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return pos;
}

export async function askForPosition(): Promise<LatLng | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const p = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch {
    return null;
  }
}

/** "Leave by 8:40" — appointment start minus travel time minus ten minutes to find the room and the counter. */
export function leaveBy(start: string | undefined, seconds: number): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(start ?? "");
  if (!m) return null;
  const startMin = Number(m[1]) * 60 + Number(m[2]);
  const leave = startMin - Math.ceil(seconds / 60) - 10;
  if (leave < 0) return null;
  const h = Math.floor(leave / 60);
  const mm = String(leave % 60).padStart(2, "0");
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}

export const minutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));
export const km = (meters: number) => (meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`);
