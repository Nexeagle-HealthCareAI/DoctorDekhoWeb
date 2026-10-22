"use client";

// ─────────────────────────────────────────────────────────────────────────────
// React Query hooks for the patient portal. They call our own /api/public/*
// proxy routes (which attach the hospital key server-side), then map the raw
// DTOs into the UI's Doctor / window shapes.
//
// When the upstream API isn't configured yet, the proxy returns
// `{ notConfigured: true }` and these hooks surface `notConfigured` so callers
// can fall back to the local mock data in src/data/patient.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Doctor } from "@/data/patient";
import type { Lab } from "@/data/labs";
import {
  mapAvailability,
  mapBookingReference,
  mapDoctors,
  mapLabs,
  type AvailabilityResult,
} from "./mappers";
import type { CreateAppointmentRequest, ReviewDto, SubmitReviewRequest } from "./types";

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// ── Doctors ──────────────────────────────────────────────────────────────────
export interface DoctorsResult {
  doctors: Doctor[];
  notConfigured: boolean;
}

// `seed` is server-fetched, already-filtered doctor data (see src/lib/api/server.ts's
// getAllDoctors + src/lib/filters/doctorLocation.ts) passed down as a prop from a
// page.tsx Server Component. Seeding `initialData` makes the FIRST render (server AND
// client hydration pass) show real doctors immediately, instead of an empty array
// while the client's own live re-fetch is still in flight.
//
// Whole-directory fetch (pageSize=2000, matching server.ts's SSR calls) — used for
// deriving the full city list (home-client.tsx's dynamicCities) and anywhere else that
// needs to see every doctor at once. The actual results grid uses usePaginatedDoctors
// below instead, now that /api/public/doctors defaults to a paginated 24-per-page
// response — this hook would otherwise silently drop to 24 results on its next
// background refetch if it didn't ask for pageSize explicitly.
export function useDoctors(seed?: DoctorsResult) {
  return useQuery<DoctorsResult>({
    queryKey: ["public", "doctors"],
    queryFn: async () => {
      const json = await getJson("/api/public/doctors?pageSize=2000");
      if (json?.notConfigured) return { doctors: [], notConfigured: true };
      // Accept either a bare array or { doctors: [...] }.
      const list = Array.isArray(json) ? json : json?.doctors ?? json?.data;
      return { doctors: mapDoctors(list), notConfigured: false };
    },
    initialData: seed,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Paginated doctors (results grid) ────────────────────────────────────────────
export interface DoctorsFilterParams {
  city?: string;
  state?: string;
  specialtyCategory?: string;
  search?: string;
}

const DOCTORS_PAGE_SIZE = 24;

interface DoctorsPage {
  doctors: Doctor[];
  notConfigured: boolean;
  totalCount: number;
}

// Backs DoctorDirectory.tsx's results grid via React Query's useInfiniteQuery — pages
// are fetched 24 at a time as the user scrolls (fetchNextPage), instead of the old
// useDoctors() pulling the entire platform-wide directory into the DOM at once. `seed`
// (server-fetched initialDoctors, same prop as useDoctors above) is ALWAYS the seed for
// page 1, filtered or not — every specialty/condition/hospital page passes a seed that's
// already been filtered server-side to match that exact page (see src/lib/filters/
// doctorLocation.ts), so discarding it whenever a filter is active would mean every one
// of those ~400 SSR'd pages falls back to a genuine loading state on first paint —
// exactly the empty-shell-for-crawlers problem this project exists to fix. `seed !==
// undefined` (not a truthiness/length check) so a legitimately-empty filtered result
// (0 real doctors for this specialty+city) is still treated as real seed data, not "no
// data yet" — same class of bug as DoctorDirectory's own hasSeedData fix, one layer down.
export function usePaginatedDoctors(filters: DoctorsFilterParams, seed?: Doctor[]) {
  const query = useInfiniteQuery<DoctorsPage>({
    queryKey: ["public", "doctors", "paginated", filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), pageSize: String(DOCTORS_PAGE_SIZE) });
      if (filters.city) params.set("city", filters.city);
      if (filters.state) params.set("state", filters.state);
      if (filters.specialtyCategory) params.set("specialtyCategory", filters.specialtyCategory);
      if (filters.search) params.set("search", filters.search);

      const json = await getJson(`/api/public/doctors?${params.toString()}`);
      if (json?.notConfigured) return { doctors: [], notConfigured: true, totalCount: 0 };
      const list = Array.isArray(json) ? json : json?.doctors ?? [];
      return { doctors: mapDoctors(list), notConfigured: false, totalCount: json?.totalCount ?? list.length };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.doctors.length, 0);
      return loaded < lastPage.totalCount ? allPages.length + 1 : undefined;
    },
    initialData:
      seed !== undefined
        ? {
            pages: [{ doctors: seed.slice(0, DOCTORS_PAGE_SIZE), notConfigured: false, totalCount: seed.length }],
            pageParams: [1],
          }
        : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const pages = query.data?.pages ?? [];
  return {
    doctors: pages.flatMap((p) => p.doctors),
    notConfigured: pages[0]?.notConfigured ?? false,
    totalCount: pages[0]?.totalCount ?? 0,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    // True once the most recent fetchNextPage attempt failed and exhausted its retries (see
    // the global `retry: 1` default in providers.tsx) — callers doing background pagination
    // backfill (DoctorDirectory.tsx) check this to stop auto-retrying a page that's
    // consistently failing, rather than looping forever against a struggling upstream.
    isError: query.isError,
  };
}

// ── Labs (pathology-lab directory) ──────────────────────────────────────────
export interface LabsFilterParams {
  city?: string;
  state?: string;
  search?: string;
}

const LABS_PAGE_SIZE = 24;

interface LabsPage {
  labs: Lab[];
  notConfigured: boolean;
  totalCount: number;
}

// Same shape as usePaginatedDoctors above, simplified: no specialty filter, no virtualization/
// AI-search concerns at the caller side -- LabDirectory.tsx is a plain paginated grid.
export function usePaginatedLabs(filters: LabsFilterParams, seed?: Lab[]) {
  const query = useInfiniteQuery<LabsPage>({
    queryKey: ["public", "labs", "paginated", filters],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ page: String(pageParam), pageSize: String(LABS_PAGE_SIZE) });
      if (filters.city) params.set("city", filters.city);
      if (filters.state) params.set("state", filters.state);
      if (filters.search) params.set("search", filters.search);

      const json = await getJson(`/api/public/labs?${params.toString()}`);
      if (json?.notConfigured) return { labs: [], notConfigured: true, totalCount: 0 };
      const list = Array.isArray(json) ? json : json?.labs ?? [];
      return { labs: mapLabs(list), notConfigured: false, totalCount: json?.totalCount ?? list.length };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.labs.length, 0);
      return loaded < lastPage.totalCount ? allPages.length + 1 : undefined;
    },
    initialData:
      seed !== undefined
        ? {
            pages: [{ labs: seed.slice(0, LABS_PAGE_SIZE), notConfigured: false, totalCount: seed.length }],
            pageParams: [1],
          }
        : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const pages = query.data?.pages ?? [];
  return {
    labs: pages.flatMap((p) => p.labs),
    notConfigured: pages[0]?.notConfigured ?? false,
    totalCount: pages[0]?.totalCount ?? 0,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
  };
}

