import { ARTICLE_TYPE_LABEL, type ArticleType } from "@/lib/health-wiki/types";

const STYLE: Record<ArticleType, string> = {
  MEDICAL: "bg-sky-50 text-sky-700 border-sky-100",
  SECTOR_UPDATE: "bg-violet-50 text-violet-700 border-violet-100",
};

export default function TypeBadge({ type }: { type: ArticleType }) {
  return (
    <span className={`inline-block w-fit text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${STYLE[type]}`}>
      {ARTICLE_TYPE_LABEL[type]}
    </span>
  );
}
