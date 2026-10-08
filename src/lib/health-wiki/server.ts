// Server-only: reads published Health Wiki articles. Import from Server Components and route
// handlers only (it reaches the EasyHMS API through easyhmsFetch).

import { unstable_cache } from "next/cache";
import { easyhmsFetch, isConfigured } from "@/lib/api/server";
import type { HealthArticlesResponseDto } from "./dto";
import { legacyArticles } from "./legacy";
import { byNewest, mapArticles, mergeArticles } from "./mappers";
import { sampleArticles } from "./sample";
import type { HealthArticle } from "./types";

const fetchPublished = unstable_cache(
  async (): Promise<HealthArticle[]> => {
    // Local design review: example articles instead of the API.
    if (process.env.HEALTH_WIKI_SAMPLE === "true") return [...sampleArticles].sort(byNewest);

    // No backend configured: only the bundled articles. They never needed the API.
    if (!isConfigured()) return [...legacyArticles].sort(byNewest);

    const result = await easyhmsFetch<HealthArticlesResponseDto>("/public/health-articles?pageSize=500");

    // 404 means the endpoint is not deployed on this backend yet: serve the bundled articles so
    // the pages search engines already know keep working.
    if (result.status === 404) return [...legacyArticles].sort(byNewest);

    // Any other failure is unexpected. Throwing lets unstable_cache keep serving its last good
    // value, and fails a cold build loudly (same policy as getAllDoctors in api/server.ts).
    if (!result.ok || !result.data) {
      throw new Error(`getPublishedArticles: live call failed (status ${result.status}).`);
    }
    return mergeArticles(mapArticles(result.data.articles), legacyArticles);
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
