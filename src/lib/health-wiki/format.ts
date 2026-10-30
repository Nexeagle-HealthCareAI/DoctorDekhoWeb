import type { ArticlePerson } from "./types";

/** "12 Oct 2023". Fixed locale and time zone so the server and the browser print the same text. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function initials(name: string): string {
  return (
    name
      .replace(/^dr\.?\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

/** "MBBS, MD • Cardiologist" */
export function qualificationLine(p: ArticlePerson): string {
  return [p.qualification, p.speciality].filter(Boolean).join(" • ");
}

/** "Reg. 48213 · Delhi Medical Council", or null when no number is on file. */
export function registrationLine(p: ArticlePerson): string | null {
  if (!p.registrationNumber) return null;
  return `Reg. ${p.registrationNumber}${p.registrationCouncil ? ` · ${p.registrationCouncil}` : ""}`;
}

/** "Product manager, HealthTech India" for a person who is not a doctor. */
export function roleLine(p: ArticlePerson): string {
  return [p.roleTitle || p.speciality, p.organisation].filter(Boolean).join(", ");
}
