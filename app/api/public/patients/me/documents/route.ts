import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { easyhmsFetch, isConfigured } from "@/lib/api/server";
import { PATIENT_SESSION_COOKIE } from "@/lib/api/patientSession";

export const dynamic = "force-dynamic";

// GET /api/public/patients/me/documents  →  proxies GET {EASYHMS}/public/patients/me/documents
export async function GET(req: NextRequest) {
  const token = cookies().get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: "Please log in again.", documents: [] }, { status: 401 });
  }

  // Whose records: a family member of this account (the API checks it is theirs), or empty for their own.
  const memberId = req.nextUrl.searchParams.get("memberId");
  const r = await easyhmsFetch(`/public/patients/me/documents${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.notConfigured) {
    return NextResponse.json({ notConfigured: true });
  }
  return NextResponse.json(r.data, { status: r.status });
}

// POST /api/public/patients/me/documents  →  proxies POST {EASYHMS}/public/patients/me/documents
// Multipart file upload, passed through as-is — deliberately NOT via easyhmsFetch, which always
// sets a JSON Content-Type header; a FormData body needs fetch to set its own multipart boundary.
export async function POST(req: NextRequest) {
  const token = cookies().get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: "Please log in again." }, { status: 401 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ notConfigured: true });
  }

  const formData = await req.formData();
  const res = await fetch(`${process.env.EASYHMS_API_BASE_URL}/public/patients/me/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON or empty body */
  }
  return NextResponse.json(data, { status: res.status });
}
