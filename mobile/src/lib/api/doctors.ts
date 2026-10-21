import { config } from "../config";
import { SPECIALTIES } from "../specialties";
import { api } from "./http";
import type { AvailabilityDto, DoctorByIdDto, DoctorDto, DoctorsPageDto, SearchParseResult } from "./types";

/** The doctor shape every screen reads. Built only by mapDoctor, so a backend rename is fixed in one place. */
export interface Doctor {
  id: string;
  name: string;
  initials: string;
  photo?: string;
  specialtyId: string;
  specialty: string;
  qualifications: string;
  experienceYears: number;
  about: string;
  focusAreas: string[];
  languages: string[];
  verified: boolean;
  featured: boolean;
  rating?: number;
  reviewCount?: number;
  fee?: number;
  discountPercent?: number;
  discountedFee?: number;
  hospitalId?: string;
  hospitalName?: string;
  address?: string;
  city: string;
  state: string;
  pincode?: string;
  hospitalPhone?: string;
  latitude?: number;
  longitude?: number;
  isAvailableToday?: boolean;
  isOnlineNow?: boolean;
  /** Straight-line distance from the patient, set on the device when location is known. */
  distanceKm?: number;
}

// Same mapping as DoctorDekhoWeb/src/lib/api/mappers.ts so a doctor lands under the same specialty on web and app.
const DEPARTMENT_NAME_ALIASES: Record<string, string> = {
  "family medicine": "general",
  "internal medicine": "general",
  "general medicine": "general",
  "gynaecologist / obstetrician": "gynecology",
  "gynaecologist/obstetrician": "gynecology",
  gynaecologist: "gynecology",
  obstetrician: "gynecology",
  "obstetrician / gynaecologist": "gynecology",
  paediatrician: "pediatrics",
};

const PATIENT_CATEGORY_TO_SPECIALTY_ID: Record<string, string> = {
  "General Physician": "general",
  Paediatrician: "pediatrics",
  Gynaecologist: "gynecology",
  "Gynaecologist / Obstetrician": "gynecology",
  "Obstetrician / Gynaecologist": "gynecology",
  "Dermatologist (Skin)": "dermatology",
  "ENT Specialist": "ent",
  "Ophthalmologist (Eye)": "ophthalmology",
  "Orthopaedic Surgeon (Bone)": "orthopedics",
  "Cardiologist (Heart)": "cardiology",
  Neurologist: "neurology",
  Neurosurgeon: "neurosurgery",
  Psychiatrist: "psychiatry",
  Urologist: "urology",
  Gastroenterologist: "gastroenterology",
  "GI/Surgical Gastroenterologist": "gastroenterology",
  "Pulmonologist (Chest/Lungs)": "pulmonology",
  "Oncologist (Cancer)": "oncology",
  "Nephrologist (Kidney)": "nephrology",
  "Endocrinologist (Hormones/Diabetes)": "endocrinology",
  Rheumatologist: "rheumatology",
  "Plastic Surgeon": "plasticsurgery",
  "Vascular Surgeon": "vascularsurgery",
  "Cardiothoracic Surgeon": "cardiothoracicsurgery",
  Anaesthesiologist: "anesthesiology",
  Radiologist: "radiology",
  Pathologist: "pathology",
  "Emergency Medicine Specialist": "emergencymedicine",
  "Physiotherapist / Rehab": "physiotherapy",
  Geriatrician: "geriatrics",
  "Sports Medicine Specialist": "sportsmedicine",
  "General Surgeon": "generalsurgery",
};

function matchSpecialty(raw: string): { id: string; label: string } {
  const norm = raw.trim().toLowerCase();
  const alias = DEPARTMENT_NAME_ALIASES[norm];
  const byAlias = alias ? SPECIALTIES.find((s) => s.id === alias) : undefined;
  if (byAlias) return { id: byAlias.id, label: byAlias.name };
  const found = SPECIALTIES.find((s) => s.name.toLowerCase() === norm || s.id === norm || norm.includes(s.id));
  if (found) return { id: found.id, label: found.name };
  return { id: norm.replace(/\s+/g, "-") || "other", label: raw };
}

function resolveSpecialty(dto: DoctorDto): { id: string; label: string } {
  const category = dto.primaryMedicalSpecialityCategory?.trim();
  const id = category ? PATIENT_CATEGORY_TO_SPECIALTY_ID[category] : undefined;
  if (id) {
    const s = SPECIALTIES.find((x) => x.id === id);
    return { id, label: dto.primaryMedicalSpecialityPatientFacingName?.trim() || s?.name || category! };
  }
  return matchSpecialty(dto.departmentName?.trim() || dto.specializations?.[0] || "General Physician");
}

function initialsOf(name: string): string {
  const parts = name.replace(/^Dr\.?\s*/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "DR";
}

const orUndef = <T,>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

export function mapDoctor(dto: DoctorDto): Doctor {
  const name = dto.fullName?.trim() || "Doctor";
  const { id: specialtyId, label: specialty } = resolveSpecialty(dto);
  return {
    id: String(dto.doctorId),
    name,
    initials: initialsOf(name),
    photo: orUndef(dto.photoUrl),
    specialtyId,
    specialty,
    qualifications: dto.qualification ?? "",
    experienceYears: dto.experienceYears ?? 0,
    about: dto.bio ?? "",
    focusAreas: dto.specializations ?? [],
    languages: dto.languages ?? [],
    verified: dto.isRegistrationVerified ?? false,
    featured: dto.isFeatured ?? false,
    rating: dto.rating ? dto.rating : undefined,
    reviewCount: orUndef(dto.reviewCount),
    fee: orUndef(dto.fee),
    discountPercent: orUndef(dto.discountPercent),
    discountedFee: orUndef(dto.discountedFee),
    hospitalId: dto.hospitalId || undefined,
    hospitalName: orUndef(dto.hospitalName),
    address: orUndef(dto.address),
    city: dto.city ?? "",
    state: dto.state ?? "",
    pincode: orUndef(dto.pincode),
    hospitalPhone: dto.hospitalContact?.trim() || undefined,
    latitude: orUndef(dto.latitude),
    longitude: orUndef(dto.longitude),
    isAvailableToday: dto.isAvailableToday,
    isOnlineNow: dto.isOnlineNow,
  };
}

/** The whole public directory in one request (the website does the same server-side); cached and filtered on the phone. */
export async function fetchAllDoctors(): Promise<Doctor[]> {
  const res = await api<DoctorsPageDto>("/public/doctors?page=1&pageSize=2000", { auth: false });
  return (res.doctors ?? []).map(mapDoctor);
}

export async function fetchDoctor(id: string): Promise<Doctor | null> {
  const res = await api<DoctorByIdDto>(`/public/doctors/${encodeURIComponent(id)}`, { auth: false });
  return res.doctor ? mapDoctor(res.doctor) : null;
}

export async function fetchAvailability(doctorId: string, date: string): Promise<AvailabilityDto> {
  return api<AvailabilityDto>(`/public/doctors/${encodeURIComponent(doctorId)}/availability?date=${date}`, { auth: false });
}

/** Free-text symptom → specialties, via Doctor Dekho's server (NLP router first, Groq second). */
export async function parseSearch(query: string): Promise<SearchParseResult> {
  return api<SearchParseResult>("", { url: config.searchParseUrl, body: { query }, auth: false, timeoutMs: 12000 });
}

/** Distance in km between two coordinates (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function effectiveFee(d: Pick<Doctor, "fee" | "discountedFee">): number | undefined {
  return d.discountedFee ?? d.fee;
}
