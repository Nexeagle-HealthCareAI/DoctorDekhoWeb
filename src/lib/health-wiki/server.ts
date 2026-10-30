// Server-only: reads published Health Wiki articles. Import from Server Components and route
// handlers only (it reaches the EasyHMS API through easyhmsFetch).

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { easyhmsFetch, isConfigured } from "@/lib/api/server";
import { isContributorMock } from "@/lib/contributor/session";
import type { HealthArticleDto, HealthArticlesResponseDto } from "./dto";
import { getInterimArticles } from "./interim";
import { byNewest, mapArticle, mapArticles, mergeArticles } from "./mappers";
import { sampleArticles } from "./sample";
import { ARTICLE_SLUG_PATTERN, type HealthArticle } from "./types";

/**
 * Interim (admin tool) articles. When they are the only source, a read failure must not turn into
 * an empty list (that would replace good cached pages with "no articles"), so it is rethrown and
 * the last good value keeps being served. When the live API answered, they are only a fallback for
 * slugs the API does not have yet, so a failure is logged and the live articles are still shown.
 */
async function interimArticles(soleSource: boolean): Promise<HealthArticle[]> {
  try {
    return await getInterimArticles();
  } catch (err) {
    if (soleSource) throw err;
    console.error("[health-wiki] interim articles could not be read; showing live articles only:", err);
    return [];
  }
}

/** Local example backend (CONTRIBUTOR_MOCK=true): what a doctor publishes there is listed too, so the whole flow can be tried on one machine. */
async function withExampleContributorArticles(list: HealthArticle[]): Promise<HealthArticle[]> {
  if (!isContributorMock()) return list;
  const { publishedForPublic } = await import("@/lib/contributor/mockStore");
  return mergeArticles(mapArticles(publishedForPublic()), list);
}

const fetchPublished = unstable_cache(
  async (): Promise<HealthArticle[]> => withExampleContributorArticles(await fetchPublishedFromSource()),
  ["health-wiki-articles"],
  { revalidate: 300, tags: ["health-articles"] }
);

async function fetchPublishedFromSource(): Promise<HealthArticle[]> {
  // Local design review: example articles instead of the API.
  if (process.env.HEALTH_WIKI_SAMPLE === "true") return [...sampleArticles].sort(byNewest);

  // No backend configured: only the interim admin-tool articles.
  if (!isConfigured()) return (await interimArticles(true)).sort(byNewest);

  const result = await easyhmsFetch<HealthArticlesResponseDto>("/public/health-articles?pageSize=500");

  // 404 means the endpoint is not deployed on this backend yet: serve the interim articles so
  // the pages search engines already know keep working.
  if (result.status === 404) return (await interimArticles(true)).sort(byNewest);

  // Any other failure is unexpected. Throwing lets unstable_cache keep serving its last good
  // value, and fails a cold build loudly (same policy as getAllDoctors in api/server.ts).
  if (!result.ok || !result.data) {
    throw new Error(`getPublishedArticles: live call failed (status ${result.status}).`);
  }
  return mergeArticles(mapArticles(result.data.articles), await interimArticles(false));
}

/** All published articles, newest first. */
export const getPublishedArticles = () => fetchPublished();

/**
 * One article asked for by its slug straight from the backend, not from the cached list. An article published a moment ago (a doctor
 * approving it in EasyHMS, or the team publishing it in the CMS) is not in the cached list yet, and Doctor Dekho would answer 404 for it
 * (and keep that answer for five minutes). Only a slug that looks like a slug is asked for.
 */
const fetchOnePublished = cache(async (slug: string): Promise<HealthArticle | null> => {
  if (!isConfigured() || process.env.HEALTH_WIKI_SAMPLE === "true" || !ARTICLE_SLUG_PATTERN.test(slug)) return null;
  const result = await easyhmsFetch<HealthArticleDto>(`/public/health-articles/${encodeURIComponent(slug)}`, { cache: "no-store" });
  return result.ok && result.data ? mapArticle(result.data) : null;
});

/** One published article, or null when the slug is unknown or not published. */
export async function getPublishedArticle(slug: string): Promise<HealthArticle | null> {
  const all = await fetchPublished();
  return all.find((a) => a.slug === slug) ?? (await fetchOnePublished(slug));
}
