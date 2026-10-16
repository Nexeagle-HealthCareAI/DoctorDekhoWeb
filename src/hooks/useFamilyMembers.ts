"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface FamilyMember {
  memberId: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  relation: string;
  age: number | null;
  ageUnit: "Y" | "M" | "D" | null;
  sex: "Male" | "Female" | "Other" | null;
  bloodGroup: string | null;
  allergies: string | null;
  /** How many records are kept for this person in the Health Locker. */
  documentCount: number;
}

export interface FamilyMemberInput {
  firstName: string;
  lastName: string | null;
  relation: string;
  age: number | null;
  ageUnit: "Y" | "M" | "D" | null;
  sex: "Male" | "Female" | "Other" | null;
  bloodGroup: string | null;
  allergies: string | null;
}

interface FamilyResponse {
  success: boolean;
  message?: string;
  max?: number;
  members?: FamilyMember[];
  member?: FamilyMember;
}

export const FAMILY_KEY = ["family-members"];
export const RELATIONS = ["Son", "Daughter", "Spouse", "Father", "Mother", "Brother", "Sister", "Grandparent", "Other"] as const;

/** The people the signed-in patient looks after. Gate `enabled` on usePatientAuth().isLoggedIn. */
export function useFamilyMembers(enabled: boolean) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: FAMILY_KEY,
    queryFn: async (): Promise<FamilyResponse> => (await fetch("/api/public/patients/me/family")).json(),
    enabled,
    staleTime: 30_000,
    retry: false,
  });

  const request = async (url: string, method: string, body?: FamilyMemberInput): Promise<FamilyResponse> => {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = (await res.json().catch(() => ({}))) as FamilyResponse;
    if (!res.ok || data.success === false) throw new Error(data.message || "Something went wrong. Try again.");
    return data;
  };
  const onSuccess = () => qc.invalidateQueries({ queryKey: FAMILY_KEY });

  const save = useMutation({
    mutationFn: (v: { memberId?: string; input: FamilyMemberInput }) =>
      request(v.memberId ? `/api/public/patients/me/family/${v.memberId}` : "/api/public/patients/me/family", v.memberId ? "PUT" : "POST", v.input),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => request(`/api/public/patients/me/family/${memberId}`, "DELETE"),
    onSuccess: async () => {
      await onSuccess();
      await qc.invalidateQueries({ queryKey: ["health-locker"] });
    },
  });

  return { members: list.data?.members ?? [], max: list.data?.max ?? 10, isLoading: list.isLoading, save, remove };
}
