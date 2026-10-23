import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CITIES } from "@/data/patient";
import HomeClient from "@/app/home-client";
import { getAllDoctors } from "@/lib/api/server";
import { filterDoctorsByCondition, filterDoctorsByLocation } from "@/lib/filters/doctorLocation";
import { SITE_URL } from "@/lib/site";
import PageBreadcrumb from "@/components/patient/PageBreadcrumb";

export const revalidate = 3600;

interface PageProps {
  params: { condition: string; city: string };
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function unslugify(slug: string) {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function generateStaticParams() {
  const { doctors } = await getAllDoctors();

  const conditionSet = new Set<string>();
  for (const d of doctors) {
    for (const f of d.focusAreas) {
      conditionSet.add(slugify(f));
    }
  }

  const params: { condition: string; city: string }[] = [];
  for (const cond of Array.from(conditionSet)) {
    for (const c of CITIES) {
      params.push({ condition: cond, city: c.id });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const city = CITIES.find((c) => c.id === params.city);
  if (!city) return { title: "Not Found" };

  const conditionName = unslugify(params.condition);
  const title = `Best Doctors for ${conditionName} in ${city.name}, ${city.state} | Book Appointment`;
  const description = `Find the best doctors specializing in ${conditionName} in ${city.name}, ${city.state}. Compare experience, ratings, and book appointments online instantly on NexEagle Doctor Dekho.`;

  return {
    title,
    description,
    alternates: { canonical: `/conditions/${params.condition}/${params.city}` },
    openGraph: { title, description, url: `/conditions/${params.condition}/${params.city}` },
  };
}

export default async function ConditionCityPage({ params }: PageProps) {
  const city = CITIES.find((c) => c.id === params.city);
  if (!city) notFound();

  const conditionName = unslugify(params.condition);

  // Server-fetched + pre-filtered so this page ships real doctor content in the
  // raw HTML — see src/lib/api/server.ts's getAllDoctors.
  const { doctors } = await getAllDoctors();
  const conditionMatched = filterDoctorsByCondition(doctors, params.condition);
  const initialDoctors = filterDoctorsByLocation(conditionMatched, {
    city: city.name,
    state: city.state,
  });

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Which are the best doctors for ${conditionName} in ${city.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `NexEagle lists the top-rated specialists for ${conditionName} in ${city.name}, ${city.state}. You can filter by patient reviews and experience to find the right doctor for you.`
        }
      },
      {
        "@type": "Question",
        "name": `How quickly can I consult a doctor for ${conditionName} in ${city.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Many doctors in ${city.name} offer same-day appointments. You can view real-time availability and book your slot instantly on NexEagle.`
        }
      }
    ]
  };

  // No /conditions/{condition} index route exists (only .../{city} and .../{city}/{area} are
  // real pages) — so unlike the specialty breadcrumb, the condition segment here isn't a link,
  // just a label, to avoid creating another 404'd breadcrumb entry.
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: conditionName },
    { label: city.name },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": city.name, "item": `${SITE_URL}/conditions/${params.condition}/${city.id}` },
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
        initialQuery={conditionName}
        initialCityId={city.id}
        pageHeading={`Doctors for ${conditionName} in ${city.name}, ${city.state}`}
        initialDoctors={initialDoctors}
        breadcrumb={<PageBreadcrumb items={breadcrumbItems} />}
      />
    </>
  );
}
