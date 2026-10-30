// In-memory stand-in for the EasyHMS contributor endpoints, used only when CONTRIBUTOR_MOCK=true
// (see app/api/contributor/[...path]/route.ts). Example data; it resets when the server restarts.
// The rules here (verification before submit, five open topics, a comment when changes are
// requested) are the ones the real backend has to enforce too.

import type { HealthArticleDto } from "../health-wiki/dto";
import {
  OPEN_TOPIC_LIMIT,
  canSelfPublish,
  type ArticleDraftInput,
  type ArticleHistoryEntry,
  type ArticleListResponse,
  type ContributorMe,
  type EnrolRole,
  type InviteInfo,
  type MyArticle,
  type RegisterInput,
  type ReviewDecision,
  type TopicInput,
  type TopicRequest,
} from "./types";

export class MockError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Person extends ContributorMe {
  mobile: string;
}

interface Invite extends Omit<InviteInfo, "maskedMobile"> {
  mobile: string;
  state: "OK" | "USED" | "EXPIRED";
  articleSlug: string | null;
}

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const mask = (m: string) => `+91 ${m.slice(0, 2)}••• ••${m.slice(-3)}`;
const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);

const person = (p: Partial<Person> & Pick<Person, "id" | "role" | "fullName" | "mobile" | "status">): Person => ({
  mobileMasked: mask(p.mobile), speciality: null, qualification: null, roleTitle: null, organisation: null,
  registrationNumber: null, registrationCouncil: null, rejectReason: null, ...p,
});

const article = (a: Partial<MyArticle> & Pick<MyArticle, "slug" | "title" | "status" | "myRole">): MyArticle => ({
  type: "MEDICAL", description: "", content: "", coverImageUrl: null, coverImageAlt: null, relatedConditionSlug: null,
  disclosure: null, references: null, authorName: "NexEagle content team", reviewerName: null, returnedComment: null,
  waitingDays: null, awaitingVerification: false, views: null, likes: null, publishedAt: null, updatedAt: ago(1), ...a,
});

const BP_BODY = "## Know your numbers\n\nA normal reading is below **120/80**. Readings above **140/90** on two visits usually need treatment.\n\n## Daily habits that help\n\n- Cut salt to under 5 g a day\n- Walk 30 minutes, five days a week\n- Check your pressure at home, at the same time each day";

interface State {
  people: Person[];
  invites: Record<string, Invite>;
  articles: Record<string, MyArticle[]>; // by contributor id
  topics: Record<string, TopicRequest[]>;
  sessions: Record<string, string>; // session id -> contributor id
  history: Record<string, MockHistoryEntry[]>; // by article slug
}

interface MockHistoryEntry extends Omit<ArticleHistoryEntry, "byMe"> {
  actorId: string | null; // null = the NexEagle team
}

