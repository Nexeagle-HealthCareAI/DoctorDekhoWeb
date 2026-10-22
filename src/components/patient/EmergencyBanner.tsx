"use client";

import { AlertTriangle, Phone, HeartHandshake } from "lucide-react";
import { useTranslation } from "@/lib/i18n/I18nContext";

// Shown above the doctor list whenever the symptom router (or, only when the router is
// unreachable, Groq) says the search text describes a medical emergency. A doctor list alone
// would invite booking an appointment for something that needs help now.
//
// Phone numbers are shown as text as well as tel: links: a tel: link does nothing on a desktop
// browser, and the patient must still be able to read and dial the number.

const AMBULANCE = "108";
const TELE_MANAS = "14416";

// Router reasons are English phrases such as "Suicidal thoughts / self-harm". Self-harm needs
// a mental-health line as well as the ambulance number.
const SELF_HARM = /suicid|self[- ]?harm|harm (yourself|myself)|kill (myself|yourself)/i;

export function isSelfHarm(reasons: string[]): boolean {
  return reasons.some((r) => SELF_HARM.test(r));
}

export default function EmergencyBanner({ reasons }: { reasons: string[] }) {
  const { t } = useTranslation();
  const selfHarm = isSelfHarm(reasons);

  return (
    <div
      role="alert"
      className="mb-8 rounded-2xl border-2 border-red-600 bg-red-50 p-5 sm:p-6 text-slate-900"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-7 h-7 shrink-0 text-red-600" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="font-display text-lg sm:text-xl font-extrabold text-red-700">
            {t("directory.emergencyTitle")}
          </h3>
          <p className="text-base font-medium">{t("directory.emergencyBody")}</p>

          {reasons.length > 0 && (
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{t("directory.emergencySigns")}</span> {reasons.join(", ")}
            </p>
          )}

          <a
            href={`tel:${AMBULANCE}`}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-red-600 px-5 text-base font-bold text-white shadow-sm hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
          >
            <Phone className="w-5 h-5" aria-hidden="true" />
            {t("directory.emergencyCall")}
          </a>

          {selfHarm && (
            <div className="rounded-xl border border-red-200 bg-white p-4 space-y-2">
              <p className="flex items-start gap-2 text-sm font-semibold">
                <HeartHandshake className="w-5 h-5 shrink-0 text-red-600" aria-hidden="true" />
                {t("directory.emergencySelfHarm")}
              </p>
              <a
                href={`tel:${TELE_MANAS}`}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-red-600 px-4 text-base font-bold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
              >
                <Phone className="w-4 h-4" aria-hidden="true" />
                {t("directory.emergencySelfHarmCall")}
              </a>
            </div>
          )}

          <p className="text-sm text-slate-600">{t("directory.emergencyDoctorsBelow")}</p>
        </div>
      </div>
    </div>
  );
}
