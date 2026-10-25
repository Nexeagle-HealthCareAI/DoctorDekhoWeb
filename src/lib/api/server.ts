// ─────────────────────────────────────────────────────────────────────────────
// Server-only helper for talking to the EasyHMS public API.
//
// ⚠️  Import this ONLY from route handlers (app/api/**) and Server Components
//     (page.tsx files with no "use client"). It reads the secret API key from
//     env, which must never reach the browser bundle.
// ─────────────────────────────────────────────────────────────────────────────

import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import type { Doctor } from "@/data/patient";
import { doctors as mockDoctors } from "@/data/patient";
import type { Lab } from "@/data/labs";
import { mockLabs } from "@/data/labs";
import { mapDoctor, mapDoctors, mapLab, mapLabs, mapHospitals } from "./mappers";
import type { DoctorsResponseDto, LabsResponseDto, HospitalsResponseDto } from "./types";
import type { PublicHospital } from "./mappers";

const BASE_URL = process.env.EASYHMS_API_BASE_URL ?? "";
// Optional — the public API doesn't require a key (see PublicApiKeyFilter). Only set this if
// this deployment's traffic should be identified/revocable separately from anonymous callers.
const API_KEY = process.env.EASYHMS_API_KEY ?? "";
const KEY_HEADER = process.env.EASYHMS_API_KEY_HEADER ?? "X-Api-Key";
// Optional — lets easyHMSAPI's rate limiters see each real visitor's IP instead of this app's own
// container IP (every call here is server-to-server; see TrustedProxyIpResolver on the API side
// for why that distinction matters). Must match Internal:ProxyForwardingSecret there exactly, or
// the forwarded IP is simply ignored — nothing breaks either way if this is left unset.
const PROXY_SECRET = process.env.EASYHMS_TRUSTED_PROXY_SECRET ?? "";

/** True once the API root is configured in env — a key is optional. */
export function isConfigured(): boolean {
  return Boolean(BASE_URL);
}

/** Best-effort real visitor IP from the INCOMING request to this app. headers() only works inside
 * an actual request scope — returns null (never throws) when called from somewhere without one,
 * e.g. inside unstable_cache's callback (see getAllDoctors below), where there's no single
 * "visitor" to attribute the call to anyway. */
function resolveVisitorIp(): string | null {
  try {
    const h = headers();
    const forwardedFor = h.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    return h.get("cf-connecting-ip") || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export interface UpstreamResult<T = unknown> {
  ok: boolean;
  status: number;
  /** When the upstream env isn't set yet, so callers can fall back to mock data. */
  notConfigured: boolean;
  /** The upstream's Retry-After (seconds) on a rate-limit answer, so it can be passed on to the browser. */
  retryAfter?: string | null;
  data: T | null;
}

const NETWORK_RETRY_ATTEMPTS = 3;
const NETWORK_RETRY_DELAY_MS = 500;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch a path off the EasyHMS API root with the hospital key attached. */
export async function easyhmsFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<UpstreamResult<T>> {
  if (!isConfigured()) {
    return { ok: false, status: 503, notConfigured: true, data: null };
  }

  const visitorIp = PROXY_SECRET ? resolveVisitorIp() : null;

  let res: Response | undefined;
  for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt++) {
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(API_KEY ? { [KEY_HEADER]: API_KEY } : {}),
          ...(PROXY_SECRET && visitorIp
            ? { "X-Internal-Proxy-Secret": PROXY_SECRET, "X-Forwarded-Client-Ip": visitorIp }
            : {}),
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
      });
      break;
    } catch {
      // Network-level failure (DNS, connection timeout/refused, TLS) -- as opposed to a
      // non-2xx HTTP response, which is handled below via res.ok. Retried a couple times
      // with a short backoff first: this fetch is what backs generateStaticParams (via
      // getAllDoctors), which always runs with a COLD unstable_cache -- there's no
      // previously-cached good value for stale-while-revalidate to fall back on the way
      // there is for a warm running server, so a single transient blip here has nothing
      // to protect it and fails the ENTIRE production build (every page, not just ones
      // needing live data). A real, persistent outage still exhausts all attempts and
      // reports the same shape as a failed HTTP response, so callers' existing "fail
      // loudly" paths (see getAllDoctors) still fire for that case.
      if (attempt === NETWORK_RETRY_ATTEMPTS) {
        return { ok: false, status: 0, notConfigured: false, data: null };
      }
      await delay(NETWORK_RETRY_DELAY_MS * attempt);
    }
  }

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    /* non-JSON or empty body */
  }

  return { ok: res.ok, status: res.status, data, notConfigured: false, retryAfter: res.headers.get("retry-after") };
}