const seed = (): State => ({
  people: [
    person({ id: "c-imran", role: "INDEPENDENT_DOCTOR", fullName: "Dr. Imran Qureshi", mobile: "9891122002", status: "VERIFIED", speciality: "General Physician", qualification: "MBBS, MD (Medicine)", registrationNumber: "40116", registrationCouncil: "Delhi Medical Council" }),
  ],
  invites: {
    "demo-review": { kind: "REVIEW", role: "INDEPENDENT_DOCTOR", inviterName: "NexEagle content team", mobile: "9876544127", articleTitle: "Living with High Blood Pressure", articleCoverUrl: "/health-wiki-sample/bp-cover.svg", inviteeName: "Dr. Kavita Rao", state: "OK", articleSlug: "high-blood-pressure" },
    "demo-write": { kind: "WRITE", role: "WRITER", inviterName: "NexEagle content team", mobile: "9820044004", articleTitle: null, articleCoverUrl: null, inviteeName: "Rohan Mehta", state: "OK", articleSlug: null },
    "demo-used": { kind: "JOIN", role: "HEALTH_WORKER", inviterName: "NexEagle content team", mobile: "9830055005", articleTitle: null, articleCoverUrl: null, inviteeName: null, state: "USED", articleSlug: null },
    "demo-expired": { kind: "JOIN", role: "HEALTH_WORKER", inviterName: "NexEagle content team", mobile: "9830055006", articleTitle: null, articleCoverUrl: null, inviteeName: null, state: "EXPIRED", articleSlug: null },
  },
  articles: {
    "c-imran": [
      article({ slug: "high-blood-pressure", title: "Living with High Blood Pressure", description: "What the numbers mean, and daily habits that help keep them in range.", content: BP_BODY, coverImageUrl: "/health-wiki-sample/bp-cover.svg", coverImageAlt: "Abstract blue gradient", relatedConditionSlug: "hypertension", status: "IN_REVIEW", myRole: "REVIEWER", waitingDays: 4, reviewerName: "Dr. Imran Qureshi" }),
      article({ slug: "thyroid-basics", title: "Thyroid Basics", description: "Hypothyroidism and hyperthyroidism in plain language.", content: "## What the thyroid does\n\nA small gland in your neck that controls how fast your body uses energy.\n\n## Tests\n\nA **TSH** blood test is the first step.", relatedConditionSlug: "thyroid", status: "IN_REVIEW", myRole: "REVIEWER", waitingDays: 1, reviewerName: "Dr. Imran Qureshi" }),
      article({ slug: "silent-heart-attack", title: "Recognising a Silent Heart Attack", description: "Symptoms that are easy to miss, and when to go to an emergency room.", content: "## Why it is missed\n\nSome heart attacks cause mild discomfort rather than crushing chest pain.\n\n## What to do\n\nCall emergency services. Do not drive yourself.", coverImageUrl: "/health-wiki-sample/heart-cover.svg", coverImageAlt: "Abstract red gradient", relatedConditionSlug: "heart-disease", status: "PUBLISHED", myRole: "AUTHOR", authorName: "Dr. Imran Qureshi", reviewerName: "Dr. Meera Nair", views: 412, likes: 33, publishedAt: ago(14), updatedAt: ago(14) }),
      article({ slug: "cholesterol-what-to-eat", title: "Cholesterol: What to Eat", description: "Simple food swaps that lower LDL.", content: "## Foods that help\n\n- Oats and barley\n- Nuts in small portions", status: "PUBLISHED", myRole: "AUTHOR", authorName: "Dr. Imran Qureshi", reviewerName: "Dr. Rahul Sen", views: 87, likes: 8, publishedAt: ago(30), updatedAt: ago(30) }),
      article({ slug: "diabetes-and-diwali", title: "Managing Blood Sugar During Diwali", description: "", content: "## Sweets and fasting\n\nPlan meals around your medicine timing.", relatedConditionSlug: "diabetes", status: "DRAFT", myRole: "AUTHOR", authorName: "Dr. Imran Qureshi", returnedComment: "Please add what to do if sugar goes above 300 and name the sources you used.", updatedAt: ago(2) }),
    ],
  },
  topics: {
    "c-imran": [
      { id: "t-1", title: "Heat stroke in outdoor workers", type: "MEDICAL", outline: "Early signs and first aid for workers in summer.", whyItMatters: "Many patients arrive late.", conditionSlug: null, references: null, status: "SUBMITTED", decisionNote: null, articleSlug: null, createdAt: ago(3), updatedAt: ago(3) },
      { id: "t-2", title: "Home care for a child with fever", type: "MEDICAL", outline: "Simple steps for parents before reaching a clinic.", whyItMatters: "Parents call at night for this.", conditionSlug: null, references: null, status: "NEEDS_DETAIL", decisionNote: "Which age group does this cover, and which medicines would you mention?", articleSlug: null, createdAt: ago(5), updatedAt: ago(2) },
      { id: "t-3", title: "Best apps for health", type: "SECTOR_UPDATE", outline: "A list of apps.", whyItMatters: "Popular topic.", conditionSlug: null, references: null, status: "DECLINED", decisionNote: "Too broad and promotional. Pitch one specific trend with sources.", articleSlug: null, createdAt: ago(9), updatedAt: ago(8) },
    ],
  },
  sessions: {},
  history: {
    "silent-heart-attack": [
      { at: ago(16), kind: "CREATED", action: "Draft started", actor: "Dr. Imran Qureshi", actorId: "c-imran", detail: null },
      { at: ago(15), kind: "SUBMITTED", action: "Sent for review", actor: "Dr. Imran Qureshi", actorId: "c-imran", detail: null },
      { at: ago(14), kind: "REVIEWER_APPROVED", action: "Reviewer approved", actor: "Dr. Meera Nair", actorId: "c-meera", detail: null },
      { at: ago(14), kind: "APPROVED", action: "Approved and published", actor: "NexEagle team", actorId: null, detail: null },
      { at: ago(7), kind: "PULLED_BACK", action: "Pulled back to review", actor: "NexEagle team", actorId: null, detail: "Please name the sources you used for the symptoms list." },
      { at: ago(6), kind: "PUT_BACK_LIVE", action: "Put back live", actor: "NexEagle team", actorId: null, detail: "Sources were added by the team and checked." },
    ],
  },
});

