import { NextRequest, NextResponse } from "next/server";
import { GROQ_API_KEY, GROQ_BASE, STT_MODEL, WHISPER_PROMPT, limiter, visitorIp, whisperLanguage } from "@/lib/voice/server";

export const dynamic = "force-dynamic";

// POST /api/voice/transcribe  (multipart: audio, locale)  ->  {text}
// One spoken turn of Vita's live conversation, turned into text by Groq Whisper. The recording is passed on for this one
// transcription and not kept here. GET says whether voice is available (the key is set).
const MAX_BYTES = 4 * 1024 * 1024;            // ~30 s of opus is well under 1 MB
const TIMEOUT_MS = 15_000;
const limited = limiter(40);
const AUDIO = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|m4a|x-m4a|aac|flac)(;.*)?$/i;

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

export async function GET() {
  return NextResponse.json({ enabled: Boolean(GROQ_API_KEY) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) return fail("voice_off", 503);
  if (limited(visitorIp(req.headers))) return fail("too_many", 429);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("invalid", 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return fail("invalid", 400);
  if (audio.size > MAX_BYTES) return fail("too_long", 413);
  const type = audio.type || "audio/webm";
  if (!AUDIO.test(type)) return fail("format", 415);
  const locale = typeof form.get("locale") === "string" ? (form.get("locale") as string) : null;

  const ext = /mp4|m4a|aac/i.test(type) ? "m4a" : /ogg/i.test(type) ? "ogg" : /wav/i.test(type) ? "wav" : /mpeg|mp3/i.test(type) ? "mp3" : /flac/i.test(type) ? "flac" : "webm";
  const out = new FormData();
  out.append("file", new File([audio], `turn.${ext}`, { type }));
  out.append("model", STT_MODEL);
  out.append("language", whisperLanguage(locale));
  out.append("prompt", WHISPER_PROMPT);
  out.append("response_format", "json");
  out.append("temperature", "0");

  let res: Response;
  try {
    res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: out,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`[voice] transcription unreachable: ${(e as Error).name}`);
    return fail("unavailable", 502);
  }
  if (!res.ok) {
    console.error(`[voice] transcription answered ${res.status}`);
    return fail(res.status === 429 ? "too_many" : "unavailable", res.status === 429 ? 429 : 502);
  }
  const body = (await res.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof body.text === "string" ? cleanTranscript(body.text) : "";
  return NextResponse.json({ success: true, text }, { headers: { "Cache-Control": "no-store" } });
}

/** Whisper writes the prompt back, or a stock phrase, on silence or noise: those are not the patient's words. */
function cleanTranscript(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (/^(thank you( for watching)?|thanks for watching|you|bye|\.+|subtitles? by .*|धन्यवाद।?)$/i.test(t)) return "";
  if (t.length > 40 && WHISPER_PROMPT.includes(t.slice(0, 40))) return "";
  return t.slice(0, 1000);
}
