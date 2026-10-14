import type { Metadata } from "next";
import Link from "next/link";
import { CONTRIBUTOR_ENABLED } from "@/lib/contributor/session";
import ContributorHeader from "@/components/contributor/ContributorHeader";

// These pages hold personal details and unpublished drafts: never index them.
export const metadata: Metadata = {
  title: "Health Wiki contributors",
  robots: { index: false, follow: false },
};

export default function ContributeLayout({ children }: { children: React.ReactNode }) {
  if (!CONTRIBUTOR_ENABLED) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h1 className="font-display text-2xl font-extrabold text-slate-900 mb-2">Coming soon</h1>
          <p className="text-slate-600 mb-6">The Health Wiki contributor area is not open yet.</p>
          <Link href="/health" className="font-bold text-brand-teal hover:underline">Read the Health Wiki</Link>
        </div>
      </main>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <ContributorHeader />
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-24">{children}</main>
    </div>
  );
}
