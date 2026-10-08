// Server-only: reads published Health Wiki articles. Import from Server Components and route
// handlers only (it reaches the EasyHMS API through easyhmsFetch).

import { unstable_cache } from "next/cache";
import { easyhmsFetch, isConfigured } from "@/lib/api/server";
import type { HealthArticlesResponseDto } from "./dto";
import { getInterimArticles } from "./interim";
import { byNewest, mapArticles, mergeArticles } from "./mappers";
import { sampleArticles } from "./sample";
import type { HealthArticle } from "./types";

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

const fetchPublished = unstable_cache(
  async (): Promise<HealthArticle[]> => {
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
  },
  ["health-wiki-articles"],
  { revalidate: 300, tags: ["health-articles"] }
);

/** All published articles, newest first. */
export const getPublishedArticles = () => fetchPublished();

/** One published article, or null when the slug is unknown or not published. */
export async function getPublishedArticle(slug: string): Promise<HealthArticle | null> {
  const all = await fetchPublished();
  return all.find((a) => a.slug === slug) ?? null;
}
