"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, MessageCircle, Send } from "lucide-react";
import { useVitaChat, type VitaEntry } from "@/hooks/useVitaChat";
import { useTranslation } from "@/lib/i18n/I18nContext";
import type { TranslationKey } from "@/lib/i18n/dictionaries/en";
import { textWithout } from "@/lib/vita/filters";
import { geocodeAddress } from "@/lib/navigation";
import { WHATSAPP_BUSINESS_NUMBER } from "@/lib/site";
import VitaReplyView, { type ReplyActions } from "@/components/patient/vita/VitaReplyView";

// The Vita chat panel (UI-1 to UI-8): home chips, the conversation, the location prompt and the
// message box. Talks to /api/vita/chat through useVitaChat.

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

export default function VitaChat({ hospitalId }: { hospitalId?: string }) {
  const { t } = useTranslation();
  const chat = useVitaChat({ hospitalId });
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<TranslationKey>("vita.inputPlaceholder");
  const [showSpecialties, setShowSpecialties] = useState(false);
  const [editingPlace, setEditingPlace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [chat.entries.length, chat.busy]);

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
    setHint(HINTS[kind] ?? "vita.inputPlaceholder");
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
    send(draft);
    setDraft("");
    setHint("vita.inputPlaceholder");
  };

  const place = chat.coords ? t("vita.locationShared") : chat.city || t("vita.locationNone");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#ECE5DD] px-3 py-4"
      >
        <div className="max-w-[92%] whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
          {t("vita.greeting")}
        </div>

        {chat.entries.length === 0 && (
          <div className="flex flex-wrap gap-2" role="group">
            {(["symptom", "specialty", "name", "degree", "distance"] as const).map((k) => (
              <button key={k} type="button" onClick={() => askKind(k)}
                className="min-h-[44px] rounded-full border border-[#075E54]/40 bg-white px-3.5 text-sm font-medium text-[#075E54] hover:bg-emerald-50">
                {t(({ symptom: "vita.chipSymptom", specialty: "vita.chipSpecialty", name: "vita.chipName", degree: "vita.chipDegree", distance: "vita.chipNear" } as const)[k])}
              </button>
            ))}
          </div>
        )}

        {chat.entries.map((e) => (
          <Entry key={e.id} entry={e} actions={actions} active={e === latestVita} busy={chat.busy} chosenId={chosenId} />
        ))}

        {showSpecialties && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("vita.chipSpecialty")}>
            {SPECIALTY_SHORTCUTS.map((s) => (
              <button key={s.send} type="button" disabled={chat.busy} onClick={() => send(s.send, t(s.key))}
                className="min-h-[44px] rounded-full border border-[#075E54]/40 bg-white px-3.5 text-sm font-medium text-[#075E54] hover:bg-emerald-50 disabled:opacity-50">
                {t(s.key)}
              </button>
            ))}
          </div>
        )}

        {(askingLocation || editingPlace) && (
          <LocationPrompt
            chat={chat}
            answering={askingLocation}
            onDone={() => setEditingPlace(false)}
          />
        )}

        {chat.busy && <p className="text-xs italic text-slate-600">{t("vita.typing")}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-1.5 border-t border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t("vita.locationLine", { place })}</span>
        <button type="button" onClick={() => setEditingPlace((v) => !v)} className="min-h-[32px] px-1 font-medium text-[#075E54] hover:underline">
          {t("vita.change")}
        </button>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t(hint)}
          aria-label={t("vita.inputLabel")}
          maxLength={1000}
          className="min-h-[44px] min-w-0 flex-1 rounded-full border border-slate-300 px-4 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#075E54] focus:outline-none"
        />
        <button type="submit" disabled={chat.busy || !draft.trim()} aria-label={t("vita.send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#075E54] text-white disabled:opacity-50">
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>

      <div className="flex items-center justify-between gap-2 bg-white px-3 pb-2 text-[11px] text-slate-500">
        <span>{t("vita.disclaimer")}</span>
        <a href={`https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent("Hi, I need help finding a doctor.")}`}
          target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-[#075E54] hover:underline">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp
        </a>
      </div>
    </div>
  );
}

function Entry({ entry, actions, active, busy, chosenId }: {
  entry: VitaEntry; actions: ReplyActions; active: boolean; busy: boolean; chosenId: string | null;
}) {
  const { t } = useTranslation();
  if (entry.role === "user") {
    return (
      <div className="max-w-[85%] self-end whitespace-pre-line rounded-2xl rounded-tr-sm bg-[#DCF8C6] px-3.5 py-2 text-sm text-slate-900 shadow-sm">
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
              className="min-h-[44px] rounded-lg bg-[#075E54] px-3 text-sm font-semibold text-white disabled:opacity-50">
              {t("vita.retry")}
            </button>
            <a href="/" className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-[#075E54] hover:underline">
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
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {denied && <p className="mb-2 text-sm text-slate-700">{t("vita.locationDenied")}</p>}
      {!typing ? (
        <div className="flex flex-col gap-2">
          <button type="button" disabled={working || chat.busy} onClick={share}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#075E54] px-3 text-sm font-semibold text-white disabled:opacity-50">
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
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-[#075E54] focus:outline-none" />
          <button type="submit" disabled={working || chat.busy || !value.trim()}
            className="min-h-[44px] shrink-0 rounded-lg bg-[#075E54] px-3 text-sm font-semibold text-white disabled:opacity-50">
            {t("vita.useThis")}
          </button>
        </form>
      )}
    </div>
  );
}