// ── Availability ─────────────────────────────────────────────────────────────
export interface AvailabilityQuery extends AvailabilityResult {
  notConfigured: boolean;
}

export function useDoctorAvailability(doctorId: string | undefined, date: string | undefined) {
  return useQuery<AvailabilityQuery>({
    queryKey: ["public", "availability", doctorId, date],
    enabled: Boolean(doctorId && date),
    queryFn: async () => {
      const json = await getJson(
        `/api/public/doctors/${doctorId}/availability?date=${date}`
      );
      if (json?.notConfigured) return { isAvailable: false, windows: [], notConfigured: true };
      return { ...mapAvailability(json), notConfigured: false };
    },
  });
}

// ── Create appointment ───────────────────────────────────────────────────────
export interface CreateAppointmentResult {
  reference: string | null;
  notConfigured: boolean;
}

export function useCreateAppointment() {
  return useMutation<CreateAppointmentResult, Error, CreateAppointmentRequest>({
    mutationFn: async (body) => {
      const res = await fetch("/api/public/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Booking failed: ${res.status}`);
      const json = await res.json();
      if (json?.notConfigured) return { reference: null, notConfigured: true };
      return { reference: mapBookingReference(json), notConfigured: false };
    },
  });
}

// ── Reviews ──────────────────────────────────────────────────────────────────
export interface ReviewsResult {
  reviews: ReviewDto[];
  averageRating: number;
  reviewCount: number;
  notConfigured: boolean;
}

export function useDoctorReviews(doctorId: string | undefined) {
  return useQuery<ReviewsResult>({
    queryKey: ["public", "reviews", doctorId],
    enabled: Boolean(doctorId),
    queryFn: async () => {
      const json = await getJson(`/api/public/doctors/${doctorId}/reviews`);
      if (json?.notConfigured) return { reviews: [], averageRating: 0, reviewCount: 0, notConfigured: true };
      return {
        reviews: json?.reviews ?? [],
        averageRating: json?.averageRating ?? 0,
        reviewCount: json?.reviewCount ?? 0,
        notConfigured: false,
      };
    },
  });
}

export function useSubmitReview(doctorId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; reviewId: string | null; notConfigured: boolean }, Error, SubmitReviewRequest>({
    mutationFn: async (body) => {
      const res = await fetch(`/api/public/doctors/${doctorId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json?.notConfigured) return { success: false, reviewId: null, notConfigured: true };
      if (!res.ok || !json?.success) throw new Error(json?.message || `Review submission failed: ${res.status}`);
      return { success: true, reviewId: json?.reviewId ?? null, notConfigured: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public", "reviews", doctorId] });
    },
  });
}

// Attaches a comment to a review already submitted via useSubmitReview — the reviewId returned
// from that call is the only thing needed (no login, matches the "anyone can submit" model).
export function useUpdateReviewComment(doctorId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { reviewId: string; comment: string }>({
    mutationFn: async ({ reviewId, comment }) => {
      const res = await fetch(`/api/public/doctors/${doctorId}/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || `Comment update failed: ${res.status}`);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public", "reviews", doctorId] });
    },
  });
}

