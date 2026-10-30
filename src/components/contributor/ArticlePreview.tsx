import type { HealthArticle } from "@/lib/health-wiki/types";
import ArticleBody from "@/components/health-wiki/ArticleBody";
import ArticleByline from "@/components/health-wiki/ArticleByline";
import ArticleCover from "@/components/health-wiki/ArticleCover";
import { Disclosure, ReferencesList, SectorNotice } from "@/components/health-wiki/ArticleNotices";
import TypeBadge from "@/components/health-wiki/TypeBadge";
import { card } from "./ui";

/** The article as readers will see it: the same components the public page uses. */
export default function ArticlePreview({ article }: { article: HealthArticle }) {
  return (
    <article className={`${card} p-5 sm:p-8 min-w-0`}>
      <div className="mb-4"><TypeBadge type={article.type} /></div>
      <h2 className="font-display text-3xl font-extrabold text-slate-900 leading-tight mb-4 break-words">{article.title || "Untitled"}</h2>
      {article.description && <p className="text-lg text-slate-600 mb-6 leading-relaxed">{article.description}</p>}
      {article.coverImageUrl && <ArticleCover src={article.coverImageUrl} alt={article.coverImageAlt ?? ""} className="rounded-2xl border border-slate-100 mb-6" />}
      <ArticleByline article={article} />
      {article.type === "SECTOR_UPDATE" && <SectorNotice />}
      {article.disclosure && <Disclosure text={article.disclosure} />}
      <ArticleBody markdown={article.content} />
      <ReferencesList items={article.references} />
    </article>
  );
}
