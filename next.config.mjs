import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Don't force a full page reload the instant connectivity returns — the patient
  // could be mid-way through the booking form when a flaky connection flickers back;
  // React Query's own refetchOnReconnect already gets fresh data without discarding it.
  reloadOnOnline: false,
  // Only precache the small PWA icon set at install time, NOT the rest of public/ —
  // public/assets/ holds ~15MB of marketing images (Background.png alone is 6MB+),
  // and force-downloading those on a 2G connection before the visitor has even asked
  // for them would defeat the entire point of this feature. Those images still get
  // cached, just opportunistically at runtime as each page is actually visited (see
  // defaultCache's image rule in app/sw.ts).
  globPublicPatterns: ["icons/**/*.png", "favicon.ico"],
  // The /offline fallback (see app/sw.ts's `fallbacks` option) must be precached
  // upfront to be available with zero network at all — a fresh revision string each
  // build keeps it from going stale forever after the first install.
  additionalPrecacheEntries: [{ url: "/offline", revision: String(Date.now()) }],
});

// Cover and inline images in Health Wiki articles are uploaded to the object store. Add its public
// origin(s), space separated, in HEALTH_WIKI_IMAGE_ORIGINS at build time (for example the prod bucket
// host) so the browser is allowed to load them. The dev bucket is already allowed below.
const healthWikiImageOrigins = (process.env.HEALTH_WIKI_IMAGE_ORIGINS || "")
  .split(/\s+/)
  .filter((o) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o))
  .join(" ");

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  // Mapbox needs three separate allowances: connect-src for the Directions Matrix API
  // (geo.ts's getDrivingDistances) and the vector tile/style/glyph/sprite requests the
  // interactive map (HospitalsMapView.tsx) makes itself, img-src for the static preview
  // pin image (DoctorLocationMap.tsx), and worker-src since mapbox-gl parses tiles in a
  // blob: Web Worker. events.mapbox.com is its telemetry beacon, sent by default.
  // router.project-osrm.org is gone -- geo.ts no longer calls the OSRM demo server (see
  // "Swap OSRM public demo server for Mapbox Matrix API"). BigDataCloud's reverse-geocode
  // endpoint redirects from api.bigdatacloud.net to api-bdc.io, so both are needed.
  { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://nexeagle-dev.in-south1-objectstore.e2enetworks.net https://api.mapbox.com${healthWikiImageOrigins ? ` ${healthWikiImageOrigins}` : ''}; worker-src 'self' blob:; connect-src 'self' https://api.bigdatacloud.net https://api-bdc.io https://api.mapbox.com https://events.mapbox.com;` }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@radix-ui/react-icons'],
    // Serializes static-page generation to ONE worker process instead of Next's default
    // per-CPU-core pool. Without this, ~400 specialty/city/area pages get spread across
    // several parallel worker PROCESSES, each with its OWN independent in-memory
    // unstable_cache -- so on a cold cache, every worker's first page independently fires
    // its own real fetch to /public/doctors (a "cache stampede") instead of the single
    // shared call the code comment in src/lib/api/server.ts assumes. Confirmed hitting this
    // in practice: PublicController's PublicBookingPolicy rate-limits that endpoint to 20
    // req/min per IP with zero queueing, and CI builds intermittently exceeded it -- same
    // domain, same moment, sometimes passing and sometimes failing depending on how the
    // worker burst landed in the window. cpus:1 makes exactly one real fetch happen for the
    // whole build (the first page populates the cache, everything after reuses it),
    // trading some build wall-clock time for eliminating the stampede outright rather than
    // just narrowing the odds of it.
    cpus: 1,
  },
  images: {
    minimumCacheTTL: 86400, // 24 hours caching for avatars
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nexeagle-dev.in-south1-objectstore.e2enetworks.net",
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);
