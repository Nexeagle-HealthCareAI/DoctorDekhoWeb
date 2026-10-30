"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, PenLine, Stethoscope } from "lucide-react";
import { contributorApi } from "@/lib/contributor/client";
import { useLoad } from "@/lib/contributor/hooks";
import { ENROL_ROLE_LABEL, type InviteInfo } from "@/lib/contributor/types";
import OnboardingFlow from "@/components/contributor/OnboardingFlow";
import { Chip, Loading, card, primaryBtn } from "@/components/contributor/ui";

const COPY: Record<InviteInfo["kind"], { title: (i: InviteInfo) => string; lead: (i: InviteInfo) => string; Icon: typeof Stethoscope }> = {
  REVIEW: {
    title: () => "Review an article for the Health Wiki",
    lead: (i) => `${i.inviterName} asked you to medically review the article below. Once you approve it, it appears on Doctor Dekho with your name as "Medically reviewed by".`,
    Icon: Stethoscope,
  },
  WRITE: {
    title: () => "Write for the Health Wiki",
    lead: (i) => `${i.inviterName} invited you to write for the NexEagle Health Wiki.`,
    Icon: PenLine,
  },
  JOIN: {
    title: () => "Join the Health Wiki",
    lead: (i) => `${i.inviterName} invited you to take part in the NexEagle Health Wiki.`,
    Icon: BookOpen,
  },
};

export default function InvitePage({ params }: { params: { token: string } }) {
  const [started, setStarted] = useState(false);
  // An invitation link works before sign-in, so a 401 here is not a redirect case: it is a real error.
  const invite = useLoad<InviteInfo>(() => contributorApi.invite(params.token), [params.token]);

  if (invite.loading) return <Loading />;
  if (invite.error || !invite.data) {
    return (
      <div className={`${card} p-8 text-center max-w-lg mx-auto`} role="alert">
        <h1 className="font-display text-xl font-extrabold text-slate-900 mb-2">This link cannot be used</h1>
        <p className="text-slate-600 mb-6">{invite.error ?? "This link is not valid."}</p>
        <Link href="/contribute/login" className={primaryBtn}>Sign in with my mobile number</Link>
      </div>
    );
  }

  const i = invite.data;
  if (started) return <OnboardingFlow inviteToken={params.token} fixedRole={i.role} defaultName={i.inviteeName ?? ""} />;

  const { title, lead, Icon } = COPY[i.kind];
  return (
    <div className={`${card} p-6 sm:p-10 max-w-xl mx-auto`}>
      <p className="text-xs font-bold uppercase tracking-widest text-brand-teal mb-2">You are invited</p>
      <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight mb-3">{title(i)}</h1>
      <p className="text-slate-600 leading-relaxed mb-6">{lead(i)}</p>

      {i.articleTitle && (
        <div className="flex gap-4 items-center rounded-2xl bg-slate-50 border border-slate-100 p-3 mb-6">
          {i.articleCoverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={i.articleCoverUrl} alt="" className="w-24 aspect-video object-cover rounded-xl shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-bold text-slate-900 leading-snug">{i.articleTitle}</p>
            <div className="mt-1.5"><Chip tone="sky" icon={<Icon className="w-3.5 h-3.5" aria-hidden="true" />}>Your role: {ENROL_ROLE_LABEL[i.role]}</Chip></div>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setStarted(true)} className={`${primaryBtn} w-full py-3.5`}>Continue with my WhatsApp number</button>
      <p className="text-xs text-slate-500 text-center mt-4">This link was sent to {i.maskedMobile}. It only works for that number.</p>
    </div>
  );
}
