import type { TranslationKey } from "@/lib/i18n/dictionaries/en";
import type { VitaDoctorsBlock } from "./types";

// One-tap narrowing under a doctor list, and suggestions while typing.
//
// Each refine chip sends a sentence the router reads as "the same list, plus this change", written in the
// conversation's own language so the chip never switches Vita's language (the router mirrors the patient).
// Every phrase below is checked against the router's parser (1HMS-NLP-Router doctor_intent).

export type RefineKey = "fee" | "female" | "today" | "near" | "experience";

type Lang = "english" | "hinglish" | "hindi";

const PHRASES: Record<RefineKey, Record<Lang, string>> = {
  fee: { english: "lowest fee among these", hinglish: "inme se kam fees wala", hindi: "इनमें से सबसे सस्ता वाला" },
  female: { english: "lady doctor among these", hinglish: "inme se koi lady doctor", hindi: "इनमें से कोई महिला डॉक्टर" },
  today: { english: "only those available today", hinglish: "inme se aaj available", hindi: "इनमें से आज उपलब्ध" },
  near: { english: "nearest among these", hinglish: "inme se paas wala", hindi: "इनमें से पास वाला" },
  experience: { english: "most experienced among these", hinglish: "inme se sabse experienced", hindi: "इनमें से सबसे अनुभवी" },
};

export const REFINE_LABEL: Record<RefineKey, TranslationKey> = {
  fee: "vita.refineFee",
  female: "vita.refineFemale",
  today: "vita.refineToday",
  near: "vita.refineNear",
  experience: "vita.refineExperience",
};

function lang(language: string | undefined): Lang {
  return language === "hindi" || language === "hinglish" ? language : "english";
}

export function refinePhrase(key: RefineKey, language: string | undefined): string {
  return PHRASES[key][lang(language)];
}

/** The refinements that would still change this list: what is already applied is not offered again. */
export function refineOptions(block: VitaDoctorsBlock): RefineKey[] {
  const f = block.filters ?? {};
  const out: RefineKey[] = [];
  if (f.sort !== "fee") out.push("fee");
  if (!f.gender) out.push("female");
  if (!f.availableToday) out.push("today");
  if (!f.near && f.location !== "shared" && f.sort !== "distance") out.push("near");
  if (f.sort !== "experience") out.push("experience");
  return out;
}

// ------------------------------------------------------------------------------------------ suggestions
// Words a patient starts typing -> a specialty to search. Matched on any word in `match`, in any script.
// The text sent is a specialty name, which carries no language, so a tap never switches Vita's language.
type Labels = Record<"en" | "hi" | "hinglish" | "bn", string>;

export interface Suggestion {
  label: Labels;
  send: string;
  match: string[];
}

const S = (en: string, hi: string, hinglish: string, bn: string, send: string, match: string[]): Suggestion =>
  ({ label: { en, hi, hinglish, bn }, send, match });

