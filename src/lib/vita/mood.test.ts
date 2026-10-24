import { describe, expect, it } from "vitest";
import { chatMood, launcherMood, replyMood, WORKING_AFTER_MS } from "./mood";
import type { VitaReply } from "./types";

const reply = (kind: VitaReply["kind"], extra: Partial<VitaReply> = {}): VitaReply =>
  ({ session_id: "s", turn: 1, kind, message: "m", ...extra }) as VitaReply;

describe("Vita's mood follows what Vita is doing", () => {
  it("welcomes on an empty chat", () => {
    expect(chatMood({ last: undefined, busy: false, waitedMs: 0 })).toBe("welcome");
  });

  it("thinks for a beat, then works while a search runs", () => {
    const last = { role: "user" as const };
    expect(chatMood({ last, busy: true, waitedMs: 0 })).toBe("thinking");
    expect(chatMood({ last, busy: true, waitedMs: WORKING_AFTER_MS })).toBe("working");
  });

  it("maps each reply to its moment", () => {
    expect(replyMood(reply("doctor_selected"))).toBe("joyful");
    expect(replyMood(reply("follow_up"))).toBe("thinking");
    expect(replyMood(reply("doctor_list"))).toBe("welcome");
    expect(replyMood(reply("info"))).toBe("relaxed");
    expect(replyMood(reply("info", { doctor: { doctorId: "d" } }))).toBe("welcome");
    expect(replyMood(reply("handoff"))).toBe("relaxed");
  });

  it("has no eagle in an emergency, and never an angry one", () => {
    expect(chatMood({ last: { role: "vita", reply: reply("emergency") }, busy: false, waitedMs: 0 })).toBe("emergency");
    const all = ["follow_up", "recommendation", "doctor_list", "doctor_selected", "info", "handoff", "emergency"] as const;
    for (const k of all) expect(replyMood(reply(k))).not.toBe("angry");
  });

  it("the launcher sleeps after goodbye and rests otherwise", () => {
    expect(launcherMood(undefined)).toBe("resting");
    expect(launcherMood(reply("info"))).toBe("sleeping");
    expect(launcherMood(reply("doctor_list"))).toBe("resting");
  });
});
