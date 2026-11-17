import { describe, expect, it } from "vitest";
import { articleDescription, buildArticleJsonLd, buildBreadcrumbJsonLd, jsonLdString } from "./seo";
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

describe("articleDescription", () => {
  it("uses the author's own description when there is one", () => {
    expect(articleDescription({ description: "  Written by hand.  ", content: "# H\n\nBody text." })).toBe("Written by hand.");
  });

  it("falls back to the opening of the text, skipping headings and pictures", () => {
    const content = "# Kidney stones\n\n![Stone](https://x.y/s.webp)\n\nKidney stones are **hard deposits** of [salt and minerals](https://who.int) that form in the kidney.\n\n## Causes\n\nNot enough water.";
    const d = articleDescription({ description: "", content });
    expect(d.startsWith("Kidney stones are hard deposits of salt and minerals that form in the kidney.")).toBe(true);
    expect(d).not.toMatch(/[#*\]\[(]|https/);
  });

  it("cuts a long opening at a word, within the limit, with an ellipsis", () => {
    const d = articleDescription({ description: "", content: "word ".repeat(200) });
    expect(d.length).toBeLessThanOrEqual(155);
    expect(d.endsWith("…")).toBe(true);
    expect(d.endsWith(" …")).toBe(false);
  });

  it("is what the article's JSON-LD carries, so it is never empty", () => {
    const ld: any = buildArticleJsonLd(article({ description: "", content: "The first paragraph of the article." }));
    expect(ld.description).toBe("The first paragraph of the article.");
  });
});
