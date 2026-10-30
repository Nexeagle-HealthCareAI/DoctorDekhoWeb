// Articles written in the interim admin tool (app/admin/health-wiki, stored in
// src/data/wiki-articles.json by src/lib/wikiStore.ts). They are the fallback source until the
// content team has recreated them in the CMS: a live article with the same slug replaces them
// (see mergeArticles). Delete this file, interimMapper.ts, wikiStore.ts, the admin pages and the
// JSON file once that is done.
//
// Server-only: it reads the JSON file and the doctor directory.

import { getAllDoctors } from "@/lib/api/server";
import { getPublishedArticles as getStoredArticles } from "@/lib/wikiStore";
import { mapStoredArticle } from "./interimMapper";
import type { HealthArticle } from "./types";

export async function getInterimArticles(): Promise<HealthArticle[]> {
  const [stored, { doctors }] = await Promise.all([getStoredArticles(), getAllDoctors()]);
  return stored.map((a) => mapStoredArticle(a, doctors));
}
