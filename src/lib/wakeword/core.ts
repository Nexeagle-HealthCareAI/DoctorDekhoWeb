// "Hey Vita": the wake-word models, frame by frame. The same steps as the training (tools/wakeword/oww.py), so the model hears
// in the browser what it heard when it was trained:
//   16 kHz audio, 1280 samples (80 ms) at a time -> melspectrogram of the last 1760 samples -> mel / 10 + 2 -> the last 76 mel
//   frames -> embedding (96) -> the last 16 embeddings -> the "Hey Vita" model -> a score from 0 to 1.
// The melspectrogram and embedding models are openWakeWord's (Apache-2.0); the "Hey Vita" model is ours.
import type * as OrtTypes from "onnxruntime-web";

export type Ort = typeof OrtTypes;
export const FRAME = 1280;
const CONTEXT = 480;
const MEL_BINS = 32;
const MEL_WINDOW = 76;
const EMB = 96;

export interface WakeModels {
  mel: OrtTypes.InferenceSession;
  embedding: OrtTypes.InferenceSession;
  wake: OrtTypes.InferenceSession;
  /** How many embeddings the wake model reads (16). */
  window: number;
}

export async function loadModels(ort: Ort, urls: { mel: string; embedding: string; wake: string }): Promise<WakeModels> {
  const opts: OrtTypes.InferenceSession.SessionOptions = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
  const [mel, embedding, wake] = await Promise.all([
    ort.InferenceSession.create(urls.mel, opts),
    ort.InferenceSession.create(urls.embedding, opts),
    ort.InferenceSession.create(urls.wake, opts),
  ]);
  return { mel, embedding, wake, window: 16 };
}

export class WakeCore {
  private raw = new Float32Array(FRAME + CONTEXT);
  private mels: Float32Array[] = [];
  private embs: Float32Array[] = [];
  private busy: Promise<number | null> = Promise.resolve(null);

  constructor(private ort: Ort, private models: WakeModels) {
    this.reset();
  }

  reset() {
    this.raw = new Float32Array(FRAME + CONTEXT);
    this.mels = Array.from({ length: MEL_WINDOW }, () => new Float32Array(MEL_BINS).fill(1));
    this.embs = [];
  }

  /** One 80 ms frame (float samples in -1..1). Resolves to the wake score, or null until enough audio was heard. Calls queue up
   * in order. */
  push(frame: Float32Array): Promise<number | null> {
    const next = this.busy.then(() => this.step(frame));
    this.busy = next.catch(() => null);
    return next;
  }

  private async step(frame: Float32Array): Promise<number | null> {
    const { ort, models } = this;
    this.raw.copyWithin(0, FRAME);
    for (let i = 0; i < FRAME; i++) this.raw[CONTEXT + i] = Math.max(-1, Math.min(1, frame[i])) * 32767;

    const melOut = await models.mel.run({ [models.mel.inputNames[0]]: new ort.Tensor("float32", this.raw.slice(), [1, this.raw.length]) });
    const m = melOut[models.mel.outputNames[0]].data as Float32Array;
    for (let f = 0; f + MEL_BINS <= m.length; f += MEL_BINS) {
      const row = new Float32Array(MEL_BINS);
      for (let b = 0; b < MEL_BINS; b++) row[b] = m[f + b] / 10 + 2;
      this.mels.push(row);
    }
    if (this.mels.length > MEL_WINDOW) this.mels.splice(0, this.mels.length - MEL_WINDOW);

    const win = new Float32Array(MEL_WINDOW * MEL_BINS);
    this.mels.forEach((row, i) => win.set(row, i * MEL_BINS));
    const embOut = await models.embedding.run({ [models.embedding.inputNames[0]]: new ort.Tensor("float32", win, [1, MEL_WINDOW, MEL_BINS, 1]) });
    this.embs.push(Float32Array.from(embOut[models.embedding.outputNames[0]].data as Float32Array));
    if (this.embs.length > models.window) this.embs.shift();
    if (this.embs.length < models.window) return null;

    const x = new Float32Array(models.window * EMB);
    this.embs.forEach((e, i) => x.set(e, i * EMB));
    const out = await models.wake.run({ [models.wake.inputNames[0]]: new ort.Tensor("float32", x, [1, models.window, EMB]) });
    return (out[models.wake.outputNames[0]].data as Float32Array)[0];
  }
}

/** When does a score count as "Hey Vita"? A few frames above the threshold in a row (one loud click is not enough), then quiet
 * for a while so one "Hey Vita" opens Vita once. */
export class WakeDetector {
  private above = 0;
  private until = 0;

  constructor(private cfg: { threshold: number; patience: number; cooldownMs: number } = { threshold: 0.5, patience: 2, cooldownMs: 2500 }) {}

  step(score: number | null, now: number): boolean {
    if (score === null || now < this.until) {
      this.above = 0;
      return false;
    }
    this.above = score >= this.cfg.threshold ? this.above + 1 : 0;
    if (this.above >= this.cfg.patience) {
      this.above = 0;
      this.until = now + this.cfg.cooldownMs;
      return true;
    }
    return false;
  }
}
