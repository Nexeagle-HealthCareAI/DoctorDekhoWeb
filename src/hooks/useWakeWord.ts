"use client";

import { useEffect, useRef, useState } from "react";
import { WakeWordEngine, wakeWordSupported, type WakeState } from "@/lib/wakeword/engine";
import { verifyWake } from "@/lib/wakeword/verify";

// Listens for "Hey Vita" while `active` (the patient turned it on, the page is visible, and Vita isn't already listening).
// Hidden tabs stop listening: browsers throttle them, and the microphone should not stay open in the background.

export type WakeStatus = "off" | WakeState;

export function useWakeWord({ active, onWake, locale, debug = false }: {
  active: boolean;
  onWake: () => void;
  /** The site's language, for the second check's transcription. */
  locale: string;
  debug?: boolean;
}) {
  const [status, setStatus] = useState<WakeStatus>("off");
  const [score, setScore] = useState(0);
  const [visible, setVisible] = useState(true);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const [lastCheck, setLastCheck] = useState<string>("");

  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== "hidden");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const run = active && visible && wakeWordSupported();
  useEffect(() => {
    if (!run) {
      setStatus("off");
      return;
    }
    const engine = new WakeWordEngine({
      onWake: (audio) => {
        // the device thinks it heard "Hey Vita": confirm with the speech service before opening. If that can't be reached,
        // the device's own decision stands.
        void verifyWake(audio, localeRef.current).then((v) => {
          if (debug) setLastCheck(v);
          if (v !== "no") onWakeRef.current();
        });
      },
      onState: setStatus,
      onScore: debug ? setScore : undefined,           // only for tuning: 12 updates a second
    });
    void engine.start();
    return () => {
      engine.stop();
      setScore(0);
    };
  }, [run, debug]);

  return { status, score, lastCheck, supported: wakeWordSupported() };
}
