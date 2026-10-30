"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderHeart, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { BLOOD_GROUPS } from "@/hooks/usePatientProfile";
import { RELATIONS, useFamilyMembers, type FamilyMember, type FamilyMemberInput } from "@/hooks/useFamilyMembers";

const FIELD = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20";
const LABEL = "block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const UNIT_LABEL = { Y: "Years", M: "Months", D: "Days" } as const;

const blankInput = (): FamilyMemberInput => ({ firstName: "", lastName: null, relation: "Son", age: null, ageUnit: "Y", sex: null, bloodGroup: null, allergies: null });
const toInput = (m: FamilyMember): FamilyMemberInput => ({
  firstName: m.firstName, lastName: m.lastName, relation: m.relation, age: m.age, ageUnit: m.ageUnit ?? (m.age != null ? "Y" : null),
  sex: m.sex, bloodGroup: m.bloodGroup, allergies: m.allergies,
});
const ageText = (m: FamilyMember) => (m.age != null ? `${m.age} ${UNIT_LABEL[m.ageUnit ?? "Y"]}` : null);

function MemberForm({ member, onDone }: { member?: FamilyMember; onDone: () => void }) {
  const { save } = useFamilyMembers(false);
  const [v, setV] = useState<FamilyMemberInput>(member ? toInput(member) : blankInput());
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FamilyMemberInput>(k: K, value: FamilyMemberInput[K]) => setV((x) => ({ ...x, [k]: value }));
  const blank = (s: string) => (s.trim() === "" ? null : s);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (v.firstName.trim() === "") return setError("Enter the first name.");
    if (v.age != null && (v.age < 0 || v.age > 120)) return setError("Age must be between 0 and 120.");
    setError(null);
    save.mutate(
      { memberId: member?.memberId, input: { ...v, firstName: v.firstName.trim(), lastName: v.lastName?.trim() || null, ageUnit: v.age != null ? v.ageUnit ?? "Y" : null } },
      { onSuccess: () => { toast.success(member ? "Saved." : "Family member added."); onDone(); }, onError: (err) => setError(err instanceof Error ? err.message : "Could not save. Try again.") },
    );
  };

  return (
    <form onSubmit={submit} noValidate aria-label={member ? "Edit family member" : "Add family member"} className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 p-5 sm:p-6 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fm-first" className={LABEL}>First name</label>
          <input id="fm-first" className={FIELD} value={v.firstName} maxLength={100} onChange={(e) => set("firstName", e.target.value)} />
        </div>
        <div>
          <label htmlFor="fm-last" className={LABEL}>Last name <span className="font-normal normal-case text-slate-400">(optional)</span></label>
          <input id="fm-last" className={FIELD} value={v.lastName ?? ""} maxLength={100} onChange={(e) => set("lastName", blank(e.target.value))} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fm-relation" className={LABEL}>Relation to you</label>
          <select id="fm-relation" className={FIELD} value={v.relation} onChange={(e) => set("relation", e.target.value)}>
            {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fm-sex" className={LABEL}>Sex</label>
          <select id="fm-sex" className={FIELD} value={v.sex ?? ""} onChange={(e) => set("sex", (e.target.value || null) as FamilyMemberInput["sex"])}>
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fm-age" className={LABEL}>Age</label>
          <div className="flex gap-2">
            <input id="fm-age" type="number" inputMode="numeric" min={0} max={120} className={FIELD} value={v.age ?? ""} onChange={(e) => set("age", e.target.value === "" ? null : Number(e.target.value))} />
            <select aria-label="Age unit" className={`${FIELD} w-32`} value={v.ageUnit ?? "Y"} onChange={(e) => set("ageUnit", e.target.value as FamilyMemberInput["ageUnit"])}>
              {Object.entries(UNIT_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="fm-blood" className={LABEL}>Blood group <span className="font-normal normal-case text-slate-400">(optional)</span></label>
          <select id="fm-blood" className={FIELD} value={v.bloodGroup ?? ""} onChange={(e) => set("bloodGroup", e.target.value || null)}>
            <option value="">Not sure</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="fm-allergies" className={LABEL}>Allergies <span className="font-normal normal-case text-slate-400">(optional)</span></label>
        <input id="fm-allergies" className={FIELD} value={v.allergies ?? ""} maxLength={500} placeholder="For example: peanuts, penicillin" onChange={(e) => set("allergies", blank(e.target.value))} />
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

function MemberCard({ m, onEdit }: { m: FamilyMember; onEdit: () => void }) {
  const { remove } = useFamilyMembers(false);
  const [confirming, setConfirming] = useState(false);
  const facts = [m.relation, ageText(m), m.sex, m.bloodGroup ? `Blood ${m.bloodGroup}` : null].filter(Boolean).join(" · ");

  const doRemove = () =>
    remove.mutate(m.memberId, {
      onSuccess: () => toast.success(`${m.firstName} was removed.`),
      onError: (err) => { setConfirming(false); toast.error(err instanceof Error ? err.message : "Could not remove. Try again."); },
    });

  return (
    <li className="p-5 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-teal-50 text-brand-teal flex items-center justify-center font-bold shrink-0" aria-hidden="true">{m.firstName.charAt(0).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 break-words">{m.fullName}</p>
          <p className="text-xs text-slate-500 mt-0.5">{facts}</p>
          {m.allergies && <p className="text-xs text-slate-500 mt-1">Allergies: {m.allergies}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Link href={`/profile/health-locker?member=${m.memberId}`} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-teal text-white text-xs font-bold hover:bg-teal-600 transition-colors">
              <FolderHeart className="w-4 h-4" aria-hidden="true" /> Health records{m.documentCount > 0 ? ` (${m.documentCount})` : ""}
            </Link>
            <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:border-brand-teal hover:text-brand-teal transition-colors">
              <Pencil className="w-4 h-4" aria-hidden="true" /> Edit
            </button>
            {!confirming ? (
              <button type="button" onClick={() => setConfirming(true)} aria-label={`Remove ${m.firstName}`} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <span role="alert" className="inline-flex items-center gap-2 text-xs text-slate-600">
                Remove {m.firstName}{m.documentCount > 0 ? ` and ${m.documentCount} record${m.documentCount === 1 ? "" : "s"}` : ""}?
                <button type="button" onClick={doRemove} disabled={remove.isPending} className="font-bold text-red-600 hover:underline disabled:opacity-60">{remove.isPending ? "Removing…" : "Yes, remove"}</button>
                <button type="button" onClick={() => setConfirming(false)} disabled={remove.isPending} className="font-bold text-slate-500 hover:underline">No</button>
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** The people this account looks after (a child, a parent...), each with their own health records in the Health Locker. */
export default function FamilyMembersPanel() {
  const { isLoggedIn } = usePatientAuth();
  const { members, max, isLoading } = useFamilyMembers(isLoggedIn);
  // "new" while adding, a member id while editing one, null otherwise
  const [open, setOpen] = useState<string | null>(null);
  const editing = members.find((m) => m.memberId === open);

  return (
    <section aria-labelledby="fm-title">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 id="fm-title" className="text-2xl font-display font-extrabold text-slate-900 tracking-tight mb-1">Family Members</h2>
          <p className="text-sm text-slate-500">Add your child or anyone you look after, and keep their health records in one place.</p>
        </div>
        {open === null && !isLoading && members.length < max && (
          <button type="button" onClick={() => setOpen("new")} className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:border-brand-teal hover:text-brand-teal transition-colors">
            <Plus className="w-4 h-4" aria-hidden="true" /> Add member
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-teal/20 border-t-brand-teal rounded-full animate-spin" /></div>
      ) : open === "new" ? (
        <MemberForm onDone={() => setOpen(null)} />
      ) : editing ? (
        <MemberForm member={editing} onDone={() => setOpen(null)} />
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-[2rem] border border-dashed border-slate-200 shadow-sm px-6">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-inner"><Users className="w-7 h-7 text-slate-300" /></div>
          <h3 className="font-display font-bold text-lg text-slate-900 mb-2">No family members yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mb-5">Add a child, parent or spouse to keep their prescriptions and reports together and find them quickly.</p>
          <button type="button" onClick={() => setOpen("new")} className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-bold text-sm hover:bg-teal-600 transition-colors">Add a family member</button>
        </div>
      ) : (
        <ul className="bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden">
          {members.map((m) => <MemberCard key={m.memberId} m={m} onEdit={() => setOpen(m.memberId)} />)}
        </ul>
      )}
    </section>
  );
}
