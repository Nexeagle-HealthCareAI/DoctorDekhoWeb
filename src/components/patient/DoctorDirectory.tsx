"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useIsRestoring } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Frown, Loader2, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, MapPin, Sparkles } from "lucide-react";
import DoctorCard from "./DoctorCard";
import EmergencyBanner from "./EmergencyBanner";
import { specialties, cityLabel } from "@/data/patient";
import type { CityOption, Doctor } from "@/data/patient";
import { usePaginatedDoctors, useSmartSearch, type SmartSearchIntent } from "@/lib/api/hooks";
import { haversineDistance, getDrivingDistances, type GeoStatus } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { trackEvent, recordLead } from "@/lib/analytics";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { translateSpecialty } from "@/lib/i18n/specialties";
import type { TranslationKey } from "@/lib/i18n/dictionaries/en";

// Doctors shown per pagination page (numbered Previous/Next controls), independent of the
// server's own fetch batch size (still 24/request — see usePaginatedDoctors) — that's an
// internal loading-efficiency detail, not what a patient sees on screen at once.
const PAGE_SIZE = 10;

interface DoctorDirectoryProps {
  city: CityOption | null;
  cities: CityOption[];
  area?: string;
  geoStatus: GeoStatus;
  coords?: { lat: number; lon: number } | null;
  onCityChange: (city: CityOption | null) => void;
  query: string;
  specialtyId: string;
  /** Server-fetched, already-filtered doctors for this route (see src/lib/api/server.ts's
   * getAllDoctors + src/lib/filters/doctorLocation.ts). Seeds the first render — server AND
   * client hydration pass — with real content instead of an empty array. */
  initialDoctors?: Doctor[];
}

// Builds the compact page-number list for the pagination bar — all pages when there are few
// (<=7), otherwise first/last plus a moving window around the current page with "ellipsis"
// markers, so the bar stays a fixed, scannable width even once a specialty/city has many pages.
function paginationItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

type SortKey = "relevance" | "distance" | "experience" | "patients" | "fee" | "rating";

const sortOptions: { key: SortKey; labelKey: TranslationKey }[] = [
  { key: "relevance", labelKey: "directory.sortRelevance" },
  { key: "distance", labelKey: "directory.sortDistance" },
  { key: "rating", labelKey: "directory.sortRating" },
  { key: "experience", labelKey: "directory.sortExperience" },
  { key: "fee", labelKey: "directory.sortFee" },
];

