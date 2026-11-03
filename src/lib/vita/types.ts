// The reply shape of the NLP router's Vita endpoint (POST /v2/agent/chat), as Doctor Dekho reads it.
// Contract: 1HMS-NLP-Router docs/vita_doctor_search.md and the "Vita — Find a Doctor & Emergency:
// Requirements" doc, section 9. Only the fields this site uses are typed; the router sends more.

export type VitaKind =
  | "follow_up"
  | "recommendation"
  | "doctor_list"
  | "doctor_selected"
  | "info"
  | "handoff"
  | "emergency"
  | "booked"
  | "visit";

export interface VitaOption {
  id: string;
  label: string;
}

export interface VitaClarify {
  kind: string; // location | which_doctor | which_hospital | book_offer | ask_kind | no_match | no_more | ...
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

/** McpDoctor from 1HMS, unchanged by the router. */
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
  reviewCount?: number;
  registrationVerified?: boolean;
  distanceKm?: number | null;
  sameHospital?: boolean | null;
  profileUrl?: string | null;
}

export interface VitaFilters {
  specialtyId?: string;
  query?: string;
  degree?: string;
  sort?: string;
  gender?: string;
  availableToday?: boolean;
  near?: boolean;
  radiusKm?: number;
  location?: string;
  city?: string;
  hospitalId?: string;
  hospital?: { hospitalId: string; name?: string | null };
}

export interface VitaDoctorsBlock {
  mode: string[];
  filters: VitaFilters;
  items: VitaDoctor[];
  total: number;
  page?: number;
  hasMore?: boolean;
  fallbackUsed: boolean;
  specialist?: string | null;
  groups?: { title: string; doctorIds: string[] }[];
}

export interface VitaAvailabilityDay {
  date: string;
  isAvailable: boolean;
  shifts: { name?: string | null; start?: string | null; end?: string | null }[];
}

/** What Vita is about to book (with clarify.kind "book_confirm") or has booked (kind "booked"). */
export interface VitaBooking {
  doctorId: string;
  doctorName: string;
  specialty?: string | null;
  hospital?: string | null;
  city?: string | null;
  date: string;
  shift?: { name?: string | null; start?: string | null; end?: string | null } | null;
  /** Day and time already said in the conversation's language, e.g. "Tomorrow (Mon 26 Oct), Morning 09:00-13:00". */
  when: string;
  fee?: number | null;
  patientName?: string | null;
  patientAge?: number | null;
  patientAgeUnit?: string | null;
  patientSex?: string | null;
  forWhom?: string | null;
  /** Masked, e.g. "98xxxxxx10". */
  mobile?: string | null;
  mapUrl?: string | null;
  /** Only once booked. */
  appointmentId?: string;
}

/** One emergency-ready place (1HMS emergency takeover), nearest first. */
export interface VitaEmergencyPlace {
  settingId: string;
  name: string;
  kind?: string;
  phone: string;
  alternatePhone?: string | null;
  distanceKm?: number | null;
  address?: string | null;
  landmark?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapUrl?: string | null;
}

/** With kind "emergency": the nearest emergency hospitals, alerted (vision Phase 3). */
export interface VitaEmergency {
  places: VitaEmergencyPlace[];
  eventId?: string | null;
  alerted?: number;
  repeated?: boolean;
  /** No location yet: ask for it; the next turn with a location brings the places. */
  needsLocation?: boolean;
  numberShared?: boolean;
  /** The router knows the number (signed in): its own "Share my number" chip shares it. */
  canShareNumber?: boolean;
}

import type { PublicVisit } from "@/lib/visit/types";

export interface VitaJourney {
  mode?: "drive" | "auto_cab" | "transit" | "walk" | null;
  etaMinutes?: number | null;
  appointmentId?: string;
  /** The patient agreed the hospital may see the arrival time: the in-app navigation reports it. */
  share?: boolean;
  links: { id: "navigate" | "uber" | "ola" | "transit" | string; kind: string; url: string }[];
}

export interface VitaReply {
  session_id: string;
  turn: number | null;
  kind: VitaKind;
  message: string;
  question?: string | null;
  language?: string;
  degraded?: string[];
  clarify?: VitaClarify | null;
  doctors?: VitaDoctorsBlock;
  doctor?: VitaDoctor;
  selectedDoctorId?: string;
  availability?: { days: VitaAvailabilityDay[]; nextAvailableDate?: string | null; note?: string };
  handoff?: { reason: string };
  booking?: VitaBooking;
  emergency?: VitaEmergency;
  /** kind "visit" (after booking): 1HMS's visit page data, and which answer it is. */
  visit?: PublicVisit;
  visit_step?: "directions" | "arrival" | "checked_in" | "status" | "navigate" | "eta" | "late";
  /** "nikal raha hoon" / "kitni der": how they are coming, the time left, and the buttons (in-app navigation, Uber / Ola, transit). */
  journey?: VitaJourney;
  card?: {
    kind?: string;
    outputs?: { role: string; specialist: string }[];
    emergency_reasons?: string[];
    /** The same signs in the reply's language ("saans phoolna"), for the banner. */
    emergency_signs?: string[];
  } | null;
}

export interface VitaRequest {
  text: string;
  session_id?: string;
  city?: string;
  lat?: number;
  lng?: number;
  hospital_id?: string;
  select_doctor_id?: string;
  page?: number;
  /** Search with exactly the asks in `text` (a filter chip was removed). */
  new_search?: boolean;
  /** The site's UI language (en, hi, hinglish, bn): Vita uses it only until the patient's own words show one. */
  ui_language?: string;
  /** After booking: the patient's latest booking on this device, for "I've reached", directions and check-in. */
  visit_appointment_id?: string;
}
