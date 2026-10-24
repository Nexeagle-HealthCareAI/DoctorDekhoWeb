import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Button, Card, ListGroup, ListRow, Logo, ToggleRow, Txt } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { deleteAccount, saveAppProfile } from "../../lib/api/patient";
import { useAppearance } from "../../lib/appearance";
import { useSession } from "../../lib/auth/session";
import { relationLabel } from "../../lib/booking";
import { config } from "../../lib/config";
import { syncDevice } from "../../lib/device";
import { useI18n } from "../../lib/i18n";
import { LOCALES } from "../../lib/i18n/types";
import { keys, useAppProfile, useFamily, useProfile } from "../../lib/queries";
import { contactSupport } from "../../lib/support";
import { colors, space, TINT_ORDER } from "../../lib/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const { mobile, signOut } = useSession();
  const profile = useProfile();
  const app = useAppProfile();
  const family = useFamily();
  const [reminders, setReminders] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { bigText, setBigText } = useAppearance();
  const remindersOn = reminders ?? app.data?.remindersOptIn ?? false;

  const p = profile.data;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ") || p?.fullName || "";
  const ageSex = [p?.age != null ? `${p.age}${p.ageUnit && p.ageUnit !== "Y" ? p.ageUnit.toLowerCase() : ""}` : "", p?.sex].filter(Boolean).join(" · ");

  async function toggleReminders(on: boolean) {
    setReminders(on);
    const saved = await saveAppProfile({ remindersOptIn: on }).catch(() => null);
    if (saved) qc.setQueryData(keys.appProfile, saved);
    if (on) void syncDevice(true);
  }

  function confirmSignOut() {
    Alert.alert(t("signOut"), t("signOutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("signOut"), style: "destructive", onPress: () => void signOut() },
    ]);
  }

  // Two steps on purpose: the row, then a sheet that says exactly what goes and what stays.
  function confirmDelete() {
    Alert.alert(t("deleteAccount"), t("deleteAccountConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("deleteAccountFinal"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteAccount();
            await signOut({ serverRevoked: true });
          } catch (e) {
            const tooMany = e instanceof ApiError && e.status === 429;
            Alert.alert(t("deleteAccount"), tooMany ? (e as ApiError).message : t("deleteAccountFailed"));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  const members = family.data?.members ?? [];
  const max = family.data?.max ?? 10;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ alignItems: "flex-end" }}>
          <Logo height={30} />
        </View>

        <View style={styles.me}>
          <Avatar initials={(name[0] ?? "?").toUpperCase()} size={64} tint="teal" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="title" numberOfLines={1} style={{ fontSize: 22 }}>
              {name || t("personalInfo")}
            </Txt>
            <Txt variant="small" color={colors.muted} numberOfLines={2}>
              {[mobile ? `+91 ${mobile}` : "", ageSex].filter(Boolean).join(" · ")}
            </Txt>
          </View>
          <Button label={t("edit")} variant="secondary" size="sm" onPress={() => router.push("/profile/about")} />
        </View>

        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.sm }}>
            <Txt variant="subheading">{t("family")}</Txt>
            <Pressable onPress={() => router.push("/profile/family")} hitSlop={10} accessibilityRole="button">
              <Txt variant="smallBold" color={colors.primary}>
                {t("manage")}
              </Txt>
            </Pressable>
          </View>
          <Txt variant="small" color={colors.muted} style={{ marginTop: -space.sm, fontSize: 13 }}>
            {t("familyHint")}
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
            {members.map((m, i) => (
              <Pressable key={m.memberId} onPress={() => router.push({ pathname: "/profile/member", params: { id: m.memberId } })} accessibilityRole="button" style={styles.member}>
                <Avatar initials={(m.firstName[0] ?? "?").toUpperCase()} tint={TINT_ORDER[(i + 1) % TINT_ORDER.length]} size={56} />
                <Txt variant="smallBold" numberOfLines={1}>
                  {m.firstName}
                </Txt>
                <Txt variant="tiny" color={colors.muted} numberOfLines={1}>
                  {relationLabel(t, m.relation)}
                </Txt>
              </Pressable>
            ))}
            {members.length < max ? (
              <Pressable onPress={() => router.push("/profile/member")} accessibilityRole="button" accessibilityLabel={t("addMember")} style={styles.member}>
                <View style={styles.addCircle}>
                  <Ionicons name="add" size={24} color={colors.primary} />
                </View>
                <Txt variant="smallBold" color={colors.primary}>
                  {t("add")}
                </Txt>
              </Pressable>
            ) : null}
          </ScrollView>
        </Card>

        <ListGroup>
          <ListRow first icon="language-outline" label={t("language")} value={LOCALES.find((l) => l.code === locale)?.nativeLabel} onPress={() => router.push("/profile/language")} />
          <ToggleRow icon="notifications-outline" label={t("visitReminders")} value={remindersOn} onChange={toggleReminders} />
          <ToggleRow icon="text-outline" label={t("biggerText")} value={bigText} onChange={setBigText} />
          <ListRow icon="logo-whatsapp" label={t("helpOnWhatsApp")} onPress={() => contactSupport("whatsapp", t("helpMessage"))} />
          <ListRow icon="call-outline" label={t("callUs")} onPress={() => contactSupport("call")} />
          <ListRow icon="shield-checkmark-outline" label={t("privacy")} onPress={() => void Linking.openURL(`${config.businessUrl}/privacy`)} />
          <ListRow icon="document-text-outline" label={t("terms")} onPress={() => void Linking.openURL(`${config.businessUrl}/terms`)} />
        </ListGroup>

        <ListGroup>
          <ListRow first icon="log-out-outline" label={t("signOut")} onPress={confirmSignOut} />
          <ListRow icon="trash-outline" label={deleting ? t("loading") : t("deleteAccount")} danger onPress={deleting ? undefined : confirmDelete} />
        </ListGroup>

        <Txt variant="tiny" color={colors.muted} center>
          {t("appVersion", { version: Constants.expoConfig?.version ?? "1.0.0" })}
        </Txt>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: space.md, gap: space.lg, paddingBottom: space.xxl },
  me: { flexDirection: "row", alignItems: "center", gap: space.md + 2, paddingHorizontal: 4 },
  member: { width: 72, alignItems: "center", gap: 4 },
  addCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#9FB0A8", alignItems: "center", justifyContent: "center" },
});
