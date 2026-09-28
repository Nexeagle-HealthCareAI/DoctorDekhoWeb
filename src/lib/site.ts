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

/** WhatsApp Business number (91-prefixed, digits only — the format wa.me deep-links require)
 * the chat widget hands off to (see src/components/patient/ChatWidget.tsx). Provisional —
 * user-provided during planning, not yet backend-confirmed as the exact DRBOOK/OTP number.
 * One overridable constant so correcting it later is a one-line change, not a find-and-replace. */
export const WHATSAPP_BUSINESS_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER || "919060112765";

/** True only for the real production origin -- dev/preview deployments must not be indexed.
 * Case-insensitive: an env var with a different host-name casing (e.g. from a copy/paste into
 * a deploy config) must still match, since a false negative here makes robots.ts disallow
 * everything in production -- exactly the "site not indexed after migration" failure mode. */
export const IS_PRODUCTION_SITE = SITE_URL.toLowerCase() === PROD_SITE_URL.toLowerCase();
