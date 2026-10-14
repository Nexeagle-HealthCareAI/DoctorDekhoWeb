"use client";

import { useState } from "react";
import PatientTopBar from "@/components/patient/PatientTopBar";
import ProfileShell from "@/components/patient/ProfileShell";
import ProfileSummaryCard from "@/components/patient/ProfileSummaryCard";
import { User, Shield, HelpCircle, LogOut, ChevronRight, LogIn, FolderHeart, BookOpen, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { openContributorArea, useContributorTag } from "@/hooks/useContributorTag";
import { CONTRIBUTOR_ENABLED } from "@/lib/contributor/session";

export default function ProfileClient() {
  const { isLoggedIn, isLoading, logout } = usePatientAuth();
  const router = useRouter();
  const tag = useContributorTag(isLoggedIn).data;
  const [opening, setOpening] = useState(false);

  // A person who is a contributor goes straight in (their number was just proven by this login); others are taken to join.
  const openArea = async () => {
    setOpening(true);
    const r = await openContributorArea();
    if (r.ok) {
      router.push("/contribute");
      return;
    }
    toast.error(r.message ?? "Could not open your Health Wiki area. Try again.");
    setOpening(false);
  };

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

            {/* Small screens: the summary card sits above the list (large screens show it at the left) */}
            <ProfileSummaryCard className="mb-6 lg:hidden" />

            {/* Action List */}
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">
              <Link href="/profile/personal-information" className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors border-b border-slate-100 active:bg-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block font-semibold text-slate-900 text-sm">Personal Information</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>

              <Link href="/appointments" className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors border-b border-slate-100 active:bg-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block font-semibold text-slate-900 text-sm">My Appointments</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>

              <Link href="/profile/health-locker" className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors border-b border-slate-100 active:bg-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <FolderHeart className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block font-semibold text-slate-900 text-sm">Health Locker</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>

              <Link href="/health" className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors border-b border-slate-100 active:bg-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block font-semibold text-slate-900 text-sm">Health Wiki</span>
                  <span className="block text-xs text-slate-400 mt-0.5">Doctor-reviewed health guides</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>

              {CONTRIBUTOR_ENABLED && tag?.isContributor && tag.status !== "INVITED" && (
                <button type="button" onClick={openArea} disabled={opening} className="w-full text-left flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors border-b border-slate-100 active:bg-slate-100 disabled:opacity-60">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-brand-teal">
                    <PenLine className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="block font-semibold text-slate-900 text-sm">{opening ? "Opening…" : "My Health Wiki articles"}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">Write, review and track your articles and topics</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              )}

              {/* Invited by the team but the profile is not finished, or not a contributor yet: both go through the join steps */}
              {CONTRIBUTOR_ENABLED && (!tag?.isContributor || tag.status === "INVITED") && (
                <Link href="/contribute/join" className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors border-b border-slate-100 active:bg-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <PenLine className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="block font-semibold text-slate-900 text-sm">{tag?.isContributor ? "Complete your Health Wiki profile" : "Write for the Health Wiki"}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{tag?.isContributor ? "The team invited you. Finish your details to start writing" : "Join as a doctor, health worker or writer"}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </Link>
              )}

              <a href="mailto:info@nexeagle.com" className="flex items-center gap-4 p-5 hover:bg-slate-50 transition-colors active:bg-slate-100">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block font-semibold text-slate-900 text-sm">Help & Support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </a>
            </div>

            {/* Logout */}
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="w-full mt-6 bg-white rounded-2xl p-4 text-red-500 font-bold text-sm shadow-sm border border-red-100 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors active:scale-95 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {logout.isPending ? "Signing out..." : "Sign Out"}
            </button>
    </ProfileShell>
  );
}
