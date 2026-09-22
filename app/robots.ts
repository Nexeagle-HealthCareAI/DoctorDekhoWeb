import { MetadataRoute } from 'next';
import { SITE_URL, IS_PRODUCTION_SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // Dev (doctordekho-dev.*) serves the same content as prod under a different host --
  // keep it out of search indexes so it can't compete with, or be mistaken for, the real site.
  if (!IS_PRODUCTION_SITE) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      // Explicit, named allow for AI crawlers/answer engines — matches the
      // wildcard rule above in effect, but states the intent plainly rather
      // than relying on bots correctly falling back to '*'.
      {
        userAgent: ['ChatGPT-User', 'OAI-SearchBot', 'anthropic-ai', 'ClaudeBot', 'PerplexityBot'],
        allow: '/',
      },
      // Explicit Bingbot allow — ChatGPT's live-search feature is powered by
      // Bing's index, so this doubles as an AI-crawl signal, not just classic
      // web search. Practo and JustDial both take this same explicit-over-
      // wildcard approach.
      {
        userAgent: 'Bingbot',
        allow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
