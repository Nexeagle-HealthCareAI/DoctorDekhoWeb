// One small design system for the whole app: Doctor Dekho teal, warm neutrals, large tap targets.

export const colors = {
  primary: "#0F766E",
  primaryDark: "#0B5952",
  primarySoft: "#E6F4F1",
  accent: "#F59E0B",
  ink: "#14213D",
  text: "#1F2937",
  muted: "#5B6472",
  faint: "#9AA3AF",
  line: "#E3E7EA",
  bg: "#F6F8F7",
  card: "#FFFFFF",
  danger: "#B42318",
  dangerSoft: "#FDECEA",
  success: "#15803D",
  successSoft: "#E8F6EC",
  warning: "#B45309",
  warningSoft: "#FEF3E2",
  whatsapp: "#25D366",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const font = {
  title: 26,
  heading: 20,
  body: 16,
  small: 14,
  tiny: 12,
} as const;

/** Minimum touch target, in density-independent pixels. */
export const TAP = 48;
