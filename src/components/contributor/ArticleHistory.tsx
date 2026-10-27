"use client";

import { AlertTriangle, CheckCircle2, MessageSquare, PenLine, Send, Undo2, UserCheck } from "lucide-react";
import type { ReactNode } from "react";
import { contributorApi } from "@/lib/contributor/client";
import { useLoad } from "@/lib/contributor/hooks";
import type { ArticleHistoryEntry } from "@/lib/contributor/types";
import { formatDate } from "@/lib/health-wiki/format";
import { cn } from "@/lib/utils";
import { card } from "./ui";

type Tone = "green" | "amber" | "red" | "slate";

// What each action looks like. Anything the page does not know yet still shows, as a plain grey line.
const LOOK: Record<string, { tone: Tone; icon: ReactNode }> = {
  SELF_PUBLISHED: { tone: "green", icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> },
  PUBLISHED: { tone: "green", icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> },
  APPROVED: { tone: "green", icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> },
  REVISION_APPLIED: { tone: "green", icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> },
  PUT_BACK_LIVE: { tone: "green", icon: <Undo2 className="w-4 h-4" aria-hidden="true" /> },
  REVIEWER_APPROVED: { tone: "green", icon: <UserCheck className="w-4 h-4" aria-hidden="true" /> },
  PULLED_BACK: { tone: "amber", icon: <AlertTriangle className="w-4 h-4" aria-hidden="true" /> },
  UNPUBLISHED: { tone: "red", icon: <AlertTriangle className="w-4 h-4" aria-hidden="true" /> },
  SENT_BACK: { tone: "amber", icon: <MessageSquare className="w-4 h-4" aria-hidden="true" /> },
  REVIEWER_REQUESTED_CHANGES: { tone: "amber", icon: <MessageSquare className="w-4 h-4" aria-hidden="true" /> },
  SUBMITTED: { tone: "slate", icon: <Send className="w-4 h-4" aria-hidden="true" /> },
};
const FALLBACK = { tone: "slate" as Tone, icon: <PenLine className="w-4 h-4" aria-hidden="true" /> };

const DOT: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

function Row({ e, last }: { e: ArticleHistoryEntry; last: boolean }) {
  const look = LOOK[e.kind] ?? FALLBACK;
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={cn("w-8 h-8 rounded-full border flex items-center justify-center shrink-0", DOT[look.tone])}>{look.icon}</span>
        {!last && <span className="w-px flex-1 bg-slate-200 my-1" aria-hidden="true" />}
      </div>
      <div className={cn("min-w-0 flex-1", !last && "pb-5")}>
        <p className="font-bold text-slate-900 text-sm">{e.action}</p>
        <p className="text-xs text-slate-500">{e.byMe ? "You" : e.actor} · {formatDate(e.at)}</p>
        {e.detail && <p className="mt-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-700 whitespace-pre-line">{e.detail}</p>}
      </div>
    </li>
  );
}

/** What has happened to this article, newest first: your own steps, the reviewer's, and anything the NexEagle team did. */
export default function ArticleHistory({ slug }: { slug: string }) {
  const h = useLoad<ArticleHistoryEntry[]>(() => contributorApi.articleHistory(slug), [slug]);
  return (
    <section className={cn(card, "p-5 sm:p-6 mt-8")} aria-labelledby="article-history">
      <h2 id="article-history" className="font-display font-bold text-slate-900 mb-4">History</h2>
      {h.loading && <p className="text-sm text-slate-500" role="status">Loading…</p>}
      {h.error && !h.loading && (
        <p className="text-sm text-slate-600" role="alert">
          {h.error} <button type="button" onClick={h.reload} className="font-bold underline">Try again</button>
        </p>
      )}
      {!h.loading && !h.error && (h.data?.length ? (
        <ol>{h.data.map((e, i) => <Row key={`${e.at}-${e.kind}-${i}`} e={e} last={i === h.data!.length - 1} />)}</ol>
      ) : (
        <p className="text-sm text-slate-500">Nothing yet. Each step on this article will show here.</p>
      ))}
    </section>
  );
}
