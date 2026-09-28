import Link from "next/link";
import { ShieldCheck, Building2, ArrowRight } from "lucide-react";

// A slim, secondary trust band between the hero's search CTA and the doctor grid — not a link
// competing with the primary "search" action inside the hero itself. Common marketplace pattern
// (Practo/Zocdoc-style trust bar): quick, scannable proof points, with the one clickable item
// (About & Verification) visually last and least emphasized, since it's a supporting action for
// a visitor who wants to read more, not the thing every visitor is here to do.
export default function TrustStrip() {
  return (
    <div className="border-y border-slate-100 bg-slate-50/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center">
        <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600">
          <ShieldCheck className="w-4 h-4 text-brand-teal shrink-0" />
          NMC-Verified Doctors Only
        </span>
        <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300" />
        <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600">
          <Building2 className="w-4 h-4 text-brand-teal shrink-0" />
          5+ Partner Hospitals
        </span>
        <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300" />
        <Link
          href="/about"
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-brand-teal hover:underline"
        >
          About &amp; Verification
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
