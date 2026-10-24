"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { useVitaChat } from "@/hooks/useVitaChat";
import { trackEvent } from "@/lib/analytics";
import { getChatGreeting } from "@/lib/chatEngine";
import Eagle from "@/components/patient/vita/Eagle";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { launcherMood, POSE } from "@/lib/vita/mood";
import VitaChat from "@/components/patient/vita/VitaChat";

// The "Ask Vita" button on every patient page, and the chat panel it opens. The button is always the
// eagle -- resting in the corner, flying in once on a first visit with one line of welcome, asleep after
// the patient said goodbye -- with an "Ask Vita" label. The panel is Vita; only when the server says
// the router cannot serve Vita yet (/api/vita/chat GET) does it show a short Vita "getting ready"
// note with WhatsApp and the directory instead. The conversation lives here, so closing keeps it.

const SEEN_KEY = "vita_seen";
const NUDGE_DELAY_MS = 2500;
const NUDGE_SHOW_MS = 7000;

function seenBefore(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // no storage: never nag
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function ChatWidget() {
  const { isLoggedIn } = usePatientAuth();
  const { t, locale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  // null = not checked yet. Only an explicit "not ready" from the server changes the panel; the button
  // is always Vita.
  const [vitaOn, setVitaOn] = useState<boolean | null>(null);
  const [nudge, setNudge] = useState(false);
  // Desktop only: a bigger panel. Phones always get the whole screen.
  const [expanded, setExpanded] = useState(false);
  // Vita answers in the patient's own language; the site's language is only its first guess.
  const chat = useVitaChat({ uiLanguage: locale });

  useEffect(() => {
    if (isOpen && !hasOpenedOnce) {
      setHasOpenedOnce(true);
      trackEvent("chat_widget_opened");
    }
  }, [isOpen, hasOpenedOnce]);

  // Ask, shortly after the page settles, whether the router can serve Vita; ask again on each open
  // while it could not, so a fix on the server shows without a reload.
  const [checks, setChecks] = useState(0);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      fetch("/api/vita/chat", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { enabled: false }))
        .then((d: { enabled?: boolean }) => live && setVitaOn(Boolean(d.enabled)))
        .catch(() => live && setVitaOn(false));
    }, checks === 0 ? 800 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [checks]);

  // First visit only: the eagle flies in with one line, then lands. Never again after it was seen or
  // the chat was opened.
  useEffect(() => {
    if (vitaOn === false || isOpen || seenBefore()) return;
    const show = setTimeout(() => setNudge(true), NUDGE_DELAY_MS);
    const hide = setTimeout(() => {
      setNudge(false);
      markSeen();
    }, NUDGE_DELAY_MS + NUDGE_SHOW_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [vitaOn, isOpen]);

  const open = (value: boolean) => {
    setIsOpen(value);
    if (value) {
      setNudge(false);
      markSeen();
      if (vitaOn === false) setChecks((n) => n + 1);
      // the phone's back button closes the chat instead of leaving the page
      try {
        window.history.pushState({ ...(window.history.state ?? {}), vita: true }, "");
      } catch {
        /* ignore */
      }
    } else {
      try {
        if (window.history.state?.vita) window.history.back();
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onBack = () => setIsOpen(false);
    window.addEventListener("popstate", onBack);
    // full screen on phones: the page behind must not scroll
    const phone = window.matchMedia?.("(max-width: 767px)").matches;
    const before = document.body.style.overflow;
    if (phone) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onBack);
      document.body.style.overflow = before;
    };
  }, [isOpen]);

  const lastReply = [...chat.entries].reverse().find((e) => e.role === "vita")?.reply;
  const launcher = launcherMood(lastReply);
  const greeting = getChatGreeting(isLoggedIn);

  return (
    <>
      <AnimatePresence>
        {nudge && !isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-50 bottom-[calc(4rem+5.75rem)] right-4 md:bottom-[6.5rem] md:right-6 flex flex-col items-end gap-1"
          >
            <Image src={POSE.flying} alt="" width={160} height={86} aria-hidden="true" className="vita-fly-in mr-2 h-[86px] w-[160px] object-contain" />
            <div role="status" className="flex max-w-[240px] items-start gap-2 rounded-2xl rounded-br-sm bg-[#0B4F4A] px-3.5 py-2.5 text-sm font-semibold leading-snug text-white shadow-lg">
              <button type="button" onClick={() => open(true)} className="text-left">{t("vita.nudge")}</button>
              <button type="button" onClick={() => { setNudge(false); markSeen(); }} aria-label={t("vita.nudgeClose")}
                className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-white/15">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && !nudge && (
        <button type="button" onClick={() => open(true)} tabIndex={-1} aria-hidden="true"
          className="fixed z-50 bottom-[calc(4rem+1.75rem)] right-[5.25rem] md:bottom-[2.25rem] md:right-[6.25rem] rounded-full bg-[#0B4F4A] px-3.5 py-1.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(11,79,74,0.3)]">
          {t("vita.ask")}
        </button>
      )}

      <motion.button
        type="button"
        onClick={() => open(!isOpen)}
        data-open={isOpen}
        whileTap={{ scale: 0.94 }}
        aria-label={isOpen ? t("vita.close") : t("vita.ask")}
        aria-expanded={isOpen}
        className={`fixed z-50 bottom-[calc(4rem+1rem)] right-4 md:bottom-6 md:right-6 h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-[#0B4F4A] shadow-[0_6px_18px_rgba(11,79,74,0.35)] active:scale-95 transition-transform ${isOpen ? "hidden md:flex" : "flex"}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span key="close" initial={{ opacity: 0, rotate: -45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 45 }} className="text-white">
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key={launcher} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex h-full w-full items-end justify-center">
              <Image src={POSE[launcher]} alt="" width={60} height={56} aria-hidden="true" className="h-[56px] w-[60px] object-contain" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            role="dialog"
            aria-label={t("vita.title")}
            aria-modal="true"
            className={`fixed z-[70] inset-0 h-[100dvh] w-full bg-white overflow-hidden flex flex-col md:inset-auto md:rounded-3xl md:border md:border-slate-200/70 md:shadow-[0_16px_48px_rgba(0,0,0,0.18)] ${
              expanded
                ? "md:top-4 md:bottom-4 md:right-4 md:h-auto md:w-[min(760px,calc(100vw-2rem))]"
                : "md:bottom-[6.5rem] md:right-6 md:w-[400px] md:h-[min(700px,80svh)]"
            }`}
          >
            {vitaOn === false ? (
              <VitaGettingReady whatsappUrl={greeting.whatsappUrl} onClose={() => open(false)} />
            ) : (
              <VitaChat chat={chat} onClose={() => open(false)} expanded={expanded} onToggleExpand={() => setExpanded((v) => !v)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Shown only when the server says the router cannot serve Vita yet: still Vita, with a way forward. */
function VitaGettingReady({ whatsappUrl, onClose }: { whatsappUrl: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#EEF4F3]">
      <header className="flex shrink-0 items-center gap-3 bg-[#0B4F4A] px-4 py-3 text-white">
        <div className="flex h-11 w-11 shrink-0 items-end justify-center overflow-hidden rounded-full bg-[#E3EFEC]">
          <Eagle mood="relaxed" size={40} />
        </div>
        <p className="min-w-0 flex-1 text-[17px] font-extrabold leading-tight text-white">{t("vita.title")}</p>
        <button type="button" onClick={onClose} aria-label={t("vita.close")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {/* A snack break while the service gets ready -- friendly, not an error. */}
        <Eagle mood="eating" size={128} />
        <h2 className="text-xl font-extrabold text-[#10302D]">{t("vita.offlineTitle")}</h2>
        <p className="text-sm leading-snug text-[#3D5A57]">{t("vita.offlineBody")}</p>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("chat_whatsapp_handoff")}
          className="mt-1 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-[15px] font-bold text-white">
          <MessageCircle className="h-5 w-5" aria-hidden="true" /> {t("vita.whatsapp")}
        </a>
        <a href="/" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#0B5E57] hover:underline">
          {t("vita.browseDirectory")}
        </a>
      </div>
    </div>
  );
}
