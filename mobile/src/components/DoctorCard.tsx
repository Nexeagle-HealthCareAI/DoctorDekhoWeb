import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { effectiveFee, type Doctor } from "../lib/api/doctors";
import { rupees } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { specialtyName } from "../lib/specialties";
import { colors, font, radius, space } from "../lib/theme";

const AVATAR_TINTS = ["#0F766E", "#B45309", "#7C3AED", "#BE185D", "#1D4ED8", "#15803D"];

export function Avatar({ doctor, size = 56 }: { doctor: Pick<Doctor, "id" | "photo" | "initials" | "isOnlineNow">; size?: number }) {
  const tint = AVATAR_TINTS[[...doctor.id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return (
    <View style={{ width: size, height: size }}>
      {doctor.photo ? (
        <Image source={{ uri: doctor.photo }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint }]}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.36 }}>{doctor.initials}</Text>
        </View>
      )}
      {doctor.isOnlineNow ? <View style={[styles.online, { right: 0, bottom: 0 }]} /> : null}
    </View>
  );
}

export function DoctorCard({ doctor, onPress, onBook }: { doctor: Doctor; onPress: () => void; onBook: () => void }) {
  const { t, locale } = useI18n();
  const fee = effectiveFee(doctor);
  const place = [doctor.hospitalName, doctor.city].filter(Boolean).join(", ");
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]} accessibilityRole="button" accessibilityLabel={doctor.name}>
      <View style={styles.top}>
        <Avatar doctor={doctor} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {doctor.name}
            </Text>
            {doctor.verified ? <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginLeft: 4 }} /> : null}
          </View>
          <Text style={styles.specialty} numberOfLines={1}>
            {specialtyName(doctor.specialtyId, locale) || doctor.specialty}
            {doctor.experienceYears ? ` · ${t("experience", { years: doctor.experienceYears })}` : ""}
          </Text>
          {place ? (
            <Text style={styles.place} numberOfLines={1}>
              {place}
              {doctor.distanceKm != null ? ` · ${doctor.distanceKm < 1 ? "<1" : Math.round(doctor.distanceKm)} km` : ""}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.bottom}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.metaRow}>
            {doctor.rating ? (
              <View style={styles.meta}>
                <Ionicons name="star" size={14} color={colors.accent} />
                <Text style={styles.metaText}>
                  {doctor.rating.toFixed(1)}
                  {doctor.reviewCount ? ` (${doctor.reviewCount})` : ""}
                </Text>
              </View>
            ) : null}
            {doctor.isAvailableToday != null ? (
              <Text style={[styles.metaText, { color: doctor.isAvailableToday ? colors.success : colors.muted }]}>
                {doctor.isAvailableToday ? t("availableToday") : t("notAvailableToday")}
              </Text>
            ) : null}
          </View>
          {fee != null ? (
            <Text style={styles.fee}>
              {rupees(fee)}
              {doctor.discountedFee != null && doctor.fee != null && doctor.fee > doctor.discountedFee ? (
                <Text style={styles.strike}> {rupees(doctor.fee)}</Text>
              ) : null}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onBook} style={({ pressed }) => [styles.book, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Text style={styles.bookText}>{t("bookAppointment")}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.line, marginBottom: space.md },
  top: { flexDirection: "row", alignItems: "center" },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: font.body + 1, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  specialty: { fontSize: font.small, color: colors.primaryDark, marginTop: 2 },
  place: { fontSize: font.tiny + 1, color: colors.muted, marginTop: 2 },
  bottom: { flexDirection: "row", alignItems: "center", marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  meta: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: font.tiny + 1, color: colors.text, fontWeight: "500" },
  fee: { fontSize: font.body, fontWeight: "700", color: colors.ink },
  strike: { fontSize: font.small, color: colors.faint, textDecorationLine: "line-through", fontWeight: "400" },
  book: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 44, justifyContent: "center" },
  bookText: { color: "#fff", fontWeight: "700", fontSize: font.small },
  initials: { alignItems: "center", justifyContent: "center" },
  online: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: colors.success, borderWidth: 2, borderColor: "#fff" },
});
