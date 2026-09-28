// ─────────────────────────────────────────────────────────────────────────────
// Patient portal mock data & types.
//
// This is the single source of truth for the patient-facing booking portal UI.
// When the backend is ready, replace the exported arrays with API calls that
// return the same shapes (Doctor, Specialty, Clinic) — the components read only
// from these types, so the UI won't need to change.
// ─────────────────────────────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  name: string;
  /** Tailwind gradient classes used for the avatar fallback (no photos yet). */
  gradient: string;
  /** Two-letter initials shown on the avatar (fallback when no photo). */
  initials: string;
  /** Doctor photo URL from the API; falls back to gradient + initials. */
  photo?: string;
  specialtyId: string;
  specialty: string;
  qualifications: string;
  experienceYears: number;

  // ── Promotion / KPI fields ────────────────────────────────────────────────
  // Optional: the real EasyHMS public API doesn't return any of these (no
  // per-doctor rating, patient counts, fee, or location/clinic — the API key
  // is scoped to one hospital). Populated for the local mock data only; when
  // undefined/empty, the UI hides that section instead of showing a fake zero
  // (see DoctorCard.tsx).
  rating?: number;         // 0–5, e.g. 4.9
  reviewCount?: number;    // number of patients who rated
  patientsServed?: number; // total consultations delivered on the platform
  recommendationPct?: number; // % of patients who recommend the doctor
  waitTimeMins?: number;   // typical waiting time at the clinic

  fee?: number;            // consultation fee, INR
  // CMS-controlled marketing discount — only populated when currently active (real API only,
  // same optional/hide-when-absent convention as the KPI fields above).
  discountPercent?: number;
  discountedFee?: number;
  // Which hospital this doctor belongs to — populated from the real API's
  // hospitalName now that the directory spans every publicly-listed hospital.
  // Mock data leaves this undefined and uses `clinic` instead — see DoctorCard.tsx.
  hospitalName?: string;
  // The stable join key for hospitalName above (PublicDoctorInfo.HospitalId) -- used for lead
  // attribution (recordLead calls) rather than the display-string name, which is lossy (see
  // app/hospitals/[hospital]/page.tsx's slugify/unslugify round-trip). Real API only.
  hospitalId?: string;
  // Full street-level address as entered on the hospital's own profile — real API only,
  // undefined for mock data (same optional/hide-when-absent convention as the KPI fields).
  address?: string;
  // City name alone is NOT unique in India (e.g. "Kishanganj" is a town in Bihar
  // AND a locality in Delhi). Always filter/match on (city, state) together —
  // see CityOption/cityKey below. Never compare `city` in isolation.
  city: string;
  state: string;
  pincode?: string;
  // The hospital's own contact number as entered on its profile (never the doctor's personal
  // number) — real API only, undefined for mock data (same hide-when-absent convention as above).
  hospitalPhone?: string;
  area: string;
  clinic: string;
  languages: string[];
  // GPS pin for a "get directions" link — from the real API only (inherited from the
  // doctor's hospital); undefined for mock data, same optional/hide-when-absent
  // convention as the KPI fields above.
  latitude?: number;
  longitude?: number;
  /** Distance from user (straight-line or driving depending on resolution phase). Computed client-side. */
  distanceKm?: number;    // Computed by the frontend during spatial search
  /** Estimated driving duration in minutes from OSRM. Computed client-side. */
  drivingDurationMin?: number;
  nextAvailable: string;  // human label, e.g. "Today, 4:30 PM" — mock data only, see isAvailableToday
  // TimeOff > Override > Template precedence resolved for today's date — real API only, undefined
  // for mock data (same optional/hide-when-absent convention as the other real-only fields above).
  // Drives the card's live "Available today" / "Not available today" badge.
  isAvailableToday?: boolean;
  // Manual, doctor/staff-set "online now" toggle — real API only, undefined for mock data
  // (same optional/hide-when-absent convention as isAvailableToday above). Drives a distinct
  // "Online now" pulsing-dot indicator on the avatar, separate from isAvailableToday.
  isOnlineNow?: boolean;
  verified: boolean;
  promoted: boolean;      // "featured" / top-of-list placement
  about: string;
  focusAreas: string[];   // conditions the doctor commonly treats
}

