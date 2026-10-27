import type { Locale } from "./i18n/types";

/**
 * Doctor and hospital names arrive from EasyHMS in English letters only. In Hindi and Bengali the app shows them in the
 * reader's own script: common Indian names and titles from a spelling list (so "Sharma" is शर्मा, not शर्म), everything
 * else by pronunciation rules. English and Hinglish keep the original. This is a display convenience, not data: when
 * EasyHMS stores names in Hindi/Bengali, use those instead.
 */

// Words whose usual spelling the rules would not get right.
const HI_WORDS: Record<string, string> = {
  dr: "डॉ.", "dr.": "डॉ.", doctor: "डॉक्टर", md: "मो.", "md.": "मो.", mohd: "मो.", "mohd.": "मो.", mr: "श्री", mrs: "श्रीमती", ms: "सुश्री", prof: "प्रो.", "prof.": "प्रो.",
  sharma: "शर्मा", verma: "वर्मा", gupta: "गुप्ता", singh: "सिंह", kumar: "कुमार", kumari: "कुमारी", khan: "ख़ान", ali: "अली", mishra: "मिश्रा",
  jha: "झा", yadav: "यादव", prasad: "प्रसाद", sinha: "सिन्हा", pandey: "पांडेय", tiwari: "तिवारी", tripathi: "त्रिपाठी", chaudhary: "चौधरी",
  choudhary: "चौधरी", das: "दास", roy: "रॉय", ghosh: "घोष", banerjee: "बनर्जी", chatterjee: "चटर्जी", mukherjee: "मुखर्जी", sen: "सेन",
  bose: "बोस", dutta: "दत्ता", iyer: "अय्यर", reddy: "रेड्डी", rao: "राव", nair: "नायर", patel: "पटेल", shah: "शाह", mehta: "मेहता",
  joshi: "जोशी", agarwal: "अग्रवाल", aggarwal: "अग्रवाल", jain: "जैन", saxena: "सक्सेना", srivastava: "श्रीवास्तव", thakur: "ठाकुर",
  mohammad: "मोहम्मद", mohammed: "मोहम्मद", muhammad: "मुहम्मद", ahmed: "अहमद", ahmad: "अहमद", hussain: "हुसैन", hasan: "हसन",
  ansari: "अंसारी", rahman: "रहमान", alam: "आलम", noori: "नूरी", siddiqui: "सिद्दीक़ी", qureshi: "क़ुरैशी", akhtar: "अख़्तर", imam: "इमाम",
  rakesh: "राकेश", ananya: "अनन्या", sunil: "सुनील", meera: "मीरा", priya: "प्रिया", amit: "अमित", anil: "अनिल", sanjay: "संजय",
  rajesh: "राजेश", suresh: "सुरेश", ramesh: "रमेश", mahesh: "महेश", vikas: "विकास", deepak: "दीपक", manoj: "मनोज", pooja: "पूजा",
  neha: "नेहा", rahul: "राहुल", ravi: "रवि", alok: "आलोक", kavya: "काव्या", farhan: "फ़रहान", reena: "रीना", tapas: "तापस", anita: "अनीता",
  sunita: "सुनीता", vijay: "विजय", ajay: "अजय", arun: "अरुण", ashok: "अशोक", rajiv: "राजीव", sanjeev: "संजीव", pradeep: "प्रदीप",
  sandeep: "संदीप", nitin: "नितिन", rohit: "रोहित", sachin: "सचिन", shweta: "श्वेता", swati: "स्वाति", kiran: "किरण", nisha: "निशा",
  tabish: "ताबिश", saman: "समन", ayesha: "आयशा", fatima: "फ़ातिमा", zara: "ज़ारा", imran: "इमरान", irfan: "इरफ़ान", salman: "सलमान",
  manish: "मनीष", prabhat: "प्रभात", aftab: "आफ़ताब", anand: "आनंद", ranjan: "रंजन", nikhil: "निखिल", pallavi: "पल्लवी", gaurav: "गौरव",
  shreya: "श्रेया", deepti: "दीप्ति", ritesh: "रितेश", rupesh: "रूपेश", kishore: "किशोर", sanjeevani: "संजीवनी", mandal: "मंडल", bimal: "बिमल",
  vivek: "विवेक", abhishek: "अभिषेक", ashish: "आशीष", satish: "सतीश", harish: "हरीश", girish: "गिरीश", dinesh: "दिनेश", naresh: "नरेश",
  mukesh: "मुकेश", umesh: "उमेश", rajeev: "राजीव", praveen: "प्रवीण", pravin: "प्रवीण", nitesh: "नितेश", ankit: "अंकित", akash: "आकाश",
  aakash: "आकाश", saurabh: "सौरभ", shubham: "शुभम", prakash: "प्रकाश", santosh: "संतोष", subhash: "सुभाष", jitendra: "जितेंद्र",
  surendra: "सुरेंद्र", rajendra: "राजेंद्र", narendra: "नरेंद्र", mahendra: "महेंद्र", upendra: "उपेंद्र", krishna: "कृष्ण", shyam: "श्याम",
  ram: "राम", radha: "राधा", sita: "सीता", geeta: "गीता", gita: "गीता", rekha: "रेखा", seema: "सीमा", poonam: "पूनम", archana: "अर्चना",
  kumkum: "कुमकुम", shabnam: "शबनम", nazia: "नाज़िया", nasreen: "नसरीन", shahid: "शाहिद", zahid: "ज़ाहिद", javed: "जावेद", tariq: "तारिक़",
  asif: "आसिफ़", arif: "आरिफ़", rizwan: "रिज़वान", faisal: "फ़ैसल", anwar: "अनवर", iqbal: "इक़बाल", nadeem: "नदीम", wasim: "वसीम",
  hospital: "अस्पताल", clinic: "क्लिनिक", nursing: "नर्सिंग", home: "होम", care: "केयर", centre: "सेंटर", center: "सेंटर", health: "हेल्थ",
  medical: "मेडिकल", city: "सिटी", point: "पॉइंट", max: "मैक्स", life: "लाइफ़", line: "लाइन", seva: "सेवा", sadan: "सदन", purnea: "पूर्णिया",
};

