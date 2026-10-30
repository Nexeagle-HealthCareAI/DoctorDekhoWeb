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

/** The name of the place under a point ("Line Bazar"), in the patient's language where Mapbox has it. */
export async function areaName(p: LatLng, locale: Locale): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  const lang = locale === "hi" ? "hi" : locale === "bn" ? "bn" : "en";
  const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${p.lng}&latitude=${p.lat}&types=neighborhood,locality,place&limit=1&language=${lang}&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { features?: { properties?: { name?: string } }[] };
    return json.features?.[0]?.properties?.name ?? null;
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
