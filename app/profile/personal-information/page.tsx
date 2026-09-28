import { Metadata } from "next";
import PersonalInformationClient from "./PersonalInformationClient";

export const metadata: Metadata = {
  // Not "... | Doctor Dekho" — the root layout's title template already appends that brand
  // suffix to every non-absolute title; adding it here too would double it up.
  title: "Personal Information",
  description: "Your details on file with NexEagle Doctor Dekho.",
  // Auth-gated account page — never index a patient's personal details.
  robots: { index: false, follow: false },
};

export default function PersonalInformationPage() {
  return <PersonalInformationClient />;
}
