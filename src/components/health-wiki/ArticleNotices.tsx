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

/** Sources the author listed, shown after the article text. */
export function ReferencesList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="references-heading" className="mt-10 pt-6 border-t border-slate-100">
      <h2 id="references-heading" className="font-display text-lg font-bold text-slate-900 mb-3">References</h2>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-600">
        {items.map((r, i) => <li key={i}>{r}</li>)}
      </ol>
    </section>
  );
}
