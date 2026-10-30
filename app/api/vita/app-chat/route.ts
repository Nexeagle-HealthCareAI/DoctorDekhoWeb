import { NextRequest, NextResponse } from "next/server";
import { toVitaReply } from "@/lib/vitaChat";

export const dynamic = "force-dynamic";

// POST /api/vita/app-chat — { text, sessionId?, city?, lat?, lng? } -> VitaReply (src/lib/vitaChat.ts)
//
// The Doctor Dekho app's "Vita" assistant talks to the NLP router's conversational /chat agent through here, so the router
// key stays on the server (same reason search/parse exists). The router needs a key with the "chat" scope
// (scripts/make_api_key.py <name> chat); NLP_ROUTER_CHAT_API_KEY is used when set, else NLP_ROUTER_API_KEY.
const NLP_ROUTER_BASE_URL = (process.env.NLP_ROUTER_BASE_URL ?? "").trim().replace(/\/+$/, "");
const NLP_ROUTER_CHAT_API_KEY = (process.env.NLP_ROUTER_CHAT_API_KEY || process.env.NLP_ROUTER_API_KEY || "").trim();
const TIMEOUT_MS = 10000;

const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);

export async function POST(req: NextRequest) {
  if (!NLP_ROUTER_BASE_URL) return NextResponse.json({ notConfigured: true }, { status: 503 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  const sessionId = typeof body?.sessionId === "string" && /^[\w-]{1,100}$/.test(body.sessionId) ? body.sessionId : undefined;
  const city = typeof body?.city === "string" && body.city.trim() ? body.city.trim().slice(0, 100) : undefined;
  const lat = num(body?.lat, -90, 90);
  const lng = num(body?.lng, -180, 180);

  try {
    const res = await fetch(`${NLP_ROUTER_BASE_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(NLP_ROUTER_CHAT_API_KEY ? { "X-Api-Key": NLP_ROUTER_CHAT_API_KEY } : {}) },
      body: JSON.stringify({ text, session_id: sessionId ?? null, city, ...(lat != null && lng != null ? { lat, lng } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 429) return NextResponse.json({ error: "busy" }, { status: 429 });
    if (!res.ok) {
      console.warn(`vita-chat: router answered ${res.status}`);
      return NextResponse.json({ error: "Vita is not available right now" }, { status: 502 });
    }
    const reply = toVitaReply(await res.json());
    console.info(`vita-chat: kind=${reply.kind} doctors=${reply.doctorIds.length}`);
    return NextResponse.json(reply);
  } catch (err) {
    console.error("vita-chat: router call failed:", err);
    return NextResponse.json({ error: "Vita is not available right now" }, { status: 502 });
  }
}
