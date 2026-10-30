"use client";

import { useEffect, useMemo, useState } from "react";
import Eagle from "@/components/patient/vita/Eagle";
import {
  ChevronLeft,
  CheckCircle2,
  Smartphone,
  Hourglass,
  Clock,
  Loader2,
  CalendarX,
  MessageCircle,
  Mail,
  Navigation,
  Sun,
  Sunset,
  Moon,
  Star,
  AlertCircle,
} from "lucide-react";
import { getDirectionsUrl, type Doctor } from "@/data/patient";
import { useCreateAppointment, useDoctorAvailability, useSubmitReview } from "@/lib/api/hooks";
import { getSavedRating, markRated } from "@/lib/ratingGuard";
import { reportEngagement } from "@/lib/pwaInstall";
import { useGuestAppointments } from "@/hooks/useGuestAppointments";
import { trackEvent } from "@/lib/analytics";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { joinAddress } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/I18nContext";
import type { TranslationKey } from "@/lib/i18n/dictionaries/en";
import type { Locale } from "@/lib/i18n/types";

// Same canonical relation-prefix set as the hospital-side PatientForm.tsx (RELATION_OPTIONS)
// — kept identical so "S/O"/"C/O"/etc. mean the same thing everywhere in the product.
const GUARDIAN_RELATIONS = ["C/O", "S/O", "D/O", "W/O", "H/O", "G/O", "F/O", "M/O"];

// 5-point emoji scale for the post-booking service rating — a quick, no-comment tap that
// feeds the SAME doctor rating shown publicly (just a friendlier entry point than stars,
// right when the patient has just finished booking).
const SERVICE_RATINGS: { value: number; emoji: string; labelKey: TranslationKey }[] = [
  { value: 1, emoji: "😞", labelKey: "booking.ratingBad" },
  { value: 2, emoji: "😕", labelKey: "booking.ratingPoor" },
  { value: 3, emoji: "😐", labelKey: "booking.ratingOkay" },
  { value: 4, emoji: "🙂", labelKey: "booking.ratingGood" },
  { value: 5, emoji: "😃", labelKey: "booking.ratingVeryGood" },
];

interface BookingPanelProps {
  doctor: Doctor;
}

type Step = "visit" | "details" | "done";
const STEP_ORDER: Step[] = ["visit", "details"];

// Sex options mapped to a compact, language-agnostic M/F/O glyph (shown on the button) plus
// a translated aria-label/title — spelled-out words don't abbreviate sensibly once translated
// (e.g. Hindi "पुरुष" or Bengali "পুরুষ" have no single-letter equivalent to M/F/O), so the
// glyph stays fixed across locales while the accessible name is still localized.
const SEX_LABEL_KEYS: Record<"Male" | "Female" | "Other", TranslationKey> = {
  Male: "booking.sexMale",
  Female: "booking.sexFemale",
  Other: "booking.sexOther",
};

// bn/hi don't have a widely-supported Intl locale distinction worth the risk here — Hinglish
// readers use Latin script so en-IN keeps weekday/month names in English, matching the register.
const DATE_LOCALE: Record<Locale, string> = { en: "en-IN", hi: "hi-IN", bn: "bn-IN", hinglish: "en-IN" };

