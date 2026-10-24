"use client";

import Link from "next/link";
import { CalendarCheck, MessageCircle, RotateCw, X } from "lucide-react";
import EmergencyBanner from "@/components/patient/EmergencyBanner";
import VitaDoctorCard, { doctorHref, feeOf } from "@/components/patient/vita/VitaDoctorCard";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { filterChips, type FilterKey } from "@/lib/vita/filters";
import type { VitaDoctor, VitaDoctorsBlock, VitaOption, VitaReply } from "@/lib/vita/types";
import { WHATSAPP_BUSINESS_NUMBER } from "@/lib/site";
import { replyMood } from "@/lib/vita/mood";
import Eagle from "@/components/patient/vita/Eagle";

// One Vita reply, drawn by its kind (requirements doc, section 9; UI-2 to UI-7). Doctors, hours and
// numbers are shown exactly as the router passed them on from 1HMS.

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ASK_KINDS = new Set(["symptom", "specialty", "name", "degree", "distance"]);

export interface ReplyActions {
  sendText: (text: string, shownAs?: string) => void;
  choose: (doctorId: string, shownAs: string) => void;
  showMore: (block: VitaDoctorsBlock) => void;
  removeFilter: (block: VitaDoctorsBlock, key: FilterKey) => void;
  askKind: (kind: string) => void;
  retry: () => void;
}

export function emergencyReasons(reply: VitaReply): string[] {
  return reply.card?.emergency_reasons ?? [];
}

