// WhatsApp numbers for contributor sign-in. India stays a bare 10-digit number (what the API has always stored);
// every other country is sent as "+<country code><number>" (E.164), which the API stores with the "+".

export interface Country { iso: string; name: string; dial: string }

/** India first (the default), then the other countries people most often write from. */
export const COUNTRIES: Country[] = [
  { iso: "IN", name: "India", dial: "91" },
  { iso: "AE", name: "United Arab Emirates", dial: "971" },
  { iso: "US", name: "United States", dial: "1" },
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "GB", name: "United Kingdom", dial: "44" },
  { iso: "AU", name: "Australia", dial: "61" },
  { iso: "NZ", name: "New Zealand", dial: "64" },
  { iso: "SG", name: "Singapore", dial: "65" },
  { iso: "MY", name: "Malaysia", dial: "60" },
  { iso: "SA", name: "Saudi Arabia", dial: "966" },
  { iso: "QA", name: "Qatar", dial: "974" },
  { iso: "KW", name: "Kuwait", dial: "965" },
  { iso: "OM", name: "Oman", dial: "968" },
  { iso: "BH", name: "Bahrain", dial: "973" },
  { iso: "NP", name: "Nepal", dial: "977" },
  { iso: "BD", name: "Bangladesh", dial: "880" },
  { iso: "LK", name: "Sri Lanka", dial: "94" },
  { iso: "PK", name: "Pakistan", dial: "92" },
  { iso: "ZA", name: "South Africa", dial: "27" },
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "KE", name: "Kenya", dial: "254" },
  { iso: "DE", name: "Germany", dial: "49" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "IE", name: "Ireland", dial: "353" },
  { iso: "PH", name: "Philippines", dial: "63" },
  { iso: "ID", name: "Indonesia", dial: "62" },
  { iso: "TH", name: "Thailand", dial: "66" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

/** Digits the person typed, without a leading 0 (a local dialling prefix) for countries other than India. */
export const cleanNational = (country: Country, typed: string): string => {
  const digits = typed.replace(/\D/g, "");
  return country.dial === "91" ? digits.slice(0, 10) : digits.replace(/^0+/, "").slice(0, 15 - country.dial.length);
};

/** The value to send to the API, or null when the number cannot be right yet. */
export function toApiMobile(country: Country, typed: string): string | null {
  const national = cleanNational(country, typed);
  if (country.dial === "91") return /^[6-9]\d{9}$/.test(national) ? national : null;
  const total = country.dial.length + national.length;
  return total >= 8 && total <= 15 ? `+${country.dial}${national}` : null;
}

/** "+91 98765 43210" style text for the "sent to" line. */
export const displayMobile = (country: Country, typed: string): string => `+${country.dial} ${cleanNational(country, typed)}`;
