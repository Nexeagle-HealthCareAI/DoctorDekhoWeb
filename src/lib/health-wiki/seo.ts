import { SITE_URL } from "@/lib/site";
import type { ArticlePerson, HealthArticle } from "./types";

export const articlePath = (slug: string) => `/health/conditions/${slug}`;

const absolute = (url: string) => (url.startsWith("/") ? `${SITE_URL}${url}` : url);

const person = (p: ArticlePerson, physician: boolean) => ({
  "@type": physician ? "Physician" : "Person",
  name: p.name,
  ...(p.photoUrl ? { image: absolute(p.photoUrl) } : {}),
  ...(p.organisation ? { affiliation: { "@type": "Organization", name: p.organisation } } : {}),
});

/**
 * JSON-LD for an article page.
 * A MEDICAL article is a MedicalWebPage and names its reviewer. A SECTOR_UPDATE is a plain
 * NewsArticle: it is not medical content, so it must not claim medical types or a reviewer.
 */
export function buildArticleJsonLd(a: HealthArticle) {
  const base = {
    "@context": "https://schema.org",
    headline: a.title,
    description: a.description,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
    mainEntityOfPage: `${SITE_URL}${articlePath(a.slug)}`,
    ...(a.coverImageUrl ? { image: absolute(a.coverImageUrl) } : {}),
    ...(a.author ? { author: person(a.author, a.type === "MEDICAL" && a.author.kind !== "WRITER" && a.author.kind !== "HEALTH_WORKER" && a.author.kind !== "STAFF") } : {}),
  };

  if (a.type === "SECTOR_UPDATE") return { ...base, "@type": "NewsArticle" };

  return {
    ...base,
    "@type": ["MedicalWebPage", "Article"],
    ...(a.reviewer ? { reviewedBy: person(a.reviewer, true), lastReviewed: a.updatedAt } : {}),
    ...(a.relatedConditionSlug ? { about: { "@type": "MedicalCondition", name: a.relatedConditionSlug.replace(/-/g, " ") } } : {}),
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

/** JSON for a <script type="application/ld+json">. "<" is escaped so article text cannot close the tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
