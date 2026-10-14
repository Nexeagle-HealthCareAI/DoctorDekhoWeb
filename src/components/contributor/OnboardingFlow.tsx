"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, Stethoscope, User as UserRound, Laptop } from "lucide-react";
import { ApiError, contributorApi } from "@/lib/contributor/client";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { ENROL_ROLE_LABEL, type EnrolRole } from "@/lib/contributor/types";
import { cn } from "@/lib/utils";
import OtpStep from "./OtpStep";
import RegisterForm from "./RegisterForm";
import { card, primaryBtn } from "./ui";

const ROLES: { role: EnrolRole; Icon: typeof Stethoscope; blurb: string; can: string }[] = [
  { role: "INDEPENDENT_DOCTOR", Icon: Stethoscope, blurb: "A registered doctor who does not work through EasyHMS.", can: "Review articles, write articles and suggest topics. Your registration is checked before your badge shows." },
  { role: "HEALTH_WORKER", Icon: UserRound, blurb: "Nurse, pharmacist, lab technician, community health worker and similar.", can: "Write updates about the health sector and suggest topics." },
  { role: "WRITER", Icon: Laptop, blurb: "Writer or technologist working on health, technology or policy.", can: "Write updates about the health sector and suggest topics." },
];

type Step = "role" | "otp" | "register";

interface Props {
  /** Present when the person opened an invitation link. */
  inviteToken?: string | null;
  /** The role fixed by an invitation. Without one, the person picks. */
  fixedRole?: EnrolRole | null;
  defaultName?: string;
}

/** Choose a role (self-enrolment only), confirm the mobile number, then register. */
export default function OnboardingFlow({ inviteToken, fixedRole, defaultName }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<EnrolRole | null>(fixedRole ?? null);
  const [step, setStep] = useState<Step>(fixedRole ? "otp" : "role");
  const [existingRole, setExistingRole] = useState<EnrolRole | null>(null);
  // Signed in on Doctor Dekho already (the number was proven with a WhatsApp code), so the Health Wiki does not ask for another one.
  const { isLoggedIn } = usePatientAuth();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const continueFromRole = async () => {
    if (!role) return;
    if (!isLoggedIn || inviteToken) return setStep("otp");
    setJoining(true);
    setJoinError(null);
    try {
      const r = await contributorApi.sessionFromPatient(role);
      router.replace(r.needsRegistration ? "/contribute/register" : "/contribute");
    } catch (e) {
      // No usable patient login after all: fall back to the code.
      if (e instanceof ApiError && e.status === 401) setStep("otp");
      else setJoinError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setJoining(false);
    }
  };

  // A number that already has an account keeps the role it was created with, whichever one was just picked. The profile form must
  // follow the account (a doctor needs a registration number, a writer does not), so ask who this is once the code is confirmed.
  const afterVerified = async (needsRegistration: boolean) => {
    if (!needsRegistration) return router.replace("/contribute");
    try {
      const me = await contributorApi.me();
      // A hospital doctor never joins here: they come from EasyHMS.
      if (me.role === "HOSPITAL_DOCTOR") return router.replace("/contribute");
      if (role && me.role !== role) setExistingRole(me.role);
      setRole(me.role);
    } catch {
      /* keep the role picked; the server still checks the form */
    }
    setStep("register");
  };

  const steps = fixedRole ? ["Confirm number", "Your profile"] : ["Your role", "Confirm number", "Your profile"];
  const index = fixedRole ? (step === "otp" ? 0 : 1) : step === "role" ? 0 : step === "otp" ? 1 : 2;

  return (
    <div className="space-y-6">
      <ol className="flex items-center justify-center gap-3 text-xs font-bold text-slate-400" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === index ? "step" : undefined} className={cn("flex items-center gap-2", i === index && "text-brand-teal", i < index && "text-slate-500")}>
            <span className={cn("w-5 h-5 rounded-full grid place-items-center text-[11px]", i < index ? "bg-brand-teal text-white" : i === index ? "bg-brand-teal/15 text-brand-teal" : "bg-slate-100")}>
              {i < index ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
            </span>
            {s}{i < steps.length - 1 && <span className="w-6 h-px bg-slate-200" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step === "role" && (
        <div className={`${card} p-6 sm:p-8 max-w-2xl mx-auto`}>
          <h2 className="font-display text-xl font-bold text-slate-900 mb-1">How do you want to take part?</h2>
          <p className="text-sm text-slate-500 mb-5">Pick the one that fits you best.</p>
          <div role="radiogroup" aria-label="Your role" className="grid gap-3">
            {ROLES.map(({ role: r, Icon, blurb, can }) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} onClick={() => setRole(r)}
                className={cn("text-left rounded-2xl border p-4 flex gap-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal", role === r ? "border-brand-teal bg-teal-50/50" : "border-slate-200 hover:border-brand-teal/40")}>
                <Icon className="w-6 h-6 text-brand-teal shrink-0 mt-0.5" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-bold text-slate-900">{ENROL_ROLE_LABEL[r]}</span>
                  <span className="block text-sm text-slate-600">{blurb}</span>
                  <span className="block text-xs text-slate-500 mt-1">{can}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="flex gap-2 items-start text-xs text-slate-500 mt-5"><ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" /> Your name, photo and profession can appear on articles. Your mobile number never does.</p>
          {joinError && <p role="alert" className="text-sm font-medium text-red-600 mt-4">{joinError}</p>}
          <button type="button" disabled={!role || joining} onClick={() => void continueFromRole()} className={`${primaryBtn} w-full mt-5`}>{joining ? "Please wait…" : "Continue"}</button>
        </div>
      )}

      {step === "otp" && (
        <OtpStep inviteToken={inviteToken} role={role} onVerified={afterVerified} />
      )}

      {step === "register" && existingRole && (
        <p role="status" className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">
          This number is already set up as {ENROL_ROLE_LABEL[existingRole].toLowerCase()}, so we are asking for those details.
        </p>
      )}

      {step === "register" && role && <RegisterForm role={role} defaultName={defaultName} onDone={() => router.replace("/contribute")} />}
    </div>
  );
}
