import type { Locale } from "./i18n/types";

// Bookings are made against Indian hospitals, so "today" is always today in India (UTC+05:30), whatever the phone's zone.
const IST_OFFSET_MIN = 330;

function istNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() + IST_OFFSET_MIN) * 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD for today + `offsetDays`, in India. */
export function istDateString(offsetDays = 0): string {
  const d = istNow();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Current hour in India, 0–23. */
export function istHour(): number {
  return istNow().getHours();
}

const MONTHS: Record<Locale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hinglish: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  hi: ["जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुला", "अग", "सित", "अक्टू", "नव", "दिस"],
  bn: ["জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"],
};

const WEEKDAYS: Record<Locale, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  hinglish: ["Ravi", "Som", "Mangal", "Budh", "Guru", "Shukra", "Shani"],
  hi: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
  bn: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"],
};

/** Parse "YYYY-MM-DD" or an ISO date-time into its calendar parts without any timezone shift. */
export function dateParts(value: string): { y: number; m: number; d: number; weekday: number } {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

export function formatShortDate(value: string, locale: Locale): string {
  const p = dateParts(value);
  return `${WEEKDAYS[locale][p.weekday]}, ${p.d} ${MONTHS[locale][p.m - 1]}`;
}

export function dayChipParts(value: string, locale: Locale): { weekday: string; day: string; month: string } {
  const p = dateParts(value);
  return { weekday: WEEKDAYS[locale][p.weekday], day: String(p.d), month: MONTHS[locale][p.m - 1] };
}

/** "10:30 AM" from an ISO date-time's clock part (EasyHMS sends hospital-local times). */
export function formatTime(value?: string | null): string {
  if (!value || value.length < 16) return "";
  const h = Number(value.slice(11, 13));
  const m = value.slice(14, 16);
  if (h === 0 && m === "00") return "";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** 10 digits only, dropping a leading +91 / 0 the user may paste. */
export function cleanMobile(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(-10);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.slice(0, 10);
}

export const isValidMobile = (m: string) => /^[6-9]\d{9}$/.test(m);
