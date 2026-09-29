import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuth";
import { reviewArticle } from "@/lib/wikiStore";

export const dynamic = "force-dynamic";

// POST /api/admin/wiki-articles/{id}/review -- reviewer approves (publishes immediately) or
// sends the draft back with comments. Mirrors the decision shape from the Health Wiki CMS API
// spec so swapping in the real EasyHMS endpoint later is a like-for-like replacement.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isValidAdminSession()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.decision !== "approved" && body.decision !== "changes_requested") {
    return NextResponse.json({ message: "decision must be 'approved' or 'changes_requested'." }, { status: 400 });
  }
  if (!body.reviewerId) {
    return NextResponse.json({ message: "reviewerId is required." }, { status: 400 });
  }
  const article = await reviewArticle(params.id, {
    reviewerId: body.reviewerId,
    decision: body.decision,
    comments: body.comments,
  });
  if (!article) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ article });
}
