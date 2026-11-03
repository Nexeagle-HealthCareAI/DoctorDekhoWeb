"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startEndpoint, stepEndpoint } from "@/lib/voice/endpoint";

// The patient's side of Vita's live conversation: the microphone stays open while the conversation is on; each turn is recorded
// until they pause, then sent to /api/voice/transcribe (Groq Whisper) and comes back as text. The browser's echo cancellation
// keeps Vita's own voice out, and Vita only listens when she has finished speaking.

export type LiveTurn = { kind: "text"; text: string } | { kind: "no_speech" } | { kind: "cancelled" } | { kind: "error"; reason: string };
export type LivePhase = "off" | "ready" | "listening" | "hearing" | "transcribing";

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported?.(m));
}

export function liveVoiceSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia &&
    (typeof AudioContext !== "undefined" || "webkitAudioContext" in window);
}

export function useLiveVoice(locale: string) {
  const [phase, setPhase] = useState<LivePhase>("off");
  const [level, setLevel] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const cancelTurn = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    cancelTurn.current?.();
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
    analyser.current = null;
    setPhase("off");
    setLevel(0);
  }, []);

  useEffect(() => close, [close]);

  /** Opens the microphone (asks permission). Call from a tap. */
  const open = useCallback(async (): Promise<boolean> => {
    if (stream.current) return true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const c = new Ctx();
      const a = c.createAnalyser();
      a.fftSize = 1024;
      c.createMediaStreamSource(s).connect(a);
      stream.current = s;
      ctx.current = c;
      analyser.current = a;
      setPhase("ready");
      return true;
    } catch {
      return false;
    }
  }, []);

  const cancel = useCallback(() => cancelTurn.current?.(), []);

  /** One turn: records until the patient pauses, then transcribes. */
  const listen = useCallback((): Promise<LiveTurn> => {
    const s = stream.current;
    const a = analyser.current;
    if (!s || !a) return Promise.resolve({ kind: "error", reason: "closed" });
    cancelTurn.current?.();
    void ctx.current?.resume().catch(() => {});
    return new Promise<LiveTurn>((resolve) => {
      const mime = pickMime();
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      const parts: Blob[] = [];
      const buf = new Float32Array(a.fftSize);
      let ep = startEndpoint(performance.now());
      let finished = false;
      let outcome: "done" | "no_speech" | "cancelled" = "cancelled";
      setPhase("listening");

      const finish = (why: typeof outcome) => {
        if (finished) return;
        finished = true;
        outcome = why;
        clearInterval(timer);
        cancelTurn.current = null;
        setLevel(0);
        if (rec.state !== "inactive") rec.stop();
        else onStop();
      };
      const onStop = async () => {
        if (outcome !== "done") {
          setPhase(stream.current ? "ready" : "off");
          return resolve({ kind: outcome });
        }
        setPhase("transcribing");
        const blob = new Blob(parts, { type: rec.mimeType || mime || "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "turn");
        form.append("locale", locale);
        try {
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const body = (await res.json().catch(() => ({}))) as { text?: string; message?: string };
          setPhase(stream.current ? "ready" : "off");
          if (!res.ok) return resolve({ kind: "error", reason: body.message ?? String(res.status) });
          resolve({ kind: "text", text: (body.text ?? "").trim() });
        } catch {
          setPhase(stream.current ? "ready" : "off");
          resolve({ kind: "error", reason: "network" });
        }
      };
      rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
      rec.onstop = () => void onStop();
      rec.start(250);

      const timer = setInterval(() => {
        a.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(1, rms * 8));
        const r = stepEndpoint(ep, rms, performance.now());
        ep = r.state;
        if (r.event === "speaking") setPhase("hearing");
        else if (r.event === "done") finish("done");
        else if (r.event === "no_speech") finish("no_speech");
      }, 50);
      cancelTurn.current = () => finish("cancelled");
    });
  }, [locale]);

  return { phase, level, open, listen, cancel, close };
}
