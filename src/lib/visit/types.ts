// The visit page data from 1HMS (GET /public/appointments/{id}/visit, Vita vision Phase 4). Nothing personal: the appointment id is
// the only gate.

export interface VisitGuide {
  landmark?: string | null;
  entranceNote?: string | null;
  opdLocation?: string | null;
  registrationDesk?: string | null;
  parkingNote?: string | null;
  paymentNote?: string | null;
  extraNote?: string | null;
}

export interface VisitToken {
  tokenNo?: number | null;
  status?: string | null;
  currentServingTokenNo?: number | null;
  positionInQueue?: number | null;
  estimatedWaitMinutes?: number | null;
}

/** How the patient is getting there (Vita's journey plan). Never their location. */
export interface PublicJourney {
  travelMode?: "drive" | "auto_cab" | "transit" | "walk" | null;
  plannedLeaveAt?: string | null;
  shareWithHospital?: boolean;
  status?: "planned" | "on_the_way" | "late" | "arrived" | "cancelled" | null;
  etaMinutes?: number | null;
  distanceKm?: number | null;
  lateByMinutes?: number | null;
}

export interface PublicVisit {
  appointmentId: string;
  reference: string;
  statusCode: string;
  status: string;
  confirmed: boolean;
  cancelled: boolean;
  completed: boolean;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  address?: string | null;
  city?: string | null;
  contact?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mapUrl: string;
  date: string;
  time?: string | null;
  isToday: boolean;
  fee?: number | null;
  guide: VisitGuide;
  canCheckIn: boolean;
  token?: VisitToken | null;
  followUpDate?: string | null;
  language?: string | null;
  journey?: PublicJourney | null;
}

/** Where the "too far from the hospital" refusal from 1HMS is recognised. */
export const TOO_FAR = /don't appear to be at the hospital/i;