// Kept on globalThis: in `next dev` a route can be recompiled on first visit, which would otherwise
// start this module again and wipe every session and draft in the middle of a test.
const g = globalThis as { __hwContributorImages?: Map<string, { type: string; bytes: Buffer }>; __hwContributorState?: State };
const images = (g.__hwContributorImages ??= new Map<string, { type: string; bytes: Buffer }>());

/** Keeps an uploaded image in memory and returns the local path that serves it. */
export function saveImage(type: string, bytes: Buffer): string {
  const id = `img-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  images.set(id, { type, bytes });
  return `/api/contributor/images/${id}`;
}

export const getImage = (id: string) => images.get(id) ?? null;

let state: State = (g.__hwContributorState ??= seed());
export const resetMock = () => { state = g.__hwContributorState = seed(); };

const me = (id: string) => {
  const p = state.people.find((x) => x.id === id);
  if (!p) throw new MockError(401, "Please sign in again.");
  return p;
};
const publicMe = (p: Person): ContributorMe => {
  const { mobile: _mobile, ...rest } = p;
  return rest;
};
const mine = (id: string) => (state.articles[id] ??= []);
const topicsOf = (id: string) => (state.topics[id] ??= []);
const findArticle = (id: string, slug: string) => {
  const a = mine(id).find((x) => x.slug === slug);
  if (!a) throw new MockError(404, "Article not found.");
  return a;
};

// ── sign in ────────────────────────────────────────────────────────────────

export function getInvite(token: string): InviteInfo {
  const inv = state.invites[token];
  if (!inv) throw new MockError(404, "This link is not valid.");
  if (inv.state === "USED") throw new MockError(410, "This link has already been used. Sign in with your mobile number instead.");
  if (inv.state === "EXPIRED") throw new MockError(410, "This link has expired. Ask the NexEagle team to send a new one.");
  return {
    kind: inv.kind, role: inv.role, inviterName: inv.inviterName, maskedMobile: mask(inv.mobile),
    articleTitle: inv.articleTitle, articleCoverUrl: inv.articleCoverUrl, inviteeName: inv.inviteeName,
  };
}

export function sendOtp(mobile: string, inviteToken?: string | null): { sent: true; devCode: string } {
  if (!/^\d{10}$/.test(mobile)) throw new MockError(400, "Enter a 10-digit mobile number.");
  if (inviteToken) {
    const inv = state.invites[inviteToken];
    if (!inv || inv.state !== "OK") throw new MockError(410, "This link is no longer valid.");
    if (inv.mobile !== mobile) throw new MockError(403, "This link was sent to a different number.");
  }
  return { sent: true, devCode: "123456" };
}

/** Returns a session id. The person still has to register when `needsRegistration` is true. */
export function verifyOtp(
  mobile: string, code: string, opts: { inviteToken?: string | null; role?: EnrolRole | null },
): { sessionId: string; needsRegistration: boolean } {
  if (!/^\d{6}$/.test(code) || code === "000000") throw new MockError(401, "That code is wrong or has expired. Request a new one.");
  let found = state.people.find((p) => p.mobile === mobile);
  if (!found) {
    const inv = opts.inviteToken ? state.invites[opts.inviteToken] : null;
    const role = inv?.role ?? opts.role;
    if (!role) throw new MockError(400, "Choose how you want to join first.");
    found = personStub(mobile, role, inv?.inviteeName ?? "");
    state.people.push(found);
    if (inv && opts.inviteToken) {
      inv.state = "USED";
      if (inv.articleSlug) {
        mine(found.id).push(article({
          slug: inv.articleSlug, title: inv.articleTitle ?? inv.articleSlug, description: "What the numbers mean, and daily habits that help keep them in range.",
          content: BP_BODY, coverImageUrl: inv.articleCoverUrl, coverImageAlt: "Abstract blue gradient", relatedConditionSlug: "hypertension",
          status: "IN_REVIEW", myRole: "REVIEWER", waitingDays: 3,
        }));
      }
    }
  }
  const sessionId = `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  state.sessions[sessionId] = found.id;
  return { sessionId, needsRegistration: !found.fullName || found.status === "INVITED" };
}

