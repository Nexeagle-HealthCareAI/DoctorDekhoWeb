"use client";

import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { contributorApi } from "@/lib/contributor/client";
import { messageOf } from "@/lib/contributor/hooks";
import type { EnrolRole } from "@/lib/contributor/types";
import { cn } from "@/lib/utils";
import { card, primaryBtn } from "./ui";

const RESEND_SECONDS = 30;

interface Props {
  /** Set when the person came from an invitation link: the code only goes to the number it was sent to. */
  inviteToken?: string | null;
  /** The role chosen on the join page. */
  role?: EnrolRole | null;
  title?: string;
  /** Called after the code is accepted. `needsRegistration` is true for a number we have no profile for. */
  onVerified: (needsRegistration: boolean) => void;
}

export default function OtpStep({ inviteToken, role, title = "Confirm it is you", onVerified }: Props) {
  const [phase, setPhase] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const send = async () => {
    if (mobile.length !== 10) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await contributorApi.sendOtp(mobile, inviteToken);
      setDemoCode(r.devCode ?? null);
      setCode("");
      setPhase("code");
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    setCode(value);
    if (value.length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      const r = await contributorApi.verifyOtp(mobile, value, { inviteToken, role });
      onVerified(r.needsRegistration);
    } catch (e) {
      setError(messageOf(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn(card, "p-6 sm:p-8 max-w-md w-full mx-auto")}>
      {phase === "mobile" ? (
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto border border-teal-100"><Smartphone className="w-6 h-6 text-brand-teal" aria-hidden="true" /></div>
            <h2 className="text-xl font-display font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">We send a 6-digit code on WhatsApp to your mobile number.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="otp-mobile" className="block text-sm font-bold text-slate-800">WhatsApp number</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">+91</span>
              <input
                id="otp-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="98765 43210" aria-invalid={!!error}
                className={cn("w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-brand-teal/20", error ? "border-red-300" : "border-slate-200 focus:border-brand-teal")}
              />
            </div>
            {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
          </div>
          <button type="submit" disabled={busy || mobile.length !== 10} className={cn(primaryBtn, "w-full py-3.5")}>
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" aria-label="Sending" /> : <>Send code on WhatsApp <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-sky-50 rounded-full flex items-center justify-center mx-auto border border-sky-100"><ShieldCheck className="w-6 h-6 text-sky-500" aria-hidden="true" /></div>
            <h2 className="text-xl font-display font-bold text-slate-900">Enter the code</h2>
            <p className="text-sm text-slate-500">Sent on WhatsApp to <b className="text-slate-700">+91 {mobile}</b>. It works for 10 minutes.</p>
          </div>
          {demoCode && <p className="text-center text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 py-2">Demo only: your code is <b>{demoCode}</b></p>}
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={verify} disabled={busy} autoFocus aria-label="6-digit code">
              <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
            </InputOTP>
          </div>
          {error && <p role="alert" className="text-center text-sm font-medium text-red-600">{error}</p>}
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="font-semibold text-slate-500 hover:text-brand-teal" onClick={() => { setPhase("mobile"); setError(null); }}>Change number</button>
            {resendIn > 0 ? (
              <span className="text-slate-400">Resend in {resendIn}s</span>
            ) : (
              <button type="button" disabled={busy} className="font-semibold text-brand-teal hover:underline" onClick={() => void send()}>Resend code</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
