import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { specialties } from "@/data/patient";
import HomeClient from "@/app/home-client";
import { getAllDoctors } from "@/lib/api/server";
import { filterDoctorsByLocation } from "@/lib/filters/doctorLocation";
import { SITE_URL } from "@/lib/site";
import { robotsWhenEmpty } from "@/lib/seo/indexing";
import { descriptions, doctorLabel, doctorLabelPlural, titles } from "@/lib/seo/titles";
import PageBreadcrumb from "@/components/patient/PageBreadcrumb";

export const revalidate = 3600;

interface PageProps {
  params: { specialty: string };
}

export async function generateStaticParams() {
  return specialties.map((s) => ({
    specialty: s.id,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const specialty = specialties.find((s) => s.id === params.specialty);
  if (!specialty) return { title: "Not Found" };
  const label = doctorLabel(specialty.id, specialty.name);
  const plural = doctorLabelPlural(specialty.id, specialty.name);

  const { doctors } = await getAllDoctors();
  const listed = filterDoctorsByLocation(doctors, { specialtyId: specialty.id });

  const title = titles.specialty(label);
  const description = descriptions.specialty(plural);

  return {
    title,
    description,
    alternates: { canonical: `/specialties/${params.specialty}` },
    openGraph: { title, description, url: `/specialties/${params.specialty}` },
    ...robotsWhenEmpty(listed.length),
  };
}

export default async function SpecialtyPage({ params }: PageProps) {
  const specialty = specialties.find((s) => s.id === params.specialty);
  if (!specialty) notFound();
  const plural = doctorLabelPlural(specialty.id, specialty.name);

  // Server-fetched + pre-filtered so this page ships real doctor content in the
  // raw HTML — see src/lib/api/server.ts's getAllDoctors.
  const { doctors } = await getAllDoctors();
  const initialDoctors = filterDoctorsByLocation(doctors, { specialtyId: specialty.id });

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `What does a ${specialty.name} do?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `A ${specialty.name} specializes in ${specialty.blurb.toLowerCase()}. They diagnose, treat, and help manage conditions related to this field.`
        }
      },
      {
        "@type": "Question",
        "name": `How do I book an appointment with a ${specialty.name}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can book an appointment instantly through NexEagle. Simply select your location, compare top ${plural}, and choose a time slot that works for you.`
        }
      }
    ]
  };

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: `${plural}` },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": `${plural}`, "item": `${SITE_URL}/specialties/${specialty.id}` },
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
        pageHeading={`Top ${plural} near you`}
        initialDoctors={initialDoctors}
        breadcrumb={<PageBreadcrumb items={breadcrumbItems} />}
      />
    </>
  );
}
