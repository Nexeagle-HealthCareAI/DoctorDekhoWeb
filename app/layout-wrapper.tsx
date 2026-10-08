"use client";

import { usePathname } from "next/navigation";
import PatientBottomNav from "@/components/patient/PatientBottomNav";
import InstallPrompt from "@/components/patient/InstallPrompt";
import ChatWidget from "@/components/patient/ChatWidget";

// Every route on this site is the patient portal, and each page renders its own PatientTopBar /
// PatientFooter. The only pages that skip the app-style bottom nav + install banner are the
// focused ones: the OTP login (nothing to navigate away to mid-flow), the offline fallback
// (its links can't work with no connection), and the internal admin tool (not a patient page).
const BARE_ROUTES = ["/login", "/offline", "/admin"];

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  return (
    <>
      {children}
      {!isBare && (
        <>
          <PatientBottomNav />
          <InstallPrompt />
          <ChatWidget />
        </>
      )}
    </>
  );
}
