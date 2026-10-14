"use client";

import { BadgeCheck, BookOpen } from "lucide-react";
import { usePatientIdentity } from "@/hooks/usePatientIdentity";
import type { ContributorTag } from "@/hooks/useContributorTag";
import { ENROL_ROLE_LABEL } from "@/lib/contributor/types";

const STATUS_LABEL: Record<NonNullable<ContributorTag["status"]>, string> = {
  VERIFIED: "Verified",
  PENDING: "Under review",
  INVITED: "Profile not completed",
};

/**
 * Who is signed in: name, then mobile number, then the Health Wiki contributor tag (when the number belongs to a contributor).
 * The name is the contributor's own name when they are one, else the name on their bookings, else "Patient Profile".
 */
export default function ProfileSummaryCard({ className = "" }: { className?: string }) {
  const { mobile, name, initials, tag } = usePatientIdentity();

  return (
    <div className={`bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex items-start gap-5 ${className}`}>
      <div className="w-16 h-16 shrink-0 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center font-display font-bold text-2xl border border-teal-100" aria-hidden="true">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-display font-bold text-slate-900 break-words">{name ?? "Patient Profile"}</h1>
        <p className="text-sm text-slate-500 font-medium mt-0.5">{mobile ? `+91 ${mobile}` : "Logged in"}</p>
        {tag?.isContributor && tag.role && tag.status && (
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-100 px-2.5 py-1 text-xs font-bold text-brand-teal">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" /> Health Wiki contributor
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 leading-snug">
              {tag.status === "VERIFIED" && <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />}
              {ENROL_ROLE_LABEL[tag.role]} · {STATUS_LABEL[tag.status]}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
