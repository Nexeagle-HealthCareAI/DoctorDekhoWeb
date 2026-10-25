"use client";

import Link from "next/link";
import { CalendarCheck, CheckCircle2, LocateFixed, MapPin, MessageCircle, Ticket, RotateCcw, RotateCw, Square, ThumbsDown, ThumbsUp, Volume2, X } from "lucide-react";
import EmergencyBanner from "@/components/patient/EmergencyBanner";
import VitaDoctorCard, { doctorHref, feeOf } from "@/components/patient/vita/VitaDoctorCard";
import { useTranslation } from "@/lib/i18n/I18nContext";
import { filterChips, type FilterKey } from "@/lib/vita/filters";
import type { VitaBooking, VitaDoctor, VitaDoctorsBlock, VitaOption, VitaReply } from "@/lib/vita/types";
import { WHATSAPP_BUSINESS_NUMBER } from "@/lib/site";
import { replyMood } from "@/lib/vita/mood";
import Eagle from "@/components/patient/vita/Eagle";
import VitaEmergencyHelp from "@/components/patient/vita/VitaEmergencyHelp";
import { REFINE_LABEL, refineOptions, type RefineKey } from "@/lib/vita/refine";

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
  /** One-tap narrowing of the latest list, said in the conversation's language. */
  refine: (key: RefineKey, language?: string) => void;
  startOver: () => void;
  /** Emergency without a location: ask the browser for it and send it, so the nearest hospitals follow. */
  shareLocation?: () => void;
  /** After booking, "Check in now": ask the browser for the location and send "check in" with it. */
  checkIn?: () => void;
}

