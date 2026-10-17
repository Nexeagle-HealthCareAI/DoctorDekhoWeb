"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface HealthLockerDocument {
  documentId: string;
  apptId: string | null;
  memberId?: string | null;
  visitDate?: string | null;
  /** The visit, when tied to an appointment in the system... */
  doctorName?: string | null;
  hospitalName?: string | null;
  /** ...or the doctor the patient added themselves. */
  externalDoctorName?: string | null;
  externalClinicName?: string | null;
  externalLocation?: string | null;
  documentType: string | null;
  fileName: string | null;
  storageUrl: string | null;
  notes: string | null;
  uploadedAt: string;
}

interface DocumentsResponse {
  success: boolean;
  message?: string;
  documents?: HealthLockerDocument[];
  notConfigured?: boolean;
}

/** Whose records to list: everyone on the account, only the account holder's own ("me"), or one family member (their id). */
export type LockerScope = "all" | "me" | (string & {});

/** Where a record belongs and which visit it is from. Leave `apptId` and `external` both empty for a record not tied to a visit. */
export interface LockerUploadTarget {
  /** a family member's id; null = the account holder */
  memberId: string | null;
  /** an appointment already in the system */
  apptId?: string | null;
  /** a doctor who is not in the system */
  external?: { doctorName: string; clinicName?: string | null; location?: string | null } | null;
  visitDate?: string | null;
}

const queryKey = (scope: LockerScope) => ["health-locker", "documents", scope];

async function fetchDocuments(scope: LockerScope): Promise<DocumentsResponse> {
  const qs = scope === "all" ? "?all=true" : scope === "me" ? "" : `?memberId=${encodeURIComponent(scope)}`;
  const res = await fetch(`/api/public/patients/me/documents${qs}`);
  return res.json();
}

/** Patient-owned document uploads, independent of any appointment (see PatientHealthLockerDocument
 * on the backend) — same httpOnly-cookie session as usePatientAuth, so this is only meaningful
 * once logged in; callers should gate `enabled` on usePatientAuth().isLoggedIn. */
export function useHealthLocker(enabled: boolean, scope: LockerScope = "all") {
  const QUERY_KEY = queryKey(scope);
  const queryClient = useQueryClient();

  const documents = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchDocuments(scope),
    enabled,
    staleTime: 15_000,
  });

  const upload = useMutation({
    mutationFn: async (vars: { file: File; documentType: string; notes?: string; target: LockerUploadTarget }) => {
      const formData = new FormData();
      formData.append("File", vars.file);
      formData.append("FileName", vars.file.name);
      formData.append("DocumentType", vars.documentType);
      if (vars.notes) formData.append("Notes", vars.notes);
      const { memberId, apptId, external, visitDate } = vars.target;
      if (memberId) formData.append("MemberId", memberId);
      if (apptId) formData.append("ApptId", apptId);
      if (!apptId && external?.doctorName.trim()) {
        formData.append("ExternalDoctorName", external.doctorName.trim());
        if (external.clinicName?.trim()) formData.append("ExternalClinicName", external.clinicName.trim());
        if (external.location?.trim()) formData.append("ExternalLocation", external.location.trim());
      }
      if (visitDate && !apptId) formData.append("VisitDate", visitDate);
      const res = await fetch("/api/public/patients/me/documents", { method: "POST", body: formData });
      return (await res.json()) as { success: boolean; message?: string };
    },
    onSuccess: async (data) => {
      if (data.success) await queryClient.invalidateQueries({ queryKey: ["health-locker"] });
        await queryClient.invalidateQueries({ queryKey: ["family-members"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(`/api/public/patients/me/documents/${documentId}`, { method: "DELETE" });
      return (await res.json()) as { success: boolean; message?: string };
    },
    onSuccess: async (data) => {
      if (data.success) await queryClient.invalidateQueries({ queryKey: ["health-locker"] });
        await queryClient.invalidateQueries({ queryKey: ["family-members"] });
    },
  });

  return {
    documents: documents.data?.documents ?? [],
    isLoading: documents.isLoading,
    notConfigured: documents.data?.notConfigured === true,
    upload,
    remove,
  };
}