export const SUGGESTIONS: Suggestion[] = [
  S("Skin doctor (Dermatologist)", "त्वचा के डॉक्टर (Dermatologist)", "Skin ke doctor (Dermatologist)", "ত্বকের ডাক্তার (Dermatologist)",
    "dermatologist", ["skin", "derma", "twacha", "स्किन", "त्वचा", "khujli", "daane", "ত্বক"]),
  S("Heart doctor (Cardiologist)", "दिल के डॉक्टर (Cardiologist)", "Dil ke doctor (Cardiologist)", "হৃদরোগের ডাক্তার (Cardiologist)",
    "cardiologist", ["heart", "dil", "cardio", "दिल", "हृदय", "হৃদ"]),
  S("Bone doctor (Orthopaedic)", "हड्डी के डॉक्टर (Orthopaedic)", "Haddi ke doctor (Orthopaedic)", "হাড়ের ডাক্তার (Orthopaedic)",
    "orthopaedic", ["bone", "haddi", "ortho", "हड्डी", "joint", "ghutna", "হাড়"]),
  S("Child doctor (Paediatrician)", "बच्चों के डॉक्टर (Paediatrician)", "Bachchon ke doctor (Paediatrician)", "শিশু ডাক্তার (Paediatrician)",
    "paediatrician", ["child", "bachcha", "bachche", "bachchon", "baby", "paed", "pedia", "बच्च", "শিশু"]),
  S("Women's health (Gynaecologist)", "महिला रोग (Gynaecologist)", "Mahila rog (Gynaecologist)", "স্ত্রীরোগ (Gynaecologist)",
    "gynaecologist", ["gyn", "gynae", "mahila rog", "pregnan", "period", "महिला रोग", "স্ত্রী"]),
  S("Eye doctor (Ophthalmologist)", "आँख के डॉक्टर (Eye specialist)", "Aankh ke doctor (Eye specialist)", "চোখের ডাক্তার (Eye specialist)",
    "ophthalmologist", ["eye", "aankh", "आँख", "आंख", "ophth", "চোখ"]),
  S("Ear, nose, throat (ENT)", "कान-नाक-गला (ENT)", "Kaan-naak-gala (ENT)", "নাক-কান-গলা (ENT)",
    "ENT specialist", ["ent", "ear", "nose", "throat", "kaan", "naak", "gala", "कान", "गला", "কান"]),
  S("Teeth (Dentist)", "दाँत के डॉक्टर (Dentist)", "Daant ke doctor (Dentist)", "দাঁতের ডাক্তার (Dentist)",
    "dentist", ["dent", "teeth", "tooth", "daant", "दाँत", "दांत", "দাঁত"]),
  S("Stomach (Gastroenterologist)", "पेट के डॉक्टर (Gastroenterologist)", "Pet ke doctor (Gastroenterologist)", "পেটের ডাক্তার (Gastroenterologist)",
    "gastroenterologist", ["stomach", "pet", "gastro", "पेट", "acidity", "পেট"]),
  S("Brain and nerves (Neurologist)", "दिमाग़ और नसें (Neurologist)", "Dimag aur nas (Neurologist)", "স্নায়ুরোগ (Neurologist)",
    "neurologist", ["neuro", "brain", "dimag", "दिमाग", "migraine", "স্নায়ু"]),
  S("Diabetes and hormones (Endocrinologist)", "शुगर और हॉर्मोन (Endocrinologist)", "Sugar aur hormone (Endocrinologist)", "ডায়াবেটিস ও হরমোন (Endocrinologist)",
    "endocrinologist", ["diabet", "sugar", "thyroid", "शुगर", "endo", "ডায়াবেটিস"]),
  S("Kidney (Nephrologist)", "किडनी (Nephrologist)", "Kidney (Nephrologist)", "কিডনি (Nephrologist)",
    "nephrologist", ["kidney", "nephro", "किडनी", "gurda", "কিডনি"]),
  S("Chest and lungs (Pulmonologist)", "छाती और फेफड़े (Pulmonologist)", "Chhati aur phephde (Pulmonologist)", "বুক ও ফুসফুস (Pulmonologist)",
    "pulmonologist", ["lung", "pulmo", "asthma", "chhati", "saans", "फेफड़", "ফুসফুস"]),
  S("Mental health (Psychiatrist)", "मन का स्वास्थ्य (Psychiatrist)", "Mann ka swasthya (Psychiatrist)", "মানসিক স্বাস্থ্য (Psychiatrist)",
    "psychiatrist", ["mental", "psych", "depress", "anxiety", "tension", "mann", "মানসিক"]),
  S("General physician", "जनरल फ़िज़िशियन", "General physician", "জেনারেল ফিজিশিয়ান",
    "general physician", ["general", "physician", "gp", "fever", "bukhar", "बुखार", "जनरल", "জ্বর"]),
];

/** Up to `limit` suggestions for what the patient has typed so far (2 letters or more). */
export function suggest(draft: string, limit = 3): Suggestion[] {
  const q = draft.trim().toLowerCase();
  if (q.length < 2) return [];
  const last = q.split(/\s+/).at(-1) ?? "";
  return SUGGESTIONS.filter((s) =>
    s.match.some((m) => q.includes(m) || (last.length >= 2 && m.startsWith(last))) && s.send.toLowerCase() !== q,
  ).slice(0, limit);
}
