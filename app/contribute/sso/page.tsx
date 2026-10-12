"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { contributorApi } from "@/lib/contributor/client";
import { Banner, Loading, card } from "@/components/contributor/ui";

// A hospital doctor who chose "Write an article" in EasyHMS lands here with a one-time code in the address. The code is swapped for a
// session on the server (the cookie is HttpOnly) and taken out of the address bar, then the doctor goes straight to writing.
export default function SsoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const to = params.get("to") === "drafts" ? "/contribute?tab=drafts" : "/contribute/write";
    // The code must not stay in the browser history or be shared by copying the address.
    window.history.replaceState(null, "", "/contribute/sso");
    if (!code) {
      setError("This link is not complete. Go back to EasyHMS and choose Write an article again.");
      return;
    }
    contributorApi
      .ssoExchange(code)
      .then(() => router.replace(to))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong. Try again."));
  }, [router]);

  if (!error) return <Loading label="Signing you in from EasyHMS…" />;
  return (
    <div className={`${card} max-w-lg mx-auto p-6 sm:p-8 space-y-4`}>
      <h1 className="font-display text-xl font-bold text-slate-900">We could not sign you in</h1>
      <Banner tone="warn">{error}</Banner>
      <p className="text-sm text-slate-600">The link from EasyHMS works once and only for a minute. Open EasyHMS, go to Health Wiki and choose Write an article again.</p>
    </div>
  );
}
