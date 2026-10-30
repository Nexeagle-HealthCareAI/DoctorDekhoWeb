import type { ArticlePerson, HealthArticle } from "./types";

// Example articles for local design review only: set HEALTH_WIKI_SAMPLE=true. Names, numbers and
// text are made up. Never served unless that variable is set (see server.ts).

const person = (p: Partial<ArticlePerson> & Pick<ArticlePerson, "id" | "name" | "kind">): ArticlePerson => ({
  speciality: null, qualification: null, roleTitle: null, organisation: null, photoUrl: null,
  registrationNumber: null, registrationCouncil: null, verified: false, ...p,
});

const meera = person({ id: "s1", name: "Dr. Meera Nair", kind: "HOSPITAL_DOCTOR", speciality: "Endocrinologist", qualification: "MBBS, MD, DM (Endocrinology)", registrationNumber: "48213", registrationCouncil: "Delhi Medical Council", verified: true });
const imran = person({ id: "s2", name: "Dr. Imran Qureshi", kind: "INDEPENDENT_DOCTOR", speciality: "General Physician", qualification: "MBBS, MD (Medicine)", registrationNumber: "40116", registrationCouncil: "Delhi Medical Council", verified: true });
const team = person({ id: "s3", name: "NexEagle content team", kind: "STAFF", roleTitle: "Editorial" });
const rohan = person({ id: "s4", name: "Rohan Mehta", kind: "WRITER", roleTitle: "Product manager", organisation: "HealthTech India" });

export const sampleArticles: HealthArticle[] = [
  {
    slug: "high-blood-pressure", type: "MEDICAL", title: "Living with High Blood Pressure",
    description: "What the numbers mean, and daily habits that help keep them in range.",
    content: "## Know your numbers\n\nA normal reading is below **120/80**. Readings above **140/90** on two visits usually need treatment.\n\n## Daily habits that help\n\n- Cut salt to under 5 g a day\n- Walk 30 minutes, five days a week\n- Check your pressure at home, at the same time each day\n\n> Do not stop a prescribed medicine without asking your doctor.\n\n## When to see a doctor\n\nGo to an emergency room if a very high reading comes with chest pain, severe headache or trouble speaking. Read more at [the WHO page on hypertension](https://www.who.int/news-room/fact-sheets/detail/hypertension).",
    coverImageUrl: "/health-wiki-sample/bp-cover.svg", coverImageAlt: "Abstract blue and violet gradient",
    relatedConditionSlug: "hypertension", disclosure: null,
    references: ["World Health Organization. Hypertension fact sheet.", "Indian Council of Medical Research. Guidelines for management of hypertension."],
    author: team, reviewer: meera, publishedAt: "2026-09-29T10:00:00Z", updatedAt: "2026-10-02T08:30:00Z",
  },
  {
    slug: "silent-heart-attack", type: "MEDICAL", title: "Recognising a Silent Heart Attack",
    description: "Symptoms that are easy to miss, and when to go to an emergency room.",
    content: "## Why it is missed\n\nSome heart attacks cause mild discomfort, tiredness or indigestion rather than crushing chest pain. People with diabetes and many women report these milder signs.\n\n## Signs to take seriously\n\n- Pressure or heaviness in the chest that comes and goes\n- Unusual tiredness for a few days\n- Breathlessness with light activity\n- Pain spreading to the jaw, neck or arm\n\n## What to do\n\nCall emergency services. Do not drive yourself.",
    coverImageUrl: "/health-wiki-sample/heart-cover.svg", coverImageAlt: "Abstract red and amber gradient",
    relatedConditionSlug: "heart-disease",
    disclosure: "The author consults for a hospital that treats heart disease.",
    references: ["Indian Council of Medical Research. Acute coronary syndrome guidance."],
    author: imran, reviewer: imran, publishedAt: "2026-10-04T09:00:00Z", updatedAt: "2026-10-04T09:00:00Z",
  },
  {
    slug: "abdm-and-hospital-records", type: "SECTOR_UPDATE", title: "How ABDM Is Changing Hospital Records",
    description: "What the Ayushman Bharat Digital Mission means for how hospitals store and share patient records.",
    content: "## What is changing\n\nHospitals are linking patient records to a national health ID so that records can follow the patient from one hospital to another.\n\n## What it means for hospitals\n\n- Digital records instead of paper files\n- Consent-based sharing between hospitals\n- A common format for lab reports and discharge summaries\n\n## What to watch\n\nSmaller clinics need affordable software that supports the new format.",
    coverImageUrl: "/health-wiki-sample/sector-cover.svg", coverImageAlt: "Abstract teal and navy gradient",
    relatedConditionSlug: null, disclosure: null, references: [],
    author: rohan, reviewer: null, publishedAt: "2026-10-03T08:00:00Z", updatedAt: "2026-10-03T08:00:00Z",
  },
  {
    slug: "thyroid-basics", type: "MEDICAL", title: "Thyroid Basics",
    description: "Hypothyroidism and hyperthyroidism explained in plain language.",
    content: "## What the thyroid does\n\nA small gland in your neck that controls how fast your body uses energy.\n\n## Tests\n\nA **TSH** blood test is the first step.",
    coverImageUrl: null, coverImageAlt: null, relatedConditionSlug: "thyroid", disclosure: null, references: [],
    author: team, reviewer: meera, publishedAt: "2026-09-20T08:00:00Z", updatedAt: "2026-09-20T08:00:00Z",
  },
];
