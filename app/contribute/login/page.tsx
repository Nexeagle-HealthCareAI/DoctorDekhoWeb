"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OtpStep from "@/components/contributor/OtpStep";
import { PageTitle, Loading } from "@/components/contributor/ui";
import { contributorApi } from "@/lib/contributor/client";

function safeNext(next: string | null) {
  // Only paths inside the contributor area, never an outside address.
  return next && /^\/contribute(\/|$)/.test(next) && !next.startsWith("//") ? next : "/contribute";
}

function LoginInner() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  // Signed in on Doctor Dekho already: no second code. A patient who is not a contributor yet is taken to join.
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let alive = true;
    contributorApi.sessionFromPatient()
      .then((r) => { if (alive) router.replace(r.needsRegistration ? "/contribute/register" : next); })
      .catch(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [router, next]);
  if (checking) return <Loading label="Signing you in…" />;
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
