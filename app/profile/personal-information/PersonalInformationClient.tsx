"use client";

import PatientTopBar from "@/components/patient/PatientTopBar";
import ProfileShell from "@/components/patient/ProfileShell";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { usePatientProfile } from "@/hooks/usePatientProfile";
import { User, Mail, Users, Cake, LogIn } from "lucide-react";
import Link from "next/link";

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 p-5 border-b border-slate-100 last:border-b-0">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="block font-semibold text-slate-900 text-sm truncate">{value}</span>
      </div>
    </div>
  );
}

export default function PersonalInformationClient() {
  const { isLoggedIn, isLoading: authLoading } = usePatientAuth();
  const { data: profile, isLoading: profileLoading } = usePatientProfile(isLoggedIn);

  if (authLoading) {
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
            <p className="text-sm text-slate-500 mb-6 max-w-sm">Log in with WhatsApp from your profile to see your details.</p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-teal-600 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Go to Profile
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const ageSex = [profile?.age ? `${profile.age} ${profile.ageUnit || "yrs"}` : null, profile?.sex]
    .filter(Boolean)
    .join(" · ");

  return (
    <ProfileShell>
        <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight mb-1">Personal Information</h1>
        <p className="text-sm text-slate-500 mb-6">This is what we have on file from your bookings.</p>

        {profileLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
          </div>
        ) : !profile?.fullName ? (
          <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 shadow-sm px-6">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
              <User className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900 mb-2">Nothing on file yet</h3>
            <p className="text-sm text-slate-500 max-w-sm">Your details will show up here after your first appointment booking.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">
            <Row icon={<User className="w-5 h-5" />} label="Full Name" value={profile.fullName} />
            {ageSex && <Row icon={<Cake className="w-5 h-5" />} label="Age / Sex" value={ageSex} />}
            {profile.email && <Row icon={<Mail className="w-5 h-5" />} label="Email" value={profile.email} />}
            {profile.guardianName && (
              <Row
                icon={<Users className="w-5 h-5" />}
                label="Guardian"
                value={`${profile.guardianRelation ? profile.guardianRelation + " " : ""}${profile.guardianName}`}
              />
            )}
          </div>
        )}

        <p className="text-xs text-slate-400 mt-6 text-center max-w-sm mx-auto">
          Spotted something wrong? Let the hospital&apos;s front desk know at your next visit — these
          details come from your bookings, so they&apos;re best corrected there.
        </p>
    </ProfileShell>
  );
}
