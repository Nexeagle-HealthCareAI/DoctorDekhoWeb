import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { effectiveFee, type Doctor } from "../lib/api/doctors";
import { rupees } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { useReadAloud } from "../lib/speech";
import { plainSpecialty } from "../lib/specialties";
import { colors, space, TINT_ORDER, type Tint } from "../lib/theme";
import { LiveDot } from "./Motion";
import { Avatar, Button, Txt } from "./ui";

/** A stable tint per doctor so the same doctor keeps the same colour everywhere. */
export function tintFor(id: string): Tint {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINT_ORDER[h % TINT_ORDER.length];
}

export function DoctorAvatar({ doctor, size = 56 }: { doctor: Pick<Doctor, "id" | "photo" | "initials" | "isOnlineNow">; size?: number }) {
  return (
    <View>
      <Avatar initials={doctor.initials} tint={tintFor(doctor.id)} size={size} photo={doctor.photo} />
      {doctor.isOnlineNow ? <View style={[styles.online, { width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13 }]} /> : null}
    </View>
  );
}

/**
 * Doctor card (Home and Search): who, where, and a quiet line of checked facts — registration checked (only when
 * the directory says so), the full fee, languages and distance — so nothing is hidden until later. "Open today"
 * breathes because it is live; Listen reads the card aloud; one Book button. Tapping the top opens the doctor.
 */
export function DoctorCard({ doctor, onPress, onBook, why }: { doctor: Doctor; onPress: () => void; onBook: () => void; why?: string }) {
  const { t, locale } = useI18n();
  const { speaking, toggle } = useReadAloud(locale);
  const fee = effectiveFee(doctor);
  const kind = plainSpecialty(doctor.specialtyId, locale);
  const km = doctor.distanceKm != null ? `${doctor.distanceKm < 10 ? doctor.distanceKm.toFixed(1) : Math.round(doctor.distanceKm)} km` : null;
  const langs = doctor.languages.slice(0, 2).join(", ");
  const spoken = [doctor.name, kind, doctor.hospitalName, fee != null ? t("fullFee", { fee: rupees(fee) }) : null, doctor.isAvailableToday ? t("availableToday") : null].filter(Boolean).join(". ");

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${doctor.name}, ${kind}`} style={({ pressed }) => [{ flex: 1, minWidth: 0, flexDirection: "row", gap: space.md, alignItems: "center" }, pressed && { opacity: 0.8 }]}>
          <DoctorAvatar doctor={doctor} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="subheading" numberOfLines={1}>
              {doctor.name}
            </Txt>
            <Txt variant="small" color={colors.muted} numberOfLines={1}>
              {[kind, doctor.hospitalName ?? doctor.city].filter(Boolean).join(" · ")}
            </Txt>
          </View>
        </Pressable>
        <Pressable onPress={() => toggle(spoken)} accessibilityRole="button" accessibilityLabel={speaking ? t("stop") : t("listen")} hitSlop={6} style={({ pressed }) => [styles.listen, pressed && { transform: [{ scale: 0.94 }] }]}>
          <Ionicons name={speaking ? "stop" : "volume-high"} size={19} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.facts} accessibilityLabel={t("checkedDetails")}>
        {doctor.verified ? (
          <View style={[styles.fact, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="checkmark" size={13} color={colors.success} />
            <Txt variant="tinyBold" color={colors.success} style={{ marginLeft: 3 }}>
              {t("registrationChecked")}
            </Txt>
          </View>
        ) : null}
        {fee != null ? (
          <View style={styles.fact}>
            <Txt variant="tinyBold">{t("fullFee", { fee: rupees(fee) })}</Txt>
          </View>
        ) : null}
        {langs ? (
          <View style={styles.fact}>
            <Txt variant="tinyBold">{langs}</Txt>
          </View>
        ) : null}
        {km ? (
          <View style={[styles.fact, { backgroundColor: "#EEF3FC" }]}>
            <Txt variant="tinyBold" color="#17468F">
              {km}
            </Txt>
          </View>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {doctor.isAvailableToday ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LiveDot color={colors.success} />
              <Txt variant="smallBold" color={colors.success}>
                {t("availableToday")}
              </Txt>
            </View>
          ) : doctor.isAvailableToday === false ? (
            <Txt variant="small" color={colors.muted}>
              {t("notAvailableToday")}
            </Txt>
          ) : null}
          {why ? (
            <Txt variant="small" color={colors.text} numberOfLines={1}>
              {t("whyThis", { why })}
            </Txt>
          ) : null}
        </View>
        <Button label={t("book")} size="md" onPress={onBook} style={{ paddingHorizontal: space.xl }} accessibilityLabel={`${t("book")} ${doctor.name}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  top: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  listen: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  fact: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.segment },
  bottom: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.md },
  online: { position: "absolute", right: 0, bottom: 0, backgroundColor: colors.successStrong, borderWidth: 2, borderColor: "#fff" },
});
