"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import PatientTopBar from "@/components/patient/PatientTopBar";
import ProfileShell from "@/components/patient/ProfileShell";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { useHealthLocker } from "@/hooks/useHealthLocker";
import { FileText, Upload, Trash2, LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";

const DOCUMENT_TYPES = ["Prescription", "Lab Report", "X-ray / Scan", "Discharge Summary", "Vaccination Record", "Other"];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function HealthLockerClient() {
  const { isLoggedIn, isLoading: authLoading } = usePatientAuth();
  const { documents, isLoading, upload, remove } = useHealthLocker(isLoggedIn);

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
    const result = await upload.mutateAsync({ file: selectedFile, documentType, notes: notes || undefined });
    if (result.success) {
      toast.success("Document saved to your Health Locker.");
      setSelectedFile(null);
      setNotes("");
      setDocumentType(DOCUMENT_TYPES[0]);
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
        <p className="text-sm text-slate-500 mb-6">
          Keep your prescriptions, lab reports, and other medical documents safe for future reference — from any visit, any hospital.
        </p>

        {/* Upload card */}
        <div className="bg-white rounded-3xl p-5 mb-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 space-y-4">
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
            <FileText className="w-7 h-7 text-slate-300 mb-3" />
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
