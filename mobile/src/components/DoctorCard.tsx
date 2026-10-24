import { Pressable, StyleSheet, View } from "react-native";
import { effectiveFee, type Doctor } from "../lib/api/doctors";
import { rupees } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { plainSpecialty } from "../lib/specialties";
import { colors, space, TINT_ORDER, type Tint } from "../lib/theme";
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
 * Search-result card: who (name, plain specialty, years), where (rating · distance · hospital),
 * and what it costs + when — with one Book button. Tapping the top half opens the doctor.
 */
export function DoctorCard({ doctor, onPress, onBook }: { doctor: Doctor; onPress: () => void; onBook: () => void }) {
  const { t, locale } = useI18n();
  const fee = effectiveFee(doctor);
  const discounted = doctor.discountedFee != null && doctor.fee != null && doctor.discountedFee < doctor.fee;
  const meta = [
    doctor.rating ? `★ ${doctor.rating.toFixed(1)}` : null,
    doctor.distanceKm != null ? `${doctor.distanceKm < 10 ? doctor.distanceKm.toFixed(1) : Math.round(doctor.distanceKm)} km` : null,
    doctor.hospitalName ?? doctor.city,
  ].filter(Boolean);

  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${doctor.name}, ${plainSpecialty(doctor.specialtyId, locale)}`} style={styles.top}>
        <DoctorAvatar doctor={doctor} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="subheading" numberOfLines={1}>
            {doctor.name}
          </Txt>
          <Txt variant="small" color={colors.muted} numberOfLines={1}>
            {[plainSpecialty(doctor.specialtyId, locale), doctor.experienceYears ? t("experience", { years: doctor.experienceYears }) : null].filter(Boolean).join(" · ")}
          </Txt>
          <Txt variant="small" color={colors.muted} numberOfLines={1} style={{ fontSize: 13 }}>
            {meta.join("  ·  ")}
          </Txt>
        </View>
      </Pressable>
      <View style={styles.bottom}>
        <View style={{ flex: 1 }}>
          {fee != null ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              {discounted ? (
                <Txt variant="small" color={colors.muted} style={{ textDecorationLine: "line-through" }}>
                  {rupees(doctor.fee!)}
                </Txt>
              ) : null}
              <Txt variant="heading">{rupees(fee)}</Txt>
            </View>
          ) : null}
          {doctor.isAvailableToday != null ? (
            <Txt variant="tinyBold" color={doctor.isAvailableToday ? colors.success : colors.muted} style={{ fontSize: 13 }}>
              {doctor.isAvailableToday ? `● ${t("availableToday")}` : t("notAvailableToday")}
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
  top: { flexDirection: "row", gap: space.md },
  bottom: { flexDirection: "row", alignItems: "center", gap: space.md, borderTopWidth: 1, borderTopColor: colors.divider, marginTop: space.md + 2, paddingTop: space.md },
  online: { position: "absolute", right: 0, bottom: 0, backgroundColor: colors.successStrong, borderWidth: 2, borderColor: "#fff" },
});
