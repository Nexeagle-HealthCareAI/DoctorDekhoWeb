import Link from "next/link";
import { BookOpen, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/health-wiki/format";
import { articlePath } from "@/lib/health-wiki/seo";
import type { HealthArticle } from "@/lib/health-wiki/types";
import ArticleCover from "./ArticleCover";
import TypeBadge from "./TypeBadge";

export default function ArticleCard({ article, priority = false }: { article: HealthArticle; priority?: boolean }) {
  const { reviewer, author } = article;
  return (
    <Link
      href={articlePath(article.slug)}
      className="group flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md hover:border-brand-teal/30 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal"
    >
      {article.coverImageUrl ? (
        <ArticleCover src={article.coverImageUrl} alt="" priority={priority} />
      ) : (
        <div aria-hidden="true" className="w-full aspect-video bg-gradient-to-br from-brand-teal/15 to-brand-sky/15 flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-brand-teal/70" />
        </div>
      )}
      <div className="flex flex-col gap-3 p-5 flex-1">
        <TypeBadge type={article.type} />
        <h2 className="font-display text-lg font-extrabold text-slate-900 leading-snug group-hover:text-brand-teal transition-colors">{article.title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">{article.description}</p>
        <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          {reviewer ? (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Reviewed by {reviewer.name}
            </span>
          ) : author ? (
            <span>By {author.name}</span>
          ) : null}
          <span aria-hidden="true">·</span>
          <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
        </div>
      </div>
    </Link>
  );
}
