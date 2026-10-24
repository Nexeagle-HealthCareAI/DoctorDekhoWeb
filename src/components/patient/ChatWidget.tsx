"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, ArrowUpRight } from "lucide-react";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { trackEvent } from "@/lib/analytics";
import { getChatGreeting } from "@/lib/chatEngine";
import { useTranslation } from "@/lib/i18n/I18nContext";
import VitaChat from "@/components/patient/vita/VitaChat";

export default function ChatWidget() {
  const { isLoggedIn } = usePatientAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  // null = not asked yet; Vita replaces the WhatsApp hand-off only when the server says it is on.
  const [vitaOn, setVitaOn] = useState<boolean | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen && !hasOpenedOnce) {
      setHasOpenedOnce(true);
      trackEvent("chat_widget_opened");
    }
  }, [isOpen, hasOpenedOnce]);

  useEffect(() => {
    if (!isOpen || vitaOn !== null) return;
    let live = true;
    fetch("/api/vita/chat", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => live && setVitaOn(Boolean(d.enabled)))
      .catch(() => live && setVitaOn(false));
    return () => {
      live = false;
    };
  }, [isOpen, vitaOn]);

  const greeting = getChatGreeting(isLoggedIn);

  function handleWhatsappClick() {
    trackEvent("chat_whatsapp_handoff");
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        whileTap={{ scale: 0.94 }}
        aria-label={isOpen ? t("vita.close") : t("vita.open")}
        className="fixed z-50 bottom-[calc(4rem+1rem)] right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.4)] flex items-center justify-center hover:brightness-105 active:scale-95 transition-transform"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span key="close" initial={{ opacity: 0, rotate: -45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 45 }}>
              <X className="h-6 w-6" />
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
            className="fixed z-50 bottom-[calc(4rem+5.5rem)] right-4 md:bottom-24 md:right-6 w-[calc(100vw-2rem)] max-w-sm h-[75svh] md:h-[min(640px,75svh)] rounded-2xl bg-white shadow-[0_16px_48px_rgba(0,0,0,0.18)] border border-slate-200/70 overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54] text-white shrink-0">
              <div className="relative h-9 w-9 rounded-full bg-white/15 flex items-center justify-center">
                <MessageCircle className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#25D366] border-2 border-[#075E54]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold leading-tight text-white">{vitaOn ? t("vita.title") : "Doctor Dekho Assistant"}</p>
                <p className="text-xs text-white/70 leading-tight">{vitaOn ? t("vita.subtitle") : "Online"}</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label={t("vita.close")} className="p-2 rounded-full hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            {vitaOn ? (
              <VitaChat />
            ) : (
            <div className="px-4 py-5 bg-[#ECE5DD] flex flex-col gap-4 overflow-y-auto">
              <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm whitespace-pre-line leading-relaxed">
                {greeting.text}
              </div>

              <a
                href={greeting.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWhatsappClick}
                className="sticky bottom-0 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-105 active:scale-[0.98] transition-transform"
              >
                {greeting.ctaLabel}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
