// EasyHMS public API shapes, matching 1HMSAPI PublicController / PatientAuthController response models
// (and DoctorDekhoWeb/src/lib/api/types.ts). Keep them in step when the backend changes.

export interface DoctorDto {
  doctorId: string;
  fullName?: string | null;
  photoUrl?: string | null;
  qualification?: string | null;
  experienceYears?: number | null;
  bio?: string | null;
  departmentName?: string | null;
  primaryMedicalSpecialityPatientFacingName?: string | null;
  primaryMedicalSpecialityCategory?: string | null;
  specializations?: string[] | null;
  languages?: string[] | null;
  hospitalId: string;
  hospitalName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  hospitalContact?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  fee?: number | null;
  discountPercent?: number | null;
  discountedFee?: number | null;
  isFeatured?: boolean;
  isRegistrationVerified?: boolean;
  isAvailableToday?: boolean;
  isOnlineNow?: boolean;
}

export interface DoctorsPageDto {
  success: boolean;
  message?: string | null;
  doctors: DoctorDto[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface DoctorByIdDto {
  success: boolean;
  message?: string | null;
  doctor?: DoctorDto | null;
}

export interface AvailabilityDto {
  success: boolean;
  message?: string | null;
  isAvailable: boolean;
  reason?: string | null;
  shifts: { name?: string | null; startTime?: string | null; endTime?: string | null }[];
}

export interface BookAppointmentRequest {
  doctorId: string;
  patient: {
    fullName: string;
    mobile: string;
    age?: number;
    ageUnit?: string;
    sex?: string;
    guardianName?: string;
    guardianRelation?: string;
  };
  preferredDate: string; // YYYY-MM-DD
  /** "HH:mm:ss", non-binding — the hospital picks the real time when confirming. */
  preferredTime?: string;
  reason?: string;
  referrerUrl?: string;
  utmCampaign?: string;
}

export interface BookAppointmentResponse {
  success: boolean;
  message?: string | null;
  appointmentId?: string | null;
  patientId?: string | null;
}

export interface OtpSendResponse {
  success: boolean;
  message: string;
  /** Only a Development API sends this, instead of a WhatsApp message (PatientAuth:ShowOtpOnScreen). */
  devCode?: string | null;
}

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  accessToken?: string | null;
  mobile?: string | null;
}

/** GET/PUT /public/patients/me — the short profile shared with the website (PatientAccountProfiles). */
export interface PatientProfile {
  success: boolean;
  message: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  bloodGroup?: string | null;
  age?: number | null;
  ageUnit?: AgeUnit | null;
  sex?: Sex | null;
  email?: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
  /** ACCOUNT | BOOKING | NONE */
  source: "ACCOUNT" | "BOOKING" | "NONE";
}

export type Sex = "Male" | "Female" | "Other";
export type AgeUnit = "Y" | "M" | "D";

export interface PatientProfileInput {
  firstName: string;
  lastName?: string | null;
  age?: number | null;
  ageUnit?: AgeUnit | null;
  sex?: Sex | null;
  bloodGroup?: string | null;
  email?: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
}

export type TimeWindow = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
export type AppLanguageCode = "en" | "hi" | "bn" | "hg";

/** GET/PUT /public/patients/me/app-profile — the app-only table (PatientAppProfiles). */
export interface AppProfile {
  success: boolean;
  message: string;
  preferredLanguage?: AppLanguageCode | null;
  homeCity?: string | null;
  homeState?: string | null;
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  defaultMemberId?: string | null;
  preferredTimeWindow?: TimeWindow | null;
  lastDoctorId?: string | null;
  lastBookedAt?: string | null;
  remindersOptIn: boolean;
  onboardingCompleted: boolean;
  hasShortProfile: boolean;
}

export type AppProfileInput = Partial<{
  preferredLanguage: AppLanguageCode;
  homeCity: string;
  homeState: string;
  homeLatitude: number;
  homeLongitude: number;
  defaultMemberId: string;
  clearDefaultMember: boolean;
  preferredTimeWindow: TimeWindow;
  lastDoctorId: string;
  remindersOptIn: boolean;
  onboardingCompleted: boolean;
}>;

export interface FamilyMember {
  memberId: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  relation: string;
  age: number | null;
  ageUnit: AgeUnit | null;
  sex: Sex | null;
  bloodGroup: string | null;
  allergies: string | null;
  documentCount: number;
}

export interface FamilyMemberInput {
  firstName: string;
  lastName: string | null;
  relation: string;
  age: number | null;
  ageUnit: AgeUnit | null;
  sex: Sex | null;
  bloodGroup: string | null;
  allergies: string | null;
}

export interface FamilyResponse {
  success: boolean;
  message?: string;
  max?: number;
  members?: FamilyMember[];
  member?: FamilyMember;
}

export interface MyAppointment {
  appointmentId: string;
  doctorName: string;
  hospitalName: string;
  apptDate: string;
  startAt: string;
  /** Pending Confirmation | Confirmed | Cancelled | Completed */
  status: string;
  statusCode: string;
}

export interface MyAppointmentsResponse {
  success: boolean;
  message: string;
  mobile: string;
  appointments: MyAppointment[];
}

export interface AppointmentDocument {
  attachmentId: string;
  reportType?: string | null;
  fileName?: string | null;
  storageUrl?: string | null;
  notes?: string | null;
  uploadedAt?: string | null;
}

export interface AppointmentDocumentsResponse {
  success: boolean;
  message: string;
  appointmentId: string;
  documents: AppointmentDocument[];
}

export interface HealthLockerDocument {
  documentId: string;
  apptId: string | null;
  memberId?: string | null;
  visitDate?: string | null;
  doctorName?: string | null;
  hospitalName?: string | null;
  externalDoctorName?: string | null;
  externalClinicName?: string | null;
  externalLocation?: string | null;
  documentType: string | null;
  fileName: string | null;
  storageUrl: string | null;
  notes: string | null;
  uploadedAt: string;
}

export interface SimpleResult {
  success: boolean;
  message?: string | null;
}

export interface SearchParseResult {
  specialtyId?: string | null;
  specialtyIds?: string[] | null;
  city?: string | null;
  keywords?: string[] | null;
  method?: string | null;
}
