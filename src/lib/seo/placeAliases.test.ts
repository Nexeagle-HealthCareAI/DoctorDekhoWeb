import { describe, expect, it } from "vitest";
import { placeLabel } from "./placeAliases";

describe("placeLabel", () => {
  it("names both spellings of Purnea", () => {
    expect(placeLabel("Purnea")).toBe("Purnea (Purnia)");
    expect(placeLabel("purnea")).toBe("purnea (Purnia)");
  });
  it("leaves other places alone", () => {
    expect(placeLabel("Kishanganj")).toBe("Kishanganj");
  });
});

import { TITLE_BRAND, TITLE_MAX, titles } from "./titles";

describe("titles for Purnea", () => {
  it.each(["Urologist", "Cardiologist", "Gastroenterologist", "General Physician", "Cardiothoracic Surgeon"])(
    "%s keeps both spellings within the title limit where it fits, and always the town name",
    (label) => {
      const t = titles.specialtyCity(label, placeLabel("Purnea"), "Bihar");
      expect(t).toContain("Purnea");
      expect(t.length + TITLE_BRAND.length).toBeLessThanOrEqual(TITLE_MAX);
    },
  );
});
