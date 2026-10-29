import { describe, expect, it } from "vitest";
import { startEndpoint, stepEndpoint, type EndpointEvent } from "./endpoint";
import { speechChunks } from "./chunks";

function run(levels: [number, number][]): EndpointEvent[] {
  let s = startEndpoint(0);
  const events: EndpointEvent[] = [];
  for (const [t, level] of levels) {
    const r = stepEndpoint(s, level, t);
    s = r.state;
    events.push(r.event);
  }
  return events;
}
const span = (from: number, to: number, level: number): [number, number][] =>
  Array.from({ length: Math.floor((to - from) / 50) }, (_, i) => [from + i * 50 + 50, level]);

describe("endpointing", () => {
  it("ends the turn after speech and a pause", () => {
    const ev = run([...span(0, 500, 0.005), ...span(500, 2000, 0.1), ...span(2000, 3400, 0.005)]);
    expect(ev.indexOf("done")).toBeGreaterThan(0);
    expect(ev.slice(0, 10).every((e) => e === "listening")).toBe(true);
  });
  it("a click is not speech, and silence stops listening", () => {
    const ev = run([...span(0, 1000, 0.005), [1050, 0.2], ...span(1050, 8100, 0.005)]);
    expect(ev).not.toContain("done");
    expect(ev.at(-1)).toBe("no_speech");
  });
  it("a short pause mid-sentence does not end the turn", () => {
    const ev = run([...span(0, 1000, 0.1), ...span(1000, 1800, 0.004), ...span(1800, 2500, 0.1)]);
    expect(ev).not.toContain("done");
  });
  it("adapts to a noisy room", () => {
    const ev = run([...span(0, 1500, 0.03), ...span(1500, 9000, 0.032)]);
    expect(ev).not.toContain("done");
  });
  it("never runs past the longest turn", () => {
    const ev = run(span(0, 30_100, 0.2));
    expect(ev.at(-1)).toBe("done");
  });
});

describe("speechChunks", () => {
  it("splits sentences and lines, joins short ones, keeps each under the limit", () => {
    const text = "Booked! Dr. Anita Sen, tomorrow morning.\nPlease bring old prescriptions, reports and an ID, and pay at the hospital counter. " +
      "x".repeat(10) + " " + "word ".repeat(60);
    const chunks = speechChunks(text);
    expect(chunks.every((c) => c.length <= 200)).toBe(true);
    expect(chunks[0]).toBe("Booked! Dr. Anita Sen, tomorrow morning. Please bring old prescriptions, reports and an ID, and pay at the hospital counter.");
    expect(chunks.join(" ")).toContain("pay at the hospital counter.");
  });
  it("drops links and markdown", () => {
    expect(speechChunks("**Directions**: https://maps.google.com/x go")).toEqual(["Directions : go"]);
  });
  it("splits Hindi sentences at the danda", () => {
    expect(speechChunks("ठीक है। कल सुबह आइए।", 12)).toEqual(["ठीक है।", "कल सुबह आइए।"]);
  });
});
