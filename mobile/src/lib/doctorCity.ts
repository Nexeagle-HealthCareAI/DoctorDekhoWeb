/**
 * Which "doctor city" (a city name in the doctor directory) the patient is in.
 *
 * The map, not a doctor's record, decides the town: a doctor's city label can be wrong (the dev directory has
 * "Kishanganj" test hospitals pinned in East Delhi), and taking the nearest doctor's city then told people in
 * Ghaziabad they were in Kishanganj. So:
 * - with the map's town/district names: a directory city is used only if it matches one of them (and has a doctor
 *   within NEAR_CITY_KM); otherwise there is no doctor city and lists simply go nearest-first;
 * - without them (both lookups failed): a nearby doctor's city, but only if that city's real centre (`cityHubs`) is
 *   within NEAR_CITY_KM too — so a mislabelled pin can never name the patient's town.
 */
export const NEAR_CITY_KM = 40;

export interface CityDoctor {
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** Spellings that differ between the map and the directory. */
const ALIAS: Record<string, string> = { purnia: "purnea", gurugram: "gurgaon", bengaluru: "bangalore", "new delhi": "delhi" };

const key = (s: string) => {
  const k = s.toLowerCase().replace(/\b(district|city|nagar nigam|ncr)\b/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  return ALIAS[k] ?? k;
};

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const r = Math.PI / 180;
  const s = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type Hubs = Map<string, { lat: number; lng: number }>;
const hubCache = new WeakMap<readonly CityDoctor[], Hubs>();

/**
 * Where each directory city really is: the spot with the most of that city's doctors within 25 km. A handful of
 * mislabelled pins (the dev "Kishanganj" test hospitals in East Delhi) can't move it, because most Kishanganj
 * doctors are in Kishanganj.
 */
export function cityHubs(doctors: readonly CityDoctor[]): Hubs {
  const cached = hubCache.get(doctors);
  if (cached) return cached;
  const byCity = new Map<string, { lat: number; lng: number }[]>();
  for (const d of doctors) {
    if (d.latitude == null || d.longitude == null) continue;
    const k = key(d.city);
    const list = byCity.get(k) ?? [];
    list.push({ lat: d.latitude, lng: d.longitude });
    byCity.set(k, list);
  }
  const hubs: Hubs = new Map();
  for (const [k, pins] of byCity) {
    const spots = new Map<string, { lat: number; lng: number }>();
    for (const p of pins) spots.set(`${p.lat.toFixed(2)},${p.lng.toFixed(2)}`, p);
    let best = pins[0];
    let bestN = -1;
    for (const s of spots.values()) {
      const n = pins.filter((p) => km(s, p) <= 25).length;
      if (n > bestN) {
        bestN = n;
        best = s;
      }
    }
    hubs.set(k, best);
  }
  hubCache.set(doctors, hubs);
  return hubs;
}

export function doctorCityNear<D extends CityDoctor>(here: { lat: number; lng: number }, mapNames: string[] | null | undefined, doctors: readonly D[]): D | undefined {
  const near = doctors
    .filter((d) => d.latitude != null && d.longitude != null)
    .map((d) => ({ d, k: km(here, { lat: d.latitude!, lng: d.longitude! }) }))
    .filter((x) => x.k <= NEAR_CITY_KM)
    .sort((a, b) => a.k - b.k);
  if (!near.length) return undefined;
  const names = (mapNames ?? []).map(key).filter(Boolean);
  if (names.length) return near.find((x) => names.includes(key(x.d.city)))?.d;
  // No name from any map: trust a nearby doctor's city only if that city's real centre is near too.
  const hubs = cityHubs(doctors);
  return near.find((x) => {
    const hub = hubs.get(key(x.d.city));
    return hub != null && km(here, hub) <= NEAR_CITY_KM;
  })?.d;
}
