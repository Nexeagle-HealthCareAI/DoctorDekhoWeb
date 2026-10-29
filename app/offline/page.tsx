"use client";

import { WifiOff, RotateCw, Home } from "lucide-react";
import Link from "next/link";

// Served by the service worker (see app/sw.ts's `fallbacks` config) when a page
// navigation fails with nothing cached to fall back to yet — e.g. the very first
// visit on a dead connection. Deliberately has zero data dependency (no React
// Query, no fetch) so it always renders instantly regardless of network state.
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white shadow-sm p-8 text-center">
        {/* Vita sleeps while there's no connection. A plain <img>: this page is served with no network, and if the
            picture isn't cached either, the usual Wi-Fi icon shows instead. */}
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 m-auto flex w-14 h-14 rounded-2xl bg-teal-50 text-brand-teal items-center justify-center">
            <WifiOff className="w-7 h-7" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vita/sleeping.png" alt="" aria-hidden="true" className="relative h-28 w-28 object-contain bg-white" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <h1 className="mt-5 text-lg font-bold text-slate-900">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          We couldn&apos;t reach NexEagle. Check your connection — pages you&apos;ve
          already visited will still open from where you left off.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal text-white text-sm font-bold py-3 shadow-sm hover:bg-brand-teal/90 active:scale-[0.98] transition"
          >
            <RotateCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold py-3 hover:bg-slate-50 active:scale-[0.98] transition"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
