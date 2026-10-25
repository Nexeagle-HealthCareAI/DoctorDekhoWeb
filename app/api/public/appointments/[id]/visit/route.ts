import { NextRequest, NextResponse } from "next/server";
import { easyhmsFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

// GET /api/public/appointments/[id]/visit  ->  {EASYHMS}/public/appointments/{id}/visit (Vita vision, Phase 4).
// The visit page: where and when, the hospital's visit guide, check-in, token and wait. Like the guest booking lookup, the
// appointment id is the only gate, and 1HMS sends nothing personal back.
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!GUID.test(params.id)) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  const r = await easyhmsFetch(`/public/appointments/${params.id}/visit`);
  if (r.notConfigured) return NextResponse.json({ notConfigured: true }, { status: 503 });
  return NextResponse.json(r.data, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
