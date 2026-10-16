import { Metadata } from "next";
import FamilyClient from "./FamilyClient";

export const metadata: Metadata = {
  title: "Family Members",
  description: "The people you look after, and their health records.",
  // Auth-gated account page — never index a patient's family details.
  robots: { index: false, follow: false },
};

export default function FamilyPage() {
  return <FamilyClient />;
}
