"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Calendar, ChevronRight, FolderHeart, HelpCircle, PenLine, User } from "lucide-react";
import { openContributorArea, useContributorTag } from "@/hooks/useContributorTag";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { CONTRIBUTOR_ENABLED } from "@/lib/contributor/session";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  busy?: boolean;
  tone?: "teal";
}

/**
 * The sections of the signed-in account, as one list. On a phone it is the profile page itself; on a large screen it is the menu at the
 * left with the current section highlighted, the way social sites lay out an account. Sign out is not here: it is in the top bar menu.
 */
export default function ProfileNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn } = usePatientAuth();
  const tag = useContributorTag(isLoggedIn).data;
  const [opening, setOpening] = useState(false);

  // A contributor goes straight in (their number was just proven by this login); someone invited who has not finished goes through the join steps.
  const openArea = async () => {
    setOpening(true);
    const r = await openContributorArea();
    if (r.ok) {
      router.push("/contribute");
      return;
    }
    toast.error(r.message ?? "Could not open your Health Wiki area. Try again.");
    setOpening(false);
  };

  const rows: Row[] = [
    { key: "info", label: "Personal Information", icon: <User className="w-5 h-5" />, href: "/profile/personal-information" },
    { key: "appointments", label: "My Appointments", icon: <Calendar className="w-5 h-5" />, href: "/appointments" },
    { key: "locker", label: "Health Locker", icon: <FolderHeart className="w-5 h-5" />, href: "/profile/health-locker" },
  ];
  // Health Wiki is in this menu only for contributors. A patient who is not one sees nothing about it here (the Health Wiki itself is open to
  // everyone from the top bar menu and the footer, and they can still join from there).
  if (CONTRIBUTOR_ENABLED && tag?.isContributor) {
    if (tag.status === "INVITED") {
      // Invited by the team but the profile is not finished
      rows.push({ key: "finish", label: "Complete your Health Wiki profile", hint: "The team invited you. Finish your details to start writing", icon: <PenLine className="w-5 h-5" />, href: "/contribute/register" });
    } else {
      rows.push({ key: "mine", label: opening ? "Opening…" : "My Health Wiki articles", hint: "Write, review and track your articles and topics", icon: <BookOpen className="w-5 h-5" />, onClick: openArea, busy: opening, tone: "teal" });
    }
  }
  rows.push({ key: "help", label: "Help & Support", icon: <HelpCircle className="w-5 h-5" />, href: "mailto:info@nexeagle.com" });

  const cell = (r: Row) => {
    // the profile page itself opens on the first section, so it counts as Personal Information
    const active = r.href ? pathname === r.href || (r.key === "info" && pathname === "/profile") : false;
    const base = cn(
      "w-full text-left flex items-center gap-4 p-4 lg:p-3.5 transition-colors border-b border-slate-100 last:border-b-0 lg:border-b-0 lg:rounded-xl hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60",
      active && "bg-teal-50 hover:bg-teal-50"
    );
    const inner = (
      <>
        <span className={cn("w-10 h-10 shrink-0 rounded-xl flex items-center justify-center", r.tone === "teal" || active ? "bg-teal-50 text-brand-teal lg:bg-white" : "bg-slate-50 text-slate-400")}>{r.icon}</span>
        <span className="flex-1 min-w-0">
          <span className={cn("block font-semibold text-sm", active ? "text-brand-teal" : "text-slate-900")}>{r.label}</span>
          {r.hint && <span className="block text-xs text-slate-400 mt-0.5 lg:hidden">{r.hint}</span>}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-300 lg:hidden" aria-hidden="true" />
      </>
    );
    if (r.onClick) return <button key={r.key} type="button" onClick={r.onClick} disabled={r.busy} className={base}>{inner}</button>;
    if (r.href?.startsWith("mailto:")) return <a key={r.key} href={r.href} className={base}>{inner}</a>;
    return <Link key={r.key} href={r.href!} aria-current={active ? "page" : undefined} className={base}>{inner}</Link>;
  };

  return (
    <nav aria-label="Your account" className={cn("bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden lg:p-2", className)}>
      {rows.map(cell)}
    </nav>
  );
}
