"use client";

import PatientTopBar from "./PatientTopBar";
import ProfileSummaryCard from "./ProfileSummaryCard";

/**
 * The signed-in account screens (profile, personal information, health locker) on the wide page width: the summary card stays at the
 * left on large screens and the page's own content takes the rest. On small screens only the content shows (the profile page adds the
 * summary card itself, at its top).
 */
export default function ProfileShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0">
      <PatientTopBar showBackButton={true} wide />
      <div className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-8 xl:gap-12 lg:items-start">
        <aside className="hidden lg:block lg:sticky lg:top-28" aria-label="Your profile">
          <ProfileSummaryCard />
        </aside>
        <div className="min-w-0 w-full max-w-3xl lg:max-w-4xl">{children}</div>
      </div>
    </main>
  );
}
