import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE, adminSessionCookieOptions, getAdminPassword } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// POST /api/admin/auth -- shared-password login for the Health Wiki admin tool (see adminAuth.ts
// for why this is one shared password rather than per-reviewer accounts).
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== getAdminPassword()) {
    return NextResponse.json({ success: false, message: "Incorrect password." }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE, adminSessionCookieOptions);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(ADMIN_SESSION_COOKIE);
  return res;
}
