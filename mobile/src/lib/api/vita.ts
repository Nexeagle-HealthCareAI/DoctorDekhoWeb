import { config } from "../config";
import { api } from "./http";

/** What Vita said back (shape made by the website's /api/vita/app-chat; see DoctorDekhoWeb src/lib/vitaChat.ts). */
export interface VitaReply {
  sessionId: string;
  kind: "follow_up" | "recommendation" | "emergency";
  message: string;
  question: string | null;
  language: string;
  lowConfidence: boolean;
  specialists: { role: string; specialist: string; specialtyId: string | null; why: string | null }[];
  doctorIds: string[];
  watchFor: string[];
}

/**
 * One turn with Vita (the NLP router's conversational agent, relayed by the website so no key ships in the app).
 * Leave sessionId out to start a new conversation; the router forgets a conversation after 30 minutes.
 */
export function vitaChat(input: { text: string; sessionId?: string | null; city?: string | null; lat?: number; lng?: number }) {
  return api<VitaReply>("", {
    url: config.vitaChatUrl,
    body: { text: input.text, sessionId: input.sessionId ?? undefined, city: input.city ?? undefined, lat: input.lat, lng: input.lng },
    auth: false,
    timeoutMs: 15000,
  });
}
