import type { StringKey } from "./i18n/strings";
import { istHour } from "./format";

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export interface Sky {
  part: DayPart;
  greeting: StringKey;
  bg: string;
  ink: string;
  orbBg: string;
  orbInk: string;
  icon: "sunny" | "partly-sunny" | "cloudy-night" | "moon";
  /** Status bar text colour on this sky. */
  bar: "dark" | "light";
}

// Solid, calm colours (no gradients) that keep 7:1+ contrast with their ink.
const SKIES: Record<DayPart, Omit<Sky, "part">> = {
  morning: { greeting: "goodMorning", bg: "#FFE7C7", ink: "#4A2A00", orbBg: "#FFFFFF", orbInk: "#B45309", icon: "sunny", bar: "dark" },
  afternoon: { greeting: "goodAfternoon", bg: "#D7ECF7", ink: "#0E3550", orbBg: "#FFFFFF", orbInk: "#B45309", icon: "partly-sunny", bar: "dark" },
  evening: { greeting: "goodEvening", bg: "#F6D3C6", ink: "#4A1D10", orbBg: "#FFFFFF", orbInk: "#C2410C", icon: "cloudy-night", bar: "dark" },
  night: { greeting: "goodNight", bg: "#1C2B45", ink: "#FFFFFF", orbBg: "#2E4166", orbInk: "#FFE7A8", icon: "moon", bar: "light" },
};

/** Home follows the day in India: morning 5–12, afternoon 12–17, evening 17–21, night after that. */
export function skyNow(hour = istHour()): Sky {
  const part: DayPart = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "night";
  return { part, ...SKIES[part] };
}
