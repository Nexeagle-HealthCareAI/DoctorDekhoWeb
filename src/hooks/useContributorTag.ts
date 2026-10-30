"use client";

import { useQuery } from "@tanstack/react-query";
import { CONTRIBUTOR_ENABLED } from "@/lib/contributor/session";
import type { EnrolRole } from "@/lib/contributor/types";

export interface ContributorTag {
  isContributor: boolean;
  role: EnrolRole | null;
  /** INVITED (the team invited them and the profile is not finished), PENDING (under review) or VERIFIED. */
  status: "INVITED" | "PENDING" | "VERIFIED" | null;
  /** The name on the contributor profile, when there is one. */
  fullName: string | null;
}

const NONE: ContributorTag = { isContributor: false, role: null, status: null, fullName: null };

/**
 * Whether the signed-in patient is also a Health Wiki contributor, found by the mobile number they proved when they signed in.
 * Only asked once the patient is signed in, and only when the contributor area is switched on. Any failure just means "no tag":
 * the profile page works the same without it.
 */
export function useContributorTag(enabled: boolean) {
  return useQuery<ContributorTag>({
    queryKey: ["patient-auth", "contributor-tag"],
    enabled: enabled && CONTRIBUTOR_ENABLED,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch("/api/contributor/profile-tag", { credentials: "same-origin" });
        if (!res.ok) return NONE;
        const d = (await res.json()) as { isContributor?: boolean; role?: EnrolRole; status?: ContributorTag["status"]; fullName?: string | null };
        return d.isContributor ? { isContributor: true, role: d.role ?? null, status: d.status ?? null, fullName: d.fullName?.trim() || null } : NONE;
      } catch {
        return NONE;
      }
    },
  });
}

/** Opens the contributor area for a patient who is a contributor, without asking for a second code. */
export async function openContributorArea(): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/contributor/session-from-patient", { method: "POST", credentials: "same-origin" });
    if (res.ok) return { ok: true };
    const d = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: d.message || "Could not open your Health Wiki area. Try again." };
  } catch {
    return { ok: false, message: "No connection. Check your internet and try again." };
  }
}
