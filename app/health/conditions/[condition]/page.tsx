import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Stethoscope } from "lucide-react";
import { SITE_URL } from "@/lib/site";
import { CITIES, cityId } from "@/data/patient";
import { getPublishedArticle, getPublishedArticles } from "@/lib/health-wiki/server";
import { articlePath, buildArticleJsonLd, buildBreadcrumbJsonLd, jsonLdString } from "@/lib/health-wiki/seo";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";
import ArticleBody from "@/components/health-wiki/ArticleBody";
import BackToEasyHms from "@/components/health-wiki/BackToEasyHms";
import ArticleByline from "@/components/health-wiki/ArticleByline";
import ArticleCover from "@/components/health-wiki/ArticleCover";
import { Disclosure, ReferencesList, SectorNotice } from "@/components/health-wiki/ArticleNotices";
import ArticleReactions from "@/components/health-wiki/ArticleReactions";
import RelatedArticles from "@/components/health-wiki/RelatedArticles";
import TypeBadge from "@/components/health-wiki/TypeBadge";

interface PageProps {
  params: { condition: string };
}

// Articles change when the content team publishes, not on every visit. The data call underneath
// is cached too (see getPublishedArticles), so this is cheap.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    return (await getPublishedArticles()).map((a) => ({ condition: a.slug }));
  } catch {
    // Build without a reachable API: pages are then rendered on first request instead.
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = await getPublishedArticle(params.condition);
  if (!article) return { title: "Not Found", robots: { index: false } };

  const url = articlePath(article.slug);
  return {
    // The root layout's title template already appends "| Doctor Dekho".
    title: `${article.title} | Health Wiki`,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      ...(article.coverImageUrl ? { images: [{ url: article.coverImageUrl, alt: article.coverImageAlt || article.title }] } : {}),
    },
    twitter: { card: article.coverImageUrl ? "summary_large_image" : "summary" },
  };
}

export default async function HealthArticlePage({ params }: PageProps) {
  const article = await getPublishedArticle(params.condition);
  if (!article) notFound();

  // Links into the site's real, currently served coverage area (see CITIES in data/patient.ts)
  // until location-based city detection replaces this.
  const primaryCity = CITIES.find((c) => c.name === "Purnea") ?? CITIES[0];
  const specialistHref = article.relatedConditionSlug
    ? `/conditions/${article.relatedConditionSlug}/${cityId(primaryCity.name, primaryCity.state)}`
    : "/";

  // Other articles, same type first, so each page leads on to related content.
  const others = (await getPublishedArticles()).filter((a) => a.slug !== article.slug);
  const related = [...others.filter((a) => a.type === article.type), ...others.filter((a) => a.type !== article.type)].slice(0, 4);

  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Health Wiki", path: "/health" },
    { name: article.title, path: articlePath(article.slug) },
  ]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(buildArticleJsonLd(article)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbs) }} />
      <PatientTopBar wide />

      <main className="flex-1 pb-24">
        <BackToEasyHms />
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Link href="/" className="hover:text-brand-teal shrink-0">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              <Link href="/health" className="hover:text-brand-teal whitespace-nowrap shrink-0">Health Wiki</Link>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-slate-800 truncate min-w-0" aria-current="page">{article.title}</span>
            </nav>
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_22rem] gap-8 lg:gap-12">
          <article className="min-w-0 bg-white rounded-3xl p-5 sm:p-10 border border-slate-200/80 shadow-sm">
            <div className="mb-4"><TypeBadge type={article.type} /></div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-5 break-words">{article.title}</h1>
            {article.description && <p className="text-lg text-slate-600 mb-8 leading-relaxed max-w-3xl">{article.description}</p>}

            {article.coverImageUrl && (
              <ArticleCover src={article.coverImageUrl} alt={article.coverImageAlt || article.title} priority className="rounded-2xl border border-slate-100 mb-8" />
            )}

            <ArticleByline article={article} />
            {/* The page is wide, but running text stays at a comfortable line length. */}
            <div className="max-w-3xl">
              {article.type === "SECTOR_UPDATE" && <SectorNotice />}
              {article.disclosure && <Disclosure text={article.disclosure} />}

              <ArticleBody markdown={article.content} />
              <ReferencesList items={article.references} />
              <ArticleReactions slug={article.slug} />
            </div>
          </article>

          <aside className="space-y-6 min-w-0">
            <div className="bg-gradient-to-br from-brand-teal to-emerald-600 rounded-3xl p-6 text-white shadow-xl lg:sticky lg:top-24">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-5 border border-white/20">
                <Stethoscope className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <h2 className="font-display text-2xl font-extrabold mb-2">{article.relatedConditionSlug ? "Need a Specialist?" : "Looking for a doctor?"}</h2>
              <p className="text-teal-50 text-sm mb-6 leading-relaxed">
                {article.relatedConditionSlug
                  ? <>Don&apos;t wait if you are experiencing symptoms of {article.relatedConditionSlug.replace(/-/g, " ")}. Consult with top-rated doctors near you instantly.</>
                  : <>Find verified doctors near you and book a visit in under a minute.</>}
              </p>
              <Link href={specialistHref} className="block w-full bg-white text-brand-teal text-center py-3.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition shadow-lg active:scale-[0.98]">
                Find Doctors Near Me
              </Link>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-teal-100">
                <ShieldCheck className="w-4 h-4" aria-hidden="true" /> 100% Verified Experts
              </div>
            </div>

            <RelatedArticles articles={related} />
          </aside>
        </div>
      </main>

      <PatientFooter />
    </div>
  );
}
