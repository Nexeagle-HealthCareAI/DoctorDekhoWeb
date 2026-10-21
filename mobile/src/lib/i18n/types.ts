// Same four locales as the website (DoctorDekhoWeb/src/lib/i18n/types.ts).
export type Locale = "en" | "hi" | "bn" | "hinglish";

export const LOCALES: { code: Locale; nativeLabel: string; englishLabel: string }[] = [
  { code: "en", nativeLabel: "English", englishLabel: "English" },
  { code: "hi", nativeLabel: "हिंदी", englishLabel: "Hindi" },
  { code: "bn", nativeLabel: "বাংলা", englishLabel: "Bengali" },
  { code: "hinglish", nativeLabel: "Hinglish", englishLabel: "Hinglish" },
];

/** The app-profile table stores Hinglish as "hg" (same as the WhatsApp bot). */
export const toServerLanguage = (l: Locale) => (l === "hinglish" ? "hg" : l);
export const fromServerLanguage = (c?: string | null): Locale | null =>
  c === "hg" ? "hinglish" : c === "en" || c === "hi" || c === "bn" ? c : null;
