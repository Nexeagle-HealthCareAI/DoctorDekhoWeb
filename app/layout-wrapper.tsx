"use client";

import { usePathname } from "next/navigation";
import PatientBottomNav from "@/components/patient/PatientBottomNav";
import InstallPrompt from "@/components/patient/InstallPrompt";

// Every route on this site is the patient portal, and each page renders its own PatientTopBar /
// PatientFooter. The only pages that skip the app-style bottom nav + install banner are the
// focused ones: the OTP login (nothing to navigate away to mid-flow) and the offline fallback
// (its links can't work with no connection).
const BARE_ROUTES = ["/login", "/offline"];

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
        </>
      )}
    </>
  );
}
