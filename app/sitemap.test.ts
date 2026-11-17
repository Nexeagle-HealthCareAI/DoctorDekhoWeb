import { describe, expect, it, vi } from "vitest";
import { mapDoctor } from "@/lib/api/mappers";

const dto = (id: string, department: string, city: string, state: string) =>
  ({ doctorId: id, fullName: `Dr ${id}`, departmentName: department, specializations: [], city, state }) as Parameters<typeof mapDoctor>[0];

vi.mock("@/lib/api/server", () => ({
  getAllDoctors: async () => ({ doctors: [mapDoctor(dto("a1", "Urology", "Purnea", "Bihar")), mapDoctor(dto("b2", "Pediatrics", "Kishanganj", "Bihar"))] }),
  getAllLabs: async () => ({ labs: [] }),
}));
vi.mock("@/lib/health-wiki/server", () => ({
  getPublishedArticles: async () => [{ slug: "kidney-stones", updatedAt: "2026-11-17T04:00:02.271Z" }],
}));

describe("sitemap", () => {
  it("lists a speciality page only where a doctor is, and never a city that has none", async () => {
    const sitemap = (await import("./sitemap")).default;
    const urls = (await sitemap()).map((e) => e.url.replace(/^https?:\/\/[^/]+/, ""));
    expect(urls).toContain("/specialties/urology/purnea-bihar");
    expect(urls).toContain("/specialties/pediatrics/kishanganj-bihar");
    expect(urls).not.toContain("/specialties/cardiology/purnea-bihar");
    expect(urls).not.toContain("/specialties/urology/kolkata-west-bengal");
    expect(urls.filter((u) => u.startsWith("/specialties") || u.startsWith("/conditions")).length).toBeLessThan(20);
  });

  it("gives a last-modified date only where there is a real one (the articles), not 'now' for everything", async () => {
    const sitemap = (await import("./sitemap")).default;
    const entries = await sitemap();
    const byPath = (p: string) => entries.find((e) => e.url.endsWith(p));
    expect(byPath("/health/conditions/kidney-stones")?.lastModified).toEqual(new Date("2026-11-17T04:00:02.271Z"));
    expect(byPath("/")?.lastModified).toBeUndefined();
    expect(entries.find((e) => e.url.includes("/doctors/"))?.lastModified).toBeUndefined();
    expect(entries.find((e) => e.url.includes("/specialties/urology/purnea-bihar"))?.lastModified).toBeUndefined();
  });
});
