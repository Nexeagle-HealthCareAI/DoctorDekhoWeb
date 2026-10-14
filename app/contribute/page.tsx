"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Heart, Lightbulb, PenLine } from "lucide-react";
import { contributorApi } from "@/lib/contributor/client";
import { useContributor, useLoad } from "@/lib/contributor/hooks";
import { isDoctorRole, type ArticleListResponse, type ArticleListTab, type MyArticle } from "@/lib/contributor/types";
import { ARTICLE_TYPE_LABEL } from "@/lib/health-wiki/types";
import { formatDate } from "@/lib/health-wiki/format";
import { ArticleStatusChip, Banner, Chip, ErrorBox, Loading, PageTitle, VerificationBanner, WaitingChip, card, primaryBtn, secondaryBtn } from "@/components/contributor/ui";
import { cn } from "@/lib/utils";

function Thumb({ a }: { a: MyArticle }) {
  return a.coverImageUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={a.coverImageUrl} alt="" className="w-28 sm:w-36 aspect-video object-cover rounded-xl shrink-0 bg-slate-100" />
    : <div aria-hidden="true" className="w-28 sm:w-36 aspect-video rounded-xl shrink-0 bg-gradient-to-br from-brand-teal/15 to-brand-sky/15" />;
}

function Row({ a, tab }: { a: MyArticle; tab: ArticleListTab }) {
  const href = tab === "pending" ? `/contribute/review/${a.slug}` : tab === "drafts" ? `/contribute/write/${a.slug}` : `/health/conditions/${a.slug}`;
  return (
    <li>
      <Link href={href} className={cn(card, "flex gap-4 items-center p-3 sm:p-4 hover:border-brand-teal/40 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal")}>
        <Thumb a={a} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-extrabold text-slate-900 leading-snug">{a.title}</p>
          {a.description && <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{a.description}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
            <Chip tone="sky">{ARTICLE_TYPE_LABEL[a.type]}</Chip>
            {tab === "pending" && a.waitingDays !== null && <WaitingChip days={a.waitingDays} />}
            {tab === "pending" && <span>From {a.authorName}</span>}
            {tab === "drafts" && <ArticleStatusChip status={a.status} />}
            {tab === "drafts" && a.returnedComment && <Chip tone="amber">Changes requested</Chip>}
            {tab === "published" && a.awaitingVerification && <Chip tone="amber">Live after your registration is verified</Chip>}
            {tab === "published" && a.publishedAt && !a.awaitingVerification && <span>Published {formatDate(a.publishedAt)}</span>}
          </div>
        </div>
        {tab === "published" && a.views !== null && (
          <div className="hidden sm:flex gap-4 font-semibold text-slate-700 tabular-nums shrink-0" aria-label={`${a.views} views and ${a.likes ?? 0} helpful votes`}>
            <span className="inline-flex items-center gap-1.5"><Eye className="w-4 h-4 text-slate-400" aria-hidden="true" />{a.views.toLocaleString("en-IN")}</span>
            <span className="inline-flex items-center gap-1.5"><Heart className="w-4 h-4 text-slate-400" aria-hidden="true" />{(a.likes ?? 0).toLocaleString("en-IN")}</span>
          </div>
        )}
        {tab === "pending" && <span className="hidden sm:inline-flex px-4 py-2 rounded-xl bg-brand-teal text-white text-sm font-bold">Review</span>}
      </Link>
    </li>
  );
}

const EMPTY: Record<ArticleListTab, { title: string; text: string }> = {
  pending: { title: "You are all caught up", text: "Articles that need your review will show up here." },
  published: { title: "Nothing published yet", text: "Approved articles and how many people read them appear here." },
  drafts: { title: "No drafts yet", text: "Use Write an article to start one." },
};

export default function ContributorHome() {
  const { me, error: meError } = useContributor();
  const lists = useLoad<ArticleListResponse>(() => contributorApi.articles());
  const doctor = me ? isDoctorRole(me.role) : false;
  const [picked, setPicked] = useState<ArticleListTab | null>(null);

  // /contribute?tab=drafts (after saving a draft) opens that tab. Read from the address in the browser, not with useSearchParams,
  // which would force a Suspense boundary around this whole statically built page.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "drafts" || t === "published" || t === "pending") setPicked(t);
  }, []);

  if (meError) return <ErrorBox message={meError} />;
  if (!me || lists.loading) return <Loading />;
  if (lists.error || !lists.data) return <ErrorBox message={lists.error ?? "Could not load your articles."} onRetry={lists.reload} />;

  const data = lists.data;
  const tabs: { key: ArticleListTab; label: string; sub: string; items: MyArticle[] }[] = [
    ...(doctor ? [{ key: "pending" as const, label: "Pending at you", sub: "Waiting for your review", items: data.pending }] : []),
    { key: "published", label: "Published", sub: `${data.published.reduce((s, a) => s + (a.views ?? 0), 0).toLocaleString("en-IN")} views · ${data.published.reduce((s, a) => s + (a.likes ?? 0), 0).toLocaleString("en-IN")} helpful`, items: data.published },
    { key: "drafts", label: "My drafts", sub: "Articles you are writing", items: data.drafts },
  ];
  const tab = picked && tabs.some((t) => t.key === picked) ? picked : tabs[0].key;
  const active = tabs.find((t) => t.key === tab)!;

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Hello, ${me.fullName || "there"}`}
        sub="Your Health Wiki work in one place."
        action={
          <div className="flex flex-wrap gap-3">
            <Link href="/contribute/topics" className={secondaryBtn}><Lightbulb className="w-4 h-4" aria-hidden="true" /> Topic requests</Link>
            <Link href="/contribute/write" className={primaryBtn}><PenLine className="w-4 h-4" aria-hidden="true" /> Write an article</Link>
          </div>
        }
      />
      <VerificationBanner me={me} />

      <div role="tablist" aria-label="Your articles" className={cn("grid gap-3", tabs.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === tab} onClick={() => setPicked(t.key)}
            className={cn("text-left rounded-2xl border-[1.5px] p-4 flex items-center gap-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal", t.key === tab ? "border-brand-teal bg-teal-50/60" : "border-slate-200 bg-white hover:border-brand-teal/40")}>
            <span className={cn("font-display text-3xl font-extrabold tabular-nums min-w-[2ch]", t.key === "pending" ? "text-amber-600" : t.key === "published" ? "text-emerald-600" : "text-slate-800")}>{t.items.length}</span>
            <span>
              <span className="block font-bold text-slate-900 text-sm">{t.label}</span>
              <span className="block text-xs text-slate-500">{t.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {active.items.length === 0 ? (
        <div className={`${card} p-10 text-center`} role="tabpanel">
          <p className="font-display font-bold text-slate-900">{EMPTY[active.key].title}</p>
          <p className="text-sm text-slate-500 mt-1">{EMPTY[active.key].text}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start" role="tabpanel">{active.items.map((a) => <Row key={a.slug} a={a} tab={active.key} />)}</ul>
      )}
    </div>
  );
}
