import { SITE_URL } from "@/lib/site";
import type { MetadataRoute } from "next";
import { getAllDoctors } from "@/lib/api/server";
import { doctorSlug, specialties, CITIES, AREAS_BY_CITY } from "@/data/patient";
import { medicalArticles } from "@/data/wiki";

// Must be dynamic. As a statically prerendered route (the old `revalidate = 3600`) the sitemap runs
// at BUILD time, where the doctors fetch fails and the try/catch below swallows it, freezing a
// sitemap with only the home page into the image — the live nexeagle.com sitemap had the same
// problem (23 URLs, 0 doctor/specialty pages). At request time the fetch works, and
// getAllDoctors() is itself cached, so this stays cheap.
export const dynamic = "force-dynamic";

const BASE_URL = SITE_URL;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
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

    // Generate Health Wiki paths
    for (const article of medicalArticles) {
      pseoEntries.push({
        url: `${BASE_URL}/health/conditions/${article.id}`,
        lastModified: article.updatedAt ? new Date(article.updatedAt) : now,
        changeFrequency: "monthly",
        priority: 0.8, // High priority for YMYL informational content
      });
    }

  } catch {
    // Sitemap generation must never fail the build over a flaky upstream call.
  }

  return [...staticEntries, ...doctorEntries, ...pseoEntries];
}
