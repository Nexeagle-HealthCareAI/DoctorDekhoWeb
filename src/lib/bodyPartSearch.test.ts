import { describe, expect, it } from "vitest";
import { bodyPartSpecialty } from "./bodyPartSearch";

describe("bodyPartSpecialty", () => {
  it.each([
    ["balon k dr", "dermatology"],
    ["baalon ka doctor", "dermatology"],
    ["बालों के डॉक्टर", "dermatology"],
    ["চুলের ডাক্তার", "dermatology"],
    ["daant ke dr", "dentistry"],
    ["চোখের ডাক্তার", "ophthalmology"],
    ["aankh ka doctor", "ophthalmology"],
    ["kaan naak gala", "ent"],
    ["haddi ka doctor", "orthopedics"],
    ["bachon ke dr", "pediatrics"],
    ["sugar ka doctor", "endocrinology"],
  ])("%s -> %s", (q, want) => {
    expect(bodyPartSpecialty(q)).toBe(want);
  });

  it("leaves mixed or long descriptions to the router and the AI", () => {
    expect(bodyPartSpecialty("pet aur aankh dono mein dard")).toBeNull();
    expect(bodyPartSpecialty("mere bachche ko teen din se bukhar hai aur khansi bhi")).toBeNull();
    expect(bodyPartSpecialty("fever")).toBeNull();
    // Symptom phrases without a doctor word stay with the router, which knows symptoms better than this word list.
    expect(bodyPartSpecialty("pet mein dard")).toBeNull();
    expect(bodyPartSpecialty("skin pe daane")).toBeNull();
    expect(bodyPartSpecialty("")).toBeNull();
  });

  it("never reads 'bal' (child, as in bal rog) as hair", () => {
    expect(bodyPartSpecialty("bal rog doctor")).toBeNull();
  });
});
