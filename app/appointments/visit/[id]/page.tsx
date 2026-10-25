import { Metadata } from "next";
import VisitClient from "./VisitClient";

// The visit page for one booking (Vita vision, Phase 4). The WhatsApp confirmation and reminders link here ("Visit details").
export const metadata: Metadata = {
  title: "Your visit",
  description: "Directions, check-in and your token for your Doctor Dekho visit.",
  robots: { index: false, follow: false },
};

export default function VisitPage({ params }: { params: { id: string } }) {
  return <VisitClient appointmentId={params.id} />;
}
