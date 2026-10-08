import { describe, expect, it } from "vitest";
import { legacyArticles } from "./legacy";
import { ARTICLE_SLUG_PATTERN } from "./types";

describe("bundled articles", () => {
  it("keep the slugs search engines already know", () => {
    expect(legacyArticles.map((a) => a.slug)).toEqual(expect.arrayContaining(["diabetes-type-2", "heart-attack-symptoms"]));
  });

  it("have valid slugs, content and a reviewer", () => {
    for (const a of legacyArticles) {
      expect(a.slug).toMatch(ARTICLE_SLUG_PATTERN);
      expect(a.content.length).toBeGreaterThan(50);
      expect(a.type).toBe("MEDICAL");
      expect(a.reviewer).not.toBeNull();
    }
  });
});
