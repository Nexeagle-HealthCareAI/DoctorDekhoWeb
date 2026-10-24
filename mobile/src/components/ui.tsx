import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRevealField } from "./KeyboardScreen";
import { useTextStyle, type Weight } from "../lib/appearance";
import { dateParts } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Locale } from "../lib/i18n/types";
import { contactSupport } from "../lib/support";
import { BIG, colors, font, radius, space, TAP, tints, type Tint } from "../lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

const LOGO = require("../../assets/logo.png");
/** The logo image is 512×363. */
const LOGO_RATIO = 512 / 363;

// ── Text ─────────────────────────────────────────────────────────────────────────────────────────

type Variant = "display" | "title" | "heading" | "subheading" | "body" | "bodyBold" | "small" | "smallBold" | "tiny" | "tinyBold" | "eyebrow";
const VARIANTS: Record<Variant, [number, Weight]> = {
  display: [font.display, "800"],
  title: [font.title, "800"],
  heading: [font.heading, "800"],
  subheading: [font.subheading, "700"],
  body: [font.body, "500"],
  bodyBold: [font.body, "700"],
  small: [font.small, "500"],
  smallBold: [font.small, "700"],
  tiny: [font.tiny, "600"],
  tinyBold: [font.tiny, "700"],
  eyebrow: [13, "700"],
};

/** All text in the app goes through Txt so the language's script font and "Bigger text" apply everywhere. */
export function Txt({
  children,
  variant = "body",
  color,
  style,
  numberOfLines,
  center,
  selectable,
}: {
  children: ReactNode;
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  center?: boolean;
  selectable?: boolean;
}) {
  const ts = useTextStyle();
  const [size, weight] = VARIANTS[variant];
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      maxFontSizeMultiplier={1.6}
      style={[{ color: colors.ink }, ts(size, weight), variant === "eyebrow" ? { textTransform: "uppercase", letterSpacing: 0.6 } : null, center ? { textAlign: "center" } : null, color ? { color } : null, style]}
    >
      {children}
    </Text>
  );
}

// ── Buttons and chips ────────────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "onDark" | "onDarkSoft";
const BUTTON_COLORS: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: "#fff" },
  secondary: { bg: colors.primarySoft, fg: colors.primaryDark },
  outline: { bg: colors.card, fg: colors.primaryDark, border: colors.primary },
  ghost: { bg: "transparent", fg: colors.primaryDark },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  onDark: { bg: "#fff", fg: colors.primaryDark },
  onDarkSoft: { bg: "rgba(255,255,255,0.14)", fg: "#fff" },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading,
  disabled,
  icon,
  style,
  haptic = true,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityLabel?: string;
}) {
  const off = disabled || loading;
  const c = BUTTON_COLORS[variant];
  const h = size === "lg" ? BIG : size === "md" ? TAP : 44;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        // A quick squish on press: instant, no animation library, so it costs nothing on budget phones.
        { minHeight: h, backgroundColor: c.bg, opacity: off ? 0.45 : pressed ? 0.9 : 1, transform: [{ scale: pressed && !off ? 0.97 : 1 }], paddingHorizontal: size === "lg" ? space.xl : space.lg },
        c.border ? { borderWidth: 1.5, borderColor: c.border } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={size === "lg" ? 21 : 19} color={c.fg} style={{ marginRight: space.sm }} /> : null}
          <Txt variant={size === "lg" ? "subheading" : "smallBold"} color={c.fg} style={size === "lg" ? { fontSize: 17 } : { fontSize: 15 }} numberOfLines={2} center>
            {label}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

