"use client";

import { SITE_URL } from "@/lib/site";
import { useEffect } from "react";
import DoctorPhoto from "@/components/patient/DoctorPhoto";
import Link from "next/link";
import {
  ChevronLeft,
  MapPin,
  Navigation,
  Award,
  BadgeCheck,
  Users2,
  ShieldCheck,
  Clock,
  ThumbsUp,
  Languages,
} from "lucide-react";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import DoctorViewTracker from "@/components/patient/DoctorViewTracker";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";
import BookingPanel from "@/components/patient/BookingPanel";
import ReviewsSection from "@/components/patient/ReviewsSection";
import DoctorCard from "@/components/patient/DoctorCard";
import DoctorLocationMap from "@/components/patient/DoctorLocationMap";
import ShareButton from "@/components/patient/ShareButton";
import { RatingBadge } from "@/components/patient/StarRating";
import { getDirectionsUrl, formatCount, cityId, CITIES, specialties, type Doctor } from "@/data/patient";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { joinAddress } from "@/lib/navigation";
import { trackEvent, recordLead } from "@/lib/analytics";

interface DoctorDetailClientProps {
  doctor: Doctor;
  similarDoctors: Doctor[];
  canonicalSlug: string;
  locationLine: string;
  /** NexEagle-logo QR routing straight into a WhatsApp booking flow for THIS doctor (see the
   * bot's DRBOOK trigger) -- null when the backend QR endpoint is unreachable/unconfigured,
   * in which case the card below is simply omitted rather than showing a broken image. */
  whatsAppQrCodeDataUrl?: string | null;
}

