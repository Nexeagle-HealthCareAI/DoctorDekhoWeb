import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { specialties, CITIES, resolveCity } from "@/data/patient";
import HomeClient from "@/app/home-client";
import { getAllDoctors } from "@/lib/api/server";
import { filterDoctorsByLocation } from "@/lib/filters/doctorLocation";
import { SITE_URL } from "@/lib/site";
import PageBreadcrumb from "@/components/patient/PageBreadcrumb";

export const revalidate = 3600;

interface PageProps {
  params: { specialty: string; city: string };
}

export async function generateStaticParams() {
  const params: { specialty: string; city: string }[] = [];
  for (const s of specialties) {
    for (const c of CITIES) {
      params.push({ specialty: s.id, city: c.id });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const specialty = specialties.find((s) => s.id === params.specialty);
  // Falls back to live doctor records when the city isn't in the curated CITIES list — a new
  // city only gets a page once a doctor from there actually exists, see resolveCity().
  const { doctors: metaDoctors } = await getAllDoctors();
  const city = resolveCity(params.city, metaDoctors);
  if (!specialty || !city) return { title: "Not Found" };

  const title = `Top ${specialty.name}s in ${city.name}, ${city.state} | Book Appointment`;
  const description = `Find the best ${specialty.name}s in ${city.name}, ${city.state}. Compare experience, ratings, and book appointments online instantly on NexEagle Doctor Dekho.`;

  return {
    title,
    description,
    alternates: { canonical: `/specialties/${params.specialty}/${params.city}` },
    openGraph: { title, description, url: `/specialties/${params.specialty}/${params.city}` },
  };
}

export default async function SpecialtyCityPage({ params }: PageProps) {
  const specialty = specialties.find((s) => s.id === params.specialty);

  // Server-fetched + pre-filtered so this page ships real doctor content in the
  // raw HTML — see src/lib/api/server.ts's getAllDoctors.
  const { doctors } = await getAllDoctors();
  // Resolves against real doctor records too, not just the curated CITIES list, so a city
  // gains a working page as soon as a doctor from there is onboarded — no code change or
  // redeploy needed to add e.g. Siliguri once a Siliguri doctor exists in the API.
  const city = resolveCity(params.city, doctors);
  if (!specialty || !city) notFound();

  const initialDoctors = filterDoctorsByLocation(doctors, {
    specialtyId: specialty.id,
    city: city.name,
    state: city.state,
  });

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `What is the consultation fee for a ${specialty.name} in ${city.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Consultation fees vary by doctor, experience, and hospital affiliation. NexEagle shows each ${specialty.name}'s actual fee upfront on their profile before you book, so there are no surprises.`
        }
      },
      {
        "@type": "Question",
        "name": `How can I find the best ${specialty.name}s in ${city.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can use NexEagle to compare the top-rated ${specialty.name}s in ${city.name} based on patient reviews, experience, and proximity to your location.`
        }
      }
    ]
  };

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: `${specialty.name}s`, href: `/specialties/${specialty.id}` },
    { label: city.name },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": `${specialty.name}s`, "item": `${SITE_URL}/specialties/${specialty.id}` },
      { "@type": "ListItem", "position": 3, "name": city.name, "item": `${SITE_URL}/specialties/${specialty.id}/${city.id}` },
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
        pageHeading={`${specialty.name}s in ${city.name}, ${city.state}`}
        initialDoctors={initialDoctors}
        breadcrumb={<PageBreadcrumb items={breadcrumbItems} />}
      />
    </>
  );
}
