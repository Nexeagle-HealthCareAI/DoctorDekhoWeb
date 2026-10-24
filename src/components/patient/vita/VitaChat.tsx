"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, GraduationCap, LocateFixed, MapPin, MessageCircle, Mic, Send, Square, Stethoscope, User as UserRound, X,
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
import VitaReplyView, { type ReplyActions } from "@/components/patient/vita/VitaReplyView";

// The Vita chat panel (UI-1 to UI-8): header with the eagle's current mood, the welcome home, the
// conversation, the location prompt and the message box (type or speak). The conversation state comes
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

export default function VitaChat({ chat, onClose }: { chat: VitaChatState; onClose?: () => void }) {
  const { t, locale } = useTranslation();
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<TranslationKey>("vita.inputPlaceholderVoice");
  const [showSpecialties, setShowSpecialties] = useState(false);
  const [editingPlace, setEditingPlace] = useState(false);
  const [waitedLong, setWaitedLong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechInput(locale, (text) => setDraft(text));

  // Follow the conversation; the home screen stays at its top so the welcome eagle is seen.
  useEffect(() => {
    if (chat.entries.length === 0 && !chat.busy) return;
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [chat.entries.length, chat.busy, waitedLong]);

  // "thinking" for a short beat, then "working" once the wait feels like a search
  useEffect(() => {
    if (!chat.busy) {
      setWaitedLong(false);
      return;
    }
    const timer = setTimeout(() => setWaitedLong(true), WORKING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [chat.busy]);

  const last = chat.entries.at(-1);
  const mood = chatMood({ last, busy: chat.busy, waitedMs: waitedLong ? WORKING_AFTER_MS : 0 });
  const emergency = mood === "emergency";
  const latestVita = [...chat.entries].reverse().find((e) => e.role === "vita");
  const chosenId = [...chat.entries].reverse().find((e) => e.reply?.kind === "doctor_selected")?.reply?.selectedDoctorId ?? null;
  const askingLocation = latestVita?.reply?.clarify?.kind === "location" && chat.entries.at(-1) === latestVita;

  const send = (text: string, shownAs?: string) => {
    setShowSpecialties(false);
    void chat.send(text, { shownAs });
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
    askKind,
    retry: chat.retry,
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    if (speech.listening) speech.stop();
    send(draft);
    setDraft("");
    setHint("vita.inputPlaceholderVoice");
  };

  const place = chat.coords ? t("vita.locationShared") : chat.city || t("vita.locationNone");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#EEF4F3]">
      <header className={`flex shrink-0 items-center gap-3 px-4 py-3 text-white transition-colors ${emergency ? "bg-[#B3141E]" : "bg-[#0B4F4A]"}`}>
        {emergency ? (
          <AlertTriangle className="h-7 w-7 shrink-0" aria-hidden="true" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-end justify-center overflow-hidden rounded-full bg-[#E3EFEC]">
            <Eagle mood={mood as Exclude<VitaMood, "emergency">} size={40} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-extrabold leading-tight text-white">{emergency ? t("vita.statusEmergency") : t("vita.title")}</p>
          <p className="truncate text-xs leading-tight text-white/80" aria-live="polite">
            {emergency ? t("directory.emergencyBody") : t(MOOD_STATUS[mood])}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={t("vita.close")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/10">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </header>

      <div role="log" aria-live="polite" aria-relevant="additions" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
        {chat.entries.length === 0 ? (
          <Home onAsk={askKind} />
        ) : (
          <div className="flex items-center gap-2 self-center rounded-full bg-white/70 px-3 py-1 text-xs text-slate-600">
            <Eagle mood="welcome" size={22} /> {t("vita.homeTitle")}
          </div>
        )}

        {chat.entries.map((e) => (
          <Entry key={e.id} entry={e} actions={actions} active={e === latestVita} busy={chat.busy} chosenId={chosenId} />
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

      {!emergency && (
        <div className="flex shrink-0 items-center gap-1.5 border-t border-[#DCE7E4] bg-white px-4 py-1.5 text-xs text-slate-600">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{t("vita.locationLine", { place })}</span>
          <button type="button" onClick={() => setEditingPlace((v) => !v)} className="min-h-[32px] px-1 font-semibold text-[#0B5E57] hover:underline">
            {t("vita.change")}
          </button>
        </div>
      )}

      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-[#DCE7E4] bg-white px-3 py-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={speech.listening ? t("vita.listening") : hint === "vita.inputPlaceholderVoice" && !speech.supported ? t("vita.inputPlaceholder") : t(hint)}
          aria-label={t("vita.inputLabel")}
          maxLength={1000}
          className="min-h-[48px] min-w-0 flex-1 rounded-full border border-[#C9DAD6] bg-[#F7FAF9] px-4 text-[15px] text-slate-900 placeholder:text-slate-500 focus:border-[#0B5E57] focus:outline-none"
        />
        {speech.supported && (
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

      <div className="flex shrink-0 items-center justify-between gap-2 bg-white px-4 pb-2 text-[11px] text-slate-500">
        <span>{t("vita.disclaimer")}</span>
        <a href={`https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent("Hi, I need help finding a doctor.")}`}
          target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-[#0B5E57] hover:underline">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

const HOME_ASKS: { kind: string; key: TranslationKey; Icon: typeof Activity }[] = [
  { kind: "symptom", key: "vita.chipSymptom", Icon: Activity },
  { kind: "specialty", key: "vita.chipSpecialty", Icon: Stethoscope },
  { kind: "name", key: "vita.chipName", Icon: UserRound },
  { kind: "degree", key: "vita.chipDegree", Icon: GraduationCap },
];

function Home({ onAsk }: { onAsk: (kind: string) => void }) {
  const { t } = useTranslation();
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

function Entry({ entry, actions, active, busy, chosenId }: {
  entry: VitaEntry; actions: ReplyActions; active: boolean; busy: boolean; chosenId: string | null;
}) {
  const { t } = useTranslation();
  if (entry.role === "user") {
    return (
      <div className="max-w-[80%] self-end whitespace-pre-line rounded-[18px] rounded-br-[4px] bg-[#0B5E57] px-3.5 py-2.5 text-[15px] leading-snug text-white">
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
  return entry.reply ? <VitaReplyView reply={entry.reply} actions={actions} active={active} busy={busy} chosenId={chosenId} /> : null;
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
    chat.setCity(v);
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
