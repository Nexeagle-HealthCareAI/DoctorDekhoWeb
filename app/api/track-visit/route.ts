import { NextRequest, NextResponse } from "next/server";
import { easyhmsFetch } from "@/lib/api/server";
import { isBotUserAgent } from "@/lib/botUserAgent";

export const dynamic = "force-dynamic";

// POST /api/track-visit  →  proxies POST {EASYHMS}/public/track-visit
// Fire-and-forget page-view beacon (see AnalyticsTracker) — real visitor IP transits via the same
// trusted-proxy header mechanism easyhmsFetch already attaches to every server-to-server call.
// Always returns 200 regardless of upstream outcome: a visitor must never see an error, or have a
// page's rendering depend on this, just because analytics recording had a bad moment.
export async function POST(req: NextRequest) {
  // Crawlers run the page script too; they are not visitors (see src/lib/botUserAgent.ts).
  if (isBotUserAgent(req.headers.get("user-agent"))) return NextResponse.json({ ok: true });
  try {
    const body = { ...(await req.json()), site: "doctordekho", userAgent: req.headers.get("user-agent") };
    await easyhmsFetch("/public/track-visit", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch {
    // Best-effort — never fail the request because the upstream call threw.
  }
  return NextResponse.json({ ok: true });
}
