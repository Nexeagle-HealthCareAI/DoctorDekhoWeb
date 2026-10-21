import { api, ApiError } from "./http";
import type {
  AppointmentDocumentsResponse,
  AppProfile,
  AppProfileInput,
  BookAppointmentRequest,
  BookAppointmentResponse,
  FamilyMemberInput,
  FamilyResponse,
  HealthLockerDocument,
  MyAppointmentsResponse,
  OtpSendResponse,
  OtpVerifyResponse,
  PatientProfile,
  PatientProfileInput,
  SimpleResult,
} from "./types";

// ── Sign-in (WhatsApp OTP) ─────────────────────────────────────────────────────────────────────

export const sendOtp = (mobileNumber: string) =>
  api<OtpSendResponse>("/public/patient-auth/otp/send", { body: { mobileNumber }, auth: false });

export const verifyOtp = (mobileNumber: string, otp: string) =>
  api<OtpVerifyResponse>("/public/patient-auth/otp/verify", { body: { mobileNumber, otp }, auth: false });

/** Bumps the server-side session epoch so this token stops working everywhere. Never throws. */
export async function logoutOnServer(): Promise<void> {
  try {
    await api<SimpleResult>("/public/patient-auth/logout", { method: "POST" });
  } catch {
    // Signing out locally must always succeed.
  }
}

// ── Short profile (shared with the website: dbo.PatientAccountProfiles) ──────────────────────────

export const getProfile = () => api<PatientProfile>("/public/patients/me");

export const saveProfile = (input: PatientProfileInput) =>
  api<PatientProfile>("/public/patients/me", { method: "PUT", body: input });

/** A profile is enough to book once it has a first name, an age and a sex. */
export function isShortProfileComplete(p: PatientProfile | undefined | null): boolean {
  return !!p && p.source === "ACCOUNT" && !!(p.firstName || p.fullName) && p.age != null && !!p.sex;
}

// ── App profile (new: dbo.PatientAppProfiles) ─────────────────────────────────────────────────────

/** Returns null when the server does not have the app endpoints yet (older EasyHMS) so the app still works. */
export async function getAppProfile(): Promise<AppProfile | null> {
  try {
    return await api<AppProfile>("/public/patients/me/app-profile");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function saveAppProfile(input: AppProfileInput): Promise<AppProfile | null> {
  try {
    return await api<AppProfile>("/public/patients/me/app-profile", { method: "PUT", body: input });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

// ── Devices (new: dbo.PatientAppDevices) ─────────────────────────────────────────────────────────

export interface DeviceInfo {
  installationId: string;
  platform: "android" | "ios";
  appVersion?: string | null;
  osVersion?: string | null;
  deviceModel?: string | null;
  pushToken?: string | null;
}

export async function registerDevice(info: DeviceInfo): Promise<void> {
  try {
    await api<SimpleResult>("/public/patients/me/devices", { body: info });
  } catch {
    // Best effort: a device row only matters for reminders.
  }
}

export async function deactivateDevice(installationId: string): Promise<void> {
  try {
    await api<SimpleResult>(`/public/patients/me/devices/${encodeURIComponent(installationId)}`, { method: "DELETE" });
  } catch {
    // Best effort.
  }
}

// ── Family ───────────────────────────────────────────────────────────────────────────────────────

export const getFamily = () => api<FamilyResponse>("/public/patients/me/family");

export const saveFamilyMember = (input: FamilyMemberInput, memberId?: string) =>
  api<FamilyResponse>(memberId ? `/public/patients/me/family/${memberId}` : "/public/patients/me/family", {
    method: memberId ? "PUT" : "POST",
    body: input,
  });

export const deleteFamilyMember = (memberId: string) =>
  api<FamilyResponse>(`/public/patients/me/family/${memberId}`, { method: "DELETE" });

// ── Appointments ─────────────────────────────────────────────────────────────────────────────────

export const getMyAppointments = () => api<MyAppointmentsResponse>("/public/appointments/mine");

export const bookAppointment = (body: BookAppointmentRequest) =>
  api<BookAppointmentResponse>("/public/appointments", { body });

export const cancelAppointment = (appointmentId: string, mobile: string, reason?: string) =>
  api<SimpleResult>(`/public/appointments/${appointmentId}/cancel`, { method: "PATCH", body: { mobile, reason } });

export const rescheduleAppointment = (appointmentId: string, mobile: string, toApptDate: string, reason?: string) =>
  api<SimpleResult>(`/public/appointments/${appointmentId}/reschedule`, {
    method: "PATCH",
    body: { mobile, toApptDate, reason },
  });

export const getAppointmentDocuments = (appointmentId: string) =>
  api<AppointmentDocumentsResponse>(`/public/appointments/${appointmentId}/documents`);

// ── Health locker ────────────────────────────────────────────────────────────────────────────────

export const getLockerDocuments = () =>
  api<{ success: boolean; message?: string; documents?: HealthLockerDocument[] }>("/public/patients/me/documents?all=true");

export interface LockerUpload {
  uri: string;
  name: string;
  mimeType: string;
  documentType: string;
  memberId?: string | null;
  notes?: string | null;
}

export async function uploadLockerDocument(u: LockerUpload): Promise<SimpleResult> {
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for a file part.
  form.append("File", { uri: u.uri, name: u.name, type: u.mimeType } as unknown as Blob);
  form.append("FileName", u.name);
  form.append("DocumentType", u.documentType);
  if (u.notes) form.append("Notes", u.notes);
  if (u.memberId) form.append("MemberId", u.memberId);
  return api<SimpleResult>("/public/patients/me/documents", { body: form, timeoutMs: 60000 });
}

export const deleteLockerDocument = (documentId: string) =>
  api<SimpleResult>(`/public/patients/me/documents/${documentId}`, { method: "DELETE" });
