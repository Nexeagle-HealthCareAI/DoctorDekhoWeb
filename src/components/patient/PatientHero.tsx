"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Mic, MapPin, ChevronDown, X } from "lucide-react";
import { specialties, cityLabel, type CityOption } from "@/data/patient";
import { cn } from "@/lib/utils";
import type { GeoStatus } from "@/lib/geo";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { translateSpecialty } from "@/lib/i18n/specialties";
import { useDoctors } from "@/lib/api/hooks";
import VitaPeek from "@/components/patient/vita/VitaPeek";

// en-IN handles Indian English + Hinglish; hi-IN/bn-IN give the speech engine a much
// better shot at actual Hindi/Bengali sentences once the UI locale says that's what
// the visitor speaks.
const SPEECH_LANG: Record<string, string> = { en: "en-IN", hi: "hi-IN", bn: "bn-IN", hinglish: "en-IN" };

// A handful of tags inline ("Popular searches: X, Y, Z, Others") reads faster than a wall of
// 31 equal-weight chips — matches the compact reference pattern (Practo-style), with "Others"
// opening the full flat list (no categories — the business only lists allopathic specialties,
// so Practo's Dentist/Alternative-Medicine/Therapist groupings don't map onto this data).
const POPULAR_TAG_COUNT = 4;

// TODO(popular-specialties-v2): "Popular" is currently ranked by how many doctors are listed
// under each specialty (a supply-side proxy — see rankedSpecialties below), NOT by real patient
// search demand. The site already fires a `search_performed` analytics event per search (see
// DoctorDirectory.tsx) carrying specialtyId, but that pipeline is write-only today — there is no
// endpoint anywhere (WhatsApp bot or Doctor Dekho) that reads back aggregated search counts.
// Once the combined WhatsApp+Doctor Dekho search-count backend endpoint exists, replace
// `rankedSpecialties`'s sort key below with real counts fetched from it — everything else
// (slicing into popular/more, the expand toggle, etc.) stays the same.

interface PatientHeroProps {
  /** The page's own heading for search engines and screen readers, e.g. "General Physicians in Kishanganj, Bihar". The home page leaves it out. */
  pageHeading?: string;
  query: string;
  onQueryChange: (q: string) => void;
  specialtyId: string;
  onSpecialtyChange: (id: string) => void;
  /** Geolocation detection status — was previously shown as an "Allow Location" pill in the
   * topbar; moved here into the search pill itself, in the slot the specialty selector used
   * to occupy, so location is picked as part of the actual search action instead of a
   * separate control floating in the header. */
  geoStatus?: GeoStatus;
  city?: CityOption | null;
  cities?: CityOption[];
  onCityChange?: (city: CityOption | null) => void;
  onRequestLocation?: () => void;
}

