import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { easyhmsFetch } from "@/lib/api/server";
import { PATIENT_SESSION_COOKIE } from "@/lib/api/patientSession";

export const dynamic = "force-dynamic";

// GET /api/public/patients/me  →  proxies GET {EASYHMS}/public/patients/me
// "Personal Information" for the profile page — same httpOnly-cookie session as /api/public/appointments/mine.
// PUT saves the patient's own edits to their account profile (never to a hospital's registration).
export async function GET(_req: NextRequest) {
  const token = cookies().get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: "Not logged in." }, { status: 401 });
  }

  const r = await easyhmsFetch("/public/patients/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.notConfigured) {
    return NextResponse.json({ notConfigured: true });
  }
  if (!r.ok) {
    const res = NextResponse.json({ success: false, message: "Session expired." }, { status: r.status });
    res.cookies.delete(PATIENT_SESSION_COOKIE);
    return res;
  }

  return NextResponse.json(r.data, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const token = cookies().get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: "Please log in again." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  const r = await easyhmsFetch("/public/patients/me", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.notConfigured) {
    return NextResponse.json({ success: false, message: "Saving is not available right now." }, { status: 503 });
  }
  if (r.status === 0) {
    return NextResponse.json({ success: false, message: "The service is not reachable right now. Try again in a moment." }, { status: 502 });
  }
  if (!r.ok) {
    const message = (r.data as { message?: string; Message?: string } | null)?.message ?? (r.data as { Message?: string } | null)?.Message ?? "Could not save your details.";
    const res = NextResponse.json({ success: false, message }, { status: r.status });
    if (r.status === 401) res.cookies.delete(PATIENT_SESSION_COOKIE);
    return res;
  }
  return NextResponse.json(r.data, { status: 200 });
}
