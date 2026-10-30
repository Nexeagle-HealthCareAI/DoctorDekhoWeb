import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoctorCard } from "../components/DoctorCard";
import { Vita, VitaAvatar } from "../components/Vita";
import { Banner, Button, Txt } from "../components/ui";
import type { Doctor } from "../lib/api/doctors";
import { ApiError } from "../lib/api/http";
import { vitaChat, vitaForget, type VitaDoctor, type VitaOption, type VitaReply, type VitaRequest } from "../lib/api/vita";
import { careState } from "../lib/care";
import { formatShortDate, rupees } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { useHomePlace } from "../lib/location";
import { askForPosition, useQuietPosition } from "../lib/map";
import { keys, useDoctors, useMyAppointments } from "../lib/queries";
import { contactSupport } from "../lib/support";
import { localName } from "../lib/translit";
import { SPEECH_LANG, useVoiceSearch } from "../lib/speech";
import { SYMPTOMS } from "../lib/specialties";
import { speakable } from "../lib/spokenNumbers";
import { colors, radius, space } from "../lib/theme";
import { CHAT_STATUS, chatMood, VITA_MET_KEY, WORKING_AFTER_MS } from "../lib/vitaMood";

type Turn = { id: number; from: "me"; text: string } | { id: number; from: "vita"; text: string; reply?: VitaReply; failed?: boolean };

