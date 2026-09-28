import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import HomeClient from "./home-client";
import { getAllDoctors, getWhatsAppEntryQrCodeDataUrl } from "@/lib/api/server";

export const revalidate = 3600;

export const metadata: Metadata = {
  // Absolute: overrides the root layout's "%s | Doctor Dekho" template — the homepage needs its
  // own full custom string rather than the generic per-page suffix. Ends in "Doctor Dekho", not
  // "NexEagle": every other page on the site now consistently ends in "Doctor Dekho" (see the
  // layout template), so this used to be the one page breaking that pattern — a split-brand
  // signal that risks an AI engine merging this entity with an unrelated "Doctor Dekho" app on
  // the Play Store. The NexEagle relationship is stated in the description below instead.
  title: { absolute: "Doctor Dekho by NexEagle – Find & Book Doctors in Purnea & Kishanganj" },
  description:
    "Doctor Dekho by NexEagle: find and book verified doctors near you in Purnea & Kishanganj — cardiologists, pediatricians, dermatologists and more. Compare experience, specialities and location, then reserve your slot online in under a minute. No app, no login.",
  keywords: [
    "find doctor near me",
    "book doctor appointment online",
    "doctor near me",
    "hospital appointment booking",
    "verified doctors India",
    "online appointment booking",
    "doctor in Purnea",
    "doctor in Kishanganj",
    "Doctor Dekho",
    "NexEagle",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Doctor Dekho by NexEagle – Find & Book Doctors in Purnea & Kishanganj",
    description:
      "Find and book verified doctors near you in Purnea & Kishanganj — compare specialities and experience, then reserve your slot online in under a minute.",
    url: "/",
    type: "website",
    // A child route's own `openGraph` object doesn't inherit the layout's `images` array, so
    // without this the homepage had no OG image at all. Reuses the same dynamic OG generator
    // as doctor pages for a real 1200x630 branded card.
    images: [{ url: `${SITE_URL}/api/og`, width: 1200, height: 630, alt: "Doctor Dekho by NexEagle" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Doctor Dekho by NexEagle – Find & Book Doctors in Purnea & Kishanganj",
    description:
      "Find and book verified doctors near you in Purnea & Kishanganj — compare specialities and experience, then reserve your slot online in under a minute.",
    images: [`${SITE_URL}/api/og`],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Doctor Dekho",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default async function HomePage() {
  // Fetched server-side so the homepage ships real doctor content in the raw
  // HTML — a non-JS crawler (Googlebot without rendering, Bing, AI bots) would
  // otherwise see an empty client shell. See src/lib/api/server.ts's getAllDoctors.
  const { doctors } = await getAllDoctors();
  const whatsAppQrCodeDataUrl = await getWhatsAppEntryQrCodeDataUrl();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <HomeClient initialDoctors={doctors} whatsAppQrCodeDataUrl={whatsAppQrCodeDataUrl} />
    </>
  );
}
