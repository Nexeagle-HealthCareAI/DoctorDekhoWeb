import type { VitaReply } from "./api/vita";
import type { CareStage } from "./care";

/**
 * Which eagle Vita shows. Same rules as the website (DoctorDekhoWeb src/lib/vita/mood.ts):
 * - The pose follows what Vita is DOING, never what the patient feels (Vita never looks happy about a symptom).
 * - The words on screen always carry the meaning on their own; the eagle is decoration (hidden from screen readers).
 * - In an emergency there is no eagle at all: the screen is only help. Same on account deletion.
 * - One Vita per screen.
 *
 * Images: assets/vita/*.webp, transparent cut-outs of the Vita mascot set (the same art as the website's public/vita).
 */
export type VitaPose = "welcome" | "wave" | "thinking" | "working" | "joyful" | "relaxed" | "resting" | "flying" | "sleeping" | "eating";

/** A small idle movement that keeps Vita alive. All of it stops with reduce motion or Calm mode. */
export type VitaMotion = "breathe" | "bob" | "sway" | "hop" | "still";

/** While waiting: a short "thinking" beat, then "working" once the wait feels like a search. Same as the website. */
export const WORKING_AFTER_MS = 700;

export type ChatMood = VitaPose | "emergency";

/** The pose for one of Vita's replies. */
export function replyPose(reply: Pick<VitaReply, "kind"> & { clarify?: { kind?: string } | null; doctor?: unknown }): ChatMood {
  switch (reply.kind) {
    case "emergency":
      return "emergency";
    case "doctor_selected":
    case "booked":
      return "joyful";
    case "follow_up":
      return reply.clarify?.kind?.startsWith("book_") ? "welcome" : "thinking"; // booking: just asking, not puzzled
    case "handoff":
      return "relaxed";
    case "info":
      return reply.doctor ? "welcome" : "relaxed";
    case "visit":
      return "flying"; // on the way, at the clinic
    default:
      return "welcome"; // doctor_list, recommendation: presenting doctors, coffee in hand
  }
}

export interface ChatMoodInput {
  /** The latest of Vita's turns, if any. */
  last?: { reply?: Parameters<typeof replyPose>[0]; failed?: boolean };
  busy: boolean;
  waitedMs: number;
  listening: boolean;
  /** First time this phone has ever opened Vita: she waves hello. */
  firstEver: boolean;
}

/** The header pose of the Vita chat. */
export function chatMood({ last, busy, waitedMs, listening, firstEver }: ChatMoodInput): ChatMood {
  if (last?.reply?.kind === "emergency" && !busy) return "emergency";
  if (busy) return waitedMs < WORKING_AFTER_MS ? "thinking" : "working";
  if (listening) return "welcome";
  if (!last) return firstEver ? "wave" : "welcome";
  if (last.failed) return "thinking"; // calm, never sad
  if (last.reply) return replyPose(last.reply);
  return "welcome";
}

/** The status line under "Vita" in the chat header, by mood (keys in i18n strings). */
type StatusKey = "vitaStatusReady" | "vitaStatusHello" | "vitaStatusThinking" | "vitaStatusWorking" | "vitaStatusEmergency" | "vitaStatusListening" | "vitaStatusSpeaking";
export const CHAT_STATUS: Record<ChatMood | "listening" | "speaking", StatusKey> = {
  welcome: "vitaStatusReady",
  wave: "vitaStatusHello",
  flying: "vitaStatusHello",
  thinking: "vitaStatusThinking",
  working: "vitaStatusWorking",
  joyful: "vitaStatusReady",
  relaxed: "vitaStatusReady",
  resting: "vitaStatusReady",
  sleeping: "vitaStatusReady",
  eating: "vitaStatusReady",
  emergency: "vitaStatusEmergency",
  listening: "vitaStatusListening",
  speaking: "vitaStatusSpeaking",
};

/** Home's Ask Vita card follows where the patient is in their care: the pose, and Vita's one-line tip. */
export const HOME_VITA: Record<CareStage, { pose: VitaPose; motion: VitaMotion; tip: "vitaAskSub" | "vitaTipWaiting" | "vitaTipUpcoming" | "vitaTipDayBefore" | "vitaTipVisitDay" | "vitaTipAfter" }> = {
  none: { pose: "welcome", motion: "breathe", tip: "vitaAskSub" },
  waiting: { pose: "relaxed", motion: "breathe", tip: "vitaTipWaiting" },
  upcoming: { pose: "welcome", motion: "breathe", tip: "vitaTipUpcoming" },
  dayBefore: { pose: "eating", motion: "breathe", tip: "vitaTipDayBefore" },
  visitDay: { pose: "flying", motion: "bob", tip: "vitaTipVisitDay" },
  after: { pose: "wave", motion: "sway", tip: "vitaTipAfter" },
};

/** Stored once Vita has said her first hello on this phone (cleared with the rest of "dd." on sign-out). */
export const VITA_MET_KEY = "dd.vitaMet";
