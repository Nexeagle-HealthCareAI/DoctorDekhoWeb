"use client";

import { useCallback, useRef, useState } from "react";
import { CITIES } from "@/data/patient";
import { cityFromText, detectAgain, setLocation, useSharedLocation } from "@/lib/location/store";
import type { VitaReply, VitaRequest } from "@/lib/vita/types";

// Conversation state for the Vita chat panel. Every turn goes through /api/vita/chat (server proxy
// to the router's /v2/agent/chat). The session id lives in sessionStorage so a page change keeps the
// conversation. The location is the site's shared one (src/lib/location/store.ts): taken by default,
// the same city the home page shows, and a change here shows there. City and point are sent with each
// turn; the router uses them for that search and never stores the point.

export type VitaErrorKind = "unavailable" | "invalid" | "too_many";

export interface VitaEntry {
  id: number;
  role: "user" | "vita" | "error";
  text?: string;
  reply?: VitaReply;
  error?: VitaErrorKind;
}

export interface SendOptions {
  select_doctor_id?: string;
  page?: number;
  new_search?: boolean;
  /** Text shown in the patient's bubble when it differs from what is sent (a tapped chip). */
  shownAs?: string;
  /** Do not show a patient bubble (e.g. "Show more doctors" button). */
  quiet?: boolean;
}

const SESSION_KEY = "vita_session";

function readStore(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function writeStore(storage: "local" | "session", key: string, value: string | null) {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* storage unavailable (private mode): the chat still works for this page view */
  }
}

export function useVitaChat(options: { hospitalId?: string; uiLanguage?: string } = {}) {
  const [entries, setEntries] = useState<VitaEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const location = useSharedLocation();
  const coords = location.coords;
  const city = location.city?.name ?? null;
  const sessionRef = useRef<string | null>(typeof window === "undefined" ? null : readStore("session", SESSION_KEY));
  const nextId = useRef(1);
  const lastSend = useRef<{ text: string; opts: SendOptions } | null>(null);

  const push = useCallback((e: Omit<VitaEntry, "id">) => {
    setEntries((prev) => [...prev, { ...e, id: nextId.current++ }]);
  }, []);

  const send = useCallback(
    async (text: string, opts: SendOptions = {}, override?: { lat?: number; lng?: number; city?: string | null }) => {
      const clean = text.trim();
      if (!clean || busy) return;
      lastSend.current = { text: clean, opts };
      if (!opts.quiet) push({ role: "user", text: opts.shownAs ?? clean });
      setBusy(true);

      const at = override?.lat !== undefined ? { lat: override.lat, lng: override.lng } : coords ?? undefined;
      const town = override?.city !== undefined ? override.city : city;
      const body: VitaRequest = {
        text: clean,
        ...(sessionRef.current ? { session_id: sessionRef.current } : {}),
        ...(town ? { city: town } : {}),
        ...(at && at.lat !== undefined && at.lng !== undefined ? { lat: at.lat, lng: at.lng } : {}),
        ...(options.hospitalId ? { hospital_id: options.hospitalId } : {}),
        ...(options.uiLanguage ? { ui_language: options.uiLanguage } : {}),
        ...(opts.select_doctor_id ? { select_doctor_id: opts.select_doctor_id } : {}),
        ...(opts.page && opts.page > 1 ? { page: opts.page } : {}),
        ...(opts.new_search ? { new_search: true } : {}),
      };
      try {
        const res = await fetch("/api/vita/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          push({ role: "error", error: res.status === 422 ? "invalid" : res.status === 429 ? "too_many" : "unavailable" });
          return;
        }
        const reply = (await res.json()) as VitaReply;
        if (reply.session_id) {
          sessionRef.current = reply.session_id;
          writeStore("session", SESSION_KEY, reply.session_id);
        }
        push({ role: "vita", reply });
      } catch {
        push({ role: "error", error: "unavailable" });
      } finally {
        setBusy(false);
      }
    },
    [busy, coords, city, options.hospitalId, options.uiLanguage, push],
  );

  const retry = useCallback(() => {
    const last = lastSend.current;
    if (last) void send(last.text, { ...last.opts, quiet: true });
  }, [send]);

  /** "Share my location": detect again; the result replaces a picked city, here and on the site. */
  const requestLocation = useCallback((): Promise<{ lat: number; lng: number } | null> => detectAgain(), []);

  /** A city or area the patient typed (with its point, when the map service found one); the site's
   * city picker shows it too. */
  const setCity = useCallback((value: string | null, at?: { lat: number; lng: number } | null) => {
    const v = value?.trim() || null;
    setLocation({ city: v ? cityFromText(v, CITIES) : null, coords: at ?? null }, "picked");
  }, []);

  const reset = useCallback(() => {
    sessionRef.current = null;
    writeStore("session", SESSION_KEY, null);
    lastSend.current = null;
    setEntries([]);
  }, []);

  return { entries, busy, send, retry, reset, coords, city, setCity, requestLocation };
}
