import { describe, expect, it } from "vitest";
import { fuzzyMatches, soundKey } from "./fuzzyMatch";

const noori = ["Dr. Md Taquedis Noori", "Urology", "Glisan Akbari Super Speciality Hospital", "Purnea"];

describe("soundKey", () => {
  it("folds the usual spelling differences", () => {
    expect(soundKey("Taqdees")).toBe(soundKey("Taquedis"));
    expect(soundKey("Purnia")).toBe(soundKey("Purnea"));
    expect(soundKey("urolgist")).toBe(soundKey("urologist"));
  });
});

describe("fuzzyMatches", () => {
  it.each(["taqdees noori", "dr taquedis nuri", "urolgist purnia", "yurologist in poornia", "taqdis"])("finds %s", (q) => {
    expect(fuzzyMatches(q, noori)).toBe(true);
  });
  it("does not find a different doctor or a different speciality", () => {
    expect(fuzzyMatches("cardiologist purnea", noori)).toBe(false);
    expect(fuzzyMatches("asif iqbal", noori)).toBe(false);
  });
  it("leaves symptom words and short fragments alone", () => {
    expect(fuzzyMatches("knee pain", ["Orthopedics", "Dr Pankaj Nair"])).toBe(false);
    expect(fuzzyMatches("dr", noori)).toBe(false);
  });
});
