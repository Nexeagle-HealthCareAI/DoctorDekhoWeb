import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Card, ListRow, Txt } from "../../components/ui";
import { saveAppProfile } from "../../lib/api/patient";
import { useSession } from "../../lib/auth/session";
import { config } from "../../lib/config";
import { syncDevice } from "../../lib/device";
import { useI18n } from "../../lib/i18n";
import { LOCALES } from "../../lib/i18n/types";
import { keys, useAppProfile, useFamily, useProfile } from "../../lib/queries";
import { colors, space } from "../../lib/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const { mobile, signOut } = useSession();
  const profile = useProfile();
  const app = useAppProfile();
  const family = useFamily();
  const [reminders, setReminders] = useState<boolean | null>(null);
  const remindersOn = reminders ?? app.data?.remindersOptIn ?? false;

  const p = profile.data;
  const name = [p?.firstName, p?.lastName].filter(Boolean).join(" ") || p?.fullName || "";
  const ageSex = [p?.age != null ? `${p.age}${p.ageUnit && p.ageUnit !== "Y" ? p.ageUnit.toLowerCase() : ""}` : "", p?.sex].filter(Boolean).join(" · ");
  const memberCount = family.data?.members?.length ?? 0;

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

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <Card onPress={() => router.push("/profile/about")} style={styles.me}>
        <View style={styles.avatar}>
          <Txt variant="title" color="#fff">
            {(name[0] ?? "?").toUpperCase()}
          </Txt>
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Txt variant="heading" numberOfLines={1}>
            {name || t("personalInfo")}
          </Txt>
          <Txt color={colors.muted}>{[mobile ? `+91 ${mobile}` : "", ageSex].filter(Boolean).join(" · ")}</Txt>
        </View>
      </Card>

      <View style={styles.group}>
        <ListRow icon="person" label={t("personalInfo")} onPress={() => router.push("/profile/about")} />
        <ListRow icon="people" label={t("family")} value={memberCount ? String(memberCount) : undefined} onPress={() => router.push("/profile/family")} />
        <ListRow icon="language" label={t("language")} value={LOCALES.find((l) => l.code === locale)?.nativeLabel} onPress={() => router.push("/profile/language")} />
      </View>

      <Card style={styles.switchRow}>
        <View style={{ flex: 1, marginRight: space.md }}>
          <Txt variant="bodyBold">{t("reminders")}</Txt>
          <Txt variant="small" color={colors.muted}>
            {t("remindersHint")}
          </Txt>
        </View>
        <Switch value={remindersOn} onValueChange={toggleReminders} trackColor={{ true: colors.primary, false: colors.line }} thumbColor="#fff" />
      </Card>

      <View style={styles.group}>
        <ListRow
          icon="logo-whatsapp"
          label={t("chatOnWhatsApp")}
          onPress={() => void Linking.openURL(`https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent("Hi Doctor Dekho")}`)}
        />
        <ListRow icon="mail" label={t("helpSupport")} value={config.supportEmail} onPress={() => void Linking.openURL(`mailto:${config.supportEmail}`)} />
        <ListRow icon="shield-checkmark" label={t("privacy")} onPress={() => void Linking.openURL(`${config.businessUrl}/privacy`)} />
        <ListRow icon="document-text" label={t("terms")} onPress={() => void Linking.openURL(`${config.businessUrl}/terms`)} />
      </View>

      <View style={styles.group}>
        <ListRow icon="log-out" label={t("signOut")} danger onPress={confirmSignOut} />
      </View>

      <Txt variant="tiny" color={colors.faint} style={{ textAlign: "center" }}>
        {t("appVersion", { version: Constants.expoConfig?.version ?? "1.0.0" })}
      </Txt>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  me: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  group: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  switchRow: { flexDirection: "row", alignItems: "center" },
});
