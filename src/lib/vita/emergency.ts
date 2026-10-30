// Shared by the emergency card's server route (vision Phase 3, emergency takeover).

/** 10-digit Indian mobile, from "+91 98765 43210", "098765 43210" or "9876543210". */
export function cleanMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let d = value.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
