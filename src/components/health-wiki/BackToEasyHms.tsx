"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * A doctor who opened this article from the Health Wiki in EasyHMS arrives with ?from=1hms. This puts a "Back to EasyHMS" bar on top
 * so they can return in one tap. It only steps back in the browser history (no address is taken from the link, so it cannot send
 * anyone to another site), and it stays hidden when there is nothing to go back to, for example when the link was opened in a new tab.
 */
function Bar() {
  const from = useSearchParams().get("from");
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => { setCanGoBack(window.history.length > 1); }, []);
  if (from !== "1hms" || !canGoBack) return null;
  return (
    <div className="bg-slate-900 text-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <button type="button" onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to EasyHMS
        </button>
      </div>
    </div>
  );
}

export default function BackToEasyHms() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