export interface ReplySpeech {
  speaking: boolean;
  speak: () => void;
  stop: () => void;
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
  speech,
  vote,
  onVote,
}: {
  reply: VitaReply;
  actions: ReplyActions;
  /** Only the latest reply's chips and buttons act; older ones stay readable. */
  active: boolean;
  busy: boolean;
  chosenId?: string | null;
  /** Read this reply aloud (absent where the browser has no voices). */
  speech?: ReplySpeech;
  /** The patient's thumbs on this reply, if any; onVote only on the latest reply. */
  vote?: boolean;
  onVote?: (helpful: boolean) => void;
}) {
  const { t } = useTranslation();
  const off = !active || busy;

  // UI-6: the emergency card replaces everything else. The router's own emergency text is not shown
  // here so the screen carries one emergency number, the one EmergencyBanner shows.
  if (reply.kind === "emergency") {
    const share = (reply.clarify?.options ?? []).filter((o) => o.id === "emergency:share");
    return (
      <div className="flex w-full flex-col gap-3">
        <div className="[&>div]:mb-0">
          <EmergencyBanner reasons={emergencyReasons(reply)} doctorsBelow={false} />
        </div>
        {reply.emergency && <VitaEmergencyHelp emergency={reply.emergency} active={active && !busy} onShareLocation={actions.shareLocation} />}
        {active && share.map((o) => (
          <button key={o.id} type="button" disabled={off} onClick={() => actions.sendText(o.label)}
            className="inline-flex min-h-[48px] items-center justify-center self-start rounded-xl border-2 border-red-600 bg-white px-4 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  const lookupFailed = (reply.degraded ?? []).includes("doctor_lookup");
  const primary = reply.card?.outputs?.find((o) => o.role === "PRIMARY")?.specialist;
  const block = reply.doctors;
  // "location" is answered by the location prompt; "visit_checkin" by the visit card's own button
  const clarify = reply.clarify && reply.clarify.kind !== "location" && reply.clarify.kind !== "visit_checkin" ? reply.clarify : null;

  const onOption = (o: VitaOption) => {
    if (UUID.test(o.id)) actions.choose(o.id, o.label);
    else if (ASK_KINDS.has(o.id) && reply.clarify?.kind !== "book_offer") actions.askKind(o.id);
    else if (o.id === "human") actions.sendText("Talk to a person", o.label);
    else actions.sendText(o.label);
  };

  const mood = replyMood(reply);
  const relaxed = mood === "relaxed";
  const deadEnd = active && (reply.clarify?.kind === "no_match" || (reply.clarify?.options ?? []).some((o) => o.id === "human"));

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-end gap-2">
        {reply.kind !== "doctor_selected" && reply.kind !== "booked" && (
          <Eagle mood={mood === "emergency" ? "welcome" : mood} size={relaxed ? 96 : 44} className={relaxed ? "-mb-1" : ""} />
        )}
        <div className="max-w-[88%]">
          <div className="whitespace-pre-line rounded-[18px] rounded-bl-[4px] bg-white px-3.5 py-2.5 text-[15px] leading-snug text-[#10302D] shadow-[0_1px_2px_rgba(16,48,45,0.08)]">
            {reply.message}
          </div>
          {(speech || onVote || vote !== undefined) && (
            <div className="mt-0.5 flex items-center gap-0.5 pl-1 text-slate-500">
              {speech && (
                <button type="button" onClick={speech.speaking ? speech.stop : speech.speak}
                  aria-label={speech.speaking ? t("vita.stopListening") : t("vita.listen")} aria-pressed={speech.speaking}
                  className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-white ${speech.speaking ? "text-[#0B5E57]" : ""}`}>
                  {speech.speaking ? <Square className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                </button>
              )}
              {vote !== undefined ? (
                <span className="px-1 text-[11px]">{t("vita.thanksFeedback")}</span>
              ) : onVote ? (
                <>
                  <button type="button" onClick={() => onVote(true)} aria-label={t("vita.helpful")}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white">
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => onVote(false)} aria-label={t("vita.notHelpful")}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white">
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>
          )}
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
        <DoctorList block={block} actions={actions} off={off} chosenId={chosenId} active={active} language={reply.language} />
      )}

      {reply.kind === "doctor_selected" && reply.doctor && (
        <SelectedDoctor doctor={reply.doctor} onOthers={() => actions.sendText("See other doctors", t("vita.seeOthers"))} off={off}
          bookingHere={Boolean(reply.clarify?.kind?.startsWith("book_"))} />
      )}

      {reply.clarify?.kind === "book_confirm" && reply.booking && <BookingSummary booking={reply.booking} />}

      {reply.kind === "booked" && reply.booking && <BookedCard booking={reply.booking} />}

      {reply.kind === "visit" && reply.visit && (
        <VisitCard reply={reply} active={active} off={off} onCheckIn={actions.checkIn} />
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

      {deadEnd && (
        <button type="button" disabled={off} onClick={actions.startOver}
          className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("vita.startOver")}
        </button>
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

function DoctorList({ block, actions, off, chosenId, active, language }: {
  block: VitaDoctorsBlock; actions: ReplyActions; off: boolean; chosenId?: string | null; active: boolean; language?: string;
}) {
  const { t } = useTranslation();
  const chips = filterChips(block);
  const refines = refineOptions(block);
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
      {active && block.items.length > 1 && refines.length > 0 && (
        <div className="flex flex-col gap-1" role="group" aria-label={t("vita.refineLabel")}>
          <p className="text-xs font-semibold text-slate-600">{t("vita.refineLabel")}</p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {refines.map((k) => (
              <button key={k} type="button" disabled={off} onClick={() => actions.refine(k, language)}
                className="inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-[#9CC5BD] bg-white px-3 text-[13px] font-semibold text-[#0B5E57] hover:bg-emerald-50 disabled:opacity-50">
                {t(REFINE_LABEL[k])}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectedDoctor({ doctor, onOthers, off, bookingHere }: {
  doctor: VitaDoctor; onOthers: () => void; off: boolean;
  /** Vita is booking in the chat (its day question is below), so no separate "Book a slot" page. */
  bookingHere: boolean;
}) {
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
        {!bookingHere && (
          <Link href={`${doctorHref(doctor)}#book`}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#0B5E57] px-4 text-base font-extrabold text-white hover:brightness-110">
            <CalendarCheck className="h-5 w-5" aria-hidden="true" /> {t("vita.bookSlot")}
          </Link>
        )}
        <button type="button" disabled={off} onClick={onOthers}
          className="min-h-[44px] rounded-2xl border border-[#C9DAD6] px-3 font-semibold text-[#10302D] hover:bg-slate-50 disabled:opacity-50">
          {t("vita.seeOthers")}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t("vita.hospitalConfirms")}</p>
    </div>
  );
}

function sexShort(sex?: string | null): string {
  const s = (sex ?? "").toLowerCase();
  return s.startsWith("m") ? "M" : s.startsWith("f") ? "F" : s ? "O" : "";
}

function patientLine(b: VitaBooking): string | null {
  if (!b.patientName) return null;
  const months = ["m", "months"].includes((b.patientAgeUnit ?? "").toLowerCase());
  const age = b.patientAge != null ? `${b.patientAge}${months ? " mo" : ""}` : "";
  const extra = [age, sexShort(b.patientSex)].filter(Boolean).join(", ");
  return extra ? `${b.patientName} (${extra})` : b.patientName;
}

function Rows({ booking, showMobile }: { booking: VitaBooking; showMobile: boolean }) {
  const { t } = useTranslation();
  const where = [booking.hospital, booking.city].filter(Boolean).join(", ");
  const rows: [string, string | null | undefined][] = [
    [t("vita.yourDoctor"), [booking.doctorName, booking.specialty].filter(Boolean).join(" · ")],
    [t("vita.labelWhere"), where],
    [t("vita.labelWhen"), booking.when],
    [t("vita.labelPatient"), patientLine(booking)],
    [t("vita.labelMobile"), showMobile ? booking.mobile : null],
    [t("vita.labelFee"), booking.fee != null ? t("vita.payAtHospital", { fee: String(booking.fee) }) : null],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="font-medium text-[#10302D]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Before Vita books: everything it will send, in one place, above "Yes, book / Change / Cancel". */
function BookingSummary({ booking }: { booking: VitaBooking }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t("vita.confirmTitle")} className="rounded-2xl border border-[#C9DAD6] bg-white p-3.5 text-sm shadow-[0_1px_2px_rgba(16,48,45,0.08)]">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#0B6B4F]">{t("vita.confirmTitle")}</p>
      <Rows booking={booking} showMobile />
      <p className="mt-2 text-xs text-slate-500">{t("vita.hospitalConfirms")}</p>
    </section>
  );
}

/** Booked: the ID to quote at the desk, the details, the way there and where to find it again. */
function BookedCard({ booking }: { booking: VitaBooking }) {
  const { t } = useTranslation();
  const ref = booking.appointmentId ? booking.appointmentId.slice(0, 8).toUpperCase() : null;
  return (
    <section aria-label={t("vita.booked")} className="flex flex-col items-center rounded-3xl bg-white p-4 text-center text-sm shadow-[0_2px_8px_rgba(16,48,45,0.10)]">
      <Eagle mood="joyful" size={130} />
      <p className="mt-1 inline-flex items-center gap-1.5 text-lg font-extrabold text-[#0B6B4F]">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> {t("vita.booked")}
      </p>
      {ref && (
        <p className="mt-1 rounded-full bg-[#E3F2EC] px-3 py-1 font-mono text-sm font-bold tracking-wider text-[#10302D]">
          {t("vita.bookingId")}: {ref}
        </p>
      )}
      <div className="mt-3 w-full"><Rows booking={booking} showMobile={false} /></div>
      <div className="mt-3 flex w-full flex-col gap-2">
        {booking.mapUrl && (
          <a href={booking.mapUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#0B5E57] px-4 font-bold text-white hover:brightness-110">
            <MapPin className="h-5 w-5" aria-hidden="true" /> {t("vita.directions")}
          </a>
        )}
        <Link href="/appointments"
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-[#C9DAD6] px-3 font-semibold text-[#10302D] hover:bg-slate-50">
          {t("vita.myAppointments")}
        </Link>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t("vita.hospitalConfirms")}</p>
    </section>
  );
}

/** After booking: directions, the visit page, the token, and "Check in now" (the hospital checks the patient is there). */
function VisitCard({ reply, active, off, onCheckIn }: { reply: VitaReply; active: boolean; off: boolean; onCheckIn?: () => void }) {
  const { t } = useTranslation();
  const visit = reply.visit!;
  const token = visit.token;
  const canCheckIn = active && reply.clarify?.kind === "visit_checkin" && !!onCheckIn;
  return (
    <section aria-label={t("visit.details")} className="flex flex-col gap-2 rounded-2xl border border-[#C9DAD6] bg-white p-3.5 text-sm shadow-[0_1px_2px_rgba(16,48,45,0.08)]">
      {token?.tokenNo ? (
        <div className="flex items-center gap-3 rounded-xl bg-[#0B4F4A] px-3 py-2 text-white">
          <Ticket className="h-5 w-5" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/80">{t("visit.token")}</span>
          <span className="text-2xl font-extrabold" aria-live="polite">{token.tokenNo}</span>
          {token.estimatedWaitMinutes ? <span className="ml-auto text-xs">{t("visit.wait", { m: String(token.estimatedWaitMinutes) })}</span> : null}
        </div>
      ) : null}
      {canCheckIn && (
        <button type="button" disabled={off} onClick={onCheckIn}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#0B5E57] px-4 font-bold text-white disabled:opacity-50">
          <LocateFixed className="h-5 w-5" aria-hidden="true" /> {reply.clarify?.options?.[0]?.label ?? t("visit.checkIn")}
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        {!visit.cancelled && (
          <a href={visit.mapUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50">
            <MapPin className="h-4 w-4" aria-hidden="true" /> {t("vita.directions")}
          </a>
        )}
        <Link href={`/appointments/visit/${visit.appointmentId}`}
          className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-3 font-semibold text-[#0B5E57] hover:bg-slate-50">
          {t("visit.details")}
        </Link>
      </div>
    </section>
  );
}
