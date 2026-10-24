"use client";

import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import DoctorPhoto from "@/components/patient/DoctorPhoto";
import { doctorSlug } from "@/data/patient";
import { useTranslation } from "@/lib/i18n/I18nContext";
import type { VitaDoctor } from "@/lib/vita/types";

// One doctor in a Vita reply (UI-3): photo, name, degrees, experience, hospital, distance when known,
// available today, fee when set, and Choose. Everything shown comes from the 1HMS record as the
// router passed it on; nothing is filled in here.

export function doctorHref(d: VitaDoctor): string {
  if (d.profileUrl) return d.profileUrl;
  return `/doctors/${doctorSlug({ id: d.doctorId, name: d.name ?? "doctor", specialty: d.specialtyName ?? "" }, d.hospital?.city ?? undefined)}`;
}

export function initialsOf(name: string): string {
  const words = name.replace(/^dr\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "Dr");
}

export function feeOf(d: VitaDoctor): number | null {
  if (d.discountedFee != null) return d.discountedFee;
  return d.consultFee ?? null;
}

export default function VitaDoctorCard({
  doctor,
  onChoose,
  disabled,
  chosen,
}: {
  doctor: VitaDoctor;
  onChoose?: (d: VitaDoctor) => void;
  disabled?: boolean;
  chosen?: boolean;
}) {
  const { t } = useTranslation();
  const fee = feeOf(doctor);
  const name = doctor.name ?? "";
  const place = [doctor.hospital?.name, doctor.hospital?.city].filter(Boolean).join(", ");

  return (
    <article
      className={`rounded-[20px] border bg-white p-3.5 shadow-[0_1px_3px_rgba(16,48,45,0.10)] ${chosen ? "border-[#0B5E57] ring-2 ring-[#9CC5BD]" : "border-transparent"}`}
      aria-label={name}
    >
      <div className="flex gap-3">
        <DoctorPhoto
          photo={doctor.photoUrl}
          name={name}
          initials={initialsOf(name)}
          gradient="from-emerald-500 to-teal-600"
          size={56}
          imageClassName="h-14 w-14 shrink-0 rounded-full object-cover"
          fallbackClassName="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-base font-bold text-[#10302D]">
            <span className="truncate">{name}</span>
            {doctor.registrationVerified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-label={t("vita.verified")} />
            )}
          </p>
          {doctor.degrees && <p className="truncate text-xs text-slate-600">{doctor.degrees}</p>}
          <p className="text-xs text-slate-600">
            {[doctor.specialtyName, doctor.experienceYears != null ? t("vita.yearsExp", { n: doctor.experienceYears }) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {place && (
            <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                {place}
                {doctor.distanceKm != null && ` · ${t("vita.kmAway", { km: doctor.distanceKm })}`}
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {doctor.availableToday && (
          <span className="rounded-xl bg-[#E3F2EC] px-2.5 py-1 text-xs font-bold text-[#0B6B4F]">{t("vita.availableToday")}</span>
        )}
        {fee != null && (
          <span className="text-base font-extrabold text-[#10302D]">
            ₹{fee}
            {doctor.discountedFee != null && doctor.consultFee != null && doctor.consultFee !== fee && (
              <s className="ml-1 text-xs font-normal text-slate-500">₹{doctor.consultFee}</s>
            )}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={doctorHref(doctor)}
            className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-[#0B5E57] hover:underline"
          >
            {t("vita.viewProfile")}
          </Link>
          {onChoose && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(doctor)}
              aria-label={t("vita.chooseDoctor", { name })}
              className="inline-flex min-h-[44px] items-center rounded-[14px] bg-[#0B5E57] px-[18px] text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
            >
              {t("vita.choose")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
