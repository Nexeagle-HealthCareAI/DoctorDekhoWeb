import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { specialties } from "@/data/patient";
import HomeClient from "@/app/home-client";
import { getAllDoctors } from "@/lib/api/server";
import { filterDoctorsByLocation } from "@/lib/filters/doctorLocation";
import { SITE_URL } from "@/lib/site";
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

  const title = `Top ${specialty.name}s Near You | Book Appointment`;
  const description = `Find the best ${specialty.name}s near you. Compare experience, ratings, and book appointments online instantly on NexEagle Doctor Dekho.`;

  return {
    title,
    description,
    alternates: { canonical: `/specialties/${params.specialty}` },
    openGraph: { title, description, url: `/specialties/${params.specialty}` },
  };
}

export default async function SpecialtyPage({ params }: PageProps) {
  const specialty = specialties.find((s) => s.id === params.specialty);
  if (!specialty) notFound();

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
          "text": `You can book an appointment instantly through NexEagle. Simply select your location, compare top ${specialty.name}s, and choose a time slot that works for you.`
        }
      }
    ]
  };

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: `${specialty.name}s` },
  ];
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": `${specialty.name}s`, "item": `${SITE_URL}/specialties/${specialty.id}` },
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
        pageHeading={`Top ${specialty.name}s near you`}
        initialDoctors={initialDoctors}
        breadcrumb={<PageBreadcrumb items={breadcrumbItems} />}
      />
    </>
  );
}
