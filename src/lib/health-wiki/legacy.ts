import { medicalArticles } from "@/data/wiki";
import { doctors } from "@/data/patient";
import type { ArticlePerson, HealthArticle } from "./types";

// The two articles that were hardcoded before the CMS existed. They stay available until their
// content is recreated in the CMS (a live article with the same slug replaces them, see
// mergeArticles). Delete this file and src/data/wiki.ts once that is done.

const asPerson = (id: string): ArticlePerson | null => {
  const d = doctors.find((x) => x.id === id);
  if (!d) return null;
  return {
    id: d.id,
    name: d.name,
    kind: "HOSPITAL_DOCTOR",
    speciality: d.specialty,
    qualification: d.qualifications,
    roleTitle: null,
    organisation: null,
    photoUrl: d.photo ?? null,
    registrationNumber: null,
    registrationCouncil: null,
    verified: true,
  };
};

export const legacyArticles: HealthArticle[] = medicalArticles.map((a) => ({
  slug: a.id,
  type: "MEDICAL",
  title: a.title,
  description: a.description,
  content: a.content.trim(),
  coverImageUrl: null,
  coverImageAlt: null,
  relatedConditionSlug: a.relatedConditionSlug,
  disclosure: null,
  references: [],
  author: asPerson(a.authorId),
  reviewer: asPerson(a.reviewerId),
  publishedAt: a.publishedAt,
  updatedAt: a.updatedAt,
}));
