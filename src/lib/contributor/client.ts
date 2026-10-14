// Browser-side calls to the contributor backend-for-frontend (app/api/contributor). The session is an
// HttpOnly cookie, so nothing here handles a token.

import type {
  ArticleDraftInput,
  ArticleListResponse,
  ContributorMe,
  EnrolRole,
  InviteInfo,
  MyArticle,
  RegisterInput,
  ReviewDecision,
  TopicInput,
  TopicRequest,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Calls that are themselves about signing in or out never trigger the automatic sign-in below.
const AUTH_PATHS = /^(otp\/|enrol|sso\/|session-from-patient|profile-tag|logout|invite\/)/;

let patientSignIn: Promise<boolean> | null = null;

/**
 * A person who is signed in on Doctor Dekho (their number was proven by the WhatsApp code) should not be asked for another code to use the
 * Health Wiki. When a contributor call answers "sign in", the patient login is tried once (the server turns it into a contributor session).
 * Several calls failing at once share one attempt.
 */
function signInFromPatientLogin(): Promise<boolean> {
  patientSignIn ??= fetch("/api/contributor/session-from-patient", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { setTimeout(() => { patientSignIn = null; }, 2000); });
  return patientSignIn;
}

async function call<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/contributor/${path}`, {
      credentials: "same-origin",
      ...init,
      headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "No connection. Check your internet and try again.");
  }
  if (res.status === 401 && !retried && !AUTH_PATHS.test(path) && (await signInFromPatientLogin())) return call<T>(path, init, true);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { message?: string }).message || "Something went wrong. Try again.");
  return data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const contributorApi = {
  invite: (token: string) => call<InviteInfo>(`invite/${encodeURIComponent(token)}`),
  sendOtp: (mobile: string, inviteToken?: string | null) =>
    call<{ sent: true; devCode?: string }>("otp/send", send("POST", { mobile, inviteToken })),
  verifyOtp: (mobile: string, code: string, opts: { inviteToken?: string | null; role?: EnrolRole | null }) =>
    call<{ signedIn: true; needsRegistration: boolean }>("otp/verify", send("POST", { mobile, code, ...opts })),
  /**
   * Opens the contributor area for the signed-in patient with no second code. With a role, a patient who is not a contributor yet joins as that
   * role. Rejects when there is no patient login, or the person is not a contributor and gave no role.
   */
  sessionFromPatient: (role?: EnrolRole | null) =>
    call<{ signedIn: true; needsRegistration: boolean }>("session-from-patient", send("POST", role ? { role } : {})),
  /** A hospital doctor arriving from EasyHMS: the one-time code in the address becomes a session. */
  ssoExchange: (code: string) => call<{ signedIn: true; needsRegistration: boolean }>("sso/exchange", send("POST", { code })),
  register: (input: RegisterInput) => call<ContributorMe>("register", send("POST", input)),
  me: () => call<ContributorMe>("me"),
  logout: () => call<{ ok: true }>("logout", send("POST")),

  articles: () => call<ArticleListResponse>("articles"),
  article: (slug: string) => call<MyArticle>(`articles/${encodeURIComponent(slug)}`),
  createArticle: (input: ArticleDraftInput) => call<MyArticle>("articles", send("POST", input)),
  updateArticle: (slug: string, input: ArticleDraftInput) => call<MyArticle>(`articles/${encodeURIComponent(slug)}`, send("PATCH", input)),
  /** The author has agreed that the reviewer may publish it (the API refuses without it). */
  submitArticle: (slug: string, consent: boolean) => call<MyArticle>(`articles/${encodeURIComponent(slug)}/submit`, send("POST", { consent })),
  reviewArticle: (slug: string, d: ReviewDecision) => call<MyArticle>(`articles/${encodeURIComponent(slug)}/review`, send("POST", d)),
  uploadImage: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await call<{ url: string }>("images", { method: "POST", body: form })).url;
  },

  topics: () => call<TopicRequest[]>("topics"),
  createTopic: (input: TopicInput) => call<TopicRequest>("topics", send("POST", input)),
  addTopicDetail: (id: string, input: Partial<TopicInput>) => call<TopicRequest>(`topics/${encodeURIComponent(id)}`, send("PATCH", input)),
};
