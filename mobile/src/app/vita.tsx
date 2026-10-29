import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
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
import { vitaChat, type VitaReply } from "../lib/api/vita";
import { useI18n } from "../lib/i18n";
import { useHomePlace } from "../lib/location";
import { useQuietPosition } from "../lib/map";
import { useDoctors } from "../lib/queries";
import { SPEECH_LANG, useVoiceSearch } from "../lib/speech";
import { plainSpecialty, SYMPTOMS } from "../lib/specialties";
import { speakable } from "../lib/spokenNumbers";
import { colors, radius, space } from "../lib/theme";
import { CHAT_STATUS, chatMood, VITA_MET_KEY, WORKING_AFTER_MS } from "../lib/vitaMood";

type Turn = { id: number; from: "me" } & { text: string } | { id: number; from: "vita"; text: string; reply?: VitaReply; failed?: boolean };

/**
 * Vita, the Doctor Dekho helper. The patient speaks or types what's wrong in Hindi, Hinglish, Bengali or English; Vita
 * (the NLP router's conversational agent) asks a follow-up question or two, then names the right kind of doctor and
 * shows doctors nearby who can be booked in one tap. Danger signs go straight to "go to hospital / call 108".
 *
 * Replies are read aloud after a spoken question (and on request). Nothing of the conversation is stored on the phone;
 * the router keeps the conversation for 30 minutes so follow-ups make sense, and "New chat" starts over.
 */
export default function VitaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const doctors = useDoctors();
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

  const send = useCallback(
    async (raw: string, spoken = false) => {
      const msg = raw.trim();
      if (!msg || busy) return;
      spokenTurn.current = spoken;
      setText("");
      setTurns((ts) => [...ts, { id: nextId.current++, from: "me", text: msg }]);
      setBusy(true);
      try {
        const reply = await vitaChat({
          text: msg,
          sessionId: session.current,
          city: place?.city ?? null,
          ...(here ? { lat: here.lat, lng: here.lng } : place?.lat != null && place?.lng != null ? { lat: place.lat, lng: place.lng } : {}),
        });
        session.current = reply.sessionId || session.current;
        setTurns((ts) => [...ts, { id: nextId.current++, from: "vita", text: reply.message, reply }]);
        if (reply.kind === "emergency") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        if (spokenTurn.current || reply.kind === "emergency") say(reply.kind === "emergency" ? `${reply.message} ${t("vitaEmergency")}` : reply.message);
      } catch (e) {
        const busyNow = e instanceof ApiError && e.status === 429;
        setTurns((ts) => [...ts, { id: nextId.current++, from: "vita", text: busyNow ? (e as ApiError).message || t("vitaError") : t("vitaError"), failed: true }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, place, here, say, t],
  );

  // Speak, and send what was heard as soon as the sentence ends.
  const voice = useVoiceSearch(locale, (heard, final) => {
    setText(heard);
    if (final) void send(heard, true);
  });

  const reset = () => {
    void Speech.stop();
    session.current = null;
    setTurns([]);
    setText("");
  };

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [turns.length, busy]);

  const lastFailed = turns.length > 0 && turns[turns.length - 1].from === "vita" && (turns[turns.length - 1] as { failed?: boolean }).failed;
  const lastMine = [...turns].reverse().find((x) => x.from === "me");
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
              {turn.reply ? replyExtras(turn.reply) : null}
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
        {lastFailed && lastMine && !busy ? <Button label={t("retry")} icon="refresh" variant="secondary" size="md" onPress={() => void send(lastMine.text, spokenTurn.current)} /> : null}

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
  function replyExtras(reply: VitaReply) {
    if (reply.kind === "emergency") {
      return (
        <View style={styles.emergency}>
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
            <Ionicons name="warning" size={22} color={colors.danger} />
            <Txt variant="bodyBold" color={colors.danger} style={{ flex: 1 }}>
              {t("vitaEmergency")}
            </Txt>
          </View>
          <Button label={t("vitaCall108")} icon="call" variant="danger" onPress={() => void Linking.openURL("tel:108")} />
          <Button label={t("vitaNearestHospital")} icon="medkit" variant="secondary" size="md" onPress={() => router.push({ pathname: "/doctors", params: { specialty: "emergencymedicine" } })} />
        </View>
      );
    }
    if (reply.kind !== "recommendation") return null;
    const main = reply.specialists.find((s) => s.role === "PRIMARY") ?? reply.specialists[0];
    const docs = reply.doctorIds.map((id) => byId.get(id.toLowerCase())).filter((d): d is Doctor => !!d);
    return (
      <View style={{ gap: space.sm }}>
        {reply.specialists.length ? (
          <View style={{ gap: 6 }}>
            <Txt variant="smallBold" color={colors.muted}>
              {t("vitaUsually")}
            </Txt>
            <View style={styles.specRow}>
              {reply.specialists
                .filter((s) => s.specialtyId)
                .slice(0, 3)
                .map((s, i) => (
                  <Pressable
                    key={`${s.specialist}-${i}`}
                    onPress={() => router.push({ pathname: "/doctors", params: { specialty: s.specialtyId! } })}
                    accessibilityRole="button"
                    style={[styles.spec, i === 0 && styles.specMain]}
                  >
                    <Txt variant="smallBold" color={i === 0 ? "#fff" : colors.primaryDark}>
                      {plainSpecialty(s.specialtyId!, locale)}
                    </Txt>
                  </Pressable>
                ))}
            </View>
          </View>
        ) : null}
        {docs.length ? (
          <>
            <Txt variant="smallBold" color={colors.muted}>
              {t("vitaDoctorsNear")}
            </Txt>
            {docs.slice(0, 3).map((d) => (
              <DoctorCard key={d.id} doctor={d} onPress={() => router.push(`/doctor/${d.id}`)} onBook={() => router.push(`/book/${d.id}`)} />
            ))}
          </>
        ) : null}
        {main?.specialtyId ? (
          <Button
            label={t("vitaSeeAll", { specialty: plainSpecialty(main.specialtyId, locale) })}
            icon="search"
            variant={docs.length ? "outline" : "primary"}
            size="md"
            onPress={() => router.push({ pathname: "/doctors", params: { specialty: main.specialtyId! } })}
          />
        ) : null}
      </View>
    );
  }
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
  bar: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
  mic: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  micOn: { backgroundColor: colors.danger },
  inputWrap: { flex: 1, minHeight: 56, maxHeight: 120, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.bg },
  input: { fontSize: 16, color: colors.ink, paddingVertical: 10 },
  send: { width: 48, height: 48, marginBottom: 4, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
});
