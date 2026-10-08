import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import CursorGlow from "@/components/ui/CursorGlow";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Inter, Poppins } from "next/font/google";
import LayoutWrapper from "./layout-wrapper";
import ConnectionStatusBanner from "@/components/patient/ConnectionStatusBanner";
import InstallAppPrompt from "@/components/patient/InstallAppPrompt";
import LaunchSplash from "@/components/patient/LaunchSplash";
import { SITE_URL, BUSINESS_URL, IS_PRODUCTION_SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap"
});

const DESCRIPTION =
  "Doctor Dekho by NexEagle: find verified doctors, clinics and pathology labs near you, compare experience and ratings, and book appointments online in under a minute.";

export const metadata: Metadata = {
  // Template was "%s | NexEagle" — every non-homepage page's visible <title> ended in "NexEagle"
  // while og:site_name/schema said "Doctor Dekho", a split-entity signal that risks AI engines
  // merging this with the unrelated "Doctor Dekho" app on the Play Store (see the GEO audit's
  // "Brand entity" finding). One consistent consumer-facing brand across title, og:site_name and
  // twitter now; NexEagle's relationship is stated explicitly via description + the
  // MedicalOrganization/parentOrganization JSON-LD below, which is the correct place for that
  // disambiguation (not a concatenated title string on every page).
  title: {
    default: "Doctor Dekho — Find & Book Doctors Near You",
    template: "%s | Doctor Dekho"
  },
  description: DESCRIPTION,
  keywords: ["Doctor Dekho", "NexEagle", "find doctors near me", "book doctor appointment online", "pathology lab near me"],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Doctor Dekho — Find & Book Doctors Near You",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Doctor Dekho",
    images: [
      {
        url: "/assets/logo.webp",
        // Actual file is 1024x1024 (square) — declaring 1200x630 here mismatched the real
        // asset and could cause Facebook/LinkedIn crawlers to crop/mis-render it.
        width: 1024,
        height: 1024,
        alt: "Doctor Dekho by NexEagle",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Doctor Dekho — Find & Book Doctors Near You",
    description: DESCRIPTION,
    images: ["/assets/logo.webp"],
    creator: "@nexeagle",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Doctor Dekho",
  },
  // Belt-and-braces with robots.ts: a non-production host must never be indexed.
  ...(IS_PRODUCTION_SITE ? {} : { robots: { index: false, follow: false } }),
  verification: {
    // Google Search Console site-ownership check.
    google: "24K8hQuZVcT5jq6MC0ga0cNvIlVRxN1psoti8ASiuNk",
    // Bing Webmaster Tools site-ownership check.
    other: {
      "msvalidate.01": "EC6A77DDD7DD7DA18EF0724DEAABA6F3",
    },
  },
};

// Installable PWA: standalone display + brand theme-color for the Android status
// bar / splash screen.
//
// interactiveWidget: "resizes-visual" -- without this, Chrome on Android resizes the CSS
// layout viewport itself when the on-screen keyboard opens (its default "resizes-content"
// behavior), which shrinks every 100svh-based container site-wide (see PatientHero's hero
// <section>) and squeezes the whole hero into whatever sliver of height is left the instant
// the search input is focused. "resizes-visual" keeps the layout viewport fixed and only
// shrinks the visual viewport behind the keyboard, matching iOS Safari's default and how a
// native app would behave.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1ea99b",
  interactiveWidget: "resizes-visual",
};

// Sitewide entity schema (NEX-9) — every page shares one @id so Google/AI
// crawlers resolve "Doctor Dekho" to a single, consistent, verifiable entity
// rather than re-deriving it per page. NexEagle is declared as the parent org, which is the
// link between this site's entity and the corporate site's own (nexeagle.com/#organization).
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "MedicalOrganization",
  "@id": `${SITE_URL}/#organization`,
  name: "Doctor Dekho",
  // Disambiguates this entity from an unrelated "Doctor Dekho" app on the Play Store (a
  // different company/package) — the structured-data-correct way to do this (schema.org name
  // stays clean for entity recognition; alternateName carries the fuller, searched-for form).
  alternateName: "Doctor Dekho by NexEagle",
  url: SITE_URL,
  logo: `${SITE_URL}/assets/logo.webp`,
  // Explicit originality/differentiation claim for AI engines to cite — deep, verified doctor
  // coverage of the Seemanchal region (Purnea, Kishanganj and surrounding Bihar towns) is this
  // site's actual differentiator versus national aggregators, which is otherwise nowhere stated
  // as a citable fact (see the GEO audit's "Originality" finding).
  description:
    "Doctor Dekho by NexEagle connects patients with verified doctors across NexEagle's network of hospitals for online appointment booking, with the deepest verified doctor coverage of the Seemanchal region (Purnea, Kishanganj and surrounding Bihar) of any platform.",
  parentOrganization: {
    "@type": "Organization",
    "@id": `${BUSINESS_URL}/#organization`,
    name: "NexEagle",
    url: BUSINESS_URL,
  },
  sameAs: ["https://linkedin.com/company/nexeagle"],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+91-8074906808",
    email: "info@nexeagle.com",
    contactType: "customer service",
    areaServed: "IN",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${poppins.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="min-h-screen bg-white">
        <Providers>
          <LaunchSplash />
          <CursorGlow />
          <Toaster />
          <Sonner />
          <ConnectionStatusBanner />
          <LayoutWrapper>{children}</LayoutWrapper>
          <InstallAppPrompt />
        </Providers>
      </body>
    </html>
  );
}
