import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuth";
import { submitForReview } from "@/lib/wikiStore";

export const dynamic = "force-dynamic";

// POST /api/admin/wiki-articles/{id}/submit -- writer moves a draft into the reviewer's queue.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isValidAdminSession()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const article = await submitForReview(params.id);
  if (!article) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ article });
}
