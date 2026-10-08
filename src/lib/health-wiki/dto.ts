// Wire format of GET /public/health-articles and /public/health-articles/{id}.
// Contract: docs/health-wiki-api-contract.md. Every field except id, title and content is optional
// so the page keeps working while the backend adds fields in stages.

export interface ArticlePersonDto {
  id?: string;
  fullName?: string;
  /** HOSPITAL_DOCTOR | INDEPENDENT_DOCTOR | HEALTH_WORKER | WRITER | STAFF */
  type?: string;
  speciality?: string | null;
  qualification?: string | null;
  roleTitle?: string | null;
  organisation?: string | null;
  photoUrl?: string | null;
  registrationNumber?: string | null;
  registrationCouncil?: string | null;
  isRegistrationVerified?: boolean;
}

export interface HealthArticleDto {
  /** The article slug. */
  id?: string;
  /** MEDICAL | SECTOR_UPDATE. Missing means MEDICAL (the first release had only that type). */
  type?: string;
  title?: string;
  description?: string | null;
  content?: string;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  relatedConditionSlug?: string | null;
  disclosure?: string | null;
  /** One source per line. */
  references?: string | null;
  author?: ArticlePersonDto | null;
  reviewer?: ArticlePersonDto | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

export interface HealthArticlesResponseDto {
  articles?: HealthArticleDto[];
}
