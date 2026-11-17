import type { Metadata } from "next";

/**
 * A directory page with no doctor on it ("No doctors match your criteria") gives a searcher nothing, and
 * search engines treat a pile of such pages as thin content. Keep it out of the index, but let the links on
 * it be followed. The page itself still opens normally, and starts being indexed again as soon as a doctor
 * is onboarded there (the page is rebuilt hourly).
 */
export function robotsWhenEmpty(doctorCount: number): Pick<Metadata, "robots"> {
  return doctorCount === 0 ? { robots: { index: false, follow: true } } : {};
}