export function useMarkReviewHelpful(doctorId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (reviewId) => {
      const res = await fetch(`/api/public/doctors/${doctorId}/reviews/${reviewId}/helpful`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Marking helpful failed: ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public", "reviews", doctorId] });
    },
  });
}

// ── AI search fallback ──────────────────────────────────────────────────────
// Interprets free-text/voice-transcribed search into { specialtyId, city, keywords } —
// see app/api/search/parse/route.ts. Only meant to be called when the plain keyword
// search (DoctorDirectory.tsx) comes up empty; notConfigured lets the caller degrade to
// "no results" silently when GROQ_API_KEY isn't set, same convention as the other
// notConfigured-aware hooks above.
export interface SmartSearchIntent {
  specialtyId: string | null;
  /** Full ordered candidate list (specialtyId is always specialtyIds[0]) — see
   * app/api/search/parse/route.ts's SearchIntent. DoctorDirectory.tsx matches doctors
   * against any of these, not just the top pick, when the router flags a close call. */
  specialtyIds: string[];
  city: string | null;
  keywords: string[];
  notConfigured: boolean;
  // Only populated when the NLP router (not the Groq fallback) produced this result — lets
  // DoctorDirectory.tsx's search_performed tracking log what actually drove the suggestion,
  // feeding the 1HMS-NLP-Router feedback loop.
  method: string | null;
  confidence: number | null;
  modelVersion: string | null;
  /** The router's decision (answer / clarify / abstain); null when Groq or the legacy router answered. */
  decision: "answer" | "clarify" | "abstain" | null;
  /** Non-null = medical emergency. The page must show the emergency banner (reasons, call 108),
   * not just a doctor list. */
  emergency: { reasons: string[]; source: "router" | "groq" } | null;
  /** Non-null = a question to show as chips. kind "age": re-run the search with the chosen id as
   * ageGroup. kind "specialty": the chosen id is the specialty to show. */
  clarify: { kind: "age" | "specialty"; question: string; options: { id: string; label: string }[] } | null;
  /** Short explanation from the router, in the patient's language (e.g. why a GP is suggested). */
  reason: string | null;
}

/** The search text, plus the patient's answer to an age question when re-asking. safetyOnly asks
 * only "is this an emergency?" (router only, never Groq): used when keyword search already found
 * doctors, so symptom text that happens to match a doctor's profile is still safety-checked. */
export type SmartSearchInput = string | { query: string; ageGroup?: "child" | "adult"; safetyOnly?: boolean };

const EMPTY_INTENT_EXTRAS = { decision: null, emergency: null, clarify: null, reason: null } as const;

export function useSmartSearch() {
  return useMutation<SmartSearchIntent, Error, SmartSearchInput>({
    mutationFn: async (input) => {
      const payload = typeof input === "string" ? { query: input } : input;
      const res = await fetch("/api/search/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json?.notConfigured) {
        return { specialtyId: null, specialtyIds: [], city: null, keywords: [], notConfigured: true, method: null, confidence: null, modelVersion: null, ...EMPTY_INTENT_EXTRAS };
      }
      if (!res.ok) throw new Error(json?.error || `Search interpretation failed: ${res.status}`);
      return {
        specialtyId: json?.specialtyId ?? null,
        specialtyIds: Array.isArray(json?.specialtyIds) ? json.specialtyIds : [],
        city: json?.city ?? null,
        keywords: Array.isArray(json?.keywords) ? json.keywords : [],
        notConfigured: false,
        method: typeof json?.method === "string" ? json.method : null,
        confidence: typeof json?.confidence === "number" ? json.confidence : null,
        modelVersion: typeof json?.modelVersion === "string" ? json.modelVersion : null,
        decision: json?.decision === "answer" || json?.decision === "clarify" || json?.decision === "abstain" ? json.decision : null,
        emergency: json?.emergency && Array.isArray(json.emergency.reasons)
          ? { reasons: json.emergency.reasons, source: json.emergency.source === "groq" ? "groq" : "router" }
          : null,
        clarify: json?.clarify && (json.clarify.kind === "age" || json.clarify.kind === "specialty") && Array.isArray(json.clarify.options)
          ? json.clarify
          : null,
        reason: typeof json?.reason === "string" ? json.reason : null,
      };
    },
  });
}
