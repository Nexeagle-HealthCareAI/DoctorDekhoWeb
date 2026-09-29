import type { Metadata } from "next";

// Internal tool -- must never be indexed or linked from anywhere crawlable.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
