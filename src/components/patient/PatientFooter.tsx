"use client";

import { BUSINESS_URL } from "@/lib/site";
import Link from "next/link";
import { Phone, Mail, Building2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTranslation } from "@/lib/i18n/I18nContext";

export default function PatientFooter() {
  const { t } = useTranslation();

  return (
    <footer className="relative mt-8 sm:mt-16 pb-28 md:pb-12 bg-white overflow-hidden">
      
      {/* Premium Gradient Top Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-brand-teal/40 to-transparent" />
      
      {/* Subtle Background Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-40 bg-brand-teal/5 blur-[80px] pointer-events-none rounded-full" />

      <div className="relative max-w-4xl mx-auto px-4 py-12 flex flex-col items-center text-center z-10">
        
        {/* Brand */}
        <div className="mb-8 hover:scale-105 transition-transform duration-500 ease-out">
          <Logo textSize="text-2xl" />
          <p className="mt-3 text-xs text-slate-400 max-w-xs mx-auto font-medium">
            {t("footer.brandBlurb")}
          </p>
        </div>

        {/* Premium Action Pills */}
        <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 mb-10 w-full">
          
          <a href="tel:+918074906808" className="group flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-50/80 border border-slate-100 text-xs font-bold text-slate-700 hover:bg-white hover:shadow-lg hover:shadow-slate-200/40 hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-300">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-teal-50 transition-colors">
              <Phone className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-teal transition-colors" />
            </div>
            Support
          </a>
          
          <a href="mailto:info@nexeagle.com" className="group flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-50/80 border border-slate-100 text-xs font-bold text-slate-700 hover:bg-white hover:shadow-lg hover:shadow-slate-200/40 hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-300">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-sky-50 transition-colors">
              <Mail className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-500 transition-colors" />
            </div>
            Email Us
          </a>
          
          <Link href={BUSINESS_URL} className="group flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-brand-teal/5 border border-brand-teal/20 text-xs font-extrabold text-brand-teal hover:bg-brand-teal hover:text-white hover:shadow-xl hover:shadow-brand-teal/20 hover:-translate-y-0.5 transition-all duration-300">
            <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <Building2 className="w-3.5 h-3.5 text-brand-teal group-hover:text-white transition-colors" />
            </div>
            For Hospitals
          </Link>

        </div>

        {/* Minimal Legal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-[11px] font-semibold text-slate-400">
          <span>© {new Date().getFullYear()} NexEagle.</span>
          <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-200" />
          <div className="flex items-center gap-4">
            <Link href={`${BUSINESS_URL}/privacy`} className="hover:text-slate-900 transition-colors">{t("footer.privacy")}</Link>
            <Link href={`${BUSINESS_URL}/terms`} className="hover:text-slate-900 transition-colors">{t("footer.terms")}</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
