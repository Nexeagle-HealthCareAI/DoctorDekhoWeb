import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface BreadcrumbEntry {
  label: string;
  href?: string; // omitted on the current/last page
}

// Visible breadcrumb trail for the specialty/condition pSEO hub pages — previously these had
// clear hierarchical URLs (/specialties/{specialty}/{city}/{area}) but no on-site trail to
// navigate them, only the sitemap. Pair with a BreadcrumbList JSON-LD built from the same
// `items` in the page itself (see e.g. app/specialties/[specialty]/[city]/[area]/page.tsx).
export default function PageBreadcrumb({ items }: { items: BreadcrumbEntry[] }) {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 sm:gap-2.5">
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={item.href} className="hover:text-brand-teal font-medium">{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="text-slate-800 font-semibold truncate max-w-[200px]">{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}
