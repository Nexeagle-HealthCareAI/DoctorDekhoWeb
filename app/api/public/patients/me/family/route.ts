import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { easyhmsFetch } from "@/lib/api/server";
import { PATIENT_SESSION_COOKIE } from "@/lib/api/patientSession";

export const dynamic = "force-dynamic";

// GET  /api/public/patients/me/family  →  proxies GET  {EASYHMS}/public/patients/me/family
// POST /api/public/patients/me/family  →  proxies POST {EASYHMS}/public/patients/me/family
// The people this patient looks after (a child, a parent...). Same httpOnly-cookie session as the rest of /patients/me.
export async function GET() {
  const token = cookies().get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ success: false, message: "Please log in again.", members: [] }, { status: 401 });

  const r = await easyhmsFetch("/public/patients/me/family", { headers: { Authorization: `Bearer ${token}` } });
  if (r.notConfigured) return NextResponse.json({ notConfigured: true });
  if (!r.ok) return NextResponse.json({ success: false, message: "Could not load your family members.", members: [] }, { status: r.status || 502 });
  return NextResponse.json(r.data, { status: 200 });
}

export async function POST(req: NextRequest) {
  const token = cookies().get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ success: false, message: "Please log in again." }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const r = await easyhmsFetch("/public/patients/me/family", { method: "POST", body: JSON.stringify(body), headers: { Authorization: `Bearer ${token}` } });
  if (r.notConfigured) return NextResponse.json({ success: false, message: "Saving is not available right now." }, { status: 503 });
  if (r.status === 0) return NextResponse.json({ success: false, message: "The service is not reachable right now. Try again in a moment." }, { status: 502 });
  if (!r.ok) {
    const d = r.data as { message?: string; Message?: string } | null;
    return NextResponse.json({ success: false, message: d?.message ?? d?.Message ?? "Could not save." }, { status: r.status });
  }
  return NextResponse.json(r.data, { status: 200 });
}
