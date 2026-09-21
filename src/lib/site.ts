// Single source of truth for this deployment's public origin, and for the sibling NexEagle
// business site that this app links out to.
//
// NEXT_PUBLIC_-prefixed on purpose: SITE_URL is read from client components too (share links,
// QR/OG URLs), and Next only inlines NEXT_PUBLIC_* vars into the browser bundle -- at BUILD
// time, so these arrive as Docker build-args (see Dockerfile / deploy.yml), not `docker run -e`.
// Defaults are the PRODUCTION origins so a plain `next build` is prod-correct; the dev deploy
// overrides both.
const PROD_SITE_URL = "https://doctordekho.nexeagle.com";

const stripTrailingSlash = (u: string) => u.replace(/\/+$/, "");

/** This site's own public origin, e.g. https://doctordekho.nexeagle.com (no trailing slash). */
export const SITE_URL = stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || PROD_SITE_URL);

/** The NexEagle corporate/B2B site (a separate app + deployment), e.g. https://nexeagle.com. */
export const BUSINESS_URL = stripTrailingSlash(process.env.NEXT_PUBLIC_BUSINESS_URL || "https://nexeagle.com");

/** True only for the real production origin -- dev/preview deployments must not be indexed. */
export const IS_PRODUCTION_SITE = SITE_URL === PROD_SITE_URL;
