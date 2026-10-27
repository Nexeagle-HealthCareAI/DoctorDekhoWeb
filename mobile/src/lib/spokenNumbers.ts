import type { Locale } from "./i18n/types";

/**
 * Text-to-speech on many Android phones reads digits in English even with a Hindi or Bengali voice ("₹500" → "five
 * hundred"). Before anything is read aloud, numbers, rupees, times and distance units are written out as words in the
 * app's language, so it says "पाँच सौ रुपये", "পাঁচশো টাকা" or "paanch sau rupaye". English text is left as it is.
 */

const HI = "शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानबे बानबे तिरानबे चौरानबे पचानबे छियानबे सत्तानबे अट्ठानबे निन्यानबे".split(" ");

const HG = "shoonya ek do teen chaar paanch chhah saat aath nau das gyarah barah terah chaudah pandrah solah satrah atharah unnees bees ikkees baees teis chaubees pachchees chhabbees sattaees atthaees untees tees iktees battees taintees chauntees paintees chhattees saintees adtees untaalees chaalees iktaalees bayaalees taintaalees chavaalees paintaalees chhiyaalees saintaalees adtaalees unchaas pachaas ikyaavan baavan tirpan chauvan pachpan chhappan sattaavan atthaavan unsath saath iksath baasath tirsath chaunsath painsath chhiyaasath sadsath adsath unhattar sattar ikhattar bahattar tihattar chauhattar pachhattar chhihattar sathattar athhattar unyaasi assi ikyaasi bayaasi tiraasi chauraasi pachaasi chhiyaasi sattaasi atthaasi navaasi nabbe ikyaanbe baanbe tiraanbe chauraanbe pachaanbe chhiyaanbe sattaanbe atthaanbe ninyaanbe".split(" ");

const BN = "শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো তেরো চোদ্দ পনেরো ষোলো সতেরো আঠারো উনিশ কুড়ি একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আঠাশ ঊনত্রিশ তিরিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ ঊনচল্লিশ চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ ঊনপঞ্চাশ পঞ্চাশ একান্ন বাহান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন ঊনষাট ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি ঊনসত্তর সত্তর একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর ঊনআশি আশি একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি ঊননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই".split(" ");

// Bengali joins the hundreds: একশো, দুশো … নশো.
const BN_HUNDREDS = ["", "একশো", "দুশো", "তিনশো", "চারশো", "পাঁচশো", "ছশো", "সাতশো", "আটশো", "নশো"];

type Lang = "hi" | "bn" | "hinglish";
const WORDS: Record<Lang, { small: string[]; hundred: string; thousand: string; lakh: string; point: string; rupees: string; km: string; m: string; min: string }> = {
  hi: { small: HI, hundred: "सौ", thousand: "हज़ार", lakh: "लाख", point: "दशमलव", rupees: "रुपये", km: "किलोमीटर", m: "मीटर", min: "मिनट" },
  hinglish: { small: HG, hundred: "sau", thousand: "hazaar", lakh: "laakh", point: "point", rupees: "rupaye", km: "kilometre", m: "metre", min: "minute" },
  bn: { small: BN, hundred: "শো", thousand: "হাজার", lakh: "লাখ", point: "দশমিক", rupees: "টাকা", km: "কিলোমিটার", m: "মিটার", min: "মিনিট" },
};

/** A whole number in words (up to 99 lakh), Indian style: 1,25,500 → "एक लाख पच्चीस हज़ार पाँच सौ". */
export function numberWords(n: number, lang: Lang): string {
  const w = WORDS[lang];
  if (!Number.isFinite(n) || n < 0 || n >= 1e7) return String(n);
  n = Math.floor(n);
  if (n < 100) return w.small[n];
  const parts: string[] = [];
  const lakh = Math.floor(n / 1e5);
  const thousand = Math.floor((n % 1e5) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (lakh) parts.push(w.small[lakh], w.lakh);
  if (thousand) parts.push(w.small[thousand], w.thousand);
  if (hundred) parts.push(lang === "bn" ? BN_HUNDREDS[hundred] : `${w.small[hundred]} ${w.hundred}`);
  if (rest) parts.push(w.small[rest]);
  return parts.join(" ");
}

function decimalWords(s: string, lang: Lang): string {
  const [whole, frac] = s.split(".");
  const head = numberWords(Number(whole), lang);
  if (!frac) return head;
  return `${head} ${WORDS[lang].point} ${[...frac].map((d) => WORDS[lang].small[Number(d)]).join(" ")}`;
}

function timeWords(h: number, m: number, lang: Lang): string {
  const hw = numberWords(h, lang);
  if (lang === "hi") return m ? `${hw} बजकर ${numberWords(m, lang)} मिनट` : `${hw} बजे`;
  if (lang === "hinglish") return m ? `${hw} baj kar ${numberWords(m, lang)} minute` : `${hw} baje`;
  return m ? `${hw}টা ${numberWords(m, lang)} মিনিট` : `${hw}টা`;
}

/** Morning / afternoon / evening / night for a 12-hour clock time, as people say it before the time. */
function partOfDay(h12: number, pm: boolean, lang: Lang): string {
  const h = (h12 % 12) + (pm ? 12 : 0);
  const i = h < 12 ? 0 : h < 16 ? 1 : h < 19 ? 2 : 3;
  return { hi: ["सुबह", "दोपहर", "शाम", "रात"], bn: ["সকাল", "দুপুর", "বিকেল", "রাত"], hinglish: ["subah", "dopahar", "shaam", "raat"] }[lang][i];
}

/** The text as it should be spoken in this language. */
export function speakable(text: string, locale: Locale): string {
  if (locale === "en") return text;
  const lang: Lang = locale;
  const w = WORDS[lang];
  return (
    text
      // ₹1,500 / ₹ 500 / Rs 500 → words + rupees
      .replace(/(?:₹|Rs\.?)\s?(\d[\d,]*)/g, (_, d: string) => `${numberWords(Number(d.replace(/,/g, "")), lang)} ${w.rupees}`)
      // 10:30 AM → "सुबह दस बजकर तीस मिनट"
      .replace(/\b(\d{1,2}):(\d{2})(?:\s?(AM|PM|am|pm))?/g, (_, h: string, m: string, ap?: string) => {
        const day = ap ? partOfDay(Number(h), ap.toUpperCase() === "PM", lang) : "";
        return `${day ? `${day} ` : ""}${timeWords(Number(h), Number(m), lang)}`;
      })
      // 3.4 km / 350 m / 12 min
      .replace(/(\d+(?:\.\d+)?)\s?(km|m|min)\b/g, (_, d: string, u: "km" | "m" | "min") => `${decimalWords(d, lang)} ${w[u]}`)
      // any other number
      .replace(/\d[\d,]*(?:\.\d+)?/g, (d) => decimalWords(d.replace(/,/g, ""), lang))
  );
}