const personStub = (mobile: string, role: EnrolRole, name: string): Person =>
  person({ id: `c-${Math.random().toString(36).slice(2, 10)}`, role, fullName: name, mobile, status: "INVITED" });

export const contributorForSession = (sessionId: string | undefined): string => {
  const id = sessionId ? state.sessions[sessionId] : undefined;
  if (!id) throw new MockError(401, "Please sign in.");
  return id;
};

export function logout(sessionId: string | undefined) {
  if (sessionId) delete state.sessions[sessionId];
}

export function register(id: string, input: RegisterInput): ContributorMe {
  const p = me(id);
  const doctor = p.role === "INDEPENDENT_DOCTOR";
  if (!input.fullName.trim()) throw new MockError(400, "Enter your full name.");
  if (!input.consent) throw new MockError(400, "Please confirm the consent.");
  if (doctor && (!input.registrationNumber.trim() || !input.registrationCouncil.trim())) {
    throw new MockError(400, "Registration number and council are required for doctors.");
  }
  if (!doctor && !input.roleTitle.trim()) throw new MockError(400, "Enter your job title.");
  Object.assign(p, {
    fullName: input.fullName.trim(), status: "PENDING",
    speciality: doctor ? input.speciality.trim() || null : null,
    qualification: doctor ? input.qualification.trim() || null : null,
    registrationNumber: doctor ? input.registrationNumber.trim() : null,
    registrationCouncil: doctor ? input.registrationCouncil.trim() : null,
    roleTitle: doctor ? null : input.roleTitle.trim(),
    organisation: doctor ? null : input.organisation.trim() || null,
  });
  return publicMe(p);
}

export const getMe = (id: string) => publicMe(me(id));

// ── articles ───────────────────────────────────────────────────────────────

export function listArticles(id: string): ArticleListResponse {
  me(id);
  const all = mine(id);
  const byNewest = (a: MyArticle, b: MyArticle) => b.updatedAt.localeCompare(a.updatedAt);
  return {
    pending: all.filter((a) => a.status === "IN_REVIEW" && a.myRole === "REVIEWER").sort((a, b) => (b.waitingDays ?? 0) - (a.waitingDays ?? 0)),
    published: all.filter((a) => a.status === "PUBLISHED").sort(byNewest),
    drafts: all.filter((a) => a.myRole === "AUTHOR" && a.status !== "PUBLISHED").sort(byNewest),
  };
}

export const getArticle = (id: string, slug: string) => findArticle(id, slug);

