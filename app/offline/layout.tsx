import type { Metadata } from "next";

// page.tsx is a client component (zero-data-dependency PWA fallback), so metadata can't be
// exported from it directly — this layout carries it instead. This route is a service-worker
// fallback shown on a dead connection, never a real destination, so it must stay out of the
// index rather than silently inheriting the homepage's title.
export const metadata: Metadata = {
  // Not "... | Doctor Dekho" — the root layout's title template already appends that brand
  // suffix to every non-absolute title; adding it here too would double it up.
  title: "You're Offline",
  robots: { index: false, follow: false },
};

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
