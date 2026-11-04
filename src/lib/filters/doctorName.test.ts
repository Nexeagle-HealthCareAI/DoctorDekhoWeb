import { describe, expect, it } from "vitest";
import { looksLikeDoctorName, nameMatches, nameWords } from "./doctorName";

describe("doctor names in the search bar", () => {
  it("drops titles, dots and meeting words", () => {
    expect(nameWords("Dr. Avinash Kumar ko dikhana hai")).toEqual(["avinash", "kumar"]);
    expect(nameWords("dr avinash")).toEqual(["avinash"]);
    expect(nameWords("Avinash ji se milna hai")).toEqual(["avinash"]);
  });
  it("knows a query that names a doctor", () => {
    expect(looksLikeDoctorName("dr avinash")).toBe(true);
    expect(looksLikeDoctorName("Dr. Sen")).toBe(true);
    expect(looksLikeDoctorName("doctor neha sharma")).toBe(true);
    expect(looksLikeDoctorName("skin doctor")).toBe(false);
    expect(looksLikeDoctorName("fever")).toBe(false);
  });
  it("matches every word, in any order, ignoring the title", () => {
    expect(nameMatches("Dr. Avinash Kumar", ["avinash"])).toBe(true);
    expect(nameMatches("Dr. Avinash Kumar", ["kumar", "avinash"])).toBe(true);
    expect(nameMatches("Dr. Avinash Kumar", ["avinash", "jha"])).toBe(false);
    expect(nameMatches("Dr. Navin Shah", ["avin"])).toBe(false);
  });
});
