// Server-only: the contributor backend-for-frontend talks to the EasyHMS /contributor/* routes here.
// The browser never sees the EasyHMS address or the session token: the token lives in an HttpOnly cookie
// and is sent upstream in the X-Contributor-Session header.

import { headers } from "next/headers";

const BASE_URL = process.env.EASYHMS_API_BASE_URL ?? "";
const API_KEY = process.env.EASYHMS_API_KEY ?? "";
const KEY_HEADER = process.env.EASYHMS_API_KEY_HEADER ?? "X-Api-Key";
const PROXY_SECRET = process.env.EASYHMS_TRUSTED_PROXY_SECRET ?? "";

export const SESSION_HEADER = "X-Contributor-Session";

/** First path segments the pages may call. Anything else is a 404 and is never forwarded. */
export const ALLOWED_SEGMENTS = ["invite", "enrol", "otp", "logout", "register", "me", "articles", "images", "topics"] as const;

export const isUpstreamConfigured = () => Boolean(BASE_URL);

export interface Upstream {
  status: number;
  data: unknown;
  retryAfter: string | null;
}

/** The visitor's address, so the backend's per-address limits (codes, sign-ins) see the person and not this server. */
function visitorIp(): string | null {
  try {
    const h = headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return h.get("cf-connecting-ip") || h.get("x-real-ip") || null;
  } catch {
    return null;
  }
}

export async function callUpstream(
  path: string,
  opts: { method: string; body?: BodyInit | null; json?: boolean; sessionToken?: string | null; timeoutMs?: number }
): Promise<Upstream> {
  const ip = PROXY_SECRET ? visitorIp() : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(`${BASE_URL}/contributor/${path}`, {
      method: opts.method,
      body: opts.body ?? undefined,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        // A multipart body sets its own Content-Type (with the boundary), so it is left out then.
        ...(opts.json === false ? {} : { "Content-Type": "application/json" }),
        ...(API_KEY ? { [KEY_HEADER]: API_KEY } : {}),
        ...(PROXY_SECRET && ip ? { "X-Internal-Proxy-Secret": PROXY_SECRET, "X-Forwarded-Client-Ip": ip } : {}),
        ...(opts.sessionToken ? { [SESSION_HEADER]: opts.sessionToken } : {}),
      },
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, retryAfter: res.headers.get("Retry-After") };
  } catch {
    return { status: 0, data: null, retryAfter: null };
  } finally {
    clearTimeout(timer);
  }
}
