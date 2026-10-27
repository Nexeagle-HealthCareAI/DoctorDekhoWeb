/**
 * "Baalon ka doctor", "daant ke dr", "চোখের ডাক্তার": a patient naming a body part plus "doctor" is asking for one clear
 * specialty. These short phrases are matched here, before the symptom router and the AI. The router's training data has
 * almost no such phrases (and "bal" there means *child*, as in "bal rog"), so it guessed General.
 *
 * Deliberately narrow: used only for short queries that name a doctor ("ka doctor", "ke dr") or are nothing but body-part
 * words ("kaan naak gala"), and that point at exactly ONE specialty. Symptom phrases ("pet mein dard") stay with the router. Anything longer or mixed ("pet aur sir dard") goes to the router and the AI as before.
 */

const DOCTOR_WORDS = new Set([
  "dr", "doctor", "doctors", "docter", "doktor", "daktar", "dactor", "specialist", "vaid", "vaidya",
  "डॉक्टर", "डाक्टर", "डॉ", "चिकित्सक", "विशेषज्ञ", "ডাক্তার", "ডাক্তারের", "বিশেষজ্ঞ",
]);

// Words only; the plural and oblique forms people actually type are listed, since matching is exact per word.
const BODY_PARTS: Record<string, string[]> = {
  dermatology: [
    "baal", "baalon", "baalo", "balon", "balo", "baalon", "hair", "hairfall", "ganja", "ganjapan", "dandruff", "rusi", "roosi",
    "skin", "chamdi", "chamda", "twacha", "khujli", "daad", "muhase", "muhaase", "pimple", "pimples", "acne",
    "बाल", "बालों", "त्वचा", "चमड़ी", "चमड़ा", "खुजली", "मुहांसे", "रूसी", "গঞ্জা",
    "চুল", "চুলের", "ত্বক", "ত্বকের", "চামড়া", "চামড়ার", "চুলকানি", "ব্রণ",
  ],
  dentistry: ["daant", "dant", "daanton", "danton", "daanto", "daat", "teeth", "tooth", "dental", "masude", "masudon", "दांत", "दाँत", "दांतों", "दाँतों", "मसूड़े", "দাঁত", "দাঁতের", "মাড়ি"],
  ophthalmology: ["aankh", "ankh", "aankhon", "ankhon", "aankho", "ankho", "eye", "eyes", "chashma", "आंख", "आँख", "आंखों", "आँखों", "चश्मा", "চোখ", "চোখের", "চশমা"],
  ent: ["kaan", "kaano", "kaanon", "naak", "nak", "gala", "gale", "ear", "ears", "nose", "throat", "कान", "कानों", "नाक", "गला", "गले", "কান", "কানের", "নাক", "নাকের", "গলা", "গলার"],
  orthopedics: ["haddi", "haddiyon", "haddiyo", "jod", "jodon", "ghutna", "ghutne", "ghutno", "kamar", "bone", "bones", "joint", "joints", "knee", "knees", "हड्डी", "हड्डियों", "जोड़", "जोड़ों", "घुटना", "घुटने", "कमर", "হাড়", "হাড়ের", "হাঁটু", "কোমর"],
  cardiology: ["dil", "heart", "hriday", "दिल", "हृदय", "হার্ট", "হৃদয়", "হৃদরোগ"],
  pediatrics: ["bachcha", "bachche", "bachchon", "bachon", "bachhon", "baccha", "bacche", "bachcho", "child", "children", "kids", "baby", "shishu", "बच्चा", "बच्चे", "बच्चों", "शिशु", "বাচ্চা", "বাচ্চার", "বাচ্চাদের", "শিশু", "শিশুর"],
  gynecology: ["mahila", "mahilaon", "aurat", "auraton", "periods", "pregnancy", "garbh", "महिला", "महिलाओं", "गर्भ", "मासिक", "মহিলা", "মহিলাদের", "স্ত্রীরোগ", "প্রসূতি"],
  gastroenterology: ["pet", "stomach", "liver", "पेट", "लीवर", "পেট", "পেটের", "লিভার"],
  pulmonology: ["phephde", "fefde", "lungs", "saans", "फेफड़े", "फेफड़ों", "सांस", "साँस", "ফুসফুস", "শ্বাস"],
  urology: ["peshab", "pishab", "urine", "पेशाब", "প্রস্রাব"],
  endocrinology: ["sugar", "diabetes", "thyroid", "शुगर", "डायबिटीज", "थायराइड", "সুগার", "ডায়াবেটিস", "থাইরয়েড"],
};

const WORD_TO_SPECIALTY = new Map<string, string>();
for (const [id, words] of Object.entries(BODY_PARTS)) for (const w of words) WORD_TO_SPECIALTY.set(w.normalize("NFC"), id);

/** The one specialty a short "body part + doctor" query asks for, or null to let the router and the AI decide. */
export function bodyPartSpecialty(query: string): string | null {
  const words = query
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,!?।:;"'()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return null;
  const hasDoctorWord = words.some((w) => DOCTOR_WORDS.has(w));
  if (!hasDoctorWord && (words.length > 3 || !words.every((w) => WORD_TO_SPECIALTY.has(w)))) return null;
  const hits = new Set(words.map((w) => WORD_TO_SPECIALTY.get(w)).filter((x): x is string => !!x));
  return hits.size === 1 ? Array.from(hits)[0] : null;
}
