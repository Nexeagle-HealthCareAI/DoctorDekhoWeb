"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ARTICLE_STATUS_LABEL, TOPIC_STATUS_LABEL, type ArticleStatus, type ContributorMe, type TopicStatus } from "@/lib/contributor/types";
import { isDoctorRole } from "@/lib/contributor/types";

export const card = "bg-white rounded-3xl border border-slate-200/80 shadow-sm";
export const input = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 disabled:opacity-60 disabled:cursor-not-allowed";
export const primaryBtn =
  "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-teal-600 disabled:opacity-50 disabled:shadow-none transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal";
export const secondaryBtn =
  "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:border-brand-teal/50 disabled:opacity-50 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal";

export function Field({ label, htmlFor, error, hint, optional, children }: { label: string; htmlFor: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-slate-800">
        {label}{optional && <span className="font-normal text-slate-400"> (optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

const TONES = {
  info: { box: "bg-sky-50 text-sky-900 border-sky-100", Icon: Info },
  warn: { box: "bg-amber-50 text-amber-900 border-amber-200", Icon: AlertTriangle },
  ok: { box: "bg-emerald-50 text-emerald-900 border-emerald-100", Icon: CheckCircle2 },
} as const;

export function Banner({ tone = "info", children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  const { box, Icon } = TONES[tone];
  return (
    <div role={tone === "warn" ? "alert" : "status"} className={cn("flex gap-3 items-start rounded-2xl border px-4 py-3 text-sm", box, className)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 [&_a]:font-bold [&_a]:underline">{children}</div>
    </div>
  );
}

const CHIP = {
  slate: "bg-slate-100 text-slate-600",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  green: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
} as const;

export function Chip({ tone = "slate", children, icon }: { tone?: keyof typeof CHIP; children: ReactNode; icon?: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap", CHIP[tone])}>{icon}{children}</span>;
}

export const ArticleStatusChip = ({ status }: { status: ArticleStatus }) => (
  <Chip tone={status === "PUBLISHED" ? "green" : status === "IN_REVIEW" ? "amber" : "slate"}>{ARTICLE_STATUS_LABEL[status]}</Chip>
);

export const TopicStatusChip = ({ status }: { status: TopicStatus }) => (
  <Chip tone={status === "DECLINED" ? "red" : status === "NEEDS_DETAIL" ? "sky" : status === "SUBMITTED" ? "amber" : "green"}>{TOPIC_STATUS_LABEL[status]}</Chip>
);

export const WaitingChip = ({ days }: { days: number }) => (
  <Chip tone={days >= 3 ? "red" : "amber"} icon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}>
    {days === 0 ? "Sent today" : `Waiting ${days} ${days === 1 ? "day" : "days"}`}
  </Chip>
);

/** Where the person's profile stands, and what that means for them. */
export function VerificationBanner({ me }: { me: ContributorMe }) {
  const doctor = isDoctorRole(me.role);
  if (me.status === "VERIFIED") {
    return <Banner tone="ok">{doctor ? "Registration verified. Your name and badge show on articles you review." : "Profile approved. You can write and submit articles."}</Banner>;
  }
  if (me.status === "REJECTED") {
    return <Banner tone="warn"><b>Your profile was not accepted.</b>{me.rejectReason ? ` Reason: ${me.rejectReason}.` : ""} Contact the NexEagle team to fix it.</Banner>;
  }
  return (
    <Banner tone="warn">
      <b>{doctor ? "Registration under verification" : "Profile waiting for approval"}</b>
      {doctor && me.registrationNumber ? ` (${me.registrationNumber}${me.registrationCouncil ? `, ${me.registrationCouncil}` : ""})` : ""}.{" "}
      {doctor
        ? "You can read assigned articles and prepare drafts. Anything you approve goes live once the team has verified your registration, and you can submit articles then."
        : "You can prepare drafts now. You can submit them once the team has approved your profile."}
    </Banner>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">{title}</h1>
        {sub && <p className="text-slate-600 mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export const BackLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="inline-block mb-4 text-sm font-semibold text-slate-500 hover:text-brand-teal">← {children}</Link>
);

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="text-slate-500 py-10 text-center" role="status">{label}</p>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={cn(card, "p-8 text-center")} role="alert">
      <p className="font-bold text-slate-900 mb-1">Could not load this page</p>
      <p className="text-slate-600 text-sm mb-4">{message}</p>
      {onRetry && <button type="button" className={secondaryBtn} onClick={onRetry}>Try again</button>}
    </div>
  );
}
