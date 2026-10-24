import type { VitaDoctorsBlock } from "./types";

// Applied filters as removable chips (UI-3). The router has no "remove one filter" call, so removing a
// chip re-sends the filters that remain as plain words with new_search=true -- the same words a patient
// could type, which the router reads with the same rules ("MD cardiologist lady doctor aaj available").

export type FilterKey = "specialty" | "query" | "degree" | "gender" | "today" | "near" | "hospital" | "sort";

export interface FilterChip {
  key: FilterKey;
  /** i18n key for the label; `value` fills its {value} slot. */
  labelKey: string;
  value?: string;
}

function specialtyWords(block: VitaDoctorsBlock): string | undefined {
  // "Dermatologist (Skin)" -> "Dermatologist": the router reads the specialist noun.
  const raw = block.specialist || block.filters.specialtyId;
  return raw ? raw.replace(/\s*\(.*\)\s*$/, "").trim() : undefined;
}

export function filterChips(block: VitaDoctorsBlock): FilterChip[] {
  const f = block.filters ?? {};
  const chips: FilterChip[] = [];
  const spec = specialtyWords(block);
  if (spec && !block.fallbackUsed && !block.mode.includes("symptom")) chips.push({ key: "specialty", labelKey: "vita.filterValue", value: spec });
  if (f.query) chips.push({ key: "query", labelKey: "vita.filterName", value: f.query });
  if (f.degree) chips.push({ key: "degree", labelKey: "vita.filterValue", value: f.degree });
  if (f.hospital?.name) chips.push({ key: "hospital", labelKey: "vita.filterValue", value: f.hospital.name });
  if (f.gender === "female") chips.push({ key: "gender", labelKey: "vita.filterFemale" });
  if (f.gender === "male") chips.push({ key: "gender", labelKey: "vita.filterMale" });
  if (f.availableToday) chips.push({ key: "today", labelKey: "vita.filterToday" });
  if (f.near) chips.push({ key: "near", labelKey: "vita.filterNear", value: String(f.radiusKm ?? 5) });
  if (f.sort === "fee") chips.push({ key: "sort", labelKey: "vita.filterCheapest" });
  if (f.sort === "experience") chips.push({ key: "sort", labelKey: "vita.filterExperienced" });
  return chips;
}

/** The words for the same search without `remove`; null when nothing searchable would remain. */
export function textWithout(block: VitaDoctorsBlock, remove: FilterKey): string | null {
  const f = block.filters ?? {};
  const parts: string[] = [];
  const keep = (k: FilterKey) => k !== remove;
  if (keep("degree") && f.degree) parts.push(f.degree);
  const spec = specialtyWords(block);
  const hasSpec = keep("specialty") && !!spec && !block.mode.includes("symptom");
  if (hasSpec) parts.push(spec!);
  if (keep("query") && f.query) parts.push(`dr ${f.query}`);
  if (keep("hospital") && f.hospital?.name) {
    parts.push(/hospital|clinic|nursing/i.test(f.hospital.name) ? f.hospital.name : `${f.hospital.name} hospital`);
  }
  if (keep("gender") && f.gender) parts.push(f.gender === "female" ? "lady doctor" : "male doctor");
  else if (!hasSpec && !(keep("query") && f.query)) parts.push("doctor");
  if (keep("today") && f.availableToday) parts.push("aaj available");
  if (keep("near") && f.near) parts.push(f.radiusKm ? `${f.radiusKm} km ke andar` : "near me");
  if (keep("sort") && f.sort === "fee") parts.push("kam fees");
  if (keep("sort") && f.sort === "experience") parts.push("experienced");
  const searchable = hasSpec || (keep("query") && f.query) || (keep("degree") && f.degree) || (keep("hospital") && f.hospital?.name)
    || (keep("gender") && f.gender) || (keep("near") && f.near);
  return searchable ? parts.join(" ") : null;
}
