import { describe, expect, it } from "vitest";
import { specialtyIdFor, toVitaReply } from "./vitaChat";

describe("toVitaReply", () => {
  it("passes on what the app shows, with Doctor Dekho specialty ids and doctor ids", () => {
    const r = toVitaReply({
      session_id: "abc-123",
      turn: 2,
      kind: "recommendation",
      message: "Aapko Dermatologist ko dikhana chahiye.",
      language: "hinglish",
      card: {
        kind: "recommendation",
        low_confidence: false,
        outputs: [
          { role: "PRIMARY", specialist: "Dermatologist (Skin)", rationale: "itching, rash" },
          { role: "SECONDARY", specialist: "General Physician" },
        ],
        watch_for: ["Fever with rash"],
      },
      state: { symptoms: ["khujli"] },
      doctors: { specialist: "Dermatologist (Skin)", specialtyId: "x", total: 2, doctors: [{ doctor: { doctorId: "d1" }, distanceKm: 1.2 }, { doctorId: "d2" }] },
    });
    expect(r.sessionId).toBe("abc-123");
    expect(r.kind).toBe("recommendation");
    expect(r.specialists.map((s) => s.specialtyId)).toEqual(["dermatology", "general"]);
    expect(r.doctorIds).toEqual(["d1", "d2"]);
    expect(r.watchFor).toEqual(["Fever with rash"]);
    expect(JSON.stringify(r)).not.toContain("khujli"); // session state stays on the server
  });

  it("treats anything unknown as a follow-up question and never throws", () => {
    expect(toVitaReply(null).kind).toBe("follow_up");
    expect(toVitaReply({ kind: "weird", message: "?" }).message).toBe("?");
  });

  it("maps both router vocabularies", () => {
    expect(specialtyIdFor("Orthopaedics")).toBe("orthopedics");
    expect(specialtyIdFor("Orthopaedic Surgeon (Bone)")).toBe("orthopedics");
    expect(specialtyIdFor("Emergency Medicine")).toBe("emergencymedicine");
    expect(specialtyIdFor("Veterinarian")).toBeNull();
  });
});
