import { NextRequest, NextResponse } from "next/server";
import {
  CONTRIBUTOR_SESSION_COOKIE,
  contributorSessionCookieOptions,
  isContributorMock,
} from "@/lib/contributor/session";
import * as store from "@/lib/contributor/mockStore";
import { ALLOWED_SEGMENTS, callUpstream, isUpstreamConfigured } from "@/lib/contributor/upstream";
import type { ArticleDraftInput, EnrolRole, RegisterInput, ReviewDecision, TopicInput } from "@/lib/contributor/types";

export const dynamic = "force-dynamic";

// Contributor backend-for-frontend. The pages call these paths and this route is the only place that talks
// to the EasyHMS /contributor/* endpoints (see docs/health-wiki-api-contract.md). CONTRIBUTOR_MOCK=true answers
// from the in-memory example store instead (local review). With neither the mock nor EASYHMS_API_BASE_URL
// configured every call answers 503, so a deployment that has not opted in exposes nothing.

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const fail = (e: unknown) =>
  e instanceof store.MockError ? json({ message: e.message }, e.status) : json({ message: "Something went wrong. Try again." }, 500);

const ROLES: EnrolRole[] = ["INDEPENDENT_DOCTOR", "HEALTH_WORKER", "WRITER"];
const digits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

async function handle(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const method = req.method;
  const [a, b, c] = segments;
  const sessionId = req.cookies.get(CONTRIBUTOR_SESSION_COOKIE)?.value;
  const who = () => store.contributorForSession(sessionId);
  const body = async <T,>() => (await req.json().catch(() => ({}))) as T;

  // test helper: put the example data back to its start (example backend only)
  if (method === "POST" && a === "reset") {
    store.resetMock();
    return json({ ok: true });
  }

  // sign in
  if (method === "GET" && a === "invite" && b) return json(store.getInvite(b));
  if (method === "POST" && (a === "enrol" || (a === "otp" && b === "send"))) {
    const { mobile, inviteToken } = await body<{ mobile?: string; inviteToken?: string | null }>();
    return json(store.sendOtp(digits(mobile), inviteToken));
  }
  if (method === "POST" && a === "otp" && b === "verify") {
    const { mobile, code, inviteToken, role } = await body<{ mobile?: string; code?: string; inviteToken?: string | null; role?: EnrolRole | null }>();
    const safeRole = role && ROLES.includes(role) ? role : null;
    const r = store.verifyOtp(digits(mobile), digits(code), { inviteToken, role: safeRole });
    const res = json({ signedIn: true, needsRegistration: r.needsRegistration });
    res.cookies.set(CONTRIBUTOR_SESSION_COOKIE, r.sessionId, contributorSessionCookieOptions);
    return res;
  }
  if (method === "POST" && a === "register") return json(store.register(who(), await body<RegisterInput>()));
  if (method === "GET" && a === "me") return json(store.getMe(who()));
  if (method === "POST" && a === "logout") {
    store.logout(sessionId);
    const res = json({ ok: true });
    res.cookies.delete(CONTRIBUTOR_SESSION_COOKIE);
    return res;
  }

  // articles
  if (a === "articles") {
    if (method === "GET" && !b) return json(store.listArticles(who()));
    if (method === "GET" && b && !c) return json(store.getArticle(who(), b));
    if (method === "POST" && !b) return json(store.createDraft(who(), await body<ArticleDraftInput>()), 201);
    if (method === "PATCH" && b && !c) return json(store.updateDraft(who(), b, await body<ArticleDraftInput>()));
    if (method === "POST" && b && c === "submit") return json(store.submitArticle(who(), b));
    if (method === "POST" && b && c === "review") return json(store.reviewArticle(who(), b, await body<ReviewDecision>()));
  }

  // topics
  if (a === "topics") {
    if (method === "GET" && !b) return json(store.listTopics(who()));
    if (method === "POST" && !b) return json(store.createTopic(who(), await body<TopicInput>()), 201);
    if (method === "PATCH" && b) return json(store.addTopicDetail(who(), b, await body<Partial<TopicInput>>()));
  }

  // images: the example backend keeps uploads in memory and serves them from a local path
  if (method === "GET" && a === "images" && b) {
    const img = store.getImage(b);
    if (!img) return json({ message: "Not found." }, 404);
    return new NextResponse(img.bytes, { headers: { "Content-Type": img.type, "Cache-Control": "private, max-age=300" } });
  }
  if (method === "POST" && a === "images") {
    who();
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return json({ message: "Choose an image." }, 400);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return json({ message: "Use a JPG, PNG or WebP file." }, 400);
    if (file.size > 2 * 1024 * 1024) return json({ message: "That file is over 2 MB." }, 400);
    return json({ url: store.saveImage(file.type, Buffer.from(await file.arrayBuffer())) });
  }

  return json({ message: "Not found." }, 404);
}

