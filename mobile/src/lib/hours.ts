import type { Doctor } from "./api/doctors";
import { istNow } from "./format";

export type OpenState = { kind: "open"; until: string } | { kind: "later"; at: string } | { kind: "done" };

/** 1050 → "5:30 PM". */
export function clock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = String(min % 60).padStart(2, "0");
  return `${((h + 11) % 12) + 1}${m === "00" ? "" : `:${m}`} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Where the doctor is in today's hours, from the server's real shifts (India time): open now (till when),
 * opening later today (at what time), or done for today. Null when the server sent no hours, so the app falls
 * back to the plain "Available today" and never makes a time up.
 */
export function openState(d: Pick<Doctor, "isAvailableToday" | "todayHours">, now = istNow()): OpenState | null {
  const hours = d.todayHours ?? [];
  if (!d.isAvailableToday || !hours.length) return null;
  const t = now.getHours() * 60 + now.getMinutes();
  const current = hours.find((h) => t >= h.start && t < h.end);
  if (current) return { kind: "open", until: clock(current.end) };
  const next = hours.find((h) => h.start > t);
  if (next) return { kind: "later", at: clock(next.start) };
  return { kind: "done" };
}
