import { NextRequest, NextResponse } from "next/server";
import {
  CONTRIBUTOR_SESSION_COOKIE,
  contributorSessionCookieOptions,
  isContributorMock,
} from "@/lib/contributor/session";
import * as store from "@/lib/contributor/mockStore";
import type { ArticleDraftInput, EnrolRole, RegisterInput, ReviewDecision, TopicInput } from "@/lib/contributor/types";

export const dynamic = "force-dynamic";

// Contributor backend-for-frontend. The pages call these paths; today they are answered by the
// in-memory example store (CONTRIBUTOR_MOCK=true). When the EasyHMS /contributor/* endpoints exist,
// replace the body of `handle` with a proxy to them (see docs/health-wiki-api-contract.md).
// Without the flag every call answers 503, so a deployment that has not opted in exposes nothing.

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

async function route(req: NextRequest, { params }: { params: { path: string[] } }) {
  if (!isContributorMock()) return json({ message: "The contributor pages are not available yet." }, 503);
  try {
    return await handle(req, params.path ?? []);
  } catch (e) {
    return fail(e);
  }
}

export const GET = route;
export const POST = route;
export const PATCH = route;
