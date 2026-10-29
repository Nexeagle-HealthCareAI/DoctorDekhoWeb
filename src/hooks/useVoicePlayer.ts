"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speechChunks } from "@/lib/voice/chunks";
import { voiceLang } from "@/hooks/useSpeechOutput";

// Vita speaking in the live conversation. English replies use Groq's voice (/api/voice/speak, a sentence at a time, the next one
// fetched while this one plays); Hindi and Hinglish, which Groq can't speak yet, use the browser's own voice. If Groq fails
// mid-reply, the browser reads the rest. speak() resolves when Vita has finished (or was stopped).

let groqLanguages: Promise<Set<string>> | null = null;
function serverLanguages(): Promise<Set<string>> {
  groqLanguages ??= fetch("/api/voice/speak", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { languages: [] }))
    .then((b: { languages?: string[] }) => new Set((b.languages ?? []).map((l) => l.toLowerCase())))
    .catch(() => new Set<string>());
  return groqLanguages;
}

// 0.1 s of silence: played on the tap that starts the conversation, so the browser lets this element play later on its own.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

export function useVoicePlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0);
  const [speaking, setSpeaking] = useState(false);

  /** Call from the tap that starts the conversation (autoplay rules). */
  const prime = useCallback(() => {
    if (typeof Audio === "undefined") return;
    audio.current ??= new Audio();
    audio.current.src = SILENCE;
    void audio.current.play().catch(() => {});
    void serverLanguages();
  }, []);

  const stop = useCallback(() => {
    run.current += 1;
    audio.current?.pause();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback(async (text: string, language?: string) => {
    const id = ++run.current;
    const alive = () => run.current === id;
    const chunks = speechChunks(text);
    if (chunks.length === 0) return;
    setSpeaking(true);
    try {
      const groq = (await serverLanguages()).has((language ?? "english").toLowerCase());
      let i = 0;
      if (groq) {
        const fetchChunk = (c: string) =>
          fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: c, language }) })
            .then((r) => (r.status === 200 ? r.blob() : null))
            .catch(() => null);
        let next = fetchChunk(chunks[0]);
        for (; i < chunks.length && alive(); i++) {
          const blob = await next;
          if (i + 1 < chunks.length) next = fetchChunk(chunks[i + 1]);
          if (!blob || !alive()) break;
          await playBlob(audio.current ??= new Audio(), blob, alive);
        }
      }
      for (; i < chunks.length && alive(); i++) await browserSay(chunks[i], language, alive);
    } finally {
      if (alive()) setSpeaking(false);
    }
  }, []);

  return { prime, speak, stop, speaking };
}

function playBlob(el: HTMLAudioElement, blob: Blob, alive: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const done = () => {
      el.onended = el.onerror = el.onpause = null;
      URL.revokeObjectURL(url);
      resolve();
    };
    el.onended = done;
    el.onerror = done;
    el.onpause = () => { if (!alive()) done(); };
    el.src = url;
    el.play().catch(done);
  });
}

function browserSay(text: string, language: string | undefined, alive: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (!alive() || typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    try {
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceLang(language);
      const voice = synth.getVoices().find((v) => v.lang === u.lang) ?? synth.getVoices().find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    } catch {
      resolve();
    }
  });
}
