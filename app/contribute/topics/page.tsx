"use client";

import Link from "next/link";
import { useState } from "react";
import { PenLine, Plus } from "lucide-react";
import { toast } from "sonner";
import { isDoctorRole } from "@/lib/contributor/types";
import TopicForm from "@/components/contributor/TopicForm";
import { BackLink, Banner, Chip, ErrorBox, Loading, PageTitle, TopicStatusChip, card, primaryBtn } from "@/components/contributor/ui";
import { contributorApi } from "@/lib/contributor/client";
import { useContributor, useLoad } from "@/lib/contributor/hooks";
import { ARTICLE_TYPE_LABEL } from "@/lib/health-wiki/types";
import { formatDate } from "@/lib/health-wiki/format";
import { OPEN_TOPIC_LIMIT, type TopicRequest } from "@/lib/contributor/types";

export default function TopicsPage() {
  const { me } = useContributor();
  const topics = useLoad<TopicRequest[]>(() => contributorApi.topics());
  const [adding, setAdding] = useState<string | null>(null);

  if (!me || topics.loading) return <Loading />;
  if (topics.error || !topics.data) return <ErrorBox message={topics.error ?? "Could not load your topic requests."} onRetry={topics.reload} />;
  const list = topics.data;
  const open = list.filter((t) => t.status === "SUBMITTED" || t.status === "NEEDS_DETAIL").length;

  return (
    <div>
      <BackLink href="/contribute">My articles</BackLink>
      <PageTitle
        title="Topic requests"
        sub={`${open} of ${OPEN_TOPIC_LIMIT} open requests used.`}
        action={<Link href="/contribute/topics/new" className={primaryBtn}><Plus className="w-4 h-4" aria-hidden="true" /> Suggest a topic</Link>}
      />

      {list.length === 0 ? (
        <div className={`${card} p-10 text-center`}>
          <p className="font-display font-bold text-slate-900">No requests yet</p>
          <p className="text-sm text-slate-500 mt-1">Suggest a topic and the team will let you know on WhatsApp.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((t) => (
            <li key={t.id} className={`${card} p-5 space-y-3`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display font-extrabold text-slate-900 leading-snug">{t.title}</h2>
                  <p className="text-xs text-slate-500 mt-1">Sent {formatDate(t.createdAt)}</p>
                </div>
                <div className="flex gap-2"><Chip tone="sky">{ARTICLE_TYPE_LABEL[t.type]}</Chip>{t.requestWriter && <Chip tone="amber">Writer requested</Chip>}<TopicStatusChip status={t.status} /></div>
              </div>
              <p className="text-sm text-slate-600">{t.outline}</p>

              {t.status === "DECLINED" && t.decisionNote && <Banner tone="warn"><b>Not accepted:</b> {t.decisionNote}</Banner>}
              {t.status === "NEEDS_DETAIL" && (
                <>
                  <Banner tone="info"><b>The team asks:</b> {t.decisionNote}</Banner>
                  {adding === t.id ? (
                    <TopicForm
                      sectorOnly={!isDoctorRole(me.role)} initial={t} submitLabel="Send the detail"
                      onSubmit={async (input) => { await contributorApi.addTopicDetail(t.id, input); setAdding(null); toast.success("Sent. The team will take another look."); topics.reload(); }}
                      onCancel={() => setAdding(null)}
                    />
                  ) : (
                    <button type="button" onClick={() => setAdding(t.id)} className="text-sm font-bold text-brand-teal hover:underline">Add the detail</button>
                  )}
                </>
              )}
              {(t.status === "ACCEPTED" || t.status === "ARTICLE_STARTED") && t.requestWriter && (
                <Banner tone="ok">The team accepted this and is arranging a writer. You will get a WhatsApp message when the article is ready for your review.</Banner>
              )}
              {(t.status === "ACCEPTED" || t.status === "ARTICLE_STARTED") && !t.requestWriter && (
                <Banner tone="ok">
                  The team accepted this. A draft is waiting for you{t.articleSlug ? <> — <Link href={`/contribute/write/${t.articleSlug}`}><PenLine className="inline w-3.5 h-3.5 mr-1" aria-hidden="true" />open the draft</Link></> : "."}
                </Banner>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
