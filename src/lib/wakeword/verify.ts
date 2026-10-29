// The second check: the device's wake-word model is small and was trained mostly on synthetic voices, so when it fires, the last
// two seconds are transcribed (/api/voice/transcribe, Groq Whisper) and Vita opens only if "Vita" is really in them. Only these
// two seconds leave the device, and only when the device already thinks it heard "Hey Vita".
import { wavBlob } from "@/lib/voice/wav";

// "Vita" as a word: in Latin letters, or in Devanagari / Bengali not inside another word (कविता, সবিতা are names, not Vita)
const SAID_VITA = /\b(?:vita|veeta|vitta|vitah|wita|weeta)\b|(?:^|[^\u0900-\u097F]|हे|हाय|हेय)(?:वीटा|विटा|वीता|विता|वाइटा)(?![\u0900-\u097F])|(?:^|[^\u0980-\u09FF])(?:ভিটা|বিটা|ভিতা)(?![\u0980-\u09FF])/i;

/** Did the transcript say "Vita"? */
export function saysVita(text: string): boolean {
  return SAID_VITA.test(text.normalize("NFC"));
}

export type Verdict = "yes" | "no" | "unknown";

export async function verifyWake(audio: Float32Array, locale: string, signal?: AbortSignal): Promise<Verdict> {
  const form = new FormData();
  form.append("audio", wavBlob(audio), "wake.wav");
  form.append("locale", locale);
  form.append("purpose", "wake");
  try {
    const res = await fetch("/api/voice/transcribe", { method: "POST", body: form, signal });
    if (!res.ok) return "unknown";
    const body = (await res.json()) as { text?: string };
    return saysVita(body.text ?? "") ? "yes" : "no";
  } catch {
    return "unknown";
  }
}