export default function DoctorDetailClient({ doctor, similarDoctors, canonicalSlug, locationLine, whatsAppQrCodeDataUrl }: DoctorDetailClientProps) {
  const { t } = useTranslation();
  const { openNavigation } = useNavigation();

  // "Search-to-View Rate" + "Specialty Demand" for the CMS Insights tab — this is the one place
  // that knows both doctorId and specialtyId together for a profile view (a plain WebsiteVisit
  // page-view row only has the URL path, not the specialty).
  useEffect(() => {
    trackEvent("doctor_profile_viewed", { doctorId: doctor.id, specialtyId: doctor.specialtyId });
    // Lead Generation (easyHMSWeb) -- a profile view is a "broader signal" lead per this
    // requirement's scope, attributed to the doctor's hospital. Guarded on hospitalId being
    // present (real API only, see the Doctor type's own comment).
    if (doctor.hospitalId) {
      recordLead({ hospitalId: doctor.hospitalId, doctorId: doctor.id, leadType: "DoctorProfileView" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor.id]);

  // "View all {specialty} in {city}" must resolve to a real /specialties/{specialty}/{city}
  // page or it 404s. That route validates specialty against the curated `specialties` list and
  // city against `CITIES` keyed by cityId(name, state) — never a bare lowercased city name,
  // since city names collide across states (see CITIES's own comment in data/patient.ts). Only
  // render the link when both resolve to a real, statically-generated page.
  const specialtyIsCanonical = specialties.some((s) => s.id === doctor.specialtyId);
  const doctorCityId = doctor.state ? cityId(doctor.city, doctor.state) : undefined;
  const cityIsCanonical = doctorCityId ? CITIES.some((c) => c.id === doctorCityId) : false;
  const viewAllHref =
    specialtyIsCanonical && cityIsCanonical ? `/specialties/${doctor.specialtyId}/${doctorCityId}` : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <AnalyticsTracker title={`${doctor.name} — ${doctor.specialty} | NexEagle Doctor Dekho`} />
      <DoctorViewTracker doctorId={doctor.id} />

      {/* Patient topbar (no geo props needed on this page) */}
      <PatientTopBar showBackButton={true} />

      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-teal transition mb-6"
          >
            <ChevronLeft className="w-4 h-4" /> {t("doctorDetail.allDoctors")}
          </Link>

          {/* ── DESKTOP: 2/3 + 1/3 grid. MOBILE: identity card → booking panel → everything
              else, via order-* + explicit grid placement, so a mobile visitor sees who the
              doctor is and can start booking before scrolling through About/Reviews. ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">

            {/* ───────── Doctor identity card (own grid item — order-1 on mobile) ───────── */}
            <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">

              {/* Doctor identity card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
                <div className="flex gap-5 items-start">
                  {/* Avatar */}
                  <DoctorPhoto
                    photo={doctor.photo}
                    name={doctor.name}
                    initials={doctor.initials}
                    gradient={doctor.gradient}
                    size={112}
                    imageClassName="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover shadow-md shrink-0 bg-slate-100"
                    fallbackClassName="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl text-white flex items-center justify-center font-extrabold text-3xl shadow-md shrink-0"
                  />

                  {/* Identity */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                        {doctor.name}
                        {doctor.verified && (
                          <BadgeCheck className="w-5 h-5 text-brand-teal shrink-0" />
                        )}
                      </h1>
                      <ShareButton
                        title={t("shareButton.bookAppointmentTitle", { name: doctor.name })}
                        text={t("shareButton.shareText", { name: doctor.name, specialty: doctor.specialty, city: doctor.city })}
                        url={`${SITE_URL}/doctors/${canonicalSlug}`}
                      />
                    </div>
                    <p className="text-sm font-bold text-brand-teal mt-1">{doctor.specialty}</p>
                    {doctor.qualifications && (
                      <p className="text-sm text-slate-500 mt-0.5">{doctor.qualifications}</p>
                    )}

                    {/* Rating */}
                    {doctor.rating !== undefined && (
                      <div className="mt-2">
                        <RatingBadge rating={doctor.rating} reviewCount={doctor.reviewCount} size="md" />
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      {doctor.experienceYears > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <Award className="w-3.5 h-3.5 text-brand-teal" />
                          <b className="text-slate-800">{doctor.experienceYears}</b> {t("doctorDetail.yearsExperience")}
                        </span>
                      )}
                      {doctor.patientsServed !== undefined && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <Users2 className="w-3.5 h-3.5 text-brand-teal" />
                          <b className="text-slate-800">{formatCount(doctor.patientsServed)}</b> {t("doctorDetail.patients")}
                        </span>
                      )}
                      {doctor.recommendationPct !== undefined && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                          <b className="text-slate-800">{doctor.recommendationPct}%</b> {t("doctorDetail.recommend")}
                        </span>
                      )}
                      {doctor.waitTimeMins !== undefined && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-sky-400" />
                          ~<b className="text-slate-800">{doctor.waitTimeMins} min</b> {t("doctorDetail.wait")}
                        </span>
                      )}
                      <Link
                        href="/about#verification"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-teal transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
                        {t("doctorDetail.verifiedProfile")}
                      </Link>
                    </div>

                    {/* Languages */}
                    {doctor.languages && doctor.languages.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        <Languages className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="flex flex-wrap gap-1.5">
                          {doctor.languages.map((lang) => (
                            <span
                              key={lang}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold"
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Book CTA moved to fixed bottom bar */}
              </div>
            </div>

            {/* ───────── Rest of doctor info (own grid item — order-3 on mobile, after booking) ───────── */}
            <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2 space-y-6">

              {/* Practices at */}
              {locationLine && (() => {
                // A GPS pin, or failing that an address text search, is enough to get directions
                // (the navigation overlay geocodes the address) -- same condition as before.
                const canNavigate = getDirectionsUrl(doctor) !== null;
                const hasMapPin = doctor.latitude != null && doctor.longitude != null;
                const navAddress = joinAddress(doctor.address, doctor.city, doctor.state, doctor.pincode);
                const navName = doctor.hospitalName || doctor.name;
                return (
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
                    <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">
                      {t("doctorDetail.practicesAt")}
                    </h2>
                    {doctor.latitude != null && doctor.longitude != null && (
                      <div className="mb-3">
                        <DoctorLocationMap
                          latitude={doctor.latitude}
                          longitude={doctor.longitude}
                          label={navName}
                          address={navAddress}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-brand-teal flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {doctor.hospitalName && (
                          <p className="font-bold text-sm text-slate-900 truncate">{doctor.hospitalName}</p>
                        )}
                        {doctor.address && (
                          <p className="text-xs text-slate-600 mt-0.5">{doctor.address}</p>
                        )}
                        {doctor.city && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {doctor.city}{doctor.state ? `, ${doctor.state}` : ""}{doctor.pincode ? ` – ${doctor.pincode}` : ""}
                          </p>
                        )}
                      </div>
                      {/* The map preview above already has its own Directions button, so this one only
                          shows when there's no map pin (address-only doctors) -- otherwise two identical
                          buttons sit right on top of each other. */}
                      {canNavigate && !hasMapPin && (
                        <button
                          type="button"
                          onClick={() =>
                            openNavigation({ name: navName, latitude: doctor.latitude, longitude: doctor.longitude, address: navAddress })
                          }
                          className="inline-flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-xl bg-brand-teal text-white text-xs font-bold shadow-sm hover:bg-brand-teal/90 active:scale-[0.98] transition"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          {t("doctorCard.directions")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* About */}
              {doctor.about && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
                  <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">{t("doctorDetail.about")}</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">{doctor.about}</p>
                </div>
              )}

              {/* Focus areas */}
              {doctor.focusAreas.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
                  <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">{t("doctorDetail.focusAreas")}</h2>
                  <div className="flex flex-wrap gap-2">
                    {doctor.focusAreas.map((area) => (
                      <span
                        key={area}
                        className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 text-xs font-semibold"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews Section */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
                <ReviewsSection
                  doctorId={doctor.id}
                  doctorName={doctor.name}
                />
              </div>
            </div>

            {/* ───────── Booking Panel ─────────
                order-2 on mobile: appears right after the identity card, before Practices
                At/About/Reviews, so booking is reachable without scrolling past all of that.
                lg:row-span-2 so on desktop it still spans both rows of the left column (identity
                card + rest-of-content) — needed for lg:sticky to track the full scroll height,
                same as before this was split into two left-column grid items.
                lg:max-h + overflow-y-auto so the panel scrolls WITHIN itself once its own
                content (e.g. the multi-block "done" success state) is taller than the
                viewport — otherwise the sticky positioning pins it in place with no way to
                reach the rest of it, since the outer page has nowhere further to scroll. */}
            <div
              id="book"
              className="order-2 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain"
            >
              <BookingPanel doctor={doctor} />

              {whatsAppQrCodeDataUrl && (
                <div className="mt-4 rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white flex flex-col items-center text-center">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {t("doctorDetail.whatsappQrTitle")}
                    </h3>
                    <p className="mt-0.5 text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">
                      {t("doctorDetail.whatsappQrSubtitle", { doctor: doctor.name })}
                    </p>
                  </div>
                  <div className="flex justify-center p-6">
                    {/* Data URL, not a Next <Image> -- next/image requires a configured remote
                        loader or local file for anything that isn't already a plain <img>-style
                        src, and a base64 data URL doesn't benefit from its optimization pipeline
                        anyway (already a small, final PNG). */}
                    <img
                      src={whatsAppQrCodeDataUrl}
                      alt={t("doctorDetail.whatsappQrSubtitle", { doctor: doctor.name })}
                      className="h-40 w-40 rounded-xl border border-slate-100"
                      width={160}
                      height={160}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SEO Semantic Silo: Similar Doctors ── */}
        {similarDoctors.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 mt-12">
            <h3 className="font-display text-2xl font-extrabold text-slate-900 mb-6">
              {t("doctorDetail.similarIn", { specialty: doctor.specialty, city: doctor.city })}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarDoctors.map((doc) => (
                <DoctorCard key={doc.id} doctor={doc} />
              ))}
            </div>
            {viewAllHref && (
              <div className="mt-8">
                <Link
                  href={viewAllHref}
                  className="inline-flex items-center text-brand-teal font-bold hover:underline"
                >
                  {t("doctorDetail.viewAllIn", { specialty: doctor.specialty, city: doctor.city })} &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      <PatientFooter />

      {/* Redundant MOBILE FIXED BOTTOM CTA removed */}
    </div>
  );
}
