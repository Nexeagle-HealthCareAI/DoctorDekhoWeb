import type { Metadata } from "next";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";
import HospitalsMapView from "@/components/patient/HospitalsMapView";
import Link from "next/link";
import { getAllHospitals } from "@/lib/api/server";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Hospitals Near You",
  description:
    "Find hospitals and clinics near you on NexEagle Doctor Dekho. See each hospital's exact location on the map and get turn-by-turn directions.",
  alternates: { canonical: "/hospitals" },
};

const hospitalSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default async function HospitalsPage() {
  const { hospitals } = await getAllHospitals();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <AnalyticsTracker title="Hospitals Near You | NexEagle Doctor Dekho" />
      <PatientTopBar showBackButton />

      <main className="flex-1 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Hospitals Near You</h1>
            <p className="text-sm text-slate-500 mt-1">
              Browse every hospital on NexEagle, see it on the map, and get directions.
            </p>
          </div>

          {hospitals.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-10 text-center">
              <p className="text-sm text-slate-500">No hospitals are listed yet. Check back soon.</p>
            </div>
          ) : (
            <>
              <HospitalsMapView hospitals={hospitals} />
              {/* The map is drawn in the browser, so this plain list is what gives every hospital a link a visitor can tap (and a crawler can follow). */}
              <section aria-labelledby="all-hospitals" className="mt-10">
                <h2 id="all-hospitals" className="text-lg font-extrabold text-slate-900 mb-3">All hospitals</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {hospitals.map((h) => (
                    <li key={h.id}>
                      <Link href={`/hospitals/${hospitalSlug(h.name)}`} className="block bg-white rounded-2xl border border-slate-200/80 px-4 py-3 shadow-sm hover:border-brand-teal transition-colors">
                        <span className="block font-semibold text-slate-900">{h.name}</span>
                        {(h.city || h.state) && <span className="block text-xs text-slate-500">{[h.city, h.state].filter(Boolean).join(", ")}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>

      <PatientFooter />
    </div>
  );
}
