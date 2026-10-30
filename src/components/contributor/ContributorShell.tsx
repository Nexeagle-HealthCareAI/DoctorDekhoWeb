"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BadgeCheck, BookOpen, CheckCircle2, Clock, FileText, Lightbulb, PenLine, Plus, User } from "lucide-react";
import { contributorApi } from "@/lib/contributor/client";
import { initialsOf } from "@/hooks/usePatientIdentity";
import { ENROL_ROLE_LABEL, isDoctorRole, type ArticleListResponse, type ContributorMe } from "@/lib/contributor/types";
import { cn } from "@/lib/utils";

// The screens a signed-in contributor works in. The sign-in, join, finish-profile, invitation and hand-off screens have no menu.
const WITH_MENU = /^\/contribute(\/(write|review|topics)(\/|$)|$)/;

interface Item {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  count?: number;
  active: boolean;
}

/**
 * The contributor area laid out like a social profile: the person's card and a menu of their work (Write an article, Drafts, Published,
 * Pending at you, Topic requests) stay at the left and the screen fills the rest. On a phone the menu is not shown and each screen keeps
 * its own tabs and buttons.
 */
function Menu() {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  const [me, setMe] = useState<ContributorMe | null>(null);
  const [lists, setLists] = useState<ArticleListResponse | null>(null);

  // Read again on every screen change, so the counts follow a draft being saved or submitted.
  useEffect(() => {
    let alive = true;
    contributorApi.me().then((m) => alive && setMe(m)).catch(() => alive && setMe(null));
    contributorApi.articles().then((l) => alive && setLists(l)).catch(() => alive && setLists(null));
    return () => { alive = false; };
  }, [pathname, tab]);

  if (!me || me.status === "INVITED") return null;
  const doctor = isDoctorRole(me.role);
  const home = pathname === "/contribute";
  const items: Item[] = [
    { key: "write", label: "Write an article", icon: <PenLine className="w-5 h-5" />, href: "/contribute/write", active: pathname === "/contribute/write" },
    ...(doctor ? [{ key: "pending", label: "Pending at you", icon: <Clock className="w-5 h-5" />, href: "/contribute?tab=pending", count: lists?.pending.length, active: (home && (tab === "pending" || (!tab && doctor))) || pathname.startsWith("/contribute/review") }] : []),
    { key: "drafts", label: "My drafts", icon: <FileText className="w-5 h-5" />, href: "/contribute?tab=drafts", count: lists?.drafts.length, active: (home && tab === "drafts") || (pathname.startsWith("/contribute/write/") && pathname !== "/contribute/write") },
    { key: "published", label: "Published", icon: <CheckCircle2 className="w-5 h-5" />, href: "/contribute?tab=published", count: lists?.published.length, active: home && (tab === "published" || (!tab && !doctor)) },
    { key: "topics", label: "Topic requests", icon: <Lightbulb className="w-5 h-5" />, href: "/contribute/topics", active: pathname === "/contribute/topics" },
    { key: "suggest", label: "Suggest a topic", icon: <Plus className="w-5 h-5" />, href: "/contribute/topics/new", active: pathname === "/contribute/topics/new" },
  ];

  return (
    <aside className="hidden lg:block lg:sticky lg:top-6 space-y-4 self-start" aria-label="Your Health Wiki">
      <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex items-start gap-5">
        <div className="w-16 h-16 shrink-0 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center font-display font-bold text-2xl border border-teal-100" aria-hidden="true">
          {me.fullName ? initialsOf(me.fullName) : <User className="w-7 h-7" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-display font-bold text-slate-900 break-words">{me.fullName || "Your profile"}</p>
          <p className="text-sm text-slate-500 font-medium mt-0.5">{me.mobileMasked}</p>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-100 px-2.5 py-1 text-xs font-bold text-brand-teal">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" /> Health Wiki contributor
            </span>
            <span className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 leading-snug">
              {me.status === "VERIFIED" && <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />}
              {ENROL_ROLE_LABEL[me.role as keyof typeof ENROL_ROLE_LABEL] ?? "Contributor"} · {me.status === "VERIFIED" ? "Verified" : me.status === "REJECTED" ? "Not accepted" : "Under review"}
            </span>
          </p>
        </div>
      </div>

      <nav aria-label="Your work" className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 p-2">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            aria-current={it.active ? "page" : undefined}
            className={cn("flex items-center gap-4 p-3.5 rounded-xl transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal", it.active && "bg-teal-50 hover:bg-teal-50")}
          >
            <span className={cn("w-10 h-10 shrink-0 rounded-xl flex items-center justify-center", it.active ? "bg-white text-brand-teal" : "bg-slate-50 text-slate-400")}>{it.icon}</span>
            <span className={cn("flex-1 min-w-0 font-semibold text-sm", it.active ? "text-brand-teal" : "text-slate-900")}>{it.label}</span>
            {it.count !== undefined && <span className={cn("text-xs font-bold tabular-nums rounded-full px-2 py-0.5", it.active ? "bg-white text-brand-teal" : "bg-slate-100 text-slate-500")}>{it.count}</span>}
          </Link>
        ))}
        <Link href="/profile" className="flex items-center gap-4 p-3.5 rounded-xl transition-colors hover:bg-slate-50 border-t border-slate-100 mt-1">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center"><User className="w-5 h-5" /></span>
          <span className="flex-1 font-semibold text-sm text-slate-900">My profile</span>
        </Link>
      </nav>
    </aside>
  );
}

export default function ContributorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const withMenu = WITH_MENU.test(pathname);
  return (
    <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-24">
      <div className={withMenu ? "lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-8 xl:gap-12" : ""}>
        {withMenu && <Suspense fallback={null}><Menu /></Suspense>}
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
