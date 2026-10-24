"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, ArrowUpRight } from "lucide-react";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { useVitaChat } from "@/hooks/useVitaChat";
import { trackEvent } from "@/lib/analytics";
import { getChatGreeting } from "@/lib/chatEngine";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { launcherMood, POSE } from "@/lib/vita/mood";
import VitaChat from "@/components/patient/vita/VitaChat";

// The chat button on every patient page, and the chat panel it opens.
// With Vita on (the server says so: /api/vita/chat GET), the button is the eagle -- resting in the
// corner, flying in once on a first visit with one line of welcome, asleep after the patient said
// goodbye -- and the panel is Vita. With Vita off, both are the earlier WhatsApp hand-off.
// The conversation lives here, so closing and reopening the panel keeps it.

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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  // null = not known yet; Vita replaces the WhatsApp hand-off only when the server says it is on.
  const [vitaOn, setVitaOn] = useState<boolean | null>(null);
  const [nudge, setNudge] = useState(false);
  const chat = useVitaChat();

  useEffect(() => {
    if (isOpen && !hasOpenedOnce) {
      setHasOpenedOnce(true);
      trackEvent("chat_widget_opened");
    }
  }, [isOpen, hasOpenedOnce]);

  // Ask once, shortly after the page settles, whether Vita is on (it decides the button's look).
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      fetch("/api/vita/chat", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { enabled: false }))
        .then((d: { enabled?: boolean }) => live && setVitaOn(Boolean(d.enabled)))
        .catch(() => live && setVitaOn(false));
    }, 800);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  // First visit only: the eagle flies in with one line, then lands. Never again after it was seen or
  // the chat was opened.
  useEffect(() => {
    if (!vitaOn || isOpen || seenBefore()) return;
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
    }
  };

  const lastReply = [...chat.entries].reverse().find((e) => e.role === "vita")?.reply;
  const launcher = launcherMood(lastReply);
  const greeting = getChatGreeting(isLoggedIn);

  return (
    <>
      <AnimatePresence>
        {vitaOn && nudge && !isOpen && (
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

      <motion.button
        type="button"
        onClick={() => open(!isOpen)}
        whileTap={{ scale: 0.94 }}
        aria-label={isOpen ? t("vita.close") : t("vita.open")}
        aria-expanded={isOpen}
        className={`fixed z-50 bottom-[calc(4rem+1rem)] right-4 md:bottom-6 md:right-6 flex items-center justify-center overflow-hidden rounded-full active:scale-95 transition-transform ${
          vitaOn
            ? "h-16 w-16 border-[3px] border-white bg-[#0B4F4A] shadow-[0_6px_18px_rgba(11,79,74,0.35)]"
            : "h-14 w-14 bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.4)] hover:brightness-105"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span key="close" initial={{ opacity: 0, rotate: -45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 45 }} className="text-white">
              <X className="h-6 w-6" />
            </motion.span>
          ) : vitaOn ? (
            <motion.span key={launcher} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex h-full w-full items-end justify-center">
              <Image src={POSE[launcher]} alt="" width={60} height={56} aria-hidden="true" className="h-[56px] w-[60px] object-contain" />
            </motion.span>
          ) : (
            <motion.span key="chat" initial={{ opacity: 0, rotate: 45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -45 }}>
              <MessageCircle className="h-6 w-6" />
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
            aria-label={vitaOn ? t("vita.title") : "Doctor Dekho Assistant"}
            className="fixed z-50 bottom-[calc(4rem+5.75rem)] right-4 md:bottom-[6.5rem] md:right-6 w-[calc(100vw-2rem)] max-w-sm h-[75svh] md:h-[min(680px,78svh)] rounded-3xl bg-white shadow-[0_16px_48px_rgba(0,0,0,0.18)] border border-slate-200/70 overflow-hidden flex flex-col"
          >
            {vitaOn ? (
              <VitaChat chat={chat} onClose={() => open(false)} />
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54] text-white shrink-0">
                  <div className="relative h-9 w-9 rounded-full bg-white/15 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#25D366] border-2 border-[#075E54]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold leading-tight text-white">Doctor Dekho Assistant</p>
                    <p className="text-xs text-white/70 leading-tight">Online</p>
                  </div>
                  <button type="button" onClick={() => open(false)} aria-label={t("vita.close")} className="p-2 rounded-full hover:bg-white/10">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 py-5 bg-[#ECE5DD] flex flex-col gap-4 overflow-y-auto">
                  <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm whitespace-pre-line leading-relaxed">
                    {greeting.text}
                  </div>
                  <a
                    href={greeting.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent("chat_whatsapp_handoff")}
                    className="sticky bottom-0 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-105 active:scale-[0.98] transition-transform"
                  >
                    {greeting.ctaLabel}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