// SEO-friendly doctor URL: keyword-rich slug with the real id suffixed after a
// "--" separator, so lookup is exact (never guess a doctor from name text) while
// the URL itself still reads as "dr-ananya-sen-cardiology-kolkata" in search
// results. "--" (not "-") is the separator because doctor ids are GUIDs that
// already contain single dashes — splitting on "-" would break the id apart.
export function doctorSlug(doctor: Pick<Doctor, "id" | "name" | "specialty">, city?: string): string {
  const parts = [doctor.name, doctor.specialty, city].filter(Boolean) as string[];
  const words = parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${words}--${doctor.id}`;
}

/** Recover the real doctor id from a slug built by doctorSlug(). */
export function parseDoctorIdFromSlug(slug: string): string {
  const idx = slug.lastIndexOf("--");
  return idx === -1 ? slug : slug.slice(idx + 2);
}

// Google Maps "get directions" link — no API key needed, this is just the public
// maps.google.com URL scheme (opens the Google Maps app on mobile, or maps.google.com
// on desktop). Prefers the hospital's GPS pin when available; falls back to a text
// search on hospital name + city/state so the link still works for mock/incomplete
// data. Returns null only when there's truly nothing to search for.
export function getDirectionsUrl(doctor: Pick<Doctor, "latitude" | "longitude" | "hospitalName" | "address" | "city" | "state">): string | null {
  if (doctor.latitude != null && doctor.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${doctor.latitude},${doctor.longitude}`;
  }
  const query = [doctor.hospitalName, doctor.address, doctor.city, doctor.state].filter(Boolean).join(", ");
  if (!query) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export interface Specialty {
  id: string;
  name: string;
  /** lucide icon key, mapped to a component in the UI layer. */
  icon: string;
  blurb: string;
  /** tailwind text/bg accent used on the specialty tile. */
  accent: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Location model.
//
// City NAMES collide across India — e.g. there's a "Kishanganj" town/district in
// Bihar, and also a "Kishanganj" locality in Delhi (near GTB Nagar). Many tier
// 2/3 town names repeat across states (Bilaspur in Chhattisgarh vs. Himachal
// Pradesh; Hosur, Rajgarh, etc.). So a bare `city: string` is never a safe
// lookup/filter key on its own once you go past a handful of unique metro names.
//
// The fix: treat (name, state) as the real identity, expose a stable `id`
// (slugified from both) for use in <select> values / URLs / API joins, and
// show "Name, State" everywhere in the UI so patients can tell duplicates apart.
// If/when a real geo API or pincode lookup is wired in, THIS is the shape it
// should populate — city name and state must always travel together.
// ─────────────────────────────────────────────────────────────────────────────

export interface CityOption {
  id: string;    // stable key, e.g. "kishanganj-bihar" — the ONLY safe join/filter key
  name: string;  // display name, e.g. "Kishanganj"
  state: string; // required to disambiguate — e.g. "Bihar"
}

export function cityId(name: string, state: string): string {
  return `${name}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function cityLabel(c: Pick<CityOption, "name" | "state">): string {
  return `${c.name}, ${c.state}`;
}

// Resolves a /specialties|/conditions "{city}" URL segment to a real CityOption — first against
// the curated CITIES list (nice canonical casing), then falling back to real doctor records so
// a city with NO curated entry still works once a doctor from there is onboarded (e.g. a doctor
// in Siliguri, West Bengal makes "siliguri-west-bengal" resolve here even though Siliguri isn't
// in CITIES). Uses the doctor's own city/state strings (not a slug->title-case guess), so this
// never mangles casing the way unslugify() would. Returns null only when NEITHER source has it.
export function resolveCity(
  cityIdParam: string,
  doctors: Pick<Doctor, "city" | "state">[]
): CityOption | null {
  const curated = CITIES.find((c) => c.id === cityIdParam);
  if (curated) return curated;
  const match = doctors.find((d) => d.city && d.state && cityId(d.city, d.state) === cityIdParam);
  return match ? { id: cityIdParam, name: match.city, state: match.state } : null;
}

function city(name: string, state: string): CityOption {
  return { id: cityId(name, state), name, state };
}

export const CITIES: CityOption[] = [
  city("Kolkata", "West Bengal"),
  city("Delhi NCR", "Delhi"),
  city("Mumbai", "Maharashtra"),
  city("Bengaluru", "Karnataka"),
  city("Hyderabad", "Telangana"),
  city("Chennai", "Tamil Nadu"),
  // 2/3 town names repeat across states (Bilaspur in Chhattisgarh vs. Himachal
  // Pradesh; Hosur, Rajgarh, etc.). This is exactly the case that breaks name-only filtering — the app
  // must key on `id` (name+state), never on `name` alone.
  city("Kishanganj", "Bihar"),
  city("Kishanganj", "Delhi"),
  city("Purnea", "Bihar"),
];

export const AREAS_BY_CITY: Record<string, string[]> = {
  [cityId("Kolkata", "West Bengal")]: ["Salt Lake", "Gariahat", "New Town", "Behala", "Howrah"],
  [cityId("Delhi NCR", "Delhi")]: ["Saket", "Dwarka", "Noida", "Gurugram"],
  [cityId("Mumbai", "Maharashtra")]: ["Andheri", "Bandra", "Powai", "Thane"],
  [cityId("Bengaluru", "Karnataka")]: ["Koramangala", "Whitefield", "Indiranagar", "HSR Layout"],
  [cityId("Hyderabad", "Telangana")]: ["Gachibowli", "Banjara Hills", "Madhapur"],
  [cityId("Chennai", "Tamil Nadu")]: ["T. Nagar", "Adyar", "Velachery"],
  [cityId("Kishanganj", "Bihar")]: ["Thana Chowk", "Bahadurganj Road"],
  [cityId("Kishanganj", "Delhi")]: ["GTB Nagar", "Malka Ganj"],
  [cityId("Purnea", "Bihar")]: ["Line Bazar", "Bhatta Bazar", "Khazanchi Haat"],
};

export const specialties: Specialty[] = [
  { id: "general",        name: "General Physician",  icon: "stethoscope",  blurb: "Fever, cold, infections & checkups",       accent: "text-teal-600 bg-teal-50"     },
  { id: "pediatrics",     name: "Pediatrics",          icon: "baby",         blurb: "Child health, vaccination & growth",       accent: "text-amber-600 bg-amber-50"   },
  { id: "cardiology",     name: "Cardiology",          icon: "heartPulse",   blurb: "Heart, BP & chest concerns",              accent: "text-rose-600 bg-rose-50"     },
  { id: "dermatology",    name: "Dermatology",          icon: "sparkles",     blurb: "Skin, hair & nail conditions",            accent: "text-fuchsia-600 bg-fuchsia-50"},
  { id: "orthopedics",    name: "Orthopedics",          icon: "bone",         blurb: "Joints, bones & sports injuries",         accent: "text-sky-600 bg-sky-50"       },
  { id: "gynecology",     name: "Gynecology",           icon: "flower",       blurb: "Women's health & pregnancy care",         accent: "text-pink-600 bg-pink-50"     },
  { id: "dentistry",      name: "Dentistry",            icon: "smile",        blurb: "Teeth, gums & oral care",                 accent: "text-indigo-600 bg-indigo-50" },
  { id: "ent",            name: "ENT",                  icon: "ear",          blurb: "Ear, nose & throat issues",              accent: "text-violet-600 bg-violet-50" },
  { id: "ophthalmology",  name: "Ophthalmology",        icon: "eye",          blurb: "Eye care, vision & spectacles",           accent: "text-cyan-600 bg-cyan-50"     },
  { id: "neurology",      name: "Neurology",            icon: "brain",        blurb: "Headache, seizures & nerve disorders",    accent: "text-purple-600 bg-purple-50" },
  { id: "psychiatry",     name: "Psychiatry",           icon: "brain",        blurb: "Mental health, anxiety & depression",     accent: "text-blue-600 bg-blue-50"     },
  { id: "urology",        name: "Urology",              icon: "droplets",     blurb: "Kidney, bladder & urinary tract",         accent: "text-teal-700 bg-teal-50"     },
  { id: "gastroenterology",name: "Gastroenterology",   icon: "activity",     blurb: "Stomach, liver & digestive issues",       accent: "text-orange-600 bg-orange-50" },
  { id: "endocrinology",  name: "Endocrinology",        icon: "zap",          blurb: "Diabetes, thyroid & hormones",            accent: "text-yellow-600 bg-yellow-50" },
  { id: "pulmonology",    name: "Pulmonology",          icon: "wind",         blurb: "Lungs, asthma & breathing",              accent: "text-sky-700 bg-sky-50"       },
  { id: "nephrology",     name: "Nephrology",           icon: "droplets",     blurb: "Kidney disease & dialysis care",          accent: "text-blue-700 bg-blue-50"     },
  { id: "oncology",       name: "Oncology",             icon: "shield",       blurb: "Cancer diagnosis & treatment",            accent: "text-red-600 bg-red-50"       },
  { id: "rheumatology",   name: "Rheumatology",         icon: "activity",     blurb: "Arthritis, lupus & autoimmune disease",  accent: "text-emerald-600 bg-emerald-50"},
  { id: "physiotherapy",  name: "Physiotherapy",        icon: "dumbbell",     blurb: "Rehabilitation, pain & mobility",         accent: "text-lime-600 bg-lime-50"     },
  { id: "dietetics",      name: "Dietetics & Nutrition",icon: "apple",        blurb: "Diet, weight & lifestyle diseases",      accent: "text-green-600 bg-green-50"   },

  // ── Added from the NMC qualification-ladder reference (Section 8 patient-facing
  // categories) — the 19 above already matched an existing Section 8 row 1:1, so only
  // these 11 needed adding. "General Surgery" is the one deliberate addition beyond
  // Section 8 itself (see seed_medical_specialities.sql for why).
  { id: "generalsurgery",       name: "General Surgery",        icon: "scissors",     blurb: "Hernia, gallbladder & general operations", accent: "text-slate-600 bg-slate-50"  },
  { id: "neurosurgery",         name: "Neurosurgery",           icon: "brainCircuit", blurb: "Brain, spine & nerve surgery",             accent: "text-purple-700 bg-purple-50"},
  { id: "plasticsurgery",       name: "Plastic Surgery",        icon: "wand2",        blurb: "Reconstructive & cosmetic surgery",        accent: "text-pink-700 bg-pink-50"    },
  { id: "vascularsurgery",      name: "Vascular Surgery",       icon: "gitBranch",    blurb: "Varicose veins & blood vessel surgery",    accent: "text-rose-700 bg-rose-50"    },
  { id: "cardiothoracicsurgery",name: "Cardiothoracic Surgery", icon: "heartPulse",   blurb: "Heart & chest surgery",                    accent: "text-red-700 bg-red-50"      },
  { id: "anesthesiology",       name: "Anesthesiology",         icon: "syringe",      blurb: "Pain management & surgical anesthesia",    accent: "text-indigo-700 bg-indigo-50"},
  { id: "radiology",            name: "Radiology",              icon: "scanLine",     blurb: "X-ray, CT, MRI & imaging diagnostics",     accent: "text-gray-600 bg-gray-50"    },
  { id: "pathology",            name: "Pathology",              icon: "microscope",   blurb: "Lab diagnostics & disease testing",        accent: "text-stone-600 bg-stone-50"  },
  { id: "emergencymedicine",    name: "Emergency Medicine",     icon: "siren",        blurb: "Trauma, urgent & critical care",           accent: "text-orange-700 bg-orange-50"},
  { id: "geriatrics",           name: "Geriatrics",             icon: "armchair",     blurb: "Elderly care & age-related conditions",    accent: "text-amber-700 bg-amber-50"  },
  { id: "sportsmedicine",       name: "Sports Medicine",        icon: "trophy",       blurb: "Sports injuries & athletic performance",   accent: "text-lime-700 bg-lime-50"    },
];


export const doctors: Doctor[] = [
  {
    id: "1",
    name: "Dr. Ananya Sen",
    gradient: "from-teal-500 to-emerald-500",
    initials: "AS",
    specialtyId: "general",
    specialty: "General Physician",
    qualifications: "MBBS, MD (Internal Medicine)",
    experienceYears: 12,
    rating: 4.9,
    reviewCount: 1240,
    patientsServed: 18500,
    recommendationPct: 98,
    waitTimeMins: 10,
    fee: 600,
    city: "Kolkata",
    state: "West Bengal",
    area: "Salt Lake",
    clinic: "NexEagle Clinic, Salt Lake Sector V",
    languages: ["English", "Hindi", "Bengali"],
    nextAvailable: "Today, 4:30 PM",
    verified: true,
    promoted: true,
    about: "Trusted general physician focused on lifestyle diseases, preventive health and infectious illnesses.",
    focusAreas: ["Diabetes", "Hypertension", "Thyroid", "Viral fever"],
  },
  {
    id: "2",
    name: "Dr. Rahul Banerjee",
    gradient: "from-rose-500 to-red-500",
    initials: "RB",
    specialtyId: "cardiology",
    specialty: "Cardiology",
    qualifications: "MBBS, MD, DM (Cardiology)",
    experienceYears: 15,
    rating: 4.9,
    reviewCount: 980,
    patientsServed: 14200,
    recommendationPct: 97,
    waitTimeMins: 15,
    fee: 1200,
    city: "Kolkata",
    state: "West Bengal",
    area: "Gariahat",
    clinic: "NexEagle Heart Centre, Gariahat",
    languages: ["English", "Hindi", "Bengali"],
    nextAvailable: "Tomorrow, 11:00 AM",
    verified: true,
    promoted: true,
    about: "Senior interventional cardiologist with deep experience in coronary care and preventive cardiology.",
    focusAreas: ["Chest pain", "Blood pressure", "Angioplasty", "Heart failure"],
  },
  {
    id: "3",
    name: "Dr. Priya Sharma",
    gradient: "from-amber-500 to-orange-500",
    initials: "PS",
    specialtyId: "pediatrics",
    specialty: "Pediatrics",
    qualifications: "MBBS, MD (Pediatrics)",
    experienceYears: 8,
    rating: 4.8,
    reviewCount: 1520,
    patientsServed: 21000,
    recommendationPct: 99,
    waitTimeMins: 8,
    fee: 700,
    city: "Kolkata",
    state: "West Bengal",
    area: "New Town",
    clinic: "NexEagle Child Care, New Town",
    languages: ["English", "Hindi"],
    nextAvailable: "Today, 5:00 PM",
    verified: true,
    promoted: false,
    about: "Compassionate pediatrician dedicated to newborn care, immunization and childhood development.",
    focusAreas: ["Vaccination", "Newborn care", "Nutrition", "Fever"],
  },
  {
    id: "4",
    name: "Dr. Amit Das",
    gradient: "from-fuchsia-500 to-purple-500",
    initials: "AD",
    specialtyId: "dermatology",
    specialty: "Dermatology",
    qualifications: "MBBS, MD (Dermatology)",
    experienceYears: 10,
    rating: 4.7,
    reviewCount: 860,
    patientsServed: 12800,
    recommendationPct: 96,
    waitTimeMins: 12,
    fee: 800,
    city: "Kolkata",
    state: "West Bengal",
    area: "Salt Lake",
    clinic: "NexEagle Skin & Hair, Salt Lake",
    languages: ["English", "Hindi", "Bengali"],
    nextAvailable: "Tomorrow, 6:00 PM",
    verified: true,
    promoted: false,
    about: "Board-certified dermatologist expert in acne, chronic skin conditions and cosmetic dermatology.",
    focusAreas: ["Acne", "Hair fall", "Pigmentation", "Allergy"],
  },
  {
    id: "5",
    name: "Dr. Sneha Roy",
    gradient: "from-sky-500 to-blue-500",
    initials: "SR",
    specialtyId: "orthopedics",
    specialty: "Orthopedics",
    qualifications: "MBBS, MS (Orthopedics)",
    experienceYears: 9,
    rating: 4.8,
    reviewCount: 640,
    patientsServed: 9600,
    recommendationPct: 95,
    waitTimeMins: 18,
    fee: 900,
    city: "Kolkata",
    state: "West Bengal",
    area: "Behala",
    clinic: "NexEagle Bone & Joint, Behala",
    languages: ["English", "Bengali"],
    nextAvailable: "Today, 7:00 PM",
    verified: true,
    promoted: false,
    about: "Orthopedic surgeon focused on joint preservation, sports injuries and arthritis care.",
    focusAreas: ["Knee pain", "Back pain", "Fractures", "Arthritis"],
  },
  {
    id: "6",
    name: "Dr. Meera Iyer",
    gradient: "from-pink-500 to-rose-500",
    initials: "MI",
    specialtyId: "gynecology",
    specialty: "Gynecology",
    qualifications: "MBBS, MD, DGO",
    experienceYears: 14,
    rating: 4.9,
    reviewCount: 1120,
    patientsServed: 16400,
    recommendationPct: 98,
    waitTimeMins: 14,
    fee: 1000,
    city: "Kolkata",
    state: "West Bengal",
    area: "Gariahat",
    clinic: "NexEagle Women's Health, Gariahat",
    languages: ["English", "Hindi", "Tamil"],
    nextAvailable: "Tomorrow, 10:30 AM",
    verified: true,
    promoted: true,
    about: "Senior gynecologist specializing in pregnancy care, fertility and women's wellness.",
    focusAreas: ["Pregnancy", "PCOS", "Fertility", "Menstrual health"],
  },
  {
    id: "7",
    name: "Dr. Arjun Mehta",
    gradient: "from-indigo-500 to-violet-500",
    initials: "AM",
    specialtyId: "dentistry",
    specialty: "Dentistry",
    qualifications: "BDS, MDS (Prosthodontics)",
    experienceYears: 7,
    rating: 4.7,
    reviewCount: 540,
    patientsServed: 8200,
    recommendationPct: 94,
    waitTimeMins: 10,
    fee: 500,
    city: "Kolkata",
    state: "West Bengal",
    area: "New Town",
    clinic: "NexEagle Dental Studio, New Town",
    languages: ["English", "Hindi"],
    nextAvailable: "Today, 6:30 PM",
    verified: true,
    promoted: false,
    about: "Dental surgeon focused on painless treatments, implants and smile design.",
    focusAreas: ["Toothache", "Root canal", "Braces", "Whitening"],
  },
  {
    id: "8",
    name: "Dr. Kavya Nair",
    gradient: "from-violet-500 to-purple-500",
    initials: "KN",
    specialtyId: "ent",
    specialty: "ENT Specialist",
    qualifications: "MBBS, MS (ENT)",
    experienceYears: 11,
    rating: 4.8,
    reviewCount: 720,
    patientsServed: 10500,
    recommendationPct: 96,
    waitTimeMins: 12,
    fee: 750,
    city: "Kolkata",
    state: "West Bengal",
    area: "Howrah",
    clinic: "NexEagle ENT Care, Howrah",
    languages: ["English", "Hindi", "Malayalam"],
    nextAvailable: "Tomorrow, 12:00 PM",
    verified: true,
    promoted: false,
    about: "ENT surgeon experienced in sinus, hearing and throat disorders for all ages.",
    focusAreas: ["Sinusitis", "Ear infection", "Tonsils", "Vertigo"],
  },
  {
    id: "9",
    name: "Dr. Rakesh Singh",
    gradient: "from-teal-500 to-cyan-500",
    initials: "RS",
    specialtyId: "general",
    specialty: "General Physician",
    qualifications: "MBBS, MD (Medicine)",
    experienceYears: 18,
    rating: 4.8,
    reviewCount: 340,
    patientsServed: 8500,
    recommendationPct: 95,
    waitTimeMins: 15,
    fee: 400,
    city: "Purnea",
    state: "Bihar",
    area: "Line Bazar",
    clinic: "NexEagle City Care, Line Bazar",
    languages: ["Hindi", "English", "Maithili"],
    nextAvailable: "Today, 4:00 PM",
    verified: true,
    promoted: true,
    about: "Senior physician dedicated to comprehensive family healthcare and fever management in the heart of Purnea.",
    focusAreas: ["Fever", "Diabetes", "Blood Pressure", "General Checkup"],
  },
];

// Appointments are booked as 1-hour windows, not exact times. Patients arrive
// within the window and are issued a queue token at the clinic based on live
// availability.
export const timeSlots = {
  morning: ["09:00 – 10:00 AM", "10:00 – 11:00 AM", "11:00 AM – 12:00 PM"],
  afternoon: ["12:00 – 01:00 PM", "02:00 – 03:00 PM", "03:00 – 04:00 PM"],
  evening: ["05:00 – 06:00 PM", "06:00 – 07:00 PM", "07:00 – 08:00 PM"],
};

/** Compact number formatting for KPI display, e.g. 18500 → "18.5k". */
export function formatCount(n: number): string {
  if (n >= 1000) {
    const v = n / 1000;
    return `${v % 1 === 0 ? v : v.toFixed(1)}k`;
  }
  return `${n}`;
}
