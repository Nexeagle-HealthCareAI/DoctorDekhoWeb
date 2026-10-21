import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useI18n } from "../../lib/i18n";
import { colors } from "../../lib/theme";

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: { borderTopColor: colors.line, minHeight: 60 },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.ink, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t("tabHome"), headerShown: false, tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="appointments"
        options={{ title: t("tabAppointments"), tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="records"
        options={{ title: t("tabRecords"), tabBarIcon: ({ color, size }) => <Ionicons name="folder-open" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("tabProfile"), tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
