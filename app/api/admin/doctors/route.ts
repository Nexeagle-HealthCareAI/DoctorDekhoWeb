import { NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuth";
import { getAllDoctors } from "@/lib/api/server";

export const dynamic = "force-dynamic";

// GET /api/admin/doctors -- trimmed doctor list for the author/reviewer picker in the Health
// Wiki admin tool. Reuses the same directory fetch the rest of the site already uses.
export async function GET() {
  if (!isValidAdminSession()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { doctors } = await getAllDoctors();
  const trimmed = doctors.map((d) => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    qualifications: d.qualifications,
  }));
  return NextResponse.json({ doctors: trimmed });
}
