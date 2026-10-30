"use client";

import { useCallback, useEffect, useState } from "react";

// The patient's own chat settings, kept on this device: text size, "read replies aloud" and "listen for Hey Vita".
// Small, non-medical, safe to keep in localStorage; the chat works the same without storage.

export type TextSize = "normal" | "large" | "larger";
export const TEXT_ZOOM: Record<TextSize, number> = { normal: 1, large: 1.15, larger: 1.3 };

export interface VitaPrefs {
  textSize: TextSize;
  readAloud: boolean;
  /** Listen for "Hey Vita" while the site is open (on the device; off unless the patient turns it on). */
  wakeWord: boolean;
}

const KEY = "vita_prefs";
const DEFAULTS: VitaPrefs = { textSize: "normal", readAloud: false, wakeWord: false };
const EVENT = "vita-prefs";

function read(): VitaPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<VitaPrefs>;
    return {
      textSize: p.textSize && p.textSize in TEXT_ZOOM ? p.textSize : DEFAULTS.textSize,
      readAloud: Boolean(p.readAloud),
      wakeWord: Boolean(p.wakeWord),
    };
  } catch {
    return DEFAULTS;
  }
}

export function useVitaPrefs() {
  const [prefs, setPrefs] = useState<VitaPrefs>(DEFAULTS);
  useEffect(() => {
    setPrefs(read());
    // the chat panel and the Vita button each read the settings: a change in one reaches the other
    const sync = () => setPrefs(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((change: Partial<VitaPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...change };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
        queueMicrotask(() => window.dispatchEvent(new Event(EVENT)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { prefs, update };
}
