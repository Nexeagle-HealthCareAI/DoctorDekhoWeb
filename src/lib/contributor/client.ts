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

async function call<T>(path: string, init?: RequestInit): Promise<T> {
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
  register: (input: RegisterInput) => call<ContributorMe>("register", send("POST", input)),
  me: () => call<ContributorMe>("me"),
  logout: () => call<{ ok: true }>("logout", send("POST")),

  articles: () => call<ArticleListResponse>("articles"),
  article: (slug: string) => call<MyArticle>(`articles/${encodeURIComponent(slug)}`),
  createArticle: (input: ArticleDraftInput) => call<MyArticle>("articles", send("POST", input)),
  updateArticle: (slug: string, input: ArticleDraftInput) => call<MyArticle>(`articles/${encodeURIComponent(slug)}`, send("PATCH", input)),
  submitArticle: (slug: string) => call<MyArticle>(`articles/${encodeURIComponent(slug)}/submit`, send("POST")),
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
