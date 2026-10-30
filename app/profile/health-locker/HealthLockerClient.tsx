"use client";

import { useRef, useState } from "react";
import Eagle from "@/components/patient/vita/Eagle";
import { toast } from "sonner";
import PatientTopBar from "@/components/patient/PatientTopBar";
import ProfileShell from "@/components/patient/ProfileShell";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { useHealthLocker, type HealthLockerDocument, type LockerScope } from "@/hooks/useHealthLocker";
import { FileText, Upload, Trash2, LogIn, ShieldCheck, Stethoscope, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";

const DOCUMENT_TYPES = ["Prescription", "Lab Report", "X-ray / Scan", "Discharge Summary", "Vaccination Record", "Other"];

/** "Dr. Rao · Rao Clinic, Lucknow · 01 Sep 2026" — the visit a record is from, whether it is a booking here or a doctor added by hand. */
const visitLine = (d: HealthLockerDocument) => {
  const doctor = d.externalDoctorName ?? d.doctorName;
  const place = d.externalDoctorName ? [d.externalClinicName, d.externalLocation].filter(Boolean).join(", ") : d.hospitalName;
  return [doctor, place, d.visitDate ? formatDate(d.visitDate) : null].filter(Boolean).join(" · ");
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function HealthLockerClient() {
  const { isLoggedIn, isLoading: authLoading, appointments } = usePatientAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { members } = useFamilyMembers(isLoggedIn);
  // Whose records to show: ?member=me, ?member=<id> for a family member of this account, otherwise everyone's.
  const requested = useSearchParams().get("member");
  const scope: LockerScope = requested === "me" ? "me" : requested && members.some((m) => m.memberId === requested) ? requested : "all";
  const { documents, isLoading, upload, remove } = useHealthLocker(isLoggedIn, scope);
  const nameOf = (id?: string | null) => members.find((m) => m.memberId === id);

  // Whose record is being added, and which visit it is from. Starts on whoever is being looked at.
  const [forMember, setForMember] = useState<string>("");
  const ownerId = scope !== "all" && scope !== "me" ? scope : forMember;
  const who = nameOf(ownerId);
  const [visit, setVisit] = useState<"none" | "appointment" | "other">("none");
  const [apptId, setApptId] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [location, setLocation] = useState("");
  const [visitDate, setVisitDate] = useState("");

  const [documentType, setDocumentType] = useState(DOCUMENT_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0">
        <PatientTopBar showBackButton={true} wide />
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col pb-24 md:pb-0">
        <PatientTopBar showBackButton={true} wide />
        <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-10">
          <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 shadow-sm px-6">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-brand-teal flex items-center justify-center mb-4 border border-teal-100">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900 mb-2">You&apos;re not logged in</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm">Log in with WhatsApp from your profile to use your Health Locker.</p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-teal-600 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Go to Profile
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first.");
      return;
    }
    if (visit === "appointment" && !apptId) return toast.error("Choose the visit, or pick another option.");
    if (visit === "other" && !doctorName.trim()) return toast.error("Enter the doctor's name.");
    const result = await upload.mutateAsync({
      file: selectedFile,
      documentType,
      notes: notes || undefined,
      target: {
        memberId: ownerId || null,
        apptId: visit === "appointment" ? apptId : null,
        external: visit === "other" ? { doctorName, clinicName, location } : null,
        visitDate: visit === "other" && visitDate ? visitDate : null,
      },
    });
    if (result.success) {
      toast.success(who ? `Saved to ${who.firstName}'s records.` : "Document saved to your Health Locker.");
      setSelectedFile(null);
      setNotes("");
      setDocumentType(DOCUMENT_TYPES[0]);
      setVisit("none"); setApptId(""); setDoctorName(""); setClinicName(""); setLocation(""); setVisitDate("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      toast.error(result.message || "Could not upload the document.");
    }
  };

  const handleDelete = async (documentId: string) => {
    const result = await remove.mutateAsync(documentId);
    if (result.success) {
      toast.success("Document removed.");
    } else {
      toast.error(result.message || "Could not delete the document.");
    }
  };

  return (
    <ProfileShell>
        <h1 className="text-2xl font-display font-extrabold text-slate-900 tracking-tight mb-1">Health Locker</h1>
        <p className="text-sm text-slate-500 mb-5">
          Keep prescriptions, lab reports and other medical documents for you and your family, and link each one to the doctor visit it came from.
        </p>

        {members.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Whose records">
            {[{ key: "all", label: "Everyone" }, { key: "me", label: "Me" }, ...members.map((m) => ({ key: m.memberId, label: m.firstName }))].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={scope === t.key}
                onClick={() => router.replace(t.key === "all" ? pathname : `${pathname}?member=${t.key}`)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${scope === t.key ? "bg-brand-teal text-white border-brand-teal" : "bg-white text-slate-600 border-slate-200 hover:border-brand-teal hover:text-brand-teal"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Upload card */}
        <div className="bg-white rounded-3xl p-5 mb-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 space-y-4">
          <div>
            <label htmlFor="hl-for" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">This record is for</label>
            {scope !== "all" && scope !== "me" ? (
              <p id="hl-for" className="text-sm font-semibold text-slate-900">{who ? `${who.fullName} (${who.relation})` : ""}</p>
            ) : (
              <select id="hl-for" value={forMember} onChange={(e) => setForMember(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal">
                <option value="">Me</option>
                {members.map((m) => <option key={m.memberId} value={m.memberId}>{m.fullName} ({m.relation})</option>)}
              </select>
            )}
            {members.length === 0 && (
              <p className="text-xs text-slate-400 mt-1.5">Keeping records for your child or parent too? <Link href="/profile/family" className="font-semibold text-brand-teal hover:underline">Add a family member</Link></p>
            )}
          </div>

          <div>
            <label htmlFor="hl-visit" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Doctor visit <span className="font-normal normal-case text-slate-400">(optional)</span></label>
            <select id="hl-visit" value={visit} onChange={(e) => setVisit(e.target.value as typeof visit)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal">
              <option value="none">Not linked to a visit</option>
              {appointments.length > 0 && <option value="appointment">A visit from my appointments</option>}
              <option value="other">A doctor who is not listed here</option>
            </select>
          </div>

          {visit === "appointment" && (
            <div>
              <label htmlFor="hl-appt" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Which visit</label>
              <select id="hl-appt" value={apptId} onChange={(e) => setApptId(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal">
                <option value="">Choose a visit</option>
                {appointments.map((a) => (
                  <option key={a.appointmentId} value={a.appointmentId}>{`${a.doctorName} · ${a.hospitalName} · ${formatDate(a.apptDate)}`}</option>
                ))}
              </select>
            </div>
          )}

          {visit === "other" && (
            <fieldset className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <legend className="px-1 text-xs font-semibold text-slate-500">Add the doctor</legend>
              <div>
                <label htmlFor="hl-doc" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Doctor&apos;s name</label>
                <input id="hl-doc" value={doctorName} maxLength={200} onChange={(e) => setDoctorName(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal" placeholder="For example: Dr. Rao" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="hl-clinic" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Clinic or hospital <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                  <input id="hl-clinic" value={clinicName} maxLength={200} onChange={(e) => setClinicName(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal" />
                </div>
                <div>
                  <label htmlFor="hl-loc" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Location <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                  <input id="hl-loc" value={location} maxLength={300} onChange={(e) => setLocation(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal" placeholder="Area and city" />
                </div>
              </div>
              <div>
                <label htmlFor="hl-date" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Date of visit <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                <input id="hl-date" type="date" value={visitDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setVisitDate(e.target.value)} className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal sm:w-56" />
              </div>
            </fieldset>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Document type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">File</label>
            <label className="flex flex-col items-center gap-2 border-2 border-dashed border-slate-200 hover:border-brand-teal/40 rounded-xl p-5 text-sm text-slate-600 cursor-pointer transition-colors bg-slate-50">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <Upload className="w-5 h-5 text-slate-400" />
              <span>{selectedFile ? selectedFile.name : "Tap to choose a file (PDF or image)"}</span>
            </label>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Annual checkup, Dr. Sharma's clinic"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal"
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={upload.isPending || !selectedFile}
            className="w-full h-11 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {upload.isPending ? "Uploading..." : "Save to Health Locker"}
          </button>
        </div>

        {/* Documents list */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 bg-white rounded-[2rem] border border-dashed border-slate-200 shadow-sm px-6">
            <span className="vita-peek mb-2">
              <span className="vita-peek-eagle block">
                <Eagle mood="wave" size={96} />
              </span>
            </span>
            <p className="text-sm text-slate-500">No documents saved yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">
            {documents.map((doc) => (
              <div key={doc.documentId} className="flex items-center gap-3 p-4 border-b border-slate-100 last:border-b-0">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <a
                  href={doc.storageUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1"
                >
                  <p className="text-sm font-semibold text-slate-900 truncate">{doc.fileName || doc.documentType || "Document"}</p>
                  <p className="text-[11px] text-slate-400">
                    {doc.documentType && <span>{doc.documentType} · </span>}
                    {formatDate(doc.uploadedAt)}
                  </p>
                  {visitLine(doc) && (
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 min-w-0">
                      <Stethoscope className="w-3 h-3 shrink-0" aria-hidden="true" /> <span className="truncate">{visitLine(doc)}</span>
                    </p>
                  )}
                  {members.length > 0 && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-teal-50 text-[11px] font-semibold text-brand-teal">
                      {doc.memberId ? <Users className="w-3 h-3" aria-hidden="true" /> : <User className="w-3 h-3" aria-hidden="true" />}
                      {nameOf(doc.memberId)?.fullName ?? "Me"}
                    </span>
                  )}
                </a>
                <button
                  onClick={() => handleDelete(doc.documentId)}
                  disabled={remove.isPending}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  aria-label="Delete document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
    </ProfileShell>
  );
}
