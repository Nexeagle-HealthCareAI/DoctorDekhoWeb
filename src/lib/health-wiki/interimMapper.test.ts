import { describe, expect, it } from "vitest";
import { mapStoredArticle } from "./interimMapper";
import type { Doctor } from "@/data/patient";
import type { WikiArticle } from "@/lib/wikiStore";

const doctor = (over: Partial<Doctor>): Doctor =>
  ({ id: "1", name: "Dr. Ananya Sen", gradient: "", initials: "AS", specialtyId: "x", specialty: "Cardiologist", qualifications: "MBBS", experienceYears: 5, city: "", state: "", verified: true, ...over }) as Doctor;

const stored: WikiArticle = {
  id: "diabetes-type-2", title: "Understanding Type 2 Diabetes", description: "Guide", content: "\n## Hello\n",
  relatedConditionSlug: "diabetes", authorId: "1", reviewerId: "3", status: "published",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-02-01T00:00:00Z", publishedAt: "2026-01-15T00:00:00Z",
};

describe("mapStoredArticle", () => {
  it("maps an article from the interim admin tool", () => {
    const a = mapStoredArticle(stored, [doctor({ id: "1" }), doctor({ id: "3", name: "Dr. Priya Sharma" })]);
    expect(a.slug).toBe("diabetes-type-2");
    expect(a.type).toBe("MEDICAL");
    expect(a.content).toBe("## Hello");
    expect(a.author?.name).toBe("Dr. Ananya Sen");
    expect(a.reviewer?.name).toBe("Dr. Priya Sharma");
    expect(a.publishedAt).toBe("2026-01-15T00:00:00Z");
    expect(a.updatedAt).toBe("2026-02-01T00:00:00Z");
  });

  it("shows no reviewer when the directory does not list that doctor any more", () => {
    expect(mapStoredArticle(stored, [doctor({ id: "1" })]).reviewer).toBeNull();
  });

  it("carries the directory's verification flag, so the badge needs a verified doctor", () => {
    const a = mapStoredArticle(stored, [doctor({ id: "3", verified: false })]);
    expect(a.reviewer?.verified).toBe(false);
  });
});
