import type { Metadata } from "next";

// page.tsx is a client component (OTP flow), so metadata can't be exported from it directly —
// this layout carries it instead. Previously /login had no metadata export at all and silently
// inherited the homepage's generic title.
export const metadata: Metadata = {
  // Not "... | Doctor Dekho" — the root layout's title template already appends that brand
  // suffix to every non-absolute title; adding it here too would double it up.
  title: "Log In",
  description: "Log in to Doctor Dekho with your phone number to manage bookings and appointments.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
