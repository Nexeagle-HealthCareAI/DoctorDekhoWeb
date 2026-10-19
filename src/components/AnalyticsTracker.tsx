"use client";

import { useEffect } from "react";
import { trackPageView } from "@/lib/analytics";

type Props = {
  title: string;
};

// Page-view beacon for the CMS "Site Visits" report. Queued and batched by src/lib/analytics.ts
// (skipped entirely when the visitor declined tracking). The old gtag('config', 'GA_MEASUREMENT_ID')
// call was removed: it used a placeholder id, so it never reported anywhere.
export default function AnalyticsTracker({ title }: Props) {
  useEffect(() => {
    trackPageView();
  }, [title]);
  return null;
}