const GENERIC = "Something went wrong. Try again.";

/** Forward one call to the EasyHMS contributor API. The session token is kept in the HttpOnly cookie. */
async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const [first] = segments;
  if (!first || !(ALLOWED_SEGMENTS as readonly string[]).includes(first)) return json({ message: "Not found." }, 404);
  const path = segments.map(encodeURIComponent).join("/");
  const token = req.cookies.get(CONTRIBUTOR_SESSION_COOKIE)?.value ?? null;
  const isImage = first === "images" && req.method === "POST";

  let body: BodyInit | null = null;
  if (isImage) body = await req.formData().catch(() => null);
  else if (req.method !== "GET") body = JSON.stringify(await req.json().catch(() => ({})));
  if (isImage && !body) return json({ message: "Choose an image." }, 400);

  const up = await callUpstream(path, { method: req.method, body, json: !isImage, sessionToken: token, timeoutMs: isImage ? 60_000 : 20_000 });
  if (up.status === 0) return json({ message: "The service is not reachable right now. Try again in a moment." }, 502);
  const data = (up.data ?? {}) as Record<string, unknown>;

  const out = (b: unknown, status: number) => {
    const r = json(b, status);
    if (up.retryAfter) r.headers.set("Retry-After", up.retryAfter);
    return r;
  };

  if (up.status >= 400) {
    const res = out({ message: typeof data.message === "string" && data.message ? data.message : GENERIC, ...(data.retryAfterSeconds ? { retryAfterSeconds: data.retryAfterSeconds } : {}) }, up.status);
    // The session is no longer valid upstream: drop the cookie so the page sends the person to sign in again.
    if (up.status === 401) res.cookies.delete(CONTRIBUTOR_SESSION_COOKIE);
    return res;
  }

  // sign in: the token goes into the cookie and never to the page
  if (first === "otp" && segments[1] === "verify") {
    const expires = typeof data.sessionExpiresAt === "string" ? new Date(data.sessionExpiresAt) : null;
    if (typeof data.sessionToken !== "string") return json({ message: GENERIC }, 502);
    const res = json({ signedIn: true, needsRegistration: data.needsRegistration === true });
    res.cookies.set(CONTRIBUTOR_SESSION_COOKIE, data.sessionToken, {
      ...contributorSessionCookieOptions,
      ...(expires && !Number.isNaN(expires.getTime()) ? { expires, maxAge: undefined } : {}),
    });
    return res;
  }
  if (first === "otp" || first === "enrol") return json({ sent: true });
  if (first === "logout") {
    const res = json({ ok: true });
    res.cookies.delete(CONTRIBUTOR_SESSION_COOKIE);
    return res;
  }
  return out(up.data, up.status);
}

async function route(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!isContributorMock()) {
    if (!isUpstreamConfigured()) return json({ message: "The contributor pages are not available yet." }, 503);
    try {
      return await proxy(req, params.path ?? []);
    } catch {
      return json({ message: GENERIC }, 500);
    }
  }
  try {
    return await handle(req, params.path ?? []);
  } catch (e) {
    return fail(e);
  }
}

export const GET = route;
export const POST = route;
export const PATCH = route;
