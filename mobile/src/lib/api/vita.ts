import { config } from "../config";
import { api } from "./http";

/*
 * Vita, the Doctor Dekho patient agent — the same agent as the website's chat: the NLP router's POST /v2/agent/chat,
 * relayed by the website's /api/vita/chat so the router key never ships in the app. The app sends its own patient
 * token (bearer), so Vita books as the signed-in patient without asking for a code.
 *
 * Reply shape: DoctorDekhoWeb src/lib/vita/types.ts (only what the app uses is typed here; the router sends more).
 */

export type VitaKind = "follow_up" | "recommendation" | "doctor_list" | "doctor_selected" | "info" | "handoff" | "emergency" | "booked" | "visit";

export interface VitaOption {
  id: string;
  label: string;
}

export interface VitaClarify {
  /** location | which_doctor | which_hospital | book_offer | book_confirm | book_* | ask_kind | no_match | no_more | visit_checkin … */
  kind: string;
  question: string | null;
  options: VitaOption[];
}

export interface VitaHospital {
  hospitalId: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  contact?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface VitaDoctor {
  doctorId: string;
  name?: string | null;
  degrees?: string | null;
  specialtyId?: string | null;
  specialtyName?: string | null;
  experienceYears?: number | null;
  languages?: string[];
  consultFee?: number | null;
  discountedFee?: number | null;
  photoUrl?: string | null;
  hospital?: VitaHospital | null;
  availableToday?: boolean;
  rating?: number | null;
  registrationVerified?: boolean;
  distanceKm?: number | null;
}

export interface VitaDoctorsBlock {
  items: VitaDoctor[];
  total: number;
  page?: number;
  hasMore?: boolean;
  fallbackUsed: boolean;
  specialist?: string | null;
}

export interface VitaAvailabilityDay {
  date: string;
  isAvailable: boolean;
  shifts: { name?: string | null; start?: string | null; end?: string | null }[];
}

/** What Vita is about to book (clarify.kind "book_confirm") or has booked (kind "booked"). */
export interface VitaBooking {
  doctorId: string;
  doctorName: string;
  specialty?: string | null;
  hospital?: string | null;
  city?: string | null;
  date: string;
  /** Day and time already in the conversation's language, e.g. "Tomorrow (Mon 26 Oct), Morning 09:00-13:00". */
  when: string;
  fee?: number | null;
  patientName?: string | null;
  patientAge?: number | null;
  patientSex?: string | null;
  forWhom?: string | null;
  /** Masked, e.g. "98xxxxxx10". */
  mobile?: string | null;
  mapUrl?: string | null;
  appointmentId?: string;
}

export interface VitaEmergencyPlace {
  settingId: string;
  name: string;
  phone: string;
  distanceKm?: number | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapUrl?: string | null;
}

export interface VitaEmergency {
  places: VitaEmergencyPlace[];
  /** No location yet: the next turn with a location brings the places. */
  needsLocation?: boolean;
}

export interface VitaReply {
  session_id: string;
  turn: number | null;
  kind: VitaKind;
  message: string;
  question?: string | null;
  language?: string;
  /** e.g. ["doctor_lookup"]: Vita answered but couldn't fetch doctors. */
  degraded?: string[];
  clarify?: VitaClarify | null;
  doctors?: VitaDoctorsBlock;
  doctor?: VitaDoctor;
  availability?: { days: VitaAvailabilityDay[]; nextAvailableDate?: string | null };
  handoff?: { reason: string };
  booking?: VitaBooking;
  emergency?: VitaEmergency;
  visit_step?: "directions" | "arrival" | "checked_in" | "status";
  card?: { outputs?: { role: string; specialist: string }[]; emergency_signs?: string[] } | null;
}

export interface VitaRequest {
  text: string;
  session_id?: string;
  city?: string;
  lat?: number;
  lng?: number;
  select_doctor_id?: string;
  page?: number;
  new_search?: boolean;
  /** The app language (en, hi, hinglish, bn): Vita uses it only until the patient's own words show one. */
  ui_language?: string;
  /** The patient's next visit, for "I've reached", directions and check-in. */
  visit_appointment_id?: string;
}

/** One turn with Vita. Leave session_id out to start a new conversation (the router forgets one after 30 minutes). */
export function vitaChat(body: VitaRequest) {
  return api<VitaReply>("", { url: config.vitaChatUrl, body, timeoutMs: 20000 });
}

/** "New chat": ask the router to forget this conversation now. Best effort. */
export function vitaForget(sessionId: string) {
  return api<unknown>("", { url: `${config.vitaChatUrl}?session=${encodeURIComponent(sessionId)}`, method: "DELETE", auth: false, timeoutMs: 5000 }).catch(() => undefined);
}