export default function PatientHero({
  query,
  onQueryChange,
  specialtyId,
  onSpecialtyChange,
  geoStatus = "idle",
  city = null,
  cities = [],
  onCityChange,
  onRequestLocation,
  pageHeading,
}: PatientHeroProps) {
  const { t, locale } = useTranslation();

  function scrollToDoctors() {
    document.getElementById("doctors")?.scrollIntoView({ behavior: "smooth" });
  }

  // ── Location picker (moved out of PatientTopBar) ──────────────────────────
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);
  // The dropdown panel itself is rendered OUTSIDE the hero <section> (fixed-positioned, at the
  // very end of this component) — the hero section has `overflow-hidden` to clip its decorative
  // background blobs, and that was silently clipping the bottom of this dropdown too whenever
  // it was tall enough to extend past the section's own bottom edge. The dropdown's own
  // `overflow-y-auto` had nothing to do with it: its content fit inside its own box just fine
  // (scrollHeight === clientHeight, confirmed by inspecting it directly), so scrolling never did
  // anything — the missing rows were being cut off by an ANCESTOR's clipping, not hidden by lack
  // of internal scroll. Coordinates are computed from the button's own position since the panel
  // is no longer a DOM descendant of it.
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const hasLocationProps = onCityChange !== undefined;
  const detecting = geoStatus === "detecting" || geoStatus === "idle";
  const denied = geoStatus === "denied" || geoStatus === "unsupported";

  function updateDropdownPosition() {
    if (!locationRef.current) return;
    const rect = locationRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!showLocationDropdown) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideButton = locationRef.current?.contains(target);
      const insidePanel = dropdownPanelRef.current?.contains(target);
      if (!insideButton && !insidePanel) setShowLocationDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    // A fixed-position panel doesn't move with the page, so it'd visually drift away from the
    // button it belongs to if the *page* scrolls while it's open — closing on scroll matches
    // how most native pickers behave rather than leaving a stray panel floating mid-page.
    // Critical: a capture-phase listener on `window` fires for EVERY scroll event, including
    // the dropdown's own internal list scrolling (a "scroll" event doesn't bubble, but capture
    // still passes through ancestors on its way down to the real target first) — without the
    // `contains()` check below, scrolling the city list itself would immediately close the
    // dropdown on the very first scroll tick, which is exactly the bug this was reported as
    // ("scroll nahi ho raha" — it wasn't that scrolling failed, it's that opening a scroll
    // instantly closed the panel before anything visibly moved).
    function handleScroll(e: Event) {
      if (dropdownPanelRef.current && e.target instanceof Node && dropdownPanelRef.current.contains(e.target)) {
        return;
      }
      setShowLocationDropdown(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [showLocationDropdown]);

  function handleLocationClick() {
    // A city is selected — including the Purnea default applied once geolocation is known to
    // be unavailable (see home-client.tsx) — so clicking opens the picker to change it, same
    // as it would for a geo-detected city; it no longer re-prompts for location permission
    // just because the underlying geoStatus happens to be "denied".
    if (city) {
      if (!showLocationDropdown) updateDropdownPosition();
      setShowLocationDropdown((v) => !v);
    } else if (denied) {
      setShowLocationPrompt(true);
    } else if (!detecting) {
      onRequestLocation?.();
    } else {
      if (!showLocationDropdown) updateDropdownPosition();
      setShowLocationDropdown((v) => !v);
    }
  }

  function handleCitySelect(c: CityOption | null) {
    onCityChange?.(c);
    setShowLocationDropdown(false);
  }

  // No seed here — shares the same ["public","doctors"] query-key cache HomeClient/
  // DoctorDirectory already populate (see PatientFooter.tsx for the identical pattern), so this
  // is a cache read, not an extra fetch, on pages where those already mounted.
  const { data: doctorsData } = useDoctors();

  // Doctor-count-per-specialty, descending, as today's stand-in for real search demand (see the
  // TODO above the imports) — a specialty with more listed doctors is a reasonable proxy for
  // patient demand until the real search-count endpoint exists. `Array.prototype.sort` is
  // stable (ES2019+), so specialties tied on count (including the common case of 0 vs 0 for
  // ones with no doctors yet) keep their original relative order rather than shuffling randomly
  // on every render.
  const rankedSpecialties = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of doctorsData?.doctors ?? []) {
      counts.set(d.specialtyId, (counts.get(d.specialtyId) ?? 0) + 1);
    }
    return [...specialties].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [doctorsData]);

  const popularTags = useMemo(() => rankedSpecialties.slice(0, POPULAR_TAG_COUNT), [rankedSpecialties]);

  // ── "Others" mega-panel (all specialties, flat list) ─────────────────────
  // Same fixed-position-rendered-outside-the-<section> pattern as the location dropdown above,
  // for the identical reason: the hero section's `overflow-hidden` (for its background blobs)
  // would otherwise clip this panel's bottom edge whenever it's taller than the remaining
  // section height.
  const [showSpecialtyPanel, setShowSpecialtyPanel] = useState(false);
  const specialtyAnchorRef = useRef<HTMLButtonElement>(null);
  const specialtyPanelRef = useRef<HTMLDivElement>(null);
  const [specialtyPanelPos, setSpecialtyPanelPos] = useState<{ top: number; left: number; width: number } | null>(null);

  function updateSpecialtyPanelPosition() {
    if (!specialtyAnchorRef.current) return;
    const rect = specialtyAnchorRef.current.getBoundingClientRect();
    const width = Math.min(640, window.innerWidth - 32);
    const left = Math.max(16, Math.min(window.innerWidth - width - 16, rect.left + rect.width / 2 - width / 2));
    setSpecialtyPanelPos({ top: rect.bottom + 8, left, width });
  }

  function toggleSpecialtyPanel() {
    if (!showSpecialtyPanel) updateSpecialtyPanelPosition();
    setShowSpecialtyPanel((v) => !v);
  }

  useEffect(() => {
    if (!showSpecialtyPanel) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const insideButton = specialtyAnchorRef.current?.contains(target);
      const insidePanel = specialtyPanelRef.current?.contains(target);
      if (!insideButton && !insidePanel) setShowSpecialtyPanel(false);
    }
    // See the location dropdown's identical listener above for why this needs the
    // `contains()` guard: a naive "close on any scroll" handler also fires for scrolling
    // *inside* this panel's own list (capture-phase listeners see every scroll event on
    // their way down to the real target), which would close the panel the instant someone
    // tried to scroll through the specialty list rather than actually letting them scroll it.
    function handleScroll(e: Event) {
      if (specialtyPanelRef.current && e.target instanceof Node && specialtyPanelRef.current.contains(e.target)) {
        return;
      }
      setShowSpecialtyPanel(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [showSpecialtyPanel]);

  function handleSpecialtyPick(id: string) {
    onSpecialtyChange(specialtyId === id ? "" : id);
    setShowSpecialtyPanel(false);
    scrollToDoctors();
  }

  const [isListening, setIsListening] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      setHasSpeechSupport(true);
    }
  }, []);

  const startVoiceSearch = () => {
    if (isListening || !hasSpeechSupport) return;
    
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();
    
    recognition.lang = SPEECH_LANG[locale] ?? "en-IN";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      // Compile all interim and final results from this session
      const fullText = Array.from(event.results)
        .map((res: any) => res[0].transcript)
        .join('');
        
      onQueryChange(fullText);

      // Check if the engine has finalized the phrase
      const isFinal = Array.from(event.results).some((res: any) => res.isFinal);
      
      if (isFinal) {
        // Wait a half-second for the user to read the final text, then auto-search
        setTimeout(() => {
          scrollToDoctors();
        }, 500);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <>
    {/* min-h fills exactly what's left below the sticky topbar (h-16 mobile / h-20 desktop,
        see PatientTopBar) using svh (small-viewport-height, stable against mobile browser
        chrome showing/hiding) — so on first load only the hero is visible, and everything
        below it (TrustStrip, "Top Specialists") only comes into view on scroll, instead of
        the doctor grid already peeking onto the initial screen. items-center vertically
        centers the search block within that full available height -- the earlier items-start
        experiment pushed everything too close to the topbar; centered against the real
        screen height (not just "near the top") is the correct anchor. */}
    <section className="relative overflow-hidden bg-white flex items-center min-h-[calc(100svh-4rem)] sm:min-h-[calc(100svh-5rem)]">
      {/* ── Background Mesh Gradient — slow organic drift, motion-safe so it respects a
          visitor's OS-level "reduce motion" preference without any extra JS check. ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-100/40 blur-[100px] mix-blend-multiply motion-safe:animate-blob-drift" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-sky-100/50 blur-[100px] mix-blend-multiply motion-safe:animate-blob-drift-slow" />
        <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] rounded-full bg-brand-sand/40 blur-[120px] mix-blend-multiply motion-safe:animate-blob-drift-slower" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        {/* Title — a one-time spring "pop" entrance (fade + scale overshoot, not a plain
            linear fade) on the outer wrapper, then the inner h1 settles into a slow, gentle,
            infinite float once the spring has visibly landed — the heading reads as if it
            bounced into place and is now quietly "alive" rather than a static image. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, mass: 0.8 }}
          className="mb-10"
        >
          <motion.h1
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold text-slate-900 tracking-tighter leading-[1.05] flex flex-col items-center"
          >
            <span className="sr-only">{pageHeading ? `${pageHeading} on ` : "Find & Book Top Specialists Near You on "}</span>
            <span>
              {/* mr- instead of a trailing "Doctor " text space — inline-block trims trailing
                  whitespace at its own edge, so a plain space character here would silently
                  collapse to nothing between the two words. */}
              <span className="inline-block mr-3 sm:mr-4">Doctor</span>
              <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-brand-teal to-sky-500 bg-[length:200%_auto] motion-safe:animate-gradient-shift">
                Dekho
              </span>
            </span>
          </motion.h1>
        </motion.div>
        {/* ── Search row: three independent capsules (input, location, button) instead of one
            merged pill — each reads as its own control at a glance, matching how the location
            picker used to look as its own standalone pill in the topbar. ── */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.55, ease: "easeOut" }}
          className="max-w-4xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          {/* Input capsule: Doctor/Symptom — a specialty picker used to live here too (Select
              on desktop, a Drawer on mobile), redundant with both the icon chips below
              (explicit specialty picking) and the AI smart-search fallback in
              DoctorDirectory.tsx (infers specialty from free text like "skin doctor" or a
              symptom when there's no literal match), so that slot was dropped. */}
          {/* sm:flex-1 (not bare flex-1) -- on mobile the row is flex-col, where flex-1's
              flex-basis:0% overrides the explicit h-14 height (flex-basis wins over `height`
              on the flex main axis), collapsing this capsule to ~28px instead of 56px while
              the location button next to it (no flex-1) rendered at the correct height. Only
              the sm:+ row layout needs this capsule to grow into the row's leftover width. */}
          <div className="sm:flex-1 h-14 sm:h-16 rounded-full bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05),0_0_40px_-10px_rgba(20,184,166,0.1)] ring-1 ring-black/5 hover:bg-white/90 focus-within:bg-white transition-colors w-full group relative">
            <div className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search className="w-5 h-5 text-slate-400 group-focus-within:text-brand-teal transition-colors" />
            </div>
            <input
              id="doctor-search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scrollToDoctors()}
              placeholder={t("hero.searchPlaceholder")}
              className="w-full h-full bg-transparent pl-12 sm:pl-14 pr-[80px] text-base text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none rounded-full"
            />

            <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
              {query && (
                <button
                  onClick={() => onQueryChange("")}
                  className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-300 hover:text-slate-700 transition-colors"
                >
                  <span className="text-[10px] font-bold">✕</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (!hasSpeechSupport) {
                    alert(t("hero.voiceNotSupported"));
                    return;
                  }
                  startVoiceSearch();
                }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-[0.90]",
                  isListening
                    ? "bg-rose-100 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse"
                    : "bg-slate-100 text-slate-500 hover:bg-brand-teal/10 hover:text-brand-teal"
                )}
                title={t("hero.voiceSearchTitle")}
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
          </div>

          {hasLocationProps && (
            /* Location capsule — was a standalone "Allow Location" pill in the topbar; moved
               here (and now genuinely its own capsule, not a segment squeezed into a shared
               pill) so choosing where to search sits right alongside the search input. */
            <div ref={locationRef} className="relative w-full sm:w-auto sm:max-w-[240px] shrink-0">
              <button
                onClick={handleLocationClick}
                className="w-full h-14 sm:h-16 flex items-center gap-2.5 px-5 sm:px-6 text-left rounded-full bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05),0_0_40px_-10px_rgba(20,184,166,0.1)] ring-1 ring-black/5 hover:bg-white/90 focus:outline-none transition-colors group"
              >
                {detecting ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.6)] shrink-0" />
                    <span className="text-base font-medium text-brand-teal truncate">{t("topbar.detecting")}</span>
                  </>
                ) : city ? (
                  <>
                    <MapPin className="w-5 h-5 text-brand-teal shrink-0" />
                    <span className="text-base font-medium text-slate-800 truncate">{cityLabel(city)}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
                  </>
                ) : (
                  <>
                    <MapPin className="w-5 h-5 text-slate-400 group-hover:text-brand-teal transition-colors shrink-0" />
                    <span className="text-base font-medium text-slate-500 truncate">{t("topbar.allIndia")}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Search capsule */}
          <button
            onClick={scrollToDoctors}
            className="w-full sm:w-auto h-14 sm:h-16 px-8 sm:px-10 rounded-full bg-brand-teal text-white text-base sm:text-lg font-bold shadow-[0_8px_25px_-5px_rgba(20,184,166,0.4)] hover:bg-teal-500 hover:shadow-[0_12px_30px_-5px_rgba(20,184,166,0.5)] active:scale-[0.98] transition-all duration-300 shrink-0 flex items-center justify-center gap-2"
          >
            <Search className="w-5 h-5 sm:hidden" />
            <span>{t("hero.search")}</span>
          </button>
        </motion.div>

        {/* Compact "Popular searches:" row — top specialties (by doctor-count, see
            rankedSpecialties above) as plain text tags, "Others" opens the full flat list in a
            separate panel below. Matches the reference pattern: quick scan of a few names
            inline, full directory only one click away instead of always-visible. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-sm">
          <span className="text-slate-400 font-semibold">{t("hero.popularSearches")}</span>
          {popularTags.map((s) => {
            const isActive = specialtyId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleSpecialtyPick(s.id)}
                className={cn(
                  "font-semibold underline-offset-4 decoration-2 hover:underline transition-colors",
                  isActive ? "text-brand-teal underline" : "text-slate-600 hover:text-brand-teal"
                )}
              >
                {translateSpecialty(s.id, s.name, locale)}
              </button>
            );
          })}
          <button
            ref={specialtyAnchorRef}
            onClick={toggleSpecialtyPanel}
            className="inline-flex items-center gap-1 font-bold text-brand-teal hover:underline underline-offset-4 decoration-2"
          >
            {t("hero.others")}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showSpecialtyPanel && "rotate-180")} />
          </button>
        </div>

        {/* Vita, for people who don't know which kind of doctor they need: point at her and she hops, tap to chat. */}
        <div className="mt-5 flex justify-center">
          <VitaPeek mood="welcome" size={64} text={t("vita.peekHome")} cta={t("vita.askCta")} where="home" />
        </div>
      </div>
    </section>

    {/* ── City dropdown — rendered here (fixed position, outside the hero <section>) rather
        than nested inside the location button, specifically so the hero's own
        `overflow-hidden` (used to clip its decorative background blobs) can never clip this
        panel's bottom edge again — see the long comment by `dropdownPos` above for how that
        was diagnosed. Height is capped to show exactly ~5 cities at a time with the rest
        reachable by scrolling inside the panel, per the "show 5, make it scrollable" ask. ── */}
    {showLocationDropdown && dropdownPos && cities.length > 0 && (
      <div
        ref={dropdownPanelRef}
        style={{ top: dropdownPos.top, left: dropdownPos.left, width: Math.max(dropdownPos.width, 256) }}
        className="fixed bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] z-[70] ring-1 ring-black/5 text-left overflow-hidden"
      >
        <button
          onClick={() => handleCitySelect(null)}
          className={cn(
            "w-full text-left px-5 py-3 text-sm transition-colors duration-200 border-b border-slate-100",
            !city ? "text-brand-teal bg-teal-50/50 font-bold" : "text-slate-600 font-medium hover:bg-slate-50"
          )}
        >
          🌍 {t("topbar.allIndia")}
        </button>
        {/* ~5 city rows tall (44px each); the rest scroll — overscroll-contain stops that
            scroll from chaining to the page once this list's own end is reached. */}
        <div className="max-h-[220px] overflow-y-auto overscroll-contain py-2">
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
      </div>
    )}

    {/* ── "Others" specialty mega-panel — flat list, no categories (see the constant's own
        comment for why: this business only lists allopathic specialties, so Practo-style
        Dentist/Alternative-Medicine/Therapist groupings don't apply to this data). Fixed
        position outside the <section> for the same clipping reason as the city dropdown. ── */}
    {showSpecialtyPanel && specialtyPanelPos && (
      <div
        ref={specialtyPanelRef}
        style={{ top: specialtyPanelPos.top, left: specialtyPanelPos.left, width: specialtyPanelPos.width }}
        className="fixed bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] z-[70] ring-1 ring-black/5 text-left overflow-hidden"
      >
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
            {rankedSpecialties.map((s) => {
              const isActive = specialtyId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => handleSpecialtyPick(s.id)}
                  className={cn(
                    "text-left text-sm py-1 font-medium transition-colors truncate",
                    isActive ? "text-brand-teal font-bold" : "text-slate-600 hover:text-brand-teal"
                  )}
                >
                  {translateSpecialty(s.id, s.name, locale)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* ── Allow Location prompt overlay (moved from PatientTopBar) ── */}
    {showLocationPrompt && (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl space-y-5 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100/50 flex items-center justify-center shadow-inner">
              <MapPin className="w-7 h-7 text-brand-teal" />
            </div>
            <button
              onClick={() => setShowLocationPrompt(false)}
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
                setShowLocationPrompt(false);
              }}
              className="w-full py-3.5 rounded-xl bg-brand-teal text-white font-semibold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-brand-teal/90 hover:shadow-[0_6px_20px_rgba(20,184,166,0.4)] transition-all duration-300"
            >
              {t("topbar.allowLocationConfirm")}
            </button>
            <button
              onClick={() => setShowLocationPrompt(false)}
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
