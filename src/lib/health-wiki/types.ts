// Domain types for the Health Wiki. Components read only these, never the wire format
// (see dto.ts), so a change in the API stays inside mappers.ts.

export type ArticleType = "MEDICAL" | "SECTOR_UPDATE";

export const ARTICLE_TYPE_LABEL: Record<ArticleType, string> = {
  MEDICAL: "Medical",
  SECTOR_UPDATE: "Sector update",
};

export type ContributorKind = "HOSPITAL_DOCTOR" | "INDEPENDENT_DOCTOR" | "HEALTH_WORKER" | "WRITER" | "STAFF";

export const isDoctorKind = (k: ContributorKind) => k === "HOSPITAL_DOCTOR" || k === "INDEPENDENT_DOCTOR";

/** A person named on an article, as the public may see them. Never holds a mobile number or email. */
export interface ArticlePerson {
  id: string;
  name: string;
  kind: ContributorKind;
  speciality: string | null;
  qualification: string | null;
  roleTitle: string | null;
  organisation: string | null;
  photoUrl: string | null;
  registrationNumber: string | null;
  registrationCouncil: string | null;
  /** The registration was checked on the NMC register by our team. Only then may the reviewer badge show. */
  verified: boolean;
}

export interface HealthArticle {
  /** Public id, used in /health/conditions/{slug}. */
  slug: string;
  type: ArticleType;
  title: string;
  description: string;
  /** Markdown. Always render through ArticleBody, which sanitises it. */
  content: string;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  relatedConditionSlug: string | null;
  disclosure: string | null;
  references: string[];
  author: ArticlePerson | null;
  /** MEDICAL only, and only when the person is a verified doctor. Always null for a SECTOR_UPDATE. */
  reviewer: ArticlePerson | null;
  publishedAt: string;
  updatedAt: string;
}

export const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
