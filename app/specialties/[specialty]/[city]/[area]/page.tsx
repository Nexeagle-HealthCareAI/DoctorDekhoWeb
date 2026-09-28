import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { specialties, CITIES, AREAS_BY_CITY } from "@/data/patient";
import HomeClient from "@/app/home-client";
import { getAllDoctors } from "@/lib/api/server";
import { filterDoctorsByLocation } from "@/lib/filters/doctorLocation";
import { SITE_URL } from "@/lib/site";
import PageBreadcrumb from "@/components/patient/PageBreadcrumb";

export const revalidate = 3600;

interface PageProps {
  params: { specialty: string; city: string; area: string };
}

function unslugify(slug: string) {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function generateStaticParams() {
  const params: { specialty: string; city: string; area: string }[] = [];
  for (const s of specialties) {
    for (const c of CITIES) {
      const areas = AREAS_BY_CITY[c.id] || [];
      for (const a of areas) {
        params.push({
          specialty: s.id,
          city: c.id,
          area: a.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        });
      }
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const specialty = specialties.find((s) => s.id === params.specialty);
  const city = CITIES.find((c) => c.id === params.city);
  if (!specialty || !city) return { title: "Not Found" };

  const areaName = unslugify(params.area);
  const title = `Top ${specialty.name}s in ${areaName}, ${city.name} | Book Appointment`;
  const description = `Find the best ${specialty.name}s in ${areaName}, ${city.name}. Compare experience, ratings, and book appointments online instantly on NexEagle Doctor Dekho.`;

  return {
    title,
    description,
    alternates: { canonical: `/specialties/${params.specialty}/${params.city}/${params.area}` },
    openGraph: { title, description, url: `/specialties/${params.specialty}/${params.city}/${params.area}` },
  };
}

export default async function SpecialtyCityAreaPage({ params }: PageProps) {
  const specialty = specialties.find((s) => s.id === params.specialty);
  const city = CITIES.find((c) => c.id === params.city);
  if (!specialty || !city) notFound();

  const areaName = unslugify(params.area);

  // Server-fetched + pre-filtered so this page ships real doctor content in the
  // raw HTML — see src/lib/api/server.ts's getAllDoctors.
  const { doctors } = await getAllDoctors();
  const initialDoctors = filterDoctorsByLocation(doctors, {
    specialtyId: specialty.id,
    city: city.name,
    state: city.state,
    area: areaName,
  });

  // Note: For FAQ, area-specific FAQs can also be injected here
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `What is the consultation fee for a ${specialty.name} in ${areaName}, ${city.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Consultation fees vary by doctor, experience, and hospital affiliation. NexEagle shows each ${specialty.name}'s actual fee upfront on their profile before you book, so there are no surprises.`
        }
      },
      {
        "@type": "Question",
        "name": `How can I find the best ${specialty.name}s in ${areaName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can use NexEagle to compare the top-rated ${specialty.name}s in ${areaName} based on patient reviews, experience, and proximity to your location.`
        }
      }
    ]
  };

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: `${specialty.name}s`, href: `/specialties/${specialty.id}` },
    { label: city.name, href: `/specialties/${specialty.id}/${city.id}` },
    { label: areaName },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": `${specialty.name}s`, "item": `${SITE_URL}/specialties/${specialty.id}` },
      { "@type": "ListItem", "position": 3, "name": city.name, "item": `${SITE_URL}/specialties/${specialty.id}/${city.id}` },
      { "@type": "ListItem", "position": 4, "name": areaName, "item": `${SITE_URL}/specialties/${specialty.id}/${city.id}/${params.area}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <HomeClient
        initialSpecialtyId={specialty.id}
        initialCityId={city.id}
        initialArea={areaName}
        initialDoctors={initialDoctors}
        breadcrumb={<PageBreadcrumb items={breadcrumbItems} />}
      />
    </>
  );
}
