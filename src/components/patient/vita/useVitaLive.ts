"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveVoice, liveVoiceSupported } from "@/hooks/useLiveVoice";
import { useVoicePlayer } from "@/hooks/useVoicePlayer";
import type { TranslationKey } from "@/lib/i18n/dictionaries/en";
import type { VitaEntry } from "@/hooks/useVitaChat";

// Talk with Vita, hands-free: listen -> the words go to Vita as a message -> Vita's reply is spoken -> listen again.
// Pauses itself when nobody speaks; stops after an emergency reply (the screen shows what to do and whom to call); waits for typing
// when Vita needs a mobile number, the WhatsApp code or a tap (location). A tap on a chip mid-way just joins the conversation.

export type LiveStatus = "off" | "listening" | "hearing" | "thinking" | "speaking" | "waiting";
const TYPE_INSTEAD = new Set(["book_mobile", "book_otp", "location", "visit_checkin"]);
const SPOKEN_LANGUAGE: Record<string, string> = { en: "english", hi: "hindi", hinglish: "hinglish", bn: "bangla" };

let voiceEnabled: Promise<boolean> | null = null;
function serverVoice(): Promise<boolean> {
  voiceEnabled ??= fetch("/api/voice/transcribe", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((b: { enabled?: boolean }) => Boolean(b.enabled))
    .catch(() => false);
  return voiceEnabled;
}

export function useVitaLive({ entries, busy, locale, send, t }: {
  entries: VitaEntry[];
  busy: boolean;
  locale: string;
  send: (text: string) => void;
  t: (key: TranslationKey) => string;
}) {
  const { phase, level, open, listen, cancel, close } = useLiveVoice(locale);
  const { prime, speak, stop: hush, speaking } = useVoicePlayer();
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);
  const [notice, setNotice] = useState<TranslationKey | null>(null);
  const onRef = useRef(false);
  const spoken = useRef<number | null>(null);
  const misses = useRef(0);
  const sendRef = useRef(send);
  sendRef.current = send;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!liveVoiceSupported()) return;
    let live = true;
    void serverVoice().then((ok) => { if (live) setAvailable(ok); });
    return () => { live = false; };
  }, []);

  const stop = useCallback((why: TranslationKey | null = null) => {
    onRef.current = false;
    setOn(false);
    close();
    hush();
    setNotice(why);
  }, [close, hush]);

  const turn = useCallback(async () => {
    if (!onRef.current) return;
    setNotice(null);
    const r = await listen();
    if (!onRef.current || r.kind === "cancelled") return;
    if (r.kind === "text" && r.text) {
      misses.current = 0;
      sendRef.current(r.text);
      return;
    }
    if (r.kind === "no_speech") return stop("vita.livePaused");
    if (r.kind === "error") return stop(r.reason === "too_many" ? "vita.liveBusy" : "vita.liveError");
    misses.current += 1;                                            // heard something, but no words
    if (misses.current >= 2) return stop("vita.livePaused");
    await speak(tRef.current("vita.liveMissed"), SPOKEN_LANGUAGE[locale] ?? "hinglish");
    void turn();
  }, [listen, speak, stop, locale]);

  const start = useCallback(async () => {
    prime();                                                 // inside the tap: lets Vita's voice play later
    setNotice(null);
    if (!(await open())) return stop("vita.liveMicDenied");
    onRef.current = true;
    setOn(true);
    misses.current = 0;
    spoken.current = entries.at(-1)?.id ?? null;                    // never re-read what is already on screen
    void turn();
  }, [prime, open, stop, turn, entries]);

  // A message went out some other way (a chip, typing): stop listening for this turn.
  useEffect(() => {
    if (busy && onRef.current) cancel();
  }, [busy, cancel]);

  // Vita's reply: say it, then listen again (or wait, or stop).
  useEffect(() => {
    if (!on || busy) return;
    const last = entries.at(-1);
    if (!last || last.role !== "vita" || !last.reply || last.id === spoken.current) return;
    spoken.current = last.id;
    cancel();
    const reply = last.reply;
    void speak(reply.message, reply.language).then(() => {
      if (!onRef.current || spoken.current !== last.id) return;
      if (reply.kind === "emergency") return stop("vita.liveEmergency");
      if (reply.clarify?.kind && TYPE_INSTEAD.has(reply.clarify.kind)) {
        setNotice(reply.clarify.kind === "location" || reply.clarify.kind === "visit_checkin" ? "vita.liveTap" : "vita.liveType");
        return;                                                     // the next reply (after they type or tap) carries on
      }
      void turn();
    });
  }, [entries, busy, on, cancel, speak, stop, turn]);

  const status: LiveStatus = !on ? "off"
    : speaking ? "speaking"
    : busy || phase === "transcribing" ? "thinking"
    : phase === "hearing" ? "hearing"
    : phase === "listening" ? "listening"
    : "waiting";

  /** Tap while Vita speaks: she stops and listens. */
  const interrupt = useCallback(() => hush(), [hush]);

  return { available, on, status, level: level, notice, start, stop: () => stop(null), interrupt, dismiss: () => setNotice(null) };
}