/** Example backend only: the published articles as the public Health Wiki lists them, so what a doctor publishes here shows on /health. */
export function publishedForPublic(): HealthArticleDto[] {
  const seen = new Set<string>();
  const out: HealthArticleDto[] = [];
  for (const p of state.people) {
    for (const a of state.articles[p.id] ?? []) {
      if (a.status !== "PUBLISHED" || a.myRole !== "AUTHOR" || a.awaitingVerification || seen.has(a.slug)) continue;
      seen.add(a.slug);
      out.push({
        id: a.slug, type: a.type, title: a.title, description: a.description, content: a.content, coverImageUrl: a.coverImageUrl,
        coverImageAlt: a.coverImageAlt, relatedConditionSlug: a.relatedConditionSlug, disclosure: a.disclosure, references: a.references,
        author: { id: p.id, fullName: p.fullName, type: p.role, speciality: p.speciality, qualification: p.qualification },
        reviewer: null, publishedAt: a.publishedAt ?? a.updatedAt, updatedAt: a.updatedAt,
      });
    }
  }
  return out;
}

const log = (slug: string, kind: string, action: string, who: { id: string; name: string } | null, detail: string | null = null) => {
  ((state.history ??= {})[slug] ??= []).push({ at: new Date().toISOString(), kind, action, actor: who ? who.name : "NexEagle team", actorId: who ? who.id : null, detail });
};

/** What the author or reviewer sees, newest first. */
export function getHistory(id: string, slug: string): ArticleHistoryEntry[] {
  findArticle(id, slug);
  return [...(state.history?.[slug] ?? [])]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ actorId, ...e }) => ({ ...e, byMe: actorId === id }));
}

/**
 * Example backend only: what the NexEagle team does in the CMS, so the doctor's history can be tried without the CMS.
 * pull-back and take-down hold the article for review; pull-up puts it back live.
 */
export function teamAction(id: string, slug: string, action: string, reason: string | null) {
  const a = findArticle(id, slug);
  const note = reason?.trim() || null;
  if (action === "pull-back") {
    Object.assign(a, { status: "IN_REVIEW", holdForReview: true, waitingDays: 0 });
    log(slug, "PULLED_BACK", "Pulled back to review", null, note);
  } else if (action === "take-down") {
    Object.assign(a, { status: "DRAFT", holdForReview: true });
    log(slug, "UNPUBLISHED", "Taken offline", null, note);
  } else if (action === "pull-up") {
    Object.assign(a, { status: "PUBLISHED", holdForReview: false, waitingDays: null, publishedAt: a.publishedAt ?? new Date().toISOString() });
    log(slug, "PUT_BACK_LIVE", "Put back live", null, note);
  } else throw new MockError(400, "Unknown team action.");
  a.updatedAt = new Date().toISOString();
  return a;
}

const mustBeApproved = (p: Person) => {
  if (p.status !== "VERIFIED" && p.status !== "PENDING") throw new MockError(403, "Your profile has not been accepted yet.");
};

export function createDraft(id: string, input: ArticleDraftInput): MyArticle {
  const p = me(id);
  if (p.role === "WRITER" && input.type === "MEDICAL") throw new MockError(403, "Writers can only write Sector updates.");
  if (!input.title.trim()) throw new MockError(400, "Title is required.");
  let slug = slugify(input.title) || "article";
  while (mine(id).some((a) => a.slug === slug)) slug += "-2";
  const a = article({ ...input, slug, status: "DRAFT", myRole: "AUTHOR", authorName: p.fullName || "You", updatedAt: new Date().toISOString() });
  mine(id).unshift(a);
  log(slug, "CREATED", "Draft started", { id, name: p.fullName || "You" });
  return a;
}

export function updateDraft(id: string, slug: string, input: ArticleDraftInput): MyArticle {
  const a = findArticle(id, slug);
  if (a.myRole !== "AUTHOR" || a.status !== "DRAFT") throw new MockError(409, "Only a draft can be edited.");
  if (me(id).role === "WRITER" && input.type === "MEDICAL") throw new MockError(403, "Writers can only write Sector updates.");
  Object.assign(a, input, { updatedAt: new Date().toISOString() });
  return a;
}

