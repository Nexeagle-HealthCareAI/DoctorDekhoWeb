import { SITE_URL, BUSINESS_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Phone, Mail, BadgeCheck } from "lucide-react";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";

// New route — the audit found no About/verification-policy page anywhere on the site, which
// hurts both E-E-A-T (Google's trust signal for YMYL/health content) and GEO (AI engines have
// nothing to cite when asked "who runs Doctor Dekho" or "how are doctors verified"). Founder
// details sourced from https://nexeagle.com/team; partner-hospital count and the verification
// mechanism (NMC registration check, see Doctor.IsRegistrationVerified in mappers.ts) confirmed
// directly — nothing below is a placeholder.
const FOUNDERS = [
  { name: "Md Tasquil Noori", role: "Co-Founder & Tech Lead", credential: "BTech, NIT Warangal" },
  { name: "Dr Md Taquedis Noori", role: "Co-Founder & Medical Advisor", credential: "MS, MCh Urology (IPGMER and SSKM Hospital)" },
  { name: "Md Aquib", role: "Co-Founder & Product Manager", credential: "IIT Bombay Alumni" },
  { name: "Dr Md Tabish Noori", role: "Co-Founder & Healthcare Research Advisor", credential: "Research Fellow, Imperial College London" },
];
// Not "About Doctor Dekho | Doctor Dekho" — the root layout's title template already appends
// the brand suffix to every non-absolute title, so this stays "About Us & ..." to avoid
// repeating "Doctor Dekho" back-to-back.
export const metadata: Metadata = {
  title: "About Us & How We Verify Doctors",
  description:
    "Who runs Doctor Dekho, and how every doctor profile is verified before it goes live — registration checks, degree verification and our escalation process.",
  alternates: { canonical: "/about" },
  openGraph: { title: "About Us", description: "Who we are and how we verify doctors.", url: "/about", type: "website" },
};

export default function AboutPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "url": `${SITE_URL}/about`,
    "about": { "@id": `${SITE_URL}/#organization` },
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": "About", "item": `${SITE_URL}/about` },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <PatientTopBar wide />

      <main className="flex-1 pb-24">
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Link href="/" className="hover:text-brand-teal">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-800">About</span>
            </nav>
          </div>
        </div>

        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">About Doctor Dekho</h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-3xl">
              Doctor Dekho is built by{" "}
              <Link href={BUSINESS_URL} className="text-brand-teal font-semibold hover:underline">NexEagle</Link>
              {" "}to help patients find and book verified doctors nearby, with no login and no app required.
              We currently partner with <strong className="text-slate-800">5+ hospitals</strong> across the Seemanchal region.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {FOUNDERS.map((f) => (
                <div key={f.name} className="bg-white rounded-2xl border border-slate-200/80 p-4">
                  <p className="text-sm font-bold text-slate-900">{f.name}</p>
                  <p className="text-xs font-semibold text-brand-teal mt-0.5">{f.role}</p>
                  <p className="text-xs text-slate-500 mt-1">{f.credential}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The verification explanation takes the width; the contact card sits beside it on large screens */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-brand-teal" />
              <h2 id="verification" className="font-display text-xl font-extrabold text-slate-900">How We Verify Doctors</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Every profile on Doctor Dekho carries a &ldquo;Verified profile&rdquo; badge only after it passes our review process:
            </p>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <BadgeCheck className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                <span>Our team manually confirms the doctor&apos;s National Medical Commission (NMC) registration before a profile is marked verified — this check is never automatic or assumed.</span>
              </li>
              <li className="flex gap-3">
                <BadgeCheck className="w-4 h-4 text-brand-teal shrink-0 mt-0.5" />
                <span>Only doctors from our partner hospitals are listed, so every profile is tied to a real, contactable clinical practice.</span>
              </li>
            </ul>
            <p className="text-xs text-slate-400 mt-4">
              Spotted something that looks wrong on a profile? Let us know using the contact details on this page and we&apos;ll review it.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 lg:sticky lg:top-28">
            <h2 className="font-display text-xl font-extrabold text-slate-900 mb-4">Questions or a Concern About a Listing?</h2>
            <div className="flex flex-col gap-4">
              <a href="tel:+918074906808" className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-brand-teal">
                <Phone className="w-4 h-4" /> +91 80749 06808
              </a>
              <a href="mailto:info@nexeagle.com" className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-brand-teal">
                <Mail className="w-4 h-4" /> info@nexeagle.com
              </a>
            </div>
          </div>
          </div>
        </div>
      </main>

      <PatientFooter />
    </div>
  );
}
