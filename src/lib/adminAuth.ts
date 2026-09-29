import { cookies } from "next/headers";

// Server-only. Standing in for real per-reviewer accounts (which need EasyHMS's own staff auth,
// per the Health Wiki CMS API spec) -- one shared password gets the write/review workflow
// working today; swap this for real accounts once that backend exists, without touching the
// admin UI or the wikiStore functions it calls.
export const ADMIN_SESSION_COOKIE = "dd_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24; // 1 day

export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ADMIN_SESSION_MAX_AGE,
};

// The cookie's value itself IS the check -- not a lookup token, just a marker that a login POST
// with the right password already succeeded once. Fine for a single shared-password gate;
// wouldn't be if this ever needed to distinguish which reviewer is logged in.
const SESSION_VALUE = "ok";

export function getAdminPassword(): string {
  return process.env.HEALTH_WIKI_ADMIN_PASSWORD || "doctordekho-admin";
}

export function isValidAdminSession(): boolean {
  return cookies().get(ADMIN_SESSION_COOKIE)?.value === SESSION_VALUE;
}

export { SESSION_VALUE as ADMIN_SESSION_VALUE };
