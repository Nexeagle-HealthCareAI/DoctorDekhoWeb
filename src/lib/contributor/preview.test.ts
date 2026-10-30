import { describe, expect, it } from "vitest";
import { toPreviewArticle } from "./preview";
import type { ContributorMe, MyArticle } from "./types";

const me: ContributorMe = {
  id: "c1", role: "INDEPENDENT_DOCTOR", fullName: "Dr. Imran Qureshi", mobileMasked: "+91 98••• ••002", status: "VERIFIED", speciality: "General Physician",
  qualification: "MBBS, MD", roleTitle: null, organisation: null, registrationNumber: "40116", registrationCouncil: "Delhi Medical Council", rejectReason: null,
};
const art = (over: Partial<MyArticle> = {}): MyArticle => ({
  slug: "a", type: "MEDICAL", title: "T", description: "D", content: "## Hi", coverImageUrl: null, coverImageAlt: null, relatedConditionSlug: "diabetes",
  disclosure: null, references: "WHO\n\n ICMR ", status: "IN_REVIEW", myRole: "REVIEWER", authorName: "NexEagle content team", reviewerName: null,
  returnedComment: null, waitingDays: 2, awaitingVerification: false, views: null, likes: null, publishedAt: null, updatedAt: "2026-10-01T00:00:00Z", ...over,
});

describe("toPreviewArticle", () => {
  it("shows the signed-in doctor as reviewer of a medical article", () => {
    const p = toPreviewArticle(art(), { reviewerAs: me });
    expect(p.reviewer?.name).toBe("Dr. Imran Qureshi");
    expect(p.reviewer?.registrationNumber).toBe("40116");
    expect(p.references).toEqual(["WHO", "ICMR"]);
  });
  it("never gives a sector update a reviewer or a condition", () => {
    const p = toPreviewArticle(art({ type: "SECTOR_UPDATE" }), { reviewerAs: me });
    expect(p.reviewer).toBeNull();
    expect(p.relatedConditionSlug).toBeNull();
  });
  it("names the author line from the article when there is no signed-in author", () => {
    expect(toPreviewArticle(art()).author?.name).toBe("NexEagle content team");
  });
  it("falls back to the update date when nothing was published", () => {
    expect(toPreviewArticle(art()).publishedAt).toBe("2026-10-01T00:00:00Z");
  });
});
