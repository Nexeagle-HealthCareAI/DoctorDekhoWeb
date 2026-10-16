"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface HealthLockerDocument {
  documentId: string;
  apptId: string | null;
  memberId?: string | null;
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

const queryKey = (memberId: string | null) => ["health-locker", "documents", memberId ?? "me"];

async function fetchDocuments(memberId: string | null): Promise<DocumentsResponse> {
  const res = await fetch(`/api/public/patients/me/documents${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ""}`);
  return res.json();
}

/** Patient-owned document uploads, independent of any appointment (see PatientHealthLockerDocument
 * on the backend) — same httpOnly-cookie session as usePatientAuth, so this is only meaningful
 * once logged in; callers should gate `enabled` on usePatientAuth().isLoggedIn. */
export function useHealthLocker(enabled: boolean, memberId: string | null = null) {
  const QUERY_KEY = queryKey(memberId);
  const queryClient = useQueryClient();

  const documents = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => fetchDocuments(memberId),
    enabled,
    staleTime: 15_000,
  });

  const upload = useMutation({
    mutationFn: async (vars: { file: File; documentType: string; notes?: string }) => {
      const formData = new FormData();
      formData.append("File", vars.file);
      formData.append("FileName", vars.file.name);
      formData.append("DocumentType", vars.documentType);
      if (vars.notes) formData.append("Notes", vars.notes);
      if (memberId) formData.append("MemberId", memberId);
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
