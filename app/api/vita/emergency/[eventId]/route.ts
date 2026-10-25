import { NextRequest, NextResponse } from "next/server";
import { easyhmsFetch } from "@/lib/api/server";
import { cleanMobile } from "@/lib/vita/emergency";

export const dynamic = "force-dynamic";

// Vita's emergency card (vision Phase 3, emergency takeover): the patient tapped a hospital's call button (logged for audit), or
// ticked "Share my number so the hospital can call me" and gave it. Both go to 1HMS against the emergency's eventId, which the
// router's reply carried. The number is sent only with consent: true, and never kept by this site.
//
//   POST /api/vita/emergency/{eventId}  {action: "call", settingId}
//   POST /api/vita/emergency/{eventId}  {action: "share", mobile, consent: true}

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  if (!GUID.test(params.eventId)) return fail("invalid", 400);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("invalid", 400);
  }

  if (body.action === "call") {
    if (typeof body.settingId !== "string" || !GUID.test(body.settingId)) return fail("invalid", 400);
    const r = await easyhmsFetch(`/public/emergency-alerts/${params.eventId}/call`, {
      method: "POST",
      body: JSON.stringify({ settingId: body.settingId }),
    });
    return NextResponse.json({ ok: r.ok }, { status: r.notConfigured ? 503 : 200 });
  }

  if (body.action === "share") {
    if (body.consent !== true) return fail("consent", 400);
    const mobile = cleanMobile(body.mobile);
    if (!mobile) return fail("mobile", 400);
    const r = await easyhmsFetch<{ success?: boolean; message?: string }>(`/public/emergency-alerts/${params.eventId}/share-number`, {
      method: "POST",
      body: JSON.stringify({ mobile, consent: true }),
    });
    if (r.notConfigured) return fail("unavailable", 503);
    if (r.status === 429) return fail("too_many", 429);
    if (!r.ok || r.data?.success === false) return NextResponse.json({ error: "refused", message: r.data?.message ?? null }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return fail("invalid", 400);
}
