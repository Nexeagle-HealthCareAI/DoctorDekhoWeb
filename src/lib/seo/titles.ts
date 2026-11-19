// Titles and descriptions for the directory pages. Search results cut a title at about 60 characters and a
// description at about 155, and the root layout adds " | Doctor Dekho" to every title, so each page offers its
// wording from fullest to shortest and the first one that fits is used.

/** Added to every page title by the root layout (title.template). */
export const TITLE_BRAND = " | Doctor Dekho";
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

/** The first wording that fits once the brand is added; the shortest one when none does. */
export function fitTitle(candidates: string[]): string {
  return candidates.find((c) => c.length + TITLE_BRAND.length <= TITLE_MAX) ?? candidates[candidates.length - 1];
}

/** The first wording that fits a search result's description; the shortest one when none does. */
export function fitDescription(candidates: string[]): string {
  return candidates.find((c) => c.length <= DESCRIPTION_MAX) ?? candidates[candidates.length - 1];
}

// How a patient names the doctor ("urologist"), which is not the name of the speciality ("Urology"). Adding an
// "s" to the speciality gave "Cardiologys"; these are also the words people type into a search box.
const DOCTOR_LABEL: Record<string, string> = {
  general: "General Physician",
  pediatrics: "Pediatrician",
  cardiology: "Cardiologist",
  dermatology: "Dermatologist",
  orthopedics: "Orthopedic Doctor",
  gynecology: "Gynecologist",
  dentistry: "Dentist",
  ent: "ENT Specialist",
  ophthalmology: "Ophthalmologist",
  neurology: "Neurologist",
  psychiatry: "Psychiatrist",
  urology: "Urologist",
  gastroenterology: "Gastroenterologist",
  endocrinology: "Endocrinologist",
  pulmonology: "Pulmonologist",
  nephrology: "Nephrologist",
  oncology: "Oncologist",
  rheumatology: "Rheumatologist",
  physiotherapy: "Physiotherapist",
  dietetics: "Dietitian",
  generalsurgery: "General Surgeon",
  neurosurgery: "Neurosurgeon",
  plasticsurgery: "Plastic Surgeon",
  vascularsurgery: "Vascular Surgeon",
  cardiothoracicsurgery: "Cardiothoracic Surgeon",
  anesthesiology: "Anesthesiologist",
  radiology: "Radiologist",
  pathology: "Pathologist",
  emergencymedicine: "Emergency Medicine Doctor",
  geriatrics: "Geriatrician",
  sportsmedicine: "Sports Medicine Doctor",
};

/** "Cardiologist", for a speciality id; a speciality with no entry here reads "<name> Doctor". */
export function doctorLabel(specialtyId: string, specialtyName: string): string {
  return DOCTOR_LABEL[specialtyId] ?? `${specialtyName} Doctor`;
}

/** "Cardiologists". Every label above takes a plain "s". */
export function doctorLabelPlural(specialtyId: string, specialtyName: string): string {
  return `${doctorLabel(specialtyId, specialtyName)}s`;
}

// ── The wording of each kind of page ────────────────────────────────────────────────────────────────────────────

export const titles = {
  specialty: (label: string) => fitTitle([`Best ${label} Near You | Book Appointment`, `Best ${label} Near You | Book Online`, `${label} Near You`]),
  specialtyCity: (label: string, city: string, state: string) =>
    fitTitle([
      `Best ${label} in ${city}, ${state} | Book Appointment`,
      `Best ${label} in ${city} | Book Appointment`,
      `Best ${label} in ${city} | Book Online`,
      `${label} in ${city}`,
    ]),
  specialtyArea: (label: string, area: string, city: string) =>
    fitTitle([
      `Best ${label} in ${area}, ${city} | Book Appointment`,
      `Best ${label} in ${area}, ${city} | Book Online`,
      `${label} in ${area}, ${city}`,
      `${label} in ${area}`,
    ]),
  conditionCity: (condition: string, city: string, state: string) =>
    fitTitle([
      `Best Doctors for ${condition} in ${city}, ${state} | Book Appointment`,
      `Best Doctors for ${condition} in ${city} | Book Appointment`,
      `Doctors for ${condition} in ${city} | Book Online`,
      `Doctors for ${condition} in ${city}`,
      `${condition} in ${city}`,
    ]),
  conditionArea: (condition: string, area: string, city: string) =>
    fitTitle([
      `Best Doctors for ${condition} in ${area}, ${city} | Book Appointment`,
      `Doctors for ${condition} in ${area}, ${city} | Book Online`,
      `Doctors for ${condition} in ${area}, ${city}`,
      `Doctors for ${condition} in ${area}`,
      `${condition} in ${area}`,
    ]),
  /** `city` ("Kishanganj") is added when given, since people search "<hospital> <town>". */
  hospital: (name: string, city?: string) =>
    fitTitle([
      ...(city ? [`Doctors at ${name}, ${city} | Book Online`, `Doctors at ${name}, ${city}`, `${name}, ${city}`] : []),
      `Top Doctors in ${name} | Book Appointment Online`,
      `Doctors at ${name} | Book Online`,
      `Doctors at ${name}`,
    ]),
};

export const descriptions = {
  /** `place` is "Purnea, Bihar"; left out, the wording is "near you". */
  specialty: (plural: string, place?: string) => {
    const where = place ? `in ${place}` : "near you";
    return fitDescription([
      `Find the best ${plural} ${where}. Compare experience, ratings, and book appointments online instantly on NexEagle Doctor Dekho.`,
      `Find the best ${plural} ${where}. Compare experience and ratings, then book online instantly.`,
    ]);
  },
  condition: (condition: string, where: string) =>
    fitDescription([
      `Find the best doctors specializing in ${condition} in ${where}. Compare experience, ratings, and book appointments online instantly on NexEagle Doctor Dekho.`,
      `Find doctors for ${condition} in ${where}. Compare experience and ratings, then book online instantly.`,
    ]),
  hospital: (name: string, city?: string) => {
    const at = city ? `${name}, ${city}` : name;
    return fitDescription([
      `Find and book appointments with the best doctors practicing at ${at}. Compare verified reviews, experience, and book instantly on NexEagle Doctor Dekho.`,
      `Book appointments with doctors at ${at}. Compare reviews and experience on NexEagle Doctor Dekho.`,
      `Book doctors at ${at} online on NexEagle Doctor Dekho.`,
    ]);
  },
};
