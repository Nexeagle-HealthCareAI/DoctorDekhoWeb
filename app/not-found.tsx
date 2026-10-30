"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { POSE } from "@/lib/vita/mood";
import { usePathname } from "next/navigation";
import AnalyticsTracker from "@/components/AnalyticsTracker";

export default function NotFound() {
  const pathname = usePathname();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      pathname
    );
  }, [pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <AnalyticsTracker title="Page Not Found - NexEagle" />
      <div className="text-center px-6">
        <Image src={POSE.flying} alt="" width={200} height={142} aria-hidden="true" className="vita-fly-in mx-auto mb-4 h-auto w-[200px] object-contain" priority />
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! This page flew away.</p>
        <Link href="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
}
