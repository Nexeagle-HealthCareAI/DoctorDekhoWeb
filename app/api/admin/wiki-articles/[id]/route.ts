import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession } from "@/lib/adminAuth";
import { getArticleById, updateArticle } from "@/lib/wikiStore";

export const dynamic = "force-dynamic";

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  if (!isValidAdminSession()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const article = await getArticleById(params.id);
  if (!article) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ article });
}

// PATCH /api/admin/wiki-articles/{id} -- writer edits their own draft (only meaningful while
// status is "draft"; the UI doesn't offer editing once it's in_review or published).
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isValidAdminSession()) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const article = await updateArticle(params.id, {
    title: body.title,
    description: body.description,
    content: body.content,
    relatedConditionSlug: body.relatedConditionSlug,
    authorId: body.authorId,
  });
  if (!article) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ article });
}
