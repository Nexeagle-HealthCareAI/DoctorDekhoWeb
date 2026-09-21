import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DoctorDetailClient from "@/components/patient/DoctorDetailClient";
import { getDoctorById, getDoctorQrCodeDataUrl, easyhmsFetch } from "@/lib/api/server";
import { mapDoctors } from "@/lib/api/mappers";
import type { DoctorsResponseDto } from "@/lib/api/types";
import {
  doctors as mockDoctors,
  doctorSlug,
  parseDoctorIdFromSlug,
  type Doctor,
} from "@/data/patient";

interface PageProps {
  params: { doctorSlug: string };
}

async function resolveDoctor(slug: string): Promise<Doctor | null> {
  const doctorId = parseDoctorIdFromSlug(slug);
  const { doctor } = await getDoctorById(doctorId);
  return doctor;
}

async function getSimilarDoctors(doctor: Doctor): Promise<Doctor[]> {
  try {
    // pageSize=2000 — /public/doctors now defaults to 24 (paginated browsing UI); this needs
    // the whole directory to genuinely find same-specialty/same-city matches, not just
    // whichever 24 the API's default order happens to return. See server.ts's getAllDoctors.
    const result = await easyhmsFetch<DoctorsResponseDto>("/public/doctors?pageSize=2000");
    let allDoctors = mockDoctors;
    if (!result.notConfigured && result.data) {
      allDoctors = mapDoctors(result.data.doctors);
    }
    
    return allDoctors
      .filter((d) => d.id !== doctor.id && d.specialtyId === doctor.specialtyId && d.city === doctor.city)
      .slice(0, 3); // Get top 3
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  let slugs: string[] = [];
  try {
    // pageSize=2000 — without this, the new default (24) would silently truncate which
    // doctor profile pages get statically generated as the real directory grows past one
    // page of results. See server.ts's getAllDoctors / getDoctorById for the same fix.
    const result = await easyhmsFetch<DoctorsResponseDto>("/public/doctors?pageSize=2000");
    if (result.notConfigured || !result.data) {
      slugs = mockDoctors.map((d) => doctorSlug(d, d.city));
    } else {
      const doctors = mapDoctors(result.data.doctors);
      slugs = doctors.map((d) => doctorSlug(d, d.city));
    }
  } catch {
    // If the API fails at build time, gracefully fall back to empty
    // and let Next.js generate pages dynamically on-demand.
  }
  
  return slugs.map((slug) => ({
    doctorSlug: slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const doctor = await resolveDoctor(params.doctorSlug);
  if (!doctor) {
    return { title: "Doctor not found", robots: { index: false, follow: true } };
  }
  const place = [doctor.hospitalName, doctor.city].filter(Boolean).join(", ");
  const title = `${doctor.name} — ${doctor.specialty}${place ? ` in ${doctor.city}` : ""} | Book Appointment`;
  const description = [
    `Book an appointment with ${doctor.name}`,
    doctor.qualifications && `(${doctor.qualifications})`,
    `, ${doctor.specialty}`,
    doctor.experienceYears ? ` — ${doctor.experienceYears}+ years experience` : "",
    place ? ` at ${place}` : "",
    ". Verify by OTP. No login required.",
  ].filter(Boolean).join("");
  const canonicalSlug = doctorSlug(doctor, doctor.city);
  const ogImageUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(doctor.name)}&subtitle=${encodeURIComponent(doctor.specialty)}&rating=${doctor.rating || ""}`;

  return {
    title,
    description,
    alternates: { canonical: `/doctors/${canonicalSlug}` },
    openGraph: { 
      title, 
      description, 
      url: `/doctors/${canonicalSlug}`, 
      type: "profile", 
      images: [{ url: ogImageUrl, width: 1200, height: 630 }] 
    },
    twitter: { 
      card: "summary_large_image", 
      title, 
      description, 
      images: [ogImageUrl] 
    },
  };
}

export default async function DoctorDetailPage({ params }: PageProps) {
  const doctor = await resolveDoctor(params.doctorSlug);
  if (!doctor) notFound();

  const similarDoctors = await getSimilarDoctors(doctor);
  const canonicalSlug = doctorSlug(doctor, doctor.city);
  const whatsAppQrCodeDataUrl = await getDoctorQrCodeDataUrl(doctor.id);

  const locationLine =
    [doctor.hospitalName, doctor.city].filter(Boolean).join(", ") || doctor.clinic;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: doctor.name,
    description: doctor.about || undefined,
    image: doctor.photo || undefined,
    medicalSpecialty: doctor.specialty,
    ...(doctor.qualifications
      ? {
          hasCredential: doctor.qualifications.split(",").map((q) => ({
            "@type": "EducationalOccupationalCredential",
            credentialCategory: q.trim(),
          })),
        }
      : {}),
    ...(doctor.hospitalName
      ? {
          worksFor: {
            "@type": "MedicalOrganization",
            name: doctor.hospitalName,
            address: {
              "@type": "PostalAddress",
              streetAddress: doctor.address || undefined,
              addressLocality: doctor.city || undefined,
              addressRegion: doctor.state || undefined,
              postalCode: doctor.pincode || undefined,
              addressCountry: "IN",
            },
            ...(doctor.latitude && doctor.longitude ? {
              location: {
                "@type": "Place",
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: doctor.latitude.toString(),
                  longitude: doctor.longitude.toString()
                }
              }
            } : {})
          },
        }
      : {}),
    // NEX-10: 5+ genuine reviews required before publishing AggregateRating —
    // a handful of reviews reads as statistically meaningless (or manipulated)
    // to both Google's guidelines and a skeptical patient. Sourced live from
    // doctor.rating/reviewCount (real submitted reviews, see mappers.ts), so
    // this naturally updates as more reviews come in — nothing to maintain.
    ...(doctor.rating && doctor.reviewCount && doctor.reviewCount >= 5
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: doctor.rating.toString(),
            reviewCount: doctor.reviewCount.toString(),
          },
        }
      : {}),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": SITE_URL
      },
      ...(doctor.city ? [{
        "@type": "ListItem",
        "position": 2,
        "name": `Doctors in ${doctor.city}`,
        "item": `${SITE_URL}/specialties/general/${doctor.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      }] : []),
      {
        "@type": "ListItem",
        "position": doctor.city ? 3 : 2,
        "name": doctor.name,
        "item": `${SITE_URL}/doctors/${canonicalSlug}`
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <DoctorDetailClient
        doctor={doctor}
        similarDoctors={similarDoctors}
        canonicalSlug={canonicalSlug}
        locationLine={locationLine}
        whatsAppQrCodeDataUrl={whatsAppQrCodeDataUrl}
      />
    </>
  );
}
