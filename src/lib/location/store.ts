"use client";

import { useSyncExternalStore } from "react";
import { cityId, type CityOption } from "@/data/patient";
import type { GeoStatus } from "@/lib/geo";

// The visitor's location, shared by every part of the site: the home page's city picker and the Vita
// chat read and write the same value, so a change in one shows in the other at once (other tabs too).
//
// - city: remembered on this device (localStorage) so the next visit starts in the same city.
// - coords: the precise point, kept only for this browser session (sessionStorage), never with a name,
//   and sent only with a search -- the privacy rule in the Vita requirements.
// - source: how it was set. "detected" (browser location), "picked" (the patient chose or typed it),
//   "default" (the business's home city when location is unavailable). A detected value never
//   overwrites one the patient picked, unless the patient asked to use their location again.
// - status: where browser detection stands (not saved). LocationDetector, mounted once in the layout,
//   detects on every page load and writes here.

export type LocationSource = "detected" | "picked" | "default";

export interface SharedLocation {
  city: CityOption | null;
  coords: { lat: number; lng: number } | null;
  source: LocationSource | null;
  status: GeoStatus;
}

type Coords = { lat: number; lng: number };

const CITY_KEY = "dd_location_city";
const COORDS_KEY = "dd_location_coords";
const EMPTY: SharedLocation = { city: null, coords: null, source: null, status: "idle" };

let current: SharedLocation = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): SharedLocation {
  if (typeof window === "undefined") return EMPTY;
  try {
    const c = window.localStorage.getItem(CITY_KEY);
    const p = window.sessionStorage.getItem(COORDS_KEY);
    const saved = c ? (JSON.parse(c) as { city: CityOption; source: LocationSource }) : null;
    const coords = p ? (JSON.parse(p) as { lat: number; lng: number }) : null;
    return { city: saved?.city ?? null, coords, source: saved?.source ?? (coords ? "detected" : null), status: current.status };
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    current = read();
    window.addEventListener("storage", (e) => {
      if (e.key === CITY_KEY) {
        current = read();
        emit();
      }
    });
  }
}

function persist(next: SharedLocation) {
  try {
    if (next.city) window.localStorage.setItem(CITY_KEY, JSON.stringify({ city: next.city, source: next.source }));
    else window.localStorage.removeItem(CITY_KEY);
    if (next.coords) window.sessionStorage.setItem(COORDS_KEY, JSON.stringify(next.coords));
    else window.sessionStorage.removeItem(COORDS_KEY);
  } catch {
    /* storage unavailable: the shared value still works for this page view */
  }
}

export function getLocation(): SharedLocation {
  ensureLoaded();
  return current;
}

function emit() {
  listeners.forEach((l) => l());
}

// Set by detectAgain(): the next detected location replaces even a picked one, because the patient
// just asked for it ("Allow location" on the site, "Share my location" in the chat).
let forceDetected = false;
let waiting: ((c: Coords | null) => void)[] = [];
let redetect: (() => void) | null = null;

/**
 * Update the shared location. A "detected" update never replaces a city the patient picked (unless
 * they asked to use their location again); a "picked" city without a point clears the old point,
 * since it no longer matches; a "default" never replaces a real location.
 */
export function setLocation(update: { city?: CityOption | null; coords?: Coords | null }, source: LocationSource) {
  ensureLoaded();
  const prev = current;
  let next: SharedLocation;
  if (source === "detected" && prev.source === "picked" && !forceDetected) {
    return;
  } else if (source === "default" && prev.city && prev.source !== "default") {
    return;
  } else {
    if (source === "detected") forceDetected = false;
    next = {
      city: update.city !== undefined ? update.city : prev.city,
      coords: update.coords !== undefined ? update.coords : source === "detected" ? prev.coords : null,
      source,
      status: prev.status,
    };
  }
  const same = next.source === prev.source && next.city?.id === prev.city?.id
    && next.coords?.lat === prev.coords?.lat && next.coords?.lng === prev.coords?.lng;
  if (same) return;
  current = next;
  persist(next);
  emit();
}

/** Where detection stands; LocationDetector reports it. Settling (found/denied/unsupported) answers
 * anyone waiting in detectAgain(). */
export function setDetectStatus(status: GeoStatus) {
  ensureLoaded();
  if (status !== current.status) {
    current = { ...current, status };
    emit();
  }
  if (status === "found" || status === "denied" || status === "unsupported") {
    const done = waiting;
    waiting = [];
    forceDetected = false;
    done.forEach((r) => r(status === "found" ? current.coords : null));
  }
}

/** LocationDetector registers how to run detection again. */
export function registerRedetect(fn: (() => void) | null) {
  redetect = fn;
}

/**
 * The patient asked to use their location (site or chat): detect again and let the result replace
 * any picked city. Resolves with the point, or null when the browser said no.
 */
export function detectAgain(): Promise<Coords | null> {
  ensureLoaded();
  forceDetected = true;
  return new Promise((resolve) => {
    if (redetect) {
      waiting.push(resolve);
      redetect();
      return;
    }
    // No detector on this page (tests, bare pages): ask the browser directly for the point.
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      forceDetected = false;
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation({ city: null, coords: c }, "detected");
        resolve(c);
      },
      () => {
        forceDetected = false;
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

/** A city the patient typed in the chat ("Salt Lake", "Purnia"): matched to a known city by name when
 * possible, else kept as typed. */
export function cityFromText(text: string, known: CityOption[] = []): CityOption {
  const name = text.trim();
  const hit = known.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return hit ?? { id: cityId(name, ""), name, state: "" };
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The shared location, re-rendering on every change from anywhere on the site. */
export function useSharedLocation(): SharedLocation {
  return useSyncExternalStore(subscribe, getLocation, () => EMPTY);
}

/** Tests only. */
export function __resetLocationStore() {
  current = EMPTY;
  loaded = false;
  listeners.clear();
  forceDetected = false;
  waiting = [];
  redetect = null;
}
