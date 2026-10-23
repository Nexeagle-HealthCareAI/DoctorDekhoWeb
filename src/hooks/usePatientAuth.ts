"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface PatientAppointment {
  appointmentId: string;
  doctorName: string;
  hospitalName: string;
  apptDate: string;
  startAt: string;
  status: string;
  statusCode: string;
}

interface MineResponse {
  loggedIn: boolean;
  mobile?: string;
  appointments?: PatientAppointment[];
  notConfigured?: boolean;
}

const MINE_QUERY_KEY = ["patient-auth", "mine"];

async function fetchMine(): Promise<MineResponse> {
  const res = await fetch("/api/public/appointments/mine");
  // 401 just means "not logged in" here — not an error state, the route always returns JSON.
  // Any other failure (rate limit, a deploy in progress) says nothing about the login: throw, so the query keeps the last known
  // state instead of showing a signed-in patient as signed out.
  if (!res.ok && res.status !== 401) throw new Error(`login check failed (${res.status})`);
  return res.json();
}

/** The patient's own login state + appointment list. The JWT itself lives in an httpOnly cookie
 * (see patientSession.ts) and is never exposed to this hook or any client code — "logged in" is
 * simply "does GET /api/public/appointments/mine currently return loggedIn: true". */
export function usePatientAuth() {
  const queryClient = useQueryClient();
  // The query cache is restored from localStorage in the browser but is empty on the server, so on the first client render the login
  // state could already be known while the server's HTML was drawn without it (React hydration errors #418/#423). Until mounted,
  // both sides report "still checking", which is what the server draws; the real state follows one tick later.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const mine = useQuery({
    queryKey: MINE_QUERY_KEY,
    queryFn: fetchMine,
    staleTime: 30_000,
    retry: false,
  });

  const sendOtp = useMutation({
    mutationFn: async (mobile: string) => {
      const res = await fetch("/api/patient-auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: mobile }),
      });
      const data = (await res.json()) as { success: boolean; message: string; devCode?: string };
      // Only a Development server ever sends this back (instead of a WhatsApp message), so on any other server nothing is shown.
      if (data.success && data.devCode) toast.info(`Dev only: your OTP is ${data.devCode}`, { duration: 180_000 });
      return data;
    },
  });

  const verifyOtp = useMutation({
    mutationFn: async (vars: { mobile: string; otp: string }) => {
      const res = await fetch("/api/patient-auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: vars.mobile, otp: vars.otp }),
      });
      return (await res.json()) as { success: boolean; message: string };
    },
    // Awaited (not fire-and-forget) — mutateAsync only resolves once onSuccess finishes, so
    // callers that close the login UI right after awaiting verifyOtp (see PhoneVerification's
    // onVerified) don't render a "not logged in" flash before the fresh session data lands.
    onSuccess: async (data) => {
      if (data.success) await queryClient.invalidateQueries({ queryKey: MINE_QUERY_KEY });
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/patient-auth/logout", { method: "POST" });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MINE_QUERY_KEY });
    },
  });

  return {
    isLoggedIn: mounted && mine.data?.loggedIn === true,
    mobile: mounted ? mine.data?.mobile ?? null : null,
    appointments: mounted ? mine.data?.appointments ?? [] : [],
    isLoading: mine.isLoading || !mounted,
    notConfigured: mine.data?.notConfigured === true,
    refetch: mine.refetch,
    sendOtp,
    verifyOtp,
    logout,
  };
}