export interface GetDoctorByIdResult {
  doctor: Doctor | null;
  notConfigured: boolean;
}

// No single-doctor public backend endpoint exists yet (only the full-directory
// list) — fetch the directory server-side and find the match. Fine at today's
// directory size; if the platform-wide directory grows large, this is the spot
// to swap in a dedicated GET /public/doctors/{id} backend endpoint instead.
export async function getDoctorById(doctorId: string): Promise<GetDoctorByIdResult> {
  // pageSize=2000 — this endpoint is now paginated (default 24) for the client-side browsing
  // UI, but there's still no dedicated GET /public/doctors/{id}; explicitly asking for the
  // whole directory here keeps this scan-by-id working exactly as before.
  const result = await easyhmsFetch<DoctorsResponseDto>("/public/doctors?pageSize=2000");
  if (result.notConfigured) return { doctor: null, notConfigured: true };

  const dto = result.data?.doctors?.find((d) => d.doctorId === doctorId);
  return { doctor: dto ? mapDoctor(dto) : null, notConfigured: false };
}

// Both QR endpoints return a raw PNG, not JSON -- easyhmsFetch always calls res.json(), so
// these fetch directly instead and hand back a data: URL ready for an <img src>. Cached via
// Next's own fetch-level Data Cache (not unstable_cache -- that's only needed to wrap calls
// that must force `no-store`, which these don't) since neither QR's content ever changes for
// a given doctorId/at all, so re-fetching per page view would be pure waste. Both return null
// on any failure so callers can just hide the QR block rather than render a broken image.
async function fetchQrCodeDataUrl(path: string): Promise<string | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: API_KEY ? { [KEY_HEADER]: API_KEY } : {},
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Doctor's own WhatsApp-booking QR (NexEagle logo centered) -- scanning it lands the patient
 * straight into booking THIS doctor via the WhatsApp bot's deterministic DRBOOK trigger. */
export async function getDoctorQrCodeDataUrl(doctorId: string): Promise<string | null> {
  return fetchQrCodeDataUrl(`/public/doctors/${doctorId}/qr-code`);
}

/** Generic "chat with us on WhatsApp" QR (NexEagle logo centered) -- e.g. the Doctor Dekho
 * homepage's WhatsApp CTA. */
