import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, font, radius, space, TAP } from "../lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export function Txt({
  children,
  variant = "body",
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: "title" | "heading" | "body" | "bodyBold" | "small" | "smallBold" | "tiny";
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  haptic = true,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "whatsapp";
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}) {
  const off = disabled || loading;
  const bg = {
    primary: colors.primary,
    secondary: colors.primarySoft,
    ghost: "transparent",
    danger: colors.dangerSoft,
    whatsapp: colors.whatsapp,
  }[variant];
  const fg = { primary: "#fff", secondary: colors.primaryDark, ghost: colors.primary, danger: colors.danger, whatsapp: "#fff" }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={20} color={fg} style={{ marginRight: space.sm }} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  icon,
  sublabel,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: IconName;
  sublabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
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
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
        pressed && !selected ? { backgroundColor: colors.primarySoft } : null,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={selected ? "#fff" : colors.primary} style={{ marginRight: 6 }} /> : null}
      <View style={{ alignItems: "center" }}>
        <Text style={[styles.chipText, selected && { color: "#fff" }, disabled && { color: colors.faint }]}>{label}</Text>
        {sublabel ? <Text style={[styles.chipSub, selected && { color: "#E6F4F1" }]}>{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, style]}>
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
  return (
    <View style={[{ marginBottom: space.lg }, style as StyleProp<ViewStyle>]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        accessibilityLabel={label || undefined}
        {...input}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={[styles.row, { justifyContent: "space-between", marginTop: space.xl, marginBottom: space.md }]}>
      <Txt variant="heading">{title}</Txt>
      {action ? (
        <Pressable onPress={onAction} hitSlop={12}>
          <Txt variant="smallBold" color={colors.primary}>
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Txt variant="heading" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {body ? (
        <Txt color={colors.muted} style={{ textAlign: "center", marginTop: space.sm }}>
          {body}
        </Txt>
      ) : null}
      {action && onAction ? <Button label={action} onPress={onAction} style={{ marginTop: space.xl, alignSelf: "stretch" }} /> : null}
    </View>
  );
}

export function Banner({ text, tone = "info", icon }: { text: string; tone?: "info" | "warning" | "danger" | "success"; icon?: IconName }) {
  const bg = { info: colors.primarySoft, warning: colors.warningSoft, danger: colors.dangerSoft, success: colors.successSoft }[tone];
  const fg = { info: colors.primaryDark, warning: colors.warning, danger: colors.danger, success: colors.success }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: space.sm }} /> : null}
      <Text style={{ color: fg, fontSize: font.small, flex: 1, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function ListRow({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.bg }]}>
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.primary} />
      <Text style={[styles.listLabel, danger && { color: colors.danger }]}>{label}</Text>
      {value ? <Text style={styles.listValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space.xxl, alignItems: "center" }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.title, fontWeight: "700", color: colors.ink, lineHeight: 32 },
  heading: { fontSize: font.heading, fontWeight: "700", color: colors.ink, lineHeight: 26 },
  body: { fontSize: font.body, color: colors.text, lineHeight: 22 },
  bodyBold: { fontSize: font.body, color: colors.text, fontWeight: "600", lineHeight: 22 },
  small: { fontSize: font.small, color: colors.muted, lineHeight: 20 },
  smallBold: { fontSize: font.small, color: colors.text, fontWeight: "600", lineHeight: 20 },
  tiny: { fontSize: font.tiny, color: colors.muted, lineHeight: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  button: { minHeight: TAP + 4, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  buttonText: { fontSize: font.body, fontWeight: "700" },
  chip: {
    minHeight: TAP - 4,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { backgroundColor: colors.bg, borderStyle: "dashed" },
  chipText: { fontSize: font.small, fontWeight: "600", color: colors.text },
  chipSub: { fontSize: font.tiny, color: colors.muted, marginTop: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.line },
  label: { fontSize: font.small, fontWeight: "600", color: colors.text, marginBottom: space.sm },
  input: {
    minHeight: TAP + 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontSize: font.body,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  error: { color: colors.danger, fontSize: font.tiny, marginTop: space.xs },
  hint: { color: colors.muted, fontSize: font.tiny, marginTop: space.xs },
  empty: { alignItems: "center", padding: space.xxl, marginTop: space.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  banner: { flexDirection: "row", alignItems: "center", padding: space.md, borderRadius: radius.md },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: TAP + 8,
    paddingHorizontal: space.lg,
    gap: space.md,
    backgroundColor: colors.card,
  },
  listLabel: { flex: 1, fontSize: font.body, color: colors.text, fontWeight: "500" },
  listValue: { fontSize: font.small, color: colors.muted },
});
