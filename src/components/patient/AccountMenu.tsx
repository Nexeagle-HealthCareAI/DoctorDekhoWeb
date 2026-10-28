"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, BookOpen, Calendar, ChevronDown, FolderHeart, LogIn, LogOut, ShieldCheck, User } from "lucide-react";
import { usePatientIdentity } from "@/hooks/usePatientIdentity";
import { ENROL_ROLE_LABEL } from "@/lib/contributor/types";
import { cn } from "@/lib/utils";

const ITEM = "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-brand-teal hover:bg-teal-50 transition-colors";
const ICON = "flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-500 shrink-0";

/**
 * The account button at the right of the top bar. Signed in, it shows the person (picture, name) and a menu with their profile card and
 * Sign out, the way social sites do; signed out, it offers Log in / Register. Sign out lives only here.
 */
export default function AccountMenu() {
  const router = useRouter();
  const { isLoggedIn, isLoading, loginCheckFailed, refetch, mobile, name, initials, tag, logout } = usePatientIdentity();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const shownName = name ?? (mobile ? `+91 ${mobile}` : "My Account");
  const firstName = name ? name.split(/\s+/)[0] : null;

  const signOut = async () => {
    setOpen(false);
    // The Health Wiki session (if any) ends with the login: one place to sign out.
    await fetch("/api/contributor/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    await logout.mutateAsync();
    router.push("/");
  };

  return (
    <div className="relative shrink-0" ref={box}>
      <button
        type="button"
        onClick={() => (loginCheckFailed ? void refetch() : setOpen((v) => !v))}
        aria-label={loginCheckFailed ? "Could not check your login. Try again" : "Account menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "group flex items-center gap-2 pl-1 pr-1 md:pr-3 py-1 rounded-full border transition-all duration-200",
          open ? "bg-teal-50 border-teal-200 shadow-md" : "bg-white/60 border-slate-200/60 hover:bg-white hover:border-teal-100 hover:shadow-sm"
        )}
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-teal to-sky-500 shadow-sm text-white text-xs font-bold">
          {isLoggedIn ? initials : <User className="w-4 h-4" aria-hidden="true" />}
        </span>
        <span className="hidden md:block text-sm font-semibold text-slate-700 group-hover:text-brand-teal transition-colors max-w-[10rem] truncate">
          {isLoggedIn ? (firstName ?? shownName) : loginCheckFailed ? "Retry login check" : "Log in / Register"}
        </span>
        <ChevronDown className={cn("hidden md:block w-3.5 h-3.5 text-slate-400 transition-transform duration-200", open && "rotate-180 text-brand-teal")} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+10px)] w-72 max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200/70 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] z-50 p-2 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
          {isLoggedIn ? (
            <Link href="/profile" onClick={() => setOpen(false)} role="menuitem" className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors mb-1">
              <span className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-brand-teal to-sky-500 text-white font-bold flex items-center justify-center shadow-sm" aria-hidden="true">{initials}</span>
              <span className="min-w-0">
                <span className="block font-bold text-slate-900 truncate">{shownName}</span>
                {name && mobile && <span className="block text-xs text-slate-500">+91 {mobile}</span>}
                {tag?.isContributor && tag.role && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-brand-teal">
                    {tag.status === "VERIFIED" ? <BadgeCheck className="w-3 h-3" aria-hidden="true" /> : <BookOpen className="w-3 h-3" aria-hidden="true" />}
                    Health Wiki · {ENROL_ROLE_LABEL[tag.role]}
                  </span>
                )}
                <span className="block text-[11px] font-semibold text-slate-400 mt-0.5">See your profile</span>
              </span>
            </Link>
          ) : (
            !isLoading && (
              <div className="p-3">
                <p className="text-sm font-bold text-slate-900">Welcome to Doctor Dekho</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">Log in to see your appointments and records on any device.</p>
                <Link href="/login" onClick={() => setOpen(false)} role="menuitem" className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-teal text-white text-sm font-bold hover:bg-teal-600 transition-colors">
                  <LogIn className="w-4 h-4" aria-hidden="true" /> Log in / Register
                </Link>
              </div>
            )
          )}

          <div className="border-t border-slate-100 pt-1">
            {isLoggedIn && (
              <Link href="/profile" onClick={() => setOpen(false)} role="menuitem" className={ITEM}>
                <span className={ICON}><User className="w-4 h-4" aria-hidden="true" /></span> Profile
              </Link>
            )}
            <Link href="/appointments" onClick={() => setOpen(false)} role="menuitem" className={ITEM}>
              <span className={ICON}><Calendar className="w-4 h-4" aria-hidden="true" /></span> Appointments
            </Link>
            {isLoggedIn && (
              <Link href="/profile/health-locker" onClick={() => setOpen(false)} role="menuitem" className={ITEM}>
                <span className={ICON}><FolderHeart className="w-4 h-4" aria-hidden="true" /></span> Health Locker
              </Link>
            )}
            {/* A contributor goes to their own Health Wiki area; anyone else reads the Health Wiki. */}
            <Link href={tag?.isContributor ? "/contribute" : "/health"} onClick={() => setOpen(false)} role="menuitem" className={ITEM}>
              <span className={ICON}><BookOpen className="w-4 h-4" aria-hidden="true" /></span> Health Wiki
            </Link>
            <Link href="/about" onClick={() => setOpen(false)} role="menuitem" className={ITEM}>
              <span className={ICON}><ShieldCheck className="w-4 h-4" aria-hidden="true" /></span> About &amp; Verification
            </Link>
          </div>

          {isLoggedIn && (
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => void signOut()}
                disabled={logout.isPending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-50 border border-red-100 shrink-0"><LogOut className="w-4 h-4" aria-hidden="true" /></span>
                {logout.isPending ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