export async function getWhatsAppEntryQrCodeDataUrl(): Promise<string | null> {
  return fetchQrCodeDataUrl("/public/whatsapp-qr-code");
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllDoctors — the shared doctor-directory fetch for SERVER-RENDERED listing
// pages (homepage, /specialties/**, /conditions/**, /hospitals/**). This is
// what puts real doctor names/links into the raw HTML those pages send, so a
// non-JS crawler sees content instead of an empty client shell.
//
// Deliberately NOT the same code path as the client's live re-fetch
// (`/api/public/doctors` → easyhmsFetch, which stays `no-store`/force-dynamic
// on purpose). easyhmsFetch's own `cache: "no-store"` would otherwise force
// every one of the ~400 statically generated pages to hit the upstream API
// once each at build/render time — unstable_cache caches the RESULT of this
// function in Next's persistent Data Cache instead, independent of the inner
// fetch's own cache mode, so all of them share one upstream call per
// `revalidate` window (also what makes `export const revalidate` on those
// pages meaningful downstream, once it's added there).
// ─────────────────────────────────────────────────────────────────────────────
export interface AllDoctorsResult {
  doctors: Doctor[];
  notConfigured: boolean;
}

const fetchAllDoctorsCached = unstable_cache(
  async (): Promise<AllDoctorsResult> => {
    if (!isConfigured()) {
      if (process.env.NODE_ENV === "production") {
        // A missing EASYHMS_API_BASE_URL here would otherwise silently ship
        // mock doctor data on every one of the ~400 real production pages —
        // fail the build/request loudly instead.
        throw new Error(
          "getAllDoctors: EASYHMS_API_BASE_URL is not set. Refusing to silently " +
            "build/serve real listing pages with mock doctor data in production " +
            "— set EASYHMS_API_BASE_URL and retry."
        );
      }
      // Local/dev convenience: keep the app runnable without the real API.
      return { doctors: mockDoctors, notConfigured: true };
    }

    // pageSize=2000 — see getDoctorById's comment above; this feeds ~400 statically generated
    // listing pages and needs the whole directory, not the paginated browsing default.
    const result = await easyhmsFetch<DoctorsResponseDto>("/public/doctors?pageSize=2000");
    if (result.notConfigured || !result.data) {
      // Deliberately NOT falling back to mock data here (unlike the !isConfigured() branch
      // above, which is a genuine "no backend configured at all" case). This branch means
      // EASYHMS_API_BASE_URL WAS set but the live call still failed -- a real, unexpected
      // failure (network/DNS/API down), and silently serving mock doctors in that case is
      // exactly what let a container-networking bug (the deployed site unable to reach its
      // own host's API) go unnoticed on BOTH dev and prod for an extended period: every
      // visitor saw 9 fake doctors with no error anywhere. Throwing here surfaces the
      // failure immediately and loudly instead. unstable_cache's revalidate:3600 means a
      // transient blip after a good value is already cached still serves the last good
      // value (stale-while-revalidate) rather than breaking live traffic -- this only bites
      // on a genuinely persistent failure, which is exactly when you want to know.
      throw new Error(
        `getAllDoctors: live call to ${process.env.EASYHMS_API_BASE_URL} failed ` +
          `(status ${result.status}). Not falling back to mock data.`
      );
    }
    return { doctors: mapDoctors(result.data.doctors), notConfigured: false };
  },
  ["public-doctors"],
  { revalidate: 3600, tags: ["doctors"] }
);

export async function getAllDoctors(): Promise<AllDoctorsResult> {
  return fetchAllDoctorsCached();
}

// ─────────────────────────────────────────────────────────────────────────────
// getAllLabs / getLabById — same SSR-cacheable pattern as getAllDoctors/
// getDoctorById above, for the pathology-lab directory. Labs are an
// INDEPENDENT listing (no Hospital.IsPubliclyListed dependency) -- see
// GetPublicLabsHandler.cs.
// ─────────────────────────────────────────────────────────────────────────────
export interface AllLabsResult {
  labs: Lab[];
  notConfigured: boolean;
}

const fetchAllLabsCached = unstable_cache(
  async (): Promise<AllLabsResult> => {
    if (!isConfigured()) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "getAllLabs: EASYHMS_API_BASE_URL is not set. Refusing to silently " +
            "build/serve real listing pages with mock lab data in production " +
            "— set EASYHMS_API_BASE_URL and retry."
        );
      }
      return { labs: mockLabs, notConfigured: true };
    }

    const result = await easyhmsFetch<LabsResponseDto>("/public/labs?pageSize=2000");
    if (result.notConfigured || !result.data) {
      // Same "fail loudly rather than silently serve mock data" discipline as getAllDoctors --
      // a real, persistent failure should be visible immediately, not masked by a fallback.
      throw new Error(
        `getAllLabs: live call to ${process.env.EASYHMS_API_BASE_URL} failed ` +
          `(status ${result.status}). Not falling back to mock data.`
      );
    }
    return { labs: mapLabs(result.data.labs), notConfigured: false };
  },
  ["public-labs"],
  { revalidate: 3600, tags: ["labs"] }
);

export async function getAllLabs(): Promise<AllLabsResult> {
  return fetchAllLabsCached();
}

export interface GetLabByIdResult {
  lab: Lab | null;
  notConfigured: boolean;
}

// Unlike getDoctorById, the backend supports an exact labId filter directly (GetPublicLabsHandler
// reuses its own paginated query for this) -- the labs dataset is expected to start small, so this
// keeps the per-request payload minimal rather than fetching the whole directory to scan by id.
export async function getLabById(labId: string): Promise<GetLabByIdResult> {
  const result = await easyhmsFetch<LabsResponseDto>(`/public/labs?labId=${encodeURIComponent(labId)}&pageSize=1`);
  if (result.notConfigured) return { lab: null, notConfigured: true };

  const dto = result.data?.labs?.[0];
  return { lab: dto ? mapLab(dto) : null, notConfigured: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform-wide hospital directory (app/hospitals/page.tsx's "near me" map/search view).
// Unlike getAllDoctors, there's no mock-data fallback: this is a net-new, non-critical
// view, so when the API isn't configured it just renders an empty list rather than
// throwing and failing the build (see isConfigured() guard below).
// ─────────────────────────────────────────────────────────────────────────────
export interface AllHospitalsResult {
  hospitals: PublicHospital[];
  notConfigured: boolean;
}

const fetchAllHospitalsCached = unstable_cache(
  async (): Promise<AllHospitalsResult> => {
    if (!isConfigured()) {
      return { hospitals: [], notConfigured: true };
    }
    const result = await easyhmsFetch<HospitalsResponseDto>("/public/hospitals");
    if (result.notConfigured || !result.data) {
      return { hospitals: [], notConfigured: true };
    }
    return { hospitals: mapHospitals(result.data.hospitals), notConfigured: false };
  },
  ["public-hospitals"],
  { revalidate: 3600, tags: ["hospitals"] }
);

export async function getAllHospitals(): Promise<AllHospitalsResult> {
  return fetchAllHospitalsCached();
}
