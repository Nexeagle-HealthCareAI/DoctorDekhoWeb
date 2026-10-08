// Pure mapping from the interim admin tool's stored article to the Health Wiki model.
// No file or network access here, so it can be tested on its own (see interim.ts for the reading).

import type { Doctor } from "@/data/patient";
import type { WikiArticle } from "@/lib/wikiStore";
import type { ArticlePerson, HealthArticle } from "./types";

// The admin tool picks authors and reviewers from the doctor directory, so every one of them is a
// doctor. Whether the reviewer badge shows depends on the directory's own verification flag.
const asPerson = (d: Doctor | undefined): ArticlePerson | null =>
  d
    ? {
        id: d.id,
        name: d.name,
        kind: "HOSPITAL_DOCTOR",
        speciality: d.specialty || null,
        qualification: d.qualifications || null,
        roleTitle: null,
        organisation: null,
        photoUrl: d.photo ?? null,
        registrationNumber: null,
        registrationCouncil: null,
        verified: d.verified === true,
      }
    : null;

export function mapStoredArticle(a: WikiArticle, doctors: Doctor[]): HealthArticle {
  const byId = (id?: string) => asPerson(doctors.find((d) => d.id === id));
  const published = a.publishedAt ?? a.createdAt;
  return {
    slug: a.id,
    type: "MEDICAL",
    title: a.title,
    description: a.description,
    content: a.content.trim(),
    coverImageUrl: null,
    coverImageAlt: null,
    relatedConditionSlug: a.relatedConditionSlug || null,
    disclosure: null,
    references: [],
    author: byId(a.authorId),
    reviewer: byId(a.reviewerId),
    publishedAt: published,
    updatedAt: a.updatedAt ?? published,
  };
}
