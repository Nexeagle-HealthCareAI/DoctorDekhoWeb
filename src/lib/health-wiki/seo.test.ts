import { describe, expect, it } from "vitest";
import { buildArticleJsonLd, buildBreadcrumbJsonLd, jsonLdString } from "./seo";
import { mapArticle } from "./mappers";
import type { HealthArticle } from "./types";

const reviewer = { id: "d1", fullName: "Dr. Meera Nair", type: "HOSPITAL_DOCTOR", isRegistrationVerified: true };
const article = (over: Partial<Parameters<typeof mapArticle>[0]> = {}): HealthArticle =>
  mapArticle({ id: "a", title: "T", content: "c", description: "D", updatedAt: "2026-10-01T00:00:00Z", ...over })!;

describe("buildArticleJsonLd", () => {
  it("describes a reviewed MEDICAL article as a MedicalWebPage with its reviewer and condition", () => {
    const ld: any = buildArticleJsonLd(article({ reviewer, relatedConditionSlug: "heart-disease" }));
    expect(ld["@type"]).toEqual(["MedicalWebPage", "Article"]);
    expect(ld.reviewedBy.name).toBe("Dr. Meera Nair");
    expect(ld.about.name).toBe("heart disease");
  });

  it("omits reviewedBy when there is no verified reviewer", () => {
    const ld: any = buildArticleJsonLd(article({ reviewer: { ...reviewer, isRegistrationVerified: false } }));
    expect(ld.reviewedBy).toBeUndefined();
  });

  it("describes a SECTOR_UPDATE as a NewsArticle with no medical claims", () => {
    const ld: any = buildArticleJsonLd(article({ type: "SECTOR_UPDATE", reviewer, author: { fullName: "Rohan Mehta", type: "WRITER", organisation: "HealthTech India" } }));
    expect(ld["@type"]).toBe("NewsArticle");
    expect(ld.reviewedBy).toBeUndefined();
    expect(ld.about).toBeUndefined();
    expect(ld.author["@type"]).toBe("Person");
    expect(ld.author.affiliation.name).toBe("HealthTech India");
  });

  it("makes a local cover URL absolute", () => {
    const ld: any = buildArticleJsonLd(article({ coverImageUrl: "/health-wiki-sample/a.svg" }));
    expect(ld.image).toMatch(/^https?:\/\/.+\/health-wiki-sample\/a\.svg$/);
  });
});

describe("jsonLdString", () => {
  it("escapes < so article text cannot close the script tag", () => {
    expect(jsonLdString({ headline: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("numbers items from 1", () => {
    const ld: any = buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Health Wiki", path: "/health" }]);
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
  });
});
