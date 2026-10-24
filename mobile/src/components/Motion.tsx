import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppearance } from "../lib/appearance";

/**
 * Small, purposeful motion for the next-gen screens. Every piece here stops completely when the phone's
 * "Remove animations / Reduce motion" setting is on, or the app's own Calm mode is on. Only live things loop
 * (the "you are here" dot, "open today", the step a request is on). Only transform and opacity are animated,
 * on the native driver, so budget phones keep 60 fps.
 */
export function useReduceMotion(): boolean {
  const { calm } = useAppearance();
  const phone = usePhoneReduceMotion();
  return calm || phone;
}

function usePhoneReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => live && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** A soft ring that grows and fades behind a dot — the "you are here" pulse on maps. */
export function Pulse({ size, color, style }: { size: number; color: string; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1900, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return (
    <View pointerEvents="none" style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      {reduce ? null : (
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.6] }) }],
          }}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 3, borderColor: "#fff" }} />
    </View>
  );
}

/** Springs its child in once (the ticket's tick). */
export function PopIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    Animated.spring(v, { toValue: 1, delay, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [reduce, delay, v]);
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }]}>{children}</Animated.View>;
}

/** Slides its child up into place once (the ticket card). */
export function RiseIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, { toValue: 1, delay, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduce, delay, v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] }]}>{children}</Animated.View>;
}

const CONFETTI = ["#FFD166", "#FFFFFF", "#FF8A5B", "#9BE3D6", "#7FB3FF"];

/** One short burst of confetti — only when a booking request is sent. Never repeats. */
export function Confetti({ width, count = 18 }: { width: number; count?: number }) {
  const reduce = useReduceMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: 12 + ((i * 53) % Math.max(40, width - 24)),
        top: 10 + ((i * 37) % 120),
        w: i % 3 === 0 ? 10 : 7,
        h: i % 2 === 0 ? 14 : 8,
        color: CONFETTI[i % CONFETTI.length],
        delay: (i % 6) * 110,
        spin: i % 2 === 0 ? 1 : -1,
      })),
    [count, width],
  );
  const vals = useRef(bits.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduce) return;
    Animated.parallel(vals.map((v, i) => Animated.timing(v, { toValue: 1, delay: bits[i].delay, duration: 2300, easing: Easing.in(Easing.quad), useNativeDriver: true }))).start();
  }, [reduce, vals, bits]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {bits.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: b.left,
            top: b.top,
            width: b.w,
            height: b.h,
            borderRadius: 2,
            backgroundColor: b.color,
            opacity: vals[i].interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: vals[i].interpolate({ inputRange: [0, 1], outputRange: [-40, 320] }) },
              { rotate: vals[i].interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${260 * b.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** A small dot with a soft halo that breathes — for things that are live right now ("Open today", the current step). */
export function LiveDot({ size = 10, color, halo }: { size?: number; color: string; halo?: string }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return (
    <View pointerEvents="none" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {reduce ? null : (
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: halo ?? color,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
          }}
        />
      )}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}
