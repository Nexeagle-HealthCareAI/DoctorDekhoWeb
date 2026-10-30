// Doctor Dekho design tokens — the same values as the "Doctor Dekho App Redesign" canvas.
// Calm and clinical: one teal for actions, warm off-white ground, tinted circles for categories.

export const colors = {
  primary: "#0B6B63",
  primaryDark: "#0B5A53",
  primarySoft: "#E3F1EE",
  primaryOnDark: "#CDEBE6",
  ink: "#10231F",
  text: "#10231F",
  muted: "#5A6763",
  faint: "#8A958F",
  line: "#E2E6E1",
  lineStrong: "#D5DCD6",
  divider: "#EEF1ED",
  bg: "#F6F7F4",
  card: "#FFFFFF",
  segment: "#EDEFEA",
  danger: "#A3261A",
  dangerSoft: "#FDECEA",
  success: "#136C33",
  successStrong: "#17803D",
  successSoft: "#E7F5EC",
  warning: "#7A3E00",
  warningSoft: "#FFF1D6",
  switchOff: "#C5CCC7",
  whatsapp: "#25D366",
} as const;

/** Tinted circles for avatars and categories: [background, foreground]. Every pair passes 4.5:1. */
export const tints = {
  teal: ["#E3F1EE", "#0B5A53"],
  amber: ["#FFF1D6", "#7A3E00"],
  red: ["#FDECEA", "#A3261A"],
  purple: ["#F1E8FB", "#6B2FA8"],
  blue: ["#E6EEFB", "#1E4FA0"],
  gray: ["#EDEFEA", "#3D4A46"],
} as const;
export type Tint = keyof typeof tints;
export const TINT_ORDER: Tint[] = ["teal", "amber", "purple", "blue", "red", "gray"];

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 } as const;

export const font = {
  display: 28,
  title: 24,
  heading: 19,
  subheading: 17,
  body: 16,
  small: 14,
  tiny: 12,
} as const;

/** Minimum touch target in dp; primary actions use BIG. Research with older adults favours larger than platform minimums. */
export const TAP = 48;
export const BIG = 56;
