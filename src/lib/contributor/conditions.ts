/** Conditions the "Need a specialist?" card on an article can link to. */
export const CONDITION_OPTIONS = ["diabetes", "hypertension", "thyroid", "asthma", "pcos", "heart-disease", "arthritis", "migraine"];

export const SLUG_LABEL = (s: string) => s.replace(/-/g, " ");

/** The text a writer types for a condition that is not in the list, as the address-style name the article stores ("Knee pain" becomes "knee-pain"). Empty when nothing usable is typed. */
export function slugifyCondition(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
