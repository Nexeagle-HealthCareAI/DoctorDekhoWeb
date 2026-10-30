"use client";

import PatientTopBar from "@/components/patient/PatientTopBar";
import ProfileShell from "@/components/patient/ProfileShell";
import ProfileSummaryCard from "@/components/patient/ProfileSummaryCard";
import ProfileNav from "@/components/patient/ProfileNav";
import PersonalInformationPanel from "@/components/patient/PersonalInformationPanel";
import { User, LogIn } from "lucide-react";
import Link from "next/link";
import { usePatientAuth } from "@/hooks/usePatientAuth";

export default function ProfileClient() {
  const { isLoggedIn, isLoading } = usePatientAuth();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0">
        <PatientTopBar showBackButton={true} wide />
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0">
        <PatientTopBar showBackButton={true} wide />
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-10">
          <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 shadow-sm px-6">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center mb-4 border border-teal-100">
              <User className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900 mb-2">You&apos;re not logged in</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">
              Log in with WhatsApp to see your profile and appointments from any device.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-teal-600 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Log In With WhatsApp
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ProfileShell>
      {/* Phone and tablet: the profile page is the menu of sections, under the person's card */}
      <div className="lg:hidden space-y-6">
        <ProfileSummaryCard />
        <ProfileNav />
      </div>
      {/* Large screen: the menu is at the left (see ProfileShell), so the main area opens on the first section */}
      <div className="hidden lg:block">
        <PersonalInformationPanel />
      </div>
    </ProfileShell>
  );
}
