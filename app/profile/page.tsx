import { Metadata } from "next";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = {
  // Not "... | Doctor Dekho" — the root layout's title template already appends that brand
  // suffix to every non-absolute title; adding it here too would double it up.
  title: "Profile",
  description: "Manage your Doctor Dekho profile and settings.",
  // Auth-gated account page — an unauthenticated crawler only ever sees an empty/loading
  // shell here, so it should never be indexed.
  robots: { index: false, follow: false },
  alternates: { canonical: "/profile" },
};

export default function ProfilePage() {
  return <ProfileClient />;
}
