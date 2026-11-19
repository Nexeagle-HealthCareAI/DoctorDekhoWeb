import { describe, expect, it } from "vitest";
import { placeSpellings, specialtyCityKeywords } from "./keywords";

describe("keywords", () => {
  it("lists both spellings of Purnea", () => {
    expect(placeSpellings("Purnea")).toEqual(["Purnea", "Purnia"]);
    expect(placeSpellings("Kishanganj")).toEqual(["Kishanganj"]);
  });
  it("builds the phrases people type, for each spelling", () => {
    const k = specialtyCityKeywords("Urologist", "Urology", "Purnea");
    expect(k).toContain("urologist near me Purnia");
    expect(k).toContain("top urologist Purnea");
    expect(k).toContain("urology doctor near me Purnia");
    expect(new Set(k).size).toBe(k.length);
  });
});
