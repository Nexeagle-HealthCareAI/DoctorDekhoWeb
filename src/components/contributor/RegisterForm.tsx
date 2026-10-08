"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { contributorApi } from "@/lib/contributor/client";
import { messageOf } from "@/lib/contributor/hooks";
import { ENROL_ROLE_LABEL, isDoctorRole, type ContributorMe, type EnrolRole, type RegisterInput } from "@/lib/contributor/types";
import { Banner, Field, card, input, primaryBtn } from "./ui";

const COUNCILS = [
  "National Medical Commission", "Andhra Pradesh Medical Council", "Bihar Medical Council", "Delhi Medical Council", "Gujarat Medical Council",
  "Karnataka Medical Council", "Kerala State Medical Council", "Maharashtra Medical Council", "Tamil Nadu Medical Council",
  "Uttar Pradesh Medical Council", "West Bengal Medical Council", "Other",
];
const SPECIALITIES = ["General Physician", "Cardiologist", "Endocrinologist", "Neurologist", "Paediatrician", "Gynaecologist", "Orthopaedic", "Dermatologist", "Psychiatrist", "Other"];
const MAX_PHOTO = 2 * 1024 * 1024;

interface Props {
  role: EnrolRole;
  defaultName?: string;
  onDone: (me: ContributorMe) => void;
}

type Errors = Partial<Record<keyof RegisterInput | "form", string>>;

export default function RegisterForm({ role, defaultName = "", onDone }: Props) {
  const doctor = isDoctorRole(role);
  const photoInput = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<RegisterInput>({
    fullName: defaultName, photoUrl: null, bio: "", speciality: "", qualification: "", registrationNumber: "", registrationCouncil: "",
    registrationYear: "", roleTitle: "", organisation: "", fieldOfWork: "", consent: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RegisterInput>(k: K, value: RegisterInput[K]) => setV((p) => ({ ...p, [k]: value }));

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setErrors((e) => ({ ...e, photoUrl: "Use a JPG, PNG or WebP photo." }));
    if (file.size > MAX_PHOTO) return setErrors((e) => ({ ...e, photoUrl: "That photo is over 2 MB." }));
    try {
      set("photoUrl", await contributorApi.uploadImage(file));
      setErrors((e) => ({ ...e, photoUrl: undefined }));
    } catch (e) {
      setErrors((x) => ({ ...x, photoUrl: messageOf(e) }));
    }
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!v.fullName.trim()) e.fullName = "Enter your full name.";
    if (doctor) {
      if (!v.registrationNumber.trim()) e.registrationNumber = "Registration number is required.";
      if (!v.registrationCouncil) e.registrationCouncil = "Choose the council.";
      if (v.registrationYear && !/^(19|20)\d{2}$/.test(v.registrationYear)) e.registrationYear = "Enter a 4-digit year.";
    } else if (!v.roleTitle.trim()) {
      e.roleTitle = "Enter your job title.";
    }
    if (!v.consent) e.consent = "Please tick this to continue.";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      onDone(await contributorApi.register(v));
    } catch (err) {
      setErrors({ form: messageOf(err) });
    } finally {
      setBusy(false);
    }
  };

  const publicFields = doctor ? "name, photo, speciality, qualifications, registration number and council, and bio" : "name, photo, job title, organisation and bio";

  return (
    <form onSubmit={submit} noValidate className={`${card} p-6 sm:p-8 max-w-xl w-full mx-auto space-y-5`}>
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">{doctor ? "Register as an independent doctor" : `Register as a ${ENROL_ROLE_LABEL[role].toLowerCase()}`}</h2>
        <p className="text-sm text-slate-500 mt-1">One time only. These details appear on the articles you write{doctor ? " or review" : ""}.</p>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => photoInput.current?.click()} aria-label="Choose a profile photo"
          className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0 hover:border-brand-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal">
          {v.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-6 h-6 text-slate-400" aria-hidden="true" />
          )}
        </button>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        <div>
          <p className="text-sm font-bold text-slate-800">Profile photo <span className="font-normal text-slate-400">(optional)</span></p>
          <p className="text-xs text-slate-500">JPG, PNG or WebP, up to 2 MB.</p>
          {errors.photoUrl && <p role="alert" className="text-xs font-medium text-red-600">{errors.photoUrl}</p>}
        </div>
      </div>

      <Field label="Full name" htmlFor="reg-name" error={errors.fullName}>
        <input id="reg-name" className={input} value={v.fullName} autoComplete="name" onChange={(e) => set("fullName", e.target.value)} />
      </Field>

      {doctor ? (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Speciality" htmlFor="reg-spec" optional>
              <select id="reg-spec" className={input} value={v.speciality} onChange={(e) => set("speciality", e.target.value)}>
                <option value="">Choose</option>{SPECIALITIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Qualifications" htmlFor="reg-qual" optional>
              <input id="reg-qual" className={input} placeholder="MBBS, MD" value={v.qualification} onChange={(e) => set("qualification", e.target.value)} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Medical registration number" htmlFor="reg-num" error={errors.registrationNumber}>
              <input id="reg-num" className={input} value={v.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
            </Field>
            <Field label="Registering council" htmlFor="reg-council" error={errors.registrationCouncil}>
              <select id="reg-council" className={input} value={v.registrationCouncil} onChange={(e) => set("registrationCouncil", e.target.value)}>
                <option value="">Choose council</option>{COUNCILS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Year of registration" htmlFor="reg-year" error={errors.registrationYear} optional>
            <input id="reg-year" className={`${input} max-w-[10rem]`} inputMode="numeric" placeholder="2009" value={v.registrationYear} onChange={(e) => set("registrationYear", e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Job title" htmlFor="reg-title" error={errors.roleTitle} hint="For example: community health worker, product manager.">
            <input id="reg-title" className={input} value={v.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} />
          </Field>
          <Field label="Organisation" htmlFor="reg-org" optional>
            <input id="reg-org" className={input} value={v.organisation} onChange={(e) => set("organisation", e.target.value)} />
          </Field>
          {role === "WRITER" && (
            <Field label="Field of work in health" htmlFor="reg-field" optional hint="For example: health technology, hospital operations, policy.">
              <input id="reg-field" className={input} value={v.fieldOfWork} onChange={(e) => set("fieldOfWork", e.target.value)} />
            </Field>
          )}
        </>
      )}

      <Field label="Short bio" htmlFor="reg-bio" optional>
        <textarea id="reg-bio" rows={3} maxLength={500} className={input} placeholder="Two lines about your work." value={v.bio} onChange={(e) => set("bio", e.target.value)} />
      </Field>

      <Banner tone="warn">
        {doctor
          ? "Our team checks your registration on the NMC register, usually within one working day. You can read and prepare drafts meanwhile, but your name and badge go live only after it is verified."
          : "Our team approves new profiles, usually within one working day. You can prepare drafts meanwhile and submit them after approval."}
      </Banner>

      <div className="space-y-1">
        <label className="flex gap-3 items-start cursor-pointer text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[hsl(var(--brand-teal))]" checked={v.consent} onChange={(e) => set("consent", e.target.checked)} />
          <span>I confirm these details are correct, and I allow NexEagle to show my {publicFields} on articles I {doctor ? "review or " : ""}write. My mobile number is never shown.</span>
        </label>
        {errors.consent && <p role="alert" className="text-xs font-medium text-red-600 pl-7">{errors.consent}</p>}
      </div>

      {errors.form && <p role="alert" className="text-sm font-medium text-red-600">{errors.form}</p>}
      <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>{busy ? "Creating your profile…" : "Create my profile"}</button>
    </form>
  );
}
