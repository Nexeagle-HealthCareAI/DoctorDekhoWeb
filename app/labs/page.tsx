import type { Metadata } from "next";
import PatientTopBar from "@/components/patient/PatientTopBar";
import PatientFooter from "@/components/patient/PatientFooter";
import PatientBottomNav from "@/components/patient/PatientBottomNav";
import LabDirectory from "@/components/labs/LabDirectory";
import { getAllLabs } from "@/lib/api/server";

export const revalidate = 3600;

// Not "... | Doctor Dekho" in the title/og title below — the root layout's title template
// already appends that brand suffix to every non-absolute title; adding it here too would
// double it up.
export const metadata: Metadata = {
  title: "Find a Pathology Lab Near Me",
  description:
    "Find diagnostic and pathology labs near you -- compare test categories, addresses, and contact details, then get directions in a click.",
  keywords: ["pathology lab near me", "diagnostic centre", "blood test lab", "Doctor Dekho"],
  alternates: { canonical: "/labs" },
  openGraph: {
    title: "Find a Pathology Lab Near Me",
    description: "Find diagnostic and pathology labs near you across every NexEagle-powered hospital.",
    url: "/labs",
    type: "website",
  },
};

export default async function LabsPage() {
  // Fetched server-side so this page ships real lab content in the raw HTML for crawlers,
  // same discipline as the doctor homepage -- see src/lib/api/server.ts's getAllLabs.
  const { labs } = await getAllLabs();

  return (
    <>
      <PatientTopBar />
      <LabDirectory initialLabs={labs} />
      <PatientFooter />
      <PatientBottomNav />
    </>
  );
}
