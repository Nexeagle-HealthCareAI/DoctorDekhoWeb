import { NextRequest, NextResponse } from "next/server";

// Doctor Dekho's chat with Vita, the patient agent: a thin server-side proxy to the NLP router's
// POST /v2/agent/chat, so the router API key never reaches the browser. It only forwards the fields
// the contract allows (requirements doc, section 9), checks their shape, and limits each visitor.
//
// The router counts its rate limit per API key, and every Doctor Dekho visitor shares this site's
// key -- so its HMS_RATE_LIMIT_CHAT must be sized for the whole site, and this route keeps any one
// visitor (by IP) from using that shared budget up.

const BASE = (process.env.NLP_ROUTER_BASE_URL ?? "").trim().replace(/\/+$/, "");
const KEY = (process.env.NLP_ROUTER_API_KEY ?? "").trim();
const TIMEOUT_MS = Number.parseInt(process.env.VITA_TIMEOUT_MS ?? "", 10) || 12000;
const PER_VISITOR_PER_MINUTE = Number.parseInt(process.env.VITA_VISITOR_LIMIT ?? "", 10) || 20;
const UUID = /^[0-9a-fA-F-]{32,36}$/;
// Runtime kill switch: VITA_CHAT_ENABLED=0 sends the chat widget back to the WhatsApp hand-off.
const ENABLED = Boolean(BASE) && (process.env.VITA_CHAT_ENABLED ?? "1").trim() !== "0";

const hits = new Map<string, { minute: number; count: number }>();

function limited(ip: string): boolean {
  const minute = Math.floor(Date.now() / 60000);
  const seen = hits.get(ip);
  if (!seen || seen.minute !== minute) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { minute, count: 1 });
    return false;
  }
  seen.count += 1;
  return seen.count > PER_VISITOR_PER_MINUTE;
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

/** The chat widget asks this once when opened: is Vita on for this deployment? */
export async function GET() {
  return NextResponse.json({ enabled: ENABLED }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!ENABLED) return fail("vita_off", 503);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (limited(ip)) return fail("too_many", 429);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("invalid", 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 1000) return fail("invalid", 400);

  const out: Record<string, unknown> = { text };
  if (typeof body.session_id === "string" && body.session_id.length > 0 && body.session_id.length <= 100) out.session_id = body.session_id;
  if (typeof body.city === "string" && body.city.trim() && body.city.length <= 100) out.city = body.city.trim();
  if (inRange(body.lat, -90, 90) && inRange(body.lng, -180, 180)) {
    out.lat = body.lat;
    out.lng = body.lng;
  }
  if (typeof body.hospital_id === "string" && UUID.test(body.hospital_id)) out.hospital_id = body.hospital_id;
  if (typeof body.select_doctor_id === "string" && UUID.test(body.select_doctor_id)) out.select_doctor_id = body.select_doctor_id;
  if (body.new_search === true) out.new_search = true;
  if (typeof body.page === "number" && Number.isInteger(body.page) && body.page >= 1 && body.page <= 10) out.page = body.page;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/v2/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(KEY ? { "X-Api-Key": KEY } : {}) },
      body: JSON.stringify(out),
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 422) return fail("invalid", 422); // e.g. a doctor not shown in this session
    if (res.status === 429) return fail("too_many", 429);
    if (!res.ok) return fail("vita_unavailable", 502);
    return NextResponse.json(await res.json());
  } catch {
    return fail("vita_unavailable", 502);
  } finally {
    clearTimeout(timer);
  }
}
