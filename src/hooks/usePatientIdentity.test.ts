import { describe, expect, it } from "vitest";
import { initialsOf } from "./usePatientIdentity";

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
