"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OtpStep from "@/components/contributor/OtpStep";
import { PageTitle } from "@/components/contributor/ui";

function safeNext(next: string | null) {
  // Only paths inside the contributor area, never an outside address.
  return next && /^\/contribute(\/|$)/.test(next) && !next.startsWith("//") ? next : "/contribute";
}

function LoginInner() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  return (
    <div>
      <PageTitle title="Sign in" sub="Use the mobile number you registered with." />
      <OtpStep title="Sign in with WhatsApp" onVerified={(needs) => router.replace(needs ? "/contribute/join" : next)} />
      <p className="text-center text-sm text-slate-500 mt-8">New here? <Link href="/contribute/join" className="font-bold text-brand-teal hover:underline">Join as a contributor</Link></p>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}
