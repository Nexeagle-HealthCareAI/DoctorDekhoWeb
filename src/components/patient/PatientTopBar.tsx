"use client";

import { SITE_URL, BUSINESS_URL } from "@/lib/site";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, Locate, ArrowRight, X, ArrowLeft, Calendar, User, LogIn } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { CityOption } from "@/data/patient";
import { cityLabel } from "@/data/patient";
import type { GeoStatus } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/I18nContext";
import LanguageToggle from "./LanguageToggle";
import ShareButton from "./ShareButton";


interface PatientTopBarProps {
  /** Geolocation detection status */
  geoStatus?: GeoStatus;
  /** Currently selected city */
  city?: CityOption | null;
  /** All available cities for manual selection */
  cities?: CityOption[];
  /** Called when user selects a city or clears location */
  onCityChange?: (city: CityOption | null) => void;
  /** Called when user explicitly allows location detection */
  onRequestLocation?: () => void;
  /** Whether to show a native-style back button instead of the logo on mobile */
  showBackButton?: boolean;
}

export default function PatientTopBar({
  geoStatus = "idle",
  city = null,
  cities = [],
  onCityChange,
  onRequestLocation,
  showBackButton = false,
}: PatientTopBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
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


  const detecting = geoStatus === "detecting" || geoStatus === "idle";
  const denied = geoStatus === "denied" || geoStatus === "unsupported";

  function handleLocationClick() {
    if (denied) {
      setShowPrompt(true);
    } else if (!city && !detecting) {
      onRequestLocation?.();
    } else {
      setShowDropdown((v) => !v);
    }
  }

  function handleCitySelect(c: CityOption | null) {
    onCityChange?.(c);
    setShowDropdown(false);
  }

  // If we don't pass geoStatus (like on the detail page), we can simplify the display.
  // But we always want the TopBar to look premium.
  const hasLocationProps = onCityChange !== undefined;

  return (
    <>
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

          {/* ── Right: Location pill + Provider CTA ── */}
          <div className="flex items-center gap-1.5 sm:gap-5">
            


            {/* Location pill (Glassmorphic) */}
            {hasLocationProps && (
              <div className="relative shrink-0">
                <button
                  onClick={handleLocationClick}
                  className={cn(
                    "flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-full border backdrop-blur-md text-[11px] sm:text-sm font-semibold transition-all duration-300",
                    detecting
                      ? "border-brand-teal/20 bg-teal-50/50 text-brand-teal"
                      : city
                      ? "border-brand-teal/30 bg-white/60 text-brand-teal hover:bg-white hover:shadow-sm"
                      : denied
                      ? "border-amber-200/50 bg-amber-50/50 text-amber-700 hover:bg-amber-100/50"
                      : "border-slate-200/50 bg-white/60 text-slate-600 hover:border-brand-teal/30 hover:bg-white"
                  )}
                >
                  {detecting ? (
                    <>
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                      <span className="hidden sm:inline font-medium">{t("topbar.detecting")}</span>
                      <span className="sm:hidden font-medium">…</span>
                    </>
                  ) : city ? (
                    <>
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="max-w-[52px] sm:max-w-[160px] truncate font-medium">
                        {cityLabel(city)}
                      </span>
                      <ChevronDown className="hidden sm:block w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 opacity-50" />
                    </>
                  ) : denied ? (
                    <>
                      <Locate className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="hidden sm:inline font-medium">{t("topbar.allowLocationPill")}</span>
                      <span className="sm:hidden">📍</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="hidden sm:inline font-medium">{t("topbar.allIndia")}</span>
                      <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 opacity-50 sm:hidden" />
                    </>
                  )}
                </button>

                {/* City dropdown */}
                {showDropdown && cities.length > 0 && (
                  <div className="absolute top-full right-0 mt-3 w-56 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-50 py-2 max-h-[60vh] overflow-y-auto ring-1 ring-black/5">
                    <button
                      onClick={() => handleCitySelect(null)}
                      className={cn(
                        "w-full text-left px-5 py-3 text-sm transition-colors duration-200",
                        !city ? "text-brand-teal bg-teal-50/50 font-bold" : "text-slate-600 font-medium hover:bg-slate-50"
                      )}
                    >
                      🌍 {t("topbar.allIndia")}
                    </button>
                    <div className="h-px bg-slate-100 my-1 mx-3" />
                    {cities.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleCitySelect(c)}
                        className={cn(
                          "w-full text-left px-5 py-3 text-sm transition-colors duration-200 flex items-center gap-3",
                          city?.id === c.id
                            ? "text-brand-teal bg-teal-50/50 font-bold"
                            : "text-slate-600 font-medium hover:bg-slate-50"
                        )}
                      >
                        <MapPin className={cn("w-4 h-4 shrink-0", city?.id === c.id ? "text-brand-teal" : "text-slate-400")} />
                        {cityLabel(c)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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

      {/* ── Allow Location prompt overlay ── */}
      {showPrompt && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl space-y-5 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100/50 flex items-center justify-center shadow-inner">
                <MapPin className="w-7 h-7 text-brand-teal" />
              </div>
              <button
                onClick={() => setShowPrompt(false)}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 text-xl tracking-tight">
                {t("topbar.findDoctorsNearYou")}
              </h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed font-medium">
                {t("topbar.allowLocationDesc")}
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => {
                  onRequestLocation?.();
                  setShowPrompt(false);
                }}
                className="w-full py-3.5 rounded-xl bg-brand-teal text-white font-semibold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-brand-teal/90 hover:shadow-[0_6px_20px_rgba(20,184,166,0.4)] transition-all duration-300"
              >
                {t("topbar.allowLocationConfirm")}
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                className="w-full py-3.5 rounded-xl bg-slate-50 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors"
              >
                {t("topbar.chooseCityManually")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
