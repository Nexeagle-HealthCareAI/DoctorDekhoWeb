import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTextStyle } from "../../lib/appearance";
import { useI18n } from "../../lib/i18n";
import { colors } from "../../lib/theme";

type IconName = "home" | "calendar" | "folder-open" | "person";

/** Icon inside a soft pill when its tab is active, so the current place reads at a glance. */
function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: string }) {
  return (
    <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: focused ? colors.primarySoft : "transparent" }}>
      <Ionicons name={focused ? name : (`${name}-outline` as const)} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useI18n();
  const ts = useTextStyle();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { ...ts(12, "600"), lineHeight: undefined, marginTop: 2 },
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: colors.card, height: 64 + insets.bottom, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabHome"), tabBarIcon: ({ color, focused }) => <TabIcon name="home" focused={focused} color={color as string} /> }} />
      <Tabs.Screen name="appointments" options={{ title: t("tabAppointments"), tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" focused={focused} color={color as string} /> }} />
      <Tabs.Screen name="records" options={{ title: t("tabRecords"), tabBarIcon: ({ color, focused }) => <TabIcon name="folder-open" focused={focused} color={color as string} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tabProfile"), tabBarIcon: ({ color, focused }) => <TabIcon name="person" focused={focused} color={color as string} /> }} />
    </Tabs>
  );
}
