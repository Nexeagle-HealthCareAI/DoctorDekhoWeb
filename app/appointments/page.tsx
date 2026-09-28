import { Metadata } from "next";
import AppointmentsClient from "./AppointmentsClient";

export const metadata: Metadata = {
  // Not "... | Doctor Dekho" — the root layout's title template already appends that brand
  // suffix to every non-absolute title; adding it here too would double it up.
  title: "My Appointments",
  description: "View and manage your upcoming doctor appointments on NexEagle.",
  // Auth-gated account page — an unauthenticated crawler only ever sees an empty/loading
  // shell here, so it should never be indexed.
  robots: { index: false, follow: false },
  alternates: { canonical: "/appointments" },
};

export default function AppointmentsPage() {
  return <AppointmentsClient />;
}
