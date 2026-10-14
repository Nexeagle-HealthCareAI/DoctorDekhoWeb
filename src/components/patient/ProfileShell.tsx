"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import PatientTopBar from "./PatientTopBar";
import ProfileNav from "./ProfileNav";
import ProfileSummaryCard from "./ProfileSummaryCard";

/**
 * The signed-in account screens (profile, personal information, health locker) on the wide page width, laid out like a social profile:
 * on a large screen the person's card and the menu of sections stay at the left and the chosen section fills the rest; on a phone
 * only the section shows (the profile page itself is the menu). There is a Back button on every size.
 */
export default function ProfileShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0">
      <PatientTopBar showBackButton={true} wide />
      <div className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="hidden md:inline-flex items-center gap-2 mb-5 text-sm font-semibold text-slate-600 hover:text-brand-teal transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
        </button>
        <div className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-8 xl:gap-12 lg:items-start">
          <aside className="hidden lg:block lg:sticky lg:top-28 space-y-4" aria-label="Your profile">
            <ProfileSummaryCard />
            <ProfileNav />
          </aside>
          <div className="min-w-0 w-full max-w-3xl lg:max-w-4xl">{children}</div>
        </div>
      </div>
    </main>
  );
}