/** How a turn is sent: a chip or button can send one text and show another, or nothing at all. */
type SendOpts = Pick<VitaRequest, "select_doctor_id" | "page" | "new_search"> & {
  spoken?: boolean;
  /** Shown in the patient's bubble instead of the text sent (a tapped chip). */
  shownAs?: string;
  /** No patient bubble (e.g. "Show more doctors"). */
  quiet?: boolean;
  /** A location for this turn only ("Share my location"). */
  at?: { lat: number; lng: number };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UI_LANGUAGE = { en: "en", hi: "hi", bn: "bn", hinglish: "hinglish" } as const;

/**
 * Vita, the Doctor Dekho patient agent — the same agent as the website's chat (router /v2/agent/chat, through the
 * website's /api/vita/chat). The patient speaks or types in Hindi, Hinglish, Bengali or English; Vita can:
 * - work out the right kind of doctor from symptoms (asking a follow-up or two),
 * - find doctors by name, kind, hospital or area ("cheapest skin doctor near me"), page through them, and pick one,
 * - book a visit as the signed-in patient (it asks day, time and who it's for, then confirms),
 * - help with the next visit ("I've reached", directions), and hand over to a person on WhatsApp,
 * - send danger signs straight to "go to hospital / call 108" with the nearest emergency places.
 * Vita's questions come with tap-to-answer options. Replies are read aloud after a spoken question (and on request).
 * Nothing of the conversation is stored on the phone; the router keeps it 30 minutes, and "New chat" forgets it.
 */
export default function VitaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const doctors = useDoctors();
  const qc = useQueryClient();
  const appts = useMyAppointments();
  // The patient's next visit: Vita uses it for "I've reached", directions and check-in.
  const nextVisitId = useMemo(() => careState(appts.data?.appointments ?? []).next?.appointmentId, [appts.data]);
  const { place } = useHomePlace();
  const here = useQuietPosition();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const session = useRef<string | null>(null);
  const nextId = useRef(1);
  const scroll = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const spokenTurn = useRef(false);
  const [speaking, setSpeaking] = useState(false);
  const [waitedLong, setWaitedLong] = useState(false);
  const [firstEver, setFirstEver] = useState(false);

  // Vita waves only the very first time this phone opens her; after that she greets with her coffee.
  useEffect(() => {
    AsyncStorage.getItem(VITA_MET_KEY)
      .then((v) => {
        if (v) return;
        setFirstEver(true);
        void AsyncStorage.setItem(VITA_MET_KEY, "1");
      })
      .catch(() => {});
  }, []);

  // A short "thinking" beat, then "working" once the wait feels like a search (same timing as the website).
  useEffect(() => {
    setWaitedLong(false);
    if (!busy) return;
    const id = setTimeout(() => setWaitedLong(true), WORKING_AFTER_MS);
    return () => clearTimeout(id);
  }, [busy]);

  const byId = useMemo(() => new Map((doctors.data ?? []).map((d) => [d.id.toLowerCase(), d])), [doctors.data]);

  useEffect(() => () => void Speech.stop(), []);

  const say = useCallback(
    (s: string) => {
      if (!voiceOn || !s) return;
      void Speech.stop();
      Speech.speak(speakable(s, locale), {
        language: SPEECH_LANG[locale],
        rate: 0.95,
        onStart: () => setSpeaking(true),
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [voiceOn, locale],
  );

  const lastSend = useRef<{ text: string; opts: SendOpts } | null>(null);

  const send = useCallback(
    async (raw: string, opts: SendOpts = {}) => {
      const msg = raw.trim();
      if (!msg || busy) return;
      lastSend.current = { text: msg, opts };
      spokenTurn.current = !!opts.spoken;
      setText("");
      if (!opts.quiet) setTurns((ts) => [...ts, { id: nextId.current++, from: "me", text: opts.shownAs ?? msg }]);
      setBusy(true);
      const at = opts.at ?? here ?? (place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : null);
      const town = place?.town ?? place?.city ?? null;
      try {
        const reply = await vitaChat({
          text: msg,
          ...(session.current ? { session_id: session.current } : {}),
          ...(town ? { city: town } : {}),
          ...(at ? { lat: at.lat, lng: at.lng } : {}),
          ui_language: UI_LANGUAGE[locale],
          ...(nextVisitId ? { visit_appointment_id: nextVisitId } : {}),
          ...(opts.select_doctor_id ? { select_doctor_id: opts.select_doctor_id } : {}),
          ...(opts.page && opts.page > 1 ? { page: opts.page } : {}),
          ...(opts.new_search ? { new_search: true } : {}),
        });
        session.current = reply.session_id || session.current;
        setTurns((ts) => [...ts, { id: nextId.current++, from: "vita", text: reply.message, reply }]);
        if (reply.kind === "emergency") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        if (reply.kind === "booked") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          void qc.invalidateQueries({ queryKey: keys.appointments });
        }
        if (spokenTurn.current || reply.kind === "emergency") say(reply.kind === "emergency" ? `${reply.message} ${t("vitaEmergency")}` : reply.message);
      } catch (e) {
        const busyNow = e instanceof ApiError && e.status === 429;
        setTurns((ts) => [...ts, { id: nextId.current++, from: "vita", text: busyNow ? t("vitaTooMany") : t("vitaError"), failed: true }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, place, here, say, t, locale, nextVisitId, qc],
  );

  const choose = (d: { doctorId: string; name?: string | null }) =>
    void send("Choose", { select_doctor_id: d.doctorId, shownAs: t("vitaChooseDoctor", { name: localName(d.name ?? "", locale) }) });
  const onOption = (o: VitaOption) => {
    if (UUID.test(o.id)) void send("Choose", { select_doctor_id: o.id, shownAs: o.label });
    else if (o.id === "human") void send("Talk to a person", { shownAs: o.label });
    else void send(o.label);
  };
  const shareLocation = async () => {
    const at = await askForPosition();
    if (at) void send("location", { at, shownAs: t("vitaLocationShared") });
  };

  // Speak, and send what was heard as soon as the sentence ends.
  const voice = useVoiceSearch(locale, (heard, final) => {
    setText(heard);
    if (final) void send(heard, { spoken: true });
  });

  const reset = () => {
    void Speech.stop();
    if (session.current) void vitaForget(session.current);
    session.current = null;
    lastSend.current = null;
    setTurns([]);
    setText("");
  };

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [turns.length, busy]);

  const lastFailed = turns.length > 0 && turns[turns.length - 1].from === "vita" && (turns[turns.length - 1] as { failed?: boolean }).failed;
  const lastVita = [...turns].reverse().find((x) => x.from === "vita") as Extract<Turn, { from: "vita" }> | undefined;
  const mood = chatMood({ last: lastVita, busy, waitedMs: waitedLong ? WORKING_AFTER_MS : 0, listening: voice.listening, firstEver });
  const status = voice.listening ? CHAT_STATUS.listening : speaking && mood !== "emergency" ? CHAT_STATUS.speaking : CHAT_STATUS[mood];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("back")} style={styles.round}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        {/* No eagle in an emergency: the screen is only help. */}
        {mood === "emergency" ? (
          <View style={styles.sos}>
            <Ionicons name="warning" size={24} color="#fff" />
          </View>
        ) : (
          <Vita pose={mood} size={52} motion={speaking ? "sway" : mood === "wave" ? "sway" : "breathe"} ring={voice.listening} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="heading">{t("vitaTitle")}</Txt>
          <Txt variant="small" color={mood === "emergency" ? colors.danger : colors.muted} numberOfLines={1}>
            {t(status)}
          </Txt>
        </View>
        <Pressable
          onPress={() => {
            if (voiceOn) void Speech.stop();
            setVoiceOn(!voiceOn);
          }}
          accessibilityRole="button"
          accessibilityLabel={voiceOn ? t("vitaVoiceOff") : t("vitaVoiceOn")}
          style={styles.round}
        >
          <Ionicons name={voiceOn ? "volume-high" : "volume-mute"} size={22} color={colors.ink} />
        </Pressable>
        {turns.length ? (
          <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel={t("vitaNewChat")} style={styles.round}>
            <Ionicons name="refresh" size={22} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        {!turns.length ? (
          <View style={styles.hero}>
            <Vita pose={firstEver ? "wave" : "welcome"} size={156} motion={firstEver ? "sway" : "breathe"} ring={voice.listening} />
          </View>
        ) : null}
        <VitaBubble text={t("vitaHello")} onListen={() => say(t("vitaHello"))} />
        {!turns.length ? (
          <View style={styles.starters}>
            {SYMPTOMS.map((s) => (
              <Pressable key={s.id} onPress={() => void send(s.label[locale])} accessibilityRole="button" style={({ pressed }) => [styles.starter, pressed && { backgroundColor: colors.primarySoft }]}>
                <Txt variant="smallBold" color={colors.primaryDark}>
                  {s.label[locale]}
                </Txt>
              </Pressable>
            ))}
          </View>
        ) : null}

        {turns.map((turn) =>
          turn.from === "me" ? (
            <View key={turn.id} style={styles.mine}>
              <Txt variant="body" color="#fff">
                {turn.text}
              </Txt>
            </View>
          ) : (
            <View key={turn.id} style={{ gap: space.sm }}>
              <VitaBubble text={turn.text} failed={turn.failed} urgent={turn.reply?.kind === "emergency"} onListen={turn.text ? () => say(turn.text) : undefined} />
              {turn.reply ? replyExtras(turn.reply, turn.id === lastVita?.id) : null}
            </View>
          ),
        )}

        {busy ? (
          <View style={styles.thinking}>
            <Vita pose={waitedLong ? "working" : "thinking"} size={40} motion="breathe" />
            <Txt variant="small" color={colors.muted}>
              {t(waitedLong ? "vitaStatusWorking" : "vitaThinking")}
            </Txt>
          </View>
        ) : null}
        {lastFailed && lastSend.current && !busy ? (
          <Button label={t("retry")} icon="refresh" variant="secondary" size="md" onPress={() => lastSend.current && void send(lastSend.current.text, { ...lastSend.current.opts, quiet: true })} />
        ) : null}

        <Txt variant="tiny" color={colors.muted} center style={{ marginTop: space.sm }}>
          {t("notDiagnosis")}
        </Txt>
      </ScrollView>

      {voice.error === "permission" ? (
        <View style={{ paddingHorizontal: space.lg }}>
          <Banner tone="warning" icon="mic-off" text={t("micPermission")} />
        </View>
      ) : null}

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
        {voice.available ? (
          <Pressable
            onPress={() => {
              void Speech.stop();
              if (voice.listening) voice.stop();
              else void voice.start();
            }}
            accessibilityRole="button"
            accessibilityLabel={voice.listening ? t("stopListening") : t("speak")}
            style={({ pressed }) => [styles.mic, voice.listening && styles.micOn, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <Ionicons name={voice.listening ? "stop" : "mic"} size={26} color="#fff" />
          </Pressable>
        ) : null}
        <View style={[styles.inputWrap, voice.listening && { borderColor: colors.danger }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={voice.listening ? t("listening") : t("vitaPlaceholder")}
            placeholderTextColor={voice.listening ? colors.danger : colors.faint}
            multiline
            maxLength={500}
            style={styles.input}
            accessibilityLabel={t("vitaPlaceholder")}
          />
        </View>
        <Pressable
          onPress={() => void send(text)}
          disabled={!text.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel={t("vitaSend")}
          style={[styles.send, (!text.trim() || busy) && { opacity: 0.4 }]}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  // Called as a function (not a component) so the doctor cards keep their state between messages.
  // `latest`: only the newest reply's chips and buttons can be used (older ones are history).
  function replyExtras(reply: VitaReply, latest: boolean) {
    const off = !latest || busy;
    const block = reply.doctors;
    const clarify = reply.clarify && reply.clarify.kind !== "location" && reply.clarify.kind !== "visit_checkin" ? reply.clarify : null;
    const askLocation = latest && (reply.clarify?.kind === "location" || reply.emergency?.needsLocation);
    const deadEnd = latest && (reply.clarify?.kind === "no_match" || (reply.clarify?.options ?? []).some((o) => o.id === "human"));
    const doctorCard = (d: VitaDoctor) => {
      const known = byId.get(d.doctorId.toLowerCase());
      return known ? (
        <DoctorCard key={d.doctorId} doctor={known} onPress={() => router.push(`/doctor/${known.id}`)} onBook={() => !off && choose(d)} />
      ) : (
        <VitaDoctorRow key={d.doctorId} doctor={d} disabled={off} onChoose={() => choose(d)} />
      );
    };
    return (
      <View style={{ gap: space.sm }}>
        {reply.kind === "emergency" ? (
          <View style={styles.emergency}>
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
              <Ionicons name="warning" size={22} color={colors.danger} />
              <Txt variant="bodyBold" color={colors.danger} style={{ flex: 1 }}>
                {t("vitaEmergency")}
              </Txt>
            </View>
            <Button label={t("vitaCall108")} icon="call" variant="danger" onPress={() => void Linking.openURL("tel:108")} />
            {(reply.emergency?.places ?? []).slice(0, 3).map((p) => (
              <View key={p.settingId} style={styles.place}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt variant="bodyBold" numberOfLines={1}>
                    {p.name}
                  </Txt>
                  <Txt variant="small" color={colors.muted} numberOfLines={2}>
                    {[p.distanceKm != null ? `${p.distanceKm.toFixed(1)} km` : null, p.address].filter(Boolean).join(" · ")}
                  </Txt>
                </View>
                <Button label={t("call")} icon="call" variant="secondary" size="sm" onPress={() => void Linking.openURL(`tel:${p.phone.replace(/[^\d+]/g, "")}`)} />
                {p.mapUrl ? <Button label={t("directions")} icon="navigate" variant="outline" size="sm" onPress={() => void Linking.openURL(p.mapUrl!)} /> : null}
              </View>
            ))}
            {!reply.emergency?.places?.length ? (
              <Button label={t("vitaNearestHospital")} icon="medkit" variant="secondary" size="md" onPress={() => router.push({ pathname: "/doctors", params: { specialty: "emergencymedicine" } })} />
            ) : null}
          </View>
        ) : null}

        {(reply.degraded ?? []).includes("doctor_lookup") ? (
          <Banner tone="warning" icon="cloud-offline" text={t("vitaLookupFailed")} />
        ) : null}

        {block && block.items.length ? (
          <View style={{ gap: space.sm }}>
            <Txt variant="smallBold" color={colors.muted}>
              {t("vitaDoctorsFound", { count: block.total || block.items.length })}
            </Txt>
            {block.items.map(doctorCard)}
            {block.hasMore && latest ? (
              <Button
                label={t("vitaShowMore")}
                icon="chevron-down"
                variant="outline"
                size="md"
                disabled={off}
                onPress={() => void send("aur doctor dikhao", { page: (block.page ?? 1) + 1, shownAs: t("vitaShowMore") })}
              />
            ) : null}
          </View>
        ) : null}

        {(reply.kind === "doctor_selected" || reply.kind === "info") && reply.doctor ? doctorCard(reply.doctor) : null}

        {reply.availability && reply.availability.days.length ? (
          <View style={styles.box}>
            <Txt variant="smallBold">{t("vitaWorkingDays")}</Txt>
            {reply.availability.days.map((d) => (
              <View key={d.date} style={styles.dayRow}>
                <Txt variant="small">{formatShortDate(d.date, locale)}</Txt>
                <Txt variant="small" color={d.isAvailable ? colors.ink : colors.muted}>
                  {d.isAvailable ? d.shifts.map((x) => `${x.start ?? ""}–${x.end ?? ""}`).join(", ") : t("vitaDayOff")}
                </Txt>
              </View>
            ))}
            <Txt variant="tiny" color={colors.muted}>
              {t("vitaHospitalConfirms")}
            </Txt>
          </View>
        ) : null}

        {reply.booking && (reply.clarify?.kind === "book_confirm" || reply.kind === "booked") ? (
          <View style={[styles.box, reply.kind === "booked" && styles.booked]}>
            {reply.kind === "booked" ? (
              <View style={{ alignItems: "center" }}>
                <Vita pose="joyful" size={110} motion="hop" />
                <Txt variant="heading" center>
                  {t("vitaBookedTitle")}
                </Txt>
              </View>
            ) : (
              <Txt variant="smallBold">{t("vitaCheckBooking")}</Txt>
            )}
            <BookingRow label={t("vitaDoctor")} value={[localName(reply.booking.doctorName, locale), reply.booking.specialty].filter(Boolean).join(" · ")} />
            {reply.booking.hospital ? <BookingRow label={t("vitaHospital")} value={localName(reply.booking.hospital, locale)} /> : null}
            <BookingRow label={t("vitaWhen")} value={reply.booking.when} />
            {reply.booking.patientName ? <BookingRow label={t("vitaFor")} value={localName(reply.booking.patientName, locale)} /> : null}
            {reply.booking.fee != null ? <BookingRow label={t("fee")} value={rupees(reply.booking.fee)} /> : null}
            {reply.kind === "booked" ? (
              <>
                <Txt variant="small" color={colors.muted}>
                  {t("vitaHospitalConfirms")}
                </Txt>
                <Button label={t("viewBookings")} icon="calendar" size="md" onPress={() => router.navigate("/appointments")} />
              </>
            ) : null}
          </View>
        ) : null}

        {reply.kind === "visit" && latest ? <Button label={t("viewBookings")} icon="calendar" variant="outline" size="md" onPress={() => router.navigate("/appointments")} /> : null}

        {reply.kind === "handoff" ? (
          <Button label={t("vitaWhatsapp")} icon="logo-whatsapp" variant="secondary" size="md" onPress={() => contactSupport("whatsapp", t("vitaWhatsappMessage"))} />
        ) : null}

        {askLocation ? <Button label={t("vitaShareLocation")} icon="locate" size="md" disabled={off} onPress={() => void shareLocation()} /> : null}

        {clarify && clarify.options.length && latest ? (
          <View style={styles.specRow} accessibilityLabel={clarify.question ?? undefined}>
            {clarify.options.map((o) => (
              <Pressable
                key={o.id + o.label}
                onPress={() => !off && onOption(o)}
                disabled={off}
                accessibilityRole="button"
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.primarySoft }, off && { opacity: 0.5 }]}
              >
                <Txt variant="smallBold" color={colors.primaryDark}>
                  {o.label}
                </Txt>
              </Pressable>
            ))}
          </View>
        ) : null}

        {deadEnd ? <Button label={t("vitaNewChat")} icon="refresh" variant="outline" size="sm" onPress={reset} /> : null}
      </View>
    );
  }
}

/** A doctor Vita found who isn't in the app's directory yet (new or filtered out): name, kind, place, fee, Choose. */
function VitaDoctorRow({ doctor, disabled, onChoose }: { doctor: VitaDoctor; disabled: boolean; onChoose: () => void }) {
  const { t, locale } = useI18n();
  const fee = doctor.discountedFee ?? doctor.consultFee;
  return (
    <View style={styles.box}>
      <Txt variant="bodyBold">{localName(doctor.name ?? "", locale)}</Txt>
      <Txt variant="small" color={colors.muted} numberOfLines={2}>
        {[doctor.specialtyName, doctor.hospital?.name ? localName(doctor.hospital.name, locale) : null, doctor.distanceKm != null ? `${doctor.distanceKm.toFixed(1)} km` : null].filter(Boolean).join(" · ")}
      </Txt>
      {fee != null ? <Txt variant="smallBold">{t("fullFee", { fee: rupees(fee) })}</Txt> : null}
      <Button label={t("book")} size="md" disabled={disabled} onPress={onChoose} />
    </View>
  );
}

function BookingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dayRow}>
      <Txt variant="small" color={colors.muted}>
        {label}
      </Txt>
      <Txt variant="smallBold" style={{ flex: 1, textAlign: "right" }}>
        {value}
      </Txt>
    </View>
  );
}

function VitaBubble({ text, failed, urgent, onListen }: { text: string; failed?: boolean; urgent?: boolean; onListen?: () => void }) {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
      {urgent ? (
        <View style={[styles.sos, { width: 32, height: 32, borderRadius: 16 }]}>
          <Ionicons name="warning" size={18} color="#fff" />
        </View>
      ) : (
        <VitaAvatar size={32} />
      )}
      <View style={[styles.vita, failed && { borderColor: colors.warning, backgroundColor: colors.warningSoft }, urgent && { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
        <Txt variant="body">{text}</Txt>
        {onListen ? (
          <Pressable onPress={onListen} accessibilityRole="button" accessibilityLabel={t("listen")} hitSlop={8} style={styles.listen}>
            <Ionicons name="volume-high" size={16} color={colors.primaryDark} />
            <Txt variant="tinyBold" color={colors.primaryDark}>
              {t("listen")}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: space.lg, paddingBottom: space.sm, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  starters: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingLeft: 40 },
  hero: { alignItems: "center", paddingTop: space.sm },
  sos: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.danger },
  starter: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: "center", backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primarySoft },
  mine: { alignSelf: "flex-end", maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 6, backgroundColor: colors.primary },
  vita: { flex: 1, maxWidth: "86%", padding: 12, paddingBottom: 8, gap: 6, borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  listen: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 28 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 0 },
  specRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  spec: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: "center", backgroundColor: colors.primarySoft },
  specMain: { backgroundColor: colors.primary },
  emergency: { gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.dangerSoft, borderWidth: 1.5, borderColor: colors.danger },
  place: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.card },
  box: { gap: 6, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  booked: { borderColor: colors.primary, borderWidth: 1.5 },
  dayRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  option: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: "center", backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary },
  bar: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
  mic: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  micOn: { backgroundColor: colors.danger },
  inputWrap: { flex: 1, minHeight: 56, maxHeight: 120, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.bg },
  input: { fontSize: 16, color: colors.ink, paddingVertical: 10 },
  send: { width: 48, height: 48, marginBottom: 4, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
});
