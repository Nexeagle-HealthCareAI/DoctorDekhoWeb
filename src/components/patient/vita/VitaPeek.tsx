"use client";

import Eagle from "@/components/patient/vita/Eagle";
import type { POSE } from "@/lib/vita/mood";
import { openVita } from "@/lib/vita/open";

/**
 * Vita the eagle outside the chat: a pose with a line of text and an "Ask Vita" button. Hovering (or focusing) her
 * makes her hop; tapping anywhere on it opens the Vita chat. The words carry the meaning, so the eagle itself is
 * decorative. One Vita per screen, never in an emergency — same rules as src/lib/vita/mood.ts.
 */
export default function VitaPeek({
  mood,
  size = 72,
  text,
  cta,
  where,
  className = "",
}: {
  mood: keyof typeof POSE;
  size?: number;
  text: string;
  cta: string;
  /** Which page the peek is on (a data attribute; opening the chat itself is tracked by ChatWidget). */
  where: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={openVita}
      data-vita-peek={where}
      className={`vita-peek group flex w-full max-w-xl items-center gap-3 rounded-2xl border border-teal-100 bg-white/90 px-3 py-2 text-left shadow-sm transition hover:border-brand-teal/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${className}`}
    >
      <span className="vita-peek-eagle shrink-0">
        <Eagle mood={mood} size={size} />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-700">{text}</span>
      <span className="shrink-0 rounded-xl bg-brand-teal px-3 py-2 text-xs font-bold text-white group-hover:bg-brand-teal/90">{cta}</span>
    </button>
  );
}