/** A pill to pick one option. Selected = filled teal. */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
  icon,
  sublabel,
  style,
  tone = "teal",
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: IconName;
  sublabel?: string;
  style?: StyleProp<ViewStyle>;
  tone?: "teal" | "ink";
}) {
  const on = tone === "ink" ? colors.ink : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected ? { backgroundColor: on, borderColor: on } : null,
        disabled && { opacity: 0.45 },
        pressed && !selected ? { backgroundColor: colors.primarySoft } : null,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={selected ? "#fff" : colors.primary} style={{ marginRight: 6 }} /> : null}
      <View style={{ alignItems: "center" }}>
        <Txt variant="smallBold" color={selected ? "#fff" : colors.ink} style={{ fontSize: 15 }}>
          {label}
        </Txt>
        {sublabel ? (
          <Txt variant="tiny" color={selected ? colors.primaryOnDark : colors.muted}>
            {sublabel}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Two or three options in a grey track (Upcoming | Past, Years | Months | Days). */
export function Segmented<T extends string>({ options, value, onChange, style }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.segTrack, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[styles.segItem, on && styles.segItemOn]}
          >
            <Txt variant="smallBold" color={on ? colors.ink : colors.muted} style={{ fontSize: 15 }}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────────────────────────

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (onPress)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { borderColor: colors.primary }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({
  label,
  error,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const ts = useTextStyle();
  const box = useRef<ComponentRef<typeof View>>(null);
  const reveal = useRevealField();
  return (
    <View ref={box} style={[{ marginBottom: space.lg }, style as StyleProp<ViewStyle>]}>
      {label ? (
        <Txt variant="smallBold" style={{ fontSize: 15, marginBottom: space.sm }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={colors.faint}
        accessibilityLabel={label || undefined}
        {...input}
        onFocus={(e) => {
          reveal(box);
          input.onFocus?.(e);
        }}
        style={[styles.input, ts(17, "600"), { lineHeight: undefined }, error ? { borderColor: colors.danger } : null]}
      />
      {error ? (
        <Txt variant="small" color={colors.danger} style={{ marginTop: space.xs }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small" color={colors.muted} style={{ marginTop: space.xs }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <Txt variant="smallBold" style={{ fontSize: 15, marginBottom: space.sm }}>
      {children}
    </Txt>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="heading" style={{ flex: 1 }}>
        {title}
      </Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          <Txt variant="smallBold" color={colors.primary} style={{ fontSize: 15 }}>
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A numbered step heading — booking is three of these on one screen. */
export function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <View style={[styles.row, { gap: 10, marginBottom: space.sm + 2 }]}>
      <View style={styles.stepDot}>
        <Txt variant="tinyBold" color="#fff" style={{ fontSize: 13 }}>
          {n}
        </Txt>
      </View>
      <Txt variant="subheading" style={{ fontWeight: undefined, fontSize: 17 }}>
        {children}
      </Txt>
    </View>
  );
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <IconCircle icon={icon} tint="teal" size={72} />
      <Txt variant="heading" center style={{ marginTop: space.lg }}>
        {title}
      </Txt>
      {body ? (
        <Txt color={colors.muted} center style={{ marginTop: space.xs }}>
          {body}
        </Txt>
      ) : null}
      {action && onAction ? <Button label={action} onPress={onAction} style={{ marginTop: space.xl, alignSelf: "stretch" }} /> : null}
    </View>
  );
}

const BANNER: Record<"info" | "warning" | "danger" | "success", [string, string]> = {
  info: [colors.primarySoft, colors.primaryDark],
  warning: [colors.warningSoft, colors.warning],
  danger: [colors.dangerSoft, colors.danger],
  success: [colors.successSoft, colors.success],
};

export function Banner({ text, tone = "info", icon }: { text: string; tone?: "info" | "warning" | "danger" | "success"; icon?: IconName }) {
  const [bg, fg] = BANNER[tone];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole={tone === "danger" ? "alert" : undefined}>
      {icon ? <Ionicons name={icon} size={19} color={fg} style={{ marginRight: space.sm, marginTop: 1 }} /> : null}
      <Txt variant="smallBold" color={fg} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

/** One row of a grouped list (settings). Put rows inside <ListGroup>. */
export function ListRow({ icon, label, value, onPress, danger, first, right }: { icon: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean; first?: boolean; right?: ReactNode }) {
  const tone = danger ? colors.danger : colors.ink;
  const body = (
    <>
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.primary} />
      <Txt variant="bodyBold" color={tone} style={{ flex: 1, marginLeft: space.md, fontSize: 15 }}>
        {label}
      </Txt>
      {value ? (
        <Txt variant="small" color={colors.muted} style={{ marginRight: space.sm }} numberOfLines={1}>
          {value}
        </Txt>
      ) : null}
      {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </>
  );
  const style = [styles.listRow, !first && styles.listDivider];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...style, pressed && { backgroundColor: colors.bg }]}>
      {body}
    </Pressable>
  );
}

export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

/** A settings row with an on/off switch. */
export function ToggleRow({ icon, label, hint, value, onChange, first }: { icon: IconName; label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; first?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={[styles.listRow, !first && styles.listDivider, hint ? { paddingVertical: space.md } : null]}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Txt variant="bodyBold" style={{ fontSize: 15 }}>
          {label}
        </Txt>
        {hint ? (
          <Txt variant="small" color={colors.muted} style={{ fontSize: 13 }}>
            {hint}
          </Txt>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.switchOff }} thumbColor="#fff" ios_backgroundColor={colors.switchOff} />
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

// ── Identity ─────────────────────────────────────────────────────────────────────────────────────

export function Logo({ height = 30, accessible = true }: { height?: number; accessible?: boolean }) {
  return (
    <Image
      source={LOGO}
      style={{ height, width: Math.round(height * LOGO_RATIO) }}
      contentFit="contain"
      accessible={accessible}
      accessibilityLabel={accessible ? "Doctor Dekho" : undefined}
    />
  );
}

export function Avatar({ initials, tint = "teal", size = 48, photo }: { initials: string; tint?: Tint; size?: number; photo?: string }) {
  const [bg, fg] = tints[tint];
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }} contentFit="cover" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Txt variant="bodyBold" color={fg} style={{ fontSize: Math.round(size * 0.36), lineHeight: undefined }}>
        {initials}
      </Txt>
    </View>
  );
}

export function IconCircle({ icon, tint = "teal", size = 44, square }: { icon: IconName; tint?: Tint; size?: number; square?: boolean }) {
  const [bg, fg] = tints[tint];
  return (
    <View style={{ width: size, height: size, borderRadius: square ? 12 : size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}

const WEEKDAY: Record<Locale, string[]> = {
  en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
  hinglish: ["RAVI", "SOM", "MANGAL", "BUDH", "GURU", "SHUKRA", "SHANI"],
  hi: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
  bn: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"],
};
const MONTH: Record<Locale, string[]> = {
  en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  hinglish: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  hi: ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुला", "अग", "सित", "अक्टू", "नव", "दिस"],
  bn: ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"],
};

/** The calendar tile used on visit cards: weekday, big day number, month. */
export function DateBlock({ date, dark, size = 60 }: { date: string; dark?: boolean; size?: number }) {
  const { locale } = useI18n();
  const p = dateParts(date);
  const fg = dark ? "#fff" : colors.primaryDark;
  const soft = dark ? colors.primaryOnDark : colors.primaryDark;
  return (
    <View style={[styles.dateBlock, { width: size, minHeight: size + 4, backgroundColor: dark ? "rgba(255,255,255,0.14)" : colors.primarySoft }]}>
      <Txt variant="tinyBold" color={soft}>
        {WEEKDAY[locale][p.weekday]}
      </Txt>
      <Txt variant="title" color={fg} style={{ lineHeight: 28 }}>
        {p.d}
      </Txt>
      <Txt variant="tinyBold" color={soft}>
        {MONTH[locale][p.m - 1]}
      </Txt>
    </View>
  );
}

// ── Headers and help ─────────────────────────────────────────────────────────────────────────────

/**
 * The top bar used by every pushed screen: back (or close) on the left, an optional title, any extra buttons,
 * and the Doctor Dekho logo in the right corner.
 */
export function TopBar({ title, back = "back", onBack, right, solid }: { title?: string; back?: "back" | "close" | false; onBack?: () => void; right?: ReactNode; solid?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <SafeAreaView edges={["top"]} style={solid ? { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line } : { backgroundColor: colors.bg }}>
      <View style={styles.topBar}>
        {back ? (
          <IconButton icon={back === "close" ? "close" : "chevron-back"} label={back === "close" ? t("close") : t("back")} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))} />
        ) : null}
        <View style={{ flex: 1, marginHorizontal: space.sm }}>
          {title ? (
            <Txt variant="subheading" numberOfLines={1}>
              {title}
            </Txt>
          ) : null}
        </View>
        {right}
        <View style={{ marginLeft: space.md }}>
          <Logo height={30} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export function IconButton({ icon, label, onPress, bordered }: { icon: IconName; label: string; onPress: () => void; bordered?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, bordered && styles.iconButtonBordered, pressed && { backgroundColor: colors.primarySoft }]}
    >
      <Ionicons name={icon} size={24} color={colors.ink} />
    </Pressable>
  );
}

/** "Help" pill: opens a sheet to WhatsApp or call a person who can book on the patient's behalf. */
export function HelpButton({ context }: { context?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t("helpA11y")} style={({ pressed }) => [styles.helpPill, pressed && { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="headset-outline" size={18} color={colors.ink} />
        <Txt variant="smallBold" style={{ marginLeft: 6 }}>
          {t("help")}
        </Txt>
      </Pressable>
      <HelpSheet visible={open} onClose={() => setOpen(false)} context={context} />
    </>
  );
}

export function HelpSheet({ visible, onClose, context }: { visible: boolean; onClose: () => void; context?: string }) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={t("close")} />
      <SafeAreaView edges={["bottom"]} style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Txt variant="title">{t("helpTitle")}</Txt>
        <Txt color={colors.muted} style={{ marginTop: space.xs, marginBottom: space.xl }}>
          {t("helpBody")}
        </Txt>
        <Button
          label={t("chatOnWhatsApp")}
          icon="logo-whatsapp"
          onPress={() => {
            onClose();
            contactSupport("whatsapp", context ?? t("helpMessage"));
          }}
        />
        <Button
          label={t("callUs")}
          icon="call"
          variant="secondary"
          onPress={() => {
            onClose();
            contactSupport("call");
          }}
          style={{ marginTop: space.md }}
        />
        <Button label={t("cancel")} variant="ghost" size="md" onPress={onClose} style={{ marginTop: space.sm }} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  button: { borderRadius: radius.md + 2, alignItems: "center", justifyContent: "center", paddingVertical: space.sm },
  chip: {
    minHeight: TAP,
    paddingHorizontal: space.lg,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  segTrack: { flexDirection: "row", backgroundColor: colors.segment, borderRadius: radius.md, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
  segItemOn: { backgroundColor: colors.card, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg + 2, borderWidth: 1, borderColor: colors.line, padding: space.lg },
  input: {
    height: BIG,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    borderRadius: radius.md + 2,
    paddingHorizontal: space.lg,
    backgroundColor: colors.card,
    color: colors.ink,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: space.sm },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", padding: space.xl, paddingTop: space.xxl },
  banner: { flexDirection: "row", alignItems: "flex-start", borderRadius: radius.md + 2, paddingVertical: space.md, paddingHorizontal: space.md + 2 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg + 2, borderWidth: 1, borderColor: colors.line, overflow: "hidden" },
  listRow: { flexDirection: "row", alignItems: "center", minHeight: BIG, paddingHorizontal: space.md + 2 },
  listDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  dateBlock: { borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 60 },
  iconButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  iconButtonBordered: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  helpPill: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.lineStrong },
  scrim: { flex: 1, backgroundColor: "rgba(16,35,31,0.4)" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, paddingTop: space.md },
  sheetHandle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, marginBottom: space.lg },
});
