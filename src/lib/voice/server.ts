// Server only: Groq speech for Vita's live conversation. The key never reaches the browser.
//   speech -> text: Whisper (whisper-large-v3-turbo; Hindi, English, Bengali)
//   text -> speech: Orpheus (English only on Groq today). Hindi and Hinglish replies are read by the browser's own voice.
// Overridable without a code change: GROQ_STT_MODEL, GROQ_TTS_MODEL, GROQ_TTS_VOICE, GROQ_TTS_LANGUAGES ("english" or "english,hinglish").

export const GROQ_API_KEY = (process.env.GROQ_API_KEY ?? "").trim();
export const STT_MODEL = (process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo").trim();
export const TTS_MODEL = (process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english").trim();
export const TTS_VOICE = (process.env.GROQ_TTS_VOICE || "diana").trim();
export const TTS_LANGUAGES = new Set(
  (process.env.GROQ_TTS_LANGUAGES || "english").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);
export const GROQ_BASE = "https://api.groq.com/openai/v1";
/** Orpheus reads at most this many characters per request; the browser sends sentences up to it. */
export const TTS_MAX_CHARS = 200;

export function visitorIp(headers: Headers): string {
  return (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}

/** A small per-visitor limit (this app runs as one container): `max` calls per minute. */
export function limiter(max: number) {
  const hits = new Map<string, number[]>();
  return (ip: string, now = Date.now()): boolean => {
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= max) {
      hits.set(ip, recent);
      return true;
    }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();
    return false;
  };
}

/** The patient's language -> Whisper's language. Hindi and Hinglish speakers are transcribed as Hindi (Devanagari, which Vita
 * reads); without a language Whisper sometimes writes Hindi speech in Urdu script. */
export function whisperLanguage(locale: string | null | undefined): string {
  if (locale === "en") return "en";
  if (locale === "bn") return "bn";
  return "hi";
}

/** Spelling hints for Whisper (not instructions): the words patients say to Vita. */
export const WHISPER_PROMPT =
  "Doctor Dekho, Vita. bukhar, sir dard, pet dard, khansi, saans, chakkar, ulti, appointment, check in, " +
  "डॉक्टर, बुखार, सिर दर्द, पेट दर्द, खांसी, सांस, अपॉइंटमेंट, कल, सुबह, शाम.";
