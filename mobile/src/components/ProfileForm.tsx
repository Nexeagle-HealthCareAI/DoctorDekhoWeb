import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { AgeUnit, PatientProfile, PatientProfileInput, Sex } from "../lib/api/types";
import { useI18n } from "../lib/i18n";
import { colors, space } from "../lib/theme";
import { Banner, Button, Chip, Field, Label, ListGroup, Segmented, ToggleRow, Txt } from "./ui";

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

      <Field label={t("yourName")} value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" textContentType="givenName" maxLength={100} error={tried ? errors.firstName : null} returnKeyType="next" />

      <Label>{t("age")}</Label>
      <View style={styles.ageRow}>
        <Field label="" value={age} onChangeText={(v) => setAge(v.replace(/\D/g, "").slice(0, 3))} keyboardType="number-pad" maxLength={3} style={{ width: 96, marginBottom: 0 }} accessibilityLabel={t("age")} error={tried && errors.age ? " " : null} />
        <Segmented
          style={{ flex: 1 }}
          value={ageUnit}
          onChange={setAgeUnit}
          options={[
            { value: "Y" as AgeUnit, label: t("years") },
            { value: "M" as AgeUnit, label: t("months") },
            { value: "D" as AgeUnit, label: t("days") },
          ]}
        />
      </View>
      {tried && errors.age ? <ErrorText text={errors.age} /> : null}

      <View style={{ height: space.xl }} />
      <Label>{t("sex")}</Label>
      <View style={styles.sexRow}>
        {(["Male", "Female", "Other"] as Sex[]).map((s) => (
          <Chip key={s} label={s === "Male" ? t("male") : s === "Female" ? t("female") : t("other")} selected={sex === s} onPress={() => setSex(s)} style={{ flex: 1, minHeight: 56 }} />
        ))}
      </View>
      {tried && errors.sex ? <ErrorText text={errors.sex} /> : null}

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
        <Button label={`+ ${t("moreDetails")}`} variant="ghost" size="md" onPress={() => setMore(true)} style={{ alignSelf: "flex-start", paddingHorizontal: 0, marginTop: space.md }} />
      )}

      {showReminders ? (
        <ListGroup style={{ marginTop: space.lg }}>
          <ToggleRow first icon="notifications-outline" label={t("reminders")} hint={t("remindersHint")} value={reminders} onChange={setReminders} />
        </ListGroup>
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

function ErrorText({ text }: { text: string }) {
  return (
    <Txt variant="small" color={colors.danger} style={{ marginTop: space.xs }}>
      {text}
    </Txt>
  );
}

const styles = StyleSheet.create({
  ageRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  sexRow: { flexDirection: "row", gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
