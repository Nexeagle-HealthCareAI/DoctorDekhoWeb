"use client";

import { HelpCircle, Stethoscope } from "lucide-react";
import type { SmartSearchIntent } from "@/lib/api/hooks";
import { useTranslation } from "@/lib/i18n/I18nContext";

// What the symptom router could not settle on its own, shown above the results:
//   clarify "age"       "Is this for a child or an adult?" -> re-run the search with that answer
//   clarify "specialty" "Which of these fits best?"         -> show that specialty's doctors
//   abstain             not clearly a health question       -> suggest a General Physician
// The question and option labels come from the router, already in the patient's language.

interface Props {
  intent: SmartSearchIntent;
  pending: boolean;
  onAnswerAge: (ageGroup: "child" | "adult") => void;
  onPickSpecialty: (specialtyId: string) => void;
  selectedSpecialtyId: string | null;
}

export default function SearchFollowUp({ intent, pending, onAnswerAge, onPickSpecialty, selectedSpecialtyId }: Props) {
  const { t } = useTranslation();

  if (intent.decision === "abstain") {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">
        <Stethoscope className="w-5 h-5 shrink-0 text-brand-teal" aria-hidden="true" />
        <p className="text-sm sm:text-base">{t("directory.gpSuggestion")}</p>
      </div>
    );
  }

  const clarify = intent.clarify;
  if (!clarify) return null;

  const isAge = clarify.kind === "age";
  return (
    <div className="mb-6 rounded-2xl border border-brand-teal/30 bg-white p-4 sm:p-5">
      <p className="flex items-start gap-2 font-semibold text-slate-900" id="search-followup-question">
        <HelpCircle className="w-5 h-5 shrink-0 text-brand-teal" aria-hidden="true" />
        {isAge ? clarify.question : t("directory.pickClosest")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="search-followup-question">
        {clarify.options.map((o) => {
          const selected = !isAge && selectedSpecialtyId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={pending}
              aria-pressed={isAge ? undefined : selected}
              onClick={() => (isAge ? onAnswerAge(o.id as "child" | "adult") : onPickSpecialty(o.id))}
              className={
                "min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50 " +
                (selected
                  ? "border-brand-teal bg-brand-teal text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-brand-teal hover:text-brand-teal")
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
