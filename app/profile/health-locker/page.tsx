import { Metadata } from "next";
import HealthLockerClient from "./HealthLockerClient";

export const metadata: Metadata = {
  // Not "... | Doctor Dekho" — the root layout's title template already appends that brand
  // suffix to every non-absolute title; adding it here too would double it up.
  title: "Health Locker",
  description: "Your uploaded medical documents, all in one place.",
  // Auth-gated account page — never index a patient's document locker.
  robots: { index: false, follow: false },
};

export default function HealthLockerPage() {
  return <HealthLockerClient />;
}
