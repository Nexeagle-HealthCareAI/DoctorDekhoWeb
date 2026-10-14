"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { contributorApi } from "@/lib/contributor/client";
import type { ContributorMe } from "@/lib/contributor/types";

export default function ContributorHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<ContributorMe | null>(null);

  useEffect(() => {
    let alive = true;
    contributorApi.me().then((m) => alive && setMe(m)).catch(() => alive && setMe(null));
    return () => { alive = false; };
    // Re-check when the route changes (after signing in or out).
  }, [pathname]);

  const signOut = async () => {
    await contributorApi.logout().catch(() => undefined);
    setMe(null);
    router.replace("/contribute/login");
  };

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <Link href={me ? "/contribute" : "/health"} className="flex items-center gap-3 shrink-0" aria-label="Health Wiki contributors home">
          <span className="sm:hidden"><Logo iconOnly iconClassName="w-11 h-11" /></span>
          <span className="hidden sm:inline-flex"><Logo textSize="text-lg" /></span>
          <span className="hidden md:inline text-xs font-bold uppercase tracking-widest text-slate-400 border-l border-slate-200 pl-3">Health Wiki contributors</span>
        </Link>
        {me && (
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-slate-700 truncate max-w-[10rem]">{me.fullName || "Your profile"}</span>
            <button type="button" onClick={signOut} aria-label="Sign out" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-teal rounded-lg px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal">
              <LogOut className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
