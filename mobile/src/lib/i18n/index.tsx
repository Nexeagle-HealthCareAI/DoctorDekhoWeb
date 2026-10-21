import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DICTIONARIES, en, type StringKey } from "./strings";
import type { Locale } from "./types";

const STORAGE_KEY = "dd_locale";

type Ctx = {
  locale: Locale;
  /** True once the user has picked a language (or one was restored). */
  chosen: boolean;
  ready: boolean;
  setLocale: (l: Locale) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

/** First-launch guess from the phone's language list; the user confirms it on the first screen. */
function deviceLocale(): Locale {
  for (const l of getLocales()) {
    if (l.languageCode === "hi") return "hi";
    if (l.languageCode === "bn") return "bn";
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  const [chosen, setChosen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "en" || v === "hi" || v === "bn" || v === "hinglish") {
          setLocaleState(v);
          setChosen(true);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setChosen(true);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      let s: string = DICTIONARIES[locale][key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, chosen, ready, setLocale, t }), [locale, chosen, ready, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
