import Image from "next/image";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { CONTRIBUTOR_ENABLED } from "@/lib/contributor/session";

const BUTTON =
  "inline-flex justify-center px-5 py-3 rounded-xl bg-brand-teal text-white font-bold text-sm hover:bg-teal-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal";

/**
 * Invitation to write for or review the Health Wiki. Hidden until the contributor area is switched on.
 * "sidebar" is a tall floating card with Vita for the column at the right of the article list; "banner" is the full-width strip.
 */
export default function JoinCallout({ variant = "banner" }: { variant?: "banner" | "sidebar" }) {
  if (!CONTRIBUTOR_ENABLED) return null;

  const icon = (
    <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
      <PenLine className="w-6 h-6 text-brand-teal" aria-hidden="true" />
    </div>
  );
  const text = (
    <>
      <h2 id="join-wiki-heading" className="font-display text-lg font-extrabold text-slate-900">Write for the Health Wiki</h2>
      <p className="text-sm text-slate-600 mt-1">Doctors, health workers and writers can share what they know, or help us check what we publish.</p>
    </>
  );

  if (variant === "sidebar") {
    // A tall card that floats beside the articles: Vita in a white coat fills it, the invitation sits over the foot of the picture.
    return (
      <section
        aria-labelledby="join-wiki-heading"
        className="relative overflow-hidden rounded-3xl bg-slate-100 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 aspect-[3/4] lg:aspect-auto lg:h-[30rem] max-w-sm mx-auto lg:max-w-none motion-safe:animate-float"
      >
        <Image src="/vita/doctor.webp" alt="" width={800} height={993} sizes="(min-width: 1024px) 20rem, 24rem" className="absolute inset-0 h-full w-full object-cover object-top" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col gap-3">
          <div>
            <h2 id="join-wiki-heading" className="font-display text-xl font-extrabold text-white">Write for the Health Wiki</h2>
            <p className="text-sm text-slate-200 mt-1">Doctors, health workers and writers can share what they know, or help us check what we publish.</p>
          </div>
          <Link href="/contribute/join" className={BUTTON}>Join as a contributor</Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="join-wiki-heading" className="mt-12 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5 shadow-sm">
      {icon}
      <div className="flex-1 min-w-0">{text}</div>
      <Link href="/contribute/join" className={BUTTON}>Join as a contributor</Link>
    </section>
  );
}
