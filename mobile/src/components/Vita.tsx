import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { Animated, Easing, View, type StyleProp, type ViewStyle } from "react-native";
import type { VitaMotion, VitaPose } from "../lib/vitaMood";
import { useReduceMotion } from "./Motion";

const POSES: Record<VitaPose, number> = {
  welcome: require("../../assets/vita/welcome.webp"),
  wave: require("../../assets/vita/wave.webp"),
  thinking: require("../../assets/vita/thinking.webp"),
  working: require("../../assets/vita/working.webp"),
  joyful: require("../../assets/vita/joyful.webp"),
  relaxed: require("../../assets/vita/relaxed.webp"),
  resting: require("../../assets/vita/resting.webp"),
  flying: require("../../assets/vita/flying.webp"),
  sleeping: require("../../assets/vita/sleeping.webp"),
  eating: require("../../assets/vita/eating.webp"),
};

/**
 * Vita the eagle, in one pose, kept gently alive:
 * - breathe: a slow 2% swell (the default when Vita is just there)
 * - bob: a soft float up and down (flying)
 * - sway: a small side-to-side tilt (speaking, waving)
 * - hop: one spring up when something good just happened (a request sent)
 * Changing the pose pops the new one in (180 ms). With reduce motion or Calm mode everything is still.
 * Decorative: the words next to Vita carry the meaning, so screen readers skip her.
 */
export function Vita({ pose, size, motion = "breathe", ring, style }: { pose: VitaPose; size: number; motion?: VitaMotion; ring?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const idle = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const halo = useRef(new Animated.Value(0)).current;

  // Pop the new pose in.
  useEffect(() => {
    if (reduce) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0.82);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 160, useNativeDriver: true }).start();
  }, [pose, reduce, pop]);

  // The idle loop (or the one-off hop).
  useEffect(() => {
    idle.stopAnimation();
    idle.setValue(0);
    if (reduce || motion === "still") return;
    if (motion === "hop") {
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(idle, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(idle, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
      return;
    }
    const period = motion === "bob" ? 1600 : motion === "sway" ? 1300 : 1700;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motion, reduce, idle]);

  // A soft teal ring that pulses while Vita listens.
  useEffect(() => {
    halo.setValue(0);
    if (!ring || reduce) return;
    const loop = Animated.loop(Animated.timing(halo, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [ring, reduce, halo]);

  const lift = idle.interpolate({ inputRange: [0, 1], outputRange: [0, motion === "hop" ? -size * 0.14 : motion === "bob" ? -size * 0.05 : 0] });
  const tilt = idle.interpolate({ inputRange: [0, 1], outputRange: motion === "sway" ? ["-3deg", "3deg"] : ["0deg", "0deg"] });
  const swell = Animated.multiply(pop, idle.interpolate({ inputRange: [0, 1], outputRange: [1, motion === "breathe" ? 1.025 : 1] }));

  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      {ring ? (
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: "#0B6B63",
            opacity: reduce ? 0.5 : halo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: reduce ? 1.05 : halo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.3] }) }],
          }}
        />
      ) : null}
      <Animated.View style={{ width: size, height: size, transform: [{ translateY: lift }, { rotate: tilt }, { scale: swell }] }}>
        <Image source={POSES[pose]} style={{ width: size, height: size }} contentFit="contain" transition={0} accessible={false} />
      </Animated.View>
    </View>
  );
}

/** Vita's small round face for chat bubbles: her head and shoulders (the resting pose) in a soft teal circle. */
export function VitaAvatar({ size = 32 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E3F1EE", overflow: "hidden", alignItems: "center", justifyContent: "flex-end" }} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={POSES.resting} style={{ width: size * 1.25, height: size * 1.25, marginBottom: -size * 0.12 }} contentFit="contain" accessible={false} />
    </View>
  );
}
