"use client";

// Website analytics for the CMS Insights tab and the hospitals' Lead Generation page.
//
// Privacy rules (decided 2026-10-19):
//  * Notice + opt-out: tracking runs unless the visitor chose "Decline" in the consent banner
//    (ConsentBanner.tsx). Declining stops every beacon below and forgets the visitor id.
//  * The visitor id groups one visit only: it expires after 30 minutes without activity, so a
//    returning visitor is not linked to earlier visits.
//  * One network call per user action: page view, funnel event and lead beacons raised together
//    (e.g. a doctor-profile view raises all three) are queued for a moment and sent as ONE batch to
//    /api/track, which fans out server-side.
//  * The server truncates IPs and stores only a masked + hashed mobile in AnalyticsEvents.

const SESSION_KEY = "neg_visit_session";        // { id, last } JSON
const LEGACY_SESSION_KEY = "neg_visit_session_id"; // pre-2026-10 permanent id, removed on sight
const CONSENT_KEY = "neg_analytics_consent";     // "accepted" | "declined"
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 300;

export type ConsentChoice = "accepted" | "declined";
export const CONSENT_CHANGED_EVENT = "neg-consent-changed";
export const OPEN_CONSENT_EVENT = "neg-open-consent";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The visitor's stored choice, or null if they have not chosen yet. */
export function getConsentChoice(): ConsentChoice | null {
  const v = storage()?.getItem(CONSENT_KEY);
  return v === "accepted" || v === "declined" ? v : null;
}

/** Notice + opt-out: tracking is allowed unless the visitor declined. */
export function isTrackingAllowed(): boolean {
  return getConsentChoice() !== "declined";
}

export function setConsentChoice(choice: ConsentChoice): void {
  const s = storage();
  try {
    s?.setItem(CONSENT_KEY, choice);
    if (choice === "declined") {
      s?.removeItem(SESSION_KEY);
      s?.removeItem(LEGACY_SESSION_KEY);
      queue = emptyBatch();
    }
  } catch {
    /* storage blocked: nothing persisted, banner shows again next visit */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: choice }));
}

/** Reopen the consent banner (footer "Tracking choices" link). */
export function openConsentChoices(): void {
  window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT));
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Groups page views AND funnel events of one visit (search -> profile view -> booking step) so the
// CMS can correlate them without a server-side session store. Expires after 30 minutes idle.
export function getOrCreateSessionId(): string {
  const s = storage();
  const now = Date.now();
  try {
    s?.removeItem(LEGACY_SESSION_KEY);
    const raw = s?.getItem(SESSION_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { id?: string; last?: number };
      if (saved.id && typeof saved.last === "number" && now - saved.last < SESSION_IDLE_MS) {
        s?.setItem(SESSION_KEY, JSON.stringify({ id: saved.id, last: now }));
        return saved.id;
      }
    }
    const id = newId();
    s?.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
    return id;
  } catch {
    // Storage unavailable (private mode etc.): a per-call id; events still record, uncorrelated.
    return newId();
  }
}

// ── Batching ──────────────────────────────────────────────────────────────────────────────────────
interface Batch {
  visits: Record<string, unknown>[];
  events: Record<string, unknown>[];
  leads: Record<string, unknown>[];
}

function emptyBatch(): Batch {
  return { visits: [], events: [], leads: [] };
}

let queue: Batch = emptyBatch();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unloadHooked = false;

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = queue;
  queue = emptyBatch();
  if (!batch.visits.length && !batch.events.length && !batch.leads.length) return;
  if (!isTrackingAllowed()) return;
  try {
    const body = JSON.stringify(batch);
    // sendBeacon survives navigation; fall back to a keepalive fetch where it is unavailable or refuses.
    const sent =
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    if (!sent) {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        /* best-effort */
      });
    }
  } catch {
    /* best-effort: never fail because a beacon could not be built or sent */
  }
}

function enqueue(kind: keyof Batch, item: Record<string, unknown>): void {
  if (typeof window === "undefined" || !isTrackingAllowed()) return;
  queue[kind].push(item);
  if (!unloadHooked) {
    unloadHooked = true;
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

// ── Public beacons (fire-and-forget: never throw, never awaited, never block rendering) ─────────────

export function trackPageView(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    enqueue("visits", {
      pagePath: window.location.pathname,
      referrerUrl: document.referrer || null,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
      userAgent: navigator.userAgent,
      sessionId: getOrCreateSessionId(),
    });
  } catch {
    /* best-effort */
  }
}

export type AnalyticsEventType =
  | "login_initiated"
  | "otp_sent"
  | "otp_verified"
  | "otp_verify_failed"
  | "search_performed"
  | "doctor_profile_viewed"
  | "booking_step_reached"
  | "chat_widget_opened"
  | "chat_whatsapp_handoff";

interface TrackEventPayload {
  mobile?: string;
  doctorId?: string;
  specialtyId?: string;
  metadata?: Record<string, unknown>;
}

// Funnel/behaviour event for the CMS Insights tab (Auth Funnel / Booking Funnel / All Searches).
export function trackEvent(eventType: AnalyticsEventType, payload: TrackEventPayload = {}): void {
  try {
    enqueue("events", {
      eventType,
      sessionId: getOrCreateSessionId(),
      mobile: payload.mobile,
      doctorId: payload.doctorId,
      specialtyId: payload.specialtyId,
      metadataJson: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
    });
  } catch {
    /* best-effort */
  }
}

export type LeadType = "DoctorNameSearch" | "HospitalNameSearch" | "DoctorProfileView" | "HospitalPageView";

interface RecordLeadPayload {
  hospitalId: string;
  doctorId?: string;
  leadType: LeadType;
  searchQuery?: string;
  mobile?: string;
  patientName?: string;
}

// Hospital-scoped marketing lead for the Lead Generation page (easyHMSWeb). Kept separate from
// trackEvent() on the server (see /public/leads), but travels in the same batch.
export function recordLead(payload: RecordLeadPayload): void {
  if (!payload.hospitalId) return;
  try {
    enqueue("leads", {
      hospitalId: payload.hospitalId,
      doctorId: payload.doctorId,
      source: "DoctorDekho",
      leadType: payload.leadType,
      searchQuery: payload.searchQuery,
      mobile: payload.mobile,
      patientName: payload.patientName,
      sessionId: getOrCreateSessionId(),
    });
  } catch {
    /* best-effort */
  }
}
