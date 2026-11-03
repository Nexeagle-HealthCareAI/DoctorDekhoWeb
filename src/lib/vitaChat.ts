/**
 * Vita, the Doctor Dekho assistant: the app's chat with Vita (the NLP router's `/v2/agent/chat`) (symptoms in Hinglish / Hindi /
 * English → follow-up questions → the right kind of doctor → bookable doctors from 1HMSAPI). This file turns the router's
 * reply into the small, stable shape the app reads; the route in app/api/vita/app-chat holds the router key.
 *
 * Only what the app shows is passed on. The router's accumulated symptom state, keyword tags and severity details stay
 * on the server.
 */

// The router's specialist names (both of its vocabularies, hms_router/domain/taxonomy.py) → Doctor Dekho specialty ids.
const SPECIALIST_TO_ID: Record<string, string> = {
  "anaesthesiology": "anesthesiology", "anaesthesiologist": "anesthesiology",
  "breast surgery": "generalsurgery", "gi surgery": "generalsurgery", "general surgery": "generalsurgery", "general surgeon": "generalsurgery",
  "gi/surgical gastroenterologist": "generalsurgery",
  "cardiology": "cardiology", "cardiologist (heart)": "cardiology",
  "cardiothoracic surgery": "cardiothoracicsurgery", "cardiothoracic surgeon": "cardiothoracicsurgery",
  "dental": "dentistry", "dentist": "dentistry",
  "dermatology": "dermatology", "dermatologist (skin)": "dermatology",
  "ent": "ent", "ent specialist": "ent",
  "emergency medicine": "emergencymedicine", "emergency medicine specialist": "emergencymedicine",
  "endocrinology": "endocrinology", "endocrinologist (hormones/diabetes)": "endocrinology",
  "gastroenterology": "gastroenterology", "gastroenterologist": "gastroenterology",
  "general medicine": "general", "general physician": "general",
  "geriatrics": "geriatrics", "geriatrician": "geriatrics",
  "gynaecology": "gynecology", "gynaecologist": "gynecology",
  "nephrology": "nephrology", "nephrologist (kidney)": "nephrology",
  "neurology": "neurology", "neurologist": "neurology",
  "neurosurgery": "neurosurgery", "neurosurgeon": "neurosurgery",
  "oncology": "oncology", "oncologist (cancer)": "oncology",
  "ophthalmology": "ophthalmology", "ophthalmologist (eye)": "ophthalmology",
  "orthopaedics": "orthopedics", "orthopaedic surgeon (bone)": "orthopedics",
  "paediatrics": "pediatrics", "paediatrician": "pediatrics",
  "pathology": "pathology", "pathologist": "pathology",
  "physiotherapy": "physiotherapy", "physiotherapist / rehab": "physiotherapy",
  "plastic surgery": "plasticsurgery", "plastic surgeon": "plasticsurgery",
  "psychiatry": "psychiatry", "psychiatrist": "psychiatry",
  "pulmonology": "pulmonology", "pulmonologist (chest/lungs)": "pulmonology",
  "radiology": "radiology", "radiologist": "radiology",
  "rheumatology": "rheumatology", "rheumatologist": "rheumatology",
  "sports medicine": "sportsmedicine", "sports medicine specialist": "sportsmedicine",
  "urology": "urology", "urologist": "urology",
  "vascular surgery": "vascularsurgery", "vascular surgeon": "vascularsurgery",
};

export function specialtyIdFor(specialist: string | null | undefined): string | null {
  return specialist ? (SPECIALIST_TO_ID[specialist.trim().toLowerCase()] ?? null) : null;
}

export interface VitaSpecialist {
  role: "PRIMARY" | "SECONDARY" | "ALTERNATIVE" | "EMERGENCY" | string;
  specialist: string;
  specialtyId: string | null;
  why: string | null;
}

export interface VitaReply {
  sessionId: string;
  /** follow_up: Vita asks a question · recommendation: the right kind of doctor · emergency: go to hospital now */
  kind: "follow_up" | "recommendation" | "emergency";
  /** Ready-to-show text in the patient's language. */
  message: string;
  question: string | null;
  language: string;
  lowConfidence: boolean;
  specialists: VitaSpecialist[];
  /** Bookable doctors for the main specialist (ids from Doctor Dekho's directory), nearest first when location was sent. */
  doctorIds: string[];
  watchFor: string[];
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export function toVitaReply(raw: unknown): VitaReply {
  const r = (raw && typeof raw === "object" ? raw : {}) as Raw;
  const card = (r.card && typeof r.card === "object" ? r.card : {}) as Raw;
  const outputs = Array.isArray(card.outputs) ? (card.outputs as Raw[]) : [];
  const kind = r.kind === "emergency" || r.kind === "recommendation" ? r.kind : "follow_up";
  const doctorsBlock = (r.doctors && typeof r.doctors === "object" ? r.doctors : {}) as Raw;
  const list = Array.isArray(doctorsBlock.doctors) ? (doctorsBlock.doctors as Raw[]) : [];
  const doctorIds = list
    .map((d) => {
      // 1HMSAPI's search_doctors returns { doctor: { doctorId, … }, distanceKm }; accept a flat item too.
      const inner = (d.doctor && typeof d.doctor === "object" ? d.doctor : d) as Raw;
      return str(inner.doctorId) ?? str(inner.id);
    })
    .filter((x): x is string => !!x);
  return {
    sessionId: str(r.session_id) ?? "",
    kind,
    message: str(r.message) ?? "",
    question: str(r.question),
    language: str(r.language) ?? "english",
    lowConfidence: card.low_confidence === true,
    specialists: outputs
      .map((o) => ({ role: str(o.role) ?? "PRIMARY", specialist: str(o.specialist) ?? "", specialtyId: specialtyIdFor(str(o.specialist)), why: str(o.why) ?? str(o.rationale) }))
      .filter((s) => s.specialist),
    doctorIds: Array.from(new Set(doctorIds)).slice(0, 5),
    watchFor: Array.isArray(card.watch_for) ? (card.watch_for as unknown[]).filter((w): w is string => typeof w === "string").slice(0, 4) : [],
  };
}
