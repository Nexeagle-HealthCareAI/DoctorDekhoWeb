import { SITE_URL } from "@/lib/site";
import type { MetadataRoute } from "next";
import { getAllDoctors, getAllLabs } from "@/lib/api/server";
import { doctorSlug, specialties, CITIES, AREAS_BY_CITY } from "@/data/patient";
import { labSlug } from "@/data/labs";
import { getPublishedArticles } from "@/lib/health-wiki/server";
import { articlePath } from "@/lib/health-wiki/seo";

// Must be dynamic. As a statically prerendered route (the old `revalidate = 3600`) the sitemap runs
// at BUILD time, where the doctors fetch fails and the try/catch below swallows it, freezing a
// sitemap with only the home page into the image — the live nexeagle.com sitemap had the same
// problem (23 URLs, 0 doctor/specialty pages). At request time the fetch works, and
// getAllDoctors() is itself cached, so this stays cheap.
export const dynamic = "force-dynamic";

const BASE_URL = SITE_URL;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/hospitals", priority: 0.6, changeFrequency: "weekly" },
  { path: "/labs", priority: 0.6, changeFrequency: "weekly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  let doctorEntries: MetadataRoute.Sitemap = [];
  let pseoEntries: MetadataRoute.Sitemap = [];

  try {
    const { doctors } = await getAllDoctors();
    doctorEntries = doctors.map((d) => ({
      url: `${BASE_URL}/doctors/${doctorSlug(d, d.city)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    // Generate Programmatic SEO links (Specialties, Cities, Conditions)
    const conditionSet = new Set<string>();
    for (const d of doctors) {
      for (const f of d.focusAreas) {
        conditionSet.add(f.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
      }
    }

    const conditions = Array.from(conditionSet);

    for (const s of specialties) {
      pseoEntries.push({
        url: `${BASE_URL}/specialties/${s.id}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
      for (const c of CITIES) {
        pseoEntries.push({
          url: `${BASE_URL}/specialties/${s.id}/${c.id}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.8,
        });

        const areas = AREAS_BY_CITY[c.id] || [];
        for (const a of areas) {
          const areaSlug = a.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          pseoEntries.push({
            url: `${BASE_URL}/specialties/${s.id}/${c.id}/${areaSlug}`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.9, // Higher priority for hyper-local intent
          });
        }
      }
    }

    for (const cond of conditions) {
      for (const c of CITIES) {
        pseoEntries.push({
          url: `${BASE_URL}/conditions/${cond}/${c.id}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.8,
        });
        
        const areas = AREAS_BY_CITY[c.id] || [];
        for (const a of areas) {
          const areaSlug = a.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          pseoEntries.push({
            url: `${BASE_URL}/conditions/${cond}/${c.id}/${areaSlug}`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.9, // Higher priority for hyper-local intent
          });
        }
      }
    }

    // Generate Hospital paths
    const hospitalSet = new Set<string>();
    for (const d of doctors) {
      if (d.hospitalName) {
        hospitalSet.add(d.hospitalName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
      }
    }

    for (const hospital of Array.from(hospitalSet)) {
      pseoEntries.push({
        url: `${BASE_URL}/hospitals/${hospital}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

  } catch (err) {
    // Sitemap generation must never fail the build over a flaky upstream call — but silently
    // swallowing this is exactly what produced the 23-URL/0-doctor-page incident this file's
    // own history describes, so at minimum surface it in server logs/monitoring.
    console.error("[sitemap] doctor/pSEO entry generation failed; sitemap will be missing these URLs:", err);
  }

  // Isolated from the block above: a labs API failure shouldn't also wipe out the doctor/pSEO
  // entries that already succeeded (previously labs were never in the sitemap at all, despite
  // /labs and /labs/[labSlug] having full metadata/canonical support).
  let labEntries: MetadataRoute.Sitemap = [];
  try {
    const { labs } = await getAllLabs();
    labEntries = labs.map((l) => ({
      url: `${BASE_URL}/labs/${labSlug(l, l.city)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));
  } catch (err) {
    console.error("[sitemap] lab entry generation failed; sitemap will be missing lab pages:", err);
  }

  // Health Wiki: its own block, so a Health Wiki API failure cannot drop the doctor or lab URLs.
  let wikiEntries: MetadataRoute.Sitemap = [];
  try {
    const articles = await getPublishedArticles();
    wikiEntries = [
      { url: `${BASE_URL}/health`, lastModified: articles[0] ? new Date(articles[0].updatedAt) : now, changeFrequency: "weekly", priority: 0.7 },
      ...articles.map((a) => ({
        url: `${BASE_URL}${articlePath(a.slug)}`,
        lastModified: new Date(a.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.8, // High priority for YMYL informational content
      })),
    ];
  } catch (err) {
    console.error("[sitemap] Health Wiki entry generation failed; sitemap will be missing these URLs:", err);
  }

  return [...staticEntries, ...doctorEntries, ...pseoEntries, ...labEntries, ...wikiEntries];
}
