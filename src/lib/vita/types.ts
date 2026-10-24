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
  | "emergency";

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
  card?: {
    kind?: string;
    outputs?: { role: string; specialist: string }[];
    emergency_reasons?: string[];
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
}
