"use client";

import { useEffect, useState } from "react";
import { ThumbsUp } from "lucide-react";

// "Was this helpful?" and the page-view count for one published article. Both go through this site's own
// /api/public/health-articles routes, which attach an anonymous reader id. Nothing here blocks reading.

const storageKey = (slug: string) => `hw-liked:${slug}`;

function wasLiked(slug: string): boolean {
  try {
    return localStorage.getItem(storageKey(slug)) === "1";
  } catch {
    return false;
  }
}

export default function ArticleReactions({ slug }: { slug: string }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLiked(wasLiked(slug));
    // One view per reader per day is decided by the backend; a failure here is ignored on purpose.
    fetch(`/api/public/health-articles/${encodeURIComponent(slug)}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [slug]);

  const like = async () => {
    if (liked || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/public/health-articles/${encodeURIComponent(slug)}/like`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { likes?: number };
        if (typeof data.likes === "number") setLikes(data.likes);
        setLiked(true);
        try {
          localStorage.setItem(storageKey(slug), "1");
        } catch {
          /* private mode: the button just stays available */
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
      <p className="text-sm font-semibold text-slate-700">Was this article helpful?</p>
      <button
        type="button"
        onClick={like}
        disabled={liked || busy}
        aria-pressed={liked}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${
          liked ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:border-brand-teal hover:text-brand-teal"
        }`}
      >
        <ThumbsUp className="w-4 h-4" aria-hidden="true" />
        {liked ? "Thanks for your feedback" : "Yes, helpful"}
        {likes !== null && <span className="tabular-nums text-xs font-semibold opacity-70">{likes.toLocaleString("en-IN")}</span>}
      </button>
    </div>
  );
}
