import Link from "next/link";
import { BookOpen } from "lucide-react";
import { articlePath } from "@/lib/health-wiki/seo";
import type { HealthArticle } from "@/lib/health-wiki/types";
import TypeBadge from "./TypeBadge";

export default function RelatedArticles({ articles }: { articles: HealthArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby="more-wiki-heading" className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
      <h2 id="more-wiki-heading" className="font-display text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-brand-teal" aria-hidden="true" /> More from the Health Wiki
      </h2>
      <div className="space-y-3">
        {articles.map((a) => (
          <Link key={a.slug} href={articlePath(a.slug)} className="block p-3 rounded-xl border border-slate-100 hover:border-brand-teal/30 hover:bg-slate-50 transition">
            <div className="mb-1.5"><TypeBadge type={a.type} /></div>
            <p className="text-sm font-bold text-slate-800 leading-snug">{a.title}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.description}</p>
          </Link>
        ))}
      </div>
      <Link href="/health" className="block mt-4 text-xs font-bold text-brand-teal hover:underline">View all Health Wiki articles →</Link>
    </section>
  );
}
