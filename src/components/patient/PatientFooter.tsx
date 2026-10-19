"use client";

import { BUSINESS_URL } from "@/lib/site";
import { openConsentChoices } from "@/lib/analytics";
import Link from "next/link";
import { Phone, Mail, Building2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTranslation } from "@/lib/i18n/I18nContext";

const LINK = "text-sm font-medium text-slate-500 hover:text-brand-teal transition-colors";
const HEAD = "text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3";

/**
 * Site footer on the wide page width (the same as the top bar): the brand at the left, the link columns lined up beside it, and the
 * legal line along the bottom. Left aligned throughout, so the columns share an edge with the page content above.
 */
export default function PatientFooter() {
  const { t } = useTranslation();

  return (
    <footer className="mt-8 sm:mt-16 pb-28 md:pb-0 bg-white border-t border-slate-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo textSize="text-2xl" />
            <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-sm">{t("footer.brandBlurb")}</p>
          </div>

          <nav aria-label="Explore">
            <p className={HEAD}>Explore</p>
            <ul className="space-y-2.5">
              <li><Link href="/" className={LINK}>Find Doctors</Link></li>
              <li><Link href="/hospitals" className={LINK}>Hospitals</Link></li>
              <li><Link href="/labs" className={LINK}>Pathology Labs</Link></li>
              <li><Link href="/health" className={LINK}>Health Wiki</Link></li>
            </ul>
          </nav>

          <nav aria-label="Company">
            <p className={HEAD}>Company</p>
            <ul className="space-y-2.5">
              <li><Link href="/about" className={LINK}>About &amp; Verification</Link></li>
            </ul>
          </nav>

          <div>
            <p className={HEAD}>Contact</p>
            <ul className="space-y-2.5">
              <li>
                <a href="tel:+918074906808" className={`${LINK} inline-flex items-center gap-2`}>
                  <Phone className="w-4 h-4 text-slate-400" aria-hidden="true" /> Support: +91 80749 06808
                </a>
              </li>
              <li>
                <a href="mailto:info@nexeagle.com" className={`${LINK} inline-flex items-center gap-2`}>
                  <Mail className="w-4 h-4 text-slate-400" aria-hidden="true" /> info@nexeagle.com
                </a>
              </li>
              <li>
                <Link href={BUSINESS_URL} className="inline-flex items-center gap-2 mt-1 px-4 py-2 rounded-full bg-brand-teal/5 border border-brand-teal/20 text-sm font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors">
                  <Building2 className="w-4 h-4" aria-hidden="true" /> For Hospitals
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-medium text-slate-400">
          <span>© {new Date().getFullYear()} NexEagle. All rights reserved.</span>
          <span className="flex items-center gap-4">
            <Link href={`${BUSINESS_URL}/privacy`} className="hover:text-slate-900 transition-colors">{t("footer.privacy")}</Link>
            <Link href={`${BUSINESS_URL}/terms`} className="hover:text-slate-900 transition-colors">{t("footer.terms")}</Link>
            <button type="button" onClick={openConsentChoices} className="hover:text-slate-900 transition-colors">{t("footer.trackingChoices")}</button>
          </span>
        </div>
      </div>
    </footer>
  );
}
