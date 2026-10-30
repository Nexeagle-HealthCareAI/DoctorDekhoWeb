import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { easyhmsFetch } from "@/lib/api/server";
import { PATIENT_SESSION_COOKIE } from "@/lib/api/patientSession";

export const dynamic = "force-dynamic";

// PUT/DELETE /api/public/patients/me/family/[id]  →  proxies the same on {EASYHMS}/public/patients/me/family/{id}
// The API only finds a member that belongs to the signed-in account; anyone else's id is a plain "not found".
async function forward(method: "PUT" | "DELETE", req: NextRequest, id: string) {
  const token = cookies().get(PATIENT_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ success: false, message: "Please log in again." }, { status: 401 });
  const body = method === "PUT" ? await req.json().catch(() => ({})) : undefined;

  const r = await easyhmsFetch(`/public/patients/me/family/${encodeURIComponent(id)}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.notConfigured) return NextResponse.json({ success: false, message: "Saving is not available right now." }, { status: 503 });
  if (r.status === 0) return NextResponse.json({ success: false, message: "The service is not reachable right now. Try again in a moment." }, { status: 502 });
  if (!r.ok) {
    const d = r.data as { message?: string; Message?: string } | null;
    return NextResponse.json({ success: false, message: d?.message ?? d?.Message ?? "Could not save." }, { status: r.status });
  }
  return NextResponse.json(r.data, { status: 200 });
}

export const PUT = (req: NextRequest, { params }: { params: { id: string } }) => forward("PUT", req, params.id);
export const DELETE = (req: NextRequest, { params }: { params: { id: string } }) => forward("DELETE", req, params.id);
