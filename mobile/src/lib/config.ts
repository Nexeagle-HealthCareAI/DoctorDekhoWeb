// Build-time configuration. EXPO_PUBLIC_* values are inlined by the bundler, so each EAS profile
// (development / preview / production in eas.json) can point the app at its own environment.

const trimSlash = (v: string) => v.replace(/\/+$/, "");

export const config = {
  /** EasyHMS public API root (no trailing slash, no /public). */
  apiBaseUrl: trimSlash(process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://1hms-dev-api.nexeagle.com"),
  /** Doctor Dekho's symptom-search endpoint (NLP router + Groq live server-side, so no AI keys ship in the app). */
  searchParseUrl: process.env.EXPO_PUBLIC_SEARCH_PARSE_URL ?? "https://doctordekho-dev.nexeagle.com/api/search/parse",
  /** Website, for privacy / terms links and sharing doctor pages. */
  siteUrl: trimSlash(process.env.EXPO_PUBLIC_SITE_URL ?? "https://doctordekho.nexeagle.com"),
  businessUrl: trimSlash(process.env.EXPO_PUBLIC_BUSINESS_URL ?? "https://nexeagle.com"),
  whatsappNumber: process.env.EXPO_PUBLIC_WHATSAPP_NUMBER ?? "919060112765",
  /** Number the Help button and "Call and we'll book for you" dial. Set EXPO_PUBLIC_SUPPORT_PHONE to a staffed line. */
  supportPhone: process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? "+919060112765",
  supportEmail: "info@nexeagle.com",
  requestTimeoutMs: 15000,
} as const;
