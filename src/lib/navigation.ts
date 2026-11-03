// ─────────────────────────────────────────────────────────────────────────────
// In-page navigation: routing (Mapbox Directions API), address geocoding (Mapbox
// Geocoding API) and the route-geometry maths behind live turn-by-turn guidance.
//
// Same public token the map + Matrix API already use (see geo.ts), so no new
// account/key. Everything here is browser-side and pure apart from the two
// fetch helpers, which keeps the geometry maths easy to reason about.
// ─────────────────────────────────────────────────────────────────────────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** False when no Mapbox token is configured -- callers fall back to Google Maps. */
export const NAVIGATION_AVAILABLE = Boolean(MAPBOX_TOKEN);

export type TravelProfile = "driving" | "walking" | "cycling";
/** [longitude, latitude] -- Mapbox/GeoJSON order, the reverse of most lat/lon APIs. */
export type LonLat = [number, number];

export interface NavDestination {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Free-text address, geocoded when there's no GPS pin. */
  address?: string;
  /** Start in this mode (Vita knows the patient is walking). */
  profile?: TravelProfile;
  /** A booking: while navigating, the time and distance left go to 1HMS so reception sees "On the way" (if the patient agreed). */
  appointmentId?: string;
}

export interface NavStep {
  instruction: string;
  /** Mapbox maneuver type (turn, roundabout, arrive, ...) -- drives the icon. */
  type: string;
  modifier?: string;
  /** Where the maneuver happens. */
  location: LonLat;
  distanceM: number;
  durationS: number;
}

export interface NavRoute {
  distanceM: number;
  durationS: number;
  geometry: LonLat[];
  steps: NavStep[];
  /** Cumulative metres along `geometry` at each vertex. */
  cumulativeM: number[];
  /** Distance along `geometry` at which each step's maneuver happens. */
  stepOffsetsM: number[];
}

/**
 * Joins address parts into one line, skipping any part already contained in an earlier one --
 * hospital records often carry "..., Karnataka" in the street address *and* separate city/state
 * fields, which would otherwise read "Test Address, Karnataka, Bengaluru, Karnataka, 560001".
 */
export function joinAddress(...parts: (string | null | undefined)[]): string {
  const kept: string[] = [];
  for (const raw of parts) {
    const part = raw?.trim();
    if (!part) continue;
    const lower = part.toLowerCase();
    if (kept.some((k) => k.toLowerCase().includes(lower))) continue;
    kept.push(part);
  }
  return kept.join(", ");
}

