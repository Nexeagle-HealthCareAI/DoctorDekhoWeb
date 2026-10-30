import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const api = vi.hoisted(() => ({ createArticle: vi.fn(), updateArticle: vi.fn(), submitArticle: vi.fn(), uploadImage: vi.fn() }));
vi.mock("@/lib/contributor/client", () => ({ contributorApi: api, ApiError: class extends Error {} }));

import ArticleForm from "./ArticleForm";
import SubmitConsentDialog from "./SubmitConsentDialog";
import { canSelfPublish, type ContributorMe, type MyArticle } from "@/lib/contributor/types";

const me = (over: Partial<ContributorMe> = {}): ContributorMe => ({
  id: "c1", role: "INDEPENDENT_DOCTOR", fullName: "Dr. Meera", mobileMasked: "+91 98••• ••127", status: "VERIFIED",
  speciality: null, qualification: null, roleTitle: null, organisation: null, registrationNumber: "1", registrationCouncil: "DMC", rejectReason: null, ...over,
});
const article = (over: Partial<MyArticle> = {}): MyArticle => ({
  slug: "bp", type: "MEDICAL", title: "Blood pressure", description: "d", content: "## Know your numbers", coverImageUrl: null, coverImageAlt: null,
  relatedConditionSlug: null, disclosure: null, references: null, status: "DRAFT", myRole: "AUTHOR", authorName: "Dr. Meera", reviewerName: null,
  returnedComment: null, waitingDays: null, awaitingVerification: false, views: null, likes: null, publishedAt: null, updatedAt: "2026-10-24T00:00:00Z", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.updateArticle.mockImplementation(async (_s: string, p: object) => ({ ...article(), ...p }));
});

describe("canSelfPublish", () => {
  it("is true only for a verified doctor, for their own article, unless the team pulled it back", () => {
    expect(canSelfPublish(me())).toBe(true);
    expect(canSelfPublish(me({ role: "HOSPITAL_DOCTOR" }), article())).toBe(true);
    expect(canSelfPublish(me({ status: "PENDING" }))).toBe(false);
    expect(canSelfPublish(me({ role: "WRITER" }))).toBe(false);
    expect(canSelfPublish(me({ role: "HEALTH_WORKER" }))).toBe(false);
    expect(canSelfPublish(me(), article({ holdForReview: true }))).toBe(false);
    expect(canSelfPublish(me(), article({ myRole: "REVIEWER" }))).toBe(false);
  });
});

describe("ArticleForm: a verified doctor publishes", () => {
  it("offers Publish, asks for confirmation, and publishes at once", async () => {
    render(<ArticleForm me={me()} existing={article()} />);
    expect(screen.getByText(/goes live as soon as you publish it/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByText("Publish this article now?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Publish now" }));
    await waitFor(() => expect(api.submitArticle).toHaveBeenCalledWith("bp", true));
    expect(push).toHaveBeenCalledWith("/contribute?tab=published");
  });

  it("lets them edit their live article and publish the changes", async () => {
    render(<ArticleForm me={me()} existing={article({ status: "PUBLISHED", publishedAt: "2026-10-01T00:00:00Z" })} />);
    expect(screen.getByLabelText(/Title/)).toBeEnabled();
    expect(screen.getByRole("button", { name: "Publish changes" })).toBeEnabled();
  });

  it("keeps the review route for a doctor who is not verified yet", () => {
    render(<ArticleForm me={me({ status: "PENDING" })} existing={article()} />);
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
  });

  it("sends a pulled-back article through review again", () => {
    render(<ArticleForm me={me()} existing={article({ holdForReview: true })} />);
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeInTheDocument();
  });

  it("does not let a verified doctor edit a live article that was pulled back", () => {
    render(<ArticleForm me={me()} existing={article({ status: "IN_REVIEW", holdForReview: true })} />);
    expect(screen.getByLabelText(/Title/)).toBeDisabled();
  });
});

describe("SubmitConsentDialog: publish now", () => {
  it("says it goes live with no review, and asks for responsibility, not for a reviewer's permission", async () => {
    const onConfirm = vi.fn();
    render(<SubmitConsentDialog open medical selfPublish busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText(/without a review/)).toBeInTheDocument();
    expect(screen.getByText(/Medically reviewed by/)).toBeInTheDocument();
    expect(screen.getByText(/pull it back to review or take it down/)).toBeInTheDocument();
    const publish = screen.getByRole("button", { name: "Publish now" });
    expect(publish).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(publish);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not mention the reviewed-by badge for a sector update", () => {
    render(<SubmitConsentDialog open medical={false} selfPublish busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText(/Medically reviewed by/)).toBeNull();
  });
});
