import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { easyhmsFetch } from "@/lib/api/server";
import { ARTICLE_SLUG_PATTERN } from "@/lib/health-wiki/types";

export const dynamic = "force-dynamic";

// POST /api/public/health-articles/{slug}/like   -> {EASYHMS}/public/health-articles/{slug}/like
// POST /api/public/health-articles/{slug}/view   -> {EASYHMS}/public/health-articles/{slug}/view
// The backend counts one "helpful" per reader and one view per reader per day. "Reader" is an anonymous random id
// kept in an HttpOnly cookie (never an IP address, a name or anything that identifies a person).

const VISITOR_COOKIE = "hw_visitor";
const ACTIONS = new Set(["like", "view"]);

export async function POST(req: NextRequest, { params }: { params: { slug: string; action: string } }) {
  if (!ACTIONS.has(params.action) || !ARTICLE_SLUG_PATTERN.test(params.slug)) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorKey = existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : randomUUID();

  const r = await easyhmsFetch<Record<string, unknown>>(`/public/health-articles/${params.slug}/${params.action}`, {
    method: "POST",
    body: JSON.stringify({ visitorKey }),
  });
  if (r.notConfigured) return NextResponse.json({ notConfigured: true });

  const res = NextResponse.json(r.data ?? {}, { status: r.status === 0 ? 502 : r.status });
  if (visitorKey !== existing) {
    res.cookies.set(VISITOR_COOKIE, visitorKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
