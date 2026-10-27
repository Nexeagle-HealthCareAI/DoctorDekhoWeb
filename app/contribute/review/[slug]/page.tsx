"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { contributorApi } from "@/lib/contributor/client";
import { messageOf, useContributor, useLoad } from "@/lib/contributor/hooks";
import { toPreviewArticle } from "@/lib/contributor/preview";
import { isDoctorRole, type MyArticle } from "@/lib/contributor/types";
import ArticleHistory from "@/components/contributor/ArticleHistory";
import ArticlePreview from "@/components/contributor/ArticlePreview";
import { BackLink, Banner, ErrorBox, Loading, PageTitle, WaitingChip, card, primaryBtn, secondaryBtn, input } from "@/components/contributor/ui";

export default function ReviewPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { me } = useContributor();
  const art = useLoad<MyArticle>(() => contributorApi.article(params.slug), [params.slug]);
  const [checked, setChecked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [busy, setBusy] = useState(false);

  if (art.loading || !me) return <Loading />;
  if (art.error || !art.data) return <ErrorBox message={art.error ?? "Article not found."} onRetry={art.reload} />;
  const a = art.data;
  const canDecide = a.status === "IN_REVIEW" && a.myRole === "REVIEWER" && isDoctorRole(me.role);
  const verified = me.status === "VERIFIED";
  const preview = toPreviewArticle(a, { reviewerAs: me });

  const approve = async () => {
    setBusy(true);
    try {
      const done = await contributorApi.reviewArticle(a.slug, { decision: "APPROVE", accuracyConfirmed: true });
      toast.success(done.awaitingVerification ? "Approved. It goes live once your registration is verified." : "Published on Doctor Dekho.");
      router.push("/contribute");
    } catch (e) {
      toast.error(messageOf(e));
      setBusy(false);
    }
  };

  const requestChanges = async () => {
    if (comment.trim().length < 10) return setCommentError("Add a short comment so the writer knows what to change.");
    setCommentError("");
    setBusy(true);
    try {
      await contributorApi.reviewArticle(a.slug, { decision: "REQUEST_CHANGES", comment: comment.trim() });
      toast.success("Sent back to the writer with your comment.");
      router.push("/contribute");
    } catch (e) {
      toast.error(messageOf(e));
      setBusy(false);
    }
  };

  return (
    <div>
      <BackLink href="/contribute">My articles</BackLink>
      <PageTitle title={a.title} sub={a.authorName ? `From ${a.authorName}` : "Written by the NexEagle team"} action={a.waitingDays !== null && a.status === "IN_REVIEW" ? <WaitingChip days={a.waitingDays} /> : undefined} />

      {canDecide && a.suggestedBy && (
        <Banner tone="info" className="mb-6">
          {a.suggestedByMe
            ? "You suggested this topic. The NexEagle team wrote the article, and it is with you to review. Readers see it only after you approve it."
            : `${a.suggestedBy} suggested this topic, and the NexEagle team asked you to review the article. Readers see it only after you approve it.`}
        </Banner>
      )}

      {!canDecide && (
        <Banner tone="info" className="mb-6">{a.status === "PUBLISHED" ? "This article is published." : "This article is not waiting for your review."}</Banner>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        <ArticlePreview article={preview} />

        {canDecide && (
          <aside className={`${card} p-5 space-y-5 lg:sticky lg:top-6`} aria-label="Your review">
            <h2 className="font-display font-bold text-slate-900">Your review</h2>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 space-y-0.5">
              <p className="font-bold text-slate-800">The badge will show</p>
              <p>{me.fullName}</p>
              {(me.qualification || me.speciality) && <p>{[me.qualification, me.speciality].filter(Boolean).join(" • ")}</p>}
              {me.registrationNumber && <p>Reg. {me.registrationNumber}{me.registrationCouncil ? ` · ${me.registrationCouncil}` : ""}</p>}
            </div>
            {!verified && <Banner tone="warn">Your registration is not verified yet. If you approve, the article goes live after it is verified.</Banner>}

            {confirming ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3" role="alertdialog" aria-label="Confirm approval">
                <p className="font-bold text-emerald-900">Approve this article?</p>
                <p className="text-sm text-emerald-900">{verified ? "It goes live on Doctor Dekho right away, with your name as reviewer." : "It is saved as approved and goes live once your registration is verified."}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={approve} disabled={busy} className={primaryBtn}>Approve</button>
                  <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={secondaryBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <label className="flex gap-3 items-start text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[hsl(var(--brand-teal))]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                  <span>I have checked this article for medical accuracy.</span>
                </label>
                <button type="button" disabled={!checked || busy} onClick={() => setConfirming(true)} className={`${primaryBtn} w-full`}>Approve</button>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label htmlFor="changes" className="block text-sm font-bold text-slate-800">Need changes?</label>
                  <textarea id="changes" rows={4} className={input} placeholder="Tell the writer what to fix. For example: add when to see a doctor." value={comment} onChange={(e) => setComment(e.target.value)} />
                  {commentError && <p role="alert" className="text-xs font-medium text-red-600">{commentError}</p>}
                </div>
                <button type="button" disabled={busy} onClick={requestChanges} className={`${secondaryBtn} w-full`}>Request changes</button>
              </>
            )}
          </aside>
        )}
      </div>
      <ArticleHistory slug={a.slug} />
    </div>
  );
}
