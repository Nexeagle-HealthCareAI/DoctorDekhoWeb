import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../components/DoctorCard";
import { Button, Card, EmptyState, Loading, Txt, type IconName } from "../../components/ui";
import { effectiveFee } from "../../lib/api/doctors";
import { config } from "../../lib/config";
import { rupees } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { useDoctor } from "../../lib/queries";
import { specialtyName } from "../../lib/specialties";
import { colors, radius, space } from "../../lib/theme";

export default function DoctorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const q = useDoctor(id);
  const d = q.data;

  if (q.isLoading && !d) return <Loading />;
  if (!d)
    return (
      <EmptyState icon="person-remove" title={t("doctorNotFound")} action={t("findDoctor")} onAction={() => router.replace("/doctors")} />
    );

  const fee = effectiveFee(d);
  const place = [d.hospitalName, d.address, d.city].filter(Boolean).join(", ");

  function directions() {
    const target = d!.latitude != null && d!.longitude != null ? `${d!.latitude},${d!.longitude}` : encodeURIComponent(place);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${target}`);
  }
  function call() {
    if (d!.hospitalPhone) void Linking.openURL(`tel:${d!.hospitalPhone.replace(/[^\d+]/g, "")}`);
  }
  function share() {
    const url = `${config.siteUrl}/doctor/${d!.id}`;
    void Share.share(Platform.OS === "ios" ? { url, message: d!.name } : { message: `${d!.name} — ${specialtyName(d!.specialtyId, locale)}\n${url}` });
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Avatar doctor={d} size={88} />
          <Txt variant="title" style={{ marginTop: space.md, textAlign: "center" }}>
            {d.name}
          </Txt>
          <Txt color={colors.muted} style={{ textAlign: "center" }}>
            {[specialtyName(d.specialtyId, locale), d.qualifications].filter(Boolean).join(" · ")}
          </Txt>
          <View style={styles.badges}>
            {d.verified ? <Badge icon="shield-checkmark" text={t("verified")} /> : null}
            {d.experienceYears ? <Badge icon="ribbon" text={t("experience", { years: d.experienceYears })} /> : null}
            {d.rating ? <Badge icon="star" text={`${d.rating.toFixed(1)}${d.reviewCount ? ` · ${t("reviews", { count: d.reviewCount })}` : ""}`} /> : null}
          </View>
          {d.isAvailableToday != null ? (
            <Txt variant="smallBold" color={d.isAvailableToday ? colors.success : colors.muted} style={{ marginTop: space.sm }}>
              {d.isAvailableToday ? t("availableToday") : t("notAvailableToday")}
            </Txt>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Action icon="navigate" label={t("directions")} onPress={directions} />
          {d.hospitalPhone ? <Action icon="call" label={t("call")} onPress={call} /> : null}
          <Action icon="share-social" label={t("share")} onPress={share} />
        </View>

        {fee != null ? (
          <Card style={styles.row}>
            <Txt style={{ flex: 1 }}>{t("fee")}</Txt>
            {d.discountedFee != null && d.fee != null && d.discountedFee < d.fee ? (
              <Txt color={colors.faint} style={{ textDecorationLine: "line-through", marginRight: space.sm }}>
                {rupees(d.fee)}
              </Txt>
            ) : null}
            <Txt variant="bodyBold">{rupees(fee)}</Txt>
          </Card>
        ) : null}

        {place ? (
          <Card>
            <Txt variant="smallBold" color={colors.muted}>
              {t("practicesAt")}
            </Txt>
            <Txt variant="bodyBold" style={{ marginTop: 4 }}>
              {d.hospitalName}
            </Txt>
            <Txt color={colors.muted}>{[d.address, d.city, d.state, d.pincode].filter(Boolean).join(", ")}</Txt>
          </Card>
        ) : null}

        {d.about ? <Section title={t("about")} body={d.about} /> : null}
        {d.focusAreas.length ? <Section title={t("treats")} body={d.focusAreas.join(" · ")} /> : null}
        {d.languages.length ? <Section title={t("languages")} body={d.languages.join(", ")} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={t("bookAppointment")} icon="calendar" onPress={() => router.push(`/book/${d.id}`)} />
      </View>
    </SafeAreaView>
  );
}

function Badge({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Txt variant="tiny" color={colors.primaryDark} style={{ marginLeft: 4, fontWeight: "600" }}>
        {text}
      </Txt>
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.primarySoft }]} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Txt variant="smallBold" color={colors.primaryDark} style={{ marginTop: 4 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Txt variant="smallBold" color={colors.muted}>
        {title}
      </Txt>
      <Txt style={{ marginTop: 4, lineHeight: 22 }}>{body}</Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  hero: { alignItems: "center", paddingVertical: space.md },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.sm, marginTop: space.md },
  badge: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1, alignItems: "center", paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, minHeight: 64 },
  row: { flexDirection: "row", alignItems: "center" },
  footer: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
});
