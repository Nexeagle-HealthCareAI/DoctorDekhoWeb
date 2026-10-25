import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const state = vi.hoisted(() => ({ article: {} as Record<string, unknown> }));
vi.mock("@/lib/contributor/client", () => ({ contributorApi: { article: vi.fn(async () => state.article), reviewArticle: vi.fn() } }));
vi.mock("@/lib/contributor/hooks", () => ({
  useContributor: () => ({ me: { id: "c1", role: "INDEPENDENT_DOCTOR", status: "VERIFIED", fullName: "Dr. Ravi", qualification: "MBBS", speciality: null, registrationNumber: "1", registrationCouncil: "DMC" } }),
  useLoad: (fn: () => Promise<unknown>) => { const [d, setD] = require("react").useState(null); require("react").useEffect(() => { void fn().then(setD); }, []); return { data: d, loading: !d, error: null, reload: () => {} }; },
  messageOf: (e: unknown) => String(e),
}));
vi.mock("@/components/contributor/ArticlePreview", () => ({ default: () => <div>preview</div> }));

import ReviewPage from "./page";

const article = (over: Record<string, unknown> = {}) => ({
  slug: "bp", type: "MEDICAL", title: "Blood pressure", description: "", content: "## x", coverImageUrl: null, coverImageAlt: null, relatedConditionSlug: null,
  disclosure: null, references: null, status: "IN_REVIEW", myRole: "REVIEWER", authorName: "", reviewerName: "Dr. Ravi", returnedComment: null,
  waitingDays: 1, awaitingVerification: false, views: null, likes: null, publishedAt: null, updatedAt: "2026-10-25T00:00:00Z", ...over,
});

beforeEach(() => { state.article = article(); });

describe("Review page: whose topic it was", () => {
  it("tells a reviewer the topic was suggested by another doctor", async () => {
    state.article = article({ suggestedBy: "Dr. Asha", suggestedByMe: false });
    render(<ReviewPage params={{ slug: "bp" }} />);
    expect(await screen.findByText(/Dr. Asha suggested this topic, and the NexEagle team asked you to review/)).toBeInTheDocument();
    expect(screen.getByText("Written by the NexEagle team")).toBeInTheDocument();
  });

  it("tells the doctor who suggested it that it was their own topic", async () => {
    state.article = article({ suggestedBy: "Dr. Ravi", suggestedByMe: true });
    render(<ReviewPage params={{ slug: "bp" }} />);
    expect(await screen.findByText(/You suggested this topic/)).toBeInTheDocument();
  });

  it("says nothing when the article did not start as a topic", async () => {
    render(<ReviewPage params={{ slug: "bp" }} />);
    await screen.findByText("Blood pressure");
    expect(screen.queryByText(/suggested this topic/)).toBeNull();
  });
});
