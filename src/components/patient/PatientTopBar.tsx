"use client";

import { SITE_URL, BUSINESS_URL } from "@/lib/site";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/I18nContext";
import LanguageToggle from "./LanguageToggle";
import ShareButton from "./ShareButton";
import AccountMenu from "./AccountMenu";


interface PatientTopBarProps {
  /** Whether to show a native-style back button instead of the logo on mobile */
  showBackButton?: boolean;
  /** Use the wider page width (up to 1536 px), for pages that fill a large screen such as the Health Wiki. */
  wide?: boolean;
}

export default function PatientTopBar({
  showBackButton = false,
  wide = false,
}: PatientTopBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
      <header className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-300">
        <div className={`${wide ? "max-w-screen-2xl" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3`}>
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

            {/* Account: the signed-in person and their menu (with Sign out), or Log in / Register */}
            <AccountMenu />
          </div>
        </div>
      </header>
  );
}
