import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTextStyle } from "../../lib/appearance";
import { useI18n } from "../../lib/i18n";
import { recoverInterruptedPick } from "../../lib/pendingPick";
import { colors } from "../../lib/theme";

type IconName = "home" | "map" | "calendar" | "folder-open" | "person";

/** Icon inside a soft pill when its tab is active, so the current place reads at a glance. */
function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: string }) {
  return (
    <View style={{ width: 52, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: focused ? colors.primarySoft : "transparent" }}>
      <Ionicons name={focused ? name : (`${name}-outline` as const)} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useI18n();
  const ts = useTextStyle();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // If Android closed the app while the camera or file picker was open for Records, go back there (with the photo, if Expo kept it).
  useEffect(() => {
    void recoverInterruptedPick().then((what) => {
      if (what === "photo") router.navigate({ pathname: "/records", params: { resume: "1" } });
      else if (what === "file") router.navigate({ pathname: "/records", params: { resume: "file" } });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { ...ts(12, "600"), lineHeight: undefined, marginTop: 2 },
        // A floating, rounded bar lifted off the bottom edge; solid, so it reads well on every phone and in Calm mode.
        tabBarStyle: {
          position: "relative",
          marginHorizontal: 12,
          marginBottom: insets.bottom + 8,
          height: 68,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: 26,
          borderTopWidth: 0,
          backgroundColor: colors.card,
          elevation: 8,
          shadowColor: "#10231F",
          shadowOpacity: 0.14,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabHome"), tabBarIcon: ({ color, focused }) => <TabIcon name="home" focused={focused} color={color as string} /> }} />
      <Tabs.Screen name="map" options={{ title: t("tabMap"), tabBarIcon: ({ color, focused }) => <TabIcon name="map" focused={focused} color={color as string} /> }} />
      <Tabs.Screen name="appointments" options={{ title: t("tabAppointments"), tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" focused={focused} color={color as string} /> }} />
      <Tabs.Screen name="records" options={{ title: t("tabRecords"), tabBarIcon: ({ color, focused }) => <TabIcon name="folder-open" focused={focused} color={color as string} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tabProfile"), tabBarIcon: ({ color, focused }) => <TabIcon name="person" focused={focused} color={color as string} /> }} />
    </Tabs>
  );
}
