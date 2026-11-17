import type { ReactNode } from "react";
import { Info } from "lucide-react";

/** Shown on every SECTOR UPDATE. */
export function SectorNotice() {
  return (
    <div role="note" className="flex gap-3 items-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 mb-8">
      <Info className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" aria-hidden="true" />
      <p>This article is not medical advice. It reports on developments in the health sector. For your own health, talk to a doctor.</p>
    </div>
  );
}

/** Payment, employer or product link the author declared. */
export function Disclosure({ text }: { text: string }) {
  return (
    <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-8">
      <span className="font-bold">Disclosure: </span>{text}
    </div>
  );
}

// A reference line with its web addresses made clickable. Two ways to write one, both plain text:
//   [WHO factsheet](https://www.who.int/...)   shows the words, links to the address
//   https://www.who.int/...                    a bare address links to itself
// Only http and https become links; anything else stays text.
const REFERENCE_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"]+)/gi;

export function linkifyReference(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of Array.from(text.matchAll(REFERENCE_LINK))) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    let label = m[1];
    let href = m[2] ?? m[3];
    let tail = "";
    if (!m[2]) {
      // A bare address often ends the sentence: keep the full stop or bracket out of the link.
      const trimmed = href.replace(/[.,;:!?)\]]+$/, "");
      tail = href.slice(trimmed.length);
      href = trimmed;
      label = href;
    }
    out.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-brand-teal font-semibold break-words hover:underline">
        {label}
      </a>,
    );
    if (tail) out.push(tail);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Sources the author listed, shown after the article text. */
export function ReferencesList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="references-heading" className="mt-10 pt-6 border-t border-slate-100">
      <h2 id="references-heading" className="font-display text-lg font-bold text-slate-900 mb-3">References</h2>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-600">
        {items.map((r, i) => <li key={i}>{linkifyReference(r)}</li>)}
      </ol>
    </section>
  );
}
