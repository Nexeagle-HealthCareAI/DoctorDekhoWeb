// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as ort from "onnxruntime-web";
import { FRAME, WakeCore, WakeDetector, type WakeModels } from "./core";

const DIR = join(process.cwd(), "public", "wakeword");
const FIXTURE = join(process.cwd(), "src", "lib", "wakeword", "parity.fixture.json");

describe("WakeDetector", () => {
  it("needs two frames in a row above the threshold, then waits", () => {
    const d = new WakeDetector({ threshold: 0.5, patience: 2, cooldownMs: 2500 });
    expect(d.step(0.9, 0)).toBe(false);
    expect(d.step(0.2, 80)).toBe(false);
    expect(d.step(0.9, 160)).toBe(false);
    expect(d.step(0.95, 240)).toBe(true);
    expect(d.step(0.99, 320)).toBe(false);
    expect(d.step(0.99, 400)).toBe(false);
    expect(d.step(0.99, 2800)).toBe(false);
    expect(d.step(0.99, 2880)).toBe(true);
  });
  it("ignores frames before the model has heard enough", () => {
    const d = new WakeDetector({ threshold: 0.5, patience: 1, cooldownMs: 0 });
    expect(d.step(null, 0)).toBe(false);
  });
});

describe("WakeCore", () => {
  // The scores the training code (tools/wakeword/oww.py) gives for one "Hey Vita" clip, frame by frame: the browser must hear
  // the same thing the model was trained on.
  it.skipIf(!existsSync(FIXTURE))("gives the same scores as the training pipeline", async () => {
    ort.env.wasm.numThreads = 1;
    const fx = JSON.parse(readFileSync(FIXTURE, "utf8")) as { pcm16: string; scores: (number | null)[] };
    const load = (f: string) => ort.InferenceSession.create(readFileSync(join(DIR, f)));
    const cfg = JSON.parse(readFileSync(join(DIR, "hey_vita.json"), "utf8")) as { model: string };
    const models: WakeModels = { mel: await load("melspectrogram.onnx"), embedding: await load("embedding_model.onnx"), wake: await load(cfg.model), window: 16 };
    const core = new WakeCore(ort, models);
    const pcm = new Int16Array(Buffer.from(fx.pcm16, "base64").buffer.slice(0));
    const audio = Float32Array.from(pcm, (v) => v / 32767);
    const got: (number | null)[] = [];
    for (let i = 0; i + FRAME <= audio.length; i += FRAME) got.push(await core.push(audio.subarray(i, i + FRAME)));
    expect(got.length).toBe(fx.scores.length);
    got.forEach((s, i) => {
      if (fx.scores[i] === null) expect(s).toBeNull();
      else expect(s).toBeCloseTo(fx.scores[i] as number, 3);
    });
    expect(Math.max(...got.filter((s): s is number => s !== null))).toBeGreaterThan(0.5);
  }, 60_000);
});
