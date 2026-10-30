"use client";

import { useCallback, useEffect, useState } from "react";

// The patient's own chat settings, kept on this device: text size and "read replies aloud".
// Small, non-medical, safe to keep in localStorage; the chat works the same without storage.

export type TextSize = "normal" | "large" | "larger";
export const TEXT_ZOOM: Record<TextSize, number> = { normal: 1, large: 1.15, larger: 1.3 };

export interface VitaPrefs {
  textSize: TextSize;
  readAloud: boolean;
}

const KEY = "vita_prefs";
const DEFAULTS: VitaPrefs = { textSize: "normal", readAloud: false };

function read(): VitaPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<VitaPrefs>;
    return {
      textSize: p.textSize && p.textSize in TEXT_ZOOM ? p.textSize : DEFAULTS.textSize,
      readAloud: Boolean(p.readAloud),
    };
  } catch {
    return DEFAULTS;
  }
}

export function useVitaPrefs() {
  const [prefs, setPrefs] = useState<VitaPrefs>(DEFAULTS);
  useEffect(() => setPrefs(read()), []);
  const update = useCallback((change: Partial<VitaPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...change };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { prefs, update };
}
