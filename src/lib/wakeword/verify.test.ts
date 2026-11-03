import { describe, expect, it } from "vitest";
import { saysVita } from "./verify";

describe("saysVita", () => {
  it.each(["Hey Vita.", "Hey, Vita!", "hi vita", "Vita?", "Hey Veeta", "हे वीटा", "हेवीटा", "हाय विटा", "Hey Vita, mujhe bukhar hai", "হে ভিটা"])(
    "%s -> yes", (t) => expect(saysVita(t)).toBe(true));
  it.each(["Hey Neeta", "Hey Rita", "Kavita", "Savita ji", "कविता", "सविता आई", "vitamin", "Hey Beta", "Hey Veena", "vital signs", "কবিতা", ""])(
    "%s -> no", (t) => expect(saysVita(t)).toBe(false));
});