const BN_WORDS: Record<string, string> = {
  dr: "ডাঃ", "dr.": "ডাঃ", doctor: "ডাক্তার", md: "মোঃ", "md.": "মোঃ", mohd: "মোঃ", "mohd.": "মোঃ", mr: "শ্রী", mrs: "শ্রীমতী", prof: "অধ্যাপক",
  roy: "রায়", ray: "রায়", das: "দাস", ghosh: "ঘোষ", banerjee: "ব্যানার্জী", chatterjee: "চ্যাটার্জী", mukherjee: "মুখার্জী", sen: "সেন",
  bose: "বসু", basu: "বসু", dutta: "দত্ত", datta: "দত্ত", mitra: "মিত্র", saha: "সাহা", pal: "পাল", paul: "পাল", sarkar: "সরকার",
  chakraborty: "চক্রবর্তী", bhattacharya: "ভট্টাচার্য", mondal: "মণ্ডল", mandal: "মণ্ডল", biswas: "বিশ্বাস", majumdar: "মজুমদার",
  sharma: "শর্মা", verma: "ভার্মা", gupta: "গুপ্ত", singh: "সিং", kumar: "কুমার", kumari: "কুমারী", khan: "খান", ali: "আলী", jha: "ঝা",
  mishra: "মিশ্র", sinha: "সিনহা", prasad: "প্রসাদ", yadav: "যাদব", rahman: "রহমান", hussain: "হোসেন", hossain: "হোসেন", ahmed: "আহমেদ",
  islam: "ইসলাম", alam: "আলম", noori: "নূরী", mohammad: "মোহাম্মদ", ananya: "অনন্যা", priya: "প্রিয়া", rakesh: "রাকেশ", sunil: "সুনীল",
  hospital: "হাসপাতাল", clinic: "ক্লিনিক", nursing: "নার্সিং", home: "হোম", care: "কেয়ার", centre: "সেন্টার", center: "সেন্টার",
  health: "হেলথ", medical: "মেডিকেল", city: "সিটি", purnea: "পূর্ণিয়া",
};

