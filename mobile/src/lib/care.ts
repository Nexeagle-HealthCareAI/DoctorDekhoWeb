import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import type { MyAppointment } from "./api/types";
import { visitKind, type VisitKind } from "./booking";
import { istDateString, istNow } from "./format";

/**
 * Where the patient is in their care, which decides what Home leads with:
 * - waiting: a request the hospital hasn't confirmed yet
 * - upcoming: confirmed, more than a day away
 * - dayBefore: the visit is tomorrow
 * - visitDay: the visit is today
 * - after: no visit ahead, and one happened in the last week
 * - none: nothing booked
 */
export type CareStage = "none" | "waiting" | "upcoming" | "dayBefore" | "visitDay" | "after";

const AFTER_DAYS = 7;

export function careState(appointments: MyAppointment[]): { stage: CareStage; next?: MyAppointment; last?: MyAppointment } {
  const today = istDateString();
  const live = (k: VisitKind) => k === "pending" || k === "confirmed";
  const next = appointments
    .filter((a) => a.apptDate.slice(0, 10) >= today && live(visitKind(a)))
    .sort((a, b) => a.apptDate.localeCompare(b.apptDate) || a.startAt.localeCompare(b.startAt))[0];
  if (next) {
    const day = next.apptDate.slice(0, 10);
    if (day === today) return { stage: "visitDay", next };
    if (day === istDateString(1)) return { stage: "dayBefore", next };
    return { stage: visitKind(next) === "confirmed" ? "upcoming" : "waiting", next };
  }
  // A visit that has happened: marked completed, or a confirmed visit whose day has passed.
  const since = istDateString(-AFTER_DAYS);
  const last = appointments
    .filter((a) => {
      const day = a.apptDate.slice(0, 10);
      const k = visitKind(a);
      return day >= since && day <= today && (k === "completed" || (k === "confirmed" && day < today));
    })
    .sort((a, b) => b.apptDate.localeCompare(a.apptDate) || b.startAt.localeCompare(a.startAt))[0];
  return last ? { stage: "after", last } : { stage: "none" };
}

/** Whose visit this is: "me", a family member's id, or null when the name matches nobody (older bookings). */
export function whoseVisit(a: Pick<MyAppointment, "patientName">, myName: string | null | undefined, members: { memberId: string; fullName: string }[]): string | null {
  const n = norm(a.patientName);
  if (!n) return null;
  if (n === norm(myName)) return "me";
  return members.find((m) => norm(m.fullName) === n)?.memberId ?? null;
}
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** The next live visit for each other person in the family (not `exclude`), soonest first. */
export function otherUpcoming(appointments: MyAppointment[], exclude?: MyAppointment): MyAppointment[] {
  const today = istDateString();
  const seen = new Set<string>([norm(exclude?.patientName)]);
  const out: MyAppointment[] = [];
  for (const a of [...appointments].sort((x, y) => x.apptDate.localeCompare(y.apptDate) || x.startAt.localeCompare(y.startAt))) {
    const k = visitKind(a);
    if (a.apptDate.slice(0, 10) < today || (k !== "pending" && k !== "confirmed") || a.appointmentId === exclude?.appointmentId) continue;
    const who = norm(a.patientName);
    if (!who || seen.has(who)) continue;
    seen.add(who);
    out.push(a);
  }
  return out;
}

/** Index of the current step in Sent → Seen → Hospital calls → Confirmed → Visit (same as the Visits tab). */
export function journeyStep(a: Pick<MyAppointment, "status" | "statusCode" | "apptDate" | "hospitalSeenAt">): number {
  const kind = visitKind(a);
  if (kind === "pending") return a.hospitalSeenAt ? 2 : 1;
  return a.apptDate.slice(0, 10) === istDateString() ? 4 : 3;
}

/** "9:50 AM" leave time and whether it has already passed, from a HH:mm start and travel seconds (10 min spare). */
export function leaveTime(start: string | undefined, travelSeconds: number): { label: string; late: boolean } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(start ?? "");
  if (!m) return null;
  const leave = Number(m[1]) * 60 + Number(m[2]) - Math.ceil(travelSeconds / 60) - 10;
  if (leave < 0) return null;
  const now = istNow();
  const h = Math.floor(leave / 60);
  return { label: `${((h + 11) % 12) + 1}:${String(leave % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`, late: now.getHours() * 60 + now.getMinutes() >= leave };
}

/** A small set of ids kept on the phone (ticked checklist items, hidden cards). Never sent anywhere. */
export function useStoredSet(key: string | null) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setIds(new Set());
    if (!key) return;
    let live = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (live && raw) setIds(new Set(JSON.parse(raw) as string[]));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]);
  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (key) void AsyncStorage.setItem(key, JSON.stringify([...next])).catch(() => {});
        return next;
      });
    },
    [key],
  );
  return { ids, toggle };
}