// ── 3-hour time-range slots ────────────────────────────────────────────
const TIME_RANGES: { id: string; labelKey: TranslationKey; time: string; icon: React.ReactNode; bg: string; border: string; text: string }[] = [
  { id: "morning",   labelKey: "booking.morning",   time: "9:00 – 12:00",  icon: <Sun className="w-4 h-4" />,    bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700"   },
  { id: "afternoon", labelKey: "booking.afternoon", time: "12:00 – 3:00",  icon: <Sunset className="w-4 h-4" />, bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700" },
  { id: "evening",   labelKey: "booking.evening",   time: "3:00 – 6:00",   icon: <Star className="w-4 h-4" />,   bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  { id: "night",     labelKey: "booking.night",     time: "6:00 – 9:00",   icon: <Moon className="w-4 h-4" />,   bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-600"  },
];

export default function BookingPanel({ doctor }: BookingPanelProps) {
  const { t, locale } = useTranslation();
  const { openNavigation } = useNavigation();
  const [step, setStep] = useState<Step>("visit");

  // Booking Funnel Drop-off for the CMS Insights tab — fires once per step, including the initial
  // "visit" (date/time selection) step on mount, since arriving at this widget is itself the first
  // funnel step after Profile View. "details" = Confirm Details, "done" = Success — there's no
  // separate payment step in this product (pay-at-hospital-counter, see handleDetailsSubmit).
  useEffect(() => {
    trackEvent("booking_step_reached", { doctorId: doctor.id, specialtyId: doctor.specialtyId, metadata: { step } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, doctor.id]);

  const [date, setDate] = useState("");
  const [timeRange, setTimeRange] = useState("");
  const [preferredTime, setPreferredTime] = useState<string | undefined>();

  // Form fields
  const [name, setName]   = useState("");
  const [age, setAge]     = useState("");
  // Defaults to Male — most patients booking for themselves skip past this without a second
  // thought, so a pre-selected common default saves a tap; still fully changeable before submit.
  const [sex, setSex]     = useState<"Male" | "Female" | "Other" | "">("Male");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState(GUARDIAN_RELATIONS[0]);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverRef, setServerRef] = useState<string | null>(null);
  const [localBookingId] = useState(() => `NEX-${Math.floor(100000 + Math.random() * 900000)}`);
  const bookingId = serverRef ?? localBookingId;

  const availability = useDoctorAvailability(doctor.id, date || undefined);
  const apiActive = Boolean(availability.data && !availability.data.notConfigured);
  const createAppointment = useCreateAppointment();
  const submitReview = useSubmitReview(doctor.id);
  const { addAppointment } = useGuestAppointments();

  // Post-booking emoji rating — a quick tap, no comment, submitted straight to the doctor's
  // rating (see SERVICE_RATINGS above). Seeded from localStorage so re-booking the same
  // doctor (via "Book Another Slot") doesn't show the picker again if already rated.
  const [serviceRating, setServiceRating] = useState(() => getSavedRating(doctor.id) ?? 0);
  const [serviceRatingSaving, setServiceRatingSaving] = useState(false);

  async function handleServiceRate(value: number) {
    setServiceRating(value);
    setServiceRatingSaving(true);
    try {
      // patientMobile: the number just used to book — not OTP-verified, so this is only a
      // soft server-side dedup signal layered on top of the localStorage guard, not real
      // identity verification (see SubmitDoctorReviewHandler).
      await submitReview.mutateAsync({ rating: value, patientMobile: phone || undefined });
      markRated(doctor.id, value);
    } catch {
      /* best-effort — not worth blocking or alarming the patient over a failed rating tap */
    } finally {
      setServiceRatingSaving(false);
    }
  }

  // 7-day date strip
  const dates = useMemo(() => {
    const today = new Date();
    return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      return {
        key: d.toISOString().slice(0, 10),
        label: offset === 0 ? t("booking.today") : offset === 1 ? t("booking.tomorrow") : d.toLocaleDateString(DATE_LOCALE[locale], { weekday: "short" }),
        sub: d.toLocaleDateString(DATE_LOCALE[locale], { day: "numeric", month: "short" }),
      };
    });
  }, [t, locale]);

  function validateDetails() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t("booking.errorNameRequired");
    if (!age.trim() || isNaN(+age) || +age <= 0 || +age > 120) e.age = t("booking.errorAgeRequired");
    if (!sex) e.sex = t("booking.errorSexRequired");
    if (!/^\d{10}$/.test(phone.trim())) e.phone = t("booking.errorMobileRequired");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t("booking.errorEmailInvalid");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateDetails()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const selectedRange = TIME_RANGES.find((r) => r.id === timeRange);
      const res = await createAppointment.mutateAsync({
        doctorId: doctor.id,
        patient: {
          fullName: name,
          mobile: phone,
          age: +age,
          sex,
          ageUnit: "years",
          guardianName: guardianName.trim() || undefined,
          guardianRelation: guardianName.trim() ? guardianRelation : undefined,
        } as any,
        preferredDate: date,
        preferredTime,
        reason: [reason.trim(), selectedRange ? `Preferred window: ${t(selectedRange.labelKey)} (${selectedRange.time})` : ""].filter(Boolean).join(" | ") || undefined,
        referrerUrl: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      });
      if (res.reference) {
        setServerRef(res.reference);
        // The reference IS the backend AppointmentId (see mapBookingReference) — this is what
        // makes it show up on the guest-tier /appointments page at all. Previously never called,
        // so a successful booking simply vanished the moment the patient navigated away.
        addAppointment(res.reference, phone);
      }
      reportEngagement("booking_success");
      // Only reached on a confirmed server response — a thrown error (network/HTTP failure,
      // exactly what "book from anywhere, any connection" needs to handle) now falls to the
      // catch block below instead of silently advancing here with a fake local reference.
      setStep("done");
    } catch {
      setSubmitError(t("booking.errorSubmitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("visit"); setDate(""); setTimeRange(""); setPreferredTime(undefined);
    setName(""); setAge(""); setSex("Male"); setPhone(""); setEmail(""); setReason("");
    setGuardianName(""); setGuardianRelation(GUARDIAN_RELATIONS[0]);
    setErrors({});
    setSubmitting(false); setSubmitError(null); setServerRef(null);
    setServiceRating(getSavedRating(doctor.id) ?? 0); setServiceRatingSaving(false);
  }

  const selectedDateLabel = dates.find((d) => d.key === date)
    ? `${dates.find((d) => d.key === date)!.label} ${dates.find((d) => d.key === date)!.sub}`
    : "";
  const selectedRange = TIME_RANGES.find((r) => r.id === timeRange);
  const locationLine = [doctor.hospitalName, doctor.city].filter(Boolean).join(", ") || doctor.clinic;
  const directionsUrl = getDirectionsUrl(doctor);
  const stepIdx = STEP_ORDER.indexOf(step);

  // WhatsApp pre-filled message
  const whatsappMsg = encodeURIComponent(
    `Hi! I've booked an appointment request:\n` +
    `Doctor: ${doctor.name} (${doctor.specialty})\n` +
    `${locationLine ? `Hospital: ${locationLine}\n` : ""}` +
    `Date: ${selectedDateLabel} · ${selectedRange ? t(selectedRange.labelKey) : ""} (${selectedRange?.time ?? ""})\n` +
    `Patient: ${name} | Mobile: +91 ${phone}\n` +
    `Ref: ${bookingId}`
  );
  // Send to self on WhatsApp
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`;

  // Email mailto
  const emailSubject = encodeURIComponent(`Appointment Ref: ${bookingId} — ${doctor.name}`);
  const emailBody = encodeURIComponent(
    `Your appointment request has been placed.\n\n` +
    `Doctor: ${doctor.name} (${doctor.specialty})\n` +
    `${locationLine ? `Hospital: ${locationLine}\n` : ""}` +
    `Date: ${selectedDateLabel} | Time: ${selectedRange ? t(selectedRange.labelKey) : ""} (${selectedRange?.time ?? ""})\n` +
    `Patient: ${name} | Mobile: +91 ${phone}\n` +
    `Reference: ${bookingId}\n\n` +
    `Please note: The hospital will confirm your exact time and may call to adjust.\n` +
    `No payment needed now — you pay at the hospital.`
  );
  const mailtoUrl = email.trim()
    ? `mailto:${email.trim()}?subject=${emailSubject}&body=${emailBody}`
    : `mailto:?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-white relative">
        <span className="block text-[10px] font-bold text-brand-teal uppercase tracking-widest">
          {t("booking.appointmentRequestLabel")}
        </span>
        <div className="flex items-start justify-between gap-4 mt-0.5">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              {step === "done" ? t("booking.titleDone") : t("booking.title")}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === "done" ? t("booking.subtitleDone") : t("booking.subtitle")}
            </p>
          </div>
          {doctor.fee !== undefined && step !== "done" && (
            <div className="text-right shrink-0 bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-teal-100/50 shadow-sm">
              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t("doctorDetail.consultationFee" as any)}</span>
              {doctor.discountedFee !== undefined ? (
                <span className="inline-flex items-baseline gap-1.5 leading-none">
                  <span className="text-[11px] font-semibold text-slate-400 line-through">₹{doctor.fee}</span>
                  <span className="font-display text-base font-extrabold text-emerald-600">₹{doctor.discountedFee}</span>
                </span>
              ) : (
                <span className="font-display text-base font-extrabold text-slate-900 leading-none">₹{doctor.fee}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {step !== "done" && (
        <div className="flex gap-1 px-5 pt-4">
          {STEP_ORDER.map((s, i) => (
            <i key={s} className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden block">
              <b
                className="block h-full bg-brand-teal rounded-full transition-all duration-500"
                style={{ width: stepIdx > i ? "100%" : stepIdx === i ? "45%" : "0%" }}
              />
            </i>
          ))}
        </div>
      )}

      {/* ── STEP 1: Visit date + time range ── */}
      {step === "visit" && (
        <div className="p-5 space-y-5">
          {/* Date strip */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
              {t("booking.chooseDay")}
            </label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {dates.map((d) => (
                <button
                  key={d.key}
                  onClick={() => { setDate(d.key); setTimeRange(""); setPreferredTime(undefined); }}
                  className={cn(
                    "p-2 rounded-xl border text-center transition",
                    date === d.key
                      ? "bg-brand-teal border-brand-teal text-white shadow-md shadow-teal-500/20"
                      : "bg-white border-slate-200 hover:border-brand-teal/40 text-slate-700"
                  )}
                >
                  <span className="block text-[10px] font-bold">{d.label}</span>
                  <span className="block text-[9px] opacity-70">{d.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* API availability OR 3-hour ranges */}
          {date && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                {t("booking.preferredTimeWindow")}
              </label>
              {apiActive && availability.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
                  {t("booking.checkingAvailability")}
                </div>
              ) : availability.isError ? (
                <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
                  <AlertCircle className="w-6 h-6 text-rose-400" />
                  <p className="text-sm font-semibold text-slate-600">{t("booking.errorCheckingAvailability")}</p>
                  <button
                    type="button"
                    onClick={() => availability.refetch()}
                    className="text-xs font-bold text-brand-teal underline underline-offset-2"
                  >
                    {t("booking.retry")}
                  </button>
                </div>
              ) : apiActive && availability.data && !availability.data.isAvailable ? (
                <div className="flex flex-col items-center gap-1.5 py-6 text-slate-400">
                  <CalendarX className="w-6 h-6" />
                  <p className="text-sm font-semibold text-slate-600">{t("booking.notAvailableDate")}</p>
                  <p className="text-xs">{t("booking.pickAnotherDay")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {TIME_RANGES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => { setTimeRange(r.id); setPreferredTime(undefined); }}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-2xl border text-left transition-all",
                        timeRange === r.id
                          ? "bg-brand-teal border-brand-teal text-white shadow-md shadow-teal-500/20"
                          : `${r.bg} ${r.border} ${r.text} hover:border-brand-teal/50`
                      )}
                    >
                      <span className={cn("shrink-0", timeRange === r.id ? "text-white" : "")}>{r.icon}</span>
                      <div>
                        <div className="text-xs font-bold">{t(r.labelKey)}</div>
                        <div className={cn("text-[10px]", timeRange === r.id ? "text-teal-100" : "opacity-70")}>{r.time}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200/60 rounded-xl p-2.5">
            <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand-teal" />
            {t("booking.reservesWindowNote", { hospital: doctor.hospitalName || t("booking.hospitalFallbackLower") })}
          </div>

          <button
            disabled={!date || !timeRange}
            onClick={() => setStep("details")}
            className="w-full py-3.5 rounded-2xl bg-brand-teal text-white font-bold text-sm shadow-md shadow-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-teal/90 active:scale-[0.98] transition"
          >
            {date && timeRange ? `${t("booking.continue")} →` : t("booking.pickDayTimePrompt")}
          </button>
        </div>
      )}

      {/* ── STEP 2: Patient details ── */}
      {step === "details" && (
        <form onSubmit={handleDetailsSubmit} className="p-5 space-y-4">
          <button type="button" onClick={() => setStep("visit")} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
            <ChevronLeft className="w-4 h-4" /> {t("booking.changeWindow")}
          </button>

          {/* Selected visit summary */}
          <div className="p-3 rounded-2xl bg-teal-50 border border-teal-100 text-xs flex items-center justify-between">
            <span className="text-slate-500">{t("booking.preferredVisitLabel")}</span>
            <span className="font-bold text-slate-800">
              {selectedDateLabel} · <span className="text-brand-teal">{selectedRange ? t(selectedRange.labelKey) : ""} ({selectedRange?.time})</span>
            </span>
          </div>

          {/* Name */}
          <Field label={`${t("booking.fullName")} *`} error={errors.name}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("booking.fullNamePlaceholder")} className={inputCls(errors.name)} />
          </Field>

          {/* Age + Sex row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t("booking.age")} *`} error={errors.age}>
              <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder={t("booking.agePlaceholder")} inputMode="numeric" className={inputCls(errors.age)} />
            </Field>
            <Field label={`${t("booking.sex")} *`} error={errors.sex}>
              <div className="flex gap-1.5">
                {(["Male", "Female", "Other"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    title={t(SEX_LABEL_KEYS[s])}
                    aria-label={t(SEX_LABEL_KEYS[s])}
                    className={cn(
                      "flex-1 py-2 text-[11px] font-bold rounded-xl border transition",
                      sex === s
                        ? "bg-brand-teal border-brand-teal text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-brand-teal/40"
                    )}
                  >
                    {s[0]}
                  </button>
                ))}
              </div>
              {errors.sex && <span className="text-[10px] text-rose-500 font-bold">{errors.sex}</span>}
            </Field>
          </div>

          {/* Mobile */}
          <Field label={`${t("booking.mobile")} *`} error={errors.phone}>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-brand-teal/40 focus-within:ring-1 focus-within:ring-brand-teal/10 overflow-hidden">
              <span className="pl-3 pr-2 text-sm text-slate-400 font-semibold border-r border-slate-200">+91</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder={t("booking.mobilePlaceholder")}
                inputMode="numeric"
                className="flex-1 px-3 py-2.5 text-sm text-slate-800 bg-transparent focus:outline-none"
              />
            </div>
          </Field>

          {/* Email (optional) */}
          <Field label={t("booking.email")} error={errors.email}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("booking.emailPlaceholder")} type="email" className={inputCls(errors.email)} />
          </Field>

          {/* Guardian / relative name (optional) */}
          <Field label="Guardian / Relative Name (optional)">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-brand-teal/40 focus-within:ring-1 focus-within:ring-brand-teal/10 overflow-hidden">
              <select
                value={guardianRelation}
                onChange={(e) => setGuardianRelation(e.target.value)}
                aria-label="Relation"
                className="pl-3 pr-1.5 py-2.5 text-sm text-slate-500 font-semibold border-r border-slate-200 bg-transparent focus:outline-none cursor-pointer shrink-0"
              >
                {GUARDIAN_RELATIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Guardian / relative name"
                className="flex-1 min-w-0 px-3 py-2.5 text-sm text-slate-800 bg-transparent focus:outline-none"
              />
            </div>
          </Field>

          {/* Reason (optional) */}
          <Field label={t("booking.reason")}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("booking.reasonPlaceholder")} className={inputCls()} />
          </Field>

          {submitError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <button type="submit" disabled={submitting} className="w-full py-3.5 rounded-2xl bg-brand-teal text-white font-bold text-sm shadow-md shadow-teal-500/20 hover:bg-brand-teal/90 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("booking.bookingInProgress")}</> : submitError ? <><AlertCircle className="w-4 h-4" /> {t("booking.retry")}</> : <><CheckCircle2 className="w-4 h-4" /> {t("booking.confirmAppointment")}</>}
          </button>
        </form>
      )}



      {/* ── STEP 4: Success ── */}
      {step === "done" && (
        <div className="p-5 space-y-4">
          {/* Success icon */}
          <div className="text-center">
            {/* Vita is happy for you: she hops once, with a tick on her (still with reduced motion, just no hop). */}
            <div className="relative mx-auto mb-2 w-fit">
              <span className="vita-hop-once block">
                <Eagle mood="joyful" size={120} />
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-brand-teal/40 bg-white">
                <CheckCircle2 className="h-6 w-6 text-brand-teal" />
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">{t("booking.appointmentRequestedTitle")}</h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-1">
              {t("booking.reference")}: {bookingId}
            </p>
          </div>

          {/* Booking summary */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5 text-sm">
            <Row label={t("booking.rowDoctor")} value={`${doctor.name} · ${doctor.specialty}`} />
            <Row label={t("booking.rowPatient")} value={name} />
            <Row label={t("booking.rowAgeSex")} value={`${age} yrs · ${sex ? t(SEX_LABEL_KEYS[sex]) : sex}`} />
            <Row label={t("booking.rowMobile")} value={`+91 ${phone} ✓`} />
            {email && <Row label={t("booking.rowEmail")} value={email} />}
            {guardianName.trim() && <Row label={t("booking.rowGuardian")} value={`${guardianRelation} ${guardianName.trim()}`} />}
            <Row label={t("booking.rowVisit")} value={`${selectedDateLabel} · ${selectedRange ? t(selectedRange.labelKey) : ""} (${selectedRange?.time})`} accent />
            {locationLine && <Row label={t("booking.rowHospital")} value={locationLine} />}
          </div>

          {/* Pending notice */}
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/60">
            <Hourglass className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800">{t("booking.pendingConfirmationTitle")}</strong>{" "}
              {t("booking.pendingConfirmationBody", { hospital: doctor.hospitalName || t("booking.hospitalFallbackCap"), phone: `+91 ${phone}` })}
            </p>
          </div>

          {/* Quick service rating — tap an emoji, it saves right away */}
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/60 to-white p-4 text-center">
            {serviceRating ? (
              <p className="text-sm font-bold text-teal-700">
                {SERVICE_RATINGS.find((r) => r.value === serviceRating)?.emoji} {t("booking.thanksForRatingExperience")}
              </p>
            ) : (
              <>
                <p className="text-xs font-bold text-slate-600 mb-3">{t("booking.rateService")}</p>
                <div className="flex items-center justify-center gap-1.5">
                  {SERVICE_RATINGS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      disabled={serviceRatingSaving}
                      onClick={() => handleServiceRate(r.value)}
                      title={t(r.labelKey)}
                      className="flex flex-col items-center gap-1 px-1.5 py-2 rounded-xl hover:bg-teal-50 active:scale-90 transition disabled:opacity-40"
                    >
                      <span className="text-2xl leading-none">{r.emoji}</span>
                      <span className="text-[9px] font-bold text-slate-400">{t(r.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Directions + WhatsApp + Email buttons */}
          <div className={cn("grid gap-2", directionsUrl ? "grid-cols-3" : "grid-cols-2")}>
            {directionsUrl && (
              <button
                type="button"
                onClick={() =>
                  openNavigation({
                    name: doctor.hospitalName || doctor.name,
                    latitude: doctor.latitude,
                    longitude: doctor.longitude,
                    address: joinAddress(doctor.address, doctor.city, doctor.state, doctor.pincode),
                  })
                }
                className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-brand-teal hover:bg-brand-teal/90 text-white font-bold text-xs transition shadow-md"
              >
                <Navigation className="w-4 h-4" />
                {t("booking.directions")}
              </button>
            )}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-[#25D366] hover:bg-[#22c55e] text-white font-bold text-xs transition shadow-md"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            <a
              href={mailtoUrl}
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition shadow-md"
            >
              <Mail className="w-4 h-4" />
              {email ? t("booking.emailMeLabel") : t("booking.emailLabel")}
            </a>
          </div>

          <button
            onClick={reset}
            className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
          >
            {t("booking.bookAnother")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
      {error && <span className="text-[10px] font-bold text-rose-500">{error}</span>}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-400 font-semibold shrink-0">{label}</span>
      <span className={cn("text-xs font-bold text-right", accent ? "text-brand-teal" : "text-slate-800")}>{value}</span>
    </div>
  );
}

function inputCls(error?: string) {
  return cn(
    "w-full px-3.5 py-2.5 bg-white border rounded-xl text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-1 transition",
    error
      ? "border-rose-400 focus:border-rose-400 focus:ring-rose-100"
      : "border-slate-200 focus:border-brand-teal/40 focus:ring-brand-teal/10"
  );
}
