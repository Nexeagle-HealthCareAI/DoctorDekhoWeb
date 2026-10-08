import Link from "next/link";
import { PenLine } from "lucide-react";
import { CONTRIBUTOR_ENABLED } from "@/lib/contributor/session";

/** Invitation to write for or review the Health Wiki. Hidden until the contributor area is switched on. */
export default function JoinCallout() {
  if (!CONTRIBUTOR_ENABLED) return null;
  return (
    <section aria-labelledby="join-wiki-heading" className="mt-12 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5 shadow-sm">
      <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
        <PenLine className="w-6 h-6 text-brand-teal" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 id="join-wiki-heading" className="font-display text-lg font-extrabold text-slate-900">Write for the Health Wiki</h2>
        <p className="text-sm text-slate-600 mt-1">Doctors, health workers and writers can share what they know, or help us check what we publish.</p>
      </div>
      <Link href="/contribute/join" className="inline-flex justify-center px-5 py-3 rounded-xl bg-brand-teal text-white font-bold text-sm hover:bg-teal-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal">
        Join as a contributor
      </Link>
    </section>
  );
}
