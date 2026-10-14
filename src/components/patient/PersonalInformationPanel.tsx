"use client";

import { useState } from "react";
import { Cake, Mail, Pencil, User, Users } from "lucide-react";
import { toast } from "sonner";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { usePatientProfile, useSavePatientProfile, type PatientProfile, type PatientProfileInput } from "@/hooks/usePatientProfile";

const FIELD = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20";
const LABEL = "block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const UNIT_LABEL = { Y: "Years", M: "Months", D: "Days" } as const;

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 p-5 border-b border-slate-100 last:border-b-0">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">{icon}</div>
      <div className="min-w-0">
        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="block font-semibold text-slate-900 text-sm break-words">{value}</span>
      </div>
    </div>
  );
}

const asInput = (p?: PatientProfile): PatientProfileInput => ({
  fullName: p?.fullName ?? "",
  age: p?.age ?? null,
  ageUnit: (p?.ageUnit as PatientProfileInput["ageUnit"]) ?? (p?.age != null ? "Y" : null),
  sex: (p?.sex as PatientProfileInput["sex"]) ?? null,
  email: p?.email ?? null,
  guardianName: p?.guardianName ?? null,
  guardianRelation: p?.guardianRelation ?? null,
});

function EditForm({ initial, onDone }: { initial: PatientProfileInput; onDone: () => void }) {
  const save = useSavePatientProfile();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PatientProfileInput>(k: K, value: PatientProfileInput[K]) => setV((x) => ({ ...x, [k]: value }));
  const blank = (s: string) => (s.trim() === "" ? null : s);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (v.fullName.trim().length < 2) return setError("Enter your full name.");
    if (v.age != null && (v.age < 0 || v.age > 120)) return setError("Age must be between 0 and 120.");
    setError(null);
    save.mutate(
      { ...v, fullName: v.fullName.trim(), ageUnit: v.age != null ? v.ageUnit ?? "Y" : null },
      { onSuccess: () => { toast.success("Your details are saved."); onDone(); }, onError: (err) => setError(err instanceof Error ? err.message : "Could not save. Try again.") },
    );
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Edit personal information" className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 p-5 sm:p-6 space-y-5">
      <div>
        <label htmlFor="pi-name" className={LABEL}>Full name</label>
        <input id="pi-name" className={FIELD} value={v.fullName} maxLength={200} autoComplete="name" onChange={(e) => set("fullName", e.target.value)} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pi-age" className={LABEL}>Age</label>
          <div className="flex gap-2">
            <input id="pi-age" type="number" inputMode="numeric" min={0} max={120} className={FIELD} value={v.age ?? ""} onChange={(e) => set("age", e.target.value === "" ? null : Number(e.target.value))} />
            <select aria-label="Age unit" className={`${FIELD} w-32`} value={v.ageUnit ?? "Y"} onChange={(e) => set("ageUnit", e.target.value as PatientProfileInput["ageUnit"])}>
              {Object.entries(UNIT_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="pi-sex" className={LABEL}>Sex</label>
          <select id="pi-sex" className={FIELD} value={v.sex ?? ""} onChange={(e) => set("sex", (e.target.value || null) as PatientProfileInput["sex"])}>
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="pi-email" className={LABEL}>Email <span className="font-normal normal-case text-slate-400">(optional)</span></label>
        <input id="pi-email" type="email" className={FIELD} value={v.email ?? ""} maxLength={200} autoComplete="email" onChange={(e) => set("email", blank(e.target.value))} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="pi-guardian" className={LABEL}>Guardian <span className="font-normal normal-case text-slate-400">(optional)</span></label>
          <input id="pi-guardian" className={FIELD} value={v.guardianName ?? ""} maxLength={200} onChange={(e) => set("guardianName", blank(e.target.value))} />
        </div>
        <div>
          <label htmlFor="pi-relation" className={LABEL}>Relation <span className="font-normal normal-case text-slate-400">(optional)</span></label>
          <input id="pi-relation" className={FIELD} value={v.guardianRelation ?? ""} maxLength={50} placeholder="For example: father" onChange={(e) => set("guardianRelation", blank(e.target.value))} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-teal-600 disabled:opacity-60 transition-colors">
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} disabled={save.isPending} className="px-6 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

/** The person's own details, with Edit and Save. Shown on its own page and, on large screens, as the profile page's first section. */
export default function PersonalInformationPanel() {
  const { isLoggedIn } = usePatientAuth();
  const { data: profile, isLoading } = usePatientProfile(isLoggedIn);
  const [editing, setEditing] = useState(false);
  const hasDetails = !!profile?.fullName;
  const ageSex = [profile?.age != null ? `${profile.age} ${profile.ageUnit ? UNIT_LABEL[profile.ageUnit as keyof typeof UNIT_LABEL] ?? profile.ageUnit : "Years"}` : null, profile?.sex].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="pi-title">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 id="pi-title" className="text-2xl font-display font-extrabold text-slate-900 tracking-tight mb-1">Personal Information</h2>
          <p className="text-sm text-slate-500">Your basic details. You can change them any time.</p>
        </div>
        {!editing && !isLoading && (
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:border-brand-teal hover:text-brand-teal transition-colors">
            <Pencil className="w-4 h-4" aria-hidden="true" /> {hasDetails ? "Edit" : "Add details"}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" />
        </div>
      ) : editing ? (
        <EditForm initial={asInput(profile)} onDone={() => setEditing(false)} />
      ) : !hasDetails ? (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 shadow-sm px-6">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
            <User className="w-7 h-7 text-slate-300" />
          </div>
          <h3 className="font-display font-bold text-lg text-slate-900 mb-2">Nothing on file yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-5">Add your name and a few details. They are filled in for you when you book.</p>
          <button type="button" onClick={() => setEditing(true)} className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-bold text-sm hover:bg-teal-600 transition-colors">Add details</button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">
            <Row icon={<User className="w-5 h-5" />} label="Full Name" value={profile!.fullName!} />
            {ageSex && <Row icon={<Cake className="w-5 h-5" />} label="Age / Sex" value={ageSex} />}
            {profile!.email && <Row icon={<Mail className="w-5 h-5" />} label="Email" value={profile!.email} />}
            {profile!.guardianName && (
              <Row icon={<Users className="w-5 h-5" />} label="Guardian" value={`${profile!.guardianRelation ? profile!.guardianRelation + " " : ""}${profile!.guardianName}`} />
            )}
          </div>
          <p className="text-xs text-slate-400 mt-5 max-w-md">
            {profile!.source === "BOOKING"
              ? "These come from your latest booking. Press Edit and Save to keep your own copy on this account."
              : "Saved on your Doctor Dekho account. Hospitals keep their own records of your visits; changing these does not change them."}
          </p>
        </>
      )}
    </section>
  );
}
