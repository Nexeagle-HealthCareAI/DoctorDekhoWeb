import { describe, expect, it } from "vitest";
import { filterChips, textWithout } from "./filters";
import type { VitaDoctorsBlock } from "./types";

const block = (filters: VitaDoctorsBlock["filters"], extra: Partial<VitaDoctorsBlock> = {}): VitaDoctorsBlock => ({
  mode: ["specialty"], filters, items: [], total: 0, fallbackUsed: false, specialist: "Dermatologist", ...extra,
});

describe("filter chips", () => {
  it("lists each applied filter once", () => {
    const b = block({ specialtyId: "Dermatologist (Skin)", gender: "female", availableToday: true, near: true, radiusKm: 5, sort: "fee", degree: "MD" });
    expect(filterChips(b).map((c) => c.key)).toEqual(["specialty", "degree", "gender", "today", "near", "sort"]);
  });

  it("does not offer the specialty of a symptom answer or a fallback as a chip", () => {
    expect(filterChips(block({ specialtyId: "General Physician" }, { mode: ["symptom"] }))).toEqual([]);
    expect(filterChips(block({ specialtyId: "General Physician" }, { fallbackUsed: true }))).toEqual([]);
  });
});

describe("re-search without one filter", () => {
  const b = block({ specialtyId: "Dermatologist (Skin)", gender: "female", availableToday: true, sort: "fee" });

  it("drops only that filter, in words the router reads", () => {
    expect(textWithout(b, "gender")).toBe("Dermatologist aaj available kam fees");
    expect(textWithout(b, "today")).toBe("Dermatologist lady doctor kam fees");
    expect(textWithout(b, "specialty")).toBe("lady doctor aaj available kam fees");
  });

  it("keeps a hospital and a name", () => {
    const h = block({ hospital: { hospitalId: "h", name: "Sadar Hospital" }, query: "sharma" }, { specialist: null });
    expect(textWithout(h, "query")).toBe("Sadar Hospital doctor");
    expect(textWithout(block({ hospital: { hospitalId: "h", name: "AMRI" } }, { specialist: null }), "gender")).toBe("AMRI hospital doctor");
  });

  it("returns null when nothing searchable is left", () => {
    expect(textWithout(block({ specialtyId: "Dermatologist (Skin)" }), "specialty")).toBeNull();
  });
});
