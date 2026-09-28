import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CITIES, AREAS_BY_CITY } from "@/data/patient";
import HomeClient from "@/app/home-client";
import { getAllDoctors } from "@/lib/api/server";
import { filterDoctorsByCondition, filterDoctorsByLocation } from "@/lib/filters/doctorLocation";
import { SITE_URL } from "@/lib/site";
import PageBreadcrumb from "@/components/patient/PageBreadcrumb";

export const revalidate = 3600;

interface PageProps {
  params: { condition: string; city: string; area: string };
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

  const params: { condition: string; city: string; area: string }[] = [];
  for (const cond of Array.from(conditionSet)) {
    for (const c of CITIES) {
      const areas = AREAS_BY_CITY[c.id] || [];
      for (const a of areas) {
        params.push({
          condition: cond,
          city: c.id,
          area: slugify(a),
        });
      }
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const city = CITIES.find((c) => c.id === params.city);
  if (!city) return { title: "Not Found" };

  const conditionName = unslugify(params.condition);
  const areaName = unslugify(params.area);
  
  const title = `Best Doctors for ${conditionName} in ${areaName}, ${city.name} | Book Appointment`;
  const description = `Find the best doctors specializing in ${conditionName} in ${areaName}, ${city.name}. Compare experience, ratings, and book appointments online instantly on NexEagle Doctor Dekho.`;

  return {
    title,
    description,
    alternates: { canonical: `/conditions/${params.condition}/${params.city}/${params.area}` },
    openGraph: { title, description, url: `/conditions/${params.condition}/${params.city}/${params.area}` },
  };
}

export default async function ConditionCityAreaPage({ params }: PageProps) {
  const city = CITIES.find((c) => c.id === params.city);
  if (!city) notFound();

  const conditionName = unslugify(params.condition);
  const areaName = unslugify(params.area);

  // Server-fetched + pre-filtered so this page ships real doctor content in the
  // raw HTML — see src/lib/api/server.ts's getAllDoctors.
  const { doctors } = await getAllDoctors();
  const conditionMatched = filterDoctorsByCondition(doctors, params.condition);
  const initialDoctors = filterDoctorsByLocation(conditionMatched, {
    city: city.name,
    state: city.state,
    area: areaName,
  });

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `Which are the best doctors for ${conditionName} in ${areaName}, ${city.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `NexEagle lists the top-rated specialists for ${conditionName} in ${areaName}, ${city.name}. You can filter by patient reviews and experience to find the right doctor for you.`
        }
      },
      {
        "@type": "Question",
        "name": `How quickly can I consult a doctor for ${conditionName} in ${areaName}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Many doctors in ${areaName} offer same-day appointments. You can view real-time availability and book your slot instantly on NexEagle.`
        }
      }
    ]
  };

  // No /conditions/{condition} or /conditions/{condition}/{city} link here for the condition/
  // city segments — city HAS a real page (.../{condition}/{city}), so it's linked; the
  // condition-only segment still has no index route, so it stays a label, not a link.
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: conditionName },
    { label: city.name, href: `/conditions/${params.condition}/${city.id}` },
    { label: areaName },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": city.name, "item": `${SITE_URL}/conditions/${params.condition}/${city.id}` },
      { "@type": "ListItem", "position": 3, "name": areaName, "item": `${SITE_URL}/conditions/${params.condition}/${city.id}/${params.area}` },
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
        initialArea={areaName}
        initialDoctors={initialDoctors}
        breadcrumb={<PageBreadcrumb items={breadcrumbItems} />}
      />
    </>
  );
}
