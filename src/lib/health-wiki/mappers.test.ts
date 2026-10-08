import { describe, expect, it } from "vitest";
import { mapArticle, mapArticles, mergeArticles, safeImageUrl } from "./mappers";
import type { HealthArticleDto } from "./dto";
import type { HealthArticle } from "./types";

const doctor = { id: "d1", fullName: "Dr. Meera Nair", type: "HOSPITAL_DOCTOR", qualification: "MBBS, MD", speciality: "Endocrinologist", registrationNumber: "48213", registrationCouncil: "Delhi Medical Council", isRegistrationVerified: true };
const base: HealthArticleDto = { id: "diabetes-type-2", title: "Understanding Type 2 Diabetes", content: "## Hello", updatedAt: "2026-09-29T10:00:00Z" };

describe("mapArticle", () => {
  it("maps a complete article", () => {
    const a = mapArticle({ ...base, type: "MEDICAL", description: "Guide", reviewer: doctor, author: { fullName: "Content team", type: "STAFF" }, relatedConditionSlug: "diabetes", references: "WHO fact sheet\n\n ICMR guidance " })!;
    expect(a.slug).toBe("diabetes-type-2");
    expect(a.reviewer?.name).toBe("Dr. Meera Nair");
    expect(a.references).toEqual(["WHO fact sheet", "ICMR guidance"]);
    expect(a.relatedConditionSlug).toBe("diabetes");
  });

  it("treats a missing type as MEDICAL, because the first release had only that type", () => {
    expect(mapArticle(base)!.type).toBe("MEDICAL");
  });

  it.each([
    ["no slug", { ...base, id: undefined }],
    ["bad slug", { ...base, id: "Has Spaces" }],
    ["no title", { ...base, title: "  " }],
    ["no content", { ...base, content: "   " }],
  ])("drops a row with %s", (_name, dto) => {
    expect(mapArticle(dto as HealthArticleDto)).toBeNull();
  });

  it("never gives a SECTOR_UPDATE a reviewer or a condition, even if the data has them", () => {
    const a = mapArticle({ ...base, type: "SECTOR_UPDATE", reviewer: doctor, relatedConditionSlug: "diabetes" })!;
    expect(a.reviewer).toBeNull();
    expect(a.relatedConditionSlug).toBeNull();
  });

  it("drops a MEDICAL reviewer whose registration is not verified", () => {
    expect(mapArticle({ ...base, reviewer: { ...doctor, isRegistrationVerified: false } })!.reviewer).toBeNull();
    expect(mapArticle({ ...base, reviewer: { ...doctor, isRegistrationVerified: undefined } })!.reviewer).toBeNull();
  });

  it("drops a reviewer who is not a doctor", () => {
    expect(mapArticle({ ...base, reviewer: { ...doctor, type: "WRITER" } })!.reviewer).toBeNull();
  });

  it("keeps a verified independent doctor as reviewer", () => {
    expect(mapArticle({ ...base, reviewer: { ...doctor, type: "INDEPENDENT_DOCTOR" } })!.reviewer?.kind).toBe("INDEPENDENT_DOCTOR");
  });

  it("keeps the alt text only when there is a cover", () => {
    expect(mapArticle({ ...base, coverImageUrl: "https://cdn.example.com/a.jpg", coverImageAlt: "A heart" })!.coverImageAlt).toBe("A heart");
    expect(mapArticle({ ...base, coverImageUrl: "javascript:alert(1)", coverImageAlt: "x" })!.coverImageAlt).toBeNull();
  });

  it("falls back to the published date, then to a fixed date, for updatedAt", () => {
    expect(mapArticle({ ...base, updatedAt: undefined, publishedAt: "2026-01-01T00:00:00Z" })!.updatedAt).toBe("2026-01-01T00:00:00Z");
    expect(mapArticle({ ...base, updatedAt: undefined })!.updatedAt).toBe(new Date(0).toISOString());
  });
});

describe("safeImageUrl", () => {
  it.each([
    ["https://cdn.example.com/a.png", "https://cdn.example.com/a.png"],
    ["/health-wiki-sample/a.svg", "/health-wiki-sample/a.svg"],
    ["http://cdn.example.com/a.png", null],
    ["//evil.example.com/a.png", null],
    ["javascript:alert(1)", null],
    ["data:image/png;base64,AAAA", null],
    ["", null],
    [undefined, null],
  ])("%s -> %s", (input, expected) => {
    expect(safeImageUrl(input)).toBe(expected);
  });
});

describe("mapArticles / mergeArticles", () => {
  const art = (slug: string, updatedAt: string, title = slug): HealthArticle => ({
    slug, type: "MEDICAL", title, description: "", content: "x", coverImageUrl: null, coverImageAlt: null, relatedConditionSlug: null,
    disclosure: null, references: [], author: null, reviewer: null, publishedAt: updatedAt, updatedAt,
  });

  it("skips rows that cannot be shown", () => {
    expect(mapArticles([base, { id: "x" } as HealthArticleDto])).toHaveLength(1);
    expect(mapArticles(undefined)).toEqual([]);
  });

  it("lets a live article replace a bundled one with the same slug, and keeps the other bundled ones", () => {
    const merged = mergeArticles([art("a", "2026-10-02T00:00:00Z", "live a")], [art("a", "2023-01-01T00:00:00Z", "old a"), art("b", "2024-01-01T00:00:00Z")]);
    expect(merged.map((m) => m.title)).toEqual(["live a", "b"]);
  });

  it("sorts newest first", () => {
    const merged = mergeArticles([art("old", "2025-01-01T00:00:00Z"), art("new", "2026-01-01T00:00:00Z")], []);
    expect(merged.map((m) => m.slug)).toEqual(["new", "old"]);
  });
});
