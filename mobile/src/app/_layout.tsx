import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppearanceProvider, useAppearance } from "../lib/appearance";
import { SessionProvider, useSession } from "../lib/auth/session";
import { I18nProvider, useI18n } from "../lib/i18n";
import { colors } from "../lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, gcTime: 24 * 60 * 60 * 1000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

// Only the public doctor directory is kept on the phone between launches (for instant, offline-tolerant search).
// Personal data (profile, bookings, records) stays in memory and is fetched fresh, so nothing medical sits in plain storage.
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: "dd_query_cache" });

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000,
          buster: Constants.expoConfig?.version ?? "1",
          dehydrateOptions: { shouldDehydrateQuery: (q) => q.queryKey[0] === "doctors" && q.state.status === "success" },
        }}
      >
        <I18nProvider>
          <AppearanceProvider>
            <SessionProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </SessionProvider>
          </AppearanceProvider>
        </I18nProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, needsProfile } = useSession();
  const { ready } = useI18n();
  const { fontsReady } = useAppearance();
  // Fonts normally load in well under a second; never hold the splash longer than 3 s for them.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(id);
  }, []);
  const loading = status === "loading" || !ready || (!fontsReady && !fontTimeout);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  const signedIn = status === "signedIn";
  // Every screen draws its own top bar (back on the left, the Doctor Dekho logo on the right), so native headers are off.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* 1. Not signed in: WhatsApp OTP only. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login/index" />
        <Stack.Screen name="login/otp" />
      </Stack.Protected>

      {/* 2. Signed in, short profile not saved yet: one "About you" screen. */}
      <Stack.Protected guard={signedIn && needsProfile}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>

      {/* 3. The app. */}
      <Stack.Protected guard={signedIn && !needsProfile}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="doctors" />
        <Stack.Screen name="doctor/[id]" />
        <Stack.Screen name="book/[id]" options={{ presentation: "modal" }} />
        <Stack.Screen name="reschedule/[id]" options={{ presentation: "modal" }} />
        <Stack.Screen name="profile/about" />
        <Stack.Screen name="profile/family" />
        <Stack.Screen name="profile/member" options={{ presentation: "modal" }} />
        <Stack.Screen name="profile/language" />
      </Stack.Protected>
    </Stack>
  );
}
