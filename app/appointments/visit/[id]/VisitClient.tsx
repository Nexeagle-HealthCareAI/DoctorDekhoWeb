"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Calendar, CheckCircle2, Clock, LocateFixed, MapPin, Phone, Star, Ticket } from "lucide-react";
import PatientTopBar from "@/components/patient/PatientTopBar";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { doctorSlug } from "@/data/patient";
import { TOO_FAR, type PublicVisit, type VisitToken } from "@/lib/visit/types";

// The visit page (Vita vision, Phase 4): where the WhatsApp confirmation's and reminders' "Visit details" button lands, linked from
// My appointments and from Vita. Before the visit: when and where, directions and the hospital's own visit guide. On the day: "I've
// reached: check me in" gets a queue token from 1HMS (it checks the patient is at the hospital), then the token, who is being seen and
// the expected wait, refreshed every 30 seconds. After the visit: the follow-up the doctor asked for, and a rating.

const REFRESH_MS = 30_000;

type CheckIn = "idle" | "locating" | "sending" | "too_far" | "no_location" | "failed";

export default function VisitClient({ appointmentId }: { appointmentId: string }) {
  const { t } = useTranslation();
  const [visit, setVisit] = useState<PublicVisit | null>(null);
  const [missing, setMissing] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckIn>("idle");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/appointments/${appointmentId}/visit`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.visit) {
        setMissing(true);
        return;
      }
      setVisit(body.visit as PublicVisit);
    } catch {
      setMissing(true);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  // On the day, keep the token and the wait current.
  const live = !!visit && visit.isToday && !visit.cancelled && !visit.completed;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, load]);

  const doCheckIn = () => {
    if (!("geolocation" in navigator)) {
      setCheckIn("no_location");
      return;
    }
    setCheckIn("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setCheckIn("sending");
        try {
          const res = await fetch(`/api/public/appointments/${appointmentId}/checkin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok && body?.success !== false) {
            setCheckIn("idle");
            await load();
          } else setCheckIn(TOO_FAR.test(String(body?.message ?? "")) ? "too_far" : "failed");
        } catch {
          setCheckIn("failed");
        }
      },
      () => setCheckIn("no_location"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  if (missing) {
    return (
      <Shell>
        <p role="alert" className="rounded-2xl bg-white p-5 text-slate-700 shadow-sm">{t("visit.notFound")}</p>
      </Shell>
    );
  }
  if (!visit) {
    return (
      <Shell>
        <p className="p-5 text-sm text-slate-500">{t("visit.loading")}</p>
      </Shell>
    );
  }

  const g = visit.guide ?? {};
  const when = new Date(`${visit.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const doctorHref = `/doctors/${doctorSlug({ id: visit.doctorId, name: visit.doctorName, specialty: "" }, visit.city ?? undefined)}`;
  const guideRows: [string, string | null | undefined][] = [
    [t("visit.landmark"), g.landmark],
    [t("visit.entrance"), g.entranceNote],
    [t("visit.registration"), g.registrationDesk],
    [t("visit.opd"), g.opdLocation],
    [t("visit.parking"), g.parkingNote],
    [t("visit.payment"), g.paymentNote],
  ];

  return (
    <Shell>
      <section className="rounded-3xl bg-white p-5 shadow-sm" aria-label={t("visit.title")}>
        <p className="text-xs font-bold uppercase tracking-wider text-[#0B6B4F]">{t("visit.title")}</p>
        <h1 className="mt-1 text-xl font-extrabold text-slate-900">{visit.doctorName}</h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-slate-700"><Building2 className="h-4 w-4" aria-hidden="true" /> {visit.hospitalName}</p>
        <div className="mt-3 grid gap-1.5 text-sm text-slate-700">
          <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" aria-hidden="true" /> {when}</span>
          {visit.time && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden="true" /> {visit.time}</span>}
          {(visit.address || visit.city) && (
            <span className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {[visit.address, visit.city].filter(Boolean).join(", ")}</span>
          )}
        </div>
        <p className="mt-3 inline-block rounded-full bg-[#E3F2EC] px-3 py-1 font-mono text-sm font-bold tracking-wider text-[#10302D]">
          {t("vita.bookingId")}: {visit.reference}
        </p>
        <p className={`mt-2 text-sm font-semibold ${visit.cancelled ? "text-red-700" : visit.confirmed ? "text-emerald-700" : "text-amber-700"}`}>
          {visit.cancelled ? t("visit.cancelled") : visit.completed ? t("visit.completed") : visit.confirmed ? t("visit.confirmed") : t("visit.requested")}
        </p>
        {!visit.cancelled && !visit.completed && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={visit.mapUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#0B5E57] px-4 font-bold text-white hover:brightness-110">
              <MapPin className="h-5 w-5" aria-hidden="true" /> {t("vita.directions")}
            </a>
            {visit.contact && (
              <a href={`tel:${visit.contact}`}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50">
                <Phone className="h-4 w-4" aria-hidden="true" /> {t("vita.callHospital")}
              </a>
            )}
          </div>
        )}
      </section>

      {visit.token?.tokenNo ? <TokenCard token={visit.token} /> : null}

      {visit.isToday && !visit.cancelled && !visit.completed && !visit.token?.tokenNo && (
        <section className="rounded-3xl border-2 border-[#0B5E57] bg-white p-5 shadow-sm" aria-label={t("visit.arrivedTitle")}>
          <h2 className="text-lg font-extrabold text-slate-900">{t("visit.arrivedTitle")}</h2>
          <p className="mt-1 text-sm text-slate-700">{visit.canCheckIn ? t("visit.arrivedSteps") : t("visit.arrivedNoCheckIn")}</p>
          {visit.canCheckIn && (
            <button type="button" onClick={doCheckIn} disabled={checkIn === "locating" || checkIn === "sending"}
              className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0B5E57] px-4 text-base font-extrabold text-white disabled:opacity-60">
              <LocateFixed className="h-5 w-5" aria-hidden="true" />
              {checkIn === "locating" || checkIn === "sending" ? t("visit.checkingIn") : t("visit.checkIn")}
            </button>
          )}
          {checkIn === "too_far" && <p role="alert" className="mt-2 text-sm font-semibold text-amber-800">{t("visit.tooFar")}</p>}
          {checkIn === "no_location" && <p role="alert" className="mt-2 text-sm font-semibold text-amber-800">{t("visit.locationNeeded")}</p>}
          {checkIn === "failed" && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{t("visit.checkInFailed")}</p>}
        </section>
      )}

      {!visit.cancelled && !visit.completed && (
        <section className="rounded-3xl bg-white p-5 text-sm shadow-sm" aria-label={t("visit.findWay")}>
          <h2 className="text-base font-extrabold text-slate-900">{t("visit.findWay")}</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {guideRows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-slate-700">{visit.fee != null ? t("visit.payAtCounter", { fee: String(visit.fee) }) : t("visit.payAtCounterNoFee")}</p>
          <p className="text-slate-700">{t("visit.bring")}</p>
          {g.extraNote && <p className="mt-2 text-slate-700">{g.extraNote}</p>}
        </section>
      )}

      {visit.completed && (
        <section className="rounded-3xl bg-white p-5 text-sm shadow-sm" aria-label={t("visit.completed")}>
          <p className="flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /> {t("visit.completed")}</p>
          {visit.followUpDate && (
            <p className="mt-2 text-slate-700">
              {t("visit.followUp", { date: new Date(`${visit.followUpDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) })}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {visit.followUpDate && (
              <Link href={`${doctorHref}#book`} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#0B5E57] px-4 font-bold text-white">
                <Calendar className="h-5 w-5" aria-hidden="true" /> {t("visit.bookFollowUp")}
              </Link>
            )}
            <Link href={`${doctorHref}#reviews`} className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 font-semibold text-slate-800">
              <Star className="h-4 w-4" aria-hidden="true" /> {t("visit.rate")}
            </Link>
          </div>
        </section>
      )}
    </Shell>
  );
}

function TokenCard({ token }: { token: VisitToken }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-3xl bg-[#0B4F4A] p-5 text-white shadow-sm" aria-label={t("visit.token")}>
      <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/80"><Ticket className="h-4 w-4" aria-hidden="true" /> {t("visit.token")}</p>
      <p className="mt-1 text-5xl font-extrabold" aria-live="polite">{token.tokenNo}</p>
      <div className="mt-2 grid gap-0.5 text-sm text-white/90">
        {token.currentServingTokenNo ? <span>{t("visit.nowServing", { n: String(token.currentServingTokenNo) })}</span> : null}
        {token.estimatedWaitMinutes ? <span>{t("visit.wait", { m: String(token.estimatedWaitMinutes) })}</span> : null}
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 pb-24 md:pb-0">
      <PatientTopBar showBackButton={true} wide />
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">{children}</div>
    </main>
  );
}
