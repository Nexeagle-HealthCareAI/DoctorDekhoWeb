"use client";

import { useState } from "react";
import { Check, LocateFixed, MapPin, Phone } from "lucide-react";
import { useTranslation } from "@/lib/i18n/I18nContext";
import type { VitaEmergency, VitaEmergencyPlace } from "@/lib/vita/types";

// Under the emergency banner (108 / 112 stay on top): the nearest emergency-ready hospitals 1HMS found and alerted (vision Phase 3,
// emergency takeover), nearest first, each with a call button and directions. Phone numbers are shown as text too, because a tel:
// link does nothing on a desktop browser. A call tap is logged against the emergency (audit). The patient's number reaches the
// hospitals only when they tick the consent box and send it; this site does not keep it.

function logCall(eventId: string, settingId: string) {
  try {
    void fetch(`/api/vita/emergency/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "call", settingId }),
      keepalive: true, // the tel: link may take the page away
    }).catch(() => {});
  } catch {
    /* logging must never get in the way of the call */
  }
}

export default function VitaEmergencyHelp({ emergency, active, onShareLocation }: {
  emergency: VitaEmergency;
  /** Only the latest reply's buttons act (sharing location, sharing the number); call buttons always work. */
  active: boolean;
  onShareLocation?: () => void;
}) {
  const { t } = useTranslation();
  const places = emergency.places ?? [];
  const eventId = emergency.eventId ?? null;

  if (emergency.needsLocation) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-slate-900">
        <p className="font-semibold">{t("vita.emNeedLocation")}</p>
        {active && onShareLocation && (
          <button type="button" onClick={onShareLocation}
            className="mt-2 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white hover:bg-red-700">
            <LocateFixed className="h-5 w-5" aria-hidden="true" /> {t("vita.shareLocation")}
          </button>
        )}
      </div>
    );
  }

  if (places.length === 0) {
    return eventId === null && emergency.alerted === undefined ? null : (
      <p role="status" className="rounded-2xl border border-red-200 bg-white p-4 text-sm font-semibold text-red-700">{t("vita.emNone")}</p>
    );
  }

  return (
    <section aria-label={t("vita.emNearest")} className="flex flex-col gap-2">
      <h4 className="text-sm font-extrabold uppercase tracking-wide text-red-700">{t("vita.emNearest")}</h4>
      {(emergency.alerted ?? 0) > 0 || emergency.repeated ? <p className="text-sm text-slate-700">{t("vita.emTold")}</p> : null}
      <ol className="flex flex-col gap-2">
        {places.map((p) => <Place key={p.settingId} place={p} eventId={eventId} />)}
      </ol>
      {eventId && !emergency.canShareNumber && !emergency.numberShared && active && <ShareNumber eventId={eventId} />}
    </section>
  );
}

function Place({ place, eventId }: { place: VitaEmergencyPlace; eventId: string | null }) {
  const { t } = useTranslation();
  const where = [place.landmark, place.address, place.city].filter(Boolean).join(", ");
  const tapped = () => {
    if (eventId) logCall(eventId, place.settingId);
  };
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-[0_1px_2px_rgba(16,48,45,0.08)]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold text-slate-900">{place.name}</p>
        {place.distanceKm != null && <span className="shrink-0 font-semibold text-slate-700">{place.distanceKm} km</span>}
      </div>
      {where && <p className="text-slate-600">{where}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={`tel:${place.phone}`} onClick={tapped} aria-label={t("vita.emCallName", { name: place.name, phone: place.phone })}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white hover:bg-red-700">
          <Phone className="h-4 w-4" aria-hidden="true" /> {t("vita.emCall")} {place.phone}
        </a>
        {place.alternatePhone && (
          <a href={`tel:${place.alternatePhone}`} onClick={tapped}
            aria-label={t("vita.emCallName", { name: place.name, phone: place.alternatePhone })}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border-2 border-red-600 bg-white px-3 font-bold text-red-700 hover:bg-red-50">
            <Phone className="h-4 w-4" aria-hidden="true" /> {place.alternatePhone}
          </a>
        )}
        {place.mapUrl && (
          <a href={place.mapUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50">
            <MapPin className="h-4 w-4" aria-hidden="true" /> {t("vita.directions")}
          </a>
        )}
      </div>
    </li>
  );
}

function ShareNumber({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const [consent, setConsent] = useState(false);
  const [mobile, setMobile] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed" | "bad">("idle");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;
    if (mobile.replace(/\D/g, "").length < 10) {
      setState("bad");
      return;
    }
    setState("sending");
    try {
      const res = await fetch(`/api/vita/emergency/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share", mobile, consent: true }),
      });
      if (res.ok) setState("sent");
      else setState(res.status === 400 && (await res.json().catch(() => ({}))).error === "mobile" ? "bad" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "sent") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t("vita.emShared")}
      </p>
    );
  }

  return (
    <form onSubmit={send} aria-label={t("vita.emShareTitle")} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
      <p className="font-semibold text-slate-900">{t("vita.emShareTitle")}</p>
      <label className="mt-2 flex items-start gap-2">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-red-600" />
        <span>{t("vita.emConsent")}</span>
      </label>
      {consent && (
        <div className="mt-2 flex gap-2">
          <input type="tel" inputMode="tel" autoComplete="tel-national" value={mobile} onChange={(e) => setMobile(e.target.value)}
            placeholder={t("vita.emMobile")} aria-label={t("vita.emMobile")} maxLength={16}
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-base focus:border-red-600 focus:outline-none" />
          <button type="submit" disabled={state === "sending"}
            className="min-h-[44px] rounded-xl bg-red-600 px-4 font-bold text-white disabled:opacity-50">
            {t("vita.emSend")}
          </button>
        </div>
      )}
      <p className="mt-1 text-xs text-slate-500">{t("vita.emConsentNote")}</p>
      {state === "bad" && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{t("vita.emBadMobile")}</p>}
      {state === "failed" && <p role="alert" className="mt-1 text-xs font-semibold text-red-700">{t("vita.emShareFailed")}</p>}
    </form>
  );
}
