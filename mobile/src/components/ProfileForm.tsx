import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { AgeUnit, PatientProfile, PatientProfileInput, Sex } from "../lib/api/types";
import { useI18n } from "../lib/i18n";
import { colors, font, space } from "../lib/theme";
import { Banner, Button, Chip, Field, Label } from "./ui";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export interface ProfileFormValues extends PatientProfileInput {
  remindersOptIn: boolean;
}

/**
 * The short profile: three required things (first name, age, sex) up front; everything else folded under "More".
 * Shared by onboarding and Profile → About me so both validate the same way.
 */
export function ProfileForm({
  initial,
  remindersInitial = true,
  showReminders,
  submitLabel,
  busy,
  serverError,
  onSubmit,
}: {
  initial?: PatientProfile | null;
  remindersInitial?: boolean;
  showReminders?: boolean;
  submitLabel: string;
  busy?: boolean;
  serverError?: string | null;
  onSubmit: (v: ProfileFormValues) => void;
}) {
  const { t } = useI18n();
  const [firstName, setFirstName] = useState(initial?.firstName ?? initial?.fullName?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [age, setAge] = useState(initial?.age != null ? String(initial.age) : "");
  const [ageUnit, setAgeUnit] = useState<AgeUnit>(initial?.ageUnit ?? "Y");
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [bloodGroup, setBloodGroup] = useState<string | null>(initial?.bloodGroup ?? null);
  const [email, setEmail] = useState(initial?.email ?? "");
  const [reminders, setReminders] = useState(remindersInitial);
  const [more, setMore] = useState(!!(initial?.lastName || initial?.bloodGroup || initial?.email));
  const [tried, setTried] = useState(false);

  const ageNum = age.trim() === "" ? NaN : Number(age);
  const errors = {
    firstName: firstName.trim() ? null : t("firstNameRequired"),
    age: Number.isInteger(ageNum) && ageNum >= 0 && ageNum <= 120 ? null : t("ageRequired"),
    sex: sex ? null : t("sexRequired"),
  };
  const valid = !errors.firstName && !errors.age && !errors.sex;

  function submit() {
    setTried(true);
    if (!valid) return;
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      age: ageNum,
      ageUnit,
      sex,
      bloodGroup,
      email: email.trim() || null,
      guardianName: initial?.guardianName ?? null,
      guardianRelation: initial?.guardianRelation ?? null,
      remindersOptIn: reminders,
    });
  }

  return (
    <View>
      {initial?.source === "BOOKING" ? (
        <View style={{ marginBottom: space.lg }}>
          <Banner text={t("prefilledFromBooking")} icon="information-circle" />
        </View>
      ) : null}

      <Field label={t("firstName")} value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" maxLength={100} error={tried ? errors.firstName : null} returnKeyType="next" />

      <Label>{t("age")}</Label>
      <View style={styles.ageRow}>
        <Field label="" value={age} onChangeText={(v) => setAge(v.replace(/\D/g, "").slice(0, 3))} keyboardType="number-pad" maxLength={3} style={{ width: 96, marginBottom: 0 }} accessibilityLabel={t("age")} />
        <View style={styles.unitRow}>
          {(["Y", "M", "D"] as AgeUnit[]).map((u) => (
            <Chip key={u} label={u === "Y" ? t("years") : u === "M" ? t("months") : t("days")} selected={ageUnit === u} onPress={() => setAgeUnit(u)} />
          ))}
        </View>
      </View>
      {tried && errors.age ? <Text style={styles.error}>{errors.age}</Text> : null}

      <View style={{ height: space.lg }} />
      <Label>{t("sex")}</Label>
      <View style={styles.sexRow}>
        {(["Male", "Female", "Other"] as Sex[]).map((s) => (
          <Chip key={s} label={s === "Male" ? t("male") : s === "Female" ? t("female") : t("other")} selected={sex === s} onPress={() => setSex(s)} style={{ flex: 1 }} />
        ))}
      </View>
      {tried && errors.sex ? <Text style={styles.error}>{errors.sex}</Text> : null}

      {more ? (
        <View style={{ marginTop: space.xl }}>
          <Field label={`${t("lastName")} (${t("optional")})`} value={lastName} onChangeText={setLastName} autoCapitalize="words" autoComplete="family-name" maxLength={100} />
          <Label>{`${t("bloodGroup")} (${t("optional")})`}</Label>
          <View style={styles.wrap}>
            {BLOOD_GROUPS.map((b) => (
              <Chip key={b} label={b} selected={bloodGroup === b} onPress={() => setBloodGroup(bloodGroup === b ? null : b)} />
            ))}
          </View>
          <View style={{ height: space.lg }} />
          <Field label={`${t("email")} (${t("optional")})`} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={200} />
        </View>
      ) : (
        <Pressable onPress={() => setMore(true)} style={{ paddingVertical: space.lg }} hitSlop={8}>
          <Text style={styles.more}>
            + {t("lastName")}, {t("bloodGroup")}, {t("email")}
          </Text>
        </Pressable>
      )}

      {showReminders ? (
        <View style={styles.reminders}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text style={styles.remTitle}>{t("reminders")}</Text>
            <Text style={styles.remHint}>{t("remindersHint")}</Text>
          </View>
          <Switch value={reminders} onValueChange={setReminders} trackColor={{ true: colors.primary, false: colors.line }} thumbColor="#fff" />
        </View>
      ) : null}

      {serverError ? (
        <View style={{ marginTop: space.lg }}>
          <Banner text={serverError} tone="danger" icon="alert-circle" />
        </View>
      ) : null}

      <Button label={submitLabel} onPress={submit} loading={busy} style={{ marginTop: space.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  ageRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  unitRow: { flexDirection: "row", gap: space.sm, flex: 1, flexWrap: "wrap" },
  sexRow: { flexDirection: "row", gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  error: { color: colors.danger, fontSize: font.tiny, marginTop: space.xs },
  more: { color: colors.primary, fontWeight: "600", fontSize: font.small },
  reminders: { flexDirection: "row", alignItems: "center", marginTop: space.lg, padding: space.lg, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
  remTitle: { fontSize: font.body, fontWeight: "600", color: colors.text },
  remHint: { fontSize: font.tiny, color: colors.muted, marginTop: 2 },
});