export function submitArticle(id: string, slug: string): MyArticle {
  const p = me(id);
  mustBeApproved(p);
  const a = findArticle(id, slug);
  const selfPublish = canSelfPublish(p, a);
  if (a.myRole !== "AUTHOR" || !(a.status === "DRAFT" || (selfPublish && a.status === "PUBLISHED"))) throw new MockError(409, "Only a draft can be submitted.");
  if (!a.title.trim() || !a.content.trim()) throw new MockError(400, "Add a title and some content first.");
  if (a.coverImageUrl && !(a.coverImageAlt ?? "").trim()) throw new MockError(400, "Add alt text for the cover image.");
  // A verified doctor publishes their own article at once; everyone else goes through review.
  if (selfPublish) Object.assign(a, { status: "PUBLISHED", returnedComment: null, waitingDays: null, publishedAt: a.publishedAt ?? new Date().toISOString(), reviewerName: null, updatedAt: new Date().toISOString() });
  else Object.assign(a, { status: "IN_REVIEW", returnedComment: null, waitingDays: 0, updatedAt: new Date().toISOString() });
  const who = { id, name: p.fullName || "You" };
  if (selfPublish) log(a.slug, "SELF_PUBLISHED", "Published, no review needed", who);
  else log(a.slug, "SUBMITTED", "Sent for review", who);
  return a;
}

export function reviewArticle(id: string, slug: string, d: ReviewDecision): MyArticle {
  const p = me(id);
  const a = findArticle(id, slug);
  if (a.myRole !== "REVIEWER" || a.status !== "IN_REVIEW") throw new MockError(409, "This article is not waiting for your review.");
  if (p.role !== "INDEPENDENT_DOCTOR") throw new MockError(403, "Only doctors can review.");
  if (d.decision === "REQUEST_CHANGES") {
    if (d.comment.trim().length < 10) throw new MockError(400, "Add a short comment so the writer knows what to change.");
    Object.assign(a, { status: "DRAFT", returnedComment: d.comment.trim(), myRole: "REVIEWER", updatedAt: new Date().toISOString() });
    // Back with the writer: it leaves this person's lists.
    state.articles[id] = mine(id).filter((x) => x !== a);
    log(slug, "REVIEWER_REQUESTED_CHANGES", "Reviewer asked for changes", { id, name: p.fullName }, d.comment.trim());
    return a;
  }
  Object.assign(a, {
    status: "PUBLISHED", awaitingVerification: p.status !== "VERIFIED", views: 0, likes: 0,
    publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  log(slug, "REVIEWER_APPROVED", "Reviewer approved", { id, name: p.fullName });
  return a;
}

// ── topics ─────────────────────────────────────────────────────────────────

export const listTopics = (id: string) => (me(id), [...topicsOf(id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

export function createTopic(id: string, input: TopicInput): TopicRequest {
  const p = me(id);
  mustBeApproved(p);
  if (!input.title.trim() || !input.outline.trim() || !input.whyItMatters.trim()) throw new MockError(400, "Fill in the topic, the outline and why it matters.");
  if (p.role === "WRITER" && input.type === "MEDICAL") throw new MockError(403, "Writers can only suggest Sector updates.");
  const open = topicsOf(id).filter((t) => t.status === "SUBMITTED" || t.status === "NEEDS_DETAIL").length;
  if (open >= OPEN_TOPIC_LIMIT) throw new MockError(409, `You already have ${OPEN_TOPIC_LIMIT} open requests. Wait for a decision before sending another.`);
  const now = new Date().toISOString();
  const t: TopicRequest = { ...input, id: `t-${Date.now().toString(36)}`, status: "SUBMITTED", decisionNote: null, articleSlug: null, createdAt: now, updatedAt: now };
  topicsOf(id).unshift(t);
  return t;
}

export function addTopicDetail(id: string, topicId: string, input: Partial<TopicInput>): TopicRequest {
  const t = topicsOf(id).find((x) => x.id === topicId);
  if (!t) throw new MockError(404, "Topic not found.");
  if (t.status !== "NEEDS_DETAIL") throw new MockError(409, "The team has not asked for more detail on this one.");
  Object.assign(t, input, { status: "SUBMITTED", decisionNote: null, updatedAt: new Date().toISOString() });
  return t;
}
