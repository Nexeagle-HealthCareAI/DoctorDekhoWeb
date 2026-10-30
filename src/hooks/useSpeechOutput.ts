"use client";

import { useCallback, useEffect, useState } from "react";

// Read Vita's replies aloud with the browser's own voices (speechSynthesis). Nothing leaves the device.
// Hindi script is read by a Hindi voice; English and Hinglish (Roman letters) by an Indian English voice,
// which says Roman Hindi far better than a Hindi voice reading Roman letters. Hidden where unsupported.

export function voiceLang(language: string | undefined): string {
  return language === "hindi" ? "hi-IN" : "en-IN";
}

/** Strip what should not be spoken: emoji-like symbols, bracketed specialty names stay. */
export function speakable(text: string): string {
  return text.replace(/[*_#>[\]]/g, " ").replace(/\s+/g, " ").trim();
}

export function useSpeechOutput() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: number, text: string, language?: string) => {
    if (!supported) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.lang = voiceLang(language);
      const voice = synth.getVoices().find((v) => v.lang === u.lang) ?? synth.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
      u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
      setSpeakingId(id);
      synth.speak(u);
    } catch {
      setSpeakingId(null);
    }
  }, [supported]);

  return { supported, speakingId, speak, stop };
}
