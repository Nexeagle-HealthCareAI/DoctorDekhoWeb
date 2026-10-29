"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowDown, ChevronDown, Ear, GraduationCap, Headphones, History, LocateFixed, MapPin, Maximize2, MessageCircle, Mic,
  Minimize2, MoreVertical, RotateCcw, Send, Square, Stethoscope, User as UserRound, Volume2, X,
} from "lucide-react";
import { useVitaChat, type VitaEntry } from "@/hooks/useVitaChat";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { chatMood, WORKING_AFTER_MS, type VitaMood } from "@/lib/vita/mood";
import Eagle from "@/components/patient/vita/Eagle";
import { useTranslation } from "@/lib/i18n/I18nContext";
import type { TranslationKey } from "@/lib/i18n/dictionaries/en";
import { textWithout } from "@/lib/vita/filters";
import { geocodeAddress } from "@/lib/navigation";
import { WHATSAPP_BUSINESS_NUMBER } from "@/lib/site";
import VitaReplyView, { type ReplyActions, type ReplySpeech } from "@/components/patient/vita/VitaReplyView";
import { doctorHref } from "@/components/patient/vita/VitaDoctorCard";
import { useSpeechOutput } from "@/hooks/useSpeechOutput";
import { useVitaLive, type LiveStatus } from "@/components/patient/vita/useVitaLive";
import { TEXT_ZOOM, useVitaPrefs, type TextSize, type VitaPrefs } from "@/lib/vita/prefs";
import { addRecent, clearRecent, loadRecent } from "@/lib/vita/memory";
import { REFINE_LABEL, refinePhrase, suggest } from "@/lib/vita/refine";
import { LOCALES, type Locale } from "@/lib/i18n/types";
import { trackEvent } from "@/lib/analytics";
import type { WakeStatus } from "@/hooks/useWakeWord";
import { preloadWakeWord } from "@/lib/wakeword/engine";

// The Vita chat panel (UI-1 to UI-8): header with the eagle, the place chip, the options menu (new chat,
// language, text size, read aloud, a person); the welcome home with recent searches; the conversation
// (each new reply read from its start, a "latest" pill when scrolled up, the chosen doctor pinned); the
// location prompt; suggestions while typing; and the message box (type or speak). The conversation state comes
// from the widget (useVitaChat), so closing the panel keeps it. Moods: src/lib/vita/mood.ts.

// Words sent for the specialty shortcuts: the router reads them like anything a patient types.
const SPECIALTY_SHORTCUTS: { key: TranslationKey; send: string }[] = [
  { key: "vita.specGeneral", send: "general physician" },
  { key: "vita.specSkin", send: "skin ka doctor" },
  { key: "vita.specHeart", send: "dil ka doctor" },
  { key: "vita.specBone", send: "haddi ka doctor" },
  { key: "vita.specChild", send: "bachchon ka doctor" },
  { key: "vita.specWomen", send: "mahila rog ka doctor" },
];

const HINTS: Record<string, TranslationKey> = {
  symptom: "vita.hintSymptom",
  name: "vita.hintName",
  degree: "vita.hintDegree",
};

export type VitaChatState = ReturnType<typeof useVitaChat>;

const MOOD_STATUS: Record<VitaMood, TranslationKey> = {
  welcome: "vita.statusWelcome",
  thinking: "vita.statusThinking",
  working: "vita.statusWorking",
  joyful: "vita.statusJoyful",
  relaxed: "vita.statusRelaxed",
  emergency: "vita.statusEmergency",
};

/** "Hey Vita" from the widget: whether this device can listen for it, how it is doing, and a wake to act on. */
export interface VitaWake {
  supported: boolean;
  status: WakeStatus;
  pending: boolean;
  handled: () => void;
}

