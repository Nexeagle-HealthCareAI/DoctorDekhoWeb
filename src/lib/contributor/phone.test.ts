import { describe, expect, it } from "vitest";
import { COUNTRIES, DEFAULT_COUNTRY, cleanNational, toApiMobile } from "./phone";

const by = (iso: string) => COUNTRIES.find((c) => c.iso === iso)!;

describe("contributor WhatsApp number", () => {
  it("keeps India as a bare 10-digit number", () => {
    expect(toApiMobile(DEFAULT_COUNTRY, "98765 43210")).toBe("9876543210");
    expect(toApiMobile(DEFAULT_COUNTRY, "5876543210")).toBeNull();
    expect(toApiMobile(DEFAULT_COUNTRY, "98765")).toBeNull();
  });
  it("sends another country as +<code><number>", () => {
    expect(toApiMobile(by("US"), "(415) 555-0123")).toBe("+14155550123");
    expect(toApiMobile(by("GB"), "07911 123456")).toBe("+447911123456");
    expect(toApiMobile(by("SG"), "8123 4567")).toBe("+6581234567");
  });
  it("refuses numbers that are too short and caps the length at 15 digits in all", () => {
    expect(toApiMobile(by("US"), "123")).toBeNull();
    expect(cleanNational(by("AE"), "1".repeat(20))).toHaveLength(12);
  });
});
