import { describe, expect, it } from "vitest";
import { AREAS_BY_CITY, CITIES, specialties } from "@/data/patient";
import { DESCRIPTION_MAX, TITLE_BRAND, TITLE_MAX, descriptions, doctorLabel, doctorLabelPlural, fitDescription, fitTitle, titles } from "./titles";

describe("fitTitle / fitDescription", () => {
  it("uses the fullest wording that fits, with the brand the layout adds", () => {
    expect(fitTitle(["a".repeat(50), "short"])).toBe("short");
    expect(fitTitle(["a".repeat(TITLE_MAX - TITLE_BRAND.length), "short"])).toBe("a".repeat(TITLE_MAX - TITLE_BRAND.length));
  });
  it("falls back to the shortest wording when none fits", () => {
    expect(fitTitle(["a".repeat(90), "b".repeat(70)])).toBe("b".repeat(70));
    expect(fitDescription(["x".repeat(200), "y".repeat(170)])).toBe("y".repeat(170));
  });
  it("keeps a description that fits", () => {
    expect(fitDescription(["z".repeat(DESCRIPTION_MAX), "short"])).toBe("z".repeat(DESCRIPTION_MAX));
  });
});

describe("doctor labels", () => {
  it("names the doctor the way a patient searches, not the speciality plus an s", () => {
    expect(doctorLabel("cardiology", "Cardiology")).toBe("Cardiologist");
    expect(doctorLabelPlural("cardiology", "Cardiology")).toBe("Cardiologists");
    expect(doctorLabelPlural("urology", "Urology")).toBe("Urologists");
    expect(doctorLabelPlural("ent", "ENT")).toBe("ENT Specialists");
  });
  it("has a label for every speciality on the site, and none ends up as 'Namess'", () => {
    for (const s of specialties) {
      const label = doctorLabel(s.id, s.name);
      // A speciality's own name ("Cardiology", "Gynecology") is not what you call the doctor.
      expect(/(ology|iatry|ics|apy|ition)$/i.test(label), label).toBe(false);
      expect(doctorLabelPlural(s.id, s.name)).toBe(`${label}s`);
    }
  });
  it("falls back to '<name> Doctor' for a speciality it does not know", () => {
    expect(doctorLabelPlural("newthing", "Newology")).toBe("Newology Doctors");
  });
  it("gives every speciality, city and area on the site a title and description that fit", () => {
    const fits = (title: string) => expect(title.length + TITLE_BRAND.length, title).toBeLessThanOrEqual(TITLE_MAX);
    for (const s of specialties) {
      const label = doctorLabel(s.id, s.name);
      const plural = doctorLabelPlural(s.id, s.name);
      fits(titles.specialty(label));
      expect(descriptions.specialty(plural).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
      for (const c of CITIES) {
        fits(titles.specialtyCity(label, c.name, c.state));
        expect(descriptions.specialty(plural, `${c.name}, ${c.state}`).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
        for (const a of AREAS_BY_CITY[c.id] ?? []) fits(titles.specialtyArea(label, a, c.name));
      }
    }
  });
  it("keeps condition and hospital titles and descriptions within the limits", () => {
    const fits = (title: string) => expect(title.length + TITLE_BRAND.length, title).toBeLessThanOrEqual(TITLE_MAX);
    fits(titles.conditionCity("Intensive Critical Care", "Kolkata", "West Bengal"));
    fits(titles.conditionArea("Consultant Neurosurgeon", "Salt Lake", "Kolkata"));
    fits(titles.hospital("R.K. MultiSpeciality Hospital"));
    // A very long name keeps the word "Doctors" and gives up only the brand's tail, rather than becoming just the name.
    expect(titles.hospital("Glisan Akbari Super Speciality Hospital")).toBe("Doctors at Glisan Akbari Super Speciality Hospital");
    expect(descriptions.condition("Intensive Critical Care", "Kolkata, West Bengal").length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(descriptions.hospital("Glisan Akbari Super Speciality Hospital").length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
  it("words a description with 'in <place>' or 'near you'", () => {
    expect(descriptions.specialty("Urologists", "Purnea, Bihar")).toContain("best Urologists in Purnea, Bihar.");
    expect(descriptions.specialty("Urologists")).toContain("best Urologists near you.");
  });
  it("never produces 'Cardiologys'", () => {
    expect(titles.specialtyCity(doctorLabel("cardiology", "Cardiology"), "Purnea", "Bihar")).toBe("Best Cardiologist in Purnea | Book Online");
  });
});
