import { CheckCircle, Clock, ShieldCheck } from "lucide-react";
import { formatDate, qualificationLine, registrationLine, roleLine } from "@/lib/health-wiki/format";
import type { HealthArticle } from "@/lib/health-wiki/types";
import PersonAvatar from "./PersonAvatar";

/**
 * Trust block under the article title.
 *  - MEDICAL with a verified reviewer: the "Medically reviewed by" badge with qualification and
 *    registration number.
 *  - SECTOR UPDATE (or a medical article with no verified reviewer): a plain "Written by" line.
 *    The reviewer badge never appears without a verified doctor behind it.
 */
export default function ArticleByline({ article }: { article: HealthArticle }) {
  const { author, reviewer } = article;
  const reg = reviewer ? registrationLine(reviewer) : null;
  const showAuthorToo = !!author && !!reviewer && author.id !== reviewer.id;

  return (
    <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
      <div className="flex flex-col gap-4 min-w-0">
        {reviewer ? (
          <div className="flex items-center gap-4">
            <PersonAvatar person={reviewer} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Medically reviewed by
              </p>
              <p className="text-sm font-bold text-slate-900">{reviewer.name}</p>
              <p className="text-xs text-slate-500 break-words">{qualificationLine(reviewer)}</p>
              {reg && <p className="text-xs text-slate-500 break-words">{reg}</p>}
            </div>
          </div>
        ) : null}

        {author && (!reviewer || showAuthorToo) ? (
          <div className="flex items-center gap-4">
            <PersonAvatar person={author} size={reviewer ? 36 : 48} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Written by</p>
              <p className="text-sm font-bold text-slate-900">{author.name}</p>
              <p className="text-xs text-slate-500">{roleLine(author) || qualificationLine(author)}</p>
            </div>
          </div>
        ) : null}

        {/* Written by the NexEagle team in the CMS: no contributor to name, but the box must not be empty. */}
        {!author && !reviewer ? (
          <div className="flex items-center gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Written by</p>
              <p className="text-sm font-bold text-slate-900">The NexEagle Health Wiki team</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden sm:block w-px bg-slate-200" aria-hidden="true" />

      <div className="flex flex-col justify-center gap-1">
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Updated <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
        </p>
        {reviewer && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-brand-teal" aria-hidden="true" /> Evidence based
          </p>
        )}
      </div>
    </div>
  );
}
