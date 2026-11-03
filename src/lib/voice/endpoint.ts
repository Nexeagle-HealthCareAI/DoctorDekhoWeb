// When has the patient finished speaking? A small energy-based endpointer for Vita's live conversation (no model, nothing
// leaves the device for it). Fed the microphone level every ~50 ms.

export interface EndpointConfig {
  /** Level above the room's noise that counts as speech: max(minLevel, noise x ratio). */
  minLevel: number;
  ratio: number;
  /** Speech this long before the turn counts (a cough or a click does not). */
  minSpeechMs: number;
  /** Quiet this long after speech ends the turn. */
  endSilenceMs: number;
  /** Nobody spoke for this long: stop listening. */
  noSpeechMs: number;
  /** A turn never runs longer than this. */
  maxTurnMs: number;
}

export const DEFAULT_ENDPOINT: EndpointConfig = {
  minLevel: 0.015, ratio: 3, minSpeechMs: 250, endSilenceMs: 1200, noSpeechMs: 8000, maxTurnMs: 30_000,
};

export interface EndpointState {
  startedAt: number;
  noise: number;
  speechMs: number;
  lastVoiceAt: number | null;
  lastAt: number;
}

export type EndpointEvent = "listening" | "speaking" | "done" | "no_speech";

export function startEndpoint(now: number): EndpointState {
  return { startedAt: now, noise: 0, speechMs: 0, lastVoiceAt: null, lastAt: now };
}

/** One microphone reading (RMS 0..1) at time `now` -> the new state and what it means. */
export function stepEndpoint(s: EndpointState, level: number, now: number, cfg: EndpointConfig = DEFAULT_ENDPOINT):
  { state: EndpointState; event: EndpointEvent } {
  const dt = Math.max(0, now - s.lastAt);
  const threshold = Math.max(cfg.minLevel, s.noise * cfg.ratio);
  const voiced = level > threshold;
  // the room's noise follows quiet readings slowly, and never learns from speech
  const noise = voiced ? s.noise : s.noise === 0 ? level : s.noise * 0.95 + level * 0.05;
  const speechMs = voiced ? s.speechMs + dt : s.speechMs;
  const lastVoiceAt = voiced ? now : s.lastVoiceAt;
  const state: EndpointState = { startedAt: s.startedAt, noise, speechMs, lastVoiceAt, lastAt: now };
  const spoke = speechMs >= cfg.minSpeechMs;
  if (now - s.startedAt >= cfg.maxTurnMs) return { state, event: spoke ? "done" : "no_speech" };
  if (spoke && lastVoiceAt !== null && now - lastVoiceAt >= cfg.endSilenceMs) return { state, event: "done" };
  if (!spoke && now - s.startedAt >= cfg.noSpeechMs) return { state, event: "no_speech" };
  return { state, event: spoke ? "speaking" : "listening" };
}
