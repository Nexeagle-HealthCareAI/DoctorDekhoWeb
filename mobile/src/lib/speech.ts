import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "./i18n/types";

/** BCP-47 voices on Android/iOS. Hinglish is written in Latin script but spoken like Hindi-accented English. */
export const SPEECH_LANG: Record<Locale, string> = { en: "en-IN", hi: "hi-IN", bn: "bn-IN", hinglish: "en-IN" };

/** Read text aloud in the patient's language ("Listen" on the confirmation). Tapping again stops it. */
export function useReadAloud(locale: Locale) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => void Speech.stop(), []);
  const toggle = useCallback(
    (text: string) => {
      if (speaking) {
        void Speech.stop();
        setSpeaking(false);
        return;
      }
      setSpeaking(true);
      Speech.speak(text, {
        language: SPEECH_LANG[locale],
        rate: 0.92,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [locale, speaking],
  );
  return { speaking, toggle };
}

// ── Voice search ─────────────────────────────────────────────────────────────────────────────────
// expo-speech-recognition is a native module: it exists in development and store builds, not in Expo Go.
// It is loaded lazily so the app still runs where it is missing; the mic button then simply hides.

type Recognizer = {
  start: (o: { lang: string; interimResults: boolean; continuous: boolean }) => void;
  stop: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  isRecognitionAvailable: () => boolean;
  addListener: (event: string, cb: (e: any) => void) => { remove: () => void };
};

let cached: Recognizer | null | undefined;
function recognizer(): Recognizer | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-recognition").ExpoSpeechRecognitionModule as Recognizer;
    cached = mod && mod.isRecognitionAvailable() ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

export const voiceSearchAvailable = () => recognizer() !== null;

/**
 * Hold-free voice search: tap once, speak, and the words land in the search box (partial words appear as they are heard).
 * Indian-language users often mix Hindi and English, so the recognizer runs in the app language and the
 * symptom router on the server does the matching.
 */
export function useVoiceSearch(locale: Locale, onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subs = useRef<{ remove: () => void }[]>([]);
  const cb = useRef(onText);
  cb.current = onText;

  const cleanup = useCallback(() => {
    subs.current.forEach((s) => s.remove());
    subs.current = [];
    setListening(false);
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    const r = recognizer();
    if (!r) return;
    setError(null);
    const perm = await r.requestPermissionsAsync().catch(() => ({ granted: false }));
    if (!perm.granted) {
      setError("permission");
      return;
    }
    cleanup();
    subs.current = [
      r.addListener("result", (e: { results?: { transcript?: string }[]; isFinal?: boolean }) => {
        const text = e.results?.[0]?.transcript ?? "";
        if (text) cb.current(text, !!e.isFinal);
      }),
      r.addListener("error", (e: { error?: string }) => {
        setError(e.error ?? "error");
        cleanup();
      }),
      r.addListener("end", () => cleanup()),
    ];
    setListening(true);
    r.start({ lang: SPEECH_LANG[locale], interimResults: true, continuous: false });
  }, [locale, cleanup]);

  const stop = useCallback(() => {
    recognizer()?.stop();
    cleanup();
  }, [cleanup]);

  return { available: voiceSearchAvailable(), listening, error, start, stop };
}
