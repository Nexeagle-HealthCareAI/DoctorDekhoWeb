import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DoctorAvatar } from "../../components/DoctorCard";
import { MapPreview } from "../../components/MapPreview";
import { LiveDot } from "../../components/Motion";
import { Button, Card, EmptyState, IconButton, Loading, TopBar, Txt } from "../../components/ui";
import { effectiveFee } from "../../lib/api/doctors";
import { config } from "../../lib/config";
import { rupees } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { hasMapImages } from "../../lib/map";
import { useDoctor } from "../../lib/queries";
import { useReadAloud } from "../../lib/speech";
import { hasPlainName, plainSpecialty, specialtyName } from "../../lib/specialties";
import { callNumber, contactSupport, openDirections } from "../../lib/support";
import { colors, radius, space } from "../../lib/theme";

/** Doctor profile: who, three facts at a glance, today's availability, where (Directions / Call), and one Book button. */
export default function DoctorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const q = useDoctor(id);
  const d = q.data;
  const { speaking, toggle } = useReadAloud(locale);

  if (q.isLoading && !d)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar />
        <Loading />
      </View>
    );
  if (!d)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar />
        <EmptyState icon="person-remove" title={t("doctorNotFound")} action={t("findDoctor")} onAction={() => router.replace("/doctors")} />
      </View>
    );

  const fee = effectiveFee(d);
  const plain = plainSpecialty(d.specialtyId, locale);
  const spoken = [d.name, plain, d.hospitalName, fee != null ? t("feeFull", { fee: rupees(fee) }) : null, d.isAvailableToday ? t("availableToday") : null].filter(Boolean).join(". ");
  const formal = specialtyName(d.specialtyId, locale);

  function share() {
    const url = `${config.siteUrl}/doctor/${d!.id}`;
    void Share.share(Platform.OS === "ios" ? { url, message: d!.name } : { message: `${d!.name} — ${plain}\n${url}` });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar right={<IconButton icon="share-social-outline" label={t("share")} onPress={share} bordered />} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <DoctorAvatar doctor={d} size={88} />
          <Txt variant="title" center style={{ marginTop: space.md }}>
            {d.name}
          </Txt>
          <Txt color={colors.muted} center>
            {[hasPlainName(d.specialtyId) && plain !== formal ? `${plain} (${formal})` : plain, d.qualifications].filter(Boolean).join(" · ")}
          </Txt>
          {d.verified ? (
            <View style={styles.verified}>
              <Ionicons name="shield-checkmark" size={15} color={colors.primaryDark} />
              <Txt variant="tinyBold" color={colors.primaryDark} style={{ marginLeft: 6, fontSize: 13 }}>
                {t("verifiedBy")}
              </Txt>
            </View>
          ) : null}
        </View>

        <View style={styles.facts}>
          <Fact value={d.experienceYears ? t("yearsShort", { years: d.experienceYears }) : "—"} label={t("experienceLabel")} />
          <Fact value={d.rating ? `★ ${d.rating.toFixed(1)}` : "—"} label={d.reviewCount ? t("reviews", { count: d.reviewCount }) : t("rating")} />
          <Fact value={fee != null ? rupees(fee) : "—"} label={t("feeShort")} />
        </View>

        <View style={[styles.avail, { backgroundColor: d.isAvailableToday ? colors.successSoft : colors.card }]}>
          {d.isAvailableToday ? <LiveDot size={12} color={colors.success} /> : <Ionicons name="time-outline" size={20} color={colors.muted} />}
          <Txt variant="bodyBold" color={d.isAvailableToday ? colors.success : colors.muted} style={{ marginLeft: space.sm, fontSize: 16, flex: 1 }}>
            {d.isAvailableToday ? t("availableToday") : d.isAvailableToday === false ? t("notAvailableToday") : t("hospitalFixesTime")}
          </Txt>
          <Button label={speaking ? t("stop") : t("listen")} icon={speaking ? "stop" : "volume-high"} variant="outline" size="sm" onPress={() => toggle(spoken)} />
        </View>

        {fee != null ? (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md + 2 }}>
            <View style={styles.rupee}>
              <Txt variant="heading">₹</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="subheading">{t("feeFull", { fee: rupees(fee) })}</Txt>
              <Txt variant="small" color={colors.muted}>
                {t("feeNoCharge")}
              </Txt>
            </View>
          </Card>
        ) : null}

        {d.hospitalName || d.address ? (
          <Card style={{ gap: space.md, padding: 0, overflow: "hidden" }}>
            {d.latitude != null && d.longitude != null && hasMapImages() ? (
              <MapPreview
                center={{ lat: d.latitude, lng: d.longitude }}
                zoom={14}
                pins={[{ lat: d.latitude, lng: d.longitude }]}
                height={110}
                onPress={() => router.push({ pathname: "/route/[id]", params: { id: d.id } })}
                accessibilityLabel={`${d.hospitalName ?? d.name}. ${t("seeTheWay")}`}
                style={{ borderRadius: 0, borderWidth: 0 }}
              />
            ) : null}
            <View style={{ paddingHorizontal: space.lg, paddingTop: d.latitude != null ? 0 : space.lg }}>
              <Txt variant="bodyBold">{d.hospitalName}</Txt>
              <Txt variant="small" color={colors.muted}>
                {[d.address, d.city, d.state, d.pincode].filter(Boolean).join(", ")}
                {d.distanceKm != null ? ` · ${d.distanceKm.toFixed(1)} km` : ""}
              </Txt>
            </View>
            <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: space.lg, paddingBottom: space.lg }}>
              <Button
                label={t("seeTheWay")}
                icon="navigate"
                variant="secondary"
                size="md"
                style={{ flex: 1 }}
                onPress={() => (d.latitude != null ? router.push({ pathname: "/route/[id]", params: { id: d.id } }) : openDirections({ query: [d.hospitalName, d.address, d.city].filter(Boolean).join(", ") }))}
              />
              {d.hospitalPhone ? <Button label={t("call")} icon="call" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => callNumber(d.hospitalPhone!)} /> : null}
            </View>
          </Card>
        ) : null}

        {d.focusAreas.length || d.languages.length ? (
          <View style={{ gap: space.sm }}>
            <Txt variant="bodyBold">{t("treats")}</Txt>
            <View style={styles.tags}>
              {[...d.focusAreas, ...(d.languages.length ? [d.languages.join(", ")] : [])].map((x) => (
                <View key={x} style={styles.tag}>
                  <Txt variant="small" style={{ fontWeight: undefined }}>
                    {x}
                  </Txt>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {d.about ? (
          <View style={{ gap: space.xs }}>
            <Txt variant="bodyBold">{t("about")}</Txt>
            <Txt color={colors.muted}>{d.about}</Txt>
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {d.hospitalPhone ? <IconButton icon="call" label={t("callHospital")} onPress={() => callNumber(d.hospitalPhone!)} bordered /> : null}
          <Button label={t("bookVisit")} icon="calendar" onPress={() => router.push(`/book/${d.id}`)} style={{ flex: 1 }} />
        </View>
        <Button label={t("callToBook")} icon="call-outline" variant="ghost" size="sm" onPress={() => contactSupport("whatsapp", t("callToBookMessage", { need: d.name }))} />
      </SafeAreaView>
    </View>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.fact}>
      <Txt variant="heading" numberOfLines={1}>
        {value}
      </Txt>
      <Txt variant="small" color={colors.muted} numberOfLines={1} style={{ fontSize: 13 }}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingTop: 0, gap: space.md + 2, paddingBottom: space.xl },
  hero: { alignItems: "center", paddingVertical: space.lg, paddingHorizontal: space.md, borderRadius: radius.xl, backgroundColor: colors.primarySoft },
  verified: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5, marginTop: space.sm },
  facts: { flexDirection: "row", gap: 10 },
  fact: { flex: 1, alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg - 2, paddingVertical: space.md, paddingHorizontal: space.xs },
  avail: { flexDirection: "row", alignItems: "center", borderRadius: radius.lg - 2, paddingVertical: space.sm + 2, paddingLeft: space.md + 2, paddingRight: space.sm, borderWidth: 1, borderColor: colors.line },
  rupee: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.segment, alignItems: "center", justifyContent: "center" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tag: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
  footer: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: space.lg, paddingTop: space.md },
});
