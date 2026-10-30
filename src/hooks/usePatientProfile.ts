"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface PatientProfile {
  success: boolean;
  message?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  bloodGroup?: string | null;
  age?: number | null;
  ageUnit?: string | null;
  sex?: string | null;
  email?: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
  /** ACCOUNT (saved by the patient here), BOOKING (from the latest hospital booking) or NONE. */
  source?: "ACCOUNT" | "BOOKING" | "NONE";
}

export interface PatientProfileInput {
  firstName: string;
  lastName: string | null;
  bloodGroup: string | null;
  age: number | null;
  ageUnit: "Y" | "M" | "D" | null;
  sex: "Male" | "Female" | "Other" | null;
  email: string | null;
  guardianName: string | null;
  guardianRelation: string | null;
}

async function fetchPatientProfile(): Promise<PatientProfile> {
  const res = await fetch("/api/public/patients/me");
  return res.json();
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** Read-only "Personal Information" — only meaningful once logged in, so callers should gate
 * `enabled` on usePatientAuth().isLoggedIn rather than fetching this on every page load. */
export function usePatientProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["patient-auth", "profile"],
    queryFn: fetchPatientProfile,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

/** Saves the patient's own details. On success the shared profile is replaced, so the name in the top bar and the profile card changes at once. */
export function useSavePatientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PatientProfileInput): Promise<PatientProfile> => {
      const res = await fetch("/api/public/patients/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = (await res.json().catch(() => ({}))) as PatientProfile;
      if (!res.ok || data.success === false) throw new Error(data.message || "Could not save your details. Try again.");
      return data;
    },
    onSuccess: (data) => qc.setQueryData(["patient-auth", "profile"], data),
  });
}