// Rule-based fallback: English spelling of an Indian name → Devanagari.
const CONS: [string, string][] = [
  ["chh", "छ"], ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"],
  ["k", "क"], ["g", "ग"], ["c", "क"], ["j", "ज"], ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["b", "ब"], ["m", "म"], ["y", "य"],
  ["r", "र"], ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["f", "फ़"], ["z", "ज़"], ["q", "क़"], ["x", "क्स"],
];
// [spelling, standalone letter, sign after a consonant]
const VOWELS: [string, string, string][] = [
  ["aa", "आ", "ा"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"], ["ee", "ई", "ी"], ["ii", "ई", "ी"], ["oo", "ऊ", "ू"], ["ou", "औ", "ौ"],
  ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"], ["e", "ए", "े"], ["o", "ओ", "ो"],
];
const STOPS = new Set(["k", "kh", "g", "gh", "c", "ch", "chh", "j", "jh", "t", "th", "d", "dh", "p", "ph", "b", "bh"]);

function ruleHindi(word: string): string {
  const w = word.toLowerCase();
  let out = "";
  let i = 0;
  let prevCons = false;
  while (i < w.length) {
    const v = VOWELS.find(([s]) => w.startsWith(s, i));
    if (v) {
      const [s, full, sign] = v;
      const last = i + s.length >= w.length;
      // After a consonant, at the end of a name: "a" and "i" are long (Sharma → शर्मा, Pallavi → पल्लवी) and "e" is silent
      // (Kishore → किशोर). In the middle, "a" is the consonant's own sound.
      if (prevCons) out += s === "a" ? (last ? "ा" : "") : last && s === "i" ? "ी" : last && s === "e" && i > 1 ? "" : sign;
      else out += full;
      i += s.length;
      prevCons = false;
      continue;
    }
    const c = CONS.find(([s]) => w.startsWith(s, i));
    if (!c) {
      out += w[i];
      i++;
      prevCons = false;
      continue;
    }
    const [s, letter] = c;
    const nextIsCons = !!CONS.find(([t]) => w.startsWith(t, i + s.length)) && !VOWELS.find(([t]) => w.startsWith(t, i + s.length));
    // "y" at the very end after a consonant sounds "ee" (Pandey's ey is handled by e+y below).
    if (s === "y" && prevCons && i + 1 === w.length) {
      out += "ी";
      i++;
      prevCons = false;
      continue;
    }
    // n/m before a stop consonant is a nasal mark (Sanjay → संजय).
    const nextStop = [...STOPS].some((t) => w.startsWith(t, i + s.length));
    if ((s === "n" || s === "m") && nextStop && !prevCons) {
      out += "ं";
      i += s.length;
      continue;
    }
    if (prevCons) out += "्";
    out += letter;
    i += s.length;
    prevCons = true;
    if (!nextIsCons) continue;
  }
  return out;
}

// Devanagari → Bengali is mostly a fixed shift of 0x80 in Unicode; a few letters have no twin.
const BN_FIX: Record<string, string> = { "व": "ব", "ऑ": "অ", "ॉ": "া", "ळ": "ল", "ऱ": "র", "़": "" };
function toBengali(deva: string): string {
  let out = "";
  for (const ch of deva) {
    if (ch in BN_FIX) out += BN_FIX[ch];
    else {
      const code = ch.charCodeAt(0);
      out += code >= 0x0900 && code <= 0x097f ? String.fromCharCode(code + 0x80) : ch;
    }
  }
  return out
    // A nasal before a consonant joins it, as Bengali writes it (রংজন → রঞ্জন, পাংডেয → পাণ্ডেয).
    .replace(/ং(?=[কখগঘ])/g, "ঙ্").replace(/ং(?=[চছজঝ])/g, "ঞ্").replace(/ং(?=[টঠডঢ])/g, "ণ্").replace(/ং(?=[তথদধন])/g, "ন্").replace(/ং(?=[পফবভম])/g, "ম্")
    // "y" after a vowel is য় in Bengali; য stays only at the start or as the ্য sign.
    .replace(/(?<!^|্|\s)য/g, "য়");
}

const cache = new Map<string, string>();

/** A name in the reader's script: Hindi → Devanagari, Bengali → Bengali; English and Hinglish unchanged. */
export function localName(name: string | null | undefined, locale: Locale): string {
  if (!name) return "";
  if (locale !== "hi" && locale !== "bn") return name;
  const key = `${locale}|${name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const words = locale === "bn" ? BN_WORDS : HI_WORDS;
  const result = name
    .split(/(\s+|[,()&/-])/)
    .map((part) => {
      if (!/[A-Za-z]/.test(part)) return part;
      const lower = part.toLowerCase();
      if (words[lower]) return words[lower];
      // Initials such as "A." or "R" stay as they are.
      if (/^[A-Za-z]\.?$/.test(part)) return part.toUpperCase();
      const hi = HI_WORDS[lower] ?? ruleHindi(part.replace(/\./g, ""));
      return locale === "bn" ? toBengali(hi) : hi;
    })
    .join("");
  cache.set(key, result);
  return result;
}
