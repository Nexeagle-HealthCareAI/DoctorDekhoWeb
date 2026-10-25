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
}

/** Where the "too far from the hospital" refusal from 1HMS is recognised. */
export const TOO_FAR = /don't appear to be at the hospital/i;
