import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, BookOpen, Clock } from "lucide-react";
import { medicalArticles } from "@/data/wiki";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";

// Was a broken link on every /health/conditions/[condition] page's breadcrumb (that route
// linked to "/health", which didn't exist as a page — see that page's own breadcrumb). This is
// also the only place a reader can browse between wiki articles; previously there was no index
// at all.
// Not "... | Doctor Dekho" in the title/og title below — the root layout's title template
// already appends that brand suffix to every non-absolute title; adding it here too would
// double it up.
export const metadata: Metadata = {
  title: "Health Wiki — Medically Reviewed Guides",
  description:
    "Doctor-authored, medically reviewed health guides covering common conditions and symptoms — written and reviewed by verified specialists on Doctor Dekho.",
  alternates: { canonical: "/health" },
  openGraph: { title: "Health Wiki", description: "Doctor-authored, medically reviewed health guides.", url: "/health", type: "website" },
};

export default function HealthWikiIndexPage() {
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": "Health Wiki", "item": `${SITE_URL}/health` },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <PatientTopBar />

      <main className="flex-1 pb-24">
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Link href="/" className="hover:text-brand-teal">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-800">Health Wiki</span>
            </nav>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">Health Wiki</h1>
          <p className="text-lg text-slate-600 mb-10 leading-relaxed">
            Medically reviewed guides on common conditions and symptoms, written and reviewed by verified specialists.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {medicalArticles.map((article) => (
              <Link
                key={article.id}
                href={`/health/conditions/${article.id}`}
                className="block bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md hover:border-brand-teal/30 transition"
              >
                <BookOpen className="w-6 h-6 text-brand-teal mb-4" />
                <h2 className="font-display text-lg font-extrabold text-slate-900 mb-2 leading-snug">
                  {article.title}
                </h2>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">{article.description}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Updated {new Date(article.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <PatientFooter />
    </div>
  );
}