export default function VitaChat({ chat, onClose, expanded = false, onToggleExpand, wake, onListeningChange }: {
  chat: VitaChatState;
  onClose?: () => void;
  /** Desktop only: the panel is in its bigger size. */
  expanded?: boolean;
  onToggleExpand?: () => void;
  wake?: VitaWake;
  /** Vita has the microphone (a voice conversation or the mic button): the widget pauses "Hey Vita". */
  onListeningChange?: (listening: boolean) => void;
}) {
  const { t, locale, setLocale } = useTranslation();
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<TranslationKey>("vita.inputPlaceholderVoice");
  const [showSpecialties, setShowSpecialties] = useState(false);
  const [editingPlace, setEditingPlace] = useState(false);
  const [waitedLong, setWaitedLong] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [awayFromEnd, setAwayFromEnd] = useState(false);
  const [pinHidden, setPinHidden] = useState(false);
  const [votes, setVotes] = useState<Record<number, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechInput(locale, (text) => setDraft(text));
  const voice = useSpeechOutput();
  const { prefs, update } = useVitaPrefs();
  const spokenId = useRef<number | null>(null);
  const liveOn = useRef(false);

  // Where to look after each change: a new Vita reply is read from its start (its message and filter
  // chips first, then the cards); while waiting, or after the patient's own message, the end.
  useEffect(() => {
    if (chat.entries.length === 0 && !chat.busy) return;
    const lastEntry = chat.entries.at(-1);
    if (!chat.busy && lastEntry?.role === "vita") {
      const el = logRef.current?.querySelector<HTMLElement>(`[data-entry="${lastEntry.id}"]`);
      if (el?.scrollIntoView) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [chat.entries, chat.busy, waitedLong]);

  // "thinking" for a short beat, then "working" once the wait feels like a search
  useEffect(() => {
    if (!chat.busy) {
      setWaitedLong(false);
      return;
    }
    const timer = setTimeout(() => setWaitedLong(true), WORKING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [chat.busy]);

  // Read each new reply aloud when the patient turned that on; never the ones already on screen when
  // the panel opened (a restored conversation).
  useEffect(() => {
    const lastEntry = chat.entries.at(-1);
    if (!lastEntry) {
      spokenId.current = null;
      return;
    }
    if (spokenId.current === null) {
      spokenId.current = lastEntry.id;
      if (chat.entries.length > 1 || lastEntry.role !== "user") return;
    }
    if (lastEntry.id === spokenId.current && lastEntry.role !== "user") return;
    spokenId.current = lastEntry.id;
    if (prefs.readAloud && !liveOn.current && lastEntry.role === "vita" && lastEntry.reply) {
      voice.speak(lastEntry.id, lastEntry.reply.message, lastEntry.reply.language);
    }
  }, [chat.entries, prefs.readAloud, voice]);

  const last = chat.entries.at(-1);
  const mood = chatMood({ last, busy: chat.busy, waitedMs: waitedLong ? WORKING_AFTER_MS : 0 });
  const emergency = mood === "emergency";
  const latestVita = [...chat.entries].reverse().find((e) => e.role === "vita");
  const selectedEntry = [...chat.entries].reverse().find((e) => e.reply?.kind === "doctor_selected");
  const chosenId = selectedEntry?.reply?.selectedDoctorId ?? null;
  const chosenDoctor = selectedEntry?.reply?.doctor ?? null;
  const askingLocation = latestVita?.reply?.clarify?.kind === "location" && chat.entries.at(-1) === latestVita;
  // Booking in the chat: which question Vita is asking right now (book_mobile, book_otp, ...), so the
  // input offers the right keyboard and autofill, and nothing typed for a booking is kept as a "recent search".
  const latestKind = chat.entries.at(-1) === latestVita ? latestVita?.reply?.clarify?.kind : undefined;
  const bookStep = latestKind?.startsWith("book_") ? latestKind : undefined;
  const typed = bookStep ? BOOK_INPUT[bookStep] : undefined;
  const suggestions = draft && !chat.busy && !bookStep ? suggest(draft) : [];

  const send = (text: string, shownAs?: string) => {
    setShowSpecialties(false);
    void chat.send(text, { shownAs, bookingStep: bookStep });
  };

  // Talk with Vita, hands-free (Groq speech): the replies are spoken by it, not by "read aloud".
  const live = useVitaLive({ entries: chat.entries, busy: chat.busy, locale, send: (text) => send(text), t });
  liveOn.current = live.on;

  // "Hey Vita" was heard: start talking (once Groq voice is known to be there).
  useEffect(() => {
    if (!wake?.pending || !live.available) return;
    wake.handled();
    if (!live.on) {
      voice.stop();
      if (speech.listening) speech.stop();
      void live.start();
    }
  }, [wake, live, voice, speech]);

  const micBusy = live.on || speech.listening;
  useEffect(() => {
    onListeningChange?.(micBusy);
  }, [micBusy, onListeningChange]);
  useEffect(() => () => onListeningChange?.(false), [onListeningChange]);

  // Vita asked for something to type (number, code, name, age): put the cursor there.
  useEffect(() => {
    if (typed && !chat.busy) inputRef.current?.focus();
  }, [typed, chat.busy]);

  const newChat = () => {
    voice.stop();
    live.stop();
    chat.reset();
    setMenuOpen(false);
    setPinHidden(false);
    setVotes({});
    setDraft("");
  };

  const askKind = (kind: string) => {
    if (kind === "specialty") {
      setShowSpecialties(true);
      return;
    }
    if (kind === "distance") {
      send("paas mein doctor", t("vita.chipNear"));
      return;
    }
    setHint(HINTS[kind] ?? "vita.inputPlaceholderVoice");
    inputRef.current?.focus();
  };

  const actions: ReplyActions = {
    sendText: (text, shownAs) => send(text, shownAs),
    choose: (doctorId, shownAs) => void chat.send("Choose", { select_doctor_id: doctorId, shownAs }),
    showMore: (block) => void chat.send("aur doctor dikhao", { page: (block.page ?? 1) + 1, shownAs: t("vita.showMore") }),
    removeFilter: (block, key) => {
      const text = textWithout(block, key);
      if (text) void chat.send(text, { new_search: true, shownAs: text });
      else {
        setShowSpecialties(true);
      }
    },
    refine: (key, language) => send(refinePhrase(key, language), t(REFINE_LABEL[key])),
    startOver: newChat,
    checkIn: () => {
      void chat.requestLocation().then((at) => {
        if (at) void chat.send("check in", { shownAs: t("visit.checkIn") }, { lat: at.lat, lng: at.lng });
      });
    },
    shareLocation: () => {
      void chat.requestLocation().then((at) => {
        if (at) void chat.send("location", { shownAs: t("vita.locationSharedMsg") }, { lat: at.lat, lng: at.lng });
      });
    },
    askKind,
    retry: chat.retry,
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (speech.listening) speech.stop();
    if (!bookStep) addRecent(draft);
    // the WhatsApp code is never shown back or kept in this device's saved conversation
    send(draft, bookStep === "book_otp" ? `${t("vita.codeSent")} ••••••` : undefined);
    setDraft("");
    setHint("vita.inputPlaceholderVoice");
  };

  const onScroll = () => {
    const el = logRef.current;
    if (!el) return;
    setAwayFromEnd(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
  };

  const place = chat.city || (chat.coords ? t("vita.locationShared") : t("vita.locationNone"));
  const zoom = TEXT_ZOOM[prefs.textSize];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#EEF4F3]">
      <header className={`relative flex shrink-0 items-center gap-2.5 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white transition-colors ${emergency ? "bg-[#B3141E]" : "bg-[#0B4F4A]"}`}>
        {emergency ? (
          <AlertTriangle className="h-7 w-7 shrink-0" aria-hidden="true" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-end justify-center overflow-hidden rounded-full bg-[#E3EFEC]">
            <Eagle mood={mood as Exclude<VitaMood, "emergency">} size={40} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-extrabold leading-tight text-white">{emergency ? t("vita.statusEmergency") : t("vita.title")}</p>
          {emergency ? (
            <p className="truncate text-xs leading-tight text-white/80" aria-live="polite">{t("directory.emergencyBody")}</p>
          ) : (
            <button type="button" onClick={() => setEditingPlace((v) => !v)} aria-label={t("vita.changeLocation", { place })}
              className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white hover:bg-white/25">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{place}</span>
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
            </button>
          )}
          <span className="sr-only" aria-live="polite">{emergency ? "" : t(MOOD_STATUS[mood])}</span>
        </div>
        {onToggleExpand && (
          <button type="button" onClick={onToggleExpand} aria-label={expanded ? t("vita.shrink") : t("vita.expand")}
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10 md:flex">
            {expanded ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}
          </button>
        )}
        <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label={t("vita.menu")} aria-expanded={menuOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
          <MoreVertical className="h-5 w-5" aria-hidden="true" />
        </button>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t("vita.close")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </header>

      {menuOpen && (
        <ChatMenu
          onClose={() => setMenuOpen(false)}
          onNewChat={newChat}
          locale={locale}
          setLocale={setLocale}
          prefs={prefs}
          update={update}
          canSpeak={voice.supported}
          onStopSpeaking={voice.stop}
          wake={wake?.supported && live.available ? wake.status : null}
        />
      )}

      {chosenDoctor && !pinHidden && !emergency && latestVita !== selectedEntry && (
        <div className="flex shrink-0 items-center gap-2 border-b border-[#DCE7E4] bg-white px-3 py-1.5 text-sm">
          <span className="rounded-full bg-[#E3F2EC] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#0B6B4F]">{t("vita.yourDoctor")}</span>
          <span className="min-w-0 flex-1 truncate font-semibold text-[#10302D]">{chosenDoctor.name}</span>
          <Link href={`${doctorHref(chosenDoctor)}#book`}
            className="inline-flex min-h-[36px] shrink-0 items-center rounded-full bg-[#0B5E57] px-3 text-xs font-bold text-white">
            {t("vita.bookSlot")}
          </Link>
          <button type="button" onClick={() => setPinHidden(true)} aria-label={t("vita.hide")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div ref={logRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-3 px-3 py-4" style={{ zoom }}>
          {chat.entries.length === 0 ? (
            <Home onAsk={askKind} onRecent={(text) => send(text)} />
          ) : (
            <div className="flex items-center gap-2 self-center rounded-full bg-white/70 px-3 py-1 text-xs text-slate-600">
              <Eagle mood="welcome" size={22} />
              {chat.restoredAt ? t("vita.earlier", { when: ago(chat.restoredAt, t) }) : t("vita.homeTitle")}
            </div>
          )}

          {chat.entries.map((e) => (
            <div key={e.id} data-entry={e.id} className="scroll-mt-2">
              <Entry entry={e} actions={actions} active={e === latestVita} busy={chat.busy} chosenId={chosenId}
                speech={voice.supported ? { speaking: voice.speakingId === e.id, speak: () => e.reply && voice.speak(e.id, e.reply.message, e.reply.language), stop: voice.stop } : undefined}
                vote={votes[e.id]}
                onVote={e === latestVita && e.reply ? (helpful) => {
                  setVotes((v) => ({ ...v, [e.id]: helpful }));
                  trackEvent("vita_feedback", { metadata: { helpful, kind: e.reply?.kind, clarify: e.reply?.clarify?.kind ?? null, sessionId: e.reply?.session_id, turn: e.reply?.turn, language: e.reply?.language } });
                } : undefined} />
            </div>
          ))}

          {showSpecialties && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("vita.chipSpecialty")}>
              {SPECIALTY_SHORTCUTS.map((s) => (
                <button key={s.send} type="button" disabled={chat.busy} onClick={() => send(s.send, t(s.key))}
                  className="min-h-[44px] rounded-full border border-[#9CC5BD] bg-white px-4 text-sm font-semibold text-[#0B5E57] hover:bg-emerald-50 disabled:opacity-50">
                  {t(s.key)}
                </button>
              ))}
            </div>
          )}

          {(askingLocation || editingPlace) && !chat.busy && (
            <LocationPrompt chat={chat} answering={askingLocation} onDone={() => setEditingPlace(false)} />
          )}

          {chat.busy && (mood === "working" ? <WorkingCard /> : <ThinkingRow />)}
          <div ref={endRef} />
        </div>
      </div>

      {awayFromEnd && (
        <button type="button" onClick={() => endRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" })}
          className="absolute bottom-[5.5rem] left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#10302D] px-3 py-1.5 text-xs font-bold text-white shadow-lg">
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> {t("vita.latest")}
        </button>
      )}

      {suggestions.length > 0 && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-[#DCE7E4] bg-white px-3 pt-2" role="group" aria-label={t("vita.suggestions")}>
          {suggestions.map((sg) => (
            <button key={sg.send} type="button" onClick={() => { addRecent(sg.label[locale]); send(sg.send, sg.label[locale]); setDraft(""); }}
              className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-[#9CC5BD] bg-[#F3F8F7] px-3 text-[13px] font-semibold text-[#0B5E57]">
              {sg.label[locale]}
            </button>
          ))}
        </div>
      )}

      {live.notice && !live.on && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-t border-[#DCE7E4] bg-[#FFF8E6] px-3 py-2 text-sm text-[#5C4400]">
          <span className="min-w-0 flex-1">{t(live.notice)}</span>
          <button type="button" onClick={live.dismiss} aria-label={t("vita.hide")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-black/5">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {live.on && (
        <LiveBar status={live.status} level={live.level} notice={live.notice ? t(live.notice) : null}
          onStop={live.stop} onInterrupt={live.interrupt} />
      )}

      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-[#DCE7E4] bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={speech.listening ? t("vita.listening") : typed ? t(typed.hint) : hint === "vita.inputPlaceholderVoice" && !speech.supported ? t("vita.inputPlaceholder") : t(hint)}
          aria-label={typed ? t(typed.hint) : t("vita.inputLabel")}
          type={typed?.type ?? "text"}
          inputMode={typed?.inputMode}
          autoComplete={typed?.autoComplete ?? "off"}
          maxLength={typed?.maxLength ?? 1000}
          className="min-h-[48px] min-w-0 flex-1 rounded-full border border-[#C9DAD6] bg-[#F7FAF9] px-4 text-base text-slate-900 placeholder:text-slate-500 focus:border-[#0B5E57] focus:outline-none"
        />
        {live.available && !live.on && (
          <button type="button" onClick={() => { if (speech.listening) speech.stop(); voice.stop(); void live.start(); }} aria-label={t("vita.liveStart")}
            title={t("vita.liveStart")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#C9DAD6] bg-white text-[#0B5E57]">
            <Headphones className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {speech.supported && !live.on && (
          <button type="button" onClick={speech.listening ? speech.stop : speech.start}
            aria-label={speech.listening ? t("vita.micStop") : t("vita.micStart")} aria-pressed={speech.listening}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${speech.listening ? "border-[#B3141E] bg-red-50 text-[#B3141E]" : "border-[#C9DAD6] bg-white text-[#0B5E57]"}`}>
            {speech.listening ? <Square className="h-5 w-5" aria-hidden="true" /> : <Mic className="h-5 w-5" aria-hidden="true" />}
          </button>
        )}
        <button type="submit" disabled={chat.busy || !draft.trim()} aria-label={t("vita.send")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0B5E57] text-white disabled:opacity-50">
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

const LIVE_TEXT: Record<Exclude<LiveStatus, "off">, TranslationKey> = {
  listening: "vita.liveListening",
  hearing: "vita.liveHearing",
  thinking: "vita.liveThinking",
  speaking: "vita.liveSpeaking",
  waiting: "vita.liveWaiting",
};

/** The live conversation: what Vita is doing, how loud the patient is, stop. Tapping while Vita speaks makes her listen. */
function LiveBar({ status, level, notice, onStop, onInterrupt }: {
  status: LiveStatus; level: number; notice: string | null; onStop: () => void; onInterrupt: () => void;
}) {
  const { t } = useTranslation();
  const key = status === "off" ? "vita.liveWaiting" : LIVE_TEXT[status];
  const listening = status === "listening" || status === "hearing";
  return (
    <div className="flex shrink-0 flex-col gap-1 border-t border-[#DCE7E4] bg-[#0B4F4A] px-3 py-2 text-white">
      <div className="flex items-center gap-3">
        <button type="button" onClick={status === "speaking" ? onInterrupt : undefined} disabled={status !== "speaking"}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default">
          <span aria-hidden="true" className="flex h-8 items-end gap-0.5">
            {[0.6, 1, 0.8, 0.5].map((f, i) => (
              <span key={i} className="w-1.5 rounded-full bg-white/90 transition-[height] duration-75"
                style={{ height: `${listening ? 6 + Math.round(level * f * 26) : status === "speaking" ? 10 + i * 4 : 6}px` }} />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" aria-live="polite">{notice ?? t(key)}</span>
        </button>
        <button type="button" onClick={onStop} aria-label={t("vita.liveStop")}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-[#B3141E]">
          <Square className="h-4 w-4" aria-hidden="true" /> {t("vita.liveStop")}
        </button>
      </div>
      <p className="text-[11px] leading-tight text-white/70">{t("vita.liveNote")}</p>
    </div>
  );
}

/** The input for each booking question Vita asks in words. */
const BOOK_INPUT: Record<string, {
  hint: TranslationKey; type?: string; inputMode?: "tel" | "numeric" | "text"; autoComplete?: string; maxLength?: number;
}> = {
  book_mobile: { hint: "vita.bookMobileHint", type: "tel", inputMode: "tel", autoComplete: "tel-national", maxLength: 16 },
  book_otp: { hint: "vita.bookOtpHint", inputMode: "numeric", autoComplete: "one-time-code", maxLength: 6 },
  book_name: { hint: "vita.bookNameHint", autoComplete: "name", maxLength: 100 },
  book_age: { hint: "vita.bookAgeHint", inputMode: "numeric", maxLength: 12 },
};

function ago(at: number, t: ReturnType<typeof useTranslation>["t"]): string {
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60000));
  return minutes < 60 ? t("vita.minutesAgo", { n: minutes }) : t("vita.hoursAgo", { n: Math.round(minutes / 60) });
}

const WAKE_STATUS: Partial<Record<WakeStatus, TranslationKey>> = {
  starting: "vita.wakeStarting",
  listening: "vita.wakeListening",
  blocked: "vita.wakeBlocked",
  error: "vita.wakeError",
};

function ChatMenu({ onClose, onNewChat, locale, setLocale, prefs, update, canSpeak, onStopSpeaking, wake }: {
  onClose: () => void;
  onNewChat: () => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  prefs: VitaPrefs;
  update: (p: Partial<VitaPrefs>) => void;
  canSpeak: boolean;
  onStopSpeaking: () => void;
  /** null: this device or server can't do "Hey Vita". */
  wake: WakeStatus | null;
}) {
  const { t } = useTranslation();
  const [recentCleared, setRecentCleared] = useState(false);
  const seg = (on: boolean) =>
    `min-h-[40px] flex-1 rounded-lg px-2 text-sm font-semibold ${on ? "bg-[#0B5E57] text-white" : "bg-[#F1F6F5] text-[#10302D] hover:bg-[#E3EFEC]"}`;
  return (
    <>
      <button type="button" aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0 z-20 cursor-default bg-black/20" />
      <div role="dialog" aria-label={t("vita.menu")}
        className="absolute right-2 top-[4.25rem] z-30 flex w-[min(330px,calc(100%-1rem))] flex-col gap-3 rounded-2xl bg-white p-3 text-[#10302D] shadow-[0_12px_32px_rgba(0,0,0,0.2)]">
        <button type="button" onClick={onNewChat}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E3EFEC] px-3 text-sm font-bold text-[#0B5E57]">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("vita.newChat")}
        </button>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{t("vita.language")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {LOCALES.map((l) => (
              <button key={l.code} type="button" lang={l.code === "hinglish" ? "hi-Latn" : l.code} aria-pressed={locale === l.code}
                onClick={() => setLocale(l.code)} className={seg(locale === l.code)}>
                {l.nativeLabel}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{t("vita.textSize")}</p>
          <div className="flex gap-1.5">
            {(["normal", "large", "larger"] as TextSize[]).map((size, i) => (
              <button key={size} type="button" aria-pressed={prefs.textSize === size} onClick={() => update({ textSize: size })}
                className={seg(prefs.textSize === size)} style={{ fontSize: 13 + i * 2 }}>
                {t(size === "normal" ? "vita.textNormal" : size === "large" ? "vita.textLarge" : "vita.textLarger")}
              </button>
            ))}
          </div>
        </div>
        {canSpeak && (
          <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl bg-[#F1F6F5] px-3 text-sm font-semibold">
            <span className="inline-flex items-center gap-2"><Volume2 className="h-4 w-4" aria-hidden="true" /> {t("vita.readAloud")}</span>
            <input type="checkbox" role="switch" checked={prefs.readAloud} className="h-5 w-5 accent-[#0B5E57]"
              onChange={(e) => { update({ readAloud: e.target.checked }); if (!e.target.checked) onStopSpeaking(); }} />
          </label>
        )}
        <a href={`https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent("Hi, I need help finding a doctor.")}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#0B5E57] hover:bg-emerald-50">
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t("vita.talkToPerson")}
        </a>
        <button type="button" disabled={recentCleared} onClick={() => { clearRecent(); setRecentCleared(true); }}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <History className="h-4 w-4" aria-hidden="true" /> {t("vita.clearRecent")}
        </button>
        {wake !== null && (
          <div className="rounded-xl bg-[#F1F6F5] px-3 py-2">
            <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
              <span className="inline-flex items-center gap-2"><Ear className="h-4 w-4" aria-hidden="true" /> {t("vita.wakeToggle")}</span>
              <input type="checkbox" role="switch" checked={prefs.wakeWord} className="h-5 w-5 accent-[#0B5E57]"
                onChange={(e) => { if (e.target.checked) preloadWakeWord(); update({ wakeWord: e.target.checked }); }} />
            </label>
            <p className="text-xs leading-snug text-slate-600">
              {prefs.wakeWord && WAKE_STATUS[wake] ? t(WAKE_STATUS[wake]!) : t("vita.wakeHelp")}
            </p>
          </div>
        )}
        <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">{t("vita.disclaimer")}</p>
      </div>
    </>
  );
}

const HOME_ASKS: { kind: string; key: TranslationKey; Icon: typeof Activity }[] = [
  { kind: "symptom", key: "vita.chipSymptom", Icon: Activity },
  { kind: "specialty", key: "vita.chipSpecialty", Icon: Stethoscope },
  { kind: "name", key: "vita.chipName", Icon: UserRound },
  { kind: "degree", key: "vita.chipDegree", Icon: GraduationCap },
];

function Home({ onAsk, onRecent }: { onAsk: (kind: string) => void; onRecent: (text: string) => void }) {
  const { t } = useTranslation();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(loadRecent()), []);
  return (
    <div className="flex flex-col items-center gap-3 px-1 pt-1">
      <div className="relative flex h-[124px] w-[140px] items-end justify-center">
        <div className="absolute bottom-0.5 h-4 w-28 rounded-[50%] bg-[#D3E4E0]" aria-hidden="true" />
        <Eagle mood="welcome" size={122} className="relative" />
      </div>
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-[22px] font-extrabold leading-tight text-[#10302D]">{t("vita.homeTitle")}</h2>
        <p className="text-sm leading-snug text-[#3D5A57]">{t("vita.homeBody")}</p>
      </div>
      <div className="mt-1 grid w-full grid-cols-2 gap-2.5" role="group">
        {HOME_ASKS.map(({ kind, key, Icon }) => (
          <button key={kind} type="button" onClick={() => onAsk(kind)}
            className="flex min-h-[56px] items-center gap-2 rounded-2xl border border-[#CFE0DC] bg-white px-2.5 py-2 text-left text-sm font-semibold leading-tight text-[#10302D] hover:border-[#0B5E57]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E3EFEC] text-[#0B5E57]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            {t(key)}
          </button>
        ))}
        <button type="button" onClick={() => onAsk("distance")}
          className="col-span-2 flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-[#0B5E57] px-3 text-[15px] font-bold text-white hover:brightness-110">
          <MapPin className="h-5 w-5" aria-hidden="true" /> {t("vita.chipNear")}
        </button>
      </div>
      {recent.length > 0 && (
        <div className="w-full">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            <History className="h-3.5 w-3.5" aria-hidden="true" /> {t("vita.recent")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <button key={r} type="button" onClick={() => onRecent(r)}
                className="min-h-[36px] max-w-full truncate rounded-full border border-[#CFE0DC] bg-white px-3 text-[13px] text-[#10302D] hover:border-[#0B5E57]">
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-center text-[11px] text-slate-500">{t("vita.disclaimer")}</p>
    </div>
  );
}

function ThinkingRow() {
  const { t } = useTranslation();
  return (
    <div className="flex items-end gap-2" role="status">
      <Eagle mood="thinking" size={64} />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm" aria-label={t("vita.typing")}>
        <span className="vita-dot h-2 w-2 rounded-full bg-[#0B5E57]" />
        <span className="vita-dot h-2 w-2 rounded-full bg-[#0B5E57]" />
        <span className="vita-dot h-2 w-2 rounded-full bg-[#0B5E57]" />
      </div>
    </div>
  );
}

function WorkingCard() {
  const { t } = useTranslation();
  return (
    <section role="status" className="flex flex-col items-center gap-2 rounded-3xl bg-white px-4 pb-4 pt-3 shadow-sm">
      <Eagle mood="working" size={128} />
      <p className="text-center text-[15px] font-bold text-[#10302D]">{t("vita.searching")}</p>
      <div className="flex w-full flex-col gap-2" aria-hidden="true">
        <div className="h-16 rounded-2xl bg-[#E1EBE9]" />
        <div className="h-16 rounded-2xl bg-[#E7EFED]" />
      </div>
    </section>
  );
}

function Entry({ entry, actions, active, busy, chosenId, speech, vote, onVote }: {
  entry: VitaEntry; actions: ReplyActions; active: boolean; busy: boolean; chosenId: string | null;
  speech?: ReplySpeech; vote?: boolean; onVote?: (helpful: boolean) => void;
}) {
  const { t } = useTranslation();
  if (entry.role === "user") {
    return (
      <div className="ml-auto w-fit max-w-[80%] whitespace-pre-line rounded-[18px] rounded-br-[4px] bg-[#0B5E57] px-3.5 py-2.5 text-[15px] leading-snug text-white">
        {entry.text}
      </div>
    );
  }
  if (entry.role === "error") {
    const msg = entry.error === "invalid" ? "vita.errorInvalid" : entry.error === "too_many" ? "vita.errorTooMany" : "vita.errorUnavailable";
    return (
      <div role="status" className="max-w-[92%] rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800">
        <p>{t(msg)}</p>
        {entry.error === "unavailable" && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={actions.retry}
              className="min-h-[44px] rounded-xl bg-[#0B5E57] px-3 text-sm font-semibold text-white disabled:opacity-50">
              {t("vita.retry")}
            </button>
            <a href="/" className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-[#0B5E57] hover:underline">
              {t("vita.browseDirectory")}
            </a>
          </div>
        )}
      </div>
    );
  }
  return entry.reply ? (
    <VitaReplyView reply={entry.reply} actions={actions} active={active} busy={busy} chosenId={chosenId}
      speech={speech} vote={vote} onVote={onVote} />
  ) : null;
}

function LocationPrompt({ chat, answering, onDone }: {
  chat: ReturnType<typeof useVitaChat>;
  /** true: Vita asked "where are you?" and this answers it; false: the patient is changing the place. */
  answering: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [typing, setTyping] = useState(false);
  const [denied, setDenied] = useState(false);
  const [value, setValue] = useState(chat.city ?? "");
  const [working, setWorking] = useState(false);

  const share = async () => {
    setWorking(true);
    const at = await chat.requestLocation(); // the browser asks for permission only now (UI-4)
    setWorking(false);
    if (!at) {
      setDenied(true);
      setTyping(true);
      return;
    }
    onDone();
    if (answering) void chat.send("location bhej di", { shownAs: t("vita.locationSharedMsg") }, { lat: at.lat, lng: at.lng });
  };

  const useTyped = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setWorking(true);
    let at: [number, number] | null = null;
    try {
      at = await geocodeAddress(v); // area or pincode -> a point, when the map service is set up
    } catch {
      at = null;
    }
    setWorking(false);
    chat.setCity(v, at ? { lat: at[1], lng: at[0] } : null);
    onDone();
    if (answering) void chat.send(v, {}, at ? { lat: at[1], lng: at[0], city: v } : { city: v });
  };

  return (
    <div className="rounded-2xl border border-[#DCE7E4] bg-white p-3">
      {denied && <p className="mb-2 text-sm text-slate-700">{t("vita.locationDenied")}</p>}
      {!typing ? (
        <div className="flex flex-col gap-2">
          <button type="button" disabled={working || chat.busy} onClick={share}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#0B5E57] px-3 text-sm font-semibold text-white disabled:opacity-50">
            <LocateFixed className="h-4 w-4" aria-hidden="true" /> {t("vita.shareLocation")}
          </button>
          <button type="button" onClick={() => setTyping(true)}
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
            {t("vita.typeArea")}
          </button>
          <button type="button" onClick={() => setTyping(true)}
            className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
            {t("vita.useCity")}
          </button>
        </div>
      ) : (
        <form onSubmit={useTyped} className="flex gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus
            placeholder={t("vita.cityPlaceholder")} aria-label={t("vita.cityPlaceholder")} maxLength={100}
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#0B5E57] focus:outline-none" />
          <button type="submit" disabled={working || chat.busy || !value.trim()}
            className="min-h-[44px] shrink-0 rounded-lg bg-[#0B5E57] px-3 text-sm font-semibold text-white disabled:opacity-50">
            {t("vita.useThis")}
          </button>
        </form>
      )}
    </div>
  );
}
