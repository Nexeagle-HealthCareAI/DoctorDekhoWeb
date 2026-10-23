"use client";

import { forwardRef } from "react";
import Link from "next/link";
import DoctorPhoto from "@/components/patient/DoctorPhoto";
import { motion } from "framer-motion";
import {
  BadgeCheck, MapPin, Award, CalendarCheck, CalendarX, Star,
  Clock, Users, ThumbsUp, Languages, ArrowRight, Percent, Phone,
} from "lucide-react";
import type { Doctor } from "@/data/patient";
import { doctorSlug, formatCount } from "@/data/patient";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { translateSpecialty } from "@/lib/i18n/specialties";
import { useNetworkStatus } from "@/lib/hooks/useNetworkStatus";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { joinAddress } from "@/lib/navigation";
import { toDialablePhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

interface DoctorCardProps {
  doctor: Doctor;
  /** Position within its row (0-2) — used to stagger entrance animations. Small and
   * bounded now that DoctorDirectory.tsx virtualizes by row, not a flat list index. */
  index?: number;
  /** From framer-motion's useReducedMotion() — disables the entrance stagger, the
   * infinite spinning discount-ribbon border, and the pulsing "next available" dot. */
  reducedMotion?: boolean;
}

// forwardRef because this renders directly inside AnimatePresence for exit
// animations — Framer Motion's PopChild clones the child with a ref to measure
// it before it unmounts, which silently fails (and can desync from the SSR
// pass) unless the component itself forwards that ref through to a DOM node.
const DoctorCard = forwardRef<HTMLDivElement, DoctorCardProps>(function DoctorCard(
  { doctor, index = 0, reducedMotion = false },
  ref
) {
  const { t, locale } = useTranslation();
  const network = useNetworkStatus();
  const { openNavigation } = useNavigation();
  const clinicLabel = doctor.hospitalName ?? doctor.clinic;
  const hospitalPhone = toDialablePhone(doctor.hospitalPhone);

  return (
    <motion.div
      ref={ref}
      initial={reducedMotion ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.42, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/doctors/${doctorSlug(doctor, doctor.city)}`}
        className="group relative bg-white rounded-[2rem] border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_-15px_rgba(20,184,166,0.18)] hover:border-brand-teal/40 active:scale-[0.98] transition-all duration-500 flex flex-col overflow-hidden hover:-translate-y-1"
      >
        {/* Promoted badge */}
        {doctor.promoted && (
          <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-sm text-white text-[10px] font-bold tracking-widest uppercase shadow-md flex items-center gap-1.5">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            {t("doctorCard.featured")}
          </div>
        )}
        {/* Premium Discount Ribbon — High visibility with glowing animated border */}
        {doctor.discountPercent !== undefined && (
          <motion.div
            initial={reducedMotion ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : { delay: (index ?? 0) * 0.07 + 0.3, type: "spring" }}
            className="absolute top-4 left-4 z-30 group-hover:-translate-y-0.5 transition-transform duration-300"
          >
            <div className="relative overflow-hidden rounded-full p-[1.5px] shadow-[0_4px_20px_-2px_rgba(244,63,94,0.5)]">
              {/* Spinning conic gradient border effect — a static ring instead when the
                  visitor prefers reduced motion. */}
              <span className={cn(
                "absolute inset-[-1000%] bg-[conic-gradient(from_90deg_at_50%_50%,#fff1f2_0%,#f43f5e_50%,#fff1f2_100%)]",
                !reducedMotion && "animate-[spin_4s_linear_infinite]"
              )} />
              {/* Inner gradient pill */}
              <div className="relative flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-3 py-1 text-[11px] font-extrabold tracking-widest text-white uppercase backdrop-blur-xl">
                <Percent className="w-3.5 h-3.5 text-white/90" />
                <span className="drop-shadow-sm">{doctor.discountPercent}% OFF</span>
              </div>
            </div>
          </motion.div>
        )}
        {/* Gradient mesh */}
        <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-slate-50/80 to-transparent pointer-events-none" />

        <div className="p-6 sm:p-7 flex flex-col flex-1 relative z-10">

          {/* ─────────────────────────────────────
              § 1  IDENTITY
              Avatar · Name · Specialty · Quals · Rating
          ───────────────────────────────────── */}
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <DoctorPhoto
                photo={doctor.photo}
                name={doctor.name}
                initials={doctor.initials}
                gradient={doctor.gradient}
                size={80}
                quality={network.type === "2g" || network.type === "slow-2g" || network.saveData ? 30 : 75}
                imageClassName="w-20 h-20 rounded-2xl object-cover shadow-[0_6px_18px_rgba(0,0,0,0.08)] border border-slate-100 bg-slate-100"
                fallbackClassName="w-20 h-20 rounded-2xl text-white flex items-center justify-center font-display font-bold text-2xl shadow-[0_6px_18px_rgba(0,0,0,0.10)] border border-white/20"
              />
              {doctor.verified && (
                <span className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-white border-2 border-white shadow flex items-center justify-center">
                  <BadgeCheck className="w-3.5 h-3.5 text-brand-teal" />
                </span>
              )}
              {/* "Online now" — manual, doctor/staff-set presence signal, distinct from the
                  schedule-derived "Available today" badge in the footer below. */}
              {doctor.isOnlineNow && (
                <span className="absolute -top-1.5 -left-1.5 flex h-4 w-4 items-center justify-center" title={t("doctorCard.onlineNow")}>
                  {!reducedMotion && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                </span>
              )}
            </div>

            {/* Text block */}
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="font-display font-bold text-slate-900 text-base leading-snug group-hover:text-brand-teal transition-colors duration-300 line-clamp-1">
                {doctor.name}
              </h3>
              <p className="text-[11px] font-bold text-brand-teal mt-0.5 tracking-wide">{doctor.specialty}</p>
              {doctor.qualifications && (
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{doctor.qualifications}</p>
              )}
              {/* Rating */}
              {doctor.rating !== undefined && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100/60">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="font-bold text-amber-700 text-[11px]">{doctor.rating.toFixed(1)}</span>
                  </div>
                  {doctor.reviewCount !== undefined && (
                    <span className="text-[10px] text-slate-400">({doctor.reviewCount.toLocaleString()})</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────
              § 2  QUICK-SCAN ROW
              Exp · Wait time
          ───────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4">
            {doctor.experienceYears > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                <Award className="w-3.5 h-3.5 text-brand-teal" />
                <b className="text-slate-800">{doctor.experienceYears}+</b> yrs exp
              </span>
            )}
            {doctor.waitTimeMins !== undefined && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                ~<b className="text-slate-800">{doctor.waitTimeMins}</b> min wait
              </span>
            )}
          </div>

          {/* ─────────────────────────────────────
              § 2b  FULL ADDRESS BLOCK
              Clinic · Street address · Area/City, State Pincode · Directions
          ───────────────────────────────────── */}
          {(clinicLabel || doctor.address || doctor.area || doctor.city || hospitalPhone) && (
            <div className="mt-3 mb-1 flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
              <MapPin className="w-3.5 h-3.5 text-brand-teal shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                {/* Line 1 — clinic / hospital name */}
                {clinicLabel && (
                  <p className="text-[11.5px] font-bold text-slate-800 leading-snug truncate">
                    {clinicLabel}
                  </p>
                )}
                {/* Line 2 — full street address, as entered on the hospital's own profile */}
                {doctor.address && (
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {doctor.address}
                  </p>
                )}
                {/* Line 3 — area/city, state, pincode + Distance */}
                {(doctor.area || doctor.city) && (
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{[doctor.area, doctor.city, doctor.state, doctor.pincode].filter(Boolean).join(", ")}</span>
                    {doctor.distanceKm !== undefined && doctor.distanceKm < 999999 && (
                      <span className="inline-flex items-center font-bold text-brand-teal bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-100">
                        🚗 {doctor.distanceKm < 1 ? "< 1" : doctor.distanceKm.toFixed(1)} km {doctor.drivingDurationMin !== undefined ? `• ${doctor.drivingDurationMin} min drive` : 'away'}
                      </span>
                    )}
                  </p>
                )}
                {/* Line 4 — the hospital's own contact number (never the doctor's). A <button>, not
                    a nested <a>, for the same reason as Directions below: the whole card is a Link. */}
                {hospitalPhone && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      window.location.href = hospitalPhone.href;
                    }}
                    className="mt-1.5 -ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11.5px] font-bold text-slate-700 hover:text-brand-teal hover:bg-teal-50 transition-colors cursor-pointer"
                    aria-label={t("doctorCard.callHospital", { hospital: clinicLabel || doctor.name, number: hospitalPhone.display })}
                    title={t("doctorCard.callHospital", { hospital: clinicLabel || doctor.name, number: hospitalPhone.display })}
                  >
                    <Phone className="w-3 h-3 text-brand-teal shrink-0" aria-hidden="true" />
                    <span className="tabular-nums">{hospitalPhone.display}</span>
                  </button>
                )}
              </div>
              {/* Directions micro-link — a <button>, not a nested <a>: the whole
                  card is already a Link, and an <a> inside an <a> is invalid
                  HTML (causes a hydration mismatch as the browser un-nests it). */}
              {doctor.latitude != null && doctor.longitude != null ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    openNavigation({
                      name: clinicLabel || doctor.name,
                      latitude: doctor.latitude,
                      longitude: doctor.longitude,
                      address: joinAddress(doctor.address, doctor.area, doctor.city, doctor.state, doctor.pincode),
                    });
                  }}
                  className="shrink-0 text-[10px] font-bold text-brand-teal hover:text-teal-700 underline underline-offset-2 mt-0.5 whitespace-nowrap cursor-pointer"
                  title={t("doctorCard.directions")}
                >
                  {t("doctorCard.directions")}
                </button>
              ) : (
                <span
                  className="shrink-0 text-[10px] font-semibold text-slate-400 mt-0.5 whitespace-nowrap cursor-not-allowed"
                  title="GPS location not provided by the hospital"
                >
                  Map not set
                </span>
              )}
            </div>
          )}


          {/* ─────────────────────────────────────
              § 3  SOCIAL PROOF
              Patients served · Recommendation bar
          ───────────────────────────────────── */}
          {(doctor.patientsServed !== undefined || doctor.recommendationPct !== undefined) && (
            <div className="mt-4 space-y-2.5">
              {doctor.patientsServed !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span className="text-[11px] text-slate-500">
                    <b className="text-slate-800">{formatCount(doctor.patientsServed)}</b> patients treated
                  </span>
                </div>
              )}
              {doctor.recommendationPct !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                      <ThumbsUp className="w-3 h-3 text-emerald-500" />
                      Patient recommendation
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">{doctor.recommendationPct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                      initial={reducedMotion ? { width: `${doctor.recommendationPct}%` } : { width: "0%" }}
                      animate={{ width: `${doctor.recommendationPct}%` }}
                      transition={reducedMotion ? { duration: 0 } : { duration: 0.9, delay: index * 0.07 + 0.35, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────
              § 4  ABOUT SNIPPET
          ───────────────────────────────────── */}
          {doctor.about && (
            <p className="mt-4 text-[11.5px] text-slate-500 leading-relaxed line-clamp-2">
              {doctor.about}
            </p>
          )}

          {/* ─────────────────────────────────────
              § 5  TAGS + LANGUAGES
          ───────────────────────────────────── */}
          <div className="mt-4 space-y-2">
            {doctor.focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {doctor.focusAreas.slice(0, 3).map((area) => (
                  <span
                    key={area}
                    className="px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-500 text-[10px] font-semibold"
                  >
                    {area}
                  </span>
                ))}
                {doctor.focusAreas.length > 3 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400 text-[10px] font-semibold">
                    +{doctor.focusAreas.length - 3}
                  </span>
                )}
              </div>
            )}
            {doctor.languages && doctor.languages.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Languages className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="text-[10px] text-slate-400 font-medium">
                  {doctor.languages.join(" · ")}
                </span>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────
              § 6  FOOTER
              Next-available · Fee · CTA
          ───────────────────────────────────── */}
          <div className="mt-auto pt-5">
            {/* Next-available + fee */}
            <div className="flex items-center justify-between gap-3 mb-3">
              {doctor.isAvailableToday === false ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <CalendarX className="w-3.5 h-3.5" />
                  Not available today
                </span>
              ) : doctor.isAvailableToday === true ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                  {/* Pulsing live dot — static when the visitor prefers reduced motion */}
                  <span className="relative flex h-2 w-2">
                    {!reducedMotion && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  Available today
                </span>
              ) : doctor.nextAvailable ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                  {/* Pulsing live dot — static when the visitor prefers reduced motion */}
                  <span className="relative flex h-2 w-2">
                    {!reducedMotion && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  {doctor.nextAvailable}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Accepting patients
                </span>
              )}

              <div className="text-right shrink-0">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Fee</span>
                {doctor.discountedFee !== undefined && doctor.fee !== undefined ? (
                  <span className="inline-flex items-baseline gap-1.5 flex-wrap justify-end">
                    <span className="text-[11px] font-semibold text-slate-400 line-through">₹{doctor.fee}</span>
                    {doctor.discountPercent !== undefined && (
                      <span className="text-[10px] font-extrabold text-rose-500 bg-rose-50 px-1 rounded-sm">
                        (-{doctor.discountPercent}%)
                      </span>
                    )}
                    <span className="font-display text-base font-extrabold text-emerald-600 ml-0.5">₹{doctor.discountedFee}</span>
                  </span>
                ) : doctor.fee !== undefined ? (
                  <span className="font-display text-base font-bold text-slate-900">₹{doctor.fee}</span>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">—</span>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="w-full py-3 rounded-xl bg-slate-900 group-hover:bg-brand-teal text-white text-sm font-bold shadow-[0_4px_14px_0_rgba(15,23,42,0.18)] group-hover:shadow-[0_8px_25px_-5px_rgba(20,184,166,0.4)] transition-all duration-500 flex items-center justify-center gap-2">
              Book Appointment
              <motion.span
                animate={reducedMotion ? {} : { x: [0, 4, 0] }}
                transition={reducedMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.8, ease: "easeInOut", repeatDelay: 0.4 }}
                className="opacity-50 group-hover:opacity-100 transition-opacity duration-300"
              >
                <ArrowRight className="w-4 h-4" />
              </motion.span>
            </div>
          </div>

        </div>
      </Link>
    </motion.div>
  );
});

export default DoctorCard;
