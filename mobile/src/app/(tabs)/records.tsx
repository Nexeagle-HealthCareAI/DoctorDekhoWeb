import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Alert, FlatList, Linking, Modal, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Button, Card, Chip, EmptyState, Label, Loading, Txt, type IconName } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { deleteLockerDocument, uploadLockerDocument } from "../../lib/api/patient";
import type { HealthLockerDocument } from "../../lib/api/types";
import { relationLabel } from "../../lib/booking";
import { formatShortDate } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { StringKey } from "../../lib/i18n/strings";
import { keys, useFamily, useLocker, useProfile } from "../../lib/queries";
import { colors, radius, space } from "../../lib/theme";

// Stored in English (hospital staff and the website read the same value); shown translated.
const TYPES: { value: string; key: StringKey; icon: IconName }[] = [
  { value: "Prescription", key: "prescription", icon: "medical" },
  { value: "Lab Report", key: "labReport", icon: "flask" },
  { value: "Scan", key: "scan", icon: "scan" },
  { value: "Discharge Summary", key: "dischargeSummary", icon: "document-text" },
  { value: "Vaccination", key: "vaccination", icon: "bandage" },
  { value: "Other", key: "otherRecord", icon: "document" },
];

interface Picked {
  uri: string;
  name: string;
  mimeType: string;
}

export default function RecordsScreen() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const locker = useLocker();
  const family = useFamily();
  const profile = useProfile();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [type, setType] = useState(TYPES[0].value);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | "all">("all");

  const members = family.data?.members ?? [];
  const docs = useMemo(() => {
    const all = locker.data?.documents ?? [];
    if (filter === "all") return all;
    return all.filter((d) => (filter === "me" ? !d.memberId : d.memberId === filter));
  }, [locker.data, filter]);

  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    open({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg" });
  }

  async function fromFiles() {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    open({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/octet-stream" });
  }

  function open(p: Picked) {
    setPicked(p);
    setError(null);
    setMemberId(filter !== "all" && filter !== "me" ? filter : null);
  }

  async function upload() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const r = await uploadLockerDocument({ ...picked, documentType: type, memberId });
      if (!r.success) throw new ApiError(r.message || t("retry"), 400, r);
      setPicked(null);
      await qc.invalidateQueries({ queryKey: keys.locker });
      await qc.invalidateQueries({ queryKey: keys.family });
    } catch (e) {
      setError(e instanceof ApiError && !e.isNetwork ? e.message : t("retry"));
    } finally {
      setBusy(false);
    }
  }

  function remove(d: HealthLockerDocument) {
    Alert.alert(t("deleteRecord"), d.fileName ?? "", [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteLockerDocument(d.documentId);
            await qc.invalidateQueries({ queryKey: keys.locker });
          } catch (e) {
            Alert.alert(t("deleteRecord"), (e as Error).message || t("retry"));
          }
        },
      },
    ]);
  }

  const whoName = (d: HealthLockerDocument) => (d.memberId ? members.find((m) => m.memberId === d.memberId)?.firstName : profile.data?.firstName || t("me"));

  if (locker.isLoading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={docs}
        keyExtractor={(d) => d.documentId}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={locker.isRefetching} onRefresh={() => void locker.refetch()} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Txt color={colors.muted}>{t("recordsHint")}</Txt>
            <View style={styles.row}>
              <Button label={t("takePhoto")} icon="camera" style={{ flex: 1 }} onPress={fromCamera} />
              <Button label={t("chooseFile")} icon="folder-open" variant="secondary" style={{ flex: 1 }} onPress={fromFiles} />
            </View>
            {members.length ? (
              <View style={styles.wrap}>
                <Chip label={t("allSpecialties")} selected={filter === "all"} onPress={() => setFilter("all")} />
                <Chip label={t("me")} selected={filter === "me"} onPress={() => setFilter("me")} />
                {members.map((m) => (
                  <Chip key={m.memberId} label={m.firstName} selected={filter === m.memberId} onPress={() => setFilter(m.memberId)} />
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="folder-open-outline" title={t("noRecords")} />}
        renderItem={({ item }) => {
          const tp = TYPES.find((x) => x.value.toLowerCase() === (item.documentType ?? "").toLowerCase());
          const source = item.doctorName || item.externalDoctorName || item.hospitalName || item.externalClinicName;
          return (
            <Card onPress={() => item.storageUrl && void Linking.openURL(item.storageUrl)} style={styles.doc}>
              <View style={styles.docIcon}>
                <Ionicons name={tp?.icon ?? "document"} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginHorizontal: space.md }}>
                <Txt variant="bodyBold" numberOfLines={1}>
                  {tp ? t(tp.key) : item.documentType || item.fileName}
                </Txt>
                <Txt variant="small" color={colors.muted} numberOfLines={1}>
                  {[whoName(item), formatShortDate(item.visitDate ?? item.uploadedAt, locale), source].filter(Boolean).join(" · ")}
                </Txt>
              </View>
              {!item.apptId ? (
                <Pressable onPress={() => remove(item)} hitSlop={12} accessibilityLabel={t("remove")}>
                  <Ionicons name="trash-outline" size={20} color={colors.faint} />
                </Pressable>
              ) : null}
            </Card>
          );
        }}
      />

      <Modal visible={!!picked} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicked(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md }}>
          <View style={styles.sheetHead}>
            <Txt variant="heading">{t("addRecord")}</Txt>
            <Pressable onPress={() => setPicked(null)} hitSlop={12} accessibilityLabel={t("cancel")}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <Txt color={colors.muted} numberOfLines={1}>
            {picked?.name}
          </Txt>
          <Label>{t("recordType")}</Label>
          <View style={styles.wrap}>
            {TYPES.map((x) => (
              <Chip key={x.value} label={t(x.key)} icon={x.icon} selected={type === x.value} onPress={() => setType(x.value)} />
            ))}
          </View>
          <Label>{t("recordFor")}</Label>
          <View style={styles.wrap}>
            <Chip label={t("me")} selected={memberId === null} onPress={() => setMemberId(null)} />
            {members.map((m) => (
              <Chip key={m.memberId} label={m.firstName} sublabel={relationLabel(t, m.relation)} selected={memberId === m.memberId} onPress={() => setMemberId(m.memberId)} />
            ))}
          </View>
          {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
          <View style={{ flex: 1 }} />
          <Button label={busy ? t("uploading") : t("save")} icon="cloud-upload" loading={busy} onPress={upload} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  doc: { flexDirection: "row", alignItems: "center" },
  docIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
