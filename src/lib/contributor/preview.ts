import type { HealthArticle } from "@/lib/health-wiki/types";
import type { ContributorMe, MyArticle } from "./types";

const lines = (v: string | null) => (v ?? "").split("\n").map((r) => r.trim()).filter(Boolean);

/**
 * Turns an article the contributor is looking at into the shape the public page components use, so
 * the preview is rendered by the same components as the live page.
 * `reviewerAs` is the person who will be named as reviewer: pass the signed-in doctor when they are
 * the reviewer. The badge is previewed as it will look once their registration is verified.
 */
export function toPreviewArticle(a: MyArticle, opts: { reviewerAs?: ContributorMe | null; authorAs?: ContributorMe | null } = {}): HealthArticle {
  const person = (m: ContributorMe, kind: "HOSPITAL_DOCTOR" | "INDEPENDENT_DOCTOR" | "HEALTH_WORKER" | "WRITER") => ({
    id: m.id, name: m.fullName, kind, speciality: m.speciality, qualification: m.qualification, roleTitle: m.roleTitle, organisation: m.organisation,
    photoUrl: null, registrationNumber: m.registrationNumber, registrationCouncil: m.registrationCouncil, verified: true,
  });
  const author = opts.authorAs
    ? person(opts.authorAs, opts.authorAs.role)
    : { id: "author", name: a.authorName, kind: "STAFF" as const, speciality: null, qualification: null, roleTitle: "NexEagle", organisation: null, photoUrl: null, registrationNumber: null, registrationCouncil: null, verified: false };
  const reviewer = a.type === "MEDICAL" && opts.reviewerAs ? person(opts.reviewerAs, opts.reviewerAs.role === "HOSPITAL_DOCTOR" ? "HOSPITAL_DOCTOR" : "INDEPENDENT_DOCTOR") : null;
  return {
    slug: a.slug,
    type: a.type,
    title: a.title,
    description: a.description,
    content: a.content,
    coverImageUrl: a.coverImageUrl,
    coverImageAlt: a.coverImageAlt,
    relatedConditionSlug: a.type === "MEDICAL" ? a.relatedConditionSlug : null,
    disclosure: a.disclosure,
    references: lines(a.references),
    author,
    reviewer,
    publishedAt: a.publishedAt ?? a.updatedAt,
    updatedAt: a.updatedAt,
  };
}
