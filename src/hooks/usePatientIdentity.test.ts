import { describe, expect, it } from "vitest";
import { initialsOf, pickDisplayName } from "./usePatientIdentity";

describe("initialsOf", () => {
  it.each([
    ["Aquib (test)", "AT"],
    ["Dr. Asha Rao", "AR"],
    ["Rohan", "R"],
    ["  Meera   Nair  ", "MN"],
    ["Dr.", "D"],
    ["", "P"],
  ])("%s -> %s", (name, expected) => expect(initialsOf(name)).toBe(expected));
});

describe("pickDisplayName", () => {
  const contributor = { isContributor: true, fullName: "Aquib (test)" };

  it("uses the name the person saved themselves, even for a contributor", () => {
    expect(pickDisplayName({ source: "ACCOUNT", fullName: "QA Tester" }, contributor)).toBe("QA Tester");
  });

  it("uses the contributor name until they have saved one", () => {
    expect(pickDisplayName({ source: "BOOKING", fullName: "Aquib" }, contributor)).toBe("Aquib (test)");
    expect(pickDisplayName(undefined, contributor)).toBe("Aquib (test)");
  });

  it("falls back to the booking name for someone who is not a contributor", () => {
    expect(pickDisplayName({ source: "BOOKING", fullName: " Meera Nair " }, { isContributor: false })).toBe("Meera Nair");
  });

  it("is empty when nothing is known", () => {
    expect(pickDisplayName({ source: "NONE" }, undefined)).toBeNull();
  });
});
