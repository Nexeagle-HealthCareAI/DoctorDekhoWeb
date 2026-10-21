import type { FamilyMember, PatientProfile, Sex, TimeWindow } from "./api/types";
import { istDateString, istHour } from "./format";
import type { StringKey } from "./i18n/strings";

/** Same four windows as the website's booking panel, so the hospital sees identical wording from both. */
export const TIME_WINDOWS: { id: TimeWindow; key: StringKey; range: string; start: string; endHour: number; icon: "sunny" | "partly-sunny" | "cloudy-night" | "moon" }[] = [
  { id: "MORNING", key: "morning", range: "9:00 – 12:00", start: "09:00:00", endHour: 12, icon: "sunny" },
  { id: "AFTERNOON", key: "afternoon", range: "12:00 – 3:00", start: "12:00:00", endHour: 15, icon: "partly-sunny" },
  { id: "EVENING", key: "evening", range: "3:00 – 6:00", start: "15:00:00", endHour: 18, icon: "cloudy-night" },
  { id: "NIGHT", key: "night", range: "6:00 – 9:00", start: "18:00:00", endHour: 21, icon: "moon" },
];

/** The next 7 days in India, starting today — or tomorrow once today's last window has passed. */
export function bookableDays(count = 7): string[] {
  const start = istHour() >= 20 ? 1 : 0;
  return Array.from({ length: count }, (_, i) => istDateString(start + i));
}

/** A window is still bookable today only if it hasn't ended yet. */
export function windowOpen(w: (typeof TIME_WINDOWS)[number], date: string): boolean {
  return date !== istDateString() || istHour() < w.endHour - 1;
}

/** The web panel's reason format: "<typed reason> | Preferred window: Morning (9:00 – 12:00)". English on purpose — hospital staff read it. */
export function bookingReason(typed: string, window: (typeof TIME_WINDOWS)[number] | undefined): string | undefined {
  const label = window ? `Preferred window: ${window.id[0]}${window.id.slice(1).toLowerCase()} (${window.range})` : "";
  return [typed.trim(), label].filter(Boolean).join(" | ") || undefined;
}

export interface BookingPatient {
  fullName: string;
  age?: number;
  ageUnit?: string;
  sex?: string;
  guardianName?: string;
  guardianRelation?: string;
}

export function patientFromProfile(p: PatientProfile): BookingPatient {
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.fullName || "";
  return {
    fullName,
    age: p.age ?? undefined,
    ageUnit: p.ageUnit ?? "Y",
    sex: p.sex ?? undefined,
    guardianName: p.guardianName || undefined,
    guardianRelation: p.guardianName ? p.guardianRelation || "C/O" : undefined,
  };
}

/** Guardian code for a family member, seen from the account holder (S/O, D/O, W/O, H/O, else C/O). */
function guardianCode(relation: string, sex: Sex | null): string {
  switch (relation) {
    case "Son":
      return "S/O";
    case "Daughter":
      return "D/O";
    case "Spouse":
      return sex === "Male" ? "H/O" : "W/O";
    default:
      return "C/O";
  }
}

export function patientFromMember(m: FamilyMember, holder: PatientProfile | undefined): BookingPatient {
  const holderName = holder ? [holder.firstName, holder.lastName].filter(Boolean).join(" ") || holder.fullName || "" : "";
  return {
    fullName: m.fullName || [m.firstName, m.lastName].filter(Boolean).join(" "),
    age: m.age ?? undefined,
    ageUnit: m.ageUnit ?? "Y",
    sex: m.sex ?? undefined,
    guardianName: holderName || undefined,
    guardianRelation: holderName ? guardianCode(m.relation, m.sex) : undefined,
  };
}

/** Relations offered when adding a family member; the server stores free text, so older values still display as-is. */
export const RELATIONS = ["Son", "Daughter", "Spouse", "Father", "Mother", "Brother", "Sister", "Grandparent", "Other"] as const;

export function relationLabel(t: (k: StringKey) => string, relation: string): string {
  return (RELATIONS as readonly string[]).includes(relation) ? t(`rel_${relation}` as StringKey) : relation;
}
