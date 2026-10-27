import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { KeyboardScreen } from "../../components/KeyboardScreen";
import { Banner, Button, Chip, Field, Label, TopBar } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { deleteFamilyMember, getFamily, saveFamilyMember } from "../../lib/api/patient";
import type { AgeUnit, FamilyResponse, Sex } from "../../lib/api/types";
import { RELATIONS, relationLabel } from "../../lib/booking";
import { useI18n } from "../../lib/i18n";
import { keys, useFamily } from "../../lib/queries";
import { colors, space } from "../../lib/theme";

/** Add or edit a family member: name, relation, age and sex are all a booking needs. */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useI18n();
  const family = useFamily();
  const existing = id ? family.data?.members?.find((m) => m.memberId === id) : undefined;

  const [firstName, setFirstName] = useState(existing?.firstName ?? "");
  const [lastName, setLastName] = useState(existing?.lastName ?? "");
  const [relation, setRelation] = useState(existing?.relation ?? "");
  const [age, setAge] = useState(existing?.age != null ? String(existing.age) : "");
  const [ageUnit, setAgeUnit] = useState<AgeUnit>(existing?.ageUnit ?? "Y");
  const [sex, setSex] = useState<Sex | null>(existing?.sex ?? null);
  const [allergies, setAllergies] = useState(existing?.allergies ?? "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ageNum = age ? Number(age) : NaN;
  const errors = {
    firstName: firstName.trim() ? null : t("firstNameRequired"),
    relation: relation ? null : t("sexRequired"),
    age: Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 120 ? null : t("ageRequired"),
    sex: sex ? null : t("sexRequired"),
  };
  const valid = !Object.values(errors).some(Boolean);

  async function save() {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await saveFamilyMember(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim() || null,
          relation,
          age: ageNum,
          ageUnit,
          sex,
          bloodGroup: existing?.bloodGroup ?? null,
          allergies: allergies.trim() || null,
        },
        existing?.memberId,
      );
      if (!r.success) throw new ApiError(r.message || t("retry"), 400, r);
      // The save reply carries only the saved member (its list is empty), so merge it into the cached list
      // rather than replacing the list with the reply, then reload the list from the server.
      const saved = r.member;
      if (saved) {
        qc.setQueryData<FamilyResponse>(keys.family, (old) => {
          const members = old?.members ?? [];
          const i = members.findIndex((m) => m.memberId === saved.memberId);
          return { ...(old ?? { success: true }), members: i >= 0 ? members.map((m, j) => (j === i ? saved : m)) : [...members, saved] };
        });
      }
      void qc.invalidateQueries({ queryKey: keys.family });
      router.back();
    } catch (e) {
      // A slow server or a dropped connection may still have saved it: look before saying it failed, so the patient
      // doesn't add the same person twice.
      if (e instanceof ApiError && e.isNetwork) {
        const fresh = await getFamily().catch(() => null);
        const found = fresh?.members?.find((m) =>
          existing ? m.memberId === existing.memberId : m.firstName.trim().toLowerCase() === firstName.trim().toLowerCase() && m.relation === relation,
        );
        if (fresh && found) {
          qc.setQueryData(keys.family, fresh);
          router.back();
          return;
        }
      }
      const msg = e instanceof ApiError ? e.message : t("retry");
      setError(msg);
      Alert.alert(existing ? existing.firstName : t("addMember"), msg);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!existing) return;
    Alert.alert(t("remove"), t("memberRemoveConfirm", { name: existing.firstName }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: async () => {
          try {
            const r = await deleteFamilyMember(existing.memberId);
            if (!r.success) throw new Error(r.message || t("retry"));
            // The delete reply has no list either: drop the member locally, then reload.
            qc.setQueryData<FamilyResponse>(keys.family, (old) => (old ? { ...old, members: (old.members ?? []).filter((m) => m.memberId !== existing.memberId) } : old));
            void qc.invalidateQueries({ queryKey: keys.family });
            void qc.invalidateQueries({ queryKey: keys.locker });
            router.back();
          } catch (e) {
            Alert.alert(t("remove"), (e as Error).message || t("retry"));
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title={existing ? existing.firstName : t("addMember")} back="close" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <Label>{t("relation")}</Label>
        <View style={styles.wrap}>
          {RELATIONS.map((r) => (
            <Chip key={r} label={relationLabel(t, r)} selected={relation === r} onPress={() => setRelation(r)} />
          ))}
          {relation && !(RELATIONS as readonly string[]).includes(relation) ? <Chip label={relation} selected /> : null}
        </View>
        {tried && errors.relation ? <Banner tone="danger" text={errors.relation} /> : null}

        <Field label={t("firstName")} value={firstName} onChangeText={setFirstName} autoCapitalize="words" maxLength={100} error={tried ? errors.firstName : null} />
        <Field label={`${t("lastName")} (${t("optional")})`} value={lastName} onChangeText={setLastName} autoCapitalize="words" maxLength={100} />

        <Label>{t("age")}</Label>
        <View style={styles.ageRow}>
          <Field label="" value={age} onChangeText={(v) => setAge(v.replace(/\D/g, "").slice(0, 3))} keyboardType="number-pad" maxLength={3} style={{ width: 96, marginBottom: 0 }} accessibilityLabel={t("age")} error={tried ? errors.age : null} />
          {(["Y", "M", "D"] as AgeUnit[]).map((u) => (
            <Chip key={u} label={t(u === "Y" ? "years" : u === "M" ? "months" : "days")} selected={ageUnit === u} onPress={() => setAgeUnit(u)} />
          ))}
        </View>

        <Label>{t("sex")}</Label>
        <View style={styles.wrap}>
          {(["Male", "Female", "Other"] as Sex[]).map((s) => (
            <Chip key={s} label={t(s === "Male" ? "male" : s === "Female" ? "female" : "other")} selected={sex === s} onPress={() => setSex(s)} />
          ))}
        </View>
        {tried && errors.sex ? <Banner tone="danger" text={errors.sex} /> : null}

        <Field label={`${t("allergies")} (${t("optional")})`} value={allergies} onChangeText={setAllergies} maxLength={500} style={{ marginTop: space.lg }} />

        {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
        <Button label={busy ? t("saving") : t("save")} icon="checkmark-circle" loading={busy} onPress={save} />
        {existing ? <Button label={t("remove")} variant="danger" icon="trash" onPress={remove} style={{ marginTop: space.sm }} /> : null}
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.sm, paddingBottom: space.xxl },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md },
  ageRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
});
