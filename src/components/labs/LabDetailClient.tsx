"use client";

import { SITE_URL } from "@/lib/site";
import Link from "next/link";
import { ChevronLeft, FlaskConical, MapPin, Navigation, Phone, Mail, ShieldCheck } from "lucide-react";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";
import ShareButton from "@/components/patient/ShareButton";
import type { Lab } from "@/data/labs";
import { getLabDirectionsUrl } from "@/data/labs";
import { useNavigation } from "@/components/navigation/NavigationProvider";
import { joinAddress } from "@/lib/navigation";

interface LabDetailClientProps {
  lab: Lab;
  canonicalSlug: string;
}

// Mirrors DoctorDetailClient.tsx's card-sectioned layout (identity, address+directions, About,
// test categories, contact) but single-column -- no BookingPanel/ReviewsSection, since a lab
// listing is discoverability only (see the plan's Out of Scope).
export default function LabDetailClient({ lab, canonicalSlug }: LabDetailClientProps) {
  const canNavigate = getLabDirectionsUrl(lab) !== null;
  const { openNavigation } = useNavigation();
  const locationLine = [lab.city, lab.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <AnalyticsTracker title={`${lab.name} | NexEagle Doctor Dekho`} />
      <PatientTopBar showBackButton />

      <main className="flex-1 pb-24 lg:pb-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            href="/labs"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-teal transition mb-6"
          >
            <ChevronLeft className="w-4 h-4" /> All Labs
          </Link>

          <div className="space-y-6">
            {/* Identity */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
              <div className="flex gap-5 items-start">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                  <FlaskConical className="w-11 h-11" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{lab.name}</h1>
                    <ShareButton
                      title={`${lab.name} | Doctor Dekho`}
                      text={`${lab.name}${locationLine ? ` in ${locationLine}` : ""}`}
                      url={`${SITE_URL}/labs/${canonicalSlug}`}
                    />
                  </div>
                  {locationLine && <p className="text-sm text-slate-500 mt-1">{locationLine}</p>}
                  {lab.registrationNumber && (
                    <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
                      Registration No: {lab.registrationNumber}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Address + directions */}
            {(lab.address || lab.city) && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-teal" /> Address
                </h2>
                {lab.address && <p className="text-sm text-slate-600">{lab.address}</p>}
                <p className="text-sm text-slate-500 mt-1">{[lab.city, lab.state, lab.pincode].filter(Boolean).join(", ")}</p>
                {canNavigate && (
                  <button
                    type="button"
                    onClick={() =>
                      openNavigation({
                        name: lab.name,
                        latitude: lab.latitude,
                        longitude: lab.longitude,
                        address: joinAddress(lab.address, lab.city, lab.state, lab.pincode),
                      })
                    }
                    className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-brand-teal hover:text-teal-700"
                  >
                    <Navigation className="w-4 h-4" /> Get Directions
                  </button>
                )}
              </div>
            )}

            {/* About */}
            {lab.description && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-3">About</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{lab.description}</p>
              </div>
            )}

            {/* Test categories */}
            {lab.testCategories.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-3">Test Categories</h2>
                <div className="flex flex-wrap gap-2">
                  {lab.testCategories.map((category) => (
                    <span
                      key={category}
                      className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-semibold"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact */}
            {(lab.contactPhone || lab.contactEmail) && (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-900 mb-3">Contact</h2>
                <div className="space-y-2">
                  {lab.contactPhone && (
                    <a href={`tel:${lab.contactPhone}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-teal">
                      <Phone className="w-4 h-4 text-slate-400" /> {lab.contactPhone}
                    </a>
                  )}
                  {lab.contactEmail && (
                    <a href={`mailto:${lab.contactEmail}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-teal">
                      <Mail className="w-4 h-4 text-slate-400" /> {lab.contactEmail}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <PatientFooter />
    </div>
  );
}
