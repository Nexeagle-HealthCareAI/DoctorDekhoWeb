import { useEffect, useRef, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius } from "../lib/theme";

const LENGTH = 6;

/**
 * Six boxes over one hidden TextInput: typing, pasting and the OS one-time-code autofill all land in the same field,
 * and `onComplete` fires the moment the sixth digit arrives so the patient never taps "Verify".
 */
export function OtpInput({ value, onChange, onComplete, error }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; error?: boolean }) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="One-time code">
      <View style={styles.row}>
        {Array.from({ length: LENGTH }).map((_, i) => {
          const active = i === Math.min(value.length, LENGTH - 1);
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, error && styles.boxError]}>
              <Text style={styles.digit}>{value[i] ?? ""}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, "").slice(0, LENGTH);
          onChange(digits);
          if (digits.length === LENGTH) onComplete(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  boxActive: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  digit: { fontSize: 24, fontWeight: "700", color: colors.ink },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
});
