import { NextRequest, NextResponse } from "next/server";
import { GROQ_API_KEY, GROQ_BASE, TTS_LANGUAGES, TTS_MAX_CHARS, TTS_MODEL, TTS_VOICE, limiter, visitorIp } from "@/lib/voice/server";

export const dynamic = "force-dynamic";

// POST /api/voice/speak {text, language}  ->  audio/wav (Groq Orpheus), or 204: "use the browser's voice for this language".
// One sentence of Vita's reply at a time (Orpheus reads up to 200 characters per request). GET lists the languages it speaks.
const TIMEOUT_MS = 12_000;
const limited = limiter(120);

export async function GET() {
  return NextResponse.json({ languages: GROQ_API_KEY ? Array.from(TTS_LANGUAGES) : [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) return new NextResponse(null, { status: 204 });
  if (limited(visitorIp(req.headers))) return NextResponse.json({ success: false, message: "too_many" }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "invalid" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  const language = typeof body.language === "string" ? body.language.toLowerCase() : "english";
  if (!text || text.length > TTS_MAX_CHARS) return NextResponse.json({ success: false, message: "invalid" }, { status: 400 });
  if (!TTS_LANGUAGES.has(language)) return new NextResponse(null, { status: 204 });

  let res: Response;
  try {
    res = await fetch(`${GROQ_BASE}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input: text, response_format: "wav" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`[voice] speech unreachable: ${(e as Error).name}`);
    return new NextResponse(null, { status: 204 });
  }
  if (!res.ok || !res.body) {
    console.error(`[voice] speech answered ${res.status}`);
    return new NextResponse(null, { status: 204 });                // the browser's voice reads it instead
  }
  return new NextResponse(res.body, { status: 200, headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
}
