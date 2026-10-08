import Link from "next/link";

export type TypeFilterValue = "all" | "medical" | "sector-update";

const OPTIONS: { value: TypeFilterValue; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/health" },
  { value: "medical", label: "Medical", href: "/health?type=medical" },
  { value: "sector-update", label: "Sector updates", href: "/health?type=sector-update" },
];

/** Plain links, so the filter works without JavaScript and each view has its own address. */
export default function TypeFilter({ value }: { value: TypeFilterValue }) {
  return (
    <nav aria-label="Filter articles by type" className="flex flex-wrap gap-2 mb-8">
      {OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          aria-current={o.value === value ? "page" : undefined}
          className={`px-4 py-2 rounded-full text-sm font-semibold border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal ${
            o.value === value ? "bg-brand-teal text-white border-brand-teal" : "bg-white text-slate-600 border-slate-200 hover:border-brand-teal/40"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