export default function VitaReplyView({
  reply,
  actions,
  active,
  busy,
  chosenId,
}: {
  reply: VitaReply;
  actions: ReplyActions;
  /** Only the latest reply's chips and buttons act; older ones stay readable. */
  active: boolean;
  busy: boolean;
  chosenId?: string | null;
}) {
  const { t } = useTranslation();
  const off = !active || busy;

  // UI-6: the emergency card replaces everything else. The router's own emergency text is not shown
  // here so the screen carries one emergency number, the one EmergencyBanner shows.
  if (reply.kind === "emergency") {
    return (
      <div className="w-full [&>div]:mb-0">
        <EmergencyBanner reasons={emergencyReasons(reply)} doctorsBelow={false} />
      </div>
    );
  }

  const lookupFailed = (reply.degraded ?? []).includes("doctor_lookup");
  const primary = reply.card?.outputs?.find((o) => o.role === "PRIMARY")?.specialist;
  const block = reply.doctors;
  const clarify = reply.clarify && reply.clarify.kind !== "location" ? reply.clarify : null;

  const onOption = (o: VitaOption) => {
    if (UUID.test(o.id)) actions.choose(o.id, o.label);
    else if (ASK_KINDS.has(o.id) && reply.clarify?.kind !== "book_offer") actions.askKind(o.id);
    else if (o.id === "human") actions.sendText("Talk to a person", o.label);
    else actions.sendText(o.label);
  };

  const mood = replyMood(reply);
  const relaxed = mood === "relaxed";

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-end gap-2">
        {reply.kind !== "doctor_selected" && (
          <Eagle mood={mood === "emergency" ? "welcome" : mood} size={relaxed ? 96 : 44} className={relaxed ? "-mb-1" : ""} />
        )}
        <div className="max-w-[88%] whitespace-pre-line rounded-[18px] rounded-bl-[4px] bg-white px-3.5 py-2.5 text-[15px] leading-snug text-[#10302D] shadow-[0_1px_2px_rgba(16,48,45,0.08)]">
          {reply.message}
        </div>
      </div>

      {lookupFailed && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-slate-800">
          {primary && <p className="font-semibold">{t("vita.specialtyWas", { name: primary })}</p>}
          <p>{t("vita.errorUnavailable")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={off} onClick={actions.retry}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-[#0B5E57] px-3 text-sm font-semibold text-white disabled:opacity-50">
              <RotateCw className="h-4 w-4" aria-hidden="true" /> {t("vita.retry")}
            </button>
            <Link href="/" className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-[#0B5E57] hover:underline">
              {t("vita.browseDirectory")}
            </Link>
          </div>
        </div>
      )}

      {block && block.items.length > 0 && (
        <DoctorList block={block} actions={actions} off={off} chosenId={chosenId} />
      )}

      {reply.kind === "doctor_selected" && reply.doctor && (
        <SelectedDoctor doctor={reply.doctor} onOthers={() => actions.sendText("See other doctors", t("vita.seeOthers"))} off={off} />
      )}

      {reply.kind === "info" && reply.doctor && (
        <VitaDoctorCard doctor={reply.doctor} disabled={off} onChoose={(d) => actions.choose(d.doctorId, t("vita.chooseDoctor", { name: d.name ?? "" }))} />
      )}

      {reply.availability && reply.availability.days.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <p className="mb-1 font-semibold text-slate-900">{t("vita.workingDays")}</p>
          <ul className="space-y-0.5 text-slate-700">
            {reply.availability.days.map((d) => (
              <li key={d.date} className="flex justify-between gap-3">
                <span>{new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
                <span className={d.isAvailable ? "" : "text-slate-500"}>
                  {d.isAvailable ? d.shifts.map((s) => `${s.start ?? ""}–${s.end ?? ""}`).join(", ") : t("vita.dayOff")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-500">{t("vita.hospitalConfirms")}</p>
        </div>
      )}

      {reply.kind === "handoff" && (
        <a
          href={`https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent("Hi, I need help finding a doctor.")}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t("vita.whatsapp")}
        </a>
      )}

      {clarify && clarify.options.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={clarify.question ?? undefined}>
          {clarify.options.map((o) => (
            <button key={o.id + o.label} type="button" disabled={off} onClick={() => onOption(o)}
              className="min-h-[44px] rounded-full border border-[#075E54]/40 bg-white px-3.5 text-sm font-medium text-[#0B5E57] hover:bg-emerald-50 disabled:opacity-50">
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DoctorList({ block, actions, off, chosenId }: { block: VitaDoctorsBlock; actions: ReplyActions; off: boolean; chosenId?: string | null }) {
  const { t } = useTranslation();
  const chips = filterChips(block);
  const choose = (d: VitaDoctor) => actions.choose(d.doctorId, t("vita.chooseDoctor", { name: d.name ?? "" }));
  const byId = new Map(block.items.map((d) => [d.doctorId, d]));
  const groups = block.groups && block.groups.length > 0
    ? block.groups.map((g) => ({ title: g.title, items: g.doctorIds.map((id) => byId.get(id)).filter(Boolean) as VitaDoctor[] }))
    : [{ title: null as string | null, items: block.items }];

  return (
    <div className="flex flex-col gap-2">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={t("vita.filtersLabel")}>
          {chips.map((c) => {
            const label = t(c.labelKey as Parameters<typeof t>[0], { value: c.value ?? "" });
            return (
              <button key={c.key + label} type="button" disabled={off} onClick={() => actions.removeFilter(block, c.key)}
                aria-label={t("vita.removeFilter", { value: label })}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-[#0B5E57] px-3 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-60">
                {label} <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
      {groups.map((g) => (
        <section key={g.title ?? "all"} className="flex flex-col gap-2">
          {g.title && <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{g.title}</h4>}
          {g.items.map((d) => (
            <VitaDoctorCard key={d.doctorId} doctor={d} onChoose={choose} disabled={off} chosen={chosenId === d.doctorId} />
          ))}
        </section>
      ))}
      {block.hasMore && (
        <button type="button" disabled={off} onClick={() => actions.showMore(block)}
          className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50">
          {t("vita.showMore")}
        </button>
      )}
    </div>
  );
}

function SelectedDoctor({ doctor, onOthers, off }: { doctor: VitaDoctor; onOthers: () => void; off: boolean }) {
  const { t } = useTranslation();
  const fee = feeOf(doctor);
  const h = doctor.hospital;
  return (
    <div className="flex flex-col items-center rounded-3xl bg-white p-4 text-center text-sm shadow-[0_2px_8px_rgba(16,48,45,0.10)]">
      <Eagle mood="joyful" size={150} />
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#0B6B4F]">{t("vita.yourDoctor")}</p>
      <p className="mt-0.5 text-xl font-extrabold text-[#10302D]">{doctor.name}</p>
      {doctor.specialtyName && <p className="text-slate-600">{doctor.specialtyName}</p>}
      {h?.name && <p className="mt-1 text-slate-700">{h.name}</p>}
      {(h?.address || h?.city) && <p className="text-slate-600">{[h?.address, h?.city].filter(Boolean).join(", ")}</p>}
      {fee != null && <p className="mt-1 font-semibold text-slate-900">₹{fee}</p>}
      <div className="mt-3 flex w-full flex-col gap-2">
        <Link href={`${doctorHref(doctor)}#book`}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#0B5E57] px-4 text-base font-extrabold text-white hover:brightness-110">
          <CalendarCheck className="h-5 w-5" aria-hidden="true" /> {t("vita.bookSlot")}
        </Link>
        <button type="button" disabled={off} onClick={onOthers}
          className="min-h-[44px] rounded-2xl border border-[#C9DAD6] px-3 font-semibold text-[#10302D] hover:bg-slate-50 disabled:opacity-50">
          {t("vita.seeOthers")}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t("vita.hospitalConfirms")}</p>
    </div>
  );
}
