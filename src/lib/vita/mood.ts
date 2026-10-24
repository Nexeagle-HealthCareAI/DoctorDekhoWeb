import type { VitaReply } from "./types";

// Which eagle Vita shows. The pose follows what Vita is DOING, never what the patient feels, and the
// words on screen always carry the meaning on their own (the pose is decoration, alt="").
// In an emergency there is no eagle at all: the screen is only help.
// The angry pose exists in the artwork but is never shown to a patient.

export type VitaMood = "welcome" | "thinking" | "working" | "joyful" | "relaxed" | "emergency";
export type LauncherMood = "resting" | "flying" | "sleeping";

/** Poses in /public/vita (transparent PNGs cut from the Vita mascot set). Emergency has none on
 * purpose. welcome: coffee in hand; resting: the same, head and shoulders, for the round launcher;
 * thinking: wing to beak; working: glasses and screen; joyful: wings open; relaxed: on a cushion;
 * sleeping: on a cloud; flying: the first-visit nudge; eating: the "getting ready" note. */
export const POSE: Record<Exclude<VitaMood, "emergency"> | LauncherMood | "eating", string> = {
  welcome: "/vita/welcome.png",
  thinking: "/vita/thinking.png",
  working: "/vita/working.png",
  joyful: "/vita/joyful.png",
  relaxed: "/vita/relaxed.png",
  resting: "/vita/resting.png",
  flying: "/vita/flying.png",
  sleeping: "/vita/sleeping.png",
  eating: "/vita/eating.png",
};

/** While waiting: a short "thinking" beat, then "working" once the wait feels like a search. */
export const WORKING_AFTER_MS = 700;

interface MoodInput {
  last: { role: "user" | "vita" | "error"; reply?: VitaReply } | undefined;
  busy: boolean;
  waitedMs: number;
}

/** The mood of one reply, as shown next to it and in the header while it is the latest. */
export function replyMood(reply: VitaReply): VitaMood {
  switch (reply.kind) {
    case "emergency":
      return "emergency";
    case "doctor_selected":
      return "joyful";
    case "follow_up":
      return "thinking";
    case "handoff":
      return "relaxed";
    case "info":
      return reply.doctor ? "welcome" : "relaxed"; // an availability answer vs "no problem, take your time"
    default:
      return "welcome"; // doctor_list, recommendation: presenting doctors
  }
}

export function chatMood({ last, busy, waitedMs }: MoodInput): VitaMood {
  if (last?.role === "vita" && last.reply?.kind === "emergency" && !busy) return "emergency";
  if (busy) return waitedMs < WORKING_AFTER_MS ? "thinking" : "working";
  if (!last) return "welcome";
  if (last.role === "error") return "thinking";
  if (last.role === "vita" && last.reply) return replyMood(last.reply);
  return "thinking";
}

/** The launcher: sleeping after the patient said goodbye (a relaxed last reply), else resting.
 * "flying" is only the one-time first-visit greeting, chosen by the widget. */
export function launcherMood(lastReply: VitaReply | undefined): LauncherMood {
  return lastReply && replyMood(lastReply) === "relaxed" ? "sleeping" : "resting";
}

/** True when the patient asked the system for less motion: poses then change without animation. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
