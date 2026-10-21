import { distanceKm, type Doctor } from "./api/doctors";
import type { HomePlace } from "./location";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/** Every word of the query must appear in the doctor's name, specialty, focus areas or hospital (same idea as the website's instant search). */
export function matchesQuery(d: Doctor, query: string): boolean {
  const q = norm(query.replace(/^dr\.?\s+/i, ""));
  if (!q) return true;
  const hay = norm([d.name, d.specialty, d.specialtyId, d.hospitalName ?? "", d.focusAreas.join(" "), d.qualifications].join(" "));
  return q.split(" ").every((w) => hay.includes(w));
}

export interface DoctorFilter {
  query?: string;
  specialtyIds?: string[];
  place?: HomePlace | null;
}

/** Filter and rank: doctors in the chosen city first (nearest first when GPS is known), then featured, available today and rating. */
export function filterDoctors(all: Doctor[], f: DoctorFilter): Doctor[] {
  const city = f.place?.city?.toLowerCase();
  const state = f.place?.state?.toLowerCase();
  const here = f.place?.lat != null && f.place?.lng != null ? { lat: f.place.lat, lng: f.place.lng } : null;

  const list = all
    .filter((d) => (f.specialtyIds?.length ? f.specialtyIds.includes(d.specialtyId) : true))
    .filter((d) => (f.query ? matchesQuery(d, f.query) : true))
    .filter((d) => (city ? d.city.toLowerCase() === city && (!state || d.state.toLowerCase() === state) : true))
    .map((d) => (here && d.latitude != null && d.longitude != null ? { ...d, distanceKm: distanceKm(here, { lat: d.latitude, lng: d.longitude }) } : d));

  const specOrder = (d: Doctor) => (f.specialtyIds?.length ? f.specialtyIds.indexOf(d.specialtyId) : 0);
  return list.sort(
    (a, b) =>
      specOrder(a) - specOrder(b) ||
      (here ? (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999) : 0) ||
      Number(!!b.featured) - Number(!!a.featured) ||
      Number(!!b.isAvailableToday) - Number(!!a.isAvailableToday) ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      a.name.localeCompare(b.name),
  );
}
