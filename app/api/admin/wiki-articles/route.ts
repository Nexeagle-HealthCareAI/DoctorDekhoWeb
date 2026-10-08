import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuth";
import { getAllArticles, createDraft } from "@/lib/wikiStore";

export const dynamic = "force-dynamic";

// GET /api/admin/wiki-articles -- list every article regardless of status (draft/in_review/published).
export async function GET() {
  if (!isValidAdminSession()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const articles = await getAllArticles();
  return NextResponse.json({ articles });
}

// POST /api/admin/wiki-articles -- writer creates a new draft.
export async function POST(req: NextRequest) {
  if (!isValidAdminSession()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.title || !body.authorId) {
    return NextResponse.json({ message: "title and authorId are required." }, { status: 400 });
  }
  const article = await createDraft({
    title: body.title,
    description: body.description ?? "",
    content: body.content ?? "",
    relatedConditionSlug: body.relatedConditionSlug ?? "",
    authorId: body.authorId,
  });
  return NextResponse.json({ article }, { status: 201 });
}
