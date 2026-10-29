import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Banner, Button, Chip, EmptyState, IconCircle, Label, Loading, Logo, TopBar, Txt, type IconName } from "../../components/ui";
import { ApiError } from "../../lib/api/http";
import { clearPicking, markPicking, takePendingPhoto } from "../../lib/pendingPick";
import { deleteLockerDocument, uploadLockerDocument } from "../../lib/api/patient";
import type { HealthLockerDocument } from "../../lib/api/types";
import { relationLabel } from "../../lib/booking";
import { formatShortDate } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { StringKey } from "../../lib/i18n/strings";
import type { Locale } from "../../lib/i18n/types";
import { keys, useFamily, useLocker, useProfile } from "../../lib/queries";
import { colors, radius, space, TINT_ORDER, type Tint } from "../../lib/theme";

// Stored in English (hospital staff and the website read the same value); shown translated.
const TYPES: { value: string; key: StringKey; icon: IconName; tint: Tint }[] = [
  { value: "Prescription", key: "prescription", icon: "document-text-outline", tint: "teal" },
  { value: "Lab Report", key: "labReport", icon: "flask-outline", tint: "amber" },
  { value: "Scan", key: "scan", icon: "scan-outline", tint: "blue" },
  { value: "Discharge Summary", key: "dischargeSummary", icon: "clipboard-outline", tint: "purple" },
  { value: "Vaccination", key: "vaccination", icon: "bandage-outline", tint: "red" },
  { value: "Other", key: "otherRecord", icon: "document-outline", tint: "gray" },
];

interface Picked {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
}

