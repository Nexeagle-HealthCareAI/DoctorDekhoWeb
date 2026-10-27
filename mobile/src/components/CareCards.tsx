import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { rupees } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { StringKey } from "../lib/i18n/strings";
import { useStoredSet } from "../lib/care";
import { useReadAloud } from "../lib/speech";
import { colors, radius, space, tints, TINT_ORDER, type Tint } from "../lib/theme";
import { LiveDot } from "./Motion";
import { Button, IconCircle, Txt, type IconName } from "./ui";

/**
 * The request's real steps, each known to the server: sent → seen by the hospital → the hospital calls → confirmed →
 * visit day. `tone="dark"` sits on the teal next-visit card on Home; light is the Visits tab.
 */
export function Journey({ current, tone = "light" }: { current: number; tone?: "light" | "dark" }) {
  const { t } = useI18n();
  const steps = [t("jSent"), t("jSeen"), t("jCall"), t("jConfirmed"), t("jVisit")];
  const on = tone === "dark" ? "#fff" : colors.primary;
  const off = tone === "dark" ? "rgba(255,255,255,0.28)" : colors.line;
  const label = tone === "dark" ? ["#fff", "rgba(255,255,255,0.7)"] : [colors.primaryDark, colors.muted];
  return (
    <View style={styles.journey} accessible accessibilityLabel={t("stepOf", { n: current + 1, total: steps.length, step: steps[current] })}>
      {steps.map((text, i) => (
        <View key={text} style={{ flex: 1, alignItems: "center", gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
            <View style={[styles.bar, { backgroundColor: i === 0 ? "transparent" : i <= current ? on : off }]} />
            {i === current ? (
              <LiveDot size={14} color={on} />
            ) : (
              <View style={[styles.dot, { backgroundColor: i < current ? on : off }]}>{i < current ? <Ionicons name="checkmark" size={9} color={tone === "dark" ? colors.primary : "#fff"} /> : null}</View>
            )}
            <View style={[styles.bar, { backgroundColor: i === steps.length - 1 ? "transparent" : i < current ? on : off }]} />
          </View>
          <Txt variant="tinyBold" color={i <= current ? label[0] : label[1]} center numberOfLines={1} style={{ fontSize: 12, fontWeight: i === current ? "800" : undefined }}>
            {text}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const BRING: { id: string; key: StringKey; icon: IconName; tint: Tint }[] = [
  { id: "rx", key: "bringPrescriptions", icon: "document-text-outline", tint: "teal" },
  { id: "reports", key: "bringReports", icon: "images-outline", tint: "blue" },
  { id: "id", key: "bringId", icon: "card-outline", tint: "purple" },
  { id: "meds", key: "bringMedicines", icon: "medkit-outline", tint: "red" },
];

/**
 * "What to bring" for tomorrow's or today's visit. Ticks are kept on this phone for this visit only, and the list can
 * be read aloud in the patient's language.
 */
export function BringList({ appointmentId, fee }: { appointmentId: string; fee?: number }) {
  const { t, locale } = useI18n();
  const { ids, toggle } = useStoredSet(`dd.bring.${appointmentId}`);
  const { speaking, toggle: listen } = useReadAloud(locale);
  const items = [...BRING.map((b) => ({ ...b, text: t(b.key) })), { id: "fee", key: "bringFeePlain" as StringKey, icon: "wallet-outline" as IconName, tint: "amber" as Tint, text: fee ? t("bringFee", { fee: rupees(fee) }) : t("bringFeePlain") }];
  const done = items.filter((i) => ids.has(i.id)).length;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{t("bringTitle")}</Txt>
          <Txt variant="small" color={done === items.length ? colors.success : colors.muted}>
            {done === items.length ? t("bringAllReady") : t("bringReady", { done, total: items.length })}
          </Txt>
        </View>
        <Pressable
          onPress={() => listen([t("bringTitle"), ...items.map((i) => i.text)].join(". "))}
          accessibilityRole="button"
          accessibilityLabel={t("listen")}
          style={({ pressed }) => [styles.listen, pressed && { transform: [{ scale: 0.96 }] }]}
        >
          <Ionicons name={speaking ? "stop" : "volume-high"} size={18} color={colors.primaryDark} />
          <Txt variant="smallBold" color={colors.primaryDark}>
            {t("listen")}
          </Txt>
        </Pressable>
      </View>
      {items.map((i) => {
        const on = ids.has(i.id);
        return (
          <Pressable
            key={i.id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              toggle(i.id);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={styles.item}
          >
            <IconCircle icon={i.icon} tint={i.tint} size={40} />
            <Txt variant="body" style={{ flex: 1, opacity: on ? 0.55 : 1, textDecorationLine: on ? "line-through" : "none" }}>
              {i.text}
            </Txt>
            <View style={[styles.box, on && styles.boxOn]}>{on ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** After a visit: keep the prescription safe, and book the follow-up the doctor asked for. */
export function AfterVisitCard({ doctorName, hospitalName, onSave, onFollowUp, onHide }: { doctorName: string; hospitalName: string; onSave: () => void; onFollowUp?: () => void; onHide: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <IconCircle icon="checkmark-done" tint="teal" size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="eyebrow" color={colors.muted} style={{ fontSize: 12 }}>
            {t("afterTitle")}
          </Txt>
          <Txt variant="bodyBold" numberOfLines={1}>
            {doctorName}
          </Txt>
          <Txt variant="small" color={colors.muted} numberOfLines={1}>
            {hospitalName}
          </Txt>
        </View>
        <Pressable onPress={onHide} accessibilityRole="button" accessibilityLabel={t("hideCard")} hitSlop={10} style={styles.hide}>
          <Ionicons name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <Txt variant="small" color={colors.muted}>
        {t("afterHint")}
      </Txt>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button label={t("savePrescription")} icon="camera" variant="secondary" size="md" style={{ flex: 1 }} onPress={onSave} />
        {onFollowUp ? <Button label={t("bookFollowUp")} icon="calendar" size="md" style={{ flex: 1 }} onPress={onFollowUp} /> : null}
      </View>
    </View>
  );
}

export interface FamilyChip {
  id: string;
  name: string;
  count: number;
}

/**
 * Whose care Home shows: Everyone, Me, or one family member. Each chip says how many visits are coming up for that
 * person, so a caregiver sees at a glance who has something booked.
 */
export function FamilyChips({ chips, value, onChange }: { chips: FamilyChip[]; value: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const all: FamilyChip[] = [{ id: "all", name: t("famEveryone"), count: 0 }, ...chips];
  return (
    <View style={styles.chips} accessibilityRole="tablist">
      {all.map((c, i) => {
        const on = c.id === value;
        const [bg, fg] = tints[TINT_ORDER[(i - 1 + TINT_ORDER.length) % TINT_ORDER.length]];
        return (
          <Pressable
            key={c.id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(c.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={c.count ? `${c.name}, ${c.count}` : c.name}
            style={[styles.fam, on && styles.famOn]}
          >
            {c.id === "all" ? (
              <Ionicons name="people" size={18} color={on ? "#fff" : colors.ink} />
            ) : (
              <View style={[styles.initial, { backgroundColor: on ? "rgba(255,255,255,0.2)" : bg }]}>
                <Txt variant="tinyBold" color={on ? "#fff" : fg} style={{ fontSize: 13 }}>
                  {c.name.slice(0, 1).toUpperCase()}
                </Txt>
              </View>
            )}
            <Txt variant="smallBold" color={on ? "#fff" : colors.ink} numberOfLines={1} style={{ maxWidth: 110 }}>
              {c.name}
            </Txt>
            {c.count ? (
              <View style={[styles.count, on && { backgroundColor: "#fff" }]}>
                <Txt variant="tinyBold" color={on ? colors.primaryDark : "#fff"} style={{ fontSize: 12 }}>
                  {c.count}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The next visit for each other person in the family, one line each, under the main card. */
export function OtherVisits({ rows, onOpen }: { rows: { key: string; name: string; when: string; doctor: string }[]; onOpen: () => void }) {
  const { t } = useI18n();
  if (!rows.length) return null;
  return (
    <View style={[styles.card, { gap: space.sm }]}>
      <Txt variant="eyebrow" color={colors.muted} style={{ fontSize: 12 }}>
        {t("otherVisits")}
      </Txt>
      {rows.map((r) => (
        <Pressable key={r.key} onPress={onOpen} accessibilityRole="button" style={styles.other}>
          <Ionicons name="person-circle" size={30} color={colors.primary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="bodyBold" numberOfLines={1}>
              {r.name} · {r.when}
            </Txt>
            <Txt variant="small" color={colors.muted} numberOfLines={1}>
              {r.doctor}
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  fam: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingLeft: 8, paddingRight: 14, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  famOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  initial: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  other: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52 },
  journey: { flexDirection: "row" },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  dot: { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  listen: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  item: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52 },
  box: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: colors.lineStrong, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  hide: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
