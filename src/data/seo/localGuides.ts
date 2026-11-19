// Written guidance for a speciality in a town, shown under the doctor list. Only the pairs written here get one; every
// other page keeps its list alone. Keep it to what a patient can use before a visit, with no claim about a named doctor.

export interface LocalGuide {
  heading: string;
  intro: string;
  /** Problems the speciality treats, each with what it feels like. */
  conditions: { name: string; note: string }[];
  /** Signs that should not wait for a routine appointment. */
  seeSoon: string[];
  /** What to carry to the first visit. */
  bring: string[];
  faqs: { q: string; a: string }[];
}

export const LOCAL_GUIDES: Record<string, LocalGuide> = {
  "urology:purnea-bihar": {
    heading: "Urology doctor near me in Purnea (Purnia): when to see a urologist",
    intro:
      "A urologist treats the kidneys, ureters, bladder and urinary passage in men and women, and the male reproductive system. If you are looking for a top urologist in Purnea (Purnia), or in Kishanganj and nearby towns of Seemanchal, you can compare the urology doctors listed above by experience, qualification and fee, and book a slot without travelling to a bigger city first.",
    conditions: [
      { name: "Kidney stones", note: "Sharp pain in the side or back that comes in waves, sometimes with blood in the urine or vomiting." },
      { name: "Urinary infection", note: "Burning while passing urine, passing it often, or a strong smell. It is common in women and in people with diabetes." },
      { name: "Enlarged prostate", note: "Weak stream, getting up at night to pass urine, or a feeling that the bladder does not empty. Mostly after the age of 50." },
      { name: "Blood in the urine", note: "Pink, red or tea-coloured urine, with or without pain." },
      { name: "Bladder control problems", note: "Leaking urine on coughing or laughing, or a sudden urge you cannot hold." },
      { name: "Male health concerns", note: "Pain or swelling in the testicle, and problems with erection or fertility." },
    ],
    seeSoon: [
      "Severe pain in the side or lower belly that does not ease",
      "Fever with chills along with urinary symptoms",
      "Being unable to pass urine at all",
      "Blood in the urine, even once",
      "Sudden pain or swelling in a testicle",
    ],
    bring: [
      "Earlier urine, blood or kidney test reports and any scan (ultrasound or CT)",
      "The medicines you take now, including for sugar and blood pressure",
      "A note of when the problem began and what makes it better or worse",
    ],
    faqs: [
      {
        q: "Which is the best urologist in Purnea (Purnia)?",
        a: "The right urologist depends on your problem. On Doctor Dekho you can compare each urologist's experience, qualifications and consultation fee on their profile, then book the one that suits you.",
      },
      {
        q: "How do I find a top urology doctor near me in Purnia?",
        a: "Open the list above and compare each urologist's experience, qualification and fee, and the hospital where they sit. Pick a slot that suits you and confirm it online; the doctor's profile shows the clinic address.",
      },
      {
        q: "Do I need a referral to see a urologist?",
        a: "No. You can book a urologist directly. Carry your earlier reports, if you have any, so the doctor can start from there.",
      },
      {
        q: "Can I book a urologist appointment online in Purnia?",
        a: "Yes. Choose a urologist from the list, pick a time slot and confirm your booking online. No app or login is needed.",
      },
    ],
  },
};

/** The guide for a speciality in a city, or undefined when none is written. */
export function localGuide(specialtyId: string, cityId: string): LocalGuide | undefined {
  return LOCAL_GUIDES[`${specialtyId}:${cityId}`];
}
