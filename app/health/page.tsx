import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getPublishedArticles } from "@/lib/health-wiki/server";
import { buildBreadcrumbJsonLd, jsonLdString } from "@/lib/health-wiki/seo";
import type { ArticleType } from "@/lib/health-wiki/types";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";
import ArticleCard from "@/components/health-wiki/ArticleCard";
import JoinCallout from "@/components/health-wiki/JoinCallout";
import TypeFilter, { type TypeFilterValue } from "@/components/health-wiki/TypeFilter";

// The root layout's title template appends "| Doctor Dekho"; do not repeat the brand here.
export const metadata: Metadata = {
  title: "Health Wiki — Medically Reviewed Guides",
  description:
    "Medically reviewed health guides written with verified doctors, plus updates on what is happening in the health sector, on Doctor Dekho.",
  // Filtered views share the main page's address for search engines.
  alternates: { canonical: "/health" },
  openGraph: { title: "Health Wiki", description: "Medically reviewed health guides and health-sector updates.", url: "/health", type: "website" },
};

export const revalidate = 300;

const FILTERS: Record<TypeFilterValue, ArticleType | null> = { all: null, medical: "MEDICAL", "sector-update": "SECTOR_UPDATE" };

const parseFilter = (v: string | string[] | undefined): TypeFilterValue => (v === "medical" || v === "sector-update" ? v : "all");

export default async function HealthWikiIndexPage({ searchParams }: { searchParams?: { type?: string | string[] } }) {
  const filter = parseFilter(searchParams?.type);
  const wanted = FILTERS[filter];
  const all = await getPublishedArticles();
  const articles = wanted ? all.filter((a) => a.type === wanted) : all;
  const hasSectorUpdates = all.some((a) => a.type === "SECTOR_UPDATE");

  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Health Wiki", path: "/health" },
  ]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbs) }} />
      <PatientTopBar wide />

      <main className="flex-1 pb-24">
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Link href="/" className="hover:text-brand-teal">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-slate-800" aria-current="page">Health Wiki</span>
            </nav>
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">Health Wiki</h1>
          <p className="text-lg text-slate-600 mb-8 max-w-3xl leading-relaxed">
            Medically reviewed guides on common conditions and symptoms, written with verified doctors
            {hasSectorUpdates ? ", plus updates on what is happening in the health sector" : ""}.
          </p>

          {hasSectorUpdates && <TypeFilter value={filter} />}

          {articles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <p className="font-display text-lg font-bold text-slate-900 mb-1">No articles here yet</p>
              <p className="text-sm text-slate-500 mb-4">New guides are added regularly.</p>
              {filter !== "all" && <Link href="/health" className="text-sm font-bold text-brand-teal hover:underline">See all articles</Link>}
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 list-none p-0">
              {articles.map((article, i) => (
                <li key={article.slug} className="flex">
                  <div className="flex w-full"><ArticleCard article={article} priority={i < 3} /></div>
                </li>
              ))}
            </ul>
          )}

          <JoinCallout />
        </div>
      </main>

      <PatientFooter />
    </div>
  );
}
