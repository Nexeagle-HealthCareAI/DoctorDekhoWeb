import { NextRequest, NextResponse } from "next/server";
import { easyhmsFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

// POST /api/public/appointments/[id]/checkin {lat, lng}  ->  {EASYHMS}/public/tokens (the existing OPD check-in). 1HMS issues a
// queue token only when the patient's location is at the hospital, and answers why not otherwise. The location is passed on for
// this one check and not kept here.
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const inRange = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!GUID.test(params.id)) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, message: "invalid" }, { status: 400 });
  }
  if (!inRange(body.lat, -90, 90) || !inRange(body.lng, -180, 180)) {
    return NextResponse.json({ success: false, message: "location" }, { status: 400 });
  }
  const r = await easyhmsFetch<{ success?: boolean; message?: string; tokenNo?: number }>("/public/tokens", {
    method: "POST",
    body: JSON.stringify({ appointmentId: params.id, latitude: body.lat, longitude: body.lng }),
  });
  if (r.notConfigured) return NextResponse.json({ success: false, message: "unavailable" }, { status: 503 });
  return NextResponse.json(r.data ?? { success: false }, { status: r.status });
}
