import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { configureHttp } from "../api/http";
import { deactivateDevice, getProfile, isShortProfileComplete, logoutOnServer } from "../api/patient";
import { getInstallationId, syncDevice } from "../device";

// The patient JWT lives in the Keychain (iOS) / Keystore (Android). Never in AsyncStorage.
const TOKEN_KEY = "dd_patient_token";
const MOBILE_KEY = "dd_patient_mobile";
// Remembered so an offline cold start goes straight to Home instead of re-asking for the profile.
const PROFILE_DONE_KEY = "dd_profile_complete";

type Status = "loading" | "signedOut" | "signedIn";

type SessionCtx = {
  status: Status;
  mobile: string | null;
  /** Signed in but the three-field "About you" profile is not saved yet. */
  needsProfile: boolean;
  signIn: (token: string, mobile: string) => Promise<void>;
  /** `serverRevoked`: the server already ended every session (account deleted) — just clear this phone. */
  signOut: (opts?: { serverRevoked?: boolean }) => Promise<void>;
  /** Call after the short profile is saved. */
  markProfileComplete: () => void;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [mobile, setMobile] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const clearLocal = useCallback(async () => {
    tokenRef.current = null;
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
      SecureStore.deleteItemAsync(MOBILE_KEY).catch(() => {}),
      AsyncStorage.removeItem(PROFILE_DONE_KEY).catch(() => {}),
    ]);
    qc.clear();
    setMobile(null);
    setNeedsProfile(false);
    setStatus("signedOut");
  }, [qc]);

  // Ask EasyHMS whether the shared profile is complete. Network trouble keeps the last known answer.
  const refreshProfileState = useCallback(async () => {
    try {
      const p = await getProfile();
      qc.setQueryData(["profile"], p);
      const done = isShortProfileComplete(p);
      setNeedsProfile(!done);
      await AsyncStorage.setItem(PROFILE_DONE_KEY, done ? "1" : "0").catch(() => {});
    } catch {
      // 401 is handled by onUnauthorized; offline keeps the cached flag.
    }
  }, [qc]);

  useEffect(() => {
    configureHttp({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        void clearLocal();
      },
    });
  }, [clearLocal]);

  // Cold start: restore the session from secure storage.
  useEffect(() => {
    (async () => {
      const [token, savedMobile, done] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
        SecureStore.getItemAsync(MOBILE_KEY).catch(() => null),
        AsyncStorage.getItem(PROFILE_DONE_KEY).catch(() => null),
      ]);
      if (!token || !savedMobile) {
        setStatus("signedOut");
        return;
      }
      tokenRef.current = token;
      setMobile(savedMobile);
      setNeedsProfile(done !== "1");
      setStatus("signedIn");
      void refreshProfileState();
      void syncDevice(false);
    })();
  }, [refreshProfileState]);

  const signIn = useCallback(
    async (token: string, m: string) => {
      tokenRef.current = token;
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(MOBILE_KEY, m);
      setMobile(m);
      // Decide the next screen before switching: a returning patient goes straight to Home.
      setNeedsProfile(true);
      await refreshProfileState();
      setStatus("signedIn");
      void syncDevice(false);
    },
    [refreshProfileState],
  );

  const signOut = useCallback(async (opts?: { serverRevoked?: boolean }) => {
    if (!opts?.serverRevoked) {
      const installationId = await getInstallationId();
      await deactivateDevice(installationId);
      await logoutOnServer();
    }
    await clearLocal();
  }, [clearLocal]);

  const markProfileComplete = useCallback(() => {
    setNeedsProfile(false);
    AsyncStorage.setItem(PROFILE_DONE_KEY, "1").catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ status, mobile, needsProfile, signIn, signOut, markProfileComplete }),
    [status, mobile, needsProfile, signIn, signOut, markProfileComplete],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
