import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeClient from "@/app/home-client";
import HospitalPageViewTracker from "@/components/patient/HospitalPageViewTracker";
import { getAllDoctors } from "@/lib/api/server";
import { filterDoctorsByHospital } from "@/lib/filters/doctorLocation";
import type { Doctor } from "@/data/patient";
import { SITE_URL } from "@/lib/site";
import PageBreadcrumb from "@/components/patient/PageBreadcrumb";

export const revalidate = 3600;

interface PageProps {
  params: { hospital: string };
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Title-cases every word, which mangles acronym hospital names (e.g. "AIIMS" -> "Aiims") — this
// is only a last-resort fallback for when no real hospitalName can be found in the doctor data
// (e.g. at generateStaticParams time before any doctor filter has run); resolveHospitalName()
// below prefers the actual display name whenever it's available.
function unslugify(slug: string) {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/** Prefer the hospital's real display name (as entered on its own profile) over an
 * unslugify() guess, which can't reconstruct acronyms/casing lost by slugification. */
function resolveHospitalName(slug: string, doctors: Doctor[]): string {
  const match = doctors.find((d) => d.hospitalName && slugify(d.hospitalName) === slug);
  return match?.hospitalName || unslugify(slug);
}

export async function generateStaticParams() {
  const { doctors } = await getAllDoctors();

  const hospitalSet = new Set<string>();
  for (const d of doctors) {
    if (d.hospitalName) {
      hospitalSet.add(slugify(d.hospitalName));
    }
  }

  return Array.from(hospitalSet).map(hospital => ({ hospital }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { doctors } = await getAllDoctors();
  const hospitalName = resolveHospitalName(params.hospital, doctors);

  const title = `Top Doctors in ${hospitalName} | Book Appointment Online`;
  const description = `Find and book appointments with the best doctors practicing at ${hospitalName}. Compare verified reviews, experience, and book instantly on NexEagle Doctor Dekho.`;

  return {
    title,
    description,
    alternates: { canonical: `/hospitals/${params.hospital}` },
    openGraph: { title, description, url: `/hospitals/${params.hospital}` },
  };
}

export default async function HospitalPage({ params }: PageProps) {
  // Server-fetched + pre-filtered so this page ships real doctor content in the
  // raw HTML — see src/lib/api/server.ts's getAllDoctors.
  const { doctors } = await getAllDoctors();
  const hospitalName = resolveHospitalName(params.hospital, doctors);
  const initialDoctors = filterDoctorsByHospital(doctors, params.hospital);

  // All doctors filtered to this hospital share one real-world location — use
  // the first as the source of truth for the clinic's own address/geo, rather
  // than NexEagle's HQ (see NEX-7 acceptance criteria).
  const locationSource = initialDoctors[0];

  const clinicSchema = locationSource
    ? {
        "@context": "https://schema.org",
        "@type": "MedicalClinic",
        name: hospitalName,
        address: {
          "@type": "PostalAddress",
          streetAddress: locationSource.address || undefined,
          addressLocality: locationSource.city || undefined,
          addressRegion: locationSource.state || undefined,
          postalCode: locationSource.pincode || undefined,
          addressCountry: "IN",
        },
        ...(locationSource.latitude != null && locationSource.longitude != null
          ? {
              geo: {
                "@type": "GeoCoordinates",
                latitude: locationSource.latitude.toString(),
                longitude: locationSource.longitude.toString(),
              },
            }
          : {}),
      }
    : null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Which are the best doctors available at ${hospitalName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `NexEagle lists top-rated specialists available at ${hospitalName}. You can filter by specialty, read patient reviews, and book online.`
        }
      },
      {
        "@type": "Question",
        "name": `How can I book an appointment at ${hospitalName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can view the real-time availability of doctors at ${hospitalName} and book your slot instantly on NexEagle Doctor Dekho without any phone calls.`
        }
      }
    ]
  };

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Hospitals", href: "/hospitals" },
    { label: hospitalName },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": "Hospitals", "item": `${SITE_URL}/hospitals` },
      { "@type": "ListItem", "position": 3, "name": hospitalName, "item": `${SITE_URL}/hospitals/${params.hospital}` },
    ],
  };

  return (
    <>
      {clinicSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(clinicSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* Not initialQuery={hospitalName}: the free-text search filter matches doctor
          name/specialty/focusAreas, never hospitalName, so seeding it here would
          silently filter the correctly hospital-scoped initialDoctors back to zero. */}
      <HospitalPageViewTracker hospitalId={locationSource?.hospitalId} />
      <HomeClient initialDoctors={initialDoctors} breadcrumb={<PageBreadcrumb items={breadcrumbItems} />} />
    </>
  );
}