/** Google Maps handoff -- used when Mapbox isn't configured, and as an explicit fallback. */
export function googleMapsUrl(dest: NavDestination): string {
  if (dest.latitude != null && dest.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`;
  }
  const query = [dest.name, dest.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatArrivalTime(secondsFromNow: number, now: Date = new Date()): string {
  return new Date(now.getTime() + secondsFromNow * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function metersBetween(a: LonLat, b: LonLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cumulativeLengths(geometry: LonLat[]): number[] {
  const cum = [0];
  for (let i = 1; i < geometry.length; i++) {
    cum.push(cum[i - 1] + metersBetween(geometry[i - 1], geometry[i]));
  }
  return cum;
}

/**
 * Where a position sits on the route: how far along it (metres from the start) and how far
 * off it. `hintAlongM` stops the match jumping backwards onto an earlier pass of the same
 * road (loops, U-turns) -- segments that end well behind the last known progress are skipped.
 */
export function locateOnRoute(
  route: Pick<NavRoute, "geometry" | "cumulativeM">,
  pos: LonLat,
  hintAlongM = 0
): { alongM: number; offRouteM: number } {
  const { geometry, cumulativeM } = route;
  // Local flat-earth projection around the position -- accurate to well under a metre at
  // the scale of a single route segment, and far cheaper than spherical point-to-line maths.
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(toRad(pos[1]));

  let bestDist = Infinity;
  let bestAlong = hintAlongM;
  for (let i = 0; i < geometry.length - 1; i++) {
    if (cumulativeM[i + 1] < hintAlongM - 100) continue;
    const ax = (geometry[i][0] - pos[0]) * mPerDegLon;
    const ay = (geometry[i][1] - pos[1]) * mPerDegLat;
    const bx = (geometry[i + 1][0] - pos[0]) * mPerDegLon;
    const by = (geometry[i + 1][1] - pos[1]) * mPerDegLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const dist = Math.hypot(px, py);
    if (dist < bestDist) {
      bestDist = dist;
      bestAlong = cumulativeM[i] + t * Math.sqrt(lenSq);
    }
  }
  return { alongM: bestAlong, offRouteM: bestDist === Infinity ? 0 : bestDist };
}

/** Index of the step the traveller is currently on, given how far along the route they are. */
export function currentStepIndex(stepOffsetsM: number[], alongM: number): number {
  let idx = 0;
  // 15 m of slack so a maneuver counts as "done" just before the exact point, matching how
  // guidance is announced (you act on it as you reach it, not after you've passed it).
  for (let i = 0; i < stepOffsetsM.length; i++) {
    if (stepOffsetsM[i] <= alongM + 15) idx = i;
  }
  return idx;
}

// ── Mapbox API ───────────────────────────────────────────────────────────────

interface MapboxStep {
  maneuver: { instruction: string; type: string; modifier?: string; location: LonLat };
  distance: number;
  duration: number;
}

export async function fetchRoute(from: LonLat, to: LonLat, profile: TravelProfile, signal?: AbortSignal): Promise<NavRoute> {
  if (!MAPBOX_TOKEN) throw new Error("Mapbox token is not configured");
  // Instructions are requested in English: Mapbox's Directions API has no Hindi/Bengali
  // voice, so the guidance text stays English while the surrounding UI is localised.
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.join(",")};${to.join(",")}` +
    `?alternatives=false&geometries=geojson&overview=full&steps=true&language=en&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Directions request failed (${res.status})`);
  const data = await res.json();
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) throw new Error(data.message ?? "No route found");

  const geometry: LonLat[] = route.geometry.coordinates;
  const cumulativeM = cumulativeLengths(geometry);
  const geometryLengthM = cumulativeM[cumulativeM.length - 1] || route.distance;

  const rawSteps: MapboxStep[] = route.legs.flatMap((leg: { steps: MapboxStep[] }) => leg.steps);
  const steps: NavStep[] = rawSteps.map((s) => ({
    instruction: s.maneuver.instruction,
    type: s.maneuver.type,
    modifier: s.maneuver.modifier,
    location: s.maneuver.location,
    distanceM: s.distance,
    durationS: s.duration,
  }));

  // Step distances come from the road graph while `geometry` is measured vertex-to-vertex, so
  // they differ by a fraction of a percent -- scale one onto the other so a maneuver's offset
  // never overshoots the end of the geometry.
  const stepsTotalM = steps.reduce((sum, s) => sum + s.distanceM, 0) || 1;
  const scale = geometryLengthM / stepsTotalM;
  const stepOffsetsM: number[] = [];
  let running = 0;
  for (const s of steps) {
    stepOffsetsM.push(running * scale);
    running += s.distanceM;
  }

  return { distanceM: route.distance, durationS: route.duration, geometry, steps, cumulativeM, stepOffsetsM };
}

/** Resolves a free-text address to coordinates, biased towards India and (optionally) the visitor. */
export async function geocodeAddress(query: string, proximity?: LonLat, signal?: AbortSignal): Promise<LonLat | null> {
  if (!MAPBOX_TOKEN) return null;
  const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, limit: "1", country: "in" });
  if (proximity) params.set("proximity", proximity.join(","));
  const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  const center = data.features?.[0]?.center;
  return Array.isArray(center) && center.length === 2 ? [center[0], center[1]] : null;
}
