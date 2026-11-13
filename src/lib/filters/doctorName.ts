// Searching the directory by a doctor's name: "dr avinash", "Dr. Avinash Kumar", "avinash kumar ji". Titles, dots and
// honorifics are not part of the name, and every word typed must be in the doctor's name, in any order.

const TITLES = new Set(["dr", "doctor", "doc", "prof", "professor", "mr", "mrs", "ms", "sir", "madam", "ji", "sahab", "saheb"]);
// a name typed with a meeting cue: "dr avinash ko dikhana hai", "avinash se milna hai"
const CUES = /\b(ko|se|ka|ki|ke|dikhana|dikhao|dekhna|dekhana|milna|milao|chahiye|hai|hain|book|appointment|karo|karna|batao|wala|wale|wali)\b.*$/i;

/** The name words of a query, without titles: "Dr. Avinash Kumar ko dikhana hai" -> ["avinash", "kumar"]. */
export function nameWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(CUES, " ")
    .replace(/[^a-zऀ-ॿ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !TITLES.has(w));
}

/** The query starts with a title, so it names a doctor: "dr avinash", "Dr. Sen", "doctor neha sharma". */
export function looksLikeDoctorName(text: string): boolean {
  return /^\s*(dr\.?|doctor|doc)\s+[a-z]/i.test(text) && nameWords(text).length > 0;
}

/** Every typed name word is in the doctor's name (titles and dots ignored). */
export function nameMatches(doctorName: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const name = ` ${nameWords(doctorName).join(" ")} `;
  return words.every((w) => name.includes(` ${w}`));
}
