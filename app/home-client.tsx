"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientHero from "@/components/patient/PatientHero";
import TrustStrip from "@/components/patient/TrustStrip";
import DoctorDirectory from "@/components/patient/DoctorDirectory";
import PatientFooter from "@/components/patient/PatientFooter";
import { CITIES, cityId as makeCityId, type CityOption, type Doctor } from "@/data/patient";
import { useDoctors } from "@/lib/api/hooks";
import { detectAgain, setLocation, useSharedLocation } from "@/lib/location/store";
import { useTranslation } from "@/lib/i18n/I18nContext";

interface HomeClientProps {
  initialSpecialtyId?: string;
  initialCityId?: string;
  initialArea?: string;
  initialQuery?: string;
  /** Server-fetched doctors for this route (see src/lib/api/server.ts's getAllDoctors).
   * Passed to BOTH useDoctors() call sites below (this component's own, and
   * DoctorDirectory's) — they share one React Query cache entry by queryKey, and
   * whichever of the two mounts/observes first is the one that actually seeds it,
   * so both need the same seed to avoid depending on render order. */
  initialDoctors?: Doctor[];
  /** Server-fetched generic "chat with us" QR (see src/lib/api/server.ts's
   * getWhatsAppEntryQrCodeDataUrl) -- null when the backend endpoint is
   * unreachable/unconfigured, in which case the CTA section is simply omitted. */
  whatsAppQrCodeDataUrl?: string | null;
  /** Visible breadcrumb trail (see PageBreadcrumb) for pSEO hub pages that reuse this
   * component — e.g. /specialties/{specialty}/{city}/{area}. Previously those pages had no
   * on-site navigation trail into their own hierarchical URL structure, only the XML sitemap.
   * Omitted on the plain homepage. */
  breadcrumb?: ReactNode;
  /** This page's heading (the H1's readable text), e.g. "General Physicians in Kishanganj, Bihar". Omitted on the plain homepage. */
  pageHeading?: string;
}

export default function HomeClient({
  initialSpecialtyId = "",
  initialCityId = "",
  initialArea = "",
  initialQuery = "",
  initialDoctors,
  whatsAppQrCodeDataUrl,
  breadcrumb,
  pageHeading,
}: HomeClientProps = {}) {
  const { t } = useTranslation();
  const { data: doctorsData } = useDoctors(
    initialDoctors ? { doctors: initialDoctors, notConfigured: false } : undefined
  );

  // Build city list from live API data; fall back to static list
  const dynamicCities = useMemo<CityOption[]>(() => {
    if (!doctorsData || doctorsData.notConfigured || doctorsData.doctors.length === 0) {
      return CITIES;
    }
    const map = new Map<string, CityOption>();
    for (const d of doctorsData.doctors) {
      if (!d.city || !d.state) continue;
      const id = makeCityId(d.city, d.state);
      if (!map.has(id)) map.set(id, { id, name: d.city, state: d.state });
    }
    return map.size > 0 ? Array.from(map.values()) : CITIES;
  }, [doctorsData]);

  // The location is shared with the whole site (see src/lib/location/store.ts): detected by default
  // in the layout, and a city picked here shows in the Vita chat, and the other way round. A page made
  // for one city (/specialties/{specialty}/{city}) shows that city until the patient changes it.
  const shared = useSharedLocation();
  const [pageCity, setPageCity] = useState<CityOption | null>(() =>
    initialCityId ? dynamicCities.find((c) => c.id === initialCityId) ?? null : null
  );
  const sharedCity = useMemo(
    () => (shared.city ? dynamicCities.find((c) => c.id === shared.city?.id) ?? shared.city : null),
    [shared.city, dynamicCities]
  );
  const city = pageCity ?? sharedCity;
  const userPicked = pageCity !== null || shared.source === "picked";
  const geo = {
    status: shared.status,
    coords: shared.coords ? { lat: shared.coords.lat, lon: shared.coords.lng } : null,
  };

  function handleCityChange(next: CityOption | null) {
    setPageCity(null);
    setLocation({ city: next }, "picked");
  }

  // "Allow Location": detect again, and let the result replace a picked city.
  const handleRequestLocation = useCallback(() => {
    setPageCity(null);
    void detectAgain();
  }, []);

  // Search + specialty state (shared between Hero and Directory)
  const [query, setQuery] = useState(initialQuery);
  const [specialtyId, setSpecialtyId] = useState(initialSpecialtyId);

  function handleSpecialtySelect(id: string) {
    setSpecialtyId(id);
    if (id) {
      setTimeout(
        () =>
          document
            .getElementById("doctors")
            ?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-800">
      <AnalyticsTracker title="Doctor Dekho — Find a Doctor Near Me | NexEagle" />

      {/* Topbar: Doctor Dekho brand */}
      <PatientTopBar />

      {breadcrumb}

      <main className="flex-1">
        {/* Compact search section (replaces old hero) — location picker now lives inside its
            search pill, see PatientHero, rather than as a separate topbar pill. */}
        <PatientHero
          query={query}
          onQueryChange={setQuery}
          specialtyId={specialtyId}
          onSpecialtyChange={handleSpecialtySelect}
          geoStatus={geo.status}
          city={city}
          cities={dynamicCities}
          onCityChange={handleCityChange}
          onRequestLocation={handleRequestLocation}
          pageHeading={pageHeading}
        />

        <TrustStrip />

        {/* Doctor grid with location banner integrated inside */}
        <DoctorDirectory
          city={city}
          cities={dynamicCities}
          area={initialArea}
          geoStatus={geo.status}
          // Once the user manually picks a city, stop filtering by raw GPS distance —
          // otherwise the picked city only changed the display label while DoctorDirectory's
          // coords-first filtering silently kept showing doctors near the real device location.
          coords={userPicked ? null : geo.coords}
          onCityChange={handleCityChange}
          query={query}
          specialtyId={specialtyId}
          initialDoctors={initialDoctors}
        />
      </main>

      {whatsAppQrCodeDataUrl && (
        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2 text-brand-teal">
              <MessageCircle className="w-5 h-5" />
              <p className="text-sm font-bold uppercase tracking-wide">{t("home.whatsappQrTitle")}</p>
            </div>
            <p className="max-w-md text-sm text-slate-500">{t("home.whatsappQrSubtitle")}</p>
            {/* Data URL, not a Next <Image> -- see the same note on DoctorDetailClient's QR. */}
            <img
              src={whatsAppQrCodeDataUrl}
              alt={t("home.whatsappQrTitle")}
              className="mt-2 h-40 w-40 rounded-xl border border-slate-200 bg-white p-2"
              width={160}
              height={160}
            />
          </div>
        </section>
      )}

      <PatientFooter />
    </div>
  );
}
