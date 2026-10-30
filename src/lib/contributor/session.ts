// Contributor session cookie. Server-only (route handlers). HttpOnly, so page scripts never see it.

export const CONTRIBUTOR_SESSION_COOKIE = "hw_contributor";

export const contributorSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  // Same 30 days the PRD proposes; the backend decides the real expiry.
  maxAge: 60 * 60 * 24 * 30,
};

/** True when the contributor pages run against the in-memory example backend. */
export const isContributorMock = () => process.env.CONTRIBUTOR_MOCK === "true";

/** The pages are hidden unless this build was made with NEXT_PUBLIC_CONTRIBUTOR_ENABLED=true. */
export const CONTRIBUTOR_ENABLED = process.env.NEXT_PUBLIC_CONTRIBUTOR_ENABLED === "true";
