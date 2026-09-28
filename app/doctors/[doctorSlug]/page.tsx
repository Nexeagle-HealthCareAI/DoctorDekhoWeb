import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DoctorDetailClient from "@/components/patient/DoctorDetailClient";
import { getDoctorById, getDoctorQrCodeDataUrl, easyhmsFetch } from "@/lib/api/server";
import { mapDoctors } from "@/lib/api/mappers";
import type { DoctorsResponseDto, ReviewsResponseDto } from "@/lib/api/types";
import {
  doctors as mockDoctors,
  doctorSlug,
  parseDoctorIdFromSlug,
  cityId,
  type Doctor,
} from "@/data/patient";

// The card/directory grid shows an aggregate doctor.rating/reviewCount field (see
// mappers.ts), but that aggregate can drift from the real submitted reviews returned by
// /public/doctors/{id}/reviews — the same endpoint ReviewsSection queries client-side for
// the visible "Reviews (N)" header. Fetching it here too, server-side, lets the page's own
// AggregateRating JSON-LD match what a visitor (and a search-result rich snippet) actually
// sees on this page, instead of a possibly-stale aggregate number — see NEX-10's original
// review-count gate, which this replaces the source for.
async function getLiveReviewSummary(doctorId: string): Promise<{ rating: number; reviewCount: number } | null> {
  try {
    const r = await easyhmsFetch<ReviewsResponseDto>(`/public/doctors/${encodeURIComponent(doctorId)}/reviews`);
    if (r.notConfigured || !r.data) return null;
    // reviews.length (not the DTO's own reviewCount field) — matches exactly what
    // ReviewsSection.tsx renders as "(N)" via the same endpoint, so JSON-LD and visible
    // content can never disagree.
    return { rating: r.data.averageRating ?? 0, reviewCount: r.data.reviews?.length ?? 0 };
  } catch {
    return null;
  }
}

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
  // Absolute: the layout's "%s | NexEagle" template would otherwise stack a second suffix on
  // top of "Doctor Dekho" here, pushing longer name/specialty combinations well past 60-70
  // chars and into Google's truncation range. Brand is included directly instead.
  const title = `${doctor.name} — ${doctor.specialty}${place ? ` in ${doctor.city}` : ""} | Doctor Dekho`;
  const description = [
    `Book an appointment with ${doctor.name}`,
    doctor.qualifications ? ` (${doctor.qualifications})` : "",
    `, ${doctor.specialty}`,
    doctor.experienceYears ? ` — ${doctor.experienceYears}+ years experience` : "",
    place ? ` at ${place}` : "",
    ". Verify by OTP. No login required.",
  ].filter(Boolean).join("");
  const canonicalSlug = doctorSlug(doctor, doctor.city);
  // Omit &rating entirely when there's no rating yet, rather than appending an empty value
  // (`&rating=`) — a dangling empty query param served no purpose and just left every unrated
  // doctor's OG image URL looking malformed.
  const ogImageParams = new URLSearchParams({ title: doctor.name, subtitle: doctor.specialty });
  if (doctor.rating) ogImageParams.set("rating", doctor.rating.toString());
  const ogImageUrl = `${SITE_URL}/api/og?${ogImageParams.toString()}`;

  return {
    title: { absolute: title },
    description,
    // Doctor pages don't need the root layout's site-wide keyword list (which includes
    // "pathology lab near me" — irrelevant here); override with terms specific to this doctor.
    keywords: [doctor.name, doctor.specialty, doctor.city, `${doctor.specialty} near me`, `book appointment ${doctor.specialty.toLowerCase()}`].filter(Boolean),
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
  const liveReviews = await getLiveReviewSummary(doctor.id);

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
    // to both Google's guidelines and a skeptical patient. Sourced from
    // liveReviews (the same /reviews endpoint ReviewsSection renders as the
    // visible "Reviews (N)" header), NOT doctor.rating/reviewCount — that
    // aggregate field can drift out of sync with real submitted reviews, which
    // previously made this markup disagree with the page's own visible content
    // (a review-snippet guideline violation).
    ...(liveReviews && liveReviews.rating && liveReviews.reviewCount >= 5
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: liveReviews.rating.toString(),
            reviewCount: liveReviews.reviewCount.toString(),
          },
        }
      : {}),
  };

  // Same canonical-id requirement as the "View all" link in DoctorDetailClient.tsx — a
  // bare lowercased city name isn't a valid /specialties/{specialty}/{city} id (city
  // names collide across states), so only link here when it resolves to a real page.
  const doctorCityId = doctor.city && doctor.state ? cityId(doctor.city, doctor.state) : undefined;
  const breadcrumbCityHref = doctorCityId ? `${SITE_URL}/specialties/general/${doctorCityId}` : null;

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
      ...(doctor.city && breadcrumbCityHref ? [{
        "@type": "ListItem",
        "position": 2,
        "name": `Doctors in ${doctor.city}`,
        "item": breadcrumbCityHref
      }] : []),
      {
        "@type": "ListItem",
        "position": doctor.city && breadcrumbCityHref ? 3 : 2,
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
