/**
 * Which "doctor city" (a city name in the doctor directory) the patient is in.
 *
 * The map, not a doctor's record, decides the town: a doctor's city label can be wrong (the dev directory has
 * "Kishanganj" test hospitals pinned in East Delhi), and taking the nearest doctor's city then told people in
 * Ghaziabad they were in Kishanganj. So:
 * - with the map's town/district names: a directory city is used only if it matches one of them (and has a doctor
 *   within NEAR_CITY_KM); otherwise there is no doctor city and lists simply go nearest-first;
 * - without them (no map token, offline): the nearest doctor's city, if within NEAR_CITY_KM (the old behaviour).
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

export function doctorCityNear<D extends CityDoctor>(here: { lat: number; lng: number }, mapNames: string[] | null | undefined, doctors: readonly D[]): D | undefined {
  const near = doctors
    .filter((d) => d.latitude != null && d.longitude != null)
    .map((d) => ({ d, k: km(here, { lat: d.latitude!, lng: d.longitude! }) }))
    .filter((x) => x.k <= NEAR_CITY_KM)
    .sort((a, b) => a.k - b.k);
  if (!near.length) return undefined;
  const names = (mapNames ?? []).map(key).filter(Boolean);
  if (!names.length) return near[0].d;
  return near.find((x) => names.includes(key(x.d.city)))?.d;
}
