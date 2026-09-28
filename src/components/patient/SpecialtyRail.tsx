"use client";

import { motion } from "framer-motion";
import { specialties } from "@/data/patient";
import { getSpecialtyIcon } from "@/lib/specialtyIcons";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { translateSpecialty } from "@/lib/i18n/specialties";

interface SpecialtyRailProps {
  selected: string;
  onSelect: (specialtyId: string) => void;
}

/** Horizontal rail of specialties — the primary "browse by need" entry point. */
export default function SpecialtyRail({ selected, onSelect }: SpecialtyRailProps) {
  const { t, locale } = useTranslation();
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {t("specialtyRail.heading")}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("specialtyRail.subtitle", { n: specialties.length })}
          </p>
        </div>
        {selected && (
          <button
            onClick={() => onSelect("")}
            className="text-xs font-bold text-brand-teal hover:underline"
          >
            {t("specialtyRail.clearFilter")}
          </button>
        )}
      </div>

      {/* 4 cols → 5 → 10 — wraps to further rows as the specialty list grows past 20 */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2 sm:gap-3">
        {specialties.map((spec, i) => {
          const Icon = getSpecialtyIcon(spec.icon);
          const isActive = selected === spec.id;
          return (
            <motion.button
              key={spec.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03, ease: "easeOut" }}
              onClick={() => onSelect(isActive ? "" : spec.id)}
              title={spec.blurb}
              className={`group flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border transition-all duration-300 ${
                isActive
                  ? "border-brand-teal bg-teal-50/60 shadow-md shadow-teal-100"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${spec.accent}`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 text-center leading-tight line-clamp-2">
                {translateSpecialty(spec.id, spec.name, locale)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

