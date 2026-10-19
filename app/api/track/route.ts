import { NextRequest, NextResponse } from "next/server";
import { easyhmsFetch } from "@/lib/api/server";
import { isBotUserAgent } from "@/lib/botUserAgent";

export const dynamic = "force-dynamic";

// POST /api/track  ->  one batched beacon per user action from src/lib/analytics.ts:
//   { visits: [...], events: [...], leads: [...] }
// fanned out server-side to {EASYHMS}/public/track-visit, /public/track-event and /public/leads, so
// the visitor's browser makes one request instead of up to six. Sizes are capped; the old
// single-beacon routes stay for clients still running a cached older build. Always 200: a visitor
// must never see an error because analytics recording had a bad moment.
const LIMITS = { visits: 5, events: 20, leads: 10 } as const;
const UPSTREAM = { visits: "/public/track-visit", events: "/public/track-event", leads: "/public/leads" } as const;

// Tells EasyHMS which website a page view came from (both sites write the same table).
const SITE = "doctordekho";

export async function POST(req: NextRequest) {
  // Crawlers that execute JavaScript post here like a browser would; drop them before they reach
  // EasyHMS (it re-checks the user agent and also flags data-centre IPs).
  const requestUa = req.headers.get("user-agent");
  if (isBotUserAgent(requestUa)) return NextResponse.json({ ok: true });

  try {
    const body = (await req.json()) as Partial<Record<keyof typeof LIMITS, unknown>>;
    const calls: Promise<unknown>[] = [];
    for (const kind of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      const items = Array.isArray(body?.[kind]) ? (body[kind] as unknown[]) : [];
      for (const item of items.slice(0, LIMITS[kind])) {
        if (item && typeof item === "object") {
          // Page views carry the site and the request's own user agent (what EasyHMS classifies).
          const payload = kind === "visits" ? { ...(item as Record<string, unknown>), site: SITE, userAgent: requestUa } : item;
          calls.push(easyhmsFetch(UPSTREAM[kind], { method: "POST", body: JSON.stringify(payload) }));
        }
      }
    }
    await Promise.allSettled(calls);
  } catch {
    // Best-effort — malformed body or upstream failure never surfaces to the visitor.
  }
  return NextResponse.json({ ok: true });
}
