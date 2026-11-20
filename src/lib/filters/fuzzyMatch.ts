// Search that forgives spelling. People type a doctor, speciality or town the way it sounds ("taqdees noori" for
// "Taquedis Noori", "urolgist", "purnia" for "Purnea"), and the plain substring match finds nothing for those. This is
// used only when the plain match finds nothing, so a correct spelling never gets looser results.

/** Words that carry no name or place: "urologist near me in purnia" keeps "urologist" and "purnia". */
const FILLER = new Set(["dr", "doctor", "doctors", "best", "top", "near", "me", "in", "at", "of", "for", "the", "a", "and", "hospital"]);

/**
 * The consonants of a word, sounding alike letters folded together. Vowels carry most of the spelling noise in Indian
 * names and towns, so "Taqdees" and "Taquedis" both become "tkds", and "Purnea" and "Purnia" both become "prn".
 */
export function soundKey(word: string): string {
  const w = word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/q/g, "k")
    .replace(/ck/g, "k")
    .replace(/c(?![h])/g, "k")
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/[aeiouyh]/g, "");
  return w.replace(/(.)\1+/g, "$1");
}

/** Edit distance, stopping early once it passes `limit`. */
function withinEdits(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > limit) return false;
    prev = cur;
  }
  return prev[b.length] <= limit;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** Does one typed word match one word of the record, allowing for spelling? */
export function wordMatches(typed: string, candidate: string): boolean {
  if (typed === candidate) return true;
  if (typed.length < 3) return false;
  const a = soundKey(typed);
  const b = soundKey(candidate);
  // Two sounds alone ("pain" = "pn") are only trusted when both words are real words of four letters or more.
  if (a === b) return a.length >= 3 || (typed.length >= 4 && candidate.length >= 4 && a.length >= 2);
  if (a.length < 3 || b.length < 3) return false;
  // "urologist" against the speciality "Urology": one is the start of the other.
  if (a.startsWith(b) || b.startsWith(a)) return true;
  return withinEdits(a, b, a.length >= 6 ? 1 : 0);
}

/** True when every meaningful word typed matches some word of `fields`, however it is spelled. */
export function fuzzyMatches(query: string, fields: string[]): boolean {
  const typed = words(query).filter((w) => !FILLER.has(w));
  if (typed.length === 0) return false;
  const pool = fields.flatMap(words);
  return typed.every((t) => pool.some((c) => wordMatches(t, c)));
}