export default function DoctorDirectory({
  city,
  cities,
  area,
  geoStatus,
  coords,
  onCityChange,
  query,
  specialtyId,
  initialDoctors,
}: DoctorDirectoryProps) {
  const { t, locale } = useTranslation();
  const [sort, setSort] = useState<SortKey>("relevance");
  const [radius, setRadius] = useState<number>(100);
  const [drivingData, setDrivingData] = useState<Record<string, { distanceKm: number, durationMin: number }>>({});
  const reducedMotion = useReducedMotion();

  // City/State are pushed server-side (the one unambiguous, always-correct filter — no
  // fallback-matching concerns, unlike specialty text) whenever a fixed city is active.
  // Live GPS "near me" browsing (coords set) has no server-side lat/lon filter, so it stays
  // unscoped here and is narrowed by the existing client-side haversine+radius filter below,
  // same as before pagination — just now applied incrementally as pages load in.
  const serverCity = !coords && city ? city.name : undefined;
  const serverState = !coords && city ? city.state : undefined;

  const hasSeedData = initialDoctors !== undefined;
  const {
    doctors: allDoctors,
    totalCount: serverTotalCount,
    isLoading: queryIsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError: pagesErrored,
  } = usePaginatedDoctors({ city: serverCity, state: serverState }, initialDoctors);
  // The QueryClient persists to localStorage (see app/providers.tsx), so on a
  // repeat visit the client's very first render can already see a *restored*
  // cache — before the server ever rendered anything — while SSR always starts
  // from a clean "loading" state (no localStorage access). That mismatch (server
  // says "loading", client says "0 results") trips a hydration warning. Treat
  // "still restoring the persisted cache" as loading too, so the first client
  // render matches what the server sent — UNLESS we already seeded real content
  // server-side (`hasSeedData`), in which case the server rendered real doctor
  // cards and forcing "loading" on the client's hydration pass would flash a
  // spinner over content that's already correct, reintroducing the same class
  // of mismatch this guard was written to prevent.
  const isRestoring = useIsRestoring();
  const isLoading = queryIsLoading || (isRestoring && !hasSeedData);

  const specialtyMeta = specialties.find((s) => s.id === specialtyId);
  const specialtyName = specialtyMeta ? translateSpecialty(specialtyMeta.id, specialtyMeta.name, locale) : undefined;

  // Location (coords/area) + specialty-chip filtering — everything except the free-text
  // query, since the AI fallback below needs to re-filter from this same base rather than
  // the literal keyword match. City itself is already server-filtered above (serverCity/
  // serverState); area isn't, so it's still applied here.
  const baseFiltered = useMemo(() => {
    let list = allDoctors;
    if (coords) {
      list = list.map(d => {
        if (d.latitude != null && d.longitude != null) {
          return { ...d, distanceKm: haversineDistance(coords.lat, coords.lon, d.latitude, d.longitude) };
        }
        return { ...d, distanceKm: 999999 };
      }).filter(d => d.distanceKm! <= radius || d.distanceKm === 999999); // dynamic radius + include doctors missing GPS
    } else if (city && area) {
      list = list.filter((d) => d.area === area);
    }
    if (specialtyId) list = list.filter((d) => d.specialtyId === specialtyId);
    return list;
  }, [allDoctors, city, area, coords, specialtyId, radius]);

  // Plain literal keyword match — instant, free, handles most real searches (doctor name,
  // specialty name, a focus-area word) with zero network cost.
  const keywordFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseFiltered;
    return baseFiltered.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.specialty.toLowerCase().includes(q) ||
        d.focusAreas.some((a) => a.toLowerCase().includes(q))
    );
  }, [baseFiltered, query]);

  // ── AI search fallback ──────────────────────────────────────────────────
  // Only fires when the literal keyword match above comes up empty AND the query looks
  // like more than a stray keystroke — i.e. exactly the "typed/spoke a symptom description
  // instead of a doctor/specialty name" case a plain substring match can't handle.
  const smartSearch = useSmartSearch();
  const [aiIntent, setAiIntent] = useState<SmartSearchIntent | null>(null);
  const [aiTriedForQuery, setAiTriedForQuery] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 4 || keywordFiltered.length > 0) {
      if (aiIntent) setAiIntent(null);
      return;
    }
    if (aiTriedForQuery === q) return;
    setAiTriedForQuery(q);
    smartSearch.mutate(q, {
      onSuccess: (intent) => {
        if (!intent.notConfigured) setAiIntent(intent);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, keywordFiltered.length]);

  // ── Emergency check for keyword matches ─────────────────────────────────
  // The AI fallback above only runs when the keyword match is empty, so symptom text that
  // happens to match a doctor's profile ("chest pain", "saans") used to skip the router and its
  // emergency check entirely. This asks the router ONLY "is this an emergency?" (safetyOnly:
  // router only, never Groq, ~20 ms server-side) for every 4+ character search that DID match
  // doctors. The keyword results stay exactly as they are; only the banner can change.
  const safetyCheck = useSmartSearch();
  const [safetyEmergency, setSafetyEmergency] = useState<SmartSearchIntent["emergency"]>(null);
  const [safetyCheckedQuery, setSafetyCheckedQuery] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 4 || keywordFiltered.length === 0) {
      if (safetyEmergency) setSafetyEmergency(null);
      return;
    }
    if (safetyCheckedQuery === q) return;
    setSafetyCheckedQuery(q);
    setSafetyEmergency(null);
    safetyCheck.mutate(
      { query: q, safetyOnly: true },
      {
        onSuccess: (intent) => {
          // Ignore a late answer for a query the patient has already replaced.
          if (query.trim() === q) setSafetyEmergency(intent.emergency);
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, keywordFiltered.length]);

  // Whichever path ran, an emergency answer wins over everything else on the page.
  const emergency = aiIntent?.emergency ?? safetyEmergency;

  const aiFiltered = useMemo(() => {
    if (!aiIntent) return null;
    let list = baseFiltered;
    if (aiIntent.specialtyIds.length > 0) {
      // Merge silently across every close-call candidate the router returned (not just the
      // top pick) — a plain headache genuinely might mean Neurology OR General Physician,
      // and forcing only #1 would hide correct doctors on ambiguous queries. Display order
      // within this wider set is handled by aiCandidateRank below, in the main sort.
      const idSet = new Set(aiIntent.specialtyIds);
      list = list.filter((d) => idSet.has(d.specialtyId));
    }
    if (aiIntent.city && aiIntent.city !== "NEAR_ME") {
      const cityQ = aiIntent.city.toLowerCase();
      const cityMatched = list.filter((d) => d.city?.toLowerCase().includes(cityQ));
      if (cityMatched.length > 0) list = cityMatched;
    }
    if (list.length === 0 && aiIntent.keywords.length > 0) {
      const kws = aiIntent.keywords.map((k) => k.toLowerCase());
      list = baseFiltered.filter((d) =>
        kws.some(
          (k) =>
            d.specialty.toLowerCase().includes(k) ||
            d.focusAreas.some((a) => a.toLowerCase().includes(k)) ||
            (d.about ?? "").toLowerCase().includes(k)
        )
      );
    }
    return list;
  }, [baseFiltered, aiIntent]);

  // Position of each candidate specialty in the router's own ranking (0 = top pick) — used
  // below so the merged multi-specialty result list still shows the top pick's doctors first,
  // rather than interleaving them with runner-up specialties in arbitrary order.
  const aiCandidateRank = useMemo(() => {
    if (!aiIntent || aiIntent.specialtyIds.length < 2) return null;
    const rank = new Map<string, number>();
    aiIntent.specialtyIds.forEach((id, idx) => {
      if (!rank.has(id)) rank.set(id, idx);
    });
    return rank;
  }, [aiIntent]);

  const usingAiResults = keywordFiltered.length === 0 && aiFiltered !== null && aiFiltered.length > 0;
  const aiSpecialtyMeta = aiIntent?.specialtyId ? specialties.find((s) => s.id === aiIntent.specialtyId) : undefined;
  const aiSpecialtyName = aiSpecialtyMeta ? translateSpecialty(aiSpecialtyMeta.id, aiSpecialtyMeta.name, locale) : undefined;

  const filtered = useMemo(() => {
    const base = usingAiResults && aiFiltered ? aiFiltered : keywordFiltered;
    // Inject driving data if available
    const mapped = base.map(d => {
      const drive = drivingData[d.id];
      if (drive) {
        return { ...d, distanceKm: drive.distanceKm, drivingDurationMin: drive.durationMin };
      }
      return d;
    });

    const sorted = [...mapped];
    switch (sort) {
      case "distance":
        sorted.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "experience":
        sorted.sort((a, b) => b.experienceYears - a.experienceYears);
        break;
      case "fee":
        sorted.sort((a, b) => (a.fee ?? 9999) - (b.fee ?? 9999));
        break;
      default: // relevance (candidate rank when merged across specialties, then promoted, then rating/experience)
        sorted.sort((a, b) => {
          if (usingAiResults && aiCandidateRank) {
            const rankA = aiCandidateRank.get(a.specialtyId) ?? aiCandidateRank.size;
            const rankB = aiCandidateRank.get(b.specialtyId) ?? aiCandidateRank.size;
            if (rankA !== rankB) return rankA - rankB;
          }
          if (a.promoted && !b.promoted) return -1;
          if (!a.promoted && b.promoted) return 1;
          const scoreA = (a.rating ?? 0) * 10 + a.experienceYears;
          const scoreB = (b.rating ?? 0) * 10 + b.experienceYears;
          return scoreB - scoreA;
        });
    }
    return sorted;
  }, [keywordFiltered, aiFiltered, usingAiResults, aiCandidateRank, sort, drivingData]);

  // ── Pagination ───────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // A filter/sort change can shrink the result set out from under whatever page the user was
  // on (e.g. viewing page 3 of "all doctors", then picking a specialty with only 1 page of
  // matches) — reset to page 1 whenever the inputs that reshape `filtered` change, rather than
  // silently landing on a now-empty or out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [query, specialtyId, city?.id, area, sort, usingAiResults]);

  // On-demand server-page fetching: only pull another server page (24 doctors) when the page
  // the visitor is actually ON needs data beyond what's loaded so far — NOT an eager
  // background drain of the entire server-side dataset. An earlier version fetched every
  // remaining server page proactively (just to show an exact "Page X of 48" count up front),
  // which against a directory with dozens of pages meant 40+ requests fired in quick
  // succession on every load — a real burst against the live EasyHMS environment, and a
  // contributor to observed 503s. This was never actually necessary: the very first page
  // response already reports `totalCount`, which is enough to size the pagination control
  // without fetching anything further (see `pageCount` below) — further pages are then only
  // fetched exactly when a visitor pages far enough to need them, capped at one attempt after
  // any failure (`pagesErrored`) so a struggling upstream can't be retried forever.
  useEffect(() => {
    if (isLoading || isFetchingNextPage || !hasNextPage || pagesErrored) return;
    const neededForCurrentPage = page * PAGE_SIZE;
    if (filtered.length >= neededForCurrentPage) return;
    fetchNextPage();
  }, [isLoading, isFetchingNextPage, hasNextPage, pagesErrored, page, filtered.length, fetchNextPage]);

  // Fetch real driving distances from OSRM for the top displayed doctors
  useEffect(() => {
    if (!coords) return;
    
    // Find doctors in the current list that have GPS but lack driving data
    const pending = filtered
      .filter(d => d.latitude != null && d.longitude != null && !drivingData[d.id])
      .slice(0, 50); // limit to 50 to respect OSRM public API limits
      
    if (pending.length === 0) return;

    const destinations = pending.map(d => ({
      id: d.id,
      lat: d.latitude!,
      lon: d.longitude!
    }));

    getDrivingDistances(coords.lat, coords.lon, destinations).then(results => {
      if (Object.keys(results).length > 0) {
        setDrivingData(prev => ({ ...prev, ...results }));
      }
    });
  }, [filtered, coords, drivingData]);

  // Debounced "search settled" tracking for the CMS "All Searches" report — fires ~800ms after
  // the last change to query/specialty/results rather than per keystroke, and only when there's
  // an actual search intent (free-text query or a specialty filter), not the default browse-all
  // state. This is the only place that knows the final result count, so it's the natural home for
  // this event rather than the search box itself (PatientHero.tsx).
  // One event per distinct search: results growing as more pages load, or this effect re-running
  // for the same query, must not log the search again (it used to, inflating the CMS search counts).
  const lastLoggedSearchRef = useRef<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q && !specialtyId) return;
    // Wait for the symptom router: logging before it answers recorded the same search twice
    // (once without AI results, once with).
    if (smartSearch.isPending || safetyCheck.isPending) return;

    const handle = setTimeout(() => {
      // When the AI path drove the results, log what it ACTUALLY predicted (aiIntent's own
      // specialtyId) rather than the manual filter chip's specialtyId state — the two aren't
      // the same thing: the AI fallback only fires when there's no manual filter match, so
      // logging the ambient `specialtyId` here would either be empty or, worse, stale from a
      // previous manual selection. This is what feeds the 1HMS-NLP-Router feedback loop, so
      // getting the predicted value right matters.
      const loggedSpecialtyId = usingAiResults ? aiIntent?.specialtyId ?? undefined : specialtyId || undefined;
      const searchKey = `${q.toLowerCase()}|${loggedSpecialtyId ?? ""}|${usingAiResults}`;
      if (lastLoggedSearchRef.current === searchKey) return;
      lastLoggedSearchRef.current = searchKey;

      trackEvent("search_performed", {
        specialtyId: loggedSpecialtyId,
        metadata: {
          query: q || undefined,
          resultsCount: filtered.length,
          aiUsed: usingAiResults,
          method: usingAiResults ? aiIntent?.method ?? undefined : undefined,
          confidence: usingAiResults ? aiIntent?.confidence ?? undefined : undefined,
          modelVersion: usingAiResults ? aiIntent?.modelVersion ?? undefined : undefined,
          // Router decision (answer / clarify / abstain) and whether an emergency banner was
          // shown, from either path — lets the CMS count how often patients see the warning.
          decision: usingAiResults ? aiIntent?.decision ?? undefined : undefined,
          emergency: emergency ? true : undefined,
          emergencySource: emergency?.source,
          emergencyReasons: emergency && emergency.reasons.length > 0 ? emergency.reasons : undefined,
          // Full candidate set the router considered, not just the top pick — lets the
          // feedback-log correlation (CMSAPI SymptomRouterRepository) tell a genuine
          // misprediction apart from a booking that landed on a close-call runner-up we
          // deliberately showed. See CANDIDATE_MARGIN in the 1HMS-NLP-Router repo's
          // nlp_brain/config.py.
          candidateSpecialtyIds:
            usingAiResults && aiIntent && aiIntent.specialtyIds.length > 1
              ? aiIntent.specialtyIds
              : undefined,
        },
      });

      // Lead Generation (easyHMSWeb) -- only a real typed query counts as a name-search lead,
      // not specialty-chip-only browsing (q is checked, not just specialtyId). Not trying to
      // verify the query specifically matched a doctor/hospital NAME vs. some other field --
      // "broader signal" is the deliberate scope for this requirement. Capped to the first 5
      // distinct hospitals represented in the results so a broad query can't flood one search
      // into dozens of lead rows.
      if (q) {
        const seenHospitalIds = new Set<string>();
        for (const d of filtered) {
          if (!d.hospitalId || seenHospitalIds.has(d.hospitalId)) continue;
          if (seenHospitalIds.size >= 5) break;
          seenHospitalIds.add(d.hospitalId);
          recordLead({ hospitalId: d.hospitalId, leadType: "DoctorNameSearch", searchQuery: q });
        }
      }
    }, 800);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, specialtyId, filtered.length, usingAiResults, aiIntent, smartSearch.isPending, safetyCheck.isPending, emergency]);

  // ── Paginated page slice ─────────────────────────────────────────────────
  // When browsing unfiltered (no specialty chip, free-text query, GPS radius, or area narrowing
  // the results beyond the server's own city/state scoping), `filtered` is just every doctor
  // loaded so far — so the server's own `totalCount` (reported on the very first page, no extra
  // fetch needed) gives the true page count immediately instead of only counting whatever
  // background pages happen to have loaded in by now. Any client-only filter narrows the set in
  // a way the server total can't reflect, so those cases still fall back to counting `filtered`.
  const hasClientOnlyFilter = Boolean(specialtyId || query.trim() || coords || (city && area));
  const knownTotal = !hasClientOnlyFilter && serverTotalCount > filtered.length ? serverTotalCount : filtered.length;
  // Clamped (not raw `page`) so a filter change that shrinks the result set — or a page still
  // being fetched on-demand — never indexes past the end and silently renders an empty page;
  // the effect above corrects `page` itself right after.
  const pageCount = Math.max(1, Math.ceil(knownTotal / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageDoctors = useMemo(
    () => filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE),
    [filtered, clampedPage]
  );

  // Jumping to a page (especially several pages down a long list) should return the visitor
  // to the top of the results, not leave them scrolled to wherever the old page 4 happened to
  // end — otherwise "Next" can land in the middle of nothing familiar on screen.
  function goToPage(p: number) {
    setPage(p);
    document.getElementById("doctors")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section id="doctors" className="bg-slate-50/50 pb-24 pt-10 sm:pt-16 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Premium Result Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 pb-6 border-b border-slate-200/60">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {specialtyName ? `${specialtyName} ${t("directory.specialists")}` : t("directory.topSpecialists")}
              {city ? (
                <span className="text-brand-teal"> {t("directory.inCity", { city: cityLabel(city) })}</span>
              ) : (
                <span className="text-slate-400 font-medium"> {t("directory.allIndiaSuffix")}</span>
              )}
            </h2>
            <p className="text-base text-slate-500 mt-2 font-medium">
              {isLoading ? (
                <span className="animate-pulse">{t("directory.loading")}</span>
              ) : (
                (() => {
                  const key = filtered.length === 1 ? "directory.resultCountSingular" : "directory.resultCountPlural";
                  const [before, after] = t(key).split("{n}");
                  return (
                    <>
                      {before}
                      <motion.span
                        key={filtered.length}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="font-bold text-slate-800 inline-block"
                      >
                        {filtered.length}
                      </motion.span>
                      {after}
                    </>
                  );
                })()
              )}
            </p>
          </div>

          {/* Controls Container */}
          <div className="flex items-center gap-3">
            
            {/* Radius Dropdown (Only when GPS is active) */}
            {coords && (
              <div className="relative group">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:border-brand-teal/40 transition-colors cursor-pointer">
                  <MapPin className="w-4 h-4 text-brand-teal" />
                  <select
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none cursor-pointer appearance-none pr-6"
                  >
                    {[5, 10, 25, 50, 100, 250, 500].map((km) => (
                      <option key={km} value={km}>
                        {t("directory.radiusWithin", { n: km })}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Premium Sort Dropdown */}
            <div className="relative group">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:border-brand-teal/40 transition-colors cursor-pointer">
                <SlidersHorizontal className="w-4 h-4 text-brand-teal" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none cursor-pointer appearance-none pr-6"
                >
                  {sortOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Emergency warning: always above the results, whichever search path found it ── */}
        {emergency && <EmergencyBanner reasons={emergency.reasons} />}

        {/* ── AI-enhanced results hint ── */}
        {usingAiResults && !emergency && (
          <div className="flex items-center gap-2 mb-6 -mt-4 text-sm text-brand-teal font-semibold">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              {aiSpecialtyName
                ? t("directory.aiHintWithSpecialty", { specialty: aiSpecialtyName, query: query.trim() })
                : t("directory.aiHintGeneric", { query: query.trim() })}
            </span>
          </div>
        )}

        {/* ── Grid ── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-brand-teal/50 mb-4" />
            <p className="text-base font-semibold">{t("directory.findingSpecialists")}</p>
          </div>
        ) : filtered.length === 0 && smartSearch.isPending ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Sparkles className="w-10 h-10 animate-pulse text-brand-teal/50 mb-4" />
            <p className="text-base font-semibold">{t("directory.lookingBroadly")}</p>
          </div>
        ) : filtered.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 pb-6 sm:pb-8">
              {pageDoctors.map((doctor, idx) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  index={idx}
                  reducedMotion={reducedMotion ?? false}
                />
              ))}
            </div>

            {isFetchingNextPage && (
              <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
                {t("directory.loading")}
              </div>
            )}

            {/* ── Pagination ── */}
            {pageCount > 1 && (
              <nav aria-label="Doctor results pages" className="flex items-center justify-center gap-1.5 sm:gap-2 pt-2">
                <button
                  onClick={() => goToPage(Math.max(1, clampedPage - 1))}
                  disabled={clampedPage === 1}
                  aria-label="Previous page"
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-brand-teal/40 hover:text-brand-teal disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-500 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {paginationItems(clampedPage, pageCount).map((item, i) =>
                  item === "ellipsis" ? (
                    <span key={`e-${i}`} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 text-sm">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => goToPage(item)}
                      aria-current={item === clampedPage ? "page" : undefined}
                      className={cn(
                        "w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-bold transition-colors",
                        item === clampedPage
                          ? "bg-brand-teal text-white shadow-sm shadow-teal-500/30"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-brand-teal/40 hover:text-brand-teal"
                      )}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  onClick={() => goToPage(Math.min(pageCount, clampedPage + 1))}
                  disabled={clampedPage === pageCount}
                  aria-label="Next page"
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-brand-teal/40 hover:text-brand-teal disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-500 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-32 rounded-[2rem] border border-dashed border-slate-200 bg-white shadow-sm"
          >
            <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-5 shadow-inner">
              <Frown className="w-10 h-10" />
            </div>
            <h3 className="font-display font-bold text-xl text-slate-900 mb-2">{t("directory.noMatch")}</h3>
            <p className="text-base text-slate-500 max-w-md mx-auto">
              {t("directory.noMatchDesc")}
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}
