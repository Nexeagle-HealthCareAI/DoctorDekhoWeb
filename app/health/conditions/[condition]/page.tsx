import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, CheckCircle, Clock, ShieldCheck, Stethoscope } from "lucide-react";
import { medicalArticles } from "@/data/wiki";
import { doctors } from "@/data/patient";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";
import Image from "next/image";

interface PageProps {
  params: { condition: string };
}

export async function generateStaticParams() {
  return medicalArticles.map((article) => ({
    condition: article.id,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = medicalArticles.find((a) => a.id === params.condition);
  if (!article) return { title: "Not Found" };

  return {
    title: `${article.title} | NexEagle Health Wiki`,
    description: article.description,
    alternates: { canonical: `/health/conditions/${article.id}` },
    openGraph: { title: article.title, description: article.description, url: `/health/conditions/${article.id}`, type: "article" },
  };
}

export default function HealthArticlePage({ params }: PageProps) {
  const article = medicalArticles.find((a) => a.id === params.condition);
  if (!article) notFound();

  const author = doctors.find((d) => d.id === article.authorId);
  const reviewer = doctors.find((d) => d.id === article.reviewerId);

  // Pillar 4: MedicalWebPage & Article Schema
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["MedicalWebPage", "Article"],
    "headline": article.title,
    "description": article.description,
    "datePublished": article.publishedAt,
    "dateModified": article.updatedAt,
    ...(author ? {
      "author": {
        "@type": "Physician",
        "name": author.name,
        "url": `${SITE_URL}/doctors/${author.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      }
    } : {}),
    ...(reviewer ? {
      "reviewedBy": {
        "@type": "Physician",
        "name": reviewer.name,
        "url": `${SITE_URL}/doctors/${reviewer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      }
    } : {}),
    "about": {
      "@type": "MedicalCondition",
      "name": article.relatedConditionSlug
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PatientTopBar />

      <main className="flex-1 pb-24">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Link href="/" className="hover:text-brand-teal">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href="/health" className="hover:text-brand-teal">Health Wiki</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-800 truncate">{article.title}</span>
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12">
          
          {/* LEFT: Article Content */}
          <article className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-sm">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-6">
              {article.title}
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              {article.description}
            </p>

            {/* E-E-A-T Trust Signals Badge */}
            <div className="flex flex-col sm:flex-row gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 mb-10">
              {reviewer && (
                <div className="flex items-center gap-4">
                  {reviewer.photo ? (
                    <Image src={reviewer.photo} alt={reviewer.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                  ) : (
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${reviewer.gradient} text-white flex items-center justify-center font-bold`}>
                      {reviewer.initials}
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Medically Reviewed By
                    </p>
                    <p className="text-sm font-bold text-slate-900">{reviewer.name}</p>
                    <p className="text-xs text-slate-500">{reviewer.qualifications} • {reviewer.specialty}</p>
                  </div>
                </div>
              )}
              <div className="hidden sm:block w-px bg-slate-200"></div>
              <div className="flex flex-col justify-center">
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                  <Clock className="w-3.5 h-3.5" /> Updated {new Date(article.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-brand-teal" /> Evidence Based
                </p>
              </div>
            </div>

            {/* Prose Content Mock (We format the raw markdown slightly for display) */}
            <div 
              className="prose prose-slate max-w-none prose-headings:font-display prose-headings:font-bold prose-h2:text-2xl prose-h2:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600"
              dangerouslySetInnerHTML={{
                __html: article.content
                  .replace(/## (.*)/g, '<h2 class="mt-8 mb-4 border-b border-slate-100 pb-2">$1</h2>')
                  .replace(/\* \*\*(.*?)\*\*(.*)/g, '<li class="mb-2"><strong class="text-slate-900">$1</strong>$2</li>')
                  .replace(/\* (.*)/g, '<li class="mb-2">$1</li>')
                  .replace(/\n\n/g, '<br/><br/>')
              }}
            />
          </article>

          {/* RIGHT: Transactional Funnel (Pillar 3) */}
          <aside className="space-y-6">
            <div className="bg-gradient-to-br from-brand-teal to-emerald-600 rounded-3xl p-6 text-white shadow-xl lg:sticky lg:top-24">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-5 border border-white/20">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display text-2xl font-extrabold mb-2">Need a Specialist?</h3>
              <p className="text-teal-50 text-sm mb-6 leading-relaxed">
                Don&apos;t wait if you are experiencing symptoms of {article.relatedConditionSlug.replace(/-/g, " ")}. Consult with top-rated doctors near you instantly.
              </p>
              <Link 
                href={`/conditions/${article.relatedConditionSlug}/mumbai-maharashtra`} // Example city fallback, ideally dynamic by geo IP
                className="block w-full bg-white text-brand-teal text-center py-3.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition shadow-lg active:scale-[0.98]"
              >
                Find Doctors Near Me
              </Link>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-teal-100">
                <ShieldCheck className="w-4 h-4" /> 100% Verified Experts
              </div>
            </div>
          </aside>
          
        </div>
      </main>

      <PatientFooter />
    </div>
  );
}
