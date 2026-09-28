"use client";

import { SITE_URL, BUSINESS_URL } from "@/lib/site";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ArrowRight, ArrowLeft, Calendar, User, LogIn, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/I18nContext";
import LanguageToggle from "./LanguageToggle";
import ShareButton from "./ShareButton";


interface PatientTopBarProps {
  /** Whether to show a native-style back button instead of the logo on mobile */
  showBackButton?: boolean;
}

export default function PatientTopBar({
  showBackButton = false,
}: PatientTopBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu on outside click
  useEffect(() => {
    if (!showProfileMenu) return;
    function handleClick(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showProfileMenu]);

  return (
      <header className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* ── Left: Logo + Brand Title or Back Button ── */}
          {showBackButton ? (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-700 hover:text-brand-teal transition-colors py-2 pr-4 md:hidden active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold text-sm">Back</span>
            </button>
          ) : null}
          
          <Link
            href="/"
            className={cn(
              "items-center gap-2 sm:gap-3 shrink-0 select-none group",
              showBackButton ? "hidden md:flex" : "flex"
            )}
          >
            {/* Icon-only on mobile — the full wordmark logo + "Doctor Dekho" divider don't leave
                enough room for the location pill / hospital CTA / language toggle that also live
                in this row on a narrow screen. Full logo (icon + "NexEagle" text) from sm: up. */}
            <span className="sm:hidden">
              <Logo iconOnly iconClassName="w-12 h-12" />
            </span>
            <span className="hidden sm:flex items-center gap-3">
              <Logo textSize="text-base sm:text-xl" />
            </span>
          </Link>

          {/* ── Right: Provider CTA + account ── */}
          <div className="flex items-center gap-1.5 sm:gap-5">

            {/* Provider CTA */}
            <Link href={BUSINESS_URL} className="shrink-0">
              <button className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-teal hover:bg-teal-500 text-white text-sm font-bold transition-all duration-300 shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.4)] hover:-translate-y-0.5">
                <span>{t("topbar.forHospitals")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="sm:hidden inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-50 text-brand-teal border border-teal-100 hover:bg-teal-100 transition-colors">
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </Link>

            {/* Share CTA (Desktop only, mobile is too crowded and has browser share) */}
            <div className="shrink-0 hidden sm:block">
              <ShareButton 
                title="NexEagle Doctor Dekho"
                text="Find and book appointments with the best doctors near you on NexEagle Doctor Dekho!"
                url={SITE_URL}
              />
            </div>

            {/* Language toggle — persistent, top-right, per the feature spec */}
            <LanguageToggle />

            {/* Desktop / iPad — Profile avatar with dropdown (rightmost) */}
            <div className="hidden md:block relative shrink-0" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(v => !v)}
                aria-label="Account menu"
                className={`group flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border transition-all duration-200 ${
                  showProfileMenu
                    ? 'bg-teal-50 border-teal-200 shadow-md'
                    : 'bg-white/60 border-slate-200/60 hover:bg-white hover:border-teal-100 hover:shadow-sm'
                }`}
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-teal to-sky-500 shadow-sm">
                  <User className="w-4 h-4 text-white" />
                </span>
                <span className="text-sm font-semibold text-slate-700 group-hover:text-brand-teal transition-colors">
                  My Account
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180 text-brand-teal' : ''}`} />
              </button>

              {/* Dropdown menu */}
              {showProfileMenu && (
                <div className="absolute right-0 top-[calc(100%+10px)] w-52 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.12)] z-50 py-2 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">My Account</p>
                  </div>
                  <div className="py-1.5 px-2">
                    <Link
                      href="/appointments"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-brand-teal hover:bg-teal-50 transition-all duration-150 group"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-teal-50 group-hover:bg-white border border-teal-100/60 group-hover:border-teal-200 transition-all shadow-sm">
                        <Calendar className="w-4 h-4 text-brand-teal" />
                      </span>
                      <div>
                        <p className="leading-tight">Appointments</p>
                        <p className="text-[11px] text-slate-400 font-medium leading-tight">Your bookings</p>
                      </div>
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-brand-teal hover:bg-teal-50 transition-all duration-150 group"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-white border border-slate-200/60 group-hover:border-teal-200 transition-all shadow-sm">
                        <User className="w-4 h-4 text-slate-500 group-hover:text-brand-teal transition-colors" />
                      </span>
                      <div>
                        <p className="leading-tight">Profile</p>
                        <p className="text-[11px] text-slate-400 font-medium leading-tight">Your details</p>
                      </div>
                    </Link>
                    <Link
                      href="/about"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-brand-teal hover:bg-teal-50 transition-all duration-150 group"
                    >
                      <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-white border border-slate-200/60 group-hover:border-teal-200 transition-all shadow-sm">
                        <ShieldCheck className="w-4 h-4 text-slate-500 group-hover:text-brand-teal transition-colors" />
                      </span>
                      <div>
                        <p className="leading-tight">About &amp; Verification</p>
                        <p className="text-[11px] text-slate-400 font-medium leading-tight">Who we are</p>
                      </div>
                    </Link>
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100">
                    <Link
                      href="/login"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-2 text-[12px] font-semibold text-brand-teal hover:text-teal-600 transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Sign in / Register
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
  );
}
