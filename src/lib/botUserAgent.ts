// Crawlers and link-preview renderers (Googlebot, Applebot, Meta, Bing, headless Chrome, Lighthouse…)
// execute this site's JavaScript and would otherwise be recorded as visitors, filling the CMS location
// report with Mountain View, Cupertino and Council Bluffs. Used by src/lib/analytics.ts (do not send)
// and app/api/track/route.ts (do not forward). EasyHMS applies the same list again server-side
// (EasyHMSAPI.Application.Common.TrafficClassifier) and also flags data-centre IPs.
const BOT_UA =
  /googlebot|google-inspectiontool|googleother|google-read-aloud|adsbot|mediapartners|apis-google|feedfetcher|google page renderer|storebot|bingbot|bingpreview|msnbot|adidxbot|applebot|facebookexternalhit|facebookcatalog|meta-externalagent|meta-externalfetcher|yandex|baiduspider|duckduckbot|petalbot|bytespider|sogou|ahrefs|semrush|mj12bot|dotbot|dataforseo|seznambot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|perplexity|ccbot|amazonbot|headlesschrome|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|phantomjs|puppeteer|playwright|selenium|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|skypeuripreview|pinterestbot|redditbot|embedly|vercel-screenshot|python-requests|python-urllib|aiohttp|^curl\/|^wget\/|okhttp|go-http-client|node-fetch|^axios\/|java\/|crawler|spider|bot\/|bot;|bot\)|\(bot|\+http/i;

/** True for a missing user agent or one that names a bot, crawler, preview renderer or HTTP library. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_UA.test(userAgent);
}

/** Browser side: automation (webdriver) or a bot user agent. */
export function isAutomatedBrowser(): boolean {
  if (typeof navigator === "undefined") return true;
  try {
    if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return true;
  } catch {
    /* ignore */
  }
  return isBotUserAgent(navigator.userAgent);
}
