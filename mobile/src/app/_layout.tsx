import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
          <SessionProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </SessionProvider>
        </I18nProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, needsProfile } = useSession();
  const { ready, t } = useI18n();
  const loading = status === "loading" || !ready;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  const signedIn = status === "signedIn";
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.ink, fontWeight: "700" },
        headerTransparent: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      {/* 1. Not signed in: WhatsApp OTP only. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login/index" options={{ headerShown: false }} />
        <Stack.Screen name="login/otp" options={{ title: "" }} />
      </Stack.Protected>

      {/* 2. Signed in, short profile not saved yet: one "About you" screen. */}
      <Stack.Protected guard={signedIn && needsProfile}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>

      {/* 3. The app. */}
      <Stack.Protected guard={signedIn && !needsProfile}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="doctors" options={{ title: "" }} />
        <Stack.Screen name="doctor/[id]" options={{ title: "" }} />
        <Stack.Screen name="book/[id]" options={{ presentation: "modal", title: "" }} />
        <Stack.Screen name="reschedule/[id]" options={{ presentation: "modal", title: t("reschedule") }} />
        <Stack.Screen name="profile/about" options={{ title: t("personalInfo") }} />
        <Stack.Screen name="profile/family" options={{ title: t("family") }} />
        <Stack.Screen name="profile/member" options={{ presentation: "modal", title: "" }} />
        <Stack.Screen name="profile/language" options={{ title: t("language") }} />
      </Stack.Protected>
    </Stack>
  );
}