// The server has no upload limit yet; keep phone uploads to a size that works on slow data.
const MAX_BYTES = 10 * 1024 * 1024;

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
  // Photos stay covered until the patient taps them (shared phones); this is per session, never saved.
  const [shown, setShown] = useState<Record<string, boolean>>({});
  // Android closed the app while a file was being chosen: say so here instead of leaving the patient on Home.
  const [pickAgain, setPickAgain] = useState(false);

  const members = family.data?.members ?? [];
  const docs = useMemo(() => {
    const all = locker.data?.documents ?? [];
    if (filter === "all") return all;
    return all.filter((d) => (filter === "me" ? !d.memberId : d.memberId === filter));
  }, [locker.data, filter]);

  // Home's "Save prescription" opens this tab with add=prescription: go straight to the camera, type already set.
  const { add, resume } = useLocalSearchParams<{ add?: string; resume?: string }>();
  const router = useRouter();
  useEffect(() => {
    if (add !== "prescription") return;
    router.setParams({ add: undefined });
    setType("Prescription");
    void fromCamera();
  }, [add]); // eslint-disable-line react-hooks/exhaustive-deps

  // A photo recovered after Android closed the app during the camera: open it ready to save.
  useEffect(() => {
    if (resume !== "1" && resume !== "file") return;
    router.setParams({ resume: undefined });
    if (resume === "file") {
      setPickAgain(true);
      return;
    }
    const p = takePendingPhoto();
    if (p) open(p);
  }, [resume]);

  /** Before the camera or file picker: free the decoded record photos (the big memory user right after an upload). */
  async function beforePicking(kind: "camera" | "file") {
    setPickAgain(false);
    await Image.clearMemoryCache().catch(() => false);
    await markPicking(kind);
  } // eslint-disable-line react-hooks/exhaustive-deps

  async function fromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    // Smaller photos (still sharp enough to read a prescription) use less memory, so Android is less likely to close the app.
    await beforePicking("camera");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ["images"], exif: false });
    void clearPicking();
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    open({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize });
  }

  async function fromFiles() {
    await beforePicking("file");
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    void clearPicking();
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    open({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/octet-stream", size: a.size });
  }

  function open(p: Picked) {
    if (p.size != null && p.size > MAX_BYTES) {
      Alert.alert(t("addRecord"), t("fileTooLarge"));
      return;
    }
    setPicked(p);
    setError(null);
    setMemberId(filter !== "all" && filter !== "me" ? filter : null);
  }

  async function upload() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const { size: _size, ...file } = picked;
      const r = await uploadLockerDocument({ ...file, documentType: type, memberId });
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

  const filterName = filter === "all" || filter === "me" ? profile.data?.firstName || t("me") : (members.find((m) => m.memberId === filter)?.firstName ?? t("me"));
  const whoName = (d: HealthLockerDocument) => (d.memberId ? members.find((m) => m.memberId === d.memberId)?.firstName : profile.data?.firstName || t("me"));

  const sections = useMemo(() => {
    const groups = new Map<string, HealthLockerDocument[]>();
    for (const d of [...docs].sort((a, b) => (b.visitDate ?? b.uploadedAt).localeCompare(a.visitDate ?? a.uploadedAt))) {
      const k = (d.visitDate ?? d.uploadedAt).slice(0, 7);
      groups.set(k, [...(groups.get(k) ?? []), d]);
    }
    return [...groups.entries()].map(([month, data]) => ({ month, data }));
  }, [docs]);

  const people = [
    { id: "all", name: t("everyone"), initial: "+", tint: "gray" as const },
    { id: "me", name: profile.data?.firstName || t("me"), initial: (profile.data?.firstName || t("me"))[0], tint: "teal" as const },
    ...members.map((m, i) => ({ id: m.memberId, name: m.firstName, initial: m.firstName[0] ?? "?", tint: TINT_ORDER[(i + 1) % TINT_ORDER.length] })),
  ];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      {locker.isLoading ? (
        <Loading />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(d) => d.documentId}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: space.lg, paddingTop: space.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={locker.isRefetching} onRefresh={() => void locker.refetch()} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View style={{ gap: space.lg, marginBottom: space.sm }}>
              {pickAgain ? <Banner tone="warning" icon="refresh" text={t("pickFileAgain")} /> : null}
              <View style={{ paddingHorizontal: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Txt variant="display" style={{ flex: 1 }}>
                    {t("recordsTitle")}
                  </Txt>
                  <Logo height={30} />
                </View>
                <Txt color={colors.muted}>{t("recordsHint")}</Txt>
              </View>

              {members.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                  {people.map((p) => {
                    const on = filter === p.id;
                    return (
                      <Pressable key={p.id} onPress={() => setFilter(p.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [styles.person, on && styles.personOn, pressed && { transform: [{ scale: 0.96 }] }]}>
                        <Avatar initials={p.initial.toUpperCase()} tint={p.tint} size={32} />
                        <Txt variant="smallBold" color={on ? colors.primaryDark : colors.ink} style={{ marginLeft: space.sm }}>
                          {p.name}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <View style={styles.addCard}>
                <Txt variant="subheading" color="#fff">
                  {t("keepPapersSafe", { name: filterName })}
                </Txt>
                <Txt variant="small" color="#DDF1ED" style={{ marginTop: -space.sm }}>
                  {t("addRecordLong")}
                </Txt>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button label={t("takePhoto")} icon="camera" variant="onDark" size="md" style={{ flex: 1 }} onPress={fromCamera} />
                  <Button label={t("uploadFile")} icon="cloud-upload-outline" variant="onDarkSoft" size="md" style={{ flex: 1 }} onPress={fromFiles} />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: 4 }}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.success} />
                <Txt variant="small" color={colors.text} style={{ flex: 1, fontSize: 13 }}>
                  {t("recordsPrivate")}
                </Txt>
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <Txt variant="eyebrow" color={colors.muted} style={{ marginTop: space.lg, marginBottom: space.sm, paddingHorizontal: 4 }}>
              {monthTitle(section.month, locale)}
            </Txt>
          )}
          ListEmptyComponent={<EmptyState icon="folder-open-outline" vita="wave" title={filter === "all" ? t("noRecords") : t("nothingFor", { name: filterName })} body={t("noRecordsHint")} />}
          renderItem={({ item, index, section }) => {
            const tp = TYPES.find((x) => x.value.toLowerCase() === (item.documentType ?? "").toLowerCase());
            const source = item.doctorName || item.externalDoctorName || item.hospitalName || item.externalClinicName;
            const first = index === 0;
            const last = index === section.data.length - 1;
            return (
              <Pressable
                onPress={() => item.storageUrl && void Linking.openURL(item.storageUrl)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.doc, first && styles.docFirst, last && styles.docLast, !first && styles.docDivider, pressed && { backgroundColor: colors.bg }]}
              >
                {isImage(item) ? (
                  <Pressable
                    onPress={() => setShown((m) => ({ ...m, [item.documentId]: !m[item.documentId] }))}
                    accessibilityRole="button"
                    accessibilityLabel={shown[item.documentId] ? t("coverPhoto") : t("showPhoto")}
                    style={styles.thumb}
                  >
                    <Image source={{ uri: item.storageUrl! }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={shown[item.documentId] ? 0 : 22} cachePolicy="memory" accessible={false} />
                    {!shown[item.documentId] ? (
                      <View style={styles.cover}>
                        <Ionicons name="eye-outline" size={20} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                ) : (
                  <IconCircle icon={tp?.icon ?? "document-outline"} tint={tp?.tint ?? "gray"} size={44} square />
                )}
                <View style={{ flex: 1, marginHorizontal: space.md, minWidth: 0 }}>
                  <Txt variant="bodyBold" numberOfLines={1} style={{ fontSize: 15 }}>
                    {tp ? t(tp.key) : item.documentType || item.fileName}
                  </Txt>
                  <Txt variant="small" color={colors.muted} numberOfLines={1} style={{ fontSize: 13 }}>
                    {[whoName(item), formatShortDate(item.visitDate ?? item.uploadedAt, locale), source].filter(Boolean).join(" · ")}
                  </Txt>
                </View>
                {!item.apptId ? (
                  <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("remove")} style={{ padding: 6 }}>
                    <Ionicons name="trash-outline" size={20} color={colors.muted} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                )}
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={!!picked} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicked(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <TopBar back="close" title={t("addRecord")} onBack={() => setPicked(null)} />
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
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
              <Chip label={profile.data?.firstName || t("me")} selected={memberId === null} onPress={() => setMemberId(null)} />
              {members.map((m) => (
                <Chip key={m.memberId} label={m.firstName} sublabel={relationLabel(t, m.relation)} selected={memberId === m.memberId} onPress={() => setMemberId(m.memberId)} />
              ))}
            </View>
            {error ? <Banner tone="danger" icon="alert-circle" text={error} /> : null}
          </ScrollView>
          <View style={{ padding: space.lg }}>
            <Button label={busy ? t("uploading") : t("save")} icon="cloud-upload" loading={busy} onPress={upload} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const isImage = (d: HealthLockerDocument) => !!d.storageUrl && /\.(jpe?g|png|webp|heic)(\?|$)/i.test(d.fileName || d.storageUrl);

const MONTHS: Record<Locale, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  hinglish: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  bn: ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"],
};
const monthTitle = (ym: string, locale: Locale) => `${MONTHS[locale][Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  person: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingLeft: 6, paddingRight: space.md + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.card },
  personOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  thumb: { width: 52, height: 64, borderRadius: 10, overflow: "hidden", backgroundColor: colors.segment },
  cover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(16,35,31,0.35)", alignItems: "center", justifyContent: "center" },
  addCard: { backgroundColor: colors.primary, borderRadius: radius.lg + 2, padding: space.lg, gap: space.md },
  doc: { flexDirection: "row", alignItems: "center", padding: space.md + 2, backgroundColor: colors.card, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.line },
  docFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  docLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  docDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
