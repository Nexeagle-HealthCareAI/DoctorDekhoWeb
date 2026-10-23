import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { easyhmsFetch } from "@/lib/api/server";
import { PATIENT_SESSION_COOKIE } from "@/lib/api/patientSession";

export const dynamic = "force-dynamic";

// GET /api/public/appointments/mine  →  proxies GET {EASYHMS}/public/appointments/mine
// Doubles as the client's "am I logged in" check — the frontend calls this on load and treats a
// 401 as logged-out, rather than maintaining separate login-state logic on top of this call.
export async function GET(_req: NextRequest) {
  const token = cookies().get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ loggedIn: false, appointments: [] }, { status: 401 });
  }

  const r = await easyhmsFetch("/public/appointments/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.notConfigured) {
    return NextResponse.json({ notConfigured: true });
  }
  if (!r.ok) {
    const res = NextResponse.json({ loggedIn: false, appointments: [] }, { status: r.status });
    // Only a 401 means the token is invalid/expired/revoked, and only then is the cookie cleared. A 429, 502 or 503 (rate limit, a deploy
    // in progress) says nothing about the login, so the patient must stay signed in and the client can simply ask again.
    if (r.status === 401) res.cookies.delete(PATIENT_SESSION_COOKIE);
    return res;
  }

  return NextResponse.json({ loggedIn: true, ...(r.data as object) }, { status: 200 });
}
