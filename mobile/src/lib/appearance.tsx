import AsyncStorage from "@react-native-async-storage/async-storage";
import { isLoaded, loadAsync, useFonts } from "expo-font";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "./i18n";

// Only the weights the app uses, imported one by one so the other weights never ship in the bundle.
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { NotoSansDevanagari_500Medium } from "@expo-google-fonts/noto-sans-devanagari/500Medium";
import { NotoSansDevanagari_600SemiBold } from "@expo-google-fonts/noto-sans-devanagari/600SemiBold";
import { NotoSansDevanagari_700Bold } from "@expo-google-fonts/noto-sans-devanagari/700Bold";
import { NotoSansDevanagari_800ExtraBold } from "@expo-google-fonts/noto-sans-devanagari/800ExtraBold";
import { NotoSansBengali_500Medium } from "@expo-google-fonts/noto-sans-bengali/500Medium";
import { NotoSansBengali_600SemiBold } from "@expo-google-fonts/noto-sans-bengali/600SemiBold";
import { NotoSansBengali_700Bold } from "@expo-google-fonts/noto-sans-bengali/700Bold";
import { NotoSansBengali_800ExtraBold } from "@expo-google-fonts/noto-sans-bengali/800ExtraBold";

export type Weight = "500" | "600" | "700" | "800";
type Script = "latin" | "devanagari" | "bengali";

const FAMILY: Record<Script, Record<Weight, string>> = {
  latin: { "500": "PJS-500", "600": "PJS-600", "700": "PJS-700", "800": "PJS-800" },
  devanagari: { "500": "NSD-500", "600": "NSD-600", "700": "NSD-700", "800": "NSD-800" },
  bengali: { "500": "NSB-500", "600": "NSB-600", "700": "NSB-700", "800": "NSB-800" },
};

const LATIN = { "PJS-500": PlusJakartaSans_500Medium, "PJS-600": PlusJakartaSans_600SemiBold, "PJS-700": PlusJakartaSans_700Bold, "PJS-800": PlusJakartaSans_800ExtraBold };
const DEVANAGARI = { "NSD-500": NotoSansDevanagari_500Medium, "NSD-600": NotoSansDevanagari_600SemiBold, "NSD-700": NotoSansDevanagari_700Bold, "NSD-800": NotoSansDevanagari_800ExtraBold };
const BENGALI = { "NSB-500": NotoSansBengali_500Medium, "NSB-600": NotoSansBengali_600SemiBold, "NSB-700": NotoSansBengali_700Bold, "NSB-800": NotoSansBengali_800ExtraBold };

const BIG_TEXT_KEY = "dd_big_text";
/**
 * Calm mode (stored under the old "bigger text" key, so people who turned that on keep it): every size is
 * multiplied by this on top of the phone's own font-size setting, nothing moves, and bars are solid.
 */
const BIG_SCALE = 1.15;

type Ctx = {
  /** Font family for a weight in the current language's script; undefined until fonts load (system font meanwhile). */
  family: (w: Weight) => string | undefined;
  /** Extra line height for Indic scripts, whose marks sit above and below the line. */
  lineFactor: number;
  scale: number;
  bigText: boolean;
  setBigText: (on: boolean) => void;
  /** Calm mode: bigger text + no movement + solid bars. Same switch as bigText. */
  calm: boolean;
  setCalm: (on: boolean) => void;
  fontsReady: boolean;
};

const AppearanceCtx = createContext<Ctx | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const script: Script = locale === "hi" ? "devanagari" : locale === "bn" ? "bengali" : "latin";
  const [latinOk] = useFonts(LATIN);
  // Indic fonts load only for the language that needs them (about 1.4 MB per script), and again whenever the
  // language changes — expo-font's useFonts only ever loads the map it was first given.
  const scriptOk = useScriptFonts(script);

  const [bigText, setBig] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(BIG_TEXT_KEY)
      .then((v) => setBig(v === "1"))
      .catch(() => {});
  }, []);
  const setBigText = useCallback((on: boolean) => {
    setBig(on);
    AsyncStorage.setItem(BIG_TEXT_KEY, on ? "1" : "0").catch(() => {});
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      family: (w) => (scriptOk ? FAMILY[script][w] : latinOk ? FAMILY.latin[w] : undefined),
      lineFactor: script === "latin" ? 1.3 : 1.5,
      scale: bigText ? BIG_SCALE : 1,
      bigText,
      setBigText,
      calm: bigText,
      setCalm: setBigText,
      fontsReady: latinOk,
    }),
    [script, scriptOk, latinOk, bigText, setBigText],
  );
  return <AppearanceCtx.Provider value={value}>{children}</AppearanceCtx.Provider>;
}

const SCRIPT_FONTS: Record<Exclude<Script, "latin">, Record<string, number>> = { devanagari: DEVANAGARI, bengali: BENGALI };

function useScriptFonts(script: Script): boolean {
  const map = script === "latin" ? null : SCRIPT_FONTS[script];
  const allLoaded = () => !map || Object.keys(map).every((f) => isLoaded(f));
  const [ready, setReady] = useState(allLoaded);
  useEffect(() => {
    if (!map) return setReady(true);
    if (allLoaded()) return setReady(true);
    setReady(false);
    let live = true;
    loadAsync(map)
      .then(() => live && setReady(true))
      .catch(() => live && setReady(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);
  return ready && allLoaded();
}

export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceCtx);
  if (!ctx) throw new Error("useAppearance must be used inside AppearanceProvider");
  return ctx;
}

/** Style for text of a given size and weight in the current script and text size. */
export function useTextStyle() {
  const { family, lineFactor, scale } = useAppearance();
  return useCallback(
    (size: number, weight: Weight = "500") => {
      const fontSize = Math.round(size * scale);
      const fontFamily = family(weight);
      return {
        fontSize,
        lineHeight: Math.round(fontSize * lineFactor),
        ...(fontFamily ? { fontFamily } : { fontWeight: weight as "500" | "600" | "700" | "800" }),
      };
    },
    [family, lineFactor, scale],
  );
}
