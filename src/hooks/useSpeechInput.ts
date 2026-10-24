"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tap-to-speak for the Vita chat, using the browser's own speech recognition (Chrome, Edge, Safari;
// not Firefox). Nothing is recorded or uploaded by this site: the browser turns speech into text,
// which lands in the message box for the patient to check and send. Hidden where unsupported.

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Speech language for the site's language: Hindi and Hinglish speakers are heard in hi-IN (the router
 * reads Devanagari), Bengali in bn-IN, English in en-IN. */
export function speechLang(locale: string): string {
  if (locale === "hi" || locale === "hinglish") return "hi-IN";
  if (locale === "bn") return "bn-IN";
  return "en-IN";
}

export function useSpeechInput(locale: string, onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<RecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    return () => rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || listening) return;
    const r = new Ctor();
    r.lang = speechLang(locale);
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((res) => res[0]?.transcript ?? "").join(" ").trim();
      if (text) onTextRef.current(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, locale]);

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
