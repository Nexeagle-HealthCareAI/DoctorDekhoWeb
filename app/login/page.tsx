'use client';

import { useEffect, useState } from "react";
import { Smartphone, ArrowRight, ShieldCheck, RefreshCw, CalendarCheck, FolderHeart, MessageCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { usePatientAuth } from "@/hooks/usePatientAuth";
import { trackEvent } from "@/lib/analytics";
import PatientTopBar from "@/components/patient/PatientTopBar";
import { useRouter } from "next/navigation";

const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();
  const { sendOtp, verifyOtp, isLoggedIn } = usePatientAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    // If already logged in, redirect to profile immediately
    if (isLoggedIn) {
      router.replace("/profile");
    }
  }, [isLoggedIn, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    trackEvent("login_initiated");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSendOtp = async () => {
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setError(null);
    const res = await sendOtp.mutateAsync(phone);
    if (!res.success) {
      setError(res.message);
      return;
    }
    trackEvent("otp_sent", { mobile: phone });
    setOtp("");
    setStep("otp");
    setResendIn(RESEND_COOLDOWN_SECONDS);
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    void doSendOtp();
  };

  const handleVerifyOtp = async (val: string) => {
    setOtp(val);
    if (val.length !== 6) return;
    setError(null);
    const res = await verifyOtp.mutateAsync({ mobile: phone, otp: val });
    if (!res.success) {
      trackEvent("otp_verify_failed", { mobile: phone });
      setError(res.message);
      setOtp("");
      return;
    }
    trackEvent("otp_verified", { mobile: phone });
    router.push("/profile");
  };

  const isLoading = sendOtp.isPending || verifyOtp.isPending;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <PatientTopBar wide />

      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] items-center">
        {/* Why log in: the same teal card used across the site, shown beside the form on large screens */}
        <section className="hidden lg:block bg-gradient-to-br from-brand-teal to-emerald-600 rounded-3xl p-10 text-white shadow-xl">
          <h1 className="font-display text-4xl font-extrabold leading-tight mb-4 !text-white">Your health, in one place.</h1>
          <p className="text-teal-50 text-lg leading-relaxed mb-8 max-w-lg">
            Log in with your mobile number to see your appointments and records on any device. No password, just a code on WhatsApp.
          </p>
          <ul className="space-y-5">
            {[
              { Icon: CalendarCheck, title: "Your appointments", text: "Book, track and manage visits with doctors near you." },
              { Icon: FolderHeart, title: "Health Locker", text: "Keep prescriptions and reports together." },
              { Icon: MessageCircle, title: "Updates on WhatsApp", text: "Reminders and queue updates where you already chat." },
            ].map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="w-11 h-11 shrink-0 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center backdrop-blur-md"><Icon className="w-5 h-5" aria-hidden="true" /></span>
                <span><b className="block font-bold !text-white">{title}</b><span className="text-sm text-teal-50">{text}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-6" noValidate>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto border border-teal-100">
                  <Smartphone className="w-6 h-6 text-brand-teal" aria-hidden="true" />
                </div>
                <h2 className="font-display text-2xl font-extrabold text-slate-900">Log in or register</h2>
                <p className="text-sm text-slate-500">We send a one-time code on WhatsApp to this number. New here? You are registered when you confirm it.</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-mobile" className="block text-sm font-bold text-slate-800">WhatsApp number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">+91</span>
                  <input
                    id="login-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98765 43210"
                    aria-invalid={!!error}
                    className={cn(
                      "w-full pl-12 pr-4 py-3.5 bg-slate-50 border rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition",
                      error ? "border-red-300" : "border-slate-200 focus:border-brand-teal"
                    )}
                    autoFocus
                  />
                </div>
                {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading || phone.length !== 10}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-brand-teal text-white font-bold text-sm shadow-[0_4px_14px_0_rgba(20,184,166,0.3)] hover:bg-teal-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" aria-label="Sending" /> : <>Send code on WhatsApp <ArrowRight className="w-4 h-4" aria-hidden="true" /></>}
              </button>
              <p className="text-center text-xs text-slate-400">By continuing you agree to receive your login code and appointment updates on WhatsApp.</p>
            </form>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-sky-50 rounded-full flex items-center justify-center mx-auto border border-sky-100">
                  <ShieldCheck className="w-6 h-6 text-sky-500" aria-hidden="true" />
                </div>
                <h2 className="font-display text-2xl font-extrabold text-slate-900">Enter the code</h2>
                <p className="text-sm text-slate-500">Sent on WhatsApp to <b className="text-slate-700">+91 {phone}</b>.</p>
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={handleVerifyOtp} disabled={isLoading} autoFocus aria-label="6-digit code">
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && <p role="alert" className="text-center text-sm font-medium text-red-600">{error}</p>}
              {isLoading && (
                <p role="status" className="flex justify-center items-center gap-2 text-sm text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  {verifyOtp.isPending ? "Verifying…" : "Sending…"}
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                <button type="button" className="font-semibold text-slate-500 hover:text-brand-teal" onClick={() => { setStep("phone"); setError(null); }}>
                  Change number
                </button>
                {resendIn > 0 ? (
                  <span className="text-slate-400">Resend in {resendIn}s</span>
                ) : (
                  <button type="button" disabled={isLoading} className="font-semibold text-brand-teal hover:underline disabled:opacity-50" onClick={() => void doSendOtp()}>
                    Resend code
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
