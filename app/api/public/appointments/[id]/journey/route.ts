import { NextRequest, NextResponse } from "next/server";
import { easyhmsFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

// POST /api/public/appointments/[id]/journey {status, etaMinutes?, distanceKm?, lateByMinutes?}
//   ->  {EASYHMS}/public/appointments/{id}/journey/progress
// The in-app navigation reports "on the way" with the time and distance left, so reception sees "On the way · 12 min" (only when the
// patient agreed to share it; 1HMS checks). Never the location: only these numbers are passed on.
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const STATUSES = new Set(["on_the_way", "late", "arrived"]);
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!GUID.test(params.id)) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "invalid" }, { status: 400 });
  }
  if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
    return NextResponse.json({ success: false, message: "status" }, { status: 400 });
  }
  const out: Record<string, unknown> = { status: body.status };
  const eta = num(body.etaMinutes, 0, 720);
  const km = num(body.distanceKm, 0, 2000);
  const late = num(body.lateByMinutes, 0, 600);
  if (eta !== undefined) out.etaMinutes = Math.round(eta);
  if (km !== undefined) out.distanceKm = Math.round(km * 10) / 10;
  if (late !== undefined) out.lateByMinutes = Math.round(late);
  const r = await easyhmsFetch<{ success?: boolean; message?: string }>(`/public/appointments/${params.id}/journey/progress`, {
    method: "POST",
    body: JSON.stringify(out),
  });
  if (r.notConfigured) return NextResponse.json({ success: false, message: "unavailable" }, { status: 503 });
  return NextResponse.json(r.data ?? { success: false }, { status: r.status });
}
