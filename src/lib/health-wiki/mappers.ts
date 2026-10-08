import type { ArticlePersonDto, HealthArticleDto } from "./dto";
import {
  ARTICLE_SLUG_PATTERN,
  isDoctorKind,
  type ArticlePerson,
  type ArticleType,
  type ContributorKind,
  type HealthArticle,
} from "./types";

const KINDS: ContributorKind[] = ["HOSPITAL_DOCTOR", "INDEPENDENT_DOCTOR", "HEALTH_WORKER", "WRITER", "STAFF"];

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Images may come from the object store (https) or this site (/path). Anything else is dropped,
 * so a bad value in the data can never become a javascript:, data: or http: image source. */
export function safeImageUrl(url: unknown): string | null {
  const u = text(url);
  if (!u) return null;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  try {
    return new URL(u).protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

export function mapPerson(dto: ArticlePersonDto | null | undefined): ArticlePerson | null {
  const name = text(dto?.fullName);
  if (!dto || !name) return null;
  const kind = KINDS.includes(dto.type as ContributorKind) ? (dto.type as ContributorKind) : "WRITER";
  return {
    id: text(dto.id) ?? name,
    name,
    kind,
    speciality: text(dto.speciality),
    qualification: text(dto.qualification),
    roleTitle: text(dto.roleTitle),
    organisation: text(dto.organisation),
    photoUrl: safeImageUrl(dto.photoUrl),
    registrationNumber: text(dto.registrationNumber),
    registrationCouncil: text(dto.registrationCouncil),
    verified: dto.isRegistrationVerified === true,
  };
}

/**
 * Wire format to domain. Returns null for a row that cannot be shown (no slug, title or content).
 * Trust rules live here so no page can get them wrong:
 *  - a SECTOR_UPDATE never has a reviewer;
 *  - a MEDICAL article shows a reviewer only when that person is a verified doctor.
 */
export function mapArticle(dto: HealthArticleDto): HealthArticle | null {
  const slug = text(dto.id)?.toLowerCase() ?? null;
  const title = text(dto.title);
  const content = typeof dto.content === "string" ? dto.content : "";
  if (!slug || !ARTICLE_SLUG_PATTERN.test(slug) || !title || !content.trim()) return null;

  const type: ArticleType = dto.type === "SECTOR_UPDATE" ? "SECTOR_UPDATE" : "MEDICAL";
  const reviewerCandidate = mapPerson(dto.reviewer);
  const reviewer =
    type === "MEDICAL" && reviewerCandidate && isDoctorKind(reviewerCandidate.kind) && reviewerCandidate.verified
      ? reviewerCandidate
      : null;

  const updatedAt = text(dto.updatedAt) ?? text(dto.publishedAt) ?? new Date(0).toISOString();
  const cover = safeImageUrl(dto.coverImageUrl);

  return {
    slug,
    type,
    title,
    description: text(dto.description) ?? "",
    content,
    coverImageUrl: cover,
    coverImageAlt: cover ? text(dto.coverImageAlt) ?? "" : null,
    relatedConditionSlug: type === "MEDICAL" ? text(dto.relatedConditionSlug) : null,
    disclosure: text(dto.disclosure),
    references: (typeof dto.references === "string" ? dto.references : "")
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean),
    author: mapPerson(dto.author),
    reviewer,
    publishedAt: text(dto.publishedAt) ?? updatedAt,
    updatedAt,
  };
}

export function mapArticles(list: HealthArticleDto[] | undefined | null): HealthArticle[] {
  return (list ?? []).map(mapArticle).filter((a): a is HealthArticle => a !== null);
}

/** Newest first. */
export const byNewest = (a: HealthArticle, b: HealthArticle) => b.updatedAt.localeCompare(a.updatedAt);

/**
 * Live articles win over bundled ones with the same slug. Bundled (legacy) articles whose slug is
 * not in the live list stay, so pages that search engines already know do not vanish before the
 * content is moved into the CMS.
 */
export function mergeArticles(live: HealthArticle[], legacy: HealthArticle[]): HealthArticle[] {
  const liveSlugs = new Set(live.map((a) => a.slug));
  return [...live, ...legacy.filter((a) => !liveSlugs.has(a.slug))].sort(byNewest);
}
