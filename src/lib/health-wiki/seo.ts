import { SITE_URL } from "@/lib/site";
import { DESCRIPTION_MAX } from "@/lib/seo/titles";
import type { ArticlePerson, HealthArticle } from "./types";

export const articlePath = (slug: string) => `/health/conditions/${slug}`;

const absolute = (url: string) => (url.startsWith("/") ? `${SITE_URL}${url}` : url);

const person = (p: ArticlePerson, physician: boolean) => ({
  "@type": physician ? "Physician" : "Person",
  name: p.name,
  ...(p.photoUrl ? { image: absolute(p.photoUrl) } : {}),
  ...(p.organisation ? { affiliation: { "@type": "Organization", name: p.organisation } } : {}),
});

/** Markdown to plain words: no images, link addresses, heading marks, list markers or emphasis. */
const plain = (md: string) =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * What a search result and a shared link say about the article. The author's own description when there is
 * one; otherwise the opening of the text (skipping headings and pictures), cut at a word, so the page never
 * goes out with an empty description.
 */
export function articleDescription(a: Pick<HealthArticle, "description" | "content">): string {
  const own = a.description.trim();
  if (own) return own;
  const body = a.content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block && !block.startsWith("#") && !block.startsWith("!["))
    .map(plain)
    .filter(Boolean)
    .join(" ");
  if (body.length <= DESCRIPTION_MAX) return body;
  const cut = body.slice(0, DESCRIPTION_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/**
 * JSON-LD for an article page.
 * A MEDICAL article is a MedicalWebPage and names its reviewer. A SECTOR_UPDATE is a plain
 * NewsArticle: it is not medical content, so it must not claim medical types or a reviewer.
 */
export function buildArticleJsonLd(a: HealthArticle) {
  const base = {
    "@context": "https://schema.org",
    headline: a.title,
    description: articleDescription(a),
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
