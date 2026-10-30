"use client";

import { useMemo, useState } from "react";
import Eagle from "@/components/patient/vita/Eagle";
import { useQueries, useQuery } from "@tanstack/react-query";
import PatientTopBar from "@/components/patient/PatientTopBar";
import ProfileShell from "@/components/patient/ProfileShell";
import { Calendar, Clock, MapPin, ChevronRight, ChevronDown, LogIn, Smartphone, FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { useGuestAppointments } from "@/hooks/useGuestAppointments";
import { usePatientAuth, type PatientAppointment } from "@/hooks/usePatientAuth";
import { cn } from "@/lib/utils";

async function fetchGuestAppointment(id: string): Promise<PatientAppointment | null> {
  const res = await fetch(`/api/public/appointments/${id}`);
  const json = await res.json().catch(() => null);
  return json?.appointment ?? null;
}

interface AppointmentDocument {
  attachmentId: string;
  reportType: string | null;
  fileName: string | null;
  storageUrl: string | null;
  notes: string | null;
  uploadedAt: string | null;
}

async function fetchAppointmentDocuments(id: string): Promise<AppointmentDocument[]> {
  const res = await fetch(`/api/public/appointments/${id}/documents`);
  const json = await res.json().catch(() => null);
  return json?.documents ?? [];
}

// Documents are only reachable for a logged-in session (the backend checks the OTP-verified
// mobile against PatientRegistration.Mobile) â€” guest-tracked cards never show this section since
// there's no session cookie to authenticate the request.
function DocumentsSection({ appointmentId }: { appointmentId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: documents, isLoading } = useQuery({
    queryKey: ["appointment-documents", appointmentId],
    queryFn: () => fetchAppointmentDocuments(appointmentId),
    enabled: expanded,
    staleTime: 30_000,
  });

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-bold text-brand-teal hover:text-teal-700 transition-colors"
      >
        <Paperclip className="w-3.5 h-3.5" />
        Documents
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-3">
              <div className="w-4 h-4 border-2 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
            </div>
          ) : documents && documents.length > 0 ? (
            documents.map((doc) => (
              <a
                key={doc.attachmentId}
                href={doc.storageUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">{doc.fileName || doc.reportType || "Document"}</p>
                  {doc.reportType && <p className="text-[10px] text-slate-400">{doc.reportType}</p>}
                </div>
              </a>
            ))
          ) : (
            <p className="text-xs text-slate-400 py-1">No documents uploaded for this appointment yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AppointmentCard({ appt, canViewDocuments }: { appt: PatientAppointment; canViewDocuments: boolean }) {
  const isCancelled = appt.status === "Cancelled";
  const isPending = appt.status === "Pending Confirmation";
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm active:scale-[0.98] transition-transform">
      <div className="flex justify-between items-start mb-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase",
            isCancelled ? "bg-red-50 text-red-700" : isPending ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          )}
        >
          {appt.status}
        </span>
      </div>

      <h3 className="font-display font-bold text-slate-900 text-base">{appt.doctorName}</h3>

      <div className="space-y-2 mt-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{new Date(appt.apptDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{new Date(appt.startAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{appt.hospitalName}</span>
        </div>
      </div>

      {canViewDocuments && <DocumentsSection appointmentId={appt.appointmentId} />}

      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400">Ref: {appt.appointmentId.slice(0, 8).toUpperCase()}</span>
        {!isCancelled ? (
          <Link href={`/appointments/visit/${appt.appointmentId}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-teal hover:text-teal-700">
            Directions &amp; check-in <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-300" />
        )}
      </div>
    </div>
  );
}

export default function AppointmentsClient() {
  const { entries: guestEntries, isLoaded } = useGuestAppointments();
  const { isLoggedIn, mobile, appointments: myAppointments, isLoading: authLoading, logout } = usePatientAuth();

  // Once logged in, guest entries booked under the SAME verified number are already covered by
  // the authenticated list â€” only fetch/show ones booked under a DIFFERENT number (e.g. this
  // device was used to book for a family member with a different contact number), kept in their
  // own clearly-labeled section rather than silently merged into "your appointments". This is
  // also what keeps a shared/borrowed device safe: a stranger's guest booking sitting in this
  // browser's storage never gets attributed to whoever happens to log in here.
  const idsToFetch = useMemo(() => {
    if (!isLoaded) return [];
    if (!isLoggedIn) return guestEntries.map((e) => e.appointmentId);
    return guestEntries.filter((e) => e.mobile !== mobile).map((e) => e.appointmentId);
  }, [isLoaded, isLoggedIn, mobile, guestEntries]);

  const guestQueries = useQueries({
    queries: idsToFetch.map((id) => ({
      queryKey: ["public-appointment", id],
      queryFn: () => fetchGuestAppointment(id),
      staleTime: 30_000,
    })),
  });
  const guestAppointments = guestQueries.map((q) => q.data).filter((a): a is PatientAppointment => !!a);
  const guestLoading = guestQueries.some((q) => q.isLoading);

  if (!isLoaded || authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0">
        <PatientTopBar showBackButton={true} wide />
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  const hasAnyAppointments = myAppointments.length > 0 || guestAppointments.length > 0;

  // The content of the page: a signed-in person sees it inside the account layout (their card and the menu of sections beside it, Sign out
  // in the top bar menu only); a guest sees it on its own.
  const content = (
    <>
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">My Appointments</h1>
          {!isLoggedIn && (
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-teal hover:text-teal-700 transition-colors">
              <LogIn className="w-3.5 h-3.5" /> Log in
            </Link>
          )}
        </div>

        {hasAnyAppointments ? (
          <div className="space-y-6">
            {isLoggedIn && myAppointments.length > 0 && (
              <div className="space-y-4">
                {myAppointments.map((a) => (
                  <AppointmentCard key={a.appointmentId} appt={a} canViewDocuments />
                ))}
              </div>
            )}

            {guestAppointments.length > 0 && (
              <div className="space-y-3">
                {isLoggedIn && (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    <Smartphone className="w-3.5 h-3.5" /> Booked as guest on this device
                  </p>
                )}
                <div className="space-y-4">
                  {guestAppointments.map((a) => (
                    <AppointmentCard key={a.appointmentId} appt={a} canViewDocuments={false} />
                  ))}
                </div>
              </div>
            )}

            {guestLoading && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
              </div>
            )}

            {!isLoggedIn && (
              <div className="text-center py-4 px-6 bg-teal-50/60 border border-teal-100 rounded-2xl">
                <p className="text-xs text-slate-600">
                  Log in with WhatsApp to see these appointments from any device.
                </p>
                <Link
                  href="/login"
                  className="mt-2 inline-block text-xs font-bold text-brand-teal hover:text-teal-700"
                >
                  Log In With WhatsApp â†’
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 shadow-sm px-6">
            <span className="vita-peek mb-2">
              <span className="vita-peek-eagle block">
                <Eagle mood="wave" size={112} />
              </span>
            </span>
            <h3 className="font-display font-bold text-lg text-slate-900 mb-2">No upcoming appointments</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">
              {isLoggedIn
                ? "You don't have any appointments yet."
                : "You haven't booked any appointments on this device yet."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-[0_4px_14px_0_rgba(15,23,42,0.18)] hover:bg-slate-800 transition-colors w-full sm:w-auto"
              >
                Find a Doctor
              </Link>
              {!isLoggedIn && (
                <Link
                  href="/login"
                  className="px-6 py-3 rounded-xl bg-white text-slate-700 font-bold text-sm border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors w-full sm:w-auto text-center flex items-center justify-center"
                >
                  Log In With WhatsApp
                </Link>
              )}
            </div>

            {!isLoggedIn && (
              <p className="text-xs text-slate-400 mt-6 max-w-[250px]">
                Booked from another device? Log in with WhatsApp to see it here.
              </p>
            )}
          </div>
        )}
    </>
  );

  if (isLoggedIn) return <ProfileShell>{content}</ProfileShell>;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0">
      <PatientTopBar showBackButton={true} wide />
      <div className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="max-w-3xl">{content}</div>
      </div>
    </main>
  );
}
